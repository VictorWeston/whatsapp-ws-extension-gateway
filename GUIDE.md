# WhatsApp WebSocket Gateway - Complete Guide

> Comprehensive guide for every use case of `whatsapp-ws-extension-gateway`

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication & API Keys](#authentication--api-keys)
3. [WebSocket Connection Handling](#websocket-connection-handling)
4. [Sending Messages](#sending-messages)
5. [Sending Media (Images, Videos, Documents)](#sending-media)
6. [Callbacks & Event Handling](#callbacks--event-handling)
7. [Session Management](#session-management)
8. [Device Selection Strategies](#device-selection-strategies)
9. [Error Handling](#error-handling)
10. [Express Integration](#express-integration)
11. [TypeScript Usage](#typescript-usage)
12. [Advanced Configuration](#advanced-configuration)
13. [Production Deployment](#production-deployment)

---

## Getting Started

### Installation

```bash 
npm install whatsapp-ws-extension-gateway
```

### Basic Setup

```javascript
const { WhatsAppGateway } = require('whatsapp-ws-extension-gateway');

const gateway = new WhatsAppGateway({
  port: 3000,
  path: '/wa-ext-ws',
  
  validateApiKey: async (apiKey) => {
    // Your validation logic
    return { valid: true, userId: 'user-123' };
  },
  
  onMessageLog: (logData) => {
    console.log('Message event:', logData);
  },
  
  onError: (error) => {
    console.error('Error:', error);
  }
});

// Start the server
await gateway.start();
console.log('Gateway running on port 3000');
```

---

## Authentication & API Keys

### Simple In-Memory Validation

For testing or small applications:

```javascript
const validApiKeys = new Set([
  'key-abc123',
  'key-xyz789'
]);

const gateway = new WhatsAppGateway({
  validateApiKey: async (apiKey) => {
    if (validApiKeys.has(apiKey)) {
      return { 
        valid: true, 
        userId: `user-${apiKey}` 
      };
    }
    return { valid: false };
  }
});
```

### Database Validation (MongoDB)

```javascript
const { MongoClient } = require('mongodb');
const client = new MongoClient('mongodb://localhost:27017');
const db = client.db('myapp');

const gateway = new WhatsAppGateway({
  validateApiKey: async (apiKey) => {
    try {
      const user = await db.collection('users').findOne({ 
        apiKey: apiKey,
        active: true 
      });
      
      if (user) {
        return { 
          valid: true, 
          userId: user._id.toString(),
          email: user.email,
          plan: user.plan
        };
      }
      
      return { valid: false };
    } catch (error) {
      console.error('Database error:', error);
      return { valid: false };
    }
  }
});
```

### Database Validation (PostgreSQL)

```javascript
const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  database: 'myapp',
  user: 'postgres',
  password: 'password'
});

const gateway = new WhatsAppGateway({
  validateApiKey: async (apiKey) => {
    try {
      const result = await pool.query(
        'SELECT id, email, plan FROM users WHERE api_key = $1 AND active = true',
        [apiKey]
      );
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        return { 
          valid: true, 
          userId: user.id,
          email: user.email,
          plan: user.plan
        };
      }
      
      return { valid: false };
    } catch (error) {
      console.error('Database error:', error);
      return { valid: false };
    }
  }
});
```

### JWT Token Validation

```javascript
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'your-jwt-secret';

const gateway = new WhatsAppGateway({
  validateApiKey: async (apiKey) => {
    try {
      // Decode JWT token
      const decoded = jwt.verify(apiKey, SECRET_KEY);
      
      // Check expiration
      if (decoded.exp < Date.now() / 1000) {
        return { valid: false };
      }
      
      return { 
        valid: true, 
        userId: decoded.userId,
        email: decoded.email
      };
    } catch (error) {
      console.error('JWT validation failed:', error.message);
      return { valid: false };
    }
  }
});
```

### Rate Limiting by API Key

```javascript
const apiKeyUsage = new Map(); // apiKey -> { count, resetTime }

const gateway = new WhatsAppGateway({
  validateApiKey: async (apiKey) => {
    const user = await db.findUser({ apiKey });
    
    if (!user) {
      return { valid: false };
    }
    
    // Check rate limit
    const now = Date.now();
    const usage = apiKeyUsage.get(apiKey) || { count: 0, resetTime: now + 3600000 };
    
    if (now > usage.resetTime) {
      usage.count = 0;
      usage.resetTime = now + 3600000; // Reset every hour
    }
    
    if (usage.count >= user.hourlyLimit) {
      return { 
        valid: false, 
        reason: 'Rate limit exceeded' 
      };
    }
    
    usage.count++;
    apiKeyUsage.set(apiKey, usage);
    
    return { 
      valid: true, 
      userId: user.id,
      remaining: user.hourlyLimit - usage.count
    };
  }
});
```

---

## WebSocket Connection Handling

### Extension Connection Flow

The Chrome Extension connects to the gateway:

```javascript
// Chrome Extension Code (client-side)
const ws = new WebSocket('ws://localhost:3000/wa-ext-ws');

ws.onopen = () => {
  // Send authentication
  ws.send(JSON.stringify({
    type: 'authenticate',
    apiKey: 'your-api-key'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'authenticated') {
    console.log('Connected! Session ID:', message.sessionId);
    
    // Send status update
    ws.send(JSON.stringify({
      type: 'status',
      status: 'WhatsApp Web is logged in',
      ready: true
    }));
  }
  
  if (message.type === 'send-message') {
    // Handle send message command
    handleSendMessage(message);
  }
};
```

### Server-Side Connection Tracking

```javascript
const activeSessions = new Map(); // Custom tracking

const gateway = new WhatsAppGateway({
  validateApiKey: async (apiKey) => {
    const result = { valid: true, userId: 'user-123' };
    
    // Track new connection
    if (!activeSessions.has(apiKey)) {
      activeSessions.set(apiKey, []);
    }
    
    return result;
  },
  
  onMessageLog: (logData) => {
    // Track when session becomes active
    if (logData.type === 'session-status' && logData.details.ready) {
      console.log(`Session ${logData.sessionId} is now ready`);
    }
  }
});

// Get active sessions anytime
const sessions = await gateway.getActiveSessions('api-key-123');
console.log('Active devices:', sessions.length);
```

### Handling Disconnections

```javascript
const gateway = new WhatsAppGateway({
  onMessageLog: (logData) => {
    if (logData.type === 'session-disconnected') {
      console.log(`Session ${logData.sessionId} disconnected`);
      
      // Notify your application
      notifyUser(logData.apiKey, 'Device disconnected');
      
      // Clean up any custom tracking
      cleanupSession(logData.sessionId);
    }
  }
});
```

### Heartbeat Monitoring

```javascript
const gateway = new WhatsAppGateway({
  heartbeatInterval: 30000, // 30 seconds (default)
  
  onMessageLog: (logData) => {
    if (logData.type === 'heartbeat-timeout') {
      console.warn(`Session ${logData.sessionId} timed out`);
      
      // Alert user that extension is not responding
      alertUser(logData.apiKey, 'Connection lost - please refresh extension');
    }
  }
});
```

---

## Sending Messages

### Simple Text Message

```javascript
try {
  const result = await gateway.sendMessage('api-key-123', {
    phoneNumber: '+1234567890',
    message: 'Hello World!'
  });
  
  console.log('Success:', result);
  // Output: { success: true, requestId: '...', messageId: 'msg_123', ... }
  
} catch (error) {
  console.error('Failed:', error.code, error.message);
}
```

### With Custom Options

```javascript
const result = await gateway.sendMessage('api-key-123', {
  phoneNumber: '+1234567890',
  message: 'Hello World!',
  deviceSelectionStrategy: 'random' // 'round-robin' (default) or 'random'
});
```

### Bulk Messages

```javascript
const phoneNumbers = ['+1111111111', '+2222222222', '+3333333333'];

async function sendBulkMessages(apiKey, phoneNumbers, message) {
  const results = [];
  
  for (const phone of phoneNumbers) {
    try {
      const result = await gateway.sendMessage(apiKey, {
        phoneNumber: phone,
        message: message
      });
      results.push({ phone, success: true, result });
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      results.push({ phone, success: false, error: error.message });
    }
  }
  
  return results;
}

const results = await sendBulkMessages('api-key-123', phoneNumbers, 'Hello!');
console.log('Sent:', results.filter(r => r.success).length);
console.log('Failed:', results.filter(r => !r.success).length);
```

### Message Templates

```javascript
function sendWelcomeMessage(apiKey, phoneNumber, userName) {
  return gateway.sendMessage(apiKey, {
    phoneNumber,
    message: `Hi ${userName}! 👋\n\nWelcome to our service.\n\nReply HELP for assistance.`
  });
}

function sendOTP(apiKey, phoneNumber, code) {
  return gateway.sendMessage(apiKey, {
    phoneNumber,
    message: `Your verification code is: ${code}\n\nValid for 5 minutes.`
  });
}

// Usage
await sendWelcomeMessage('api-key-123', '+1234567890', 'John');
await sendOTP('api-key-123', '+1234567890', '123456');
```

---

## Sending Media

### Send Image with DataURL

```javascript
const result = await gateway.sendImage('api-key-123', {
  phoneNumber: '+1234567890',
  dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...',
  caption: 'Check out this image!'
});
```

### Send Image from File Path (Auto-Conversion)

The gateway automatically converts file URLs to DataURL:

```javascript
const result = await gateway.sendImage('api-key-123', {
  phoneNumber: '+1234567890',
  dataUrl: 'file:///C:/images/photo.jpg', // Auto-converted to base64
  caption: 'Photo from my computer'
});
```

### Send Image from HTTP URL (Auto-Conversion)

```javascript
const result = await gateway.sendImage('api-key-123', {
  phoneNumber: '+1234567890',
  dataUrl: 'https://example.com/image.png', // Auto-fetched and converted
  caption: 'Image from the web'
});
```

### Send Video

```javascript
const result = await gateway.sendVideo('api-key-123', {
  phoneNumber: '+1234567890',
  dataUrl: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t...',
  caption: 'Check out this video!'
});

// Or from URL (auto-converted)
const result = await gateway.sendVideo('api-key-123', {
  phoneNumber: '+1234567890',
  dataUrl: 'https://example.com/video.mp4',
  caption: 'Video from the web'
});
```

### Send Document/PDF

```javascript
const result = await gateway.sendDocument('api-key-123', {
  phoneNumber: '+1234567890',
  dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJ...',
  caption: 'Important document.pdf'
});

// Or from URL (auto-converted)
const result = await gateway.sendDocument('api-key-123', {
  phoneNumber: '+1234567890',
  dataUrl: 'https://example.com/report.pdf',
  caption: 'Monthly Report'
});
```

### Send with Custom Timeout

```javascript
const result = await gateway.sendImage('api-key-123', {
  phoneNumber: '+1234567890',
  dataUrl: 'https://example.com/large-file.jpg',
  caption: 'Large file',
  timeout: 60000 // 60 seconds (default is 30s)
});
```

---

## Callbacks & Event Handling

### onMessageLog - Track All Events

```javascript
const gateway = new WhatsAppGateway({
  onMessageLog: (logData) => {
    console.log('Event:', logData.type);
    
    switch (logData.type) {
      case 'message-sent':
        console.log(`✅ Message sent to ${logData.phoneNumber}`);
        break;
        
      case 'image-sent':
        console.log(`🖼️  Image sent to ${logData.phoneNumber}`);
        break;
        
      case 'video-sent':
        console.log(`🎥 Video sent to ${logData.phoneNumber}`);
        break;
        
      case 'document-sent':
        console.log(`📄 Document sent to ${logData.phoneNumber}`);
        break;
        
      case 'send-failed':
        console.error(`❌ Failed: ${logData.details.error}`);
        break;
        
      case 'session-connected':
        console.log(`🔌 Session ${logData.sessionId} connected`);
        break;
        
      case 'session-status':
        console.log(`📊 Status: ${logData.details.status}`);
        break;
        
      case 'session-disconnected':
        console.log(`🔌 Session ${logData.sessionId} disconnected`);
        break;
    }
  }
});
```

### Save Events to Database

```javascript
const gateway = new WhatsAppGateway({
  onMessageLog: async (logData) => {
    // Save to MongoDB
    await db.collection('message_logs').insertOne({
      ...logData,
      timestamp: new Date(logData.timestamp)
    });
    
    // Update user statistics
    if (logData.status === 'success') {
      await db.collection('users').updateOne(
        { apiKey: logData.apiKey },
        { 
          $inc: { messagesSent: 1 },
          $set: { lastMessageAt: new Date() }
        }
      );
    }
  }
});
```

### Send Webhooks

```javascript
const axios = require('axios');

const gateway = new WhatsAppGateway({
  onMessageLog: async (logData) => {
    // Get user's webhook URL
    const user = await db.findUser({ apiKey: logData.apiKey });
    
    if (user && user.webhookUrl) {
      try {
        await axios.post(user.webhookUrl, {
          event: logData.type,
          data: logData,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Webhook delivery failed:', error.message);
      }
    }
  }
});
```

### onError - Comprehensive Error Handling

```javascript
const gateway = new WhatsAppGateway({
  onError: (error) => {
    console.error('Error Code:', error.code);
    console.error('Message:', error.message);
    console.error('Details:', error.details);
    
    // Handle different error types
    switch (error.code) {
      case 'VALIDATION_ERROR':
        // Invalid input data
        console.warn('Validation failed:', error.details);
        break;
        
      case 'NO_ACTIVE_DEVICE':
        // No extension connected
        console.warn('No device available for API key');
        notifyUser(error.details.apiKey, 'Please connect your extension');
        break;
        
      case 'REQUEST_TIMEOUT':
        // Extension didn't respond in time
        console.warn('Request timed out');
        break;
        
      case 'AUTHENTICATION_FAILED':
        // Invalid API key
        console.warn('Auth failed for:', error.details.apiKey);
        break;
        
      case 'MAX_SESSIONS_EXCEEDED':
        // Too many connections
        console.warn('Session limit reached');
        break;
        
      default:
        // Unknown error
        console.error('Unexpected error:', error);
        alertAdmin(error);
    }
  }
});
```

### Custom Event Emitter

```javascript
const EventEmitter = require('events');
const events = new EventEmitter();

const gateway = new WhatsAppGateway({
  onMessageLog: (logData) => {
    events.emit('message', logData);
  },
  
  onError: (error) => {
    events.emit('error', error);
  }
});

// Listen to events elsewhere in your app
events.on('message', (data) => {
  if (data.type === 'message-sent') {
    updateDashboard(data);
  }
});

events.on('error', (error) => {
  logToSentry(error);
});
```

---

## Session Management

### Get Active Sessions

```javascript
// Get all sessions for an API key
const sessions = await gateway.getActiveSessions('api-key-123');

console.log('Active devices:', sessions.length);

sessions.forEach(session => {
  console.log('Session ID:', session.sessionId);
  console.log('Status:', session.status);
  console.log('Ready:', session.ready);
  console.log('Connected at:', new Date(session.connectedAt));
  console.log('Last heartbeat:', new Date(session.lastHeartbeat));
});
```

### Check if API Key Has Active Devices

```javascript
async function hasActiveDevice(apiKey) {
  const sessions = await gateway.getActiveSessions(apiKey);
  return sessions.some(s => s.ready);
}

if (await hasActiveDevice('api-key-123')) {
  console.log('Can send messages');
} else {
  console.log('No active device - please connect extension');
}
```

### Monitor Session Health

```javascript
async function checkSessionHealth(apiKey) {
  const sessions = await gateway.getActiveSessions(apiKey);
  const now = Date.now();
  
  for (const session of sessions) {
    const lastSeen = now - session.lastHeartbeat;
    
    if (lastSeen > 60000) { // More than 1 minute
      console.warn(`Session ${session.sessionId} may be stale (${lastSeen}ms)`);
    }
  }
}

// Check every minute
setInterval(() => checkSessionHealth('api-key-123'), 60000);
```

### Gateway Health Check

```javascript
const health = await gateway.getHealth();

console.log('Server Status:', health.status); // 'running' or 'stopped'
console.log('Active Sessions:', health.activeSessions);
console.log('Uptime:', Math.floor(health.uptime / 1000), 'seconds');
console.log('Checked at:', new Date(health.timestamp));

// Use for monitoring endpoint
app.get('/health', async (req, res) => {
  const health = await gateway.getHealth();
  res.json(health);
});
```

---

## Device Selection Strategies

### Round-Robin (Default)

Distributes messages evenly across all connected devices:

```javascript
const result = await gateway.sendMessage('api-key-123', {
  phoneNumber: '+1234567890',
  message: 'Hello',
  deviceSelectionStrategy: 'round-robin' // Default
});

// If you have 3 devices:
// Message 1 → Device A
// Message 2 → Device B
// Message 3 → Device C
// Message 4 → Device A (cycles back)
```

### Random Selection

Picks a random device for each message:

```javascript
const result = await gateway.sendMessage('api-key-123', {
  phoneNumber: '+1234567890',
  message: 'Hello',
  deviceSelectionStrategy: 'random'
});

// Each message goes to a randomly selected device
```

### Testing Load Distribution

```javascript
async function testDeviceDistribution(apiKey, messageCount) {
  const deviceUsage = {};
  
  for (let i = 0; i < messageCount; i++) {
    const result = await gateway.sendMessage(apiKey, {
      phoneNumber: '+1234567890',
      message: `Test ${i}`,
      deviceSelectionStrategy: 'round-robin'
    });
    
    const device = result.deviceInfo.sessionId;
    deviceUsage[device] = (deviceUsage[device] || 0) + 1;
  }
  
  console.log('Device usage:', deviceUsage);
  // Example output: { 'device-1': 34, 'device-2': 33, 'device-3': 33 }
}

await testDeviceDistribution('api-key-123', 100);
```

---

## Error Handling

### Validation Errors

```javascript
try {
  await gateway.sendMessage('api-key-123', {
    phoneNumber: '1234567890', // Missing '+'
    message: 'Hello'
  });
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    console.error('Invalid input:', error.message);
    console.error('Field:', error.details.field);
    console.error('Value:', error.details.value);
    // Output: Phone number must start with '+'
  }
}
```

### No Active Device

```javascript
try {
  await gateway.sendMessage('api-key-123', {
    phoneNumber: '+1234567890',
    message: 'Hello'
  });
} catch (error) {
  if (error.code === 'NO_ACTIVE_DEVICE') {
    console.error('No device connected');
    
    // Notify user
    await notifyUser(error.details.apiKey, 
      'Please connect your WhatsApp extension'
    );
  }
}
```

### Request Timeout

```javascript
try {
  await gateway.sendMessage('api-key-123', {
    phoneNumber: '+1234567890',
    message: 'Hello',
    timeout: 10000 // 10 seconds
  });
} catch (error) {
  if (error.code === 'REQUEST_TIMEOUT') {
    console.error('Request timed out');
    console.error('Request ID:', error.details.requestId);
    
    // Retry logic
    console.log('Retrying...');
    await gateway.sendMessage('api-key-123', {
      phoneNumber: '+1234567890',
      message: 'Hello',
      timeout: 20000 // Longer timeout
    });
  }
}
```

### Retry Logic with Exponential Backoff

```javascript
async function sendWithRetry(apiKey, data, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await gateway.sendMessage(apiKey, data);
      return result;
      
    } catch (error) {
      lastError = error;
      
      // Don't retry validation errors
      if (error.code === 'VALIDATION_ERROR') {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, i) * 1000;
      console.log(`Retry ${i + 1}/${maxRetries} in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Usage
try {
  const result = await sendWithRetry('api-key-123', {
    phoneNumber: '+1234567890',
    message: 'Important message'
  });
} catch (error) {
  console.error('Failed after retries:', error.message);
}
```

### Global Error Handler

```javascript
const gateway = new WhatsAppGateway({
  onError: (error) => {
    // Log all errors
    logger.error('Gateway Error', {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString()
    });
    
    // Send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error);
    }
    
    // Alert admin for critical errors
    if (error.code === 'SERVER_ERROR') {
      alertAdmin('Critical gateway error', error);
    }
  }
});
```

---

## Express Integration

### Complete REST API Example

```javascript
const express = require('express');
const { WhatsAppGateway } = require('whatsapp-ws-extension-gateway');

const app = express();
app.use(express.json());

const server = require('http').createServer(app);

const gateway = new WhatsAppGateway({
  server: server,
  path: '/wa-ext-ws',
  validateApiKey: async (apiKey) => { /* ... */ },
  onMessageLog: (logData) => { /* ... */ },
  onError: (error) => { /* ... */ }
});

await gateway.start();

// Middleware to validate API key
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  req.apiKey = apiKey;
  next();
}

// Send text message
app.post('/api/send-message', requireApiKey, async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    const result = await gateway.sendMessage(req.apiKey, {
      phoneNumber,
      message
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error.message,
      code: error.code 
    });
  }
});

// Send image
app.post('/api/send-image', requireApiKey, async (req, res) => {
  try {
    const { phoneNumber, dataUrl, caption } = req.body;
    
    const result = await gateway.sendImage(req.apiKey, {
      phoneNumber,
      dataUrl,
      caption
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get active sessions
app.get('/api/sessions', requireApiKey, async (req, res) => {
  try {
    const sessions = await gateway.getActiveSessions(req.apiKey);
    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  const health = await gateway.getHealth();
  res.json(health);
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

---

## TypeScript Usage

### Basic TypeScript Setup

```typescript
import { 
  WhatsAppGateway,
  GatewayConfig,
  SendMessageData,
  SendImageData,
  MessageResult,
  SessionInfo 
} from 'whatsapp-ws-extension-gateway';

const config: GatewayConfig = {
  port: 3000,
  path: '/wa-ext-ws',
  
  validateApiKey: async (apiKey: string) => {
    return { valid: true, userId: 'user-123' };
  },
  
  onMessageLog: (logData) => {
    console.log('Event:', logData.type);
  },
  
  onError: (error) => {
    console.error('Error:', error.code);
  }
};

const gateway = new WhatsAppGateway(config);
await gateway.start();

// Type-safe message sending
const messageData: SendMessageData = {
  phoneNumber: '+1234567890',
  message: 'Hello World!'
};

const result: MessageResult = await gateway.sendMessage('api-key', messageData);
console.log('Message ID:', result.messageId);
```

### Custom Type Extensions

```typescript
import { 
  WhatsAppGateway,
  GatewayConfig,
  MessageLogData 
} from 'whatsapp-ws-extension-gateway';

interface ExtendedMessageLog extends MessageLogData {
  userId?: string;
  customField?: string;
}

interface UserData {
  id: string;
  email: string;
  plan: 'free' | 'premium';
}

const gateway = new WhatsAppGateway({
  validateApiKey: async (apiKey: string): Promise<{ valid: boolean; userId?: string }> => {
    const user: UserData | null = await db.findUser({ apiKey });
    
    if (user) {
      return { valid: true, userId: user.id };
    }
    
    return { valid: false };
  },
  
  onMessageLog: (logData: ExtendedMessageLog) => {
    // TypeScript knows about all properties
    console.log(logData.type, logData.status, logData.phoneNumber);
  }
});
```

---

## Advanced Configuration

### Custom Port and Path

```javascript
const gateway = new WhatsAppGateway({
  port: 8080,
  path: '/custom-ws-path'
});

// Extensions connect to: ws://localhost:8080/custom-ws-path
```

### HTTPS/WSS Support

```javascript
const fs = require('fs');
const https = require('https');

const httpsServer = https.createServer({
  cert: fs.readFileSync('/path/to/cert.pem'),
  key: fs.readFileSync('/path/to/key.pem')
});

const gateway = new WhatsAppGateway({
  server: httpsServer,
  path: '/wa-ext-ws'
});

await gateway.start();

// Extensions connect to: wss://yourdomain.com/wa-ext-ws
```

### Custom Timeouts

```javascript
const gateway = new WhatsAppGateway({
  heartbeatInterval: 45000, // 45 seconds (default: 30s)
  requestTimeout: 60000,    // 60 seconds (default: 30s)
  
  // ... other config
});
```

### Session Limits

```javascript
const gateway = new WhatsAppGateway({
  maxSessionsPerKey: 5, // Max 5 devices per API key (default: 10)
  
  onError: (error) => {
    if (error.code === 'MAX_SESSIONS_EXCEEDED') {
      console.log('User has too many devices connected');
    }
  }
});
```

---

## Production Deployment

### Environment Variables

```javascript
require('dotenv').config();

const gateway = new WhatsAppGateway({
  port: process.env.PORT || 3000,
  path: process.env.WS_PATH || '/wa-ext-ws',
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000,
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000,
  maxSessionsPerKey: parseInt(process.env.MAX_SESSIONS) || 10,
  
  validateApiKey: async (apiKey) => {
    const user = await db.findUser({ apiKey });
    return user ? { valid: true, userId: user.id } : { valid: false };
  }
});
```

### PM2 Process Manager

```json
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'whatsapp-gateway',
    script: './server.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
```

Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  gateway:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DB_URL=mongodb://mongo:27017/myapp
    depends_on:
      - mongo
    restart: unless-stopped
    
  mongo:
    image: mongo:6
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

volumes:
  mongo-data:
```

### Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/gateway
upstream gateway {
  server localhost:3000;
}

server {
  listen 80;
  server_name yourdomain.com;
  
  location /wa-ext-ws {
    proxy_pass http://gateway;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 86400;
  }
  
  location /api {
    proxy_pass http://gateway;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### Monitoring & Logging

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

const gateway = new WhatsAppGateway({
  onMessageLog: (logData) => {
    logger.info('Message event', logData);
  },
  
  onError: (error) => {
    logger.error('Gateway error', {
      code: error.code,
      message: error.message,
      details: error.details
    });
  }
});

// Health check endpoint for monitoring
app.get('/health', async (req, res) => {
  const health = await gateway.getHealth();
  
  if (health.status === 'running') {
    res.status(200).json(health);
  } else {
    res.status(503).json(health);
  }
});
```

---

## Complete Production Example

```javascript
const express = require('express');
const { WhatsAppGateway } = require('whatsapp-ws-extension-gateway');
const winston = require('winston');
const { Pool } = require('pg');
require('dotenv').config();

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

// Database setup
const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Express app
const app = express();
app.use(express.json());
const server = require('http').createServer(app);

// Gateway setup
const gateway = new WhatsAppGateway({
  server: server,
  path: '/wa-ext-ws',
  heartbeatInterval: 30000,
  requestTimeout: 30000,
  maxSessionsPerKey: 10,
  
  validateApiKey: async (apiKey) => {
    try {
      const result = await db.query(
        'SELECT id, email FROM users WHERE api_key = $1 AND active = true',
        [apiKey]
      );
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        logger.info('User authenticated', { userId: user.id });
        return { valid: true, userId: user.id, email: user.email };
      }
      
      logger.warn('Invalid API key attempt', { apiKey: apiKey.substring(0, 8) + '***' });
      return { valid: false };
      
    } catch (error) {
      logger.error('Database error in validateApiKey', { error: error.message });
      return { valid: false };
    }
  },
  
  onMessageLog: async (logData) => {
    logger.info('Message event', { type: logData.type, status: logData.status });
    
    try {
      // Save to database
      await db.query(
        `INSERT INTO message_logs (api_key, type, status, phone_number, request_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          logData.apiKey,
          logData.type,
          logData.status,
          logData.phoneNumber,
          logData.requestId,
          JSON.stringify(logData.details)
        ]
      );
      
      // Update user stats
      if (logData.status === 'success') {
        await db.query(
          'UPDATE users SET messages_sent = messages_sent + 1 WHERE api_key = $1',
          [logData.apiKey]
        );
      }
    } catch (error) {
      logger.error('Failed to log message event', { error: error.message });
    }
  },
  
  onError: (error) => {
    logger.error('Gateway error', {
      code: error.code,
      message: error.message,
      details: error.details
    });
  }
});

// Start gateway
(async () => {
  try {
    await gateway.start();
    logger.info('Gateway started successfully');
  } catch (error) {
    logger.error('Failed to start gateway', { error: error.message });
    process.exit(1);
  }
})();

// REST API Routes
app.post('/api/send-message', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  try {
    const { phoneNumber, message } = req.body;
    
    const result = await gateway.sendMessage(apiKey, {
      phoneNumber,
      message
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

app.get('/health', async (req, res) => {
  const health = await gateway.getHealth();
  res.status(health.status === 'running' ? 200 : 503).json(health);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  await gateway.stop();
  await db.end();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
```

---

## Summary

This guide covers all major use cases:
- ✅ Authentication with various backends
- ✅ WebSocket connection handling
- ✅ Sending all message types
- ✅ Comprehensive callbacks
- ✅ Session management
- ✅ Device selection strategies
- ✅ Error handling and retries
- ✅ Express integration
- ✅ TypeScript support
- ✅ Production deployment

For more examples, see the `examples/` folder in the package.

For testing, see `TESTING.md`.

For API reference, see `README.md`.
