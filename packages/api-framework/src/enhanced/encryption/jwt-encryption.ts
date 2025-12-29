/**
 * Enhanced API Framework - JWT-Based E2E Encryption
 * 
 * Re-exports shared encryption suite for use in API framework
 * All encryption logic is now in serverless/shared/encryption/
 */

// Import from encryption package (now part of api-framework)
export {
  encryptWithJWT,
  decryptWithJWT,
} from '../../../encryption/index.js';

import type { E2EEncryptionConfig } from '../types';
import type { APIRequest, APIResponse } from '../../types';

/**
 * E2E Encryption Middleware
 * 
 * Automatically encrypts responses if JWT token is present
 * Uses shared encryption suite from serverless/shared/encryption/
 */
export function createE2EEncryptionMiddleware(
  config: E2EEncryptionConfig
) {
  return async (
    request: APIRequest,
    next: (request: APIRequest) => Promise<APIResponse>
  ): Promise<APIResponse> => {
    if (!config.enabled) {
      return await next(request);
    }

    // Get JWT token
    const token = await config.tokenGetter();
    if (!token) {
      // No token, proceed without encryption
      return await next(request);
    }

    // Execute request
    const response = await next(request);

    // Check if we should encrypt
    const shouldEncrypt = config.encryptCondition
      ? config.encryptCondition(request, response)
      : true;

    if (!shouldEncrypt || response.status >= 400) {
      return response;
    }

    try {
      // Parse response data
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        // Not JSON, don't encrypt
        return response;
      }

      const data = response.data;

      // Encrypt data using shared encryption suite via workspace package
      const { encryptWithJWT } = await import('@strixun/api-framework');
      const encrypted = await encryptWithJWT(data, token);

      // Create new response with encrypted data
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/json');
      headers.set('X-Encrypted', 'true'); // Flag to indicate encrypted response

      return {
        ...response,
        data: encrypted,
        headers,
      };
    } catch (error) {
      console.error('E2E encryption failed:', error);
      // Return unencrypted response if encryption fails
      return response;
    }
  };
}

