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

// ============================================
// CLI (Command Line Interface)
// ============================================

const readline = require('readline');

function startCLI() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\n🎮 Command> '
  });

  console.log('\n' + '='.repeat(60));
  console.log('📟 CLI Commands Available:');
  console.log('='.repeat(60));
  console.log('');
  console.log('  📨 send <apiKey> <phone> <message>  - Send a text message');
  console.log('  🖼️  image <apiKey> <phone> <caption>  - Send test image');
  console.log('  📱 devices [apiKey]                  - List active devices');
  console.log('  📊 stats                             - Show statistics');
  console.log('  🏥 health                            - Server health check');
  console.log('  📜 logs                              - Show recent message logs');
  console.log('  🧪 test                              - Run test commands');
  console.log('  🔄 clear                             - Clear screen');
  console.log('  ❌ exit                              - Stop server and exit');
  console.log('');
  console.log('Examples:');
  console.log('  send test-api-key-123 +1234567890 Hello World!');
  console.log('  devices test-api-key-123');
  console.log('  devices (shows all devices)');
  console.log('');
  console.log('Type a command or press Ctrl+C to exit');
  console.log('='.repeat(60));

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    
    if (!input) {
      rl.prompt();
      return;
    }

    const parts = input.split(' ');
    const command = parts[0].toLowerCase();

    try {
      switch (command) {
        case 'send':
          await handleSendCommand(parts);
          break;

        case 'image':
          await handleImageCommand(parts);
          break;

        case 'devices':
          await handleDevicesCommand(parts);
          break;

        case 'stats':
          testAPI.showStats();
          break;

        case 'health':
          await handleHealthCommand();
          break;

        case 'logs':
          handleLogsCommand(parts);
          break;

        case 'test':
          await handleTestCommand();
          break;

        case 'clear':
          console.clear();
          console.log('🎮 CLI Ready - Type "help" for commands\n');
          break;

        case 'help':
          showHelp();
          break;

        case 'exit':
        case 'quit':
          console.log('\n👋 Shutting down...\n');
          await gateway.stop();
          process.exit(0);
          break;

        default:
          console.log(`❌ Unknown command: ${command}`);
          console.log('💡 Type "help" for available commands');
      }
    } catch (error) {
      console.error('❌ Error executing command:', error.message);
    }

    rl.prompt();
  });

  rl.on('close', async () => {
    console.log('\n\n👋 Goodbye!\n');
    await gateway.stop();
    process.exit(0);
  });
}

// Handle send message command
async function handleSendCommand(parts) {
  if (parts.length < 4) {
    console.log('❌ Usage: send <apiKey> <phone> <message>');
    console.log('📝 Example: send test-api-key-123 +1234567890 Hello World!');
    return;
  }

  const apiKey = parts[1];
  const phoneNumber = parts[2];
  const message = parts.slice(3).join(' ');

  console.log('\n📨 Sending message...');
  console.log(`   API Key: ${apiKey.substring(0, 12)}***`);
  console.log(`   Phone: ${phoneNumber}`);
  console.log(`   Message: ${message}`);
  console.log('');

  try {
    const result = await gateway.sendMessage(apiKey, {
      phoneNumber,
      message
    });

    console.log('✅ Message sent successfully!');
    console.log(`   Request ID: ${result.requestId}`);
    console.log(`   Message ID: ${result.messageId || 'N/A'}`);
    console.log(`   Device: ${result.deviceInfo?.sessionId?.substring(0, 8)}...`);
  } catch (error) {
    console.error('❌ Failed to send message:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
  }
}

// Handle send image command
async function handleImageCommand(parts) {
  if (parts.length < 3) {
    console.log('❌ Usage: image <apiKey> <phone> [caption]');
    console.log('📝 Example: image test-api-key-123 +1234567890 Check this out!');
    return;
  }

  const apiKey = parts[1];
  const phoneNumber = parts[2];
  const caption = parts.slice(3).join(' ') || 'Test image';

  // Test image (1x1 red pixel PNG)
  const testImageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

  console.log('\n🖼️  Sending image...');
  console.log(`   API Key: ${apiKey.substring(0, 12)}***`);
  console.log(`   Phone: ${phoneNumber}`);
  console.log(`   Caption: ${caption}`);
  console.log('');

  try {
    const result = await gateway.sendImage(apiKey, {
      phoneNumber,
      dataUrl: testImageDataUrl,
      caption
    });

    console.log('✅ Image sent successfully!');
    console.log(`   Request ID: ${result.requestId}`);
    console.log(`   Message ID: ${result.messageId || 'N/A'}`);
  } catch (error) {
    console.error('❌ Failed to send image:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
  }
}

// Handle devices command
async function handleDevicesCommand(parts) {
  const apiKey = parts[1]; // Optional

  console.log('\n📱 Active Devices:');
  console.log('='.repeat(60));

  if (apiKey) {
    // Show devices for specific API key
    try {
      const sessions = await gateway.getActiveSessions(apiKey);
      
      if (sessions.length === 0) {
        console.log(`\n❌ No active devices for API key: ${apiKey.substring(0, 12)}***\n`);
        return;
      }

      console.log(`\nAPI Key: ${apiKey.substring(0, 12)}***`);
      console.log(`Active Devices: ${sessions.length}\n`);

      sessions.forEach((session, index) => {
        console.log(`Device ${index + 1}:`);
        console.log(`  Session ID: ${session.sessionId}`);
        console.log(`  Status: ${session.status || 'Unknown'}`);
        console.log(`  Ready: ${session.ready ? '✅ Yes' : '❌ No'}`);
        console.log(`  Connected: ${new Date(session.connectedAt).toLocaleString()}`);
        console.log(`  Last Heartbeat: ${new Date(session.lastHeartbeat).toLocaleString()}`);
        
        const lastSeen = Date.now() - session.lastHeartbeat;
        const lastSeenSeconds = Math.floor(lastSeen / 1000);
        console.log(`  Last Seen: ${lastSeenSeconds}s ago`);
        console.log('');
      });
    } catch (error) {
      console.error(`❌ Error: ${error.message}\n`);
    }
  } else {
    // Show all devices across all API keys
    console.log('\nAll Connected Devices:\n');

    const apiKeys = Array.from(TEST_API_KEYS.keys());
    let totalDevices = 0;

    for (const key of apiKeys) {
      const sessions = await gateway.getActiveSessions(key);
      
      if (sessions.length > 0) {
        totalDevices += sessions.length;
        console.log(`API Key: ${key.substring(0, 12)}*** (${TEST_API_KEYS.get(key).name})`);
        console.log(`  Devices: ${sessions.length}`);
        
        sessions.forEach((session, index) => {
          const lastSeen = Math.floor((Date.now() - session.lastHeartbeat) / 1000);
          console.log(`    ${index + 1}. ${session.sessionId.substring(0, 8)}... [${session.ready ? 'Ready' : 'Not Ready'}] (${lastSeen}s ago)`);
        });
        console.log('');
      }
    }

    if (totalDevices === 0) {
      console.log('❌ No devices connected\n');
    } else {
      console.log(`Total Active Devices: ${totalDevices}\n`);
    }
  }
}

// Handle health command
async function handleHealthCommand() {
  const health = await gateway.getHealth();

  console.log('\n🏥 Server Health:');
  console.log('='.repeat(60));
  console.log(`Status: ${health.status === 'running' ? '✅ Running' : '❌ Stopped'}`);
  console.log(`Active Sessions: ${health.activeSessions}`);
  console.log(`Uptime: ${Math.floor(health.uptime / 1000)}s (${formatUptime(health.uptime)})`);
  console.log(`Checked At: ${new Date(health.timestamp).toLocaleString()}`);
  console.log('');
}

// Handle logs command
function handleLogsCommand(parts) {
  const limit = parseInt(parts[1]) || 10;

  console.log(`\n📜 Recent Message Logs (last ${limit}):`);
  console.log('='.repeat(60));

  const recentLogs = testData.messageLogs.slice(-limit);

  if (recentLogs.length === 0) {
    console.log('\n❌ No logs yet\n');
    return;
  }

  recentLogs.forEach((log, index) => {
    const time = new Date(log.timestamp).toLocaleTimeString();
    const status = log.status === 'success' ? '✅' : '❌';
    console.log(`${status} [${time}] ${log.type} - ${log.phoneNumber || 'N/A'} (${log.status})`);
  });

  console.log('');
}

// Handle test command
async function handleTestCommand() {
  console.log('\n🧪 Running Test Commands...\n');

  console.log('1️⃣  Testing sendMessage...');
  await testAPI.testSendMessage();

  console.log('\n2️⃣  Testing sendImage...');
  await testAPI.testSendImageWithDataUrl();

  console.log('\n3️⃣  Testing getActiveSessions...');
  await testAPI.testGetActiveSessions();

  console.log('\n4️⃣  Testing getHealth...');
  await testAPI.testGetHealth();

  console.log('\n✅ All tests completed!\n');
}

// Show help
function showHelp() {
  console.log('\n' + '='.repeat(60));
  console.log('📟 Available Commands:');
  console.log('='.repeat(60));
  console.log('');
  console.log('📨 Message Commands:');
  console.log('  send <apiKey> <phone> <message>   - Send text message');
  console.log('  image <apiKey> <phone> [caption]  - Send test image');
  console.log('');
  console.log('📱 Device Commands:');
  console.log('  devices                           - List all devices');
  console.log('  devices <apiKey>                  - List devices for specific API key');
  console.log('');
  console.log('📊 Information Commands:');
  console.log('  stats                             - Show message statistics');
  console.log('  health                            - Server health check');
  console.log('  logs [limit]                      - Show recent logs (default: 10)');
  console.log('');
  console.log('🧪 Testing Commands:');
  console.log('  test                              - Run all test commands');
  console.log('');
  console.log('🔧 Utility Commands:');
  console.log('  clear                             - Clear screen');
  console.log('  help                              - Show this help');
  console.log('  exit                              - Stop server and exit');
  console.log('');
  console.log('Examples:');
  console.log('  send test-api-key-123 +1234567890 Hello World!');
  console.log('  image test-api-key-123 +1234567890 Check this out!');
  console.log('  devices test-api-key-123');
  console.log('  logs 20');
  console.log('');
}

// Format uptime
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Start the server
startTestServer();

// Start CLI after server starts
setTimeout(() => {
  startCLI();
}, 1000);

// Export for programmatic use
module.exports = {
  gateway,
  testAPI,
  testData,
  TEST_API_KEYS
};
