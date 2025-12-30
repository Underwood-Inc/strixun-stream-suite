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

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * Hash email using same algorithm as OTP Auth Service
 */
async function hashEmail(email: string): Promise<string> {
    const normalized = email.toLowerCase().trim();
    return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Get intercepted OTP code from local KV storage
 * Only works when running E2E tests against local workers
 * 
 * SECURITY: This reads from local filesystem (.wrangler/state/v3/kv)
 * In production, this path doesn't exist and function returns null
 * 
 * @param email - Email address to get OTP for
 * @returns OTP code or null if not found
 */
export async function getInterceptedOTP(email: string): Promise<string | null> {
    try {
        // SECURITY: Only read from local KV filesystem (wrangler dev --local)
        // In production, .wrangler directory doesn't exist
        // This ensures we can NEVER accidentally read from production KV
        
        const emailHash = await hashEmail(email);
        const e2eOTPKey = `e2e_otp_${emailHash}`;
        
        // Try to find wrangler state directory
        // Wrangler stores local KV in: .wrangler/state/v3/kv/<namespace-id>/
        // OTP_AUTH_KV namespace ID: 680c9dbe86854c369dd23e278abb41f9
        const OTP_AUTH_KV_NAMESPACE_ID = '680c9dbe86854c369dd23e278abb41f9';
        
        const possibleBasePaths = [
            join(process.cwd(), 'serverless', 'otp-auth-service', '.wrangler', 'state', 'v3', 'kv'),
            join(process.cwd(), '.wrangler', 'state', 'v3', 'kv'),
            join(process.env.HOME || process.env.USERPROFILE || '', '.wrangler', 'state', 'v3', 'kv'),
        ];
        
        for (const basePath of possibleBasePaths) {
            if (!existsSync(basePath)) continue;
            
            // Try known namespace ID first
            const knownNamespacePath = join(basePath, OTP_AUTH_KV_NAMESPACE_ID, e2eOTPKey);
            if (existsSync(knownNamespacePath)) {
                const otp = readFileSync(knownNamespacePath, 'utf-8').trim();
                if (otp) {
                    return otp;
                }
            }
            
            // Fallback: List all namespace directories and try each
            const { readdirSync } = await import('fs');
            try {
                const namespaces = readdirSync(basePath, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
                
                for (const namespace of namespaces) {
                    const kvPath = join(basePath, namespace, e2eOTPKey);
                    if (existsSync(kvPath)) {
                        const otp = readFileSync(kvPath, 'utf-8').trim();
                        if (otp) {
                            return otp;
                        }
                    }
                }
            } catch (err) {
                // Continue to next path if this one fails
                continue;
            }
        }
        
        return null;
    } catch (error) {
        // Fail safely - in production or if KV not accessible, return null
        return null;
    }
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

