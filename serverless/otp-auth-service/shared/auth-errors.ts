/**
 * Shared Authentication Error Types and Utilities
 * 
 * Provides standardized error types and handling for authentication across all apps.
 */

/**
 * Authentication error types
 */
export enum AuthErrorType {
    /** Network error (connection failed, timeout, etc.) */
    NETWORK_ERROR = 'NETWORK_ERROR',
    /** Auth service returned non-200 status (500, 502, etc.) */
    AUTH_SERVICE_ERROR = 'AUTH_SERVICE_ERROR',
    /** Failed to parse response from auth service */
    PARSE_ERROR = 'PARSE_ERROR',
    /** Auth API URL not configured */
    CONFIG_ERROR = 'CONFIG_ERROR',
    /** Customer API error (non-critical, doesn't block auth) */
    CUSTOMER_API_ERROR = 'CUSTOMER_API_ERROR',
}

/**
 * Standardized authentication error
 */
export class AuthError extends Error {
    constructor(
        public type: AuthErrorType,
        message: string,
        public statusCode?: number,
        public originalError?: Error
    ) {
        super(message);
        this.name = 'AuthError';
    }
}

/**
 * Check if error is an authentication error (not just "not authenticated")
 */
export function isAuthError(error: unknown): error is AuthError {
    return error instanceof AuthError;
}

/**
 * Check if error indicates "not authenticated" (401/403) vs critical error
 */
export function isNotAuthenticatedError(error: unknown): boolean {
    if (error instanceof AuthError) {
        return error.statusCode === 401 || error.statusCode === 403;
    }
    return false;
}

/**
 * Create user-friendly error message from auth error
 */
export function getAuthErrorMessage(error: unknown): string {
    if (error instanceof AuthError) {
        switch (error.type) {
            case AuthErrorType.NETWORK_ERROR:
                return `Connection error: ${error.message}. Please check your internet connection and try again.`;
            case AuthErrorType.AUTH_SERVICE_ERROR:
                return `Authentication service error: ${error.message}. Please try again later or contact support.`;
            case AuthErrorType.CONFIG_ERROR:
                return `Configuration error: ${error.message}. Please contact support.`;
            default:
                return error.message;
        }
    }
    
    if (error instanceof Error) {
        return error.message;
    }
    
    return 'An unknown authentication error occurred. Please try again.';
}
