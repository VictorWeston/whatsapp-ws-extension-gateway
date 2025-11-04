/**
 * Basic tests for whatsapp-ws-extension-gateway
 * 
 * These are simple unit tests for core functionality.
 * For production, consider using a testing framework like Jest or Mocha.
 */

const assert = require('assert');
const SessionManager = require('../src/session-manager');
const protocol = require('../src/protocol');
const utils = require('../src/utils');

console.log('Running tests...\n');

// Test counter
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    testsFailed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    testsFailed++;
  }
}

// ===== SessionManager Tests =====
console.log('=== SessionManager Tests ===\n');

test('SessionManager: Create instance', () => {
  const manager = new SessionManager();
  assert(manager instanceof SessionManager);
});

test('SessionManager: Add session', () => {
  const manager = new SessionManager();
  const ws = { readyState: 1 };
  const session = manager.addSession('api-key-1', ws, { ip: '127.0.0.1' });
  
  assert(session.sessionId);
  assert.strictEqual(session.apiKey, 'api-key-1');
  assert.strictEqual(session.ip, '127.0.0.1');
  assert.strictEqual(session.deviceActive, false);
});

test('SessionManager: Get sessions by API key', () => {
  const manager = new SessionManager();
  const ws1 = { readyState: 1 };
  const ws2 = { readyState: 1 };
  
  manager.addSession('api-key-1', ws1);
  manager.addSession('api-key-1', ws2);
  
  const sessions = manager.getSessions('api-key-1');
  assert.strictEqual(sessions.length, 2);
});

test('SessionManager: Update session status', () => {
  const manager = new SessionManager();
  const ws = { readyState: 1 };
  const session = manager.addSession('api-key-1', ws);
  
  manager.updateSessionStatus(session.sessionId, {
    whatsappLoggedIn: true,
    ready: true
  });
  
  const updatedSession = manager.getSession(session.sessionId);
  assert.strictEqual(updatedSession.deviceActive, true);
});

test('SessionManager: Remove session', () => {
  const manager = new SessionManager();
  const ws = { readyState: 1 };
  const session = manager.addSession('api-key-1', ws);
  
  const removed = manager.removeSession(session.sessionId);
  assert.strictEqual(removed, true);
  
  const retrievedSession = manager.getSession(session.sessionId);
  assert.strictEqual(retrievedSession, null);
});

test('SessionManager: Get active sessions only', () => {
  const manager = new SessionManager();
  const ws1 = { readyState: 1 };
  const ws2 = { readyState: 1 };
  
  const session1 = manager.addSession('api-key-1', ws1);
  const session2 = manager.addSession('api-key-1', ws2);
  
  // Set one as active
  manager.updateSessionStatus(session1.sessionId, {
    whatsappLoggedIn: true,
    ready: true
  });
  
  const activeSessions = manager.getActiveSessions('api-key-1');
  assert.strictEqual(activeSessions.length, 1);
  assert.strictEqual(activeSessions[0].sessionId, session1.sessionId);
});

test('SessionManager: Round-robin device selection', () => {
  const manager = new SessionManager({ deviceSelectionStrategy: 'round-robin' });
  const ws1 = { readyState: 1 };
  const ws2 = { readyState: 1 };
  const ws3 = { readyState: 1 };
  
  const session1 = manager.addSession('api-key-1', ws1);
  const session2 = manager.addSession('api-key-1', ws2);
  const session3 = manager.addSession('api-key-1', ws3);
  
  // Set all as active
  manager.updateSessionStatus(session1.sessionId, { whatsappLoggedIn: true, ready: true });
  manager.updateSessionStatus(session2.sessionId, { whatsappLoggedIn: true, ready: true });
  manager.updateSessionStatus(session3.sessionId, { whatsappLoggedIn: true, ready: true });
  
  // Select devices in round-robin
  const selected1 = manager.getSessionForSending('api-key-1');
  const selected2 = manager.getSessionForSending('api-key-1');
  const selected3 = manager.getSessionForSending('api-key-1');
  const selected4 = manager.getSessionForSending('api-key-1'); // Should wrap around
  
  assert.strictEqual(selected1.sessionId, session1.sessionId);
  assert.strictEqual(selected2.sessionId, session2.sessionId);
  assert.strictEqual(selected3.sessionId, session3.sessionId);
  assert.strictEqual(selected4.sessionId, session1.sessionId);
});

test('SessionManager: Max sessions per key', () => {
  const manager = new SessionManager({ maxSessionsPerKey: 2 });
  const ws1 = { readyState: 1 };
  const ws2 = { readyState: 1 };
  const ws3 = { readyState: 1 };
  
  manager.addSession('api-key-1', ws1);
  manager.addSession('api-key-1', ws2);
  
  // Third session should throw error
  assert.throws(() => {
    manager.addSession('api-key-1', ws3);
  }, /MAX_SESSIONS_EXCEEDED/);
});

// ===== Protocol Tests =====
console.log('\n=== Protocol Tests ===\n');

test('Protocol: Parse valid JSON message', () => {
  const message = protocol.parseMessage('{"type":"auth","apiKey":"test"}');
  assert(message);
  assert.strictEqual(message.type, 'auth');
});

test('Protocol: Parse invalid JSON returns null', () => {
  const message = protocol.parseMessage('invalid json');
  assert.strictEqual(message, null);
});

test('Protocol: Validate auth message', () => {
  const result = protocol.validateAuthMessage({
    type: 'auth',
    apiKey: 'test-key',
    data: {
      extensionVersion: '1.0.0',
      browser: 'Chrome'
    }
  });
  
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.data.apiKey, 'test-key');
});

test('Protocol: Reject invalid auth message', () => {
  const result = protocol.validateAuthMessage({
    type: 'auth',
    // Missing apiKey
    data: {}
  });
  
  assert.strictEqual(result.valid, false);
});

test('Protocol: Validate phone number', () => {
  assert.strictEqual(protocol.isValidPhoneNumber('+1234567890'), true);
  assert.strictEqual(protocol.isValidPhoneNumber('+12345'), true);
  assert.strictEqual(protocol.isValidPhoneNumber('1234567890'), false); // Missing +
  assert.strictEqual(protocol.isValidPhoneNumber('+0123456789'), false); // Starts with 0
  assert.strictEqual(protocol.isValidPhoneNumber('invalid'), false);
});

test('Protocol: Validate send message data', () => {
  const result = protocol.validateSendMessageData({
    phoneNumber: '+1234567890',
    message: 'Hello World'
  });
  
  assert.strictEqual(result.valid, true);
});

test('Protocol: Reject empty message', () => {
  const result = protocol.validateSendMessageData({
    phoneNumber: '+1234567890',
    message: ''
  });
  
  assert.strictEqual(result.valid, false);
});

test('Protocol: Create send message command', () => {
  const command = protocol.createSendMessageCommand('req-123', {
    phoneNumber: '+1234567890',
    message: 'Hello'
  });
  
  const parsed = JSON.parse(command);
  assert.strictEqual(parsed.type, 'send-message');
  assert.strictEqual(parsed.requestId, 'req-123');
  assert.strictEqual(parsed.data.phoneNumber, '+1234567890');
  assert.strictEqual(parsed.data.message, 'Hello');
});

test('Protocol: Create send image command', () => {
  const command = protocol.createSendImageCommand('req-123', {
    phoneNumber: '+1234567890',
    imageDataUrl: 'data:image/png;base64,abc123',
    caption: 'Test'
  });
  
  const parsed = JSON.parse(command);
  assert.strictEqual(parsed.type, 'send-image');
  assert.strictEqual(parsed.data.caption, 'Test');
});

// ===== Utils Tests =====
console.log('\n=== Utils Tests ===\n');

test('Utils: Generate request ID', () => {
  const id1 = utils.generateRequestId();
  const id2 = utils.generateRequestId();
  
  assert(id1);
  assert(id2);
  assert.notStrictEqual(id1, id2); // Should be unique
});

test('Utils: Format error', () => {
  const error = utils.formatError('TEST_ERROR', 'Test error message', { detail: 'info' });
  
  assert(error instanceof Error);
  assert.strictEqual(error.code, 'TEST_ERROR');
  assert.strictEqual(error.message, 'Test error message');
  assert.deepStrictEqual(error.details, { detail: 'info' });
});

test('Utils: Create error response', () => {
  const response = utils.createErrorResponse('NO_DEVICE', 'No device available');
  
  assert.strictEqual(response.success, false);
  assert.strictEqual(response.error.code, 'NO_DEVICE');
  assert.strictEqual(response.error.message, 'No device available');
});

test('Utils: Sanitize API key', () => {
  const sanitized = utils.sanitizeApiKey('sk_live_1234567890abcdef');
  assert.strictEqual(sanitized, 'sk_live_***');
});

test('Utils: Validate data URL', () => {
  assert.strictEqual(
    utils.isValidDataUrl('data:image/png;base64,abc123', 'image/'),
    true
  );
  assert.strictEqual(
    utils.isValidDataUrl('data:video/mp4;base64,abc123', 'video/'),
    true
  );
  assert.strictEqual(
    utils.isValidDataUrl('https://example.com/image.png', 'image/'),
    false
  );
});

test('Utils: Get MIME type from data URL', () => {
  const mimeType = utils.getMimeTypeFromDataUrl('data:image/png;base64,abc123');
  assert.strictEqual(mimeType, 'image/png');
});

asyncTest('Utils: Promise with timeout - resolves', async () => {
  const promise = new Promise(resolve => setTimeout(() => resolve('done'), 100));
  const result = await utils.promiseWithTimeout(promise, 500, 'Timed out');
  assert.strictEqual(result, 'done');
});

asyncTest('Utils: Promise with timeout - times out', async () => {
  const promise = new Promise(resolve => setTimeout(() => resolve('done'), 500));
  
  try {
    await utils.promiseWithTimeout(promise, 100, 'Timed out');
    throw new Error('Should have timed out');
  } catch (error) {
    assert(error.message.includes('Timed out'));
  }
});

// ===== Run Async Tests =====
(async () => {
  // Wait for async tests to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Print summary
  console.log('\n=== Test Summary ===\n');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📊 Total: ${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed');
    process.exit(1);
  }
})();
