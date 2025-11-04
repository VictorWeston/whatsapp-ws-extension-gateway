/**
 * Express Middleware Example
 * 
 * This example shows how to integrate WhatsApp Gateway with an existing Express app.
 * The WebSocket server shares the same HTTP server as Express.
 */

const express = require('express');
const { WhatsAppGateway } = require('../src/index');

const app = express();
app.use(express.json());

// In-memory API keys
const validApiKeys = new Map([
  ['test-api-key-123', { userId: 'user-1', name: 'Test User' }],
  ['demo-api-key-456', { userId: 'user-2', name: 'Demo User' }]
]);

// Create HTTP server
const server = require('http').createServer(app);

// Create gateway with existing server
const gateway = new WhatsAppGateway({
  server: server,  // Attach to existing Express server
  path: '/wa-ext-ws',
  
  validateApiKey: async (apiKey) => {
    const user = validApiKeys.get(apiKey);
    if (user) {
      return { valid: true, ...user };
    }
    return { valid: false };
  },
  
  onMessageLog: (logData) => {
    console.log('[MESSAGE]', logData.status, logData.type, logData.phoneNumber);
  },
  
  onError: (error) => {
    console.error('[ERROR]', error.code, error.message);
  }
});

// REST API Routes

/**
 * Send a text message
 * POST /api/send-message
 * Headers: X-API-Key: your-api-key
 * Body: { phoneNumber, message }
 */
app.post('/api/send-message', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const { phoneNumber, message } = req.body;
    
    const result = await gateway.sendMessage(apiKey, {
      phoneNumber,
      message
    });

    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: {
        code: error.code,
        message: error.message
      }
    });
  }
});

/**
 * Send an image
 * POST /api/send-image
 * Headers: X-API-Key: your-api-key
 * Body: { phoneNumber, imageUrl, caption }
 */
app.post('/api/send-image', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const { phoneNumber, imageUrl, caption } = req.body;
    
    const result = await gateway.sendImage(apiKey, {
      phoneNumber,
      imageUrl,
      caption
    });

    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: {
        code: error.code,
        message: error.message
      }
    });
  }
});

/**
 * Send a video
 * POST /api/send-video
 * Headers: X-API-Key: your-api-key
 * Body: { phoneNumber, videoUrl, caption }
 */
app.post('/api/send-video', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const { phoneNumber, videoUrl, caption } = req.body;
    
    const result = await gateway.sendVideo(apiKey, {
      phoneNumber,
      videoUrl,
      caption
    });

    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: {
        code: error.code,
        message: error.message
      }
    });
  }
});

/**
 * Send a document
 * POST /api/send-document
 * Headers: X-API-Key: your-api-key
 * Body: { phoneNumber, documentUrl, documentName }
 */
app.post('/api/send-document', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const { phoneNumber, documentUrl, documentName } = req.body;
    
    const result = await gateway.sendDocument(apiKey, {
      phoneNumber,
      documentUrl,
      documentName
    });

    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: {
        code: error.code,
        message: error.message
      }
    });
  }
});

/**
 * Get active sessions for the API key
 * GET /api/sessions
 * Headers: X-API-Key: your-api-key
 */
app.get('/api/sessions', (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const sessions = gateway.getActiveSessions(apiKey);
    res.json({ success: true, sessions });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error.message
    });
  }
});

/**
 * Health check endpoint
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  const health = gateway.getHealth();
  res.json(health);
});

/**
 * Home page
 */
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>WhatsApp Gateway API</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          h1 { color: #25D366; }
          .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
          code { background: #e0e0e0; padding: 2px 5px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>📱 WhatsApp Gateway API</h1>
        <p>WebSocket endpoint: <code>ws://localhost:3000/wa-ext-ws</code></p>
        
        <h2>REST API Endpoints</h2>
        
        <div class="endpoint">
          <strong>POST /api/send-message</strong><br>
          Send a text message<br>
          Headers: <code>X-API-Key: your-api-key</code><br>
          Body: <code>{ "phoneNumber": "+1234567890", "message": "Hello" }</code>
        </div>
        
        <div class="endpoint">
          <strong>POST /api/send-image</strong><br>
          Send an image<br>
          Headers: <code>X-API-Key: your-api-key</code><br>
          Body: <code>{ "phoneNumber": "+1234567890", "imageUrl": "https://...", "caption": "..." }</code>
        </div>
        
        <div class="endpoint">
          <strong>POST /api/send-video</strong><br>
          Send a video<br>
          Headers: <code>X-API-Key: your-api-key</code><br>
          Body: <code>{ "phoneNumber": "+1234567890", "videoUrl": "https://...", "caption": "..." }</code>
        </div>
        
        <div class="endpoint">
          <strong>POST /api/send-document</strong><br>
          Send a document<br>
          Headers: <code>X-API-Key: your-api-key</code><br>
          Body: <code>{ "phoneNumber": "+1234567890", "documentUrl": "https://...", "documentName": "file.pdf" }</code>
        </div>
        
        <div class="endpoint">
          <strong>GET /api/sessions</strong><br>
          Get active sessions<br>
          Headers: <code>X-API-Key: your-api-key</code>
        </div>
        
        <div class="endpoint">
          <strong>GET /api/health</strong><br>
          Health check
        </div>
      </body>
    </html>
  `);
});

// Start servers
async function start() {
  try {
    // Start gateway
    await gateway.start();
    
    // Start Express server
    const PORT = 3000;
    server.listen(PORT, () => {
      console.log('✅ Server started successfully!');
      console.log(`📡 HTTP API: http://localhost:${PORT}`);
      console.log(`📡 WebSocket: ws://localhost:${PORT}/wa-ext-ws`);
      console.log('');
      console.log('API Keys:');
      validApiKeys.forEach((user, key) => {
        console.log(`  - ${key} (${user.name})`);
      });
    });
  } catch (error) {
    console.error('❌ Failed to start:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await gateway.stop();
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

start();
