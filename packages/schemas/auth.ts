/**
 * OTP Auth Service Validation Schemas
 * 
 * Authentication-related data validation using Valibot
 * CRITICAL: OTP Auth should NOT contain customer data (displayName, preferences)
 */

import * as v from 'valibot';

/**
 * Customer session data (stored in OTP_AUTH_KV)
 * CRITICAL: This is authentication session data ONLY
 * NO customer data (displayName, preferences, etc.)
 */
export const CustomerSessionSchema = v.object({
  customerId: v.pipe(v.string(), v.minLength(1)), // Primary identifier
  email: v.pipe(v.string(), v.email()), // For OTP auth only
  createdAt: v.optional(v.string()), // ISO 8601
  lastLogin: v.optional(v.string()), // ISO 8601
  // NO displayName - that belongs in CUSTOMER_KV
  // NO preferences - those belong in CUSTOMER_KV
});

/**
 * OTP token data (temporary, stored in OTP_AUTH_KV)
 */
export const OTPTokenSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  code: v.pipe(v.string(), v.length(6)), // 6-digit code
  attempts: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(5)),
  createdAt: v.string(), // ISO 8601
  expiresAt: v.string(), // ISO 8601
  customerId: v.optional(v.string()), // Associated customer ID
});

/**
 * OTP verification request
 */
export const OTPVerifyRequestSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  code: v.pipe(v.string(), v.length(6)),
});

/**
 * OTP signup request
 */
export const OTPSignupRequestSchema = v.object({
  email: v.pipe(v.string(), v.email()),
});

/**
 * API Key data (stored in OTP_AUTH_KV)
 */
export const APIKeyDataSchema = v.object({
  keyId: v.string(),
  customerId: v.string(),
  hashedKey: v.string(),
  name: v.string(),
  createdAt: v.string(), // ISO 8601
  lastUsed: v.optional(v.string()), // ISO 8601
  expiresAt: v.optional(v.nullable(v.string())), // ISO 8601 or null
  scopes: v.array(v.string()),
});

/**
 * Rate limit data (temporary, stored in OTP_AUTH_KV)
 */
export const RateLimitDataSchema = v.object({
  identifier: v.string(), // email hash or IP
  count: v.pipe(v.number(), v.integer(), v.minValue(0)),
  resetAt: v.string(), // ISO 8601
  blockedUntil: v.optional(v.nullable(v.string())), // ISO 8601 or null
});

/**
 * JWT payload (for token generation/verification)
 * Includes standard JWT (RFC 7519), OAuth 2.0, and OIDC claims
 */
export const JWTPayloadSchema = v.object({
  sub: v.string(),
  customerId: v.string(),
  email: v.optional(v.pipe(v.string(), v.email())),
  iat: v.optional(v.number()),
  exp: v.optional(v.number()),
  iss: v.optional(v.string()),
  aud: v.optional(v.union([v.string(), v.array(v.string())])),
  jti: v.optional(v.string()),
  scope: v.optional(v.string()),
  client_id: v.optional(v.nullable(v.string())),
  at_hash: v.optional(v.string()),
  email_verified: v.optional(v.boolean()),
  isSuperAdmin: v.optional(v.boolean()),
});

/**
 * Type exports for TypeScript
 */
export type CustomerSession = v.InferOutput<typeof CustomerSessionSchema>;
export type OTPToken = v.InferOutput<typeof OTPTokenSchema>;
export type OTPVerifyRequest = v.InferOutput<typeof OTPVerifyRequestSchema>;
export type OTPSignupRequest = v.InferOutput<typeof OTPSignupRequestSchema>;
export type APIKeyData = v.InferOutput<typeof APIKeyDataSchema>;
export type RateLimitData = v.InferOutput<typeof RateLimitDataSchema>;
export type JWTPayload = v.InferOutput<typeof JWTPayloadSchema>;
