# whatsapp-ws-extension-gateway

> WebSocket gateway server for WhatsApp Chrome Extension automation with API key authentication

[![npm version](https://img.shields.io/npm/v/whatsapp-ws-extension-gateway.svg)](https://www.npmjs.com/package/whatsapp-ws-extension-gateway)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/badge/GitHub-VictorWeston-blue.svg)](https://github.com/VictorWeston/whatsapp-ws-extension-gateway)

A production-ready NPM package that provides a WebSocket gateway for automating WhatsApp through Chrome extensions. This package handles WebSocket connections, API key authentication, message routing, and provides a clean API for sending messages, images, videos, and documents.

## Features

✅ WebSocket server with customizable route (`/wa-ext-ws`)  
✅ API key authentication with user-provided validation  
✅ Multiple extension connections per API key  
✅ Round-robin or random device selection  
✅ Automatic heartbeat monitoring and session cleanup  
✅ Promise-based send operations with timeout handling  
✅ Automatic URL to DataURL conversion for media  
✅ TypeScript type definitions included  
✅ Express middleware support  
✅ Comprehensive error handling  
✅ Enhanced session status tracking (new in v1.0.4)  
✅ Interactive CLI test server (available in [GitHub repo](https://github.com/VictorWeston/whatsapp-ws-extension-gateway))  

## Installation

```bash
npm install whatsapp-ws-extension-gateway
```

### Dependencies

- `ws` - WebSocket library
- `uuid` - Unique ID generation

### Optional Peer Dependencies

- `express` - For Express integration (optional)

## Documentation

- 📖 **[Complete Usage Guide](https://github.com/VictorWeston/whatsapp-ws-extension-gateway/blob/main/GUIDE.md)** - Detailed examples for every use case
- 🔌 **[Chrome Extension Integration](https://github.com/VictorWeston/whatsapp-ws-extension-gateway/blob/main/EXTENSION-INTEGRATION.md)** - WebSocket protocol documentation
- 🧪 **[Testing Guide](https://github.com/VictorWeston/whatsapp-ws-extension-gateway/blob/main/TESTING.md)** - Testing checklist and examples
- 💻 **[CLI Testing Guide](https://github.com/VictorWeston/whatsapp-ws-extension-gateway/blob/main/CLI-GUIDE.md)** - Interactive testing commands (for repository development only)

## Quick Start

### Standalone Server

```javascript
const { WhatsAppGateway } = require('whatsapp-ws-extension-gateway');

const gateway = new WhatsAppGateway({
  port: 3000,
  path: '/wa-ext-ws',
  
  // Required: Validate API keys
  validateApiKey: async (apiKey) => {
    // Check against your database
    const user = await db.findUser({ apiKey });
    return user ? { valid: true, userId: user.id } : { valid: false };
  },
  
  // Required: Log message events
  onMessageLog: (logData) => {
    console.log('Message:', logData.status, logData.type);
    // Save to database
  },
  
  // Required: Handle errors
  onError: (error) => {
    console.error('Error:', error.code, error.message);
  }
});

// Start the gateway
await gateway.start();

// Send a text message
const result = await gateway.sendMessage('api-key-123', {
  phoneNumber: '+1234567890',
  message: 'Hello World!'
});

console.log('Message sent:', result);
```

### With Express

```javascript
const express = require('express');
const { WhatsAppGateway } = require('whatsapp-ws-extension-gateway');

const app = express();
const server = require('http').createServer(app);

// Create gateway with existing Express server
const gateway = new WhatsAppGateway({
  server: server,  // Share HTTP server with Express
  path: '/wa-ext-ws',
  validateApiKey: async (apiKey) => { /* ... */ },
  onMessageLog: (logData) => { /* ... */ },
  onError: (error) => { /* ... */ }
});

await gateway.start();

// Add REST API endpoints
app.post('/api/send-message', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const result = await gateway.sendMessage(apiKey, req.body);
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

server.listen(3000);
```

## API Reference

### Constructor

#### `new WhatsAppGateway(config)`

Creates a new gateway instance.

**Config Options:**

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `port` | number | No | 3000 | Port for standalone server |
| `path` | string | No | `/wa-ext-ws` | WebSocket route path |
| `server` | http.Server | No | null | Existing HTTP server to attach to |
| `validateApiKey` | Function | **Yes** | - | API key validation callback |
| `onMessageLog` | Function | **Yes** | - | Message logging callback |
| `onError` | Function | **Yes** | - | Error handling callback |
| `heartbeatInterval` | number | No | 30000 | Heartbeat interval (ms) |
| `requestTimeout` | number | No | 30000 | Request timeout (ms) |
| `maxSessionsPerKey` | number | No | 10 | Max sessions per API key |
| `deviceSelectionStrategy` | string | No | `'round-robin'` | `'round-robin'` or `'random'` |

### Methods

#### `await gateway.start()`

Starts the WebSocket server.

```javascript
await gateway.start();
console.log('Gateway started');
```

#### `await gateway.stop()`

Stops the WebSocket server and cleans up all sessions.

```javascript
await gateway.stop();
```

#### `await gateway.sendMessage(apiKey, data)`

Sends a text message.

**Parameters:**
- `apiKey` (string) - API key for authentication
- `data` (object):
  - `phoneNumber` (string) - Phone number in international format (e.g., `+1234567890`)
  - `message` (string) - Message text (supports multiline)

**Returns:** Promise<MessageResult>

```javascript
const result = await gateway.sendMessage('api-key-123', {
  phoneNumber: '+1234567890',
  message: 'Hello World!\nThis is a multiline message.'
});

console.log(result);
// { success: true, requestId: '...', timestamp: 1699123456789 }
```

#### `await gateway.sendImage(apiKey, data)`

Sends an image with optional caption.

**Parameters:**
- `apiKey` (string) - API key for authentication
- `data` (object):
  - `phoneNumber` (string) - Phone number in international format
  - `imageUrl` (string) - Image URL (will be auto-converted to base64)
  - `imageDataUrl` (string) - Or provide base64 data URL directly
  - `caption` (string, optional) - Image caption

**Returns:** Promise<MessageResult>

```javascript
// Using URL (auto-conversion)
await gateway.sendImage('api-key-123', {
  phoneNumber: '+1234567890',
  imageUrl: 'https://example.com/image.jpg',
  caption: 'Check this out!'
});

// Using data URL
await gateway.sendImage('api-key-123', {
  phoneNumber: '+1234567890',
  imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAA...',
  caption: 'Image caption'
});
```

#### `await gateway.sendVideo(apiKey, data)`

Sends a video with optional caption (max 10MB).

**Parameters:**
- `apiKey` (string) - API key for authentication
- `data` (object):
  - `phoneNumber` (string) - Phone number in international format
  - `videoUrl` (string) - Video URL (will be auto-converted to base64)
  - `videoDataUrl` (string) - Or provide base64 data URL directly
  - `caption` (string, optional) - Video caption

**Returns:** Promise<MessageResult>

```javascript
await gateway.sendVideo('api-key-123', {
  phoneNumber: '+1234567890',
  videoUrl: 'https://example.com/video.mp4',
  caption: 'Watch this!'
});
```

#### `await gateway.sendDocument(apiKey, data)`

Sends a document/file (max 10MB).

**Parameters:**
- `apiKey` (string) - API key for authentication
- `data` (object):
  - `phoneNumber` (string) - Phone number in international format
  - `documentUrl` (string) - Document URL (will be auto-converted to base64)
  - `documentDataUrl` (string) - Or provide base64 data URL directly
  - `documentName` (string) - Document filename
  - `caption` (string, optional) - Caption for the document

**Returns:** Promise<MessageResult>

```javascript
await gateway.sendDocument('api-key-123', {
  phoneNumber: '+1234567890',
  documentUrl: 'https://example.com/document.pdf',
  documentName: 'report.pdf',
  caption: 'Monthly report - Q4 2024'
});
```

#### `gateway.getActiveSessions(apiKey)`

Gets active sessions for an API key.

**Returns:** Array of session info objects

```javascript
const sessions = gateway.getActiveSessions('api-key-123');
console.log(sessions);
// [
//   {
//     sessionId: 'uuid-1234',
//     deviceActive: true,
//     connectedAt: 1699123456789,
//     lastHeartbeat: 1699123486789,
//     extensionVersion: '1.0.0',
//     browser: 'Chrome'
//   }
// ]
```

#### `gateway.getHealth()`

Gets health check information.

**Returns:** Health check object

```javascript
const health = gateway.getHealth();
console.log(health);
// {
//   status: 'ok',
//   activeSessions: 5,
//   uptime: 3600000,
//   timestamp: 1699123456789
// }
```

## Callbacks

### validateApiKey(apiKey)

User-provided callback to validate API keys.

**Parameters:**
- `apiKey` (string) - The API key to validate

**Returns:** Promise<{ valid: boolean, ...extraData }>

```javascript
validateApiKey: async (apiKey) => {
  // Check against database
  const user = await database.users.findOne({ apiKey });
  
  if (!user || !user.isActive) {
    return { valid: false };
  }
  
  return { 
    valid: true, 
    userId: user.id,
    name: user.name
  };
}
```

### onMessageLog(logData)

User-provided callback for logging message events.

**Parameters:**
- `logData` (object):
  - `apiKey` (string) - API key used
  - `sessionId` (string) - Session that handled the request
  - `phoneNumber` (string) - Recipient phone number
  - `type` (string) - Message type (`'message'`, `'image'`, `'video'`, `'document'`)
  - `status` (string) - `'success'` or `'failure'`
  - `timestamp` (number) - Timestamp
  - `requestId` (string) - Unique request ID
  - `error` (string, optional) - Error message if failed

```javascript
onMessageLog: (logData) => {
  console.log(`[${logData.status}] ${logData.type} to ${logData.phoneNumber}`);
  
  // Save to database
  database.messageLogs.insert({
    userId: logData.userId,
    phoneNumber: logData.phoneNumber,
    type: logData.type,
    status: logData.status,
    timestamp: new Date(logData.timestamp)
  });
}
```

### onError(error)

User-provided callback for error handling.

**Parameters:**
- `error` (object):
  - `code` (string) - Error code
  - `message` (string) - Error message
  - `details` (any, optional) - Additional error details

```javascript
onError: (error) => {
  console.error(`[${error.code}] ${error.message}`);
  
  // Send to error tracking service
  errorTracker.capture(error);
  
  // Log to database
  database.errorLogs.insert({
    code: error.code,
    message: error.message,
    details: JSON.stringify(error.details),
    timestamp: new Date()
  });
}
```

## WebSocket Protocol

### Connection Flow

1. Extension connects to `ws://backend-url/wa-ext-ws`
2. Extension sends authentication message
3. Server validates API key via `validateApiKey()` callback
4. If valid, extension is added to active sessions
5. Extension sends device status (WhatsApp logged in or not)

### Extension → Server Messages

#### Authentication
```json
{
  "type": "auth",
  "apiKey": "user-api-key-123",
  "data": {
    "extensionVersion": "1.0.0",
    "browser": "Chrome"
  }
}
```

#### Device Status
```json
{
  "type": "status",
  "data": {
    "whatsappLoggedIn": true,
    "ready": true
  }
}
```

#### Message Result
```json
{
  "type": "message-result",
  "requestId": "req-uuid-123",
  "success": true,
  "error": null,
  "timestamp": 1699123456789
}
```

#### Heartbeat
```json
{
  "type": "heartbeat",
  "timestamp": 1699123456789
}
```

### Server → Extension Messages

#### Send Text Message
```json
{
  "type": "send-message",
  "requestId": "req-uuid-123",
  "data": {
    "phoneNumber": "+1234567890",
    "message": "Hello World"
  }
}
```

#### Send Image
```json
{
  "type": "send-image",
  "requestId": "req-uuid-456",
  "data": {
    "phoneNumber": "+1234567890",
    "imageDataUrl": "data:image/png;base64,...",
    "caption": "Check this out"
  }
}
```

#### Send Video
```json
{
  "type": "send-video",
  "requestId": "req-uuid-789",
  "data": {
    "phoneNumber": "+1234567890",
    "videoDataUrl": "data:video/mp4;base64,...",
    "caption": "Watch this"
  }
}
```

#### Send Document
```json
{
  "type": "send-document",
  "requestId": "req-uuid-101",
  "data": {
    "phoneNumber": "+1234567890",
    "documentDataUrl": "data:application/pdf;base64,...",
    "documentName": "document.pdf"
  }
}
```

#### Ping
```json
{
  "type": "ping"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `AUTHENTICATION_FAILED` | Invalid API key |
| `NO_ACTIVE_DEVICE` | No extension connected for API key |
| `REQUEST_TIMEOUT` | Extension didn't respond within timeout period |
| `CONNECTION_LOST` | WebSocket disconnected mid-request |
| `VALIDATION_ERROR` | Invalid phone number or data format |
| `EXTENSION_ERROR` | Extension reported failure |
| `INVALID_API_KEY` | Malformed API key |
| `MAX_SESSIONS_EXCEEDED` | Too many sessions for this API key |
| `INVALID_PHONE_NUMBER` | Invalid phone number format |
| `INVALID_DATA` | Invalid data provided |
| `FETCH_ERROR` | Failed to fetch URL |
| `FILE_TOO_LARGE` | File exceeds 10MB limit |

## Error Handling

All send methods throw errors that can be caught:

```javascript
try {
  const result = await gateway.sendMessage('api-key-123', {
    phoneNumber: '+1234567890',
    message: 'Hello'
  });
  console.log('Success:', result);
} catch (error) {
  if (error.code === 'NO_ACTIVE_DEVICE') {
    console.log('No WhatsApp device connected');
  } else if (error.code === 'REQUEST_TIMEOUT') {
    console.log('Request timed out');
  } else {
    console.error('Error:', error.message);
  }
}
```

## TypeScript Support

TypeScript definitions are included:

```typescript
import { WhatsAppGateway, GatewayConfig, SendMessageData } from 'whatsapp-ws-extension-gateway';

const config: GatewayConfig = {
  port: 3000,
  path: '/wa-ext-ws',
  validateApiKey: async (apiKey: string) => {
    return { valid: true, userId: 'user-123' };
  },
  onMessageLog: (logData) => {
    console.log(logData);
  },
  onError: (error) => {
    console.error(error);
  }
};

const gateway = new WhatsAppGateway(config);

await gateway.start();

const messageData: SendMessageData = {
  phoneNumber: '+1234567890',
  message: 'Hello TypeScript!'
};

await gateway.sendMessage('api-key', messageData);
```

## Testing & Development

### Interactive CLI Testing (Repository Only)

**Note:** The interactive CLI test server is available only in the [GitHub repository](https://github.com/VictorWeston/whatsapp-ws-extension-gateway), not in the NPM package.

To use it, clone the repository:

```bash
git clone https://github.com/VictorWeston/whatsapp-ws-extension-gateway.git
cd whatsapp-ws-extension-gateway
npm install
npm run test:server
```

**Available Commands:**

```bash
# Send messages
send test-api-key-123 +1234567890 Hello World!

# Send test images
image test-api-key-123 +1234567890 Check this out!

# List connected devices
devices                      # All devices
devices test-api-key-123     # Specific API key

# Monitor server
stats                        # Show statistics
health                       # Server health check
logs 20                      # Recent 20 logs

# Run tests
test                         # Run all automated tests
```

See **[CLI-GUIDE.md](https://github.com/VictorWeston/whatsapp-ws-extension-gateway/blob/main/CLI-GUIDE.md)** for complete documentation.

### Session Status Tracking (Enhanced in v1.0.4)

Sessions now track detailed status information:

```javascript
const sessions = await gateway.getActiveSessions('api-key-123');

sessions.forEach(session => {
  console.log({
    sessionId: session.sessionId,
    whatsappLoggedIn: session.whatsappLoggedIn,  // Boolean
    ready: session.ready,                         // Boolean
    deviceActive: session.deviceActive,           // Boolean (both must be true)
    status: session.status,                       // "WhatsApp Web logged in" or "Not ready"
    connectedAt: session.connectedAt,
    lastHeartbeat: session.lastHeartbeat,
    lastStatusUpdate: session.lastStatusUpdate
  });
});
```

## Examples

See the `examples/` directory for complete examples:

- **`basic-usage.js`** - Standalone server with in-memory API keys
- **`express-middleware.js`** - Integration with Express.js
- **`with-database.js`** - Database integration for API keys and logging

Run examples:

```bash
# Basic usage
node examples/basic-usage.js

# Express integration
node examples/express-middleware.js

# Database integration
node examples/with-database.js
```

## Security Best Practices

### 1. Use WSS (Secure WebSocket) in Production

```javascript
const https = require('https');
const fs = require('fs');

const httpsServer = https.createServer({
  cert: fs.readFileSync('/path/to/cert.pem'),
  key: fs.readFileSync('/path/to/key.pem')
});

const gateway = new WhatsAppGateway({
  server: httpsServer,
  path: '/wa-ext-ws'
});
```

### 2. Store API Keys Securely

- **Never** hardcode API keys in your code
- Use environment variables or secure key management systems
- Hash API keys in your database
- Implement API key rotation

### 3. Rate Limiting

Implement rate limiting per API key:

```javascript
const rateLimiter = new Map();

validateApiKey: async (apiKey) => {
  const usage = rateLimiter.get(apiKey) || { count: 0, resetAt: Date.now() + 3600000 };
  
  if (usage.count > 1000) {
    return { valid: false };
  }
  
  usage.count++;
  rateLimiter.set(apiKey, usage);
  
  // Validate against database
  return await validateAgainstDB(apiKey);
}
```

### 4. Input Validation

Always validate phone numbers and data:

```javascript
const phoneRegex = /^\+[1-9]\d{1,14}$/;

if (!phoneRegex.test(phoneNumber)) {
  throw new Error('Invalid phone number');
}
```

### 5. Monitoring & Logging

- Log all API calls and errors
- Monitor for suspicious activity
- Set up alerts for failures
- Track usage metrics per API key

## Advanced Usage

### Custom Device Selection

```javascript
const gateway = new WhatsAppGateway({
  deviceSelectionStrategy: 'random',  // or 'round-robin'
  // ...
});
```

### Multiple Sessions per API Key

```javascript
const gateway = new WhatsAppGateway({
  maxSessionsPerKey: 5,  // Allow up to 5 extensions per API key
  // ...
});
```

### Custom Timeouts

```javascript
const gateway = new WhatsAppGateway({
  heartbeatInterval: 20000,  // 20 seconds
  requestTimeout: 45000,     // 45 seconds
  // ...
});
```

## Troubleshooting

### Extension Not Connecting

1. Check WebSocket URL format: `ws://localhost:3000/wa-ext-ws`
2. Verify firewall settings
3. Check CORS settings if using different domains
4. Ensure API key is valid

### Messages Not Sending

1. Check if WhatsApp is logged in: `getActiveSessions()`
2. Verify phone number format: `+1234567890`
3. Check device status: `deviceActive` should be `true`
4. Review error logs from `onError` callback

### Session Timeouts

1. Check heartbeat interval settings
2. Ensure extension is sending heartbeat messages
3. Verify network stability

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/VictorWeston/whatsapp-ws-extension-gateway).

## License

MIT © 2025 [Victor Weston](https://github.com/VictorWeston)

## Support

For issues and questions:
- 🐛 **[GitHub Issues](https://github.com/VictorWeston/whatsapp-ws-extension-gateway/issues)** - Report bugs or request features
- 📖 **[Documentation](https://github.com/VictorWeston/whatsapp-ws-extension-gateway#readme)** - Complete guides and API reference
- 💬 **[Discussions](https://github.com/VictorWeston/whatsapp-ws-extension-gateway/discussions)** - Ask questions and share ideas

## Links

- **NPM Package:** https://www.npmjs.com/package/whatsapp-ws-extension-gateway
- **GitHub Repository:** https://github.com/VictorWeston/whatsapp-ws-extension-gateway
- **Author:** [Victor Weston](https://github.com/VictorWeston)

---

**Made with ❤️ for WhatsApp automation**
