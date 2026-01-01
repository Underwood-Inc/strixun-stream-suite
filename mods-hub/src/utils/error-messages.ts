/**
 * Error message utilities
 * Converts technical API errors into user-friendly messages
 */

import type { APIError } from '@strixun/api-framework';

/**
 * Check if error is an authentication/authorization error
 */
export function isAuthError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const apiError = error as APIError;
    const status = apiError.status;
    const message = apiError.message || '';
    
    // Check status code
    if (status === 401 || status === 403) {
      return true;
    }
    
    // Check error message for JWT/auth keywords
    const authKeywords = [
      'jwt',
      'token',
      'authentication',
      'authorization',
      'unauthorized',
      'login',
      'decrypt',
      'encrypted',
    ];
    
    const lowerMessage = message.toLowerCase();
    return authKeywords.some(keyword => lowerMessage.includes(keyword));
  }
  
  return false;
}

/**
 * Convert error to user-friendly message
 * Handles authentication errors specially
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (!error) {
    return 'An unexpected error occurred';
  }
  
  // Handle APIError objects
  if (error && typeof error === 'object' && 'status' in error) {
    const apiError = error as APIError;
    const status = apiError.status;
    const message = apiError.message || '';
    
    // Authentication errors - prompt to log in
    if (status === 401 || isAuthError(error)) {
      return 'Please log in to continue';
    }
    
    // Forbidden errors
    if (status === 403) {
      return 'You do not have permission to perform this action';
    }
    
    // JWT/encryption errors - prompt to log in
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('jwt') || 
        lowerMessage.includes('token') || 
        lowerMessage.includes('decrypt') ||
        lowerMessage.includes('encrypted')) {
      return 'Please log in to continue';
    }
    
    // Other 4xx errors - show message if it's user-friendly, otherwise generic
    if (status >= 400 && status < 500) {
      // If message looks technical, provide generic message
      if (message.includes('Failed to decrypt') || 
          message.includes('JWT token is required') ||
          message.includes('encryption')) {
        return 'Please log in to continue';
      }
      return message || 'Invalid request';
    }
    
    // 5xx errors
    if (status >= 500) {
      return 'Server error. Please try again later';
    }
  }
  
  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message;
    
    // Check for auth-related messages
    if (isAuthError(error)) {
      return 'Please log in to continue';
    }
    
    // Return message if it's user-friendly, otherwise generic
    if (message && !message.includes('Failed to decrypt') && !message.includes('JWT token')) {
      return message;
    }
    
    return 'An error occurred. Please try again';
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    if (isAuthError({ message: error } as APIError)) {
      return 'Please log in to continue';
    }
    return error;
  }
  
  return 'An unexpected error occurred';
}

/**
 * Check if error should trigger login redirect
 */
export function shouldRedirectToLogin(error: unknown): boolean {
  if (!error) return false;
  
  if (error && typeof error === 'object' && 'status' in error) {
    const apiError = error as APIError;
    return apiError.status === 401 || isAuthError(error);
  }
  
  if (error instanceof Error) {
    return isAuthError(error);
  }
  
  return false;
}
