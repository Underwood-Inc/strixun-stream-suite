/**
 * OTP Handlers
 * Handles OTP request and verification
 * 
 * NOTE: This file re-exports from the modular TypeScript files.
 * The actual implementations are in:
 * - request-otp.ts
 * - verify-otp.ts
 * 
 * This file exists for backward compatibility with imports from ./auth/otp.js
 */

export { handleRequestOTP } from './request-otp.js';
export { handleVerifyOTP } from './verify-otp.js';
