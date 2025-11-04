/**
 * Automated Test Runner
 * 
 * This script runs automated tests for all gateway features
 */

const { WhatsAppGateway } = require('./src/index');
const MockWhatsAppClient = require('./test/mock-client');

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Create gateway for testing
const gateway = new WhatsAppGateway({
  port: 3001, // Different port to avoid conflicts
  path: '/wa-ext-ws',
  
  validateApiKey: async (apiKey) => {
    const validKeys = ['test-key-1', 'test-key-2', 'test-key-3'];
    return validKeys.includes(apiKey) ? { valid: true, userId: `user-${apiKey}` } : { valid: false };
  },
  
  onMessageLog: (logData) => {
    // Silent for automated tests
  },
  
  onError: (error) => {
    // Silent for automated tests
  },
  
  heartbeatInterval: 30000,
  requestTimeout: 5000, // Shorter timeout for tests
  maxSessionsPerKey: 3
});

/**
 * Test helper
 */
async function test(name, fn) {
  process.stdout.write(`${name}... `);
  try {
    await fn();
    console.log('✅ PASS');
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('='.repeat(70));
  console.log('🧪 Running Automated Tests for whatsapp-ws-extension-gateway');
  console.log('='.repeat(70));
  console.log('');

  try {
    // Start gateway
    await gateway.start();
    console.log('✅ Test gateway started on port 3001\n');
    
    console.log('--- Phase 1: Basic Setup & Connection ---\n');

    await test('Gateway starts successfully', async () => {
      const health = gateway.getHealth();
      assert(health.status === 'ok', 'Gateway should be running');
    });

    await test('Connect mock client and authenticate', async () => {
      const client = new MockWhatsAppClient({
        url: 'ws://localhost:3001/wa-ext-ws',
        apiKey: 'test-key-1',
        simulateWhatsAppLogin: false
      });
      
      await client.connect();
      assert(client.isAuthenticated, 'Client should be authenticated');
      client.disconnect();
    });

    await test('Reject invalid API key', async () => {
      const client = new MockWhatsAppClient({
        url: 'ws://localhost:3001/wa-ext-ws',
        apiKey: 'invalid-key',
        simulateWhatsAppLogin: false
      });
      
      try {
        await client.connect();
        throw new Error('Should have rejected invalid API key');
      } catch (error) {
        assert(error.message.includes('timeout') || error.message.includes('Authentication'), 'Should timeout or reject auth');
      }
    });

    console.log('\n--- Phase 2: Session Management ---\n');

    await test('Get active sessions (empty)', async () => {
      const sessions = gateway.getActiveSessions('test-key-1');
      assertEqual(sessions.length, 0, 'Should have no active sessions initially');
    });

    await test('Session becomes active after status update', async () => {
      const client = new MockWhatsAppClient({
        url: 'ws://localhost:3001/wa-ext-ws',
        apiKey: 'test-key-1',
        simulateWhatsAppLogin: true
      });
      
      await client.connect();
      await sleep(1500); // Wait for status update
      
      const sessions = gateway.getActiveSessions('test-key-1');
      assertEqual(sessions.length, 1, 'Should have 1 active session');
      assert(sessions[0].deviceActive, 'Session should be active');
      
      client.disconnect();
      await sleep(500);
    });

    await test('Multiple sessions per API key', async () => {
      const client1 = new MockWhatsAppClient({
        url: 'ws://localhost:3001/wa-ext-ws',
        apiKey: 'test-key-2',
        simulateWhatsAppLogin: true
      });
      
      const client2 = new MockWhatsAppClient({
        url: 'ws://localhost:3001/wa-ext-ws',
        apiKey: 'test-key-2',
        simulateWhatsAppLogin: true
      });
      
      await client1.connect();
      await client2.connect();
      await sleep(1500);
      
      const sessions = gateway.getActiveSessions('test-key-2');
      assertEqual(sessions.length, 2, 'Should have 2 active sessions');
      
      client1.disconnect();
      client2.disconnect();
      await sleep(500);
    });

    await test('Health check returns correct data', async () => {
      const health = gateway.getHealth();
      assert(health.status === 'ok', 'Status should be ok');
      assert(typeof health.activeSessions === 'number', 'Should have activeSessions count');
      assert(typeof health.uptime === 'number', 'Should have uptime');
      assert(typeof health.timestamp === 'number', 'Should have timestamp');
    });

    console.log('\n--- Phase 3: Sending Messages ---\n');

    let testClient;
    
    await test('Setup client for send tests', async () => {
      testClient = new MockWhatsAppClient({
        url: 'ws://localhost:3001/wa-ext-ws',
        apiKey: 'test-key-1',
        simulateWhatsAppLogin: true,
        autoRespond: true,
        responseDelay: 200
      });
      
      await testClient.connect();
      await sleep(1500); // Wait for WhatsApp ready
      assert(testClient.isWhatsAppReady, 'Client should be ready');
    });

    await test('Send text message successfully', async () => {
      const result = await gateway.sendMessage('test-key-1', {
        phoneNumber: '+1234567890',
        message: 'Test message'
      });
      
      assert(result.success, 'Message should be sent successfully');
      assert(result.requestId, 'Should have requestId');
      assert(testClient.receivedCommands.length > 0, 'Client should receive command');
    });

    await test('Send image with dataURL', async () => {
      const result = await gateway.sendImage('test-key-1', {
        phoneNumber: '+1234567890',
        imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        caption: 'Test image'
      });
      
      assert(result.success, 'Image should be sent successfully');
    });

    console.log('\n--- Phase 4: Error Handling ---\n');

    await test('Invalid phone number throws validation error', async () => {
      try {
        await gateway.sendMessage('test-key-1', {
          phoneNumber: '1234567890', // Missing +
          message: 'Test'
        });
        throw new Error('Should have thrown validation error');
      } catch (error) {
        assertEqual(error.code, 'VALIDATION_ERROR', 'Should be validation error');
      }
    });

    await test('Empty message throws validation error', async () => {
      try {
        await gateway.sendMessage('test-key-1', {
          phoneNumber: '+1234567890',
          message: ''
        });
        throw new Error('Should have thrown validation error');
      } catch (error) {
        assertEqual(error.code, 'VALIDATION_ERROR', 'Should be validation error');
      }
    });

    await test('No active device throws error', async () => {
      try {
        await gateway.sendMessage('test-key-3', { // No client connected
          phoneNumber: '+1234567890',
          message: 'Test'
        });
        throw new Error('Should have thrown NO_ACTIVE_DEVICE error');
      } catch (error) {
        assertEqual(error.code, 'NO_ACTIVE_DEVICE', 'Should be no active device error');
      }
    });

    await test('Request timeout', async () => {
      // Create client that doesn't respond
      const slowClient = new MockWhatsAppClient({
        url: 'ws://localhost:3001/wa-ext-ws',
        apiKey: 'test-key-3',
        simulateWhatsAppLogin: true,
        autoRespond: false // Don't respond
      });
      
      await slowClient.connect();
      await sleep(1500);
      
      try {
        const timeoutPromise = gateway.sendMessage('test-key-3', {
          phoneNumber: '+1234567890',
          message: 'This will timeout'
        });
        
        // Wait for the timeout to occur
        await timeoutPromise;
        throw new Error('Should have timed out');
      } catch (error) {
        assert(error.message.includes('REQUEST_TIMEOUT') || error.message.includes('timed out'), 
               `Should be timeout error, got: ${error.message}`);
      } finally {
        slowClient.disconnect();
        await sleep(500);
      }
    });

    console.log('\n--- Phase 5: Cleanup ---\n');

    await test('Cleanup test client', async () => {
      if (testClient) {
        testClient.disconnect();
      }
      await sleep(500);
      assert(true, 'Cleanup successful');
    });

    await test('Gateway stops successfully', async () => {
      await gateway.stop();
      const health = gateway.getHealth();
      assertEqual(health.status, 'stopped', 'Gateway should be stopped');
    });

  } catch (error) {
    console.error('\n❌ Test runner error:', error.message);
    console.error(error.stack);
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 Test Summary');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total: ${results.passed + results.failed}`);
  console.log('');

  if (results.failed > 0) {
    console.log('Failed Tests:');
    results.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  ❌ ${t.name}: ${t.error}`);
    });
    console.log('');
  }

  if (results.failed === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests();
