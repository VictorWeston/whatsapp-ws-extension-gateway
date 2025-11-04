const { v4: uuidv4 } = require('uuid');

/**
 * SessionManager handles in-memory storage and management of WebSocket sessions
 */
class SessionManager {
  constructor(config = {}) {
    this.config = {
      heartbeatInterval: config.heartbeatInterval || 30000,
      maxSessionsPerKey: config.maxSessionsPerKey || 10,
      heartbeatTimeout: config.heartbeatTimeout || 60000, // 2x heartbeat interval
      deviceSelectionStrategy: config.deviceSelectionStrategy || 'round-robin',
      ...config
    };

    // Store sessions by API key: { 'api-key': [session1, session2, ...] }
    this.sessions = new Map();

    // Round-robin counter for device selection
    this.roundRobinCounters = new Map();

    // Heartbeat monitor interval
    this.heartbeatMonitor = null;
  }

  /**
   * Add a new session
   * @param {string} apiKey - API key for the session
   * @param {object} ws - WebSocket connection
   * @param {object} metadata - Additional session metadata
   * @returns {object} Created session object
   */
  addSession(apiKey, ws, metadata = {}) {
    const sessionId = uuidv4();
    
    // Check max sessions per key
    const existingSessions = this.sessions.get(apiKey) || [];
    if (existingSessions.length >= this.config.maxSessionsPerKey) {
      throw new Error(`MAX_SESSIONS_EXCEEDED: Maximum ${this.config.maxSessionsPerKey} sessions allowed per API key`);
    }

    const session = {
      sessionId,
      apiKey,
      ws,
      ip: metadata.ip || 'unknown',
      deviceActive: false, // Will be set when status message arrives
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
      extensionVersion: metadata.extensionVersion,
      browser: metadata.browser,
      pendingRequests: new Map()
    };

    // Add to sessions map
    if (!this.sessions.has(apiKey)) {
      this.sessions.set(apiKey, []);
    }
    this.sessions.get(apiKey).push(session);

    return session;
  }

  /**
   * Remove a session
   * @param {string} sessionId - Session ID to remove
   * @returns {boolean} True if session was found and removed
   */
  removeSession(sessionId) {
    for (const [apiKey, sessions] of this.sessions.entries()) {
      const index = sessions.findIndex(s => s.sessionId === sessionId);
      if (index !== -1) {
        const session = sessions[index];
        
        // Reject all pending requests
        for (const [requestId, pendingRequest] of session.pendingRequests.entries()) {
          clearTimeout(pendingRequest.timeoutId);
          pendingRequest.reject(new Error('CONNECTION_LOST: WebSocket connection lost'));
        }
        session.pendingRequests.clear();

        // Remove session from array
        sessions.splice(index, 1);

        // Clean up if no more sessions for this API key
        if (sessions.length === 0) {
          this.sessions.delete(apiKey);
          this.roundRobinCounters.delete(apiKey);
        }

        return true;
      }
    }
    return false;
  }

  /**
   * Get session by session ID
   * @param {string} sessionId - Session ID
   * @returns {object|null} Session object or null
   */
  getSession(sessionId) {
    for (const sessions of this.sessions.values()) {
      const session = sessions.find(s => s.sessionId === sessionId);
      if (session) return session;
    }
    return null;
  }

  /**
   * Get all sessions for an API key
   * @param {string} apiKey - API key
   * @returns {Array} Array of sessions
   */
  getSessions(apiKey) {
    return this.sessions.get(apiKey) || [];
  }

  /**
   * Get active sessions (WhatsApp logged in) for an API key
   * @param {string} apiKey - API key
   * @returns {Array} Array of active sessions
   */
  getActiveSessions(apiKey) {
    const sessions = this.getSessions(apiKey);
    return sessions.filter(s => s.deviceActive);
  }

  /**
   * Get a session to use for sending (device selection strategy)
   * @param {string} apiKey - API key
   * @returns {object|null} Selected session or null
   */
  getSessionForSending(apiKey) {
    const activeSessions = this.getActiveSessions(apiKey);
    
    if (activeSessions.length === 0) {
      return null;
    }

    if (activeSessions.length === 1) {
      return activeSessions[0];
    }

    // Apply selection strategy
    if (this.config.deviceSelectionStrategy === 'random') {
      const randomIndex = Math.floor(Math.random() * activeSessions.length);
      return activeSessions[randomIndex];
    } else {
      // Round-robin (default)
      const counter = this.roundRobinCounters.get(apiKey) || 0;
      const session = activeSessions[counter % activeSessions.length];
      this.roundRobinCounters.set(apiKey, counter + 1);
      return session;
    }
  }

  /**
   * Update session status
   * @param {string} sessionId - Session ID
   * @param {object} status - Status data { whatsappLoggedIn, ready }
   */
  updateSessionStatus(sessionId, status) {
    const session = this.getSession(sessionId);
    if (session) {
      session.deviceActive = status.whatsappLoggedIn && status.ready;
    }
  }

  /**
   * Update session heartbeat
   * @param {string} sessionId - Session ID
   */
  updateHeartbeat(sessionId) {
    const session = this.getSession(sessionId);
    if (session) {
      session.lastHeartbeat = Date.now();
    }
  }

  /**
   * Add a pending request to a session
   * @param {string} sessionId - Session ID
   * @param {string} requestId - Request ID
   * @param {object} pendingRequest - Pending request data { resolve, reject, timeoutId, createdAt, type }
   */
  addPendingRequest(sessionId, requestId, pendingRequest) {
    const session = this.getSession(sessionId);
    if (session) {
      session.pendingRequests.set(requestId, pendingRequest);
    }
  }

  /**
   * Resolve a pending request
   * @param {string} sessionId - Session ID
   * @param {string} requestId - Request ID
   * @param {object} result - Result data
   * @returns {boolean} True if request was found and resolved
   */
  resolvePendingRequest(sessionId, requestId, result) {
    const session = this.getSession(sessionId);
    if (session && session.pendingRequests.has(requestId)) {
      const pendingRequest = session.pendingRequests.get(requestId);
      clearTimeout(pendingRequest.timeoutId);
      pendingRequest.resolve(result);
      session.pendingRequests.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * Get total number of sessions across all API keys
   * @returns {number} Total session count
   */
  getTotalSessionCount() {
    let count = 0;
    for (const sessions of this.sessions.values()) {
      count += sessions.length;
    }
    return count;
  }

  /**
   * Get all API keys with active sessions
   * @returns {Array} Array of API keys
   */
  getAllApiKeys() {
    return Array.from(this.sessions.keys());
  }

  /**
   * Start heartbeat monitoring
   * @param {function} onStaleSession - Callback for stale sessions
   */
  startHeartbeatMonitor(onStaleSession) {
    if (this.heartbeatMonitor) {
      return; // Already running
    }

    this.heartbeatMonitor = setInterval(() => {
      const now = Date.now();
      const staleSessionIds = [];

      // Check all sessions for stale heartbeats
      for (const sessions of this.sessions.values()) {
        for (const session of sessions) {
          const timeSinceHeartbeat = now - session.lastHeartbeat;
          if (timeSinceHeartbeat > this.config.heartbeatTimeout) {
            staleSessionIds.push(session.sessionId);
          }
        }
      }

      // Remove stale sessions
      for (const sessionId of staleSessionIds) {
        const session = this.getSession(sessionId);
        if (session && onStaleSession) {
          onStaleSession(session);
        }
        this.removeSession(sessionId);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeatMonitor() {
    if (this.heartbeatMonitor) {
      clearInterval(this.heartbeatMonitor);
      this.heartbeatMonitor = null;
    }
  }

  /**
   * Clean up all sessions
   */
  cleanup() {
    this.stopHeartbeatMonitor();
    
    // Reject all pending requests
    for (const sessions of this.sessions.values()) {
      for (const session of sessions) {
        for (const pendingRequest of session.pendingRequests.values()) {
          clearTimeout(pendingRequest.timeoutId);
          pendingRequest.reject(new Error('GATEWAY_SHUTDOWN: Gateway is shutting down'));
        }
        session.pendingRequests.clear();
      }
    }

    this.sessions.clear();
    this.roundRobinCounters.clear();
  }

  /**
   * Get session info for API response (without sensitive data)
   * @param {string} apiKey - API key
   * @returns {Array} Array of session info objects
   */
  getSessionInfo(apiKey) {
    const sessions = this.getSessions(apiKey);
    return sessions.map(session => ({
      sessionId: session.sessionId,
      deviceActive: session.deviceActive,
      connectedAt: session.connectedAt,
      lastHeartbeat: session.lastHeartbeat,
      extensionVersion: session.extensionVersion,
      browser: session.browser
    }));
  }
}

module.exports = SessionManager;
