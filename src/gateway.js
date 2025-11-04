const { WebSocketServer } = require('ws');
const http = require('http');
const SessionManager = require('./session-manager');
const protocol = require('./protocol');
const utils = require('./utils');

/**
 * WhatsAppGateway - WebSocket gateway for WhatsApp Chrome Extension automation
 */
class WhatsAppGateway {
  /**
   * Create a new WhatsAppGateway instance
   * @param {object} config - Gateway configuration
   */
  constructor(config) {
    // Validate required callbacks
    if (!config.validateApiKey || typeof config.validateApiKey !== 'function') {
      throw new Error('validateApiKey callback is required');
    }
    if (!config.onMessageLog || typeof config.onMessageLog !== 'function') {
      throw new Error('onMessageLog callback is required');
    }
    if (!config.onError || typeof config.onError !== 'function') {
      throw new Error('onError callback is required');
    }

    this.config = {
      port: config.port || 3000,
      path: config.path || '/wa-ext-ws',
      server: config.server || null,
      validateApiKey: config.validateApiKey,
      onMessageLog: config.onMessageLog,
      onError: config.onError,
      heartbeatInterval: config.heartbeatInterval || 30000,
      requestTimeout: config.requestTimeout || 30000,
      maxSessionsPerKey: config.maxSessionsPerKey || 10,
      deviceSelectionStrategy: config.deviceSelectionStrategy || 'round-robin'
    };

    this.sessionManager = new SessionManager({
      heartbeatInterval: this.config.heartbeatInterval,
      maxSessionsPerKey: this.config.maxSessionsPerKey,
      deviceSelectionStrategy: this.config.deviceSelectionStrategy
    });

    this.wss = null;
    this.httpServer = null;
    this.isRunning = false;
    this.startTime = null;

    // Bind methods
    this._handleConnection = this._handleConnection.bind(this);
    this._handleMessage = this._handleMessage.bind(this);
    this._handleClose = this._handleClose.bind(this);
    this._handleError = this._handleError.bind(this);
  }

  /**
   * Start the WebSocket server
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Gateway is already running');
    }

    return new Promise((resolve, reject) => {
      try {
        // Use provided server or create new one
        if (this.config.server) {
          this.httpServer = this.config.server;
        } else {
          this.httpServer = http.createServer();
          this.httpServer.listen(this.config.port, () => {
            console.log(`WhatsApp Gateway HTTP server listening on port ${this.config.port}`);
          });
        }

        // Create WebSocket server
        this.wss = new WebSocketServer({
          server: this.httpServer,
          path: this.config.path
        });

        this.wss.on('connection', this._handleConnection);

        this.wss.on('error', (error) => {
          this.config.onError({
            code: 'WSS_ERROR',
            message: 'WebSocket server error',
            originalError: error.message
          });
        });

        // Start heartbeat monitor
        this.sessionManager.startHeartbeatMonitor((staleSession) => {
          console.log(`Session ${staleSession.sessionId} timed out - no heartbeat`);
          if (staleSession.ws.readyState === 1) { // OPEN
            staleSession.ws.close(1000, 'Heartbeat timeout');
          }
        });

        this.isRunning = true;
        this.startTime = Date.now();

        console.log(`WhatsApp Gateway WebSocket server started on ${this.config.path}`);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the WebSocket server
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    return new Promise((resolve) => {
      // Stop heartbeat monitor
      this.sessionManager.stopHeartbeatMonitor();

      // Close all WebSocket connections
      if (this.wss) {
        this.wss.clients.forEach((ws) => {
          ws.close(1000, 'Server shutting down');
        });

        this.wss.close(() => {
          console.log('WebSocket server closed');
        });
      }

      // Close HTTP server if we created it
      if (this.httpServer && !this.config.server) {
        this.httpServer.close(() => {
          console.log('HTTP server closed');
        });
      }

      // Cleanup sessions
      this.sessionManager.cleanup();

      this.isRunning = false;
      this.startTime = null;

      resolve();
    });
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {object} request - HTTP request
   * @private
   */
  _handleConnection(ws, request) {
    const ip = utils.getClientIp(request);
    console.log(`New WebSocket connection from ${ip}`);

    // Store temporary data until authentication
    ws._tempData = {
      ip,
      authenticated: false,
      sessionId: null
    };

    // Set up event handlers
    ws.on('message', (data) => this._handleMessage(ws, data));
    ws.on('close', () => this._handleClose(ws));
    ws.on('error', (error) => this._handleError(ws, error));

    // Send ping periodically
    ws._pingInterval = setInterval(() => {
      if (ws.readyState === 1) { // OPEN
        ws.send(protocol.createPingCommand());
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Handle incoming WebSocket message
   * @param {WebSocket} ws - WebSocket connection
   * @param {Buffer} data - Message data
   * @private
   */
  async _handleMessage(ws, data) {
    try {
      const rawMessage = data.toString();
      const message = protocol.parseMessage(rawMessage);

      if (!message) {
        this._sendError(ws, 'INVALID_MESSAGE', 'Invalid message format');
        return;
      }

      const result = protocol.handleExtensionMessage(message);

      if (!result.valid) {
        this._sendError(ws, 'VALIDATION_ERROR', result.error);
        return;
      }

      // Handle different message types
      switch (result.type) {
        case 'auth':
          await this._handleAuthMessage(ws, result.data);
          break;

        case 'status':
          this._handleStatusMessage(ws, result.data);
          break;

        case 'message-result':
          this._handleMessageResult(ws, result.data);
          break;

        case 'heartbeat':
          this._handleHeartbeat(ws, result.data);
          break;

        default:
          this._sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${result.type}`);
      }
    } catch (error) {
      this.config.onError({
        code: 'MESSAGE_HANDLER_ERROR',
        message: 'Error handling message',
        originalError: error.message
      });
    }
  }

  /**
   * Handle authentication message
   * @param {WebSocket} ws - WebSocket connection
   * @param {object} data - Auth data
   * @private
   */
  async _handleAuthMessage(ws, data) {
    try {
      // Validate API key using user callback
      const validationResult = await this.config.validateApiKey(data.apiKey);

      if (!validationResult || !validationResult.valid) {
        this._sendError(ws, 'AUTHENTICATION_FAILED', 'Invalid API key');
        ws.close(1008, 'Authentication failed');
        return;
      }

      // Add session
      try {
        const session = this.sessionManager.addSession(data.apiKey, ws, {
          ip: ws._tempData.ip,
          extensionVersion: data.extensionVersion,
          browser: data.browser
        });

        ws._tempData.authenticated = true;
        ws._tempData.sessionId = session.sessionId;

        console.log(`Session ${session.sessionId} authenticated for API key ${utils.sanitizeApiKey(data.apiKey)}`);

        // Send success response
        ws.send(JSON.stringify({
          type: 'auth-success',
          sessionId: session.sessionId
        }));
      } catch (error) {
        if (error.message.includes('MAX_SESSIONS_EXCEEDED')) {
          this._sendError(ws, 'MAX_SESSIONS_EXCEEDED', error.message);
          ws.close(1008, 'Max sessions exceeded');
        } else {
          throw error;
        }
      }
    } catch (error) {
      this.config.onError({
        code: 'AUTH_ERROR',
        message: 'Error during authentication',
        originalError: error.message
      });
      ws.close(1011, 'Authentication error');
    }
  }

  /**
   * Handle status update message
   * @param {WebSocket} ws - WebSocket connection
   * @param {object} data - Status data
   * @private
   */
  _handleStatusMessage(ws, data) {
    if (!ws._tempData.authenticated) {
      this._sendError(ws, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    this.sessionManager.updateSessionStatus(ws._tempData.sessionId, data);
    console.log(`Session ${ws._tempData.sessionId} status: WhatsApp ${data.whatsappLoggedIn ? 'logged in' : 'not logged in'}`);
  }

  /**
   * Handle message result from extension
   * @param {WebSocket} ws - WebSocket connection
   * @param {object} data - Result data
   * @private
   */
  _handleMessageResult(ws, data) {
    if (!ws._tempData.authenticated) {
      return;
    }

    const resolved = this.sessionManager.resolvePendingRequest(
      ws._tempData.sessionId,
      data.requestId,
      data
    );

    if (resolved) {
      const session = this.sessionManager.getSession(ws._tempData.sessionId);
      
      // Log the message
      this.config.onMessageLog({
        apiKey: session.apiKey,
        sessionId: session.sessionId,
        phoneNumber: 'unknown', // Extension should send this in future version
        type: 'unknown', // Extension should send this
        status: data.success ? 'success' : 'failure',
        timestamp: data.timestamp,
        requestId: data.requestId,
        error: data.error
      });
    }
  }

  /**
   * Handle heartbeat message
   * @param {WebSocket} ws - WebSocket connection
   * @param {object} data - Heartbeat data
   * @private
   */
  _handleHeartbeat(ws, data) {
    if (!ws._tempData.authenticated) {
      return;
    }

    this.sessionManager.updateHeartbeat(ws._tempData.sessionId);
  }

  /**
   * Handle WebSocket close
   * @param {WebSocket} ws - WebSocket connection
   * @private
   */
  _handleClose(ws) {
    if (ws._pingInterval) {
      clearInterval(ws._pingInterval);
    }

    if (ws._tempData.authenticated && ws._tempData.sessionId) {
      console.log(`Session ${ws._tempData.sessionId} disconnected`);
      this.sessionManager.removeSession(ws._tempData.sessionId);
    }
  }

  /**
   * Handle WebSocket error
   * @param {WebSocket} ws - WebSocket connection
   * @param {Error} error - Error object
   * @private
   */
  _handleError(ws, error) {
    this.config.onError({
      code: 'WS_ERROR',
      message: 'WebSocket error',
      sessionId: ws._tempData?.sessionId,
      originalError: error.message
    });
  }

  /**
   * Send error message to client
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @private
   */
  _sendError(ws, code, message) {
    if (ws.readyState === 1) { // OPEN
      ws.send(JSON.stringify({
        type: 'error',
        error: {
          code,
          message
        }
      }));
    }
  }

  /**
   * Send a text message
   * @param {string} apiKey - API key
   * @param {object} data - Message data { phoneNumber, message }
   * @returns {Promise<object>} Message result
   */
  async sendMessage(apiKey, data) {
    // Validate input
    const validation = protocol.validateSendMessageData(data);
    if (!validation.valid) {
      throw utils.formatError('VALIDATION_ERROR', validation.error);
    }

    // Get session for sending
    const session = this.sessionManager.getSessionForSending(apiKey);
    if (!session) {
      throw utils.formatError(
        'NO_ACTIVE_DEVICE',
        'No active WhatsApp device connected for this API key',
        { apiKey: utils.sanitizeApiKey(apiKey) }
      );
    }

    // Generate request ID
    const requestId = utils.generateRequestId();

    // Create command
    const command = protocol.createSendMessageCommand(requestId, data);

    // Create promise for result
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        this.sessionManager.resolvePendingRequest(session.sessionId, requestId, null);
        reject(utils.formatError('REQUEST_TIMEOUT', 'Request timed out after 30 seconds'));
      }, this.config.requestTimeout);

      // Add to pending requests
      this.sessionManager.addPendingRequest(session.sessionId, requestId, {
        resolve,
        reject,
        timeoutId,
        createdAt: Date.now(),
        type: 'message'
      });

      // Send command
      if (session.ws.readyState === 1) { // OPEN
        session.ws.send(command);
      } else {
        clearTimeout(timeoutId);
        this.sessionManager.resolvePendingRequest(session.sessionId, requestId, null);
        reject(utils.formatError('CONNECTION_LOST', 'WebSocket connection is not open'));
      }
    });
  }

  /**
   * Send an image
   * @param {string} apiKey - API key
   * @param {object} data - Image data { phoneNumber, imageUrl OR imageDataUrl, caption }
   * @returns {Promise<object>} Message result
   */
  async sendImage(apiKey, data) {
    // Validate input
    const validation = protocol.validateSendImageData(data);
    if (!validation.valid) {
      throw utils.formatError('VALIDATION_ERROR', validation.error);
    }

    // Convert URL to dataURL if needed
    let imageDataUrl = data.imageDataUrl;
    if (!imageDataUrl && data.imageUrl) {
      try {
        imageDataUrl = await utils.imageUrlToDataUrl(data.imageUrl);
      } catch (error) {
        throw error;
      }
    }

    // Get session for sending
    const session = this.sessionManager.getSessionForSending(apiKey);
    if (!session) {
      throw utils.formatError(
        'NO_ACTIVE_DEVICE',
        'No active WhatsApp device connected for this API key',
        { apiKey: utils.sanitizeApiKey(apiKey) }
      );
    }

    // Generate request ID
    const requestId = utils.generateRequestId();

    // Create command
    const command = protocol.createSendImageCommand(requestId, {
      phoneNumber: data.phoneNumber,
      imageDataUrl,
      caption: data.caption
    });

    // Create promise for result
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.sessionManager.resolvePendingRequest(session.sessionId, requestId, null);
        reject(utils.formatError('REQUEST_TIMEOUT', 'Request timed out after 30 seconds'));
      }, this.config.requestTimeout);

      this.sessionManager.addPendingRequest(session.sessionId, requestId, {
        resolve,
        reject,
        timeoutId,
        createdAt: Date.now(),
        type: 'image'
      });

      if (session.ws.readyState === 1) {
        session.ws.send(command);
      } else {
        clearTimeout(timeoutId);
        this.sessionManager.resolvePendingRequest(session.sessionId, requestId, null);
        reject(utils.formatError('CONNECTION_LOST', 'WebSocket connection is not open'));
      }
    });
  }

  /**
   * Send a video
   * @param {string} apiKey - API key
   * @param {object} data - Video data { phoneNumber, videoUrl OR videoDataUrl, caption }
   * @returns {Promise<object>} Message result
   */
  async sendVideo(apiKey, data) {
    // Validate input
    const validation = protocol.validateSendVideoData(data);
    if (!validation.valid) {
      throw utils.formatError('VALIDATION_ERROR', validation.error);
    }

    // Convert URL to dataURL if needed
    let videoDataUrl = data.videoDataUrl;
    if (!videoDataUrl && data.videoUrl) {
      try {
        videoDataUrl = await utils.videoUrlToDataUrl(data.videoUrl);
      } catch (error) {
        throw error;
      }
    }

    // Get session for sending
    const session = this.sessionManager.getSessionForSending(apiKey);
    if (!session) {
      throw utils.formatError(
        'NO_ACTIVE_DEVICE',
        'No active WhatsApp device connected for this API key',
        { apiKey: utils.sanitizeApiKey(apiKey) }
      );
    }

    // Generate request ID
    const requestId = utils.generateRequestId();

    // Create command
    const command = protocol.createSendVideoCommand(requestId, {
      phoneNumber: data.phoneNumber,
      videoDataUrl,
      caption: data.caption
    });

    // Create promise for result
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.sessionManager.resolvePendingRequest(session.sessionId, requestId, null);
        reject(utils.formatError('REQUEST_TIMEOUT', 'Request timed out after 30 seconds'));
      }, this.config.requestTimeout);

      this.sessionManager.addPendingRequest(session.sessionId, requestId, {
        resolve,
        reject,
        timeoutId,
        createdAt: Date.now(),
        type: 'video'
      });

      if (session.ws.readyState === 1) {
        session.ws.send(command);
      } else {
        clearTimeout(timeoutId);
        this.sessionManager.resolvePendingRequest(session.sessionId, requestId, null);
        reject(utils.formatError('CONNECTION_LOST', 'WebSocket connection is not open'));
      }
    });
  }

  /**
   * Send a document
   * @param {string} apiKey - API key
   * @param {object} data - Document data { phoneNumber, documentUrl OR documentDataUrl, documentName }
   * @returns {Promise<object>} Message result
   */
  async sendDocument(apiKey, data) {
    // Validate input
    const validation = protocol.validateSendDocumentData(data);
    if (!validation.valid) {
      throw utils.formatError('VALIDATION_ERROR', validation.error);
    }

    // Convert URL to dataURL if needed
    let documentDataUrl = data.documentDataUrl;
    if (!documentDataUrl && data.documentUrl) {
      try {
        documentDataUrl = await utils.documentUrlToDataUrl(data.documentUrl);
      } catch (error) {
        throw error;
      }
    }

    // Get session for sending
    const session = this.sessionManager.getSessionForSending(apiKey);
    if (!session) {
      throw utils.formatError(
        'NO_ACTIVE_DEVICE',
        'No active WhatsApp device connected for this API key',
        { apiKey: utils.sanitizeApiKey(apiKey) }
      );
    }

    // Generate request ID
    const requestId = utils.generateRequestId();

    // Create command
    const command = protocol.createSendDocumentCommand(requestId, {
      phoneNumber: data.phoneNumber,
      documentDataUrl,
      documentName: data.documentName
    });

    // Create promise for result
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.sessionManager.resolvePendingRequest(session.sessionId, requestId, null);
        reject(utils.formatError('REQUEST_TIMEOUT', 'Request timed out after 30 seconds'));
      }, this.config.requestTimeout);

      this.sessionManager.addPendingRequest(session.sessionId, requestId, {
        resolve,
        reject,
        timeoutId,
        createdAt: Date.now(),
        type: 'document'
      });

      if (session.ws.readyState === 1) {
        session.ws.send(command);
      } else {
        clearTimeout(timeoutId);
        this.sessionManager.resolvePendingRequest(session.sessionId, requestId, null);
        reject(utils.formatError('CONNECTION_LOST', 'WebSocket connection is not open'));
      }
    });
  }

  /**
   * Get active sessions for an API key
   * @param {string} apiKey - API key
   * @returns {Array} Array of session info objects
   */
  getActiveSessions(apiKey) {
    return this.sessionManager.getSessionInfo(apiKey);
  }

  /**
   * Get health check information
   * @returns {object} Health check data
   */
  getHealth() {
    return {
      status: this.isRunning ? 'ok' : 'stopped',
      activeSessions: this.sessionManager.getTotalSessionCount(),
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      timestamp: Date.now()
    };
  }
}

module.exports = WhatsAppGateway;
