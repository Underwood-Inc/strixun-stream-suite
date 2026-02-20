/**
 * Shared Authentication Check Utilities
 *
 * REUSABLE: Uses auth-store's fetchCustomerInfo under the hood.
 * Single source of truth - no duplicate auth logic.
 *
 * USAGE:
 *   import { checkAuth, type AuthCheckResult } from '@strixun/otp-auth-service/shared/auth-check';
 *
 *   const result = await checkAuth();
 *   if (result) {
 *     // Authenticated: result.customerId, result.displayName, result.isSuperAdmin
 *   } else {
 *     // Not authenticated (401/403) - show login screen
 *   }
 */

import { fetchCustomerInfo } from '@strixun/auth-store/core/api';
import type { AuthUrlConfig } from './auth-urls';

/**
 * Result of authentication check
 */
export interface AuthCheckResult {
    customerId: string;
    displayName?: string | null;
    isSuperAdmin: boolean;
}

/**
 * Map auth-store config to AuthUrlConfig shape
 */
function toAuthStoreConfig(config?: AuthUrlConfig): { authApiUrl?: string; customerApiUrl?: string } | undefined {
    if (!config) return undefined;
    return {
        authApiUrl: config.authApiUrl,
        customerApiUrl: config.customerApiUrl,
    };
}

/**
 * Check authentication status.
 * REUSABLE: Delegates to auth-store's fetchCustomerInfo (auth API /auth/me only).
 *
 * @param config Optional URL configuration
 * @returns AuthCheckResult if authenticated, null if not, throws on critical errors
 */
export async function checkAuth(config?: AuthUrlConfig): Promise<AuthCheckResult | null> {
    const customerInfo = await fetchCustomerInfo(null, toAuthStoreConfig(config));
    if (!customerInfo) return null;
    return {
        customerId: customerInfo.customerId,
        displayName: customerInfo.displayName ?? null,
        isSuperAdmin: customerInfo.isSuperAdmin,
    };
}
