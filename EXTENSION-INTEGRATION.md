# Chrome Extension Integration Guide

> Complete WebSocket protocol documentation for integrating WhatsApp Chrome Extension with `whatsapp-ws-extension-gateway`

## Table of Contents

1. [Overview](#overview)
2. [Connection Flow](#connection-flow)
3. [Message Types Reference](#message-types-reference)
4. [Extension → Server Messages](#extension--server-messages)
5. [Server → Extension Messages](#server--extension-messages)
6. [Complete Implementation Example](#complete-implementation-example)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)
9. [Testing Guide](#testing-guide)

---

## Overview

The gateway uses WebSocket communication with JSON messages. All messages must be valid JSON objects with a `type` field.

### WebSocket Endpoint

```
ws://your-server-domain/wa-ext-ws
```

For local testing:
```
ws://localhost:3000/wa-ext-ws
```

### Valid API Keys (Test Server)

```javascript
'test-api-key-123'  // Test User 1
'test-api-key-456'  // Test User 2
'test-api-key-789'  // Test User 3
```

---

## Connection Flow

```
1. Extension connects to WebSocket
2. Extension sends 'auth' message with API key
3. Server validates API key
4. Server responds with 'authenticated' or 'error'
5. Extension sends 'status' message (WhatsApp login state)
6. Extension starts sending heartbeat every 25-30 seconds
7. Extension listens for commands (send-message, send-image, etc.)
8. Extension responds to each command with 'message-result'
```

---

## Message Types Reference

### Extension → Server (Messages YOU send)

| Type | When to Send | Required Fields |
|------|--------------|-----------------|
| `auth` | Immediately after connection | `apiKey`, `data.extensionVersion`, `data.browser` |
| `status` | After authentication, when WhatsApp state changes | `data.whatsappLoggedIn`, `data.ready` |
| `message-result` | After executing a command | `requestId`, `success`, `error?`, `messageId?` |
| `heartbeat` | Every 25-30 seconds | `timestamp` |

### Server → Extension (Messages YOU receive)

| Type | Purpose | Action Required |
|------|---------|-----------------|
| `authenticated` | Confirmation of successful auth | Store `sessionId`, send status |
| `error` | Authentication or other errors | Handle error, possibly reconnect |
| `send-message` | Send a text message | Execute and respond with result |
| `send-image` | Send an image | Execute and respond with result |
| `send-video` | Send a video | Execute and respond with result |
| `send-document` | Send a document | Execute and respond with result |
| `ping` | Heartbeat check | Respond with `heartbeat` |

---

## Extension → Server Messages

### 1. Authentication (`auth`)

**Send this FIRST after WebSocket connection opens.**

```javascript
{
  "type": "auth",
  "apiKey": "test-api-key-123",  // REQUIRED: Your API key
  "data": {
    "extensionVersion": "1.0.0",  // REQUIRED: Your extension version
    "browser": "Chrome"           // REQUIRED: Browser name
  }
}
```

**Example:**
```javascript
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    apiKey: 'test-api-key-123',
    data: {
      extensionVersion: '1.0.0',
      browser: 'Chrome'
    }
  }));
};
```

**Server Response:**
```javascript
// Success:
{
  "type": "authenticated",
  "sessionId": "abc-123-def-456"
}

// Failure:
{
  "type": "error",
  "code": "AUTHENTICATION_FAILED",
  "message": "Invalid API key"
}
```

---

### 2. Status Update (`status`)

**Send after authentication and whenever WhatsApp login state changes.**

```javascript
{
  "type": "status",
  "data": {
    "whatsappLoggedIn": true,  // REQUIRED: Is WhatsApp Web logged in?
    "ready": true              // REQUIRED: Is extension ready to send messages?
  }
}
```

**When to send:**
- ✅ Immediately after receiving `authenticated` message
- ✅ When WhatsApp Web logs in
- ✅ When WhatsApp Web logs out
- ✅ When extension becomes ready/not ready

**Example:**
```javascript
// After authentication
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  if (msg.type === 'authenticated') {
    // Send initial status
    ws.send(JSON.stringify({
      type: 'status',
      data: {
        whatsappLoggedIn: checkIfWhatsAppLoggedIn(),
        ready: checkIfReady()
      }
    }));
  }
};

// When WhatsApp state changes
function onWhatsAppLoginStateChanged(isLoggedIn) {
  ws.send(JSON.stringify({
    type: 'status',
    data: {
      whatsappLoggedIn: isLoggedIn,
      ready: isLoggedIn
    }
  }));
}
```

---

### 3. Message Result (`message-result`)

**Send after executing ANY command from the server.**

```javascript
{
  "type": "message-result",
  "requestId": "req-abc-123",  // REQUIRED: From the command you received
  "success": true,             // REQUIRED: true or false
  "messageId": "msg_12345",    // OPTIONAL: WhatsApp message ID (if success)
  "error": "Error message",    // OPTIONAL: Error description (if failed)
  "timestamp": 1699123456789   // OPTIONAL: When completed
}
```

**Success Example:**
```javascript
// After successfully sending message
ws.send(JSON.stringify({
  type: 'message-result',
  requestId: command.requestId,  // From the command
  success: true,
  messageId: 'wamid.abc123...',  // WhatsApp message ID
  timestamp: Date.now()
}));
```

**Failure Example:**
```javascript
// If sending failed
ws.send(JSON.stringify({
  type: 'message-result',
  requestId: command.requestId,
  success: false,
  error: 'Phone number not found',
  timestamp: Date.now()
}));
```

---

### 4. Heartbeat (`heartbeat`)

**Send every 25-30 seconds to keep the connection alive.**

```javascript
{
  "type": "heartbeat",
  "timestamp": 1699123456789  // REQUIRED: Current timestamp
}
```

**Example Implementation:**
```javascript
// Start heartbeat after authentication
let heartbeatInterval;

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  if (msg.type === 'authenticated') {
    // Start sending heartbeat every 25 seconds
    heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now()
        }));
      }
    }, 25000);
  }
};

// Cleanup on disconnect
ws.onclose = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
};
```

**Server may also send `ping` messages - respond with heartbeat:**
```javascript
if (msg.type === 'ping') {
  ws.send(JSON.stringify({
    type: 'heartbeat',
    timestamp: Date.now()
  }));
}
```

---

## Server → Extension Messages

### 1. Authenticated Confirmation

**Received after successful authentication.**

```javascript
{
  "type": "authenticated",
  "sessionId": "unique-session-id"
}
```

**Action:** Store sessionId and send status update.

---

### 2. Error Message

**Received when authentication fails or other errors occur.**

```javascript
{
  "type": "error",
  "code": "AUTHENTICATION_FAILED",
  "message": "Invalid API key"
}
```

**Common Error Codes:**
- `AUTHENTICATION_FAILED` - Invalid API key
- `MAX_SESSIONS_EXCEEDED` - Too many connections for this API key
- `INVALID_MESSAGE` - Malformed message sent

**Action:** Log error, notify user, possibly reconnect with correct credentials.

---

### 3. Send Message Command (`send-message`)

**Server requests you to send a text message.**

```javascript
{
  "type": "send-message",
  "requestId": "req-abc-123",
  "data": {
    "phoneNumber": "+1234567890",
    "message": "Hello World!"
  }
}
```

**What to do:**
1. Extract `phoneNumber` and `message`
2. Send message via WhatsApp Web API
3. Respond with `message-result`

**Example Handler:**
```javascript
async function handleSendMessage(command) {
  try {
    const { phoneNumber, message } = command.data;
    
    // Your WhatsApp sending logic
    const messageId = await sendWhatsAppMessage(phoneNumber, message);
    
    // Send success result
    ws.send(JSON.stringify({
      type: 'message-result',
      requestId: command.requestId,
      success: true,
      messageId: messageId,
      timestamp: Date.now()
    }));
    
  } catch (error) {
    // Send failure result
    ws.send(JSON.stringify({
      type: 'message-result',
      requestId: command.requestId,
      success: false,
      error: error.message,
      timestamp: Date.now()
    }));
  }
}
```

---

### 4. Send Image Command (`send-image`)

**Server requests you to send an image.**

```javascript
{
  "type": "send-image",
  "requestId": "req-def-456",
  "data": {
    "phoneNumber": "+1234567890",
    "dataUrl": "data:image/png;base64,iVBORw0KGgo...",  // Base64 image
    "caption": "Check this out!"  // Optional
  }
}
```

**What to do:**
1. Extract `phoneNumber`, `dataUrl`, and optional `caption`
2. Convert dataUrl to blob/file if needed
3. Send image via WhatsApp Web API
4. Respond with `message-result`

**Example Handler:**
```javascript
async function handleSendImage(command) {
  try {
    const { phoneNumber, dataUrl, caption } = command.data;
    
    // Your WhatsApp image sending logic
    const messageId = await sendWhatsAppImage(phoneNumber, dataUrl, caption);
    
    ws.send(JSON.stringify({
      type: 'message-result',
      requestId: command.requestId,
      success: true,
      messageId: messageId,
      timestamp: Date.now()
    }));
    
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'message-result',
      requestId: command.requestId,
      success: false,
      error: error.message,
      timestamp: Date.now()
    }));
  }
}
```

---

### 5. Send Video Command (`send-video`)

**Server requests you to send a video.**

```javascript
{
  "type": "send-video",
  "requestId": "req-ghi-789",
  "data": {
    "phoneNumber": "+1234567890",
    "dataUrl": "data:video/mp4;base64,AAAAIGZ0eXBpc29t...",
    "caption": "Watch this!"  // Optional
  }
}
```

**Handler same as images - just use video sending logic.**

---

### 6. Send Document Command (`send-document`)

**Server requests you to send a document/file.**

```javascript
{
  "type": "send-document",
  "requestId": "req-jkl-012",
  "data": {
    "phoneNumber": "+1234567890",
    "dataUrl": "data:application/pdf;base64,JVBERi0xLjQKJ...",
    "caption": "Important.pdf"  // Optional
  }
}
```

**Handler same as images - just use document sending logic.**

---

### 7. Ping (`ping`)

**Server checking if you're still alive.**

```javascript
{
  "type": "ping"
}
```

**Action:** Respond immediately with heartbeat.

```javascript
if (msg.type === 'ping') {
  ws.send(JSON.stringify({
    type: 'heartbeat',
    timestamp: Date.now()
  }));
}
```

---

## Complete Implementation Example

### Full Chrome Extension WebSocket Handler

```javascript
class WhatsAppGatewayClient {
  constructor(config) {
    this.wsUrl = config.wsUrl || 'ws://localhost:3000/wa-ext-ws';
    this.apiKey = config.apiKey || 'test-api-key-123';
    this.extensionVersion = config.extensionVersion || '1.0.0';
    this.browser = config.browser || 'Chrome';
    
    this.ws = null;
    this.sessionId = null;
    this.heartbeatInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  // Connect to gateway
  connect() {
    console.log('🔌 Connecting to WebSocket:', this.wsUrl);
    
    this.ws = new WebSocket(this.wsUrl);
    
    this.ws.onopen = () => {
      console.log('✅ WebSocket connected!');
      this.reconnectAttempts = 0;
      this.authenticate();
    };
    
    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    
    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket disconnected:', event.code, event.reason);
      this.cleanup();
      this.attemptReconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };
  }

  // Send authentication
  authenticate() {
    console.log('🔐 Authentication message sent');
    this.send({
      type: 'auth',
      apiKey: this.apiKey,
      data: {
        extensionVersion: this.extensionVersion,
        browser: this.browser
      }
    });
  }

  // Send status update
  sendStatus() {
    const whatsappLoggedIn = this.checkWhatsAppLogin();
    const ready = whatsappLoggedIn && this.checkExtensionReady();
    
    console.log('📊 Sending status:', { whatsappLoggedIn, ready });
    this.send({
      type: 'status',
      data: {
        whatsappLoggedIn,
        ready
      }
    });
  }

  // Start heartbeat
  startHeartbeat() {
    this.stopHeartbeat();
    
    console.log('💓 Heartbeat started');
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'heartbeat',
          timestamp: Date.now()
        });
      }
    }, 25000); // Every 25 seconds
  }

  // Stop heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('💓 Heartbeat stopped');
    }
  }

  // Handle incoming messages
  handleMessage(rawData) {
    try {
      const message = JSON.parse(rawData);
      console.log('📨 Received message:', message.type);
      
      switch (message.type) {
        case 'authenticated':
          this.handleAuthenticated(message);
          break;
          
        case 'error':
          this.handleError(message);
          break;
          
        case 'send-message':
          this.handleSendMessage(message);
          break;
          
        case 'send-image':
          this.handleSendImage(message);
          break;
          
        case 'send-video':
          this.handleSendVideo(message);
          break;
          
        case 'send-document':
          this.handleSendDocument(message);
          break;
          
        case 'ping':
          this.handlePing();
          break;
          
        default:
          console.warn('⚠️ Unknown message type:', message.type);
      }
      
    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  }

  // Handle authenticated
  handleAuthenticated(message) {
    console.log('✅ Authenticated! Session ID:', message.sessionId);
    this.sessionId = message.sessionId;
    
    // Send initial status
    this.sendStatus();
    
    // Start heartbeat
    this.startHeartbeat();
  }

  // Handle error
  handleError(message) {
    console.error('❌ Received error from server:');
    console.error('   Code:', message.code);
    console.error('   Message:', message.message);
    
    // Show notification to user
    this.showNotification('Error', message.message);
  }

  // Handle send message command
  async handleSendMessage(command) {
    console.log('📨 Received send-message command:');
    console.log('   Request ID:', command.requestId);
    console.log('   Phone:', command.data.phoneNumber);
    console.log('   Message:', command.data.message);
    
    try {
      // YOUR WHATSAPP SENDING LOGIC HERE
      const messageId = await this.sendWhatsAppMessage(
        command.data.phoneNumber,
        command.data.message
      );
      
      // Send success result
      this.sendResult(command.requestId, true, messageId);
      
    } catch (error) {
      // Send failure result
      this.sendResult(command.requestId, false, null, error.message);
    }
  }

  // Handle send image command
  async handleSendImage(command) {
    console.log('🖼️  Received send-image command:');
    console.log('   Request ID:', command.requestId);
    console.log('   Phone:', command.data.phoneNumber);
    console.log('   Caption:', command.data.caption);
    
    try {
      // YOUR WHATSAPP IMAGE SENDING LOGIC HERE
      const messageId = await this.sendWhatsAppImage(
        command.data.phoneNumber,
        command.data.dataUrl,
        command.data.caption
      );
      
      this.sendResult(command.requestId, true, messageId);
      
    } catch (error) {
      this.sendResult(command.requestId, false, null, error.message);
    }
  }

  // Handle send video command
  async handleSendVideo(command) {
    console.log('🎥 Received send-video command:');
    console.log('   Request ID:', command.requestId);
    console.log('   Phone:', command.data.phoneNumber);
    
    try {
      const messageId = await this.sendWhatsAppVideo(
        command.data.phoneNumber,
        command.data.dataUrl,
        command.data.caption
      );
      
      this.sendResult(command.requestId, true, messageId);
      
    } catch (error) {
      this.sendResult(command.requestId, false, null, error.message);
    }
  }

  // Handle send document command
  async handleSendDocument(command) {
    console.log('📄 Received send-document command:');
    console.log('   Request ID:', command.requestId);
    console.log('   Phone:', command.data.phoneNumber);
    
    try {
      const messageId = await this.sendWhatsAppDocument(
        command.data.phoneNumber,
        command.data.dataUrl,
        command.data.caption
      );
      
      this.sendResult(command.requestId, true, messageId);
      
    } catch (error) {
      this.sendResult(command.requestId, false, null, error.message);
    }
  }

  // Handle ping
  handlePing() {
    console.log('💓 Received ping, sending heartbeat');
    this.send({
      type: 'heartbeat',
      timestamp: Date.now()
    });
  }

  // Send result back to server
  sendResult(requestId, success, messageId = null, error = null) {
    console.log('📤 Sending result for request', requestId + ':', success ? 'SUCCESS' : 'FAILED');
    
    this.send({
      type: 'message-result',
      requestId: requestId,
      success: success,
      messageId: messageId,
      error: error,
      timestamp: Date.now()
    });
  }

  // Send message to server
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('❌ Cannot send, WebSocket not connected');
    }
  }

  // Cleanup on disconnect
  cleanup() {
    this.stopHeartbeat();
    this.sessionId = null;
  }

  // Attempt reconnection
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  // Disconnect
  disconnect() {
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ========================================
  // YOUR WHATSAPP IMPLEMENTATION METHODS
  // ========================================

  checkWhatsAppLogin() {
    // TODO: Check if WhatsApp Web is logged in
    // Return true or false
    return true;
  }

  checkExtensionReady() {
    // TODO: Check if extension is ready to send messages
    // Return true or false
    return true;
  }

  async sendWhatsAppMessage(phoneNumber, message) {
    // TODO: Implement WhatsApp message sending
    // Return WhatsApp message ID
    throw new Error('Not implemented');
  }

  async sendWhatsAppImage(phoneNumber, dataUrl, caption) {
    // TODO: Implement WhatsApp image sending
    // Return WhatsApp message ID
    throw new Error('Not implemented');
  }

  async sendWhatsAppVideo(phoneNumber, dataUrl, caption) {
    // TODO: Implement WhatsApp video sending
    // Return WhatsApp message ID
    throw new Error('Not implemented');
  }

  async sendWhatsAppDocument(phoneNumber, dataUrl, caption) {
    // TODO: Implement WhatsApp document sending
    // Return WhatsApp message ID
    throw new Error('Not implemented');
  }

  showNotification(title, message) {
    // TODO: Show browser notification
    console.log(`[${title}] ${message}`);
  }
}

// Initialize and connect
const client = new WhatsAppGatewayClient({
  wsUrl: 'ws://localhost:3000/wa-ext-ws',
  apiKey: 'test-api-key-123',
  extensionVersion: '1.0.0',
  browser: 'Chrome'
});

client.connect();
```

---

## Error Handling

### Common Issues and Solutions

#### 1. Authentication Fails

**Error:**
```javascript
{
  "type": "error",
  "code": "AUTHENTICATION_FAILED",
  "message": "Invalid API key"
}
```

**Solution:**
- Verify API key is correct: `test-api-key-123` (not `test-key-123`)
- Check message format matches exactly
- Ensure `data.extensionVersion` and `data.browser` are included

#### 2. Session Disconnects

**Cause:** Not sending heartbeat regularly

**Solution:**
- Send heartbeat every 25-30 seconds
- Respond to `ping` messages immediately
- Monitor WebSocket `onclose` event and reconnect

#### 3. Commands Not Responding

**Cause:** Not sending `message-result` back

**Solution:**
- **ALWAYS** send `message-result` for every command
- Include correct `requestId` from the command
- Set `success: true` or `success: false`
- Include `error` message if failed

#### 4. Max Sessions Exceeded

**Error:**
```javascript
{
  "type": "error",
  "code": "MAX_SESSIONS_EXCEEDED"
}
```

**Solution:**
- Close other connections with same API key
- Default limit is 10 sessions per API key
- Check for zombie connections

---

## Best Practices

### ✅ DO

1. **Send heartbeat regularly** (every 25-30 seconds)
2. **Always respond to commands** with `message-result`
3. **Update status** when WhatsApp login state changes
4. **Handle all message types** (even if just logging unknown ones)
5. **Implement reconnection logic** with exponential backoff
6. **Validate messages** before processing
7. **Log all events** for debugging
8. **Handle errors gracefully** and send error results

### ❌ DON'T

1. **Don't forget heartbeat** - session will timeout
2. **Don't ignore `ping`** - respond immediately
3. **Don't leave commands hanging** - always send result
4. **Don't use wrong API key format** - check exact spelling
5. **Don't send status before authentication** - auth first
6. **Don't create multiple connections** unnecessarily
7. **Don't send malformed JSON** - always validate

---

## Testing Guide

### Test with Mock Server

1. **Start test server:**
```bash
npm run test:server
```

2. **Use valid API key:**
```javascript
apiKey: 'test-api-key-123'  // ← Correct format
```

3. **Test connection flow:**
```javascript
// 1. Connect
ws = new WebSocket('ws://localhost:3000/wa-ext-ws');

// 2. Authenticate
ws.send(JSON.stringify({
  type: 'auth',
  apiKey: 'test-api-key-123',
  data: { extensionVersion: '1.0.0', browser: 'Chrome' }
}));

// 3. Send status
ws.send(JSON.stringify({
  type: 'status',
  data: { whatsappLoggedIn: true, ready: true }
}));

// 4. Start heartbeat
setInterval(() => {
  ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
}, 25000);
```

4. **Test from server console:**
```javascript
// In test server terminal (after your extension connects)
testAPI.testSendMessage()
testAPI.testSendImageWithDataUrl()
testAPI.testGetActiveSessions()
testAPI.showStats()
```

### Verify All Events Work

- [ ] ✅ `auth` - Authentication succeeds
- [ ] ✅ `status` - Status updates received by server
- [ ] ✅ `heartbeat` - Heartbeat keeps connection alive
- [ ] ✅ `send-message` - Receive command, send result
- [ ] ✅ `send-image` - Receive command, send result
- [ ] ✅ `send-video` - Receive command, send result
- [ ] ✅ `send-document` - Receive command, send result
- [ ] ✅ `ping` - Respond with heartbeat
- [ ] ✅ Reconnection - Auto-reconnect on disconnect

---

## Quick Reference Card

### Message Templates

**Auth:**
```json
{"type":"auth","apiKey":"test-api-key-123","data":{"extensionVersion":"1.0.0","browser":"Chrome"}}
```

**Status:**
```json
{"type":"status","data":{"whatsappLoggedIn":true,"ready":true}}
```

**Heartbeat:**
```json
{"type":"heartbeat","timestamp":1699123456789}
```

**Success Result:**
```json
{"type":"message-result","requestId":"req-123","success":true,"messageId":"msg_abc","timestamp":1699123456789}
```

**Failure Result:**
```json
{"type":"message-result","requestId":"req-123","success":false,"error":"Phone not found","timestamp":1699123456789}
```

---

## Need Help?

1. Check server console logs
2. Check browser console logs
3. Verify API key is exactly: `test-api-key-123`
4. Ensure all required fields are included
5. Test with `test-server.js` first
6. Review `test/mock-client.js` for working example

## Files to Reference

- **Working Example:** `test/mock-client.js` - Complete working implementation
- **Test Server:** `test-server.js` - Server for testing
- **Protocol Details:** `src/protocol.js` - Message validation logic
- **Type Definitions:** `src/types.d.ts` - Full type definitions
