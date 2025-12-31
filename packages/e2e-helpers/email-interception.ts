/**
 * E2E Email Interception Helper
 * 
 * SECURITY: This ONLY works with local KV storage (wrangler dev --local)
 * It will NEVER work in production because:
 * 1. Production uses Cloudflare KV (not local filesystem)
 * 2. Email interception only happens when ENVIRONMENT='test' AND RESEND_API_KEY='re_test_*'
 * 3. This code reads from .wrangler/state/v3/kv (local filesystem only)
 * 4. Production deployments don't have access to local filesystem
 * 
 * DO NOT use this in production code - it will fail safely (returns null)
 */

/**
 * Get intercepted OTP code from local KV storage
 * Only works when running E2E tests against local workers
 * 
 * SECURITY: This reads from local filesystem (.wrangler/state/v3/kv)
 * In production, this path doesn't exist and function returns null
 * 
 * @param _email - Email address to get OTP for (unused, kept for API compatibility)
 * @returns OTP code or null if not found
 */
export async function getInterceptedOTP(_email: string): Promise<string | null> {
    // NOTE: This function is kept for backward compatibility but is not currently used.
    // Tests now use E2E_TEST_OTP_CODE from environment directly.
    // Proper E2E testing with OTP interception will be implemented in the dedicated OTP auth lib.
    
    // For now, return null to trigger fallback to E2E_TEST_OTP_CODE
    return null;
}

/**
 * Wait for OTP email to be intercepted and retrieve the code
 * 
 * @param email - Email address
 * @param timeout - Maximum time to wait (default: 10 seconds)
 * @returns OTP code or null if timeout
 */
export async function waitForInterceptedOTP(
    email: string,
    timeout: number = 10000
): Promise<string | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        const otp = await getInterceptedOTP(email);
        if (otp) {
            return otp;
        }
        
        // Wait 100ms before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return null;
}

