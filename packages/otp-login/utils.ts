/**
 * Utility Functions
 * 
 * Static utility functions for OTP login component
 */

/**
 * Format countdown seconds to MM:SS
 */
export function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format rate limit countdown to human-readable string
 */
export function formatRateLimitCountdown(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (secs > 0) {
      return `${mins} minute${mins !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}`;
    }
    return `${mins} minute${mins !== 1 ? 's' : ''}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const parts: string[] = [];
    if (hours > 0) {
      parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    }
    if (mins > 0) {
      parts.push(`${mins} minute${mins !== 1 ? 's' : ''}`);
    }
    if (secs > 0 && hours === 0) {
      parts.push(`${secs} second${secs !== 1 ? 's' : ''}`);
    }
    return parts.join(' and ');
  }
}

/**
 * Parse error response from server
 */
export function parseErrorResponse(responseText: string | null, status: number, statusText: string): any {
  if (responseText) {
    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      // Response is not valid JSON - create error object from status
      return {
        detail: `Server error (${status}): ${statusText || 'Invalid response format'}`,
        error: `Server error (${status}): ${statusText || 'Invalid response format'}`,
        errorCode: 'invalid_response',
        status: status
      };
    }
  } else {
    // Empty response
    return {
      detail: `Server error (${status}): Empty response from server`,
      error: `Server error (${status}): Empty response from server`,
      errorCode: 'empty_response',
      status: status
    };
  }
}

/**
 * Handle network errors and convert to customer-friendly messages
 */
export function handleNetworkError(err: unknown): string {
  let errorMsg = 'An unexpected error occurred. Please try again.';
  
  if (err instanceof TypeError) {
    // Network errors, CORS errors, etc.
    if (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed to fetch')) {
      errorMsg = 'Network error: Unable to connect to the server. Please check your internet connection and try again.';
    } else if (err.message.includes('CORS')) {
      errorMsg = 'CORS error: Cross-origin request blocked. Please contact support.';
    } else {
      errorMsg = `Network error: ${err.message}`;
    }
  } else if (err instanceof SyntaxError) {
    // JSON parsing errors
    errorMsg = 'Server response error: Invalid response format from server. Please try again.';
  } else if (err instanceof Error) {
    // Other Error instances
    if (err.name === 'AbortError') {
      errorMsg = 'Request timeout: The request took too long. Please try again.';
    } else {
      errorMsg = err.message || 'An unexpected error occurred. Please try again.';
    }
  } else if (typeof err === 'string') {
    errorMsg = err;
  }
  
  return errorMsg;
}

