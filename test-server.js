/**
 * Test Server for whatsapp-ws-extension-gateway
 * 
 * This server demonstrates and tests all features of the gateway:
 * - WebSocket connection handling
 * - All send methods (message, image, video, document)
 * - Session management
 * - Device selection
 * - Error handling
 * - Callbacks
 */

const { WhatsAppGateway, ERROR_CODES } = require('./src/index');

// Test configuration
const TEST_PORT = 3000;
const TEST_API_KEYS = new Map([
  ['test-api-key-123', { userId: 'user-1', name: 'Test User 1' }],
  ['test-api-key-456', { userId: 'user-2', name: 'Test User 2' }],
  ['test-api-key-789', { userId: 'user-3', name: 'Test User 3' }]
]);

// Test data storage
const testData = {
  messageLogs: [],
  errors: [],
  authAttempts: [],
  stats: {
    totalMessages: 0,
    successfulMessages: 0,
    failedMessages: 0,
    totalErrors: 0
  }
};

console.log('='.repeat(60));
console.log('🧪 WhatsApp Gateway - Test Server');
console.log('='.repeat(60));
console.log('');

// Create gateway with all callbacks
const gateway = new WhatsAppGateway({
  port: TEST_PORT,
  path: '/wa-ext-ws',
  
  // Test validateApiKey callback
  validateApiKey: async (apiKey) => {
    console.log(`[VALIDATE] API Key: ${apiKey.substring(0, 12)}***`);
    
    testData.authAttempts.push({
      apiKey: apiKey.substring(0, 12) + '***',
      timestamp: new Date().toISOString()
    });
    
    const user = TEST_API_KEYS.get(apiKey);
    
    if (user) {
      console.log(`[VALIDATE] ✅ Valid - User: ${user.name}`);
      return { 
        valid: true, 
        userId: user.userId,
        name: user.name
      };
    }
    
    console.log(`[VALIDATE] ❌ Invalid API key`);
    return { valid: false };
  },
  
  // Test onMessageLog callback
  onMessageLog: (logData) => {
    testData.messageLogs.push({
      ...logData,
      timestamp: new Date(logData.timestamp).toISOString()
    });
    
    testData.stats.totalMessages++;
    
    if (logData.status === 'success') {
      testData.stats.successfulMessages++;
      console.log(`[MESSAGE LOG] ✅ ${logData.type} to ${logData.phoneNumber} - SUCCESS`);
    } else {
      testData.stats.failedMessages++;
      console.log(`[MESSAGE LOG] ❌ ${logData.type} to ${logData.phoneNumber} - FAILED: ${logData.error}`);
    }
    
    console.log(`  Session: ${logData.sessionId.substring(0, 8)}...`);
    console.log(`  Request ID: ${logData.requestId.substring(0, 8)}...`);
  },
  
  // Test onError callback
  onError: (error) => {
    testData.errors.push({
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString()
    });
    
    testData.stats.totalErrors++;
    
    console.log(`[ERROR] Code: ${error.code}`);
    console.log(`[ERROR] Message: ${error.message}`);
    if (error.details) {
      console.log(`[ERROR] Details:`, error.details);
    }
  },
  
  // Test optional configurations
  heartbeatInterval: 30000,
  requestTimeout: 30000,
  maxSessionsPerKey: 5,
  deviceSelectionStrategy: 'round-robin'
});

// Test API endpoints
const testAPI = {
  /**
   * Test sending a text message
   */
  async testSendMessage(apiKey, phoneNumber, message) {
    console.log('\n📤 Testing sendMessage()...');
    try {
      const result = await gateway.sendMessage(apiKey, {
        phoneNumber,
        message
      });
      console.log('✅ Message sent successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to send message:', error.message);
      console.error('   Error code:', error.code);
      throw error;
    }
  },

  /**
   * Test sending an image with URL
   */
  async testSendImageWithUrl(apiKey, phoneNumber, imageUrl, caption) {
    console.log('\n🖼️  Testing sendImage() with URL...');
    try {
      const result = await gateway.sendImage(apiKey, {
        phoneNumber,
        imageUrl,
        caption
      });
      console.log('✅ Image sent successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to send image:', error.message);
      throw error;
    }
  },

  /**
   * Test sending an image with dataURL
   */
  async testSendImageWithDataUrl(apiKey, phoneNumber, imageDataUrl, caption) {
    console.log('\n🖼️  Testing sendImage() with DataURL...');
    try {
      const result = await gateway.sendImage(apiKey, {
        phoneNumber,
        imageDataUrl,
        caption
      });
      console.log('✅ Image sent successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to send image:', error.message);
      throw error;
    }
  },

  /**
   * Test sending a video
   */
  async testSendVideo(apiKey, phoneNumber, videoUrl, caption) {
    console.log('\n🎥 Testing sendVideo()...');
    try {
      const result = await gateway.sendVideo(apiKey, {
        phoneNumber,
        videoUrl,
        caption
      });
      console.log('✅ Video sent successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to send video:', error.message);
      throw error;
    }
  },

  /**
   * Test sending a document
   */
  async testSendDocument(apiKey, phoneNumber, documentUrl, documentName) {
    console.log('\n📄 Testing sendDocument()...');
    try {
      const result = await gateway.sendDocument(apiKey, {
        phoneNumber,
        documentUrl,
        documentName
      });
      console.log('✅ Document sent successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to send document:', error.message);
      throw error;
    }
  },

  /**
   * Test getting active sessions
   */
  testGetActiveSessions(apiKey) {
    console.log('\n📊 Testing getActiveSessions()...');
    const sessions = gateway.getActiveSessions(apiKey);
    console.log(`✅ Found ${sessions.length} active session(s) for API key`);
    sessions.forEach((session, index) => {
      console.log(`   Session ${index + 1}:`);
      console.log(`     ID: ${session.sessionId.substring(0, 12)}...`);
      console.log(`     Active: ${session.deviceActive}`);
      console.log(`     Connected: ${new Date(session.connectedAt).toISOString()}`);
      console.log(`     Extension: ${session.extensionVersion} (${session.browser})`);
    });
    return sessions;
  },

  /**
   * Test getting health status
   */
  testGetHealth() {
    console.log('\n💚 Testing getHealth()...');
    const health = gateway.getHealth();
    console.log('✅ Health status:');
    console.log(`   Status: ${health.status}`);
    console.log(`   Active Sessions: ${health.activeSessions}`);
    console.log(`   Uptime: ${Math.floor(health.uptime / 1000)}s`);
    console.log(`   Timestamp: ${new Date(health.timestamp).toISOString()}`);
    return health;
  },

  /**
   * Test validation errors
   */
  async testValidationErrors() {
    console.log('\n⚠️  Testing input validation...');
    
    // Test invalid phone number
    try {
      await gateway.sendMessage('test-api-key-123', {
        phoneNumber: '1234567890', // Missing +
        message: 'Test'
      });
      console.log('❌ Should have thrown validation error for invalid phone');
    } catch (error) {
      console.log(`✅ Caught expected error: ${error.code} - ${error.message}`);
    }

    // Test empty message
    try {
      await gateway.sendMessage('test-api-key-123', {
        phoneNumber: '+1234567890',
        message: ''
      });
      console.log('❌ Should have thrown validation error for empty message');
    } catch (error) {
      console.log(`✅ Caught expected error: ${error.code} - ${error.message}`);
    }
  },

  /**
   * Test no active device error
   */
  async testNoActiveDevice() {
    console.log('\n⚠️  Testing NO_ACTIVE_DEVICE error...');
    try {
      await gateway.sendMessage('test-api-key-123', {
        phoneNumber: '+1234567890',
        message: 'This should fail - no device'
      });
      console.log('❌ Should have thrown NO_ACTIVE_DEVICE error');
    } catch (error) {
      if (error.code === 'NO_ACTIVE_DEVICE') {
        console.log(`✅ Caught expected error: ${error.code}`);
        console.log(`   Message: ${error.message}`);
      } else {
        console.log(`❌ Wrong error code: ${error.code}`);
      }
    }
  },

  /**
   * Show statistics
   */
  showStats() {
    console.log('\n📈 Test Statistics:');
    console.log('='.repeat(60));
    console.log(`Total Messages: ${testData.stats.totalMessages}`);
    console.log(`  ✅ Successful: ${testData.stats.successfulMessages}`);
    console.log(`  ❌ Failed: ${testData.stats.failedMessages}`);
    console.log(`Total Errors: ${testData.stats.totalErrors}`);
    console.log(`Auth Attempts: ${testData.authAttempts.length}`);
    console.log('');
    
    if (testData.messageLogs.length > 0) {
      console.log('Recent Message Logs:');
      testData.messageLogs.slice(-5).forEach((log, i) => {
        console.log(`  ${i + 1}. [${log.status}] ${log.type} to ${log.phoneNumber}`);
      });
      console.log('');
    }
    
    if (testData.errors.length > 0) {
      console.log('Recent Errors:');
      testData.errors.slice(-5).forEach((err, i) => {
        console.log(`  ${i + 1}. [${err.code}] ${err.message}`);
      });
      console.log('');
    }
  }
};

// Start the test server
async function startTestServer() {
  try {
    await gateway.start();
    
    console.log('✅ Test server started successfully!');
    console.log('');
    console.log('📡 WebSocket Endpoint: ws://localhost:' + TEST_PORT + '/wa-ext-ws');
    console.log('');
    console.log('🔑 Valid API Keys:');
    TEST_API_KEYS.forEach((user, key) => {
      console.log(`   - ${key} (${user.name})`);
    });
    console.log('');
    console.log('='.repeat(60));
    console.log('');
    console.log('📋 Available Test Commands:');
    console.log('');
    console.log('  testAPI.testSendMessage(apiKey, phoneNumber, message)');
    console.log('  testAPI.testSendImageWithUrl(apiKey, phoneNumber, imageUrl, caption)');
    console.log('  testAPI.testSendImageWithDataUrl(apiKey, phoneNumber, dataUrl, caption)');
    console.log('  testAPI.testSendVideo(apiKey, phoneNumber, videoUrl, caption)');
    console.log('  testAPI.testSendDocument(apiKey, phoneNumber, docUrl, docName)');
    console.log('  testAPI.testGetActiveSessions(apiKey)');
    console.log('  testAPI.testGetHealth()');
    console.log('  testAPI.testValidationErrors()');
    console.log('  testAPI.testNoActiveDevice()');
    console.log('  testAPI.showStats()');
    console.log('');
    console.log('='.repeat(60));
    console.log('');
    
    // Expose testAPI globally for REPL testing
    global.testAPI = testAPI;
    global.gateway = gateway;
    global.testData = testData;
    
    // Auto-run some tests after 5 seconds if no connections
    setTimeout(async () => {
      const health = gateway.getHealth();
      
      if (health.activeSessions === 0) {
        console.log('⏰ No WebSocket connections detected.');
        console.log('💡 Testing validation and error handling...\n');
        
        // Test validation errors
        await testAPI.testValidationErrors();
        
        // Test no active device
        await testAPI.testNoActiveDevice();
        
        // Show stats
        testAPI.showStats();
        
        console.log('');
        console.log('💡 To test full functionality:');
        console.log('   1. Connect a mock WebSocket client to ws://localhost:3000/wa-ext-ws');
        console.log('   2. Or run: node test/mock-client.js (create this file)');
        console.log('   3. Or use the testAPI commands above');
        console.log('');
      }
    }, 5000);
    
    // Periodic health check
    setInterval(() => {
      const health = gateway.getHealth();
      if (health.activeSessions > 0) {
        console.log(`\n[HEALTH] Active Sessions: ${health.activeSessions} | Uptime: ${Math.floor(health.uptime / 1000)}s`);
      }
    }, 60000); // Every minute
    
  } catch (error) {
    console.error('❌ Failed to start test server:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down test server...\n');
  
  // Show final stats
  testAPI.showStats();
  
  console.log('Stopping gateway...');
  await gateway.stop();
  
  console.log('✅ Test server stopped gracefully');
  console.log('');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n🛑 Shutting down test server...\n');
  await gateway.stop();
  console.log('✅ Test server stopped');
  process.exit(0);
});

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled Promise Rejection:', error.message);
  console.error(error.stack);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:', error.message);
  console.error(error.stack);
  process.exit(1);
});

// Start the server
startTestServer();

// Export for programmatic use
module.exports = {
  gateway,
  testAPI,
  testData,
  TEST_API_KEYS
};
