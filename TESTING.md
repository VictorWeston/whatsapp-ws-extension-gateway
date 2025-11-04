# Testing Guide for whatsapp-ws-extension-gateway

This guide explains how to test all features of the package before publishing.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Unit Tests
```bash
npm test
# or
node test/gateway.test.js
```

### 3. Run Automated Integration Tests
```bash
npm run test:auto
# or
node run-tests.js
```

## Test Files Overview

### `test/gateway.test.js`
- Basic unit tests for SessionManager, Protocol, and Utils
- Runs synchronously without WebSocket connections
- **30+ test cases**

### `run-tests.js`
- Automated integration tests
- Tests WebSocket connections, authentication, and all send methods
- Uses mock clients to simulate real scenarios
- **~20 automated tests**

### `test-server.js`
- Interactive test server for manual testing
- Exposes all gateway functions via CLI
- Tracks statistics and logs
- Useful for debugging and exploring features

### `test/mock-client.js`
- Mock WhatsApp Chrome Extension client
- Can be run standalone or imported
- Simulates extension connecting to gateway

## Testing Scenarios

### Scenario 1: Basic Unit Tests

Tests core functionality without network connections.

```bash
npm test
```

**Expected Output:**
```
✅ SessionManager: Create instance
✅ SessionManager: Add session
✅ Protocol: Parse valid JSON message
...
✅ All tests passed!
```

### Scenario 2: Automated Integration Tests

Tests full WebSocket flow with mock clients.

```bash
npm run test:auto
```

**Expected Output:**
```
✅ Gateway starts successfully
✅ Connect mock client and authenticate
✅ Send text message successfully
...
🎉 All tests passed!
```

### Scenario 3: Interactive Testing

Start the test server for manual testing.

**Terminal 1 - Start Test Server:**
```bash
npm run test:server
```

**Terminal 2 - Start Mock Client:**
```bash
npm run test:client
# or with custom API key
npm run test:client test-api-key-456
```

**Terminal 1 - Run Test Commands:**

In the test server terminal (Node.js REPL):

```javascript
// Test sending a message
await testAPI.testSendMessage('test-api-key-123', '+1234567890', 'Hello World');

// Test sending an image
await testAPI.testSendImageWithDataUrl('test-api-key-123', '+1234567890', 
  'data:image/png;base64,iVBORw0KGgo...', 'Test image');

// Check active sessions
testAPI.testGetActiveSessions('test-api-key-123');

// Check health
testAPI.testGetHealth();

// Test validation errors
await testAPI.testValidationErrors();

// Show statistics
testAPI.showStats();
```

## Manual Test Checklist

### ✅ Installation & Setup
- [ ] Run `npm install` successfully
- [ ] No dependency errors
- [ ] All files present in correct structure

### ✅ Unit Tests
- [ ] Run `npm test`
- [ ] All SessionManager tests pass
- [ ] All Protocol tests pass
- [ ] All Utils tests pass
- [ ] No failures

### ✅ Server Startup
- [ ] Test server starts on port 3000
- [ ] WebSocket server listens on `/wa-ext-ws`
- [ ] No startup errors
- [ ] Health check shows status 'ok'

### ✅ WebSocket Connection
- [ ] Mock client connects successfully
- [ ] Authentication works with valid API key
- [ ] Authentication fails with invalid API key
- [ ] Session ID returned on success

### ✅ Session Management
- [ ] Status update makes session active
- [ ] `getActiveSessions()` returns correct data
- [ ] Multiple sessions per API key supported
- [ ] Sessions cleaned up on disconnect

### ✅ Heartbeat
- [ ] Heartbeat messages keep session alive
- [ ] Missing heartbeat causes timeout (60s)
- [ ] Session removed after timeout

### ✅ Send Methods
- [ ] `sendMessage()` works with valid data
- [ ] `sendImage()` works with imageDataUrl
- [ ] `sendImage()` works with imageUrl (conversion)
- [ ] `sendVideo()` works with videoDataUrl
- [ ] `sendVideo()` works with videoUrl (conversion)
- [ ] `sendDocument()` works with documentDataUrl
- [ ] `sendDocument()` works with documentUrl (conversion)

### ✅ Validation
- [ ] Invalid phone number throws `VALIDATION_ERROR`
- [ ] Empty message throws `VALIDATION_ERROR`
- [ ] Missing required fields throws error
- [ ] Proper error codes returned

### ✅ Error Handling
- [ ] `NO_ACTIVE_DEVICE` when no session connected
- [ ] `REQUEST_TIMEOUT` when client doesn't respond
- [ ] `CONNECTION_LOST` when WebSocket disconnects
- [ ] `MAX_SESSIONS_EXCEEDED` when limit reached

### ✅ Device Selection
- [ ] Round-robin strategy distributes requests
- [ ] Random strategy works
- [ ] Single device always selected when available

### ✅ Callbacks
- [ ] `validateApiKey()` called on authentication
- [ ] `onMessageLog()` called on message events
- [ ] `onError()` called on errors
- [ ] Correct data passed to callbacks

### ✅ API Methods
- [ ] `getActiveSessions()` returns session info
- [ ] `getHealth()` returns health data
- [ ] `start()` starts server
- [ ] `stop()` stops server gracefully

### ✅ Express Integration
- [ ] Express example starts successfully
- [ ] REST endpoints work
- [ ] WebSocket shares same server
- [ ] Both HTTP and WS work simultaneously

### ✅ TypeScript
- [ ] Types imported successfully
- [ ] Type checking works for config
- [ ] Type checking works for send methods
- [ ] No TypeScript errors

## Testing with Real Chrome Extension

To test with an actual Chrome extension:

1. **Start the test server:**
   ```bash
   npm run test:server
   ```

2. **In your Chrome extension:**
   ```javascript
   const ws = new WebSocket('ws://localhost:3000/wa-ext-ws');
   
   ws.onopen = () => {
     // Send auth
     ws.send(JSON.stringify({
       type: 'auth',
       apiKey: 'test-api-key-123',
       data: {
         extensionVersion: '1.0.0',
         browser: 'Chrome'
       }
     }));
   };
   
   ws.onmessage = (event) => {
     const message = JSON.parse(event.data);
     console.log('Received:', message);
     
     // Respond to commands
     if (message.type === 'send-message') {
       // Send message via WhatsApp Web
       // Then respond:
       ws.send(JSON.stringify({
         type: 'message-result',
         requestId: message.requestId,
         success: true,
         timestamp: Date.now()
       }));
     }
   };
   ```

## Performance Testing

### Test with Multiple Clients

```bash
# Terminal 1
npm run test:server

# Terminal 2-6 (5 clients)
npm run test:client
```

**Check:**
- [ ] All 5 clients connect successfully
- [ ] Round-robin distributes requests evenly
- [ ] No performance degradation
- [ ] Memory usage is stable

### Stress Test

```javascript
// In test server REPL
for (let i = 0; i < 100; i++) {
  await testAPI.testSendMessage('test-api-key-123', '+1234567890', `Message ${i}`);
}
testAPI.showStats();
```

**Check:**
- [ ] All messages sent successfully
- [ ] No memory leaks
- [ ] Response times consistent
- [ ] Error rate is 0%

## Troubleshooting Tests

### Mock Client Won't Connect

**Problem:** `Authentication timeout` error

**Solution:**
1. Check test server is running
2. Verify port 3000 is available
3. Check API key is valid
4. Review server logs for errors

### Tests Fail Randomly

**Problem:** Timing-related failures

**Solution:**
1. Increase delays in test code
2. Check system resources
3. Run tests individually
4. Review test order dependencies

### WebSocket Errors

**Problem:** Connection refused or drops

**Solution:**
1. Restart test server
2. Check firewall settings
3. Verify no port conflicts
4. Check Node.js version (>=14)

## CI/CD Integration

For automated testing in CI/CD:

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run test:auto
```

## Pre-Publishing Checklist

Before running `npm publish`:

- [ ] All unit tests pass (`npm test`)
- [ ] All integration tests pass (`npm run test:auto`)
- [ ] Manual testing completed
- [ ] Examples work correctly
- [ ] TypeScript definitions verified
- [ ] README is complete and accurate
- [ ] Version number updated in package.json
- [ ] No sensitive data in code
- [ ] .gitignore is correct
- [ ] LICENSE file present

## Next Steps

After all tests pass:

```bash
# Update version
npm version patch  # or minor, or major

# Publish to npm
npm publish

# Tag release
git tag v1.0.0
git push --tags
```

---

For issues or questions, review the main README.md or create an issue on GitHub.
