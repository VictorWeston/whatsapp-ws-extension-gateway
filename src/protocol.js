/**
 * Protocol handlers for WebSocket messages between server and extension
 */

/**
 * Parse incoming WebSocket message
 * @param {string} rawMessage - Raw message string
 * @returns {object|null} Parsed message or null if invalid
 */
function parseMessage(rawMessage) {
  try {
    const message = JSON.parse(rawMessage);
    
    if (!message || typeof message !== 'object' || !message.type) {
      return null;
    }

    return message;
  } catch (error) {
    return null;
  }
}

/**
 * Validate authentication message
 * @param {object} message - Parsed message
 * @returns {object} Validation result { valid, error, data }
 */
function validateAuthMessage(message) {
  if (message.type !== 'auth') {
    return { valid: false, error: 'Invalid message type' };
  }

  if (!message.apiKey || typeof message.apiKey !== 'string') {
    return { valid: false, error: 'Missing or invalid apiKey' };
  }

  if (!message.data || typeof message.data !== 'object') {
    return { valid: false, error: 'Missing or invalid data object' };
  }

  return {
    valid: true,
    data: {
      apiKey: message.apiKey,
      extensionVersion: message.data.extensionVersion || 'unknown',
      browser: message.data.browser || 'unknown'
    }
  };
}

/**
 * Validate status message
 * @param {object} message - Parsed message
 * @returns {object} Validation result { valid, error, data }
 */
function validateStatusMessage(message) {
  if (message.type !== 'status') {
    return { valid: false, error: 'Invalid message type' };
  }

  if (!message.data || typeof message.data !== 'object') {
    return { valid: false, error: 'Missing or invalid data object' };
  }

  return {
    valid: true,
    data: {
      whatsappLoggedIn: message.data.whatsappLoggedIn === true,
      ready: message.data.ready === true
    }
  };
}

/**
 * Validate message result
 * @param {object} message - Parsed message
 * @returns {object} Validation result { valid, error, data }
 */
function validateMessageResult(message) {
  if (message.type !== 'message-result') {
    return { valid: false, error: 'Invalid message type' };
  }

  if (!message.requestId || typeof message.requestId !== 'string') {
    return { valid: false, error: 'Missing or invalid requestId' };
  }

  if (typeof message.success !== 'boolean') {
    return { valid: false, error: 'Missing or invalid success field' };
  }

  return {
    valid: true,
    data: {
      requestId: message.requestId,
      success: message.success,
      error: message.error || null,
      timestamp: message.timestamp || Date.now()
    }
  };
}

/**
 * Validate heartbeat message
 * @param {object} message - Parsed message
 * @returns {object} Validation result { valid, error, data }
 */
function validateHeartbeatMessage(message) {
  if (message.type !== 'heartbeat') {
    return { valid: false, error: 'Invalid message type' };
  }

  return {
    valid: true,
    data: {
      timestamp: message.timestamp || Date.now()
    }
  };
}

/**
 * Handle incoming message from extension
 * @param {object} message - Parsed message
 * @returns {object} Handler result { type, valid, error, data }
 */
function handleExtensionMessage(message) {
  const type = message.type;

  switch (type) {
    case 'auth':
      return { type, ...validateAuthMessage(message) };
    
    case 'status':
      return { type, ...validateStatusMessage(message) };
    
    case 'message-result':
      return { type, ...validateMessageResult(message) };
    
    case 'heartbeat':
      return { type, ...validateHeartbeatMessage(message) };
    
    default:
      return { type: 'unknown', valid: false, error: `Unknown message type: ${type}` };
  }
}

/**
 * Create send message command
 * @param {string} requestId - Unique request ID
 * @param {object} data - Message data { phoneNumber, message }
 * @returns {string} JSON string
 */
function createSendMessageCommand(requestId, data) {
  return JSON.stringify({
    type: 'send-message',
    requestId,
    data: {
      phoneNumber: data.phoneNumber,
      message: data.message
    }
  });
}

/**
 * Create send image command
 * @param {string} requestId - Unique request ID
 * @param {object} data - Image data { phoneNumber, imageDataUrl, caption }
 * @returns {string} JSON string
 */
function createSendImageCommand(requestId, data) {
  return JSON.stringify({
    type: 'send-image',
    requestId,
    data: {
      phoneNumber: data.phoneNumber,
      imageDataUrl: data.imageDataUrl,
      caption: data.caption || ''
    }
  });
}

/**
 * Create send video command
 * @param {string} requestId - Unique request ID
 * @param {object} data - Video data { phoneNumber, videoDataUrl, caption }
 * @returns {string} JSON string
 */
function createSendVideoCommand(requestId, data) {
  return JSON.stringify({
    type: 'send-video',
    requestId,
    data: {
      phoneNumber: data.phoneNumber,
      videoDataUrl: data.videoDataUrl,
      caption: data.caption || ''
    }
  });
}

/**
 * Create send document command
 * @param {string} requestId - Unique request ID
 * @param {object} data - Document data { phoneNumber, documentDataUrl, documentName, caption }
 * @returns {string} JSON string
 */
function createSendDocumentCommand(requestId, data) {
  return JSON.stringify({
    type: 'send-document',
    requestId,
    data: {
      phoneNumber: data.phoneNumber,
      documentDataUrl: data.documentDataUrl,
      documentName: data.documentName,
      caption: data.caption || ''
    }
  });
}

/**
 * Create ping command
 * @returns {string} JSON string
 */
function createPingCommand() {
  return JSON.stringify({
    type: 'ping'
  });
}

/**
 * Validate phone number format
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} True if valid
 */
function isValidPhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return false;
  }

  // Basic validation: starts with + and contains only digits
  // Format: +[country code][number]
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
}

/**
 * Validate send message data
 * @param {object} data - Send message data
 * @returns {object} { valid, error }
 */
function validateSendMessageData(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid data object' };
  }

  if (!isValidPhoneNumber(data.phoneNumber)) {
    return { valid: false, error: 'Invalid phone number format. Use international format: +1234567890' };
  }

  if (!data.message || typeof data.message !== 'string' || data.message.trim().length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  return { valid: true };
}

/**
 * Validate send image data
 * @param {object} data - Send image data
 * @returns {object} { valid, error }
 */
function validateSendImageData(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid data object' };
  }

  if (!isValidPhoneNumber(data.phoneNumber)) {
    return { valid: false, error: 'Invalid phone number format. Use international format: +1234567890' };
  }

  if (!data.imageUrl && !data.imageDataUrl) {
    return { valid: false, error: 'Either imageUrl or imageDataUrl is required' };
  }

  if (data.imageDataUrl && !data.imageDataUrl.startsWith('data:image/')) {
    return { valid: false, error: 'Invalid imageDataUrl format. Must start with data:image/' };
  }

  return { valid: true };
}

/**
 * Validate send video data
 * @param {object} data - Send video data
 * @returns {object} { valid, error }
 */
function validateSendVideoData(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid data object' };
  }

  if (!isValidPhoneNumber(data.phoneNumber)) {
    return { valid: false, error: 'Invalid phone number format. Use international format: +1234567890' };
  }

  if (!data.videoUrl && !data.videoDataUrl) {
    return { valid: false, error: 'Either videoUrl or videoDataUrl is required' };
  }

  if (data.videoDataUrl && !data.videoDataUrl.startsWith('data:video/')) {
    return { valid: false, error: 'Invalid videoDataUrl format. Must start with data:video/' };
  }

  return { valid: true };
}

/**
 * Validate send document data
 * @param {object} data - Send document data
 * @returns {object} { valid, error }
 */
function validateSendDocumentData(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid data object' };
  }

  if (!isValidPhoneNumber(data.phoneNumber)) {
    return { valid: false, error: 'Invalid phone number format. Use international format: +1234567890' };
  }

  if (!data.documentUrl && !data.documentDataUrl) {
    return { valid: false, error: 'Either documentUrl or documentDataUrl is required' };
  }

  if (!data.documentName || typeof data.documentName !== 'string') {
    return { valid: false, error: 'documentName is required' };
  }

  return { valid: true };
}

module.exports = {
  parseMessage,
  handleExtensionMessage,
  validateAuthMessage,
  validateStatusMessage,
  validateMessageResult,
  validateHeartbeatMessage,
  createSendMessageCommand,
  createSendImageCommand,
  createSendVideoCommand,
  createSendDocumentCommand,
  createPingCommand,
  isValidPhoneNumber,
  validateSendMessageData,
  validateSendImageData,
  validateSendVideoData,
  validateSendDocumentData
};
