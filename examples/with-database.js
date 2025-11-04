/**
 * Database Integration Example
 * 
 * This example shows how to integrate WhatsApp Gateway with a database
 * for API key validation and message logging.
 * 
 * Note: This example uses a mock database for demonstration.
 * In production, replace with your actual database (MongoDB, PostgreSQL, etc.)
 */

const { WhatsAppGateway } = require('../src/index');

// Mock Database (replace with real database in production)
class MockDatabase {
  constructor() {
    this.apiKeys = new Map([
      ['sk_live_abc123xyz789', { 
        id: '1', 
        userId: 'user-123', 
        name: 'Production App',
        isActive: true,
        createdAt: new Date()
      }],
      ['sk_test_def456uvw012', { 
        id: '2', 
        userId: 'user-456', 
        name: 'Test App',
        isActive: true,
        createdAt: new Date()
      }]
    ]);
    
    this.messageLogs = [];
    this.errorLogs = [];
  }

  // Find API key
  async findApiKey(apiKey) {
    // Simulate database query
    await this.sleep(10);
    return this.apiKeys.get(apiKey);
  }

  // Log message
  async logMessage(logData) {
    // Simulate database insert
    await this.sleep(5);
    
    const log = {
      id: this.messageLogs.length + 1,
      ...logData,
      createdAt: new Date()
    };
    
    this.messageLogs.push(log);
    console.log(`[DB] Message log saved: ${log.id}`);
    return log;
  }

  // Log error
  async logError(errorData) {
    // Simulate database insert
    await this.sleep(5);
    
    const log = {
      id: this.errorLogs.length + 1,
      ...errorData,
      createdAt: new Date()
    };
    
    this.errorLogs.push(log);
    console.log(`[DB] Error log saved: ${log.id}`);
    return log;
  }

  // Get message logs for user
  async getMessageLogs(userId, limit = 10) {
    await this.sleep(10);
    return this.messageLogs
      .filter(log => log.userId === userId)
      .slice(-limit);
  }

  // Update API key usage
  async updateApiKeyUsage(apiKey) {
    await this.sleep(5);
    const key = this.apiKeys.get(apiKey);
    if (key) {
      key.lastUsedAt = new Date();
      key.usageCount = (key.usageCount || 0) + 1;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize database
const db = new MockDatabase();

// Create gateway with database integration
const gateway = new WhatsAppGateway({
  port: 3000,
  path: '/wa-ext-ws',
  
  // Validate API key from database
  validateApiKey: async (apiKey) => {
    try {
      console.log(`[AUTH] Checking API key in database...`);
      
      const keyData = await db.findApiKey(apiKey);
      
      if (!keyData) {
        console.log(`[AUTH] API key not found`);
        return { valid: false };
      }

      if (!keyData.isActive) {
        console.log(`[AUTH] API key is inactive`);
        return { valid: false };
      }

      console.log(`[AUTH] API key validated for user: ${keyData.userId}`);
      
      // Update usage statistics
      await db.updateApiKeyUsage(apiKey);

      return { 
        valid: true, 
        userId: keyData.userId,
        keyId: keyData.id,
        name: keyData.name
      };
    } catch (error) {
      console.error(`[AUTH] Database error:`, error.message);
      return { valid: false };
    }
  },
  
  // Log messages to database
  onMessageLog: async (logData) => {
    try {
      // Get user ID from API key
      const keyData = await db.findApiKey(logData.apiKey);
      
      await db.logMessage({
        userId: keyData?.userId,
        apiKey: logData.apiKey,
        sessionId: logData.sessionId,
        phoneNumber: logData.phoneNumber,
        type: logData.type,
        status: logData.status,
        requestId: logData.requestId,
        error: logData.error,
        timestamp: logData.timestamp
      });
      
      console.log(`[LOG] Message logged: ${logData.status} - ${logData.type}`);
    } catch (error) {
      console.error(`[LOG] Failed to log message:`, error.message);
    }
  },
  
  // Log errors to database
  onError: async (error) => {
    try {
      await db.logError({
        code: error.code,
        message: error.message,
        details: JSON.stringify(error.details || {}),
        stack: error.stack
      });
      
      console.error(`[ERROR] ${error.code}: ${error.message}`);
    } catch (err) {
      console.error(`[ERROR] Failed to log error:`, err.message);
    }
  },
  
  heartbeatInterval: 30000,
  requestTimeout: 30000,
  maxSessionsPerKey: 5
});

// Example: Send messages programmatically
async function sendTestMessages() {
  console.log('\n=== Sending Test Messages ===\n');

  try {
    // Send text message
    console.log('1. Sending text message...');
    const result1 = await gateway.sendMessage('sk_live_abc123xyz789', {
      phoneNumber: '+1234567890',
      message: 'Hello from Database-integrated Gateway!'
    });
    console.log('✅ Text message sent:', result1);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send image
    console.log('\n2. Sending image...');
    const result2 = await gateway.sendImage('sk_live_abc123xyz789', {
      phoneNumber: '+1234567890',
      imageUrl: 'https://example.com/image.jpg',
      caption: 'Check out this image!'
    });
    console.log('✅ Image sent:', result2);

    // Show message logs
    console.log('\n=== Recent Message Logs ===');
    const logs = await db.getMessageLogs('user-123', 5);
    logs.forEach(log => {
      console.log(`${log.id}. [${log.status}] ${log.type} to ${log.phoneNumber}`);
    });

  } catch (error) {
    console.error('❌ Error sending messages:', error.message);
  }
}

// Start gateway
async function start() {
  try {
    await gateway.start();
    
    console.log('✅ WhatsApp Gateway started with database integration!');
    console.log('📡 WebSocket: ws://localhost:3000/wa-ext-ws');
    console.log('');
    console.log('Valid API keys:');
    db.apiKeys.forEach((data, key) => {
      console.log(`  - ${key} (${data.name})`);
    });
    console.log('');

    // Send test messages after 5 seconds
    setTimeout(sendTestMessages, 5000);

    // Periodic health check
    setInterval(async () => {
      const health = gateway.getHealth();
      console.log('\n=== Health Check ===');
      console.log(`Status: ${health.status}`);
      console.log(`Active Sessions: ${health.activeSessions}`);
      console.log(`Total Message Logs: ${db.messageLogs.length}`);
      console.log(`Total Error Logs: ${db.errorLogs.length}`);
    }, 60000);

  } catch (error) {
    console.error('❌ Failed to start:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  
  // Show final statistics
  console.log('\n=== Final Statistics ===');
  console.log(`Total messages: ${db.messageLogs.length}`);
  console.log(`Total errors: ${db.errorLogs.length}`);
  
  await gateway.stop();
  console.log('✅ Gateway stopped');
  process.exit(0);
});

start();

/**
 * PRODUCTION DATABASE INTEGRATION EXAMPLES
 * 
 * MongoDB Example:
 * ------------------
 * const { MongoClient } = require('mongodb');
 * const client = new MongoClient(process.env.MONGODB_URI);
 * 
 * validateApiKey: async (apiKey) => {
 *   const db = client.db('whatsapp-gateway');
 *   const apiKeyDoc = await db.collection('api_keys').findOne({ 
 *     key: apiKey, 
 *     isActive: true 
 *   });
 *   return apiKeyDoc ? { valid: true, userId: apiKeyDoc.userId } : { valid: false };
 * }
 * 
 * 
 * PostgreSQL Example:
 * -------------------
 * const { Pool } = require('pg');
 * const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 * 
 * validateApiKey: async (apiKey) => {
 *   const result = await pool.query(
 *     'SELECT user_id FROM api_keys WHERE key = $1 AND is_active = true',
 *     [apiKey]
 *   );
 *   return result.rows.length > 0 
 *     ? { valid: true, userId: result.rows[0].user_id }
 *     : { valid: false };
 * }
 */
