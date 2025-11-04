/**
 * Mock WebSocket Client for Testing
 * 
 * This client simulates a WhatsApp Chrome Extension connecting to the gateway.
 * It can be used to test all gateway features.
 */

const WebSocket = require('ws');

class MockWhatsAppClient {
  constructor(config = {}) {
    this.config = {
      url: config.url || 'ws://localhost:3000/wa-ext-ws',
      apiKey: config.apiKey || 'test-api-key-123',
      extensionVersion: config.extensionVersion || '1.0.0',
      browser: config.browser || 'Chrome',
      autoRespond: config.autoRespond !== false, // Auto-respond to commands by default
      responseDelay: config.responseDelay || 500, // Delay before responding (ms)
      simulateWhatsAppLogin: config.simulateWhatsAppLogin !== false // Simulate WhatsApp logged in
    };

    this.ws = null;
    this.sessionId = null;
    this.isAuthenticated = false;
    this.isWhatsAppReady = false;
    this.receivedCommands = [];
    this.heartbeatInterval = null;
  }

  /**
   * Connect to the gateway
   */
  async connect() {
    return new Promise((resolve, reject) => {
      console.log(`\n🔌 Connecting to ${this.config.url}...`);
      
      this.ws = new WebSocket(this.config.url);

      this.ws.on('open', () => {
        console.log('✅ WebSocket connected');
        this.authenticate();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
        this.cleanup();
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        reject(error);
      });

      // Resolve when authenticated
      this.once('authenticated', () => {
        resolve();
      });

      // Timeout if no auth in 5 seconds
      setTimeout(() => {
        if (!this.isAuthenticated) {
          reject(new Error('Authentication timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Send authentication message
   */
  authenticate() {
    console.log('🔑 Sending authentication...');
    
    const authMessage = {
      type: 'auth',
      apiKey: this.config.apiKey,
      data: {
        extensionVersion: this.config.extensionVersion,
        browser: this.config.browser
      }
    };

    this.send(authMessage);
  }

  /**
   * Send status update
   */
  sendStatus(whatsappLoggedIn, ready) {
    console.log(`📊 Sending status: WhatsApp ${whatsappLoggedIn ? 'logged in' : 'not logged in'}, Ready: ${ready}`);
    
    const statusMessage = {
      type: 'status',
      data: {
        whatsappLoggedIn,
        ready
      }
    };

    this.send(statusMessage);
    this.isWhatsAppReady = whatsappLoggedIn && ready;
  }

  /**
   * Send heartbeat
   */
  sendHeartbeat() {
    const heartbeatMessage = {
      type: 'heartbeat',
      timestamp: Date.now()
    };

    this.send(heartbeatMessage);
    // console.log('💓 Heartbeat sent');
  }

  /**
   * Start sending heartbeats
   */
  startHeartbeat(interval = 25000) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendHeartbeat();
      }
    }, interval);

    console.log(`💓 Heartbeat started (every ${interval}ms)`);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('💓 Heartbeat stopped');
    }
  }

  /**
   * Send message result
   */
  sendMessageResult(requestId, success, error = null) {
    console.log(`📤 Sending result for request ${requestId.substring(0, 8)}...: ${success ? 'SUCCESS' : 'FAILED'}`);
    
    const resultMessage = {
      type: 'message-result',
      requestId,
      success,
      error,
      timestamp: Date.now()
    };

    this.send(resultMessage);
  }

  /**
   * Handle incoming message from gateway
   */
  handleMessage(rawMessage) {
    try {
      const message = JSON.parse(rawMessage);
      
      switch (message.type) {
        case 'auth-success':
          this.sessionId = message.sessionId;
          this.isAuthenticated = true;
          console.log(`✅ Authenticated! Session ID: ${this.sessionId.substring(0, 12)}...`);
          this.emit('authenticated');
          
          // Send status if simulating WhatsApp login
          if (this.config.simulateWhatsAppLogin) {
            setTimeout(() => {
              this.sendStatus(true, true);
              this.startHeartbeat();
            }, 1000);
          }
          break;

        case 'send-message':
          console.log(`\n📨 Received send-message command:`);
          console.log(`   Request ID: ${message.requestId.substring(0, 12)}...`);
          console.log(`   Phone: ${message.data.phoneNumber}`);
          console.log(`   Message: ${message.data.message.substring(0, 50)}${message.data.message.length > 50 ? '...' : ''}`);
          
          this.receivedCommands.push({ type: 'message', ...message });
          
          if (this.config.autoRespond) {
            setTimeout(() => {
              this.sendMessageResult(message.requestId, true);
            }, this.config.responseDelay);
          }
          break;

        case 'send-image':
          console.log(`\n🖼️  Received send-image command:`);
          console.log(`   Request ID: ${message.requestId.substring(0, 12)}...`);
          console.log(`   Phone: ${message.data.phoneNumber}`);
          console.log(`   Caption: ${message.data.caption || '(no caption)'}`);
          console.log(`   DataURL length: ${message.data.imageDataUrl.length} chars`);
          
          this.receivedCommands.push({ type: 'image', ...message });
          
          if (this.config.autoRespond) {
            setTimeout(() => {
              this.sendMessageResult(message.requestId, true);
            }, this.config.responseDelay);
          }
          break;

        case 'send-video':
          console.log(`\n🎥 Received send-video command:`);
          console.log(`   Request ID: ${message.requestId.substring(0, 12)}...`);
          console.log(`   Phone: ${message.data.phoneNumber}`);
          console.log(`   Caption: ${message.data.caption || '(no caption)'}`);
          console.log(`   DataURL length: ${message.data.videoDataUrl.length} chars`);
          
          this.receivedCommands.push({ type: 'video', ...message });
          
          if (this.config.autoRespond) {
            setTimeout(() => {
              this.sendMessageResult(message.requestId, true);
            }, this.config.responseDelay);
          }
          break;

        case 'send-document':
          console.log(`\n📄 Received send-document command:`);
          console.log(`   Request ID: ${message.requestId.substring(0, 12)}...`);
          console.log(`   Phone: ${message.data.phoneNumber}`);
          console.log(`   Document: ${message.data.documentName}`);
          console.log(`   DataURL length: ${message.data.documentDataUrl.length} chars`);
          
          this.receivedCommands.push({ type: 'document', ...message });
          
          if (this.config.autoRespond) {
            setTimeout(() => {
              this.sendMessageResult(message.requestId, true);
            }, this.config.responseDelay);
          }
          break;

        case 'ping':
          // Just a ping, no action needed
          break;

        case 'error':
          console.error(`❌ Received error from server:`);
          console.error(`   Code: ${message.error.code}`);
          console.error(`   Message: ${message.error.message}`);
          break;

        default:
          console.log(`⚠️  Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('❌ Error handling message:', error.message);
    }
  }

  /**
   * Send a message to gateway
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('❌ Cannot send - WebSocket not open');
    }
  }

  /**
   * Disconnect from gateway
   */
  disconnect() {
    console.log('\n🔌 Disconnecting...');
    this.cleanup();
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stopHeartbeat();
    this.isAuthenticated = false;
    this.isWhatsAppReady = false;
  }

  /**
   * Simple event emitter
   */
  emit(event) {
    if (this.listeners && this.listeners[event]) {
      this.listeners[event].forEach(cb => cb());
    }
  }

  once(event, callback) {
    if (!this.listeners) this.listeners = {};
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  /**
   * Show statistics
   */
  showStats() {
    console.log('\n📊 Client Statistics:');
    console.log('='.repeat(60));
    console.log(`Session ID: ${this.sessionId ? this.sessionId.substring(0, 12) + '...' : 'Not connected'}`);
    console.log(`Authenticated: ${this.isAuthenticated}`);
    console.log(`WhatsApp Ready: ${this.isWhatsAppReady}`);
    console.log(`Commands Received: ${this.receivedCommands.length}`);
    console.log('');
    
    if (this.receivedCommands.length > 0) {
      console.log('Recent Commands:');
      this.receivedCommands.slice(-5).forEach((cmd, i) => {
        console.log(`  ${i + 1}. ${cmd.type} - Request: ${cmd.requestId.substring(0, 8)}...`);
      });
    }
    console.log('');
  }
}

// If running as standalone script
if (require.main === module) {
  const client = new MockWhatsAppClient({
    apiKey: process.argv[2] || 'test-api-key-123',
    autoRespond: true,
    simulateWhatsAppLogin: true
  });

  console.log('🤖 Starting Mock WhatsApp Client...\n');

  client.connect()
    .then(() => {
      console.log('\n✅ Client connected and authenticated!');
      console.log('💡 Client is now listening for commands...');
      console.log('💡 Press Ctrl+C to disconnect\n');
    })
    .catch((error) => {
      console.error('❌ Failed to connect:', error.message);
      process.exit(1);
    });

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down mock client...\n');
    client.showStats();
    client.disconnect();
    setTimeout(() => process.exit(0), 1000);
  });

  // Expose client globally for testing
  global.client = client;
}

module.exports = MockWhatsAppClient;
