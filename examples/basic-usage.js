/**
 * Basic Usage Example - Standalone Server
 * 
 * This example shows how to use the WhatsApp Gateway as a standalone server
 * with simple in-memory API key validation.
 */

const { WhatsAppGateway } = require('../src/index');

// In-memory API keys (in production, use a database)
const validApiKeys = new Set([
  'test-api-key-123',
  'demo-api-key-456',
  'my-secret-key-789'
]);

// Create gateway instance
const gateway = new WhatsAppGateway({
  port: 3000,
  path: '/wa-ext-ws',
  
  // Validate API key callback
  validateApiKey: async (apiKey) => {
    console.log(`[AUTH] Validating API key: ${apiKey.substring(0, 8)}***`);
    
    if (validApiKeys.has(apiKey)) {
      return { valid: true, userId: `user-${apiKey}` };
    }
    
    return { valid: false };
  },
  
  // Message log callback
  onMessageLog: (logData) => {
    console.log('[MESSAGE LOG]', {
      apiKey: logData.apiKey.substring(0, 8) + '***',
      type: logData.type,
      status: logData.status,
      phoneNumber: logData.phoneNumber,
      requestId: logData.requestId,
      timestamp: new Date(logData.timestamp).toISOString()
    });
  },
  
  // Error callback
  onError: (error) => {
    console.error('[ERROR]', {
      code: error.code,
      message: error.message,
      details: error.details
    });
  },
  
  // Optional settings
  heartbeatInterval: 30000,  // 30 seconds
  requestTimeout: 30000,     // 30 seconds
  maxSessionsPerKey: 10,
  deviceSelectionStrategy: 'round-robin'
});

// Start the gateway
async function start() {
  try {
    await gateway.start();
    console.log('✅ WhatsApp Gateway started successfully!');
    console.log('📡 WebSocket server listening on: ws://localhost:3000/wa-ext-ws');
    console.log('');
    console.log('Valid API keys for testing:');
    validApiKeys.forEach(key => {
      console.log(`  - ${key}`);
    });
    console.log('');
    
    // Example: Send a message after 5 seconds
    setTimeout(async () => {
      console.log('');
      console.log('=== Sending Test Message ===');
      try {
        const result = await gateway.sendMessage('test-api-key-123', {
          phoneNumber: '+1234567890',
          message: 'Hello from WhatsApp Gateway!\nThis is a test message.'
        });
        console.log('✅ Message sent successfully:', result);
      } catch (error) {
        console.error('❌ Failed to send message:', error.message);
      }
    }, 5000);
    
    // Example: Check active sessions periodically
    setInterval(() => {
      const health = gateway.getHealth();
      console.log('');
      console.log('=== Health Check ===');
      console.log(`Status: ${health.status}`);
      console.log(`Active Sessions: ${health.activeSessions}`);
      console.log(`Uptime: ${Math.floor(health.uptime / 1000)}s`);
      
      // Show sessions for each API key
      validApiKeys.forEach(apiKey => {
        const sessions = gateway.getActiveSessions(apiKey);
        if (sessions.length > 0) {
          console.log(`\nSessions for ${apiKey}:`);
          sessions.forEach(session => {
            console.log(`  - Session ${session.sessionId.substring(0, 8)}...`);
            console.log(`    Active: ${session.deviceActive}`);
            console.log(`    Extension: ${session.extensionVersion} (${session.browser})`);
          });
        }
      });
    }, 60000); // Every minute
    
  } catch (error) {
    console.error('❌ Failed to start gateway:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down gateway...');
  await gateway.stop();
  console.log('✅ Gateway stopped');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n🛑 Shutting down gateway...');
  await gateway.stop();
  console.log('✅ Gateway stopped');
  process.exit(0);
});

// Start the server
start();
