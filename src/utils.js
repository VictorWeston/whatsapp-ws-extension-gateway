const { v4: uuidv4 } = require('uuid');
const https = require('https');
const http = require('http');

/**
 * Generate a unique request ID
 * @returns {string} UUID v4
 */
function generateRequestId() {
  return uuidv4();
}

/**
 * Create a promise that times out
 * @param {Promise} promise - Original promise
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} errorMessage - Error message for timeout
 * @returns {Promise} Promise that rejects on timeout
 */
function promiseWithTimeout(promise, timeout, errorMessage = 'Operation timed out') {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`REQUEST_TIMEOUT: ${errorMessage}`));
    }, timeout);

    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Format error as standard error response
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {any} details - Additional error details
 * @returns {object} Formatted error object
 */
function formatError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Create error response object
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {any} details - Additional error details
 * @returns {object} Error response
 */
function createErrorResponse(code, message, details = null) {
  return {
    success: false,
    error: {
      code,
      message,
      details
    }
  };
}

/**
 * Fetch URL and convert to base64 data URL
 * @param {string} url - URL to fetch
 * @param {string} mimeType - MIME type (e.g., 'image/png', 'video/mp4')
 * @param {number} maxSize - Maximum file size in bytes (default: 10MB)
 * @returns {Promise<string>} Base64 data URL
 */
async function urlToDataUrl(url, mimeType, maxSize = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      // Check response status
      if (response.statusCode !== 200) {
        reject(formatError(
          'FETCH_ERROR',
          `Failed to fetch URL: ${response.statusCode} ${response.statusMessage}`,
          { url, statusCode: response.statusCode }
        ));
        return;
      }

      const chunks = [];
      let totalSize = 0;

      response.on('data', (chunk) => {
        totalSize += chunk.length;
        
        // Check size limit
        if (totalSize > maxSize) {
          response.destroy();
          reject(formatError(
            'FILE_TOO_LARGE',
            `File exceeds maximum size of ${maxSize / 1024 / 1024}MB`,
            { url, maxSize, currentSize: totalSize }
          ));
          return;
        }

        chunks.push(chunk);
      });

      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;
        resolve(dataUrl);
      });

      response.on('error', (error) => {
        reject(formatError(
          'FETCH_ERROR',
          `Error fetching URL: ${error.message}`,
          { url, originalError: error.message }
        ));
      });
    }).on('error', (error) => {
      reject(formatError(
        'FETCH_ERROR',
        `Error fetching URL: ${error.message}`,
        { url, originalError: error.message }
      ));
    });
  });
}

/**
 * Convert image URL to data URL
 * @param {string} url - Image URL
 * @returns {Promise<string>} Image data URL
 */
async function imageUrlToDataUrl(url) {
  // Detect MIME type from URL extension
  let mimeType = 'image/jpeg'; // default
  
  if (url.match(/\.png$/i)) {
    mimeType = 'image/png';
  } else if (url.match(/\.gif$/i)) {
    mimeType = 'image/gif';
  } else if (url.match(/\.webp$/i)) {
    mimeType = 'image/webp';
  } else if (url.match(/\.svg$/i)) {
    mimeType = 'image/svg+xml';
  }

  return urlToDataUrl(url, mimeType);
}

/**
 * Convert video URL to data URL
 * @param {string} url - Video URL
 * @returns {Promise<string>} Video data URL
 */
async function videoUrlToDataUrl(url) {
  // Detect MIME type from URL extension
  let mimeType = 'video/mp4'; // default
  
  if (url.match(/\.webm$/i)) {
    mimeType = 'video/webm';
  } else if (url.match(/\.ogg$/i)) {
    mimeType = 'video/ogg';
  } else if (url.match(/\.mov$/i)) {
    mimeType = 'video/quicktime';
  }

  return urlToDataUrl(url, mimeType);
}

/**
 * Convert document URL to data URL
 * @param {string} url - Document URL
 * @returns {Promise<string>} Document data URL
 */
async function documentUrlToDataUrl(url) {
  // Detect MIME type from URL extension
  let mimeType = 'application/octet-stream'; // default
  
  if (url.match(/\.pdf$/i)) {
    mimeType = 'application/pdf';
  } else if (url.match(/\.doc$/i)) {
    mimeType = 'application/msword';
  } else if (url.match(/\.docx$/i)) {
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (url.match(/\.xls$/i)) {
    mimeType = 'application/vnd.ms-excel';
  } else if (url.match(/\.xlsx$/i)) {
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else if (url.match(/\.txt$/i)) {
    mimeType = 'text/plain';
  } else if (url.match(/\.zip$/i)) {
    mimeType = 'application/zip';
  }

  return urlToDataUrl(url, mimeType);
}

/**
 * Get client IP address from WebSocket request
 * @param {object} request - HTTP request object
 * @returns {string} IP address
 */
function getClientIp(request) {
  // Check X-Forwarded-For header (for proxies)
  const forwardedFor = request.headers['x-forwarded-for'];
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Check X-Real-IP header
  const realIp = request.headers['x-real-ip'];
  if (realIp) {
    return realIp;
  }

  // Fall back to socket remote address
  return request.socket.remoteAddress || 'unknown';
}

/**
 * Sanitize API key for logging (show only first 8 chars)
 * @param {string} apiKey - API key
 * @returns {string} Sanitized API key
 */
function sanitizeApiKey(apiKey) {
  if (!apiKey || apiKey.length < 8) {
    return '***';
  }
  return apiKey.substring(0, 8) + '***';
}

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate data URL format
 * @param {string} dataUrl - Data URL to validate
 * @param {string} expectedType - Expected type prefix (e.g., 'image/', 'video/')
 * @returns {boolean} True if valid
 */
function isValidDataUrl(dataUrl, expectedType) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return false;
  }

  if (!dataUrl.startsWith(`data:${expectedType}`)) {
    return false;
  }

  return dataUrl.includes('base64,');
}

/**
 * Extract MIME type from data URL
 * @param {string} dataUrl - Data URL
 * @returns {string|null} MIME type or null
 */
function getMimeTypeFromDataUrl(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return null;
  }

  const match = dataUrl.match(/^data:([^;]+);/);
  return match ? match[1] : null;
}

/**
 * Get file extension from MIME type
 * @param {string} mimeType - MIME type
 * @returns {string} File extension with dot
 */
function getExtensionFromMimeType(mimeType) {
  const mimeMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/plain': '.txt',
    'application/zip': '.zip'
  };

  return mimeMap[mimeType] || '';
}

module.exports = {
  generateRequestId,
  promiseWithTimeout,
  formatError,
  createErrorResponse,
  urlToDataUrl,
  imageUrlToDataUrl,
  videoUrlToDataUrl,
  documentUrlToDataUrl,
  getClientIp,
  sanitizeApiKey,
  deepClone,
  sleep,
  isValidDataUrl,
  getMimeTypeFromDataUrl,
  getExtensionFromMimeType
};
