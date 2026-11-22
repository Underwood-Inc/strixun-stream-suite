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
    handleLogout
} from './auth/session.js';

// Encryption key (DEK) handler
export {
    handleGetEncryptionDek
} from './auth/encryption-dek.js';

// Quota handler
export {
    handleGetQuota
} from './auth/quota.js';

// Token introspection (RFC 7662)
export {
    handleIntrospect
} from './auth/introspect.js';

// Cross-TLD session bridge (idling.app → short.army)
export {
    handleIssueSessionBridge,
    handleRedeemSessionBridge,
} from './auth/session-bridge.js';

// Debug handlers
export {
    handleClearRateLimit
} from './auth/debug.js';
