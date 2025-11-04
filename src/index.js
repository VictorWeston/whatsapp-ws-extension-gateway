const WhatsAppGateway = require('./gateway');

/**
 * Error codes used by the gateway
 */
const ERROR_CODES = {
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  NO_ACTIVE_DEVICE: 'NO_ACTIVE_DEVICE',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  CONNECTION_LOST: 'CONNECTION_LOST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  EXTENSION_ERROR: 'EXTENSION_ERROR',
  INVALID_API_KEY: 'INVALID_API_KEY',
  MAX_SESSIONS_EXCEEDED: 'MAX_SESSIONS_EXCEEDED',
  INVALID_PHONE_NUMBER: 'INVALID_PHONE_NUMBER',
  INVALID_DATA: 'INVALID_DATA',
  FETCH_ERROR: 'FETCH_ERROR',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE'
};

/**
 * Message types sent from server to extension
 */
const SERVER_MESSAGE_TYPES = {
  SEND_MESSAGE: 'send-message',
  SEND_IMAGE: 'send-image',
  SEND_VIDEO: 'send-video',
  SEND_DOCUMENT: 'send-document',
  PING: 'ping'
};

/**
 * Message types sent from extension to server
 */
const EXTENSION_MESSAGE_TYPES = {
  AUTH: 'auth',
  STATUS: 'status',
  MESSAGE_RESULT: 'message-result',
  HEARTBEAT: 'heartbeat'
};

module.exports = {
  WhatsAppGateway,
  ERROR_CODES,
  SERVER_MESSAGE_TYPES,
  EXTENSION_MESSAGE_TYPES
};
