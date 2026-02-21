/**
 * Shared Authentication Utilities
 * 
 * Unified authentication utilities for SSO across all Strixun apps.
 * 
 * USAGE:
 *   import { getAuthApiUrl, getCustomerApiUrl, checkAuth } from '@strixun/otp-auth-service/shared';
 */

export * from './auth-urls';
export * from './auth-check';
export * from './auth-errors';
export * from './oidc-constants';
