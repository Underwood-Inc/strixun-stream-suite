/**
 * Error Legend - Composable Error Mapping System
 * 
 * Provides comprehensive error information for API error handling
 * Can be used across all components for consistent error display
 */

export interface ErrorInfo {
  code: string;
  title: string;
  description: string;
  details?: string;
  suggestion?: string;
}

export interface RateLimitDetails {
  reason: string;
  emailLimit?: {
    current: number;
    max: number;
    resetAt: string;
  };
  ipLimit?: {
    current: number;
    max: number;
    resetAt: string;
  };
  quotaLimit?: {
    daily?: {
      current: number;
      max: number;
    };
    monthly?: {
      current: number;
      max: number;
    };
  };
  failedAttempts?: number;
}

/**
 * Error code to error info mapping
 * Covers ALL possible failure scenarios for OTP/login requests
 */
export const ERROR_LEGEND: Record<string, ErrorInfo> = {
  // Rate Limit Errors
  'rate_limit_exceeded': {
    code: 'rate_limit_exceeded',
    title: 'Rate Limit Exceeded',
    description: 'Too many requests from your email address.',
    details: 'You have exceeded the maximum number of OTP requests allowed per hour for this email address.',
    suggestion: 'Please wait before requesting another OTP code.'
  },
  'email_rate_limit_exceeded': {
    code: 'email_rate_limit_exceeded',
    title: 'Email Rate Limit Exceeded',
    description: 'Too many OTP requests from this email address.',
    details: 'You have exceeded the hourly limit for OTP requests from this email. The limit is dynamically adjusted based on your usage patterns.',
    suggestion: 'Wait for the rate limit to reset before requesting another OTP.'
  },
  'ip_rate_limit_exceeded': {
    code: 'ip_rate_limit_exceeded',
    title: 'IP Address Rate Limit Exceeded',
    description: 'Too many requests from your IP address.',
    details: 'Your IP address has exceeded the maximum number of requests allowed per hour. This limit applies to all requests from your network.',
    suggestion: 'Wait for the rate limit to reset, or try from a different network if you need immediate access.'
  },
  'daily_quota_exceeded': {
    code: 'daily_quota_exceeded',
    title: 'Daily Quota Exceeded',
    description: 'You have reached your daily request limit.',
    details: 'Your account has exceeded the maximum number of OTP requests allowed per day. This is a hard limit based on your plan.',
    suggestion: 'Wait until tomorrow, or upgrade your plan for higher limits.'
  },
  'monthly_quota_exceeded': {
    code: 'monthly_quota_exceeded',
    title: 'Monthly Quota Exceeded',
    description: 'You have reached your monthly request limit.',
    details: 'Your account has exceeded the maximum number of OTP requests allowed per month. This is a hard limit based on your plan.',
    suggestion: 'Wait until next month, or upgrade your plan for higher limits.'
  },
  'rate_limit_error': {
    code: 'rate_limit_error',
    title: 'Rate Limit System Error',
    description: 'An error occurred while checking rate limits.',
    details: 'The rate limiting system encountered an error. For security, the request was denied.',
    suggestion: 'Please try again in a few moments. If the problem persists, contact support.'
  },
  
  // Quota Errors
  'customer_not_found': {
    code: 'customer_not_found',
    title: 'Account Not Found',
    description: 'Your customer account could not be found.',
    details: 'The system could not locate your customer account. This may happen if your account was recently created or if there was a system error.',
    suggestion: 'Try signing up again or contact support if the problem persists.'
  },
  'max_users_exceeded': {
    code: 'max_users_exceeded',
    title: 'Maximum Users Exceeded',
    description: 'Your account has reached the maximum number of users.',
    details: 'Your plan has a limit on the number of users that can be created. You have reached this limit.',
    suggestion: 'Upgrade your plan to support more users, or remove inactive users.'
  },
  
  // OTP Verification Errors
  'invalid_otp': {
    code: 'invalid_otp',
    title: 'Invalid OTP Code',
    description: 'The OTP code you entered is incorrect.',
    details: 'The verification code does not match the one sent to your email, or it has expired.',
    suggestion: 'Check your email for the correct code, or request a new one if it has expired.'
  },
  'otp_expired': {
    code: 'otp_expired',
    title: 'OTP Code Expired',
    description: 'The OTP code has expired.',
    details: 'OTP codes are valid for 10 minutes. Your code has expired and can no longer be used.',
    suggestion: 'Request a new OTP code to continue.'
  },
  'otp_already_used': {
    code: 'otp_already_used',
    title: 'OTP Code Already Used',
    description: 'This OTP code has already been used.',
    details: 'Each OTP code can only be used once for security. This code was already used to verify your email.',
    suggestion: 'Request a new OTP code if you need to verify again.'
  },
  'max_attempts_exceeded': {
    code: 'max_attempts_exceeded',
    title: 'Maximum Attempts Exceeded',
    description: 'Too many failed verification attempts.',
    details: 'You have exceeded the maximum number of failed OTP verification attempts (5 attempts). This is a security measure to prevent brute force attacks.',
    suggestion: 'Request a new OTP code to continue.'
  },
  
  // Email Errors
  'email_send_failed': {
    code: 'email_send_failed',
    title: 'Email Send Failed',
    description: 'Failed to send the OTP email.',
    details: 'The system was unable to send the OTP code to your email address. This may be due to an invalid email address or a temporary email service issue.',
    suggestion: 'Verify your email address is correct and try again. If the problem persists, contact support.'
  },
  'invalid_email': {
    code: 'invalid_email',
    title: 'Invalid Email Address',
    description: 'The email address format is invalid.',
    details: 'The email address you provided does not match the required format.',
    suggestion: 'Please enter a valid email address.'
  },
  
  // Authentication Errors
  'authentication_required': {
    code: 'authentication_required',
    title: 'Authentication Required',
    description: 'You must be authenticated to access this resource.',
    details: 'Your session has expired or you are not logged in.',
    suggestion: 'Please log in again to continue.'
  },
  'token_expired': {
    code: 'token_expired',
    title: 'Token Expired',
    description: 'Your authentication token has expired.',
    details: 'JWT tokens are valid for 7 hours. Your token has expired and you need to log in again.',
    suggestion: 'Please log in again to continue.'
  },
  'invalid_token': {
    code: 'invalid_token',
    title: 'Invalid Token',
    description: 'Your authentication token is invalid.',
    details: 'The token provided is malformed or has been revoked.',
    suggestion: 'Please log in again to get a new token.'
  },
  
  // Network/System Errors
  'network_error': {
    code: 'network_error',
    title: 'Network Error',
    description: 'A network error occurred.',
    details: 'The request could not be completed due to a network issue. This may be due to connectivity problems or server unavailability.',
    suggestion: 'Check your internet connection and try again.'
  },
  'server_error': {
    code: 'server_error',
    title: 'Server Error',
    description: 'An internal server error occurred.',
    details: 'The server encountered an unexpected error while processing your request.',
    suggestion: 'Please try again in a few moments. If the problem persists, contact support.'
  },
  'service_unavailable': {
    code: 'service_unavailable',
    title: 'Service Unavailable',
    description: 'The service is temporarily unavailable.',
    details: 'The service is currently undergoing maintenance or is experiencing high load.',
    suggestion: 'Please try again in a few moments.'
  }
};

/**
 * Get error info for a given error code
 */
export function getErrorInfo(code: string): ErrorInfo {
  return ERROR_LEGEND[code] || {
    code,
    title: 'Error',
    description: 'An error occurred.',
    details: 'An unexpected error occurred. Please try again.',
    suggestion: 'If the problem persists, contact support.'
  };
}

/**
 * Format rate limit details for display
 */
export function formatRateLimitDetails(details: RateLimitDetails): string {
  const parts: string[] = [];
  
  if (details.emailLimit) {
    parts.push(`Email: ${details.emailLimit.current}/${details.emailLimit.max} requests per hour`);
  }
  
  if (details.ipLimit) {
    parts.push(`IP: ${details.ipLimit.current}/${details.ipLimit.max} requests per hour`);
  }
  
  if (details.quotaLimit?.daily) {
    parts.push(`Daily: ${details.quotaLimit.daily.current}/${details.quotaLimit.daily.max} requests`);
  }
  
  if (details.quotaLimit?.monthly) {
    parts.push(`Monthly: ${details.quotaLimit.monthly.current}/${details.quotaLimit.monthly.max} requests`);
  }
  
  if (details.failedAttempts !== undefined) {
    parts.push(`Failed attempts: ${details.failedAttempts}/5`);
  }
  
  return parts.join('<br>');
}

/**
 * Generate tooltip content for rate limit errors
 * Includes current error info and legend of all possible rate limit reasons
 */
export function generateRateLimitTooltip(errorInfo: ErrorInfo, details?: RateLimitDetails): string {
  let content = `<div style="margin-bottom: 12px;"><strong style="font-size: 1em; color: #fff;">${errorInfo.title}</strong></div>`;
  content += `<div style="margin-bottom: 12px; color: rgba(255,255,255,0.9);">${errorInfo.description}</div>`;
  
  if (errorInfo.details) {
    content += `<div style="margin-bottom: 12px; color: rgba(255,255,255,0.8); line-height: 1.6;">${errorInfo.details}</div>`;
  }
  
  if (details) {
    const formattedDetails = formatRateLimitDetails(details);
    if (formattedDetails) {
      content += `<div style="margin-top: 16px; margin-bottom: 12px;"><strong style="color: rgba(255,255,255,0.95);">Current Limits:</strong></div>`;
      content += `<div style="margin-bottom: 12px; color: rgba(255,255,255,0.8); line-height: 1.8;">${formattedDetails}</div>`;
    }
  }
  
  if (errorInfo.suggestion) {
    content += `<div style="margin-top: 12px; margin-bottom: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.15);"><em style="color: rgba(255,255,255,0.85); font-style: italic;">${errorInfo.suggestion}</em></div>`;
  }
  
  // Add legend of all possible rate limit error reasons
  content += `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.25);">`;
  content += `<div style="margin-bottom: 12px;"><strong style="color: rgba(255,255,255,0.95); font-size: 0.95em;">Possible Rate Limit Reasons:</strong></div>`;
  content += `<div style="display: flex; flex-direction: column; gap: 8px;">`;
  
  // Get all rate limit related errors
  const rateLimitErrors = [
    'rate_limit_exceeded',
    'email_rate_limit_exceeded',
    'ip_rate_limit_exceeded',
    'daily_quota_exceeded',
    'monthly_quota_exceeded',
    'rate_limit_error'
  ];
  
  rateLimitErrors.forEach((code) => {
    const info = ERROR_LEGEND[code];
    if (info) {
      content += `<div style="padding: 6px 0; line-height: 1.5;">`;
      content += `<span style="color: rgba(255,255,255,0.7); margin-right: 6px;">•</span>`;
      content += `<strong style="color: rgba(255,255,255,0.95);">${info.title}</strong>: `;
      content += `<span style="color: rgba(255,255,255,0.8);">${info.description}</span>`;
      content += `</div>`;
    }
  });
  
  content += `</div></div>`;
  
  return content;
}

/**
 * Generate comprehensive error tooltip with current error and legend of all possible errors
 */
export function generateErrorTooltip(errorInfo: ErrorInfo, details?: RateLimitDetails): string {
  // Start with current error information
  let content = `<strong>${errorInfo.title}</strong><br><br>${errorInfo.description}`;
  
  if (errorInfo.details) {
    content += `<br><br>${errorInfo.details}`;
  }
  
  // Add rate limit details if available
  if (details) {
    const formattedDetails = formatRateLimitDetails(details);
    if (formattedDetails) {
      content += `<br><br><strong>Current Limits:</strong><br>${formattedDetails}`;
    }
  }
  
  if (errorInfo.suggestion) {
    content += `<br><br><em>${errorInfo.suggestion}</em>`;
  }
  
  // Add comprehensive error legend
  content += `<br><br><hr style="margin: 12px 0; border: none; border-top: 1px solid rgba(255,255,255,0.2);">`;
  content += `<strong>All Possible Errors:</strong><br><br>`;
  
  // Group errors by category
  const rateLimitErrors = Object.entries(ERROR_LEGEND).filter(([code]) => 
    code.includes('rate_limit') || code.includes('quota')
  );
  const otpErrors = Object.entries(ERROR_LEGEND).filter(([code]) => 
    code.includes('otp') || code.includes('attempts')
  );
  const emailErrors = Object.entries(ERROR_LEGEND).filter(([code]) => 
    code.includes('email')
  );
  const authErrors = Object.entries(ERROR_LEGEND).filter(([code]) => 
    code.includes('token') || code.includes('authentication')
  );
  const systemErrors = Object.entries(ERROR_LEGEND).filter(([code]) => 
    !rateLimitErrors.some(([c]) => c === code) &&
    !otpErrors.some(([c]) => c === code) &&
    !emailErrors.some(([c]) => c === code) &&
    !authErrors.some(([c]) => c === code)
  );
  
  if (rateLimitErrors.length > 0) {
    content += `<strong>Rate Limit & Quota:</strong><br>`;
    rateLimitErrors.forEach(([code, info]) => {
      content += `• <strong>${info.title}</strong>: ${info.description}<br>`;
    });
    content += `<br>`;
  }
  
  if (otpErrors.length > 0) {
    content += `<strong>OTP Verification:</strong><br>`;
    otpErrors.forEach(([code, info]) => {
      content += `• <strong>${info.title}</strong>: ${info.description}<br>`;
    });
    content += `<br>`;
  }
  
  if (emailErrors.length > 0) {
    content += `<strong>Email Issues:</strong><br>`;
    emailErrors.forEach(([code, info]) => {
      content += `• <strong>${info.title}</strong>: ${info.description}<br>`;
    });
    content += `<br>`;
  }
  
  if (authErrors.length > 0) {
    content += `<strong>Authentication:</strong><br>`;
    authErrors.forEach(([code, info]) => {
      content += `• <strong>${info.title}</strong>: ${info.description}<br>`;
    });
    content += `<br>`;
  }
  
  if (systemErrors.length > 0) {
    content += `<strong>System & Network:</strong><br>`;
    systemErrors.forEach(([code, info]) => {
      content += `• <strong>${info.title}</strong>: ${info.description}<br>`;
    });
  }
  
  return content;
}

