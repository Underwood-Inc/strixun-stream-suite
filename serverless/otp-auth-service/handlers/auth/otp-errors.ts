/**
 * OTP Error Handling Utilities
 * 
 * Centralized error handling for OTP operations with detailed error classification
 */

import { getCorsHeaders } from '../../utils/cors.js';

interface Env {
    ENVIRONMENT?: string;
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    [key: string]: any;
}

interface ErrorDetails {
    httpStatusCode: number;
    errorCode: string;
    userMessage: string;
    resendStatusCode?: number | null;
    resendErrorDetails?: string | null;
}

/**
 * Parse Resend API error details from error message
 */
function parseResendError(errorMessage: string): { statusCode: number | null; errorDetails: string | null } {
    let resendStatusCode: number | null = null;
    let resendErrorDetails: string | null = null;
    
    if (errorMessage.includes('Resend API error:')) {
        const statusMatch = errorMessage.match(/Resend API error:\s*(\d+)/);
        if (statusMatch) {
            resendStatusCode = parseInt(statusMatch[1], 10);
        }
        
        const messageMatch = errorMessage.match(/Resend API error:\s*\d+\s*-\s*(.+)/);
        if (messageMatch) {
            resendErrorDetails = messageMatch[1];
        }
    }
    
    return { statusCode: resendStatusCode, errorDetails: resendErrorDetails };
}

/**
 * Classify email sending error and determine appropriate response
 */
export function classifyEmailError(error: any, env: Env): ErrorDetails {
    const isDev = !env.ENVIRONMENT || env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'local';
    const errorMessage = error?.message || 'Unknown error';
    const errorName = error?.name || '';
    
    const { statusCode: resendStatusCode, errorDetails: resendErrorDetails } = parseResendError(errorMessage);
    let httpStatus = resendStatusCode && resendStatusCode >= 400 && resendStatusCode < 600 ? resendStatusCode : 500;
    
    // Check for network errors
    const isNetworkError = errorName === 'TypeError' && (
        errorMessage.includes('fetch') || 
        errorMessage.includes('network') || 
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Network request failed')
    );
    
    // Check for timeout errors
    const isTimeoutError = errorName === 'AbortError' || 
        errorMessage.includes('timeout') || 
        errorMessage.includes('aborted');
    
    // Determine error type
    let userMessage = 'Failed to send email. Please try again later.';
    let errorCode = 'email_send_failed';
    let httpStatusCode = httpStatus;
    
    if (errorMessage.includes('RESEND_API_KEY not configured') || !env.RESEND_API_KEY) {
        userMessage = 'Email service is not configured. Please contact support.';
        errorCode = 'email_service_not_configured';
        httpStatusCode = 500;
    } else if (errorMessage.includes('RESEND_FROM_EMAIL') || !env.RESEND_FROM_EMAIL) {
        userMessage = 'Email service is not configured. Please contact support.';
        errorCode = 'email_service_not_configured';
        httpStatusCode = 500;
    } else if (isNetworkError) {
        userMessage = 'Network error: Unable to connect to email service. Please check your internet connection and try again.';
        errorCode = 'network_error';
        httpStatusCode = 503; // Service Unavailable
    } else if (isTimeoutError) {
        userMessage = 'Request timeout: Email service took too long to respond. Please try again.';
        errorCode = 'timeout_error';
        httpStatusCode = 504; // Gateway Timeout
    } else if (errorMessage.includes('Resend API error')) {
        // Resend API returned an error - provide specific messages based on status code
        if (resendStatusCode === 400) {
            userMessage = 'Invalid email request: The email address or email content is invalid. Please check your email address and try again.';
            errorCode = 'invalid_email_request';
        } else if (resendStatusCode === 401) {
            userMessage = 'Email service authentication failed: The email service API key is invalid or expired. Please contact support.';
            errorCode = 'email_service_auth_failed';
        } else if (resendStatusCode === 403) {
            userMessage = 'Email service access denied: The email service has restricted access. This may be due to an unverified domain or account limitations. Please contact support.';
            errorCode = 'email_service_forbidden';
        } else if (resendStatusCode === 429) {
            userMessage = 'Email service rate limit exceeded: Too many emails sent. Please wait a few minutes and try again.';
            errorCode = 'email_service_rate_limited';
            httpStatusCode = 429;
        } else if (resendStatusCode === 500 || resendStatusCode === 502 || resendStatusCode === 503) {
            userMessage = `Email service error (${resendStatusCode}): The email service is experiencing issues. Please try again in a few moments.`;
            errorCode = 'email_service_error';
            httpStatusCode = 502; // Bad Gateway (upstream service error)
        } else if (resendStatusCode) {
            userMessage = `Email service error (${resendStatusCode}): ${resendErrorDetails || 'An error occurred while sending the email. Please try again.'}`;
            errorCode = 'email_api_error';
            httpStatusCode = resendStatusCode >= 400 && resendStatusCode < 500 ? resendStatusCode : 502;
        } else {
            userMessage = `Email service error: ${resendErrorDetails || 'An error occurred while sending the email. Please try again.'}`;
            errorCode = 'email_api_error';
        }
    } else if (errorMessage.includes('email') && (errorMessage.includes('invalid') || errorMessage.includes('validation'))) {
        userMessage = 'Invalid email address: The email address format is invalid. Please check your email address and try again.';
        errorCode = 'invalid_email';
        httpStatusCode = 400;
    } else if (errorMessage.includes('KV') || errorMessage.includes('storage') || errorMessage.includes('database')) {
        userMessage = 'Storage error: Unable to save OTP code. Please try again.';
        errorCode = 'storage_error';
        httpStatusCode = 500;
    } else {
        userMessage = `Internal server error: ${isDev ? errorMessage : 'An unexpected error occurred while sending the email. Please try again.'}`;
        errorCode = 'internal_error';
        httpStatusCode = 500;
    }
    
    return {
        httpStatusCode,
        errorCode,
        userMessage,
        resendStatusCode,
        resendErrorDetails
    };
}

/**
 * Create email sending error response
 */
export function createEmailErrorResponse(request: Request, error: any, env: Env): Response {
    const errorDetails = classifyEmailError(error, env);
    const isDev = !env.ENVIRONMENT || env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'local';
    
    const errorResponse: any = {
        type: errorDetails.httpStatusCode >= 500 ? 'https://tools.ietf.org/html/rfc7231#section-6.6.1' : 
              errorDetails.httpStatusCode === 429 ? 'https://tools.ietf.org/html/rfc6585#section-4' :
              errorDetails.httpStatusCode === 503 ? 'https://tools.ietf.org/html/rfc7231#section-6.6.4' :
              errorDetails.httpStatusCode === 504 ? 'https://tools.ietf.org/html/rfc7231#section-6.6.5' :
              'https://tools.ietf.org/html/rfc7231#section-6.5.1',
        title: errorDetails.httpStatusCode >= 500 ? 'Internal Server Error' : 
               errorDetails.httpStatusCode === 429 ? 'Too Many Requests' :
               errorDetails.httpStatusCode === 503 ? 'Service Unavailable' :
               errorDetails.httpStatusCode === 504 ? 'Gateway Timeout' :
               'Bad Request',
        status: errorDetails.httpStatusCode,
        detail: errorDetails.userMessage,
        error: errorDetails.userMessage, // Backward compatibility
        errorCode: errorDetails.errorCode,
        instance: request.url,
    };
    
    // Add detailed information in development
    if (isDev) {
        errorResponse.details = error?.message;
        errorResponse.stack = error?.stack;
        errorResponse.name = error?.name;
        if (errorDetails.resendStatusCode) {
            errorResponse.resendStatusCode = errorDetails.resendStatusCode;
        }
        if (errorDetails.resendErrorDetails) {
            errorResponse.resendErrorDetails = errorDetails.resendErrorDetails;
        }
        if (!env.RESEND_API_KEY) {
            errorResponse.hint = 'RESEND_API_KEY is not configured. Set it via: wrangler secret put RESEND_API_KEY';
        } else if (!env.RESEND_FROM_EMAIL) {
            errorResponse.hint = 'RESEND_FROM_EMAIL is not configured. Set it via: wrangler secret put RESEND_FROM_EMAIL';
        }
    }
    
    return new Response(JSON.stringify(errorResponse), {
        status: errorDetails.httpStatusCode,
        headers: { 
            ...getCorsHeaders(env, request), 
            'Content-Type': 'application/problem+json',
        },
    });
}

/**
 * Create generic OTP error response
 */
export function createGenericOTPError(request: Request): Response {
    return new Response(JSON.stringify({
        type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or expired OTP code. Please request a new OTP code.',
        instance: request.url,
    }), {
        status: 401,
        headers: { 
            'Content-Type': 'application/problem+json',
        },
    });
}

/**
 * Create generic internal error response
 */
export function createInternalErrorResponse(request: Request, error: any, env: Env): Response {
    const isDev = !env.ENVIRONMENT || env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'local';
    const errorMessage = error?.message || 'Unknown error';
    const errorName = error?.name || '';
    
    let userMessage = 'Internal server error: An unexpected error occurred while processing your request.';
    let httpStatusCode = 500;
    let errorCode = 'internal_error';
    
    // Check for JSON parsing errors
    if (errorName === 'SyntaxError' && errorMessage.includes('JSON')) {
        userMessage = 'Invalid request: The request data is malformed. Please try again.';
        errorCode = 'invalid_request_format';
        httpStatusCode = 400;
    } else if (errorName === 'TypeError' && errorMessage.includes('fetch')) {
        userMessage = 'Network error: Unable to connect to the server. Please check your internet connection and try again.';
        errorCode = 'network_error';
        httpStatusCode = 503;
    } else if (errorMessage.includes('KV') || errorMessage.includes('storage')) {
        userMessage = 'Storage error: Unable to access data storage. Please try again.';
        errorCode = 'storage_error';
        httpStatusCode = 500;
    } else if (errorMessage.includes('VITE_SERVICE_ENCRYPTION_KEY') || errorMessage.includes('SERVICE_ENCRYPTION_KEY') || errorMessage.includes('decrypt')) {
        // Decryption errors - provide clear feedback
        if (errorMessage.includes('mismatch')) {
            userMessage = 'Encryption key mismatch: Server encryption key does not match client. Please contact support.';
            errorCode = 'encryption_key_mismatch';
            httpStatusCode = 500;
        } else if (errorMessage.includes('not configured')) {
            userMessage = 'Encryption not configured: Server encryption is not properly configured. Please contact support.';
            errorCode = 'encryption_not_configured';
            httpStatusCode = 500;
        } else {
            userMessage = 'Decryption error: Failed to decrypt request. Please try again.';
            errorCode = 'decryption_error';
            httpStatusCode = 400;
        }
    } else if (isDev) {
        userMessage = `Internal server error: ${errorMessage}`;
    }
    
    const errorResponse: any = {
        type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
        title: httpStatusCode >= 500 ? 'Internal Server Error' : 'Bad Request',
        status: httpStatusCode,
        detail: userMessage,
        error: userMessage, // Backward compatibility
        errorCode: errorCode,
        instance: request.url,
    };
    
    // Add detailed information in development
    if (isDev) {
        errorResponse.details = errorMessage;
        errorResponse.stack = error?.stack;
        errorResponse.name = errorName;
    }
    
    return new Response(JSON.stringify(errorResponse), {
        status: httpStatusCode,
        headers: { 
            ...getCorsHeaders(env, request), 
            'Content-Type': 'application/problem+json',
        },
    });
}

