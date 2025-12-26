/**
 * Authentication Handlers
 * Re-exports all auth handlers from sub-modules
 */

// OTP handlers - now split into modular TypeScript files
export {
    handleRequestOTP
} from './auth/request-otp.js';
export {
    handleVerifyOTP
} from './auth/verify-otp.js';

// Session handlers
export {
    handleGetMe,
    handleLogout,
    handleRefresh
} from './auth/session.js';

// Session by IP handler
export {
    handleSessionByIP
} from './auth/session-by-ip.js';

// Quota handler
export {
    handleGetQuota
} from './auth/quota.js';

// Debug handlers
export {
    handleClearRateLimit
} from './auth/debug.js';
