/**
 * API Framework - Response Handler
 * 
 * Utility for handling and transforming API responses
 */

import { decryptWithJWT } from '../enhanced/encryption/jwt-encryption';
import { decryptBinaryWithJWT } from '@strixun/api-framework';
import type { APIError, APIRequest, APIResponse } from '../types';

/**
 * Get auth token from request metadata or Authorization header
 * The auth middleware stores the token in request.metadata.token and Authorization header
 */
function getTokenForDecryption(request: APIRequest): string | null {
  // First check if token is in request metadata (set by auth middleware or passed explicitly)
  if (request.metadata?.token && typeof request.metadata.token === 'string') {
    return request.metadata.token;
  }
  
  // Fallback: Extract token from Authorization header if present
  const authHeader = request.headers?.['Authorization'] || request.headers?.['authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
  
  return null;
}

/**
 * Parse response and create APIResponse object
 * Automatically decrypts encrypted responses if X-Encrypted header is present
 */
export async function handleResponse<T = unknown>(
  request: APIRequest,
  response: Response
): Promise<APIResponse<T>> {
  let data: T;
  const contentType = response.headers.get('content-type');
  const isEncrypted = response.headers.get('X-Encrypted') === 'true';

  try {
    if (contentType?.includes('application/json')) {
      data = await response.json();
      
      // Decrypt if response is encrypted (check both header and data structure)
      const dataIsEncrypted = data && typeof data === 'object' && 'encrypted' in data && (data as any).encrypted === true;
      const shouldDecrypt = isEncrypted || dataIsEncrypted; // Check both header and data structure
      const token = getTokenForDecryption(request);
      console.log('[ResponseHandler] Checking encryption:', { 
        isEncrypted, 
        dataIsEncrypted,
        shouldDecrypt,
        hasData: !!data, 
        dataKeys: data && typeof data === 'object' ? Object.keys(data) : null,
        hasToken: !!token,
        tokenSource: token ? (request.metadata?.token ? 'metadata' : 'authorization-header') : 'none',
        tokenLength: token?.length || 0
      });
      
      if (shouldDecrypt) {
        // CRITICAL: Extract thumbnailUrls before decryption (they're at top level of encrypted object)
        const thumbnailUrls = (data as any)?.thumbnailUrls;
        
        if (!token) {
          console.error('[ResponseHandler] No token available for decryption:', {
            hasMetadata: !!request.metadata,
            hasMetadataToken: !!request.metadata?.token,
            hasAuthHeader: !!request.headers?.['Authorization'] || !!request.headers?.['authorization'],
            requestPath: request.path
          });
          throw createError(
            request,
            401,
            'Unauthorized',
            'JWT token is required to decrypt response. Please log in to continue.',
            null
          );
        }
        
        try {
          const tokenSource = request.metadata?.token ? 'metadata' : 'authorization-header';
          console.log('[ResponseHandler] Attempting JWT decryption:', {
            tokenSource,
            tokenLength: token?.length || 0,
            tokenPrefix: token ? token.substring(0, 20) + '...' : 'none',
            requestPath: request.path,
            hasMetadataToken: !!request.metadata?.token,
            hasAuthHeader: !!(request.headers?.['Authorization'] || request.headers?.['authorization'])
          });
          data = await decryptWithJWT(data as any, token) as T;
          console.log('[ResponseHandler] Successfully decrypted response with JWT');
        } catch (jwtError) {
          const errorMessage = jwtError instanceof Error ? jwtError.message : String(jwtError);
          // Check for various token mismatch error patterns
          const isTokenMismatch = errorMessage.includes('token does not match') || 
                                  errorMessage.includes('Token mismatch') ||
                                  errorMessage.includes('Decryption failed - token does not match') ||
                                  errorMessage.toLowerCase().includes('token mismatch');
          console.error('[ResponseHandler] JWT decryption failed:', {
            error: errorMessage,
            isTokenMismatch,
            tokenSource: request.metadata?.token ? 'metadata' : 'authorization-header',
            tokenLength: token?.length || 0,
            tokenPrefix: token ? token.substring(0, 20) + '...' : 'none',
            requestPath: request.path,
            hasMetadataToken: !!request.metadata?.token,
            metadataTokenPrefix: request.metadata?.token ? request.metadata.token.substring(0, 20) + '...' : 'none',
            authHeaderPrefix: (request.headers?.['Authorization'] || request.headers?.['authorization']) 
              ? (request.headers['Authorization'] || request.headers['authorization'])?.substring(0, 27) + '...' 
              : 'none'
          });
          
          // For token mismatch errors, provide more helpful error message
          if (isTokenMismatch) {
            throw createError(
              request,
              401,
              'Unauthorized',
              'Token mismatch - the token used for decryption does not match the token used for encryption. This may indicate the token was refreshed or changed. Please try logging in again.',
              jwtError
            );
          }
          
          throw createError(
            request,
            401,
            'Unauthorized',
            'Failed to decrypt response. Please log in to continue.',
            jwtError
          );
        }
        
        // Merge thumbnailUrls back into decrypted data if they were excluded from encryption
        if (thumbnailUrls && typeof thumbnailUrls === 'object' && data && typeof data === 'object') {
          const decryptedData = data as any;
          
          // Handle mod list responses
          if (Array.isArray(decryptedData.mods)) {
            decryptedData.mods.forEach((mod: any, index: number) => {
              const key = `mods.${index}`;
              if (thumbnailUrls[key] && typeof thumbnailUrls[key] === 'string') {
                mod.thumbnailUrl = thumbnailUrls[key];
              }
            });
          }
          
          // Handle single mod responses
          if (decryptedData.mod && thumbnailUrls.mod && typeof thumbnailUrls.mod === 'string') {
            decryptedData.mod.thumbnailUrl = thumbnailUrls.mod;
          }
        }
      }
    } else if (contentType?.includes('text/')) {
      data = (await response.text()) as unknown as T;
    } else {
      // Binary response - check if encrypted
      const binaryData = await response.arrayBuffer();
      
      if (isEncrypted) {
        const token = getTokenForDecryption(request);
        if (!token) {
          throw createError(
            request,
            401,
            'Unauthorized',
            'JWT token is required to decrypt binary response. Please log in to continue.',
            null
          );
        }
        
        try {
          console.log('[ResponseHandler] Decrypting binary response with JWT...');
          const decryptedBinary = await decryptBinaryWithJWT(binaryData, token);
          // Convert Uint8Array back to ArrayBuffer for compatibility
          data = decryptedBinary.buffer.slice(
            decryptedBinary.byteOffset,
            decryptedBinary.byteOffset + decryptedBinary.byteLength
          ) as unknown as T;
          console.log('[ResponseHandler] Successfully decrypted binary response');
        } catch (decryptError) {
          console.error('[ResponseHandler] Binary decryption failed:', decryptError);
          throw createError(
            request,
            401,
            'Unauthorized',
            'Failed to decrypt binary response. Please log in to continue.',
            decryptError
          );
        }
      } else {
        data = binaryData as unknown as T;
      }
    }
  } catch (error) {
    // If error is already an APIError, re-throw it as-is to preserve context
    if (error && typeof error === 'object' && 'name' in error && error.name === 'APIError') {
      throw error;
    }
    throw createError(
      request,
      response.status,
      response.statusText,
      'Failed to parse response',
      error
    );
  }

  const apiResponse: APIResponse<T> = {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    request,
    timestamp: Date.now(),
  };

  return apiResponse;
}

/**
 * Create API error from response
 * Automatically decrypts encrypted error responses if X-Encrypted header is present
 */
export async function handleErrorResponse(
  request: APIRequest,
  response: Response
): Promise<APIError> {
  let errorData: unknown;
  const contentType = response.headers.get('content-type');
  const isEncrypted = response.headers.get('X-Encrypted') === 'true';

  try {
    if (contentType?.includes('application/json')) {
      errorData = await response.json();
      
      const errorIsEncrypted = errorData && typeof errorData === 'object' && 'encrypted' in errorData && (errorData as any).encrypted === true;
      const shouldDecryptError = isEncrypted || errorIsEncrypted;
      if (shouldDecryptError) {
        const token = getTokenForDecryption(request);
        
        if (!token) {
          console.error('[ResponseHandler] Encrypted error response received but no JWT token available for decryption');
        } else {
          try {
            console.log('[ResponseHandler] Decrypting encrypted error response with JWT...');
            errorData = await decryptWithJWT(errorData as any, token);
            console.log('[ResponseHandler] Successfully decrypted error response');
          } catch (jwtError) {
            console.error('[ResponseHandler] JWT decryption failed for error response:', jwtError);
          }
        }
      }
    } else {
      errorData = await response.text();
    }
  } catch {
    errorData = null;
  }

  const error = createError(
    request,
    response.status,
    response.statusText,
    typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as { error: unknown }).error)
      : String(errorData || response.statusText),
    errorData
  );

  // Determine if error is retryable
  error.retryable = isRetryableError(response.status);
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      error.retryAfter = parseInt(retryAfter, 10) * 1000; // Convert to milliseconds
    }
  }

  return error;
}

/**
 * Create API error object
 */
export function createError(
  request: APIRequest,
  status?: number,
  statusText?: string,
  message?: string,
  data?: unknown
): APIError {
  const error = new Error(message || statusText || 'API request failed') as APIError;
  error.status = status;
  error.statusText = statusText;
  error.data = data;
  error.request = request;
  error.name = 'APIError';
  return error;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(status?: number): boolean {
  if (!status) return false;
  
  // Network errors and server errors are retryable
  // Client errors (4xx) are generally not retryable except for specific cases
  return (
    status === 408 || // Request Timeout
    status === 429 || // Too Many Requests
    status === 500 || // Internal Server Error
    status === 502 || // Bad Gateway
    status === 503 || // Service Unavailable
    status === 504    // Gateway Timeout
  );
}

/**
 * Check if response indicates success
 */
export function isSuccessResponse(status: number): boolean {
  return status >= 200 && status < 300;
}

/**
 * Extract error message from error data
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
  }
  return 'Unknown error';
}


