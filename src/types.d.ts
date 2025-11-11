import { WebSocket } from 'ws';

/**
 * Configuration options for WhatsAppGateway
 */
export interface GatewayConfig {
  /** Port number for the WebSocket server (default: 3000) */
  port?: number;
  
  /** WebSocket route path (default: '/wa-ext-ws') */
  path?: string;
  
  /** HTTP server instance to attach WebSocket server to (optional) */
  server?: any;
  
  /** Callback to validate API key. Return { valid: true } or { valid: false } */
  validateApiKey: (apiKey: string) => Promise<{ valid: boolean; [key: string]: any }>;
  
  /** Callback for logging message events */
  onMessageLog: (logData: MessageLogData) => void;
  
  /** Callback for error handling */
  onError: (error: GatewayError) => void;
  
  /** Heartbeat interval in milliseconds (default: 30000) */
  heartbeatInterval?: number;
  
  /** Request timeout in milliseconds (default: 30000) */
  requestTimeout?: number;
  
  /** Maximum sessions allowed per API key (default: 10) */
  maxSessionsPerKey?: number;
  
  /** Device selection strategy when multiple devices available (default: 'round-robin') */
  deviceSelectionStrategy?: 'round-robin' | 'random';
}

/**
 * Session data for a connected extension
 */
export interface Session {
  /** Unique session identifier */
  sessionId: string;
  
  /** API key for this session */
  apiKey: string;
  
  /** WebSocket connection instance */
  ws: WebSocket;
  
  /** Client IP address */
  ip: string;
  
  /** Whether WhatsApp is logged in and ready */
  deviceActive: boolean;
  
  /** Timestamp when session was created */
  connectedAt: number;
  
  /** Timestamp of last heartbeat received */
  lastHeartbeat: number;
  
  /** Extension version */
  extensionVersion?: string;
  
  /** Browser information */
  browser?: string;
  
  /** Map of pending requests: requestId -> Promise resolver */
  pendingRequests: Map<string, PendingRequest>;
}

/**
 * Pending request tracking
 */
export interface PendingRequest {
  /** Promise resolve function */
  resolve: (value: MessageResult) => void;
  
  /** Promise reject function */
  reject: (error: Error) => void;
  
  /** Timeout timer ID */
  timeoutId: NodeJS.Timeout;
  
  /** Request creation timestamp */
  createdAt: number;
  
  /** Request type */
  type: string;
}

/**
 * Data for sending a text message
 */
export interface SendMessageData {
  /** Phone number with country code (e.g., +1234567890) */
  phoneNumber: string;
  
  /** Message text (supports multiline) */
  message: string;
}

/**
 * Data for sending an image
 */
export interface SendImageData {
  /** Phone number with country code */
  phoneNumber: string;
  
  /** Image URL (will be converted to dataURL) */
  imageUrl?: string;
  
  /** Image as base64 data URL */
  imageDataUrl?: string;
  
  /** Optional caption for the image */
  caption?: string;
}

/**
 * Data for sending a video
 */
export interface SendVideoData {
  /** Phone number with country code */
  phoneNumber: string;
  
  /** Video URL (will be converted to dataURL, max 10MB) */
  videoUrl?: string;
  
  /** Video as base64 data URL */
  videoDataUrl?: string;
  
  /** Optional caption for the video */
  caption?: string;
}

/**
 * Data for sending a document
 */
export interface SendDocumentData {
  /** Phone number with country code */
  phoneNumber: string;
  
  /** Document URL (will be converted to dataURL, max 10MB) */
  documentUrl?: string;
  
  /** Document as base64 data URL */
  documentDataUrl?: string;
  
  /** Document filename */
  documentName: string;
  
  /** Optional caption for the document */
  caption?: string;
}

/**
 * WebSocket protocol message types from extension to server
 */
export type ExtensionMessageType = 'auth' | 'status' | 'message-result' | 'heartbeat';

/**
 * WebSocket protocol message types from server to extension
 */
export type ServerMessageType = 'send-message' | 'send-image' | 'send-video' | 'send-document' | 'ping';

/**
 * Authentication message from extension
 */
export interface AuthMessage {
  type: 'auth';
  apiKey: string;
  data: {
    extensionVersion: string;
    browser: string;
  };
}

/**
 * Status update message from extension
 */
export interface StatusMessage {
  type: 'status';
  data: {
    whatsappLoggedIn: boolean;
    ready: boolean;
  };
}

/**
 * Message result from extension
 */
export interface MessageResultMessage {
  type: 'message-result';
  requestId: string;
  success: boolean;
  error?: string | null;
  timestamp: number;
}

/**
 * Heartbeat message from extension
 */
export interface HeartbeatMessage {
  type: 'heartbeat';
  timestamp: number;
}

/**
 * Union type for all extension messages
 */
export type ExtensionMessage = AuthMessage | StatusMessage | MessageResultMessage | HeartbeatMessage;

/**
 * Send message command to extension
 */
export interface SendMessageCommand {
  type: 'send-message';
  requestId: string;
  data: {
    phoneNumber: string;
    message: string;
  };
}

/**
 * Send image command to extension
 */
export interface SendImageCommand {
  type: 'send-image';
  requestId: string;
  data: {
    phoneNumber: string;
    imageDataUrl: string;
    caption?: string;
  };
}

/**
 * Send video command to extension
 */
export interface SendVideoCommand {
  type: 'send-video';
  requestId: string;
  data: {
    phoneNumber: string;
    videoDataUrl: string;
    caption?: string;
  };
}

/**
 * Send document command to extension
 */
export interface SendDocumentCommand {
  type: 'send-document';
  requestId: string;
  data: {
    phoneNumber: string;
    documentDataUrl: string;
    documentName: string;
  };
}

/**
 * Ping command to extension
 */
export interface PingCommand {
  type: 'ping';
}

/**
 * Union type for all server commands
 */
export type ServerCommand = SendMessageCommand | SendImageCommand | SendVideoCommand | SendDocumentCommand | PingCommand;

/**
 * Message log data for callback
 */
export interface MessageLogData {
  /** API key used */
  apiKey: string;
  
  /** Session ID that handled the request */
  sessionId: string;
  
  /** Phone number */
  phoneNumber: string;
  
  /** Message type */
  type: 'message' | 'image' | 'video' | 'document';
  
  /** Success or failure */
  status: 'success' | 'failure';
  
  /** Timestamp */
  timestamp: number;
  
  /** Request ID */
  requestId: string;
  
  /** Error message if failed */
  error?: string;
  
  /** Additional metadata */
  metadata?: any;
}

/**
 * Error codes
 */
export type ErrorCode = 
  | 'AUTHENTICATION_FAILED'
  | 'NO_ACTIVE_DEVICE'
  | 'REQUEST_TIMEOUT'
  | 'CONNECTION_LOST'
  | 'VALIDATION_ERROR'
  | 'EXTENSION_ERROR'
  | 'INVALID_API_KEY'
  | 'MAX_SESSIONS_EXCEEDED'
  | 'INVALID_PHONE_NUMBER'
  | 'INVALID_DATA'
  | 'FETCH_ERROR'
  | 'FILE_TOO_LARGE';

/**
 * Gateway error structure
 */
export interface GatewayError extends Error {
  code: ErrorCode;
  details?: any;
}

/**
 * Error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
  };
}

/**
 * Success response format
 */
export interface SuccessResponse {
  success: true;
  data?: any;
}

/**
 * Message result
 */
export interface MessageResult {
  success: boolean;
  requestId: string;
  timestamp: number;
  error?: string;
}

/**
 * Active session info (for getActiveSessions)
 */
export interface ActiveSessionInfo {
  sessionId: string;
  deviceActive: boolean;
  connectedAt: number;
  lastHeartbeat: number;
  extensionVersion?: string;
  browser?: string;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  activeSessions: number;
  uptime: number;
  timestamp: number;
}

/**
 * Main WhatsAppGateway class
 */
export declare class WhatsAppGateway {
  constructor(config: GatewayConfig);
  
  /**
   * Start the WebSocket server
   */
  start(): Promise<void>;
  
  /**
   * Stop the WebSocket server
   */
  stop(): Promise<void>;
  
  /**
   * Send a text message
   */
  sendMessage(apiKey: string, data: SendMessageData): Promise<MessageResult>;
  
  /**
   * Send an image with optional caption
   */
  sendImage(apiKey: string, data: SendImageData): Promise<MessageResult>;
  
  /**
   * Send a video with optional caption
   */
  sendVideo(apiKey: string, data: SendVideoData): Promise<MessageResult>;
  
  /**
   * Send a document/file
   */
  sendDocument(apiKey: string, data: SendDocumentData): Promise<MessageResult>;
  
  /**
   * Get active sessions for an API key
   */
  getActiveSessions(apiKey: string): ActiveSessionInfo[];
  
  /**
   * Get health check information
   */
  getHealth(): HealthCheckResponse;
}
