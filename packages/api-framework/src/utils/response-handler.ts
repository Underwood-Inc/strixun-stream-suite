/**
 * API Framework - Response Handler
 * 
 * Utility for handling and transforming API responses
 */

// Import directly from encryption source to avoid circular dependency
// Do NOT import from encryption/index.js or @strixun/api-framework as it creates cycles
import { decryptWithJWT, decryptBinaryWithJWT } from '../../encryption/jwt-encryption.js';
import type { APIError, APIRequest, APIResponse } from '../types';

/**
 * Get auth token from request metadata or Authorization header
 * The auth middleware stores the token in request.metadata.token and Authorization header
 */
function getTokenForDecryption(request: APIRequest): string | null {
  // First check if token is in request metadata (set by auth middleware or passed explicitly)
  // CRITICAL: Always trim token to ensure it matches the token used for encryption on backend
  if (request.metadata?.token && typeof request.metadata.token === 'string') {
    const metadataToken = request.metadata.token;
    const trimmedMetadataToken = metadataToken.trim();
    const wasTrimmed = metadataToken !== trimmedMetadataToken;
    
    console.log('[ResponseHandler] getTokenForDecryption - Using token from metadata:', {
      requestPath: request.path,
      originalLength: metadataToken.length,
      trimmedLength: trimmedMetadataToken.length,
      wasTrimmed,
      originalPrefix: metadataToken.substring(0, 20) + '...',
      trimmedPrefix: trimmedMetadataToken.substring(0, 20) + '...',
      originalEnd: metadataToken.substring(metadataToken.length - 10),
      trimmedEnd: trimmedMetadataToken.substring(trimmedMetadataToken.length - 10),
    });
    
    return trimmedMetadataToken;
  }
  
  // Fallback: Extract token from Authorization header if present
  // CRITICAL: Trim token to ensure it matches the token used for encryption
  const authHeader = request.headers?.['Authorization'] || request.headers?.['authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const headerToken = authHeader.substring(7);
    const trimmedHeaderToken = headerToken.trim();
    const wasTrimmed = headerToken !== trimmedHeaderToken;
    
    console.log('[ResponseHandler] getTokenForDecryption - Using token from Authorization header:', {
      requestPath: request.path,
      originalLength: headerToken.length,
      trimmedLength: trimmedHeaderToken.length,
      wasTrimmed,
      originalPrefix: headerToken.substring(0, 20) + '...',
      trimmedPrefix: trimmedHeaderToken.substring(0, 20) + '...',
      originalEnd: headerToken.substring(headerToken.length - 10),
      trimmedEnd: trimmedHeaderToken.substring(trimmedHeaderToken.length - 10),
    });
    
    return trimmedHeaderToken;
  }
  
  console.warn('[ResponseHandler] getTokenForDecryption - No token found:', {
    requestPath: request.path,
    hasMetadata: !!request.metadata,
    hasMetadataToken: !!request.metadata?.token,
    hasAuthHeader: !!authHeader,
  });
  
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
          const metadataTokenRaw = request.metadata?.token && typeof request.metadata.token === 'string' ? request.metadata.token : null;
          const authHeaderRaw = request.headers?.['Authorization'] || request.headers?.['authorization'];
          
          console.error('[ResponseHandler] JWT decryption failed - DETAILED DEBUG:', {
            error: errorMessage,
            isTokenMismatch,
            requestPath: request.path,
            // Token used for decryption (after trimming)
            decryptionTokenLength: token?.length || 0,
            decryptionTokenPrefix: token ? token.substring(0, 20) + '...' : 'none',
            decryptionTokenSuffix: token ? '...' + token.substring(token.length - 10) : 'none',
            // Raw metadata token (before trimming)
            hasMetadataToken: !!request.metadata?.token,
            metadataTokenRawLength: metadataTokenRaw?.length || 0,
            metadataTokenRawPrefix: metadataTokenRaw ? metadataTokenRaw.substring(0, 20) + '...' : 'none',
            metadataTokenRawSuffix: metadataTokenRaw ? '...' + metadataTokenRaw.substring(metadataTokenRaw.length - 10) : 'none',
            metadataTokenTrimmed: metadataTokenRaw ? metadataTokenRaw.trim() : null,
            metadataTokenWasTrimmed: metadataTokenRaw ? metadataTokenRaw !== metadataTokenRaw.trim() : false,
            // Raw auth header (before trimming)
            hasAuthHeader: !!authHeaderRaw,
            authHeaderRawPrefix: authHeaderRaw && typeof authHeaderRaw === 'string' ? authHeaderRaw.substring(0, 27) + '...' : 'none',
            authHeaderTokenRaw: authHeaderRaw && typeof authHeaderRaw === 'string' && authHeaderRaw.startsWith('Bearer ') 
              ? authHeaderRaw.substring(7) : null,
            authHeaderTokenRawLength: authHeaderRaw && typeof authHeaderRaw === 'string' && authHeaderRaw.startsWith('Bearer ') 
              ? authHeaderRaw.substring(7).length : 0,
            authHeaderTokenTrimmed: authHeaderRaw && typeof authHeaderRaw === 'string' && authHeaderRaw.startsWith('Bearer ') 
              ? authHeaderRaw.substring(7).trim() : null,
            authHeaderTokenWasTrimmed: authHeaderRaw && typeof authHeaderRaw === 'string' && authHeaderRaw.startsWith('Bearer ') 
              ? authHeaderRaw.substring(7) !== authHeaderRaw.substring(7).trim() : false,
            // Token comparison
            tokensMatch: token && metadataTokenRaw ? token === metadataTokenRaw.trim() : 'N/A',
            tokenFromMetadataMatches: token && metadataTokenRaw ? token === metadataTokenRaw.trim() : 'N/A',
            tokenFromHeaderMatches: token && authHeaderRaw && typeof authHeaderRaw === 'string' && authHeaderRaw.startsWith('Bearer ') 
              ? token === authHeaderRaw.substring(7).trim() : 'N/A',
            // Encrypted data info
            encryptedDataKeys: data && typeof data === 'object' ? Object.keys(data) : null,
            encryptedDataHasTokenHash: data && typeof data === 'object' && 'tokenHash' in data ? !!data.tokenHash : false,
            encryptedDataTokenHash: data && typeof data === 'object' && 'tokenHash' in data ? (data as any).tokenHash : null,
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


