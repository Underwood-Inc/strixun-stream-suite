/**
 * Miniflare Multi-Worker Setup for Integration Tests
 *
 * This helper provides a fast, programmatic way to spin up multiple Cloudflare Workers
 * for integration testing using Miniflare.
 *
 * Benefits over wrangler dev processes:
 * - Instant startup (2-5 seconds vs 60-120 seconds)
 * - No health checks needed
 * - No process management complexity
 * - Proper cleanup
 */
import { unstable_dev } from 'wrangler';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Resolve paths to worker entry points
const OTP_AUTH_SERVICE_DIR = join(__dirname, '..', '..');
const CUSTOMER_API_DIR = join(__dirname, '..', '..', '..', 'customer-api');
// Service URLs (Miniflare assigns these automatically)
const OTP_AUTH_SERVICE_URL = 'http://localhost:8787';
const CUSTOMER_API_URL = 'http://localhost:8790';
/**
 * Create and start both OTP Auth Service and Customer API workers using Miniflare
 *
 * @returns Promise with both workers and cleanup function
 */
export async function createMultiWorkerSetup() {
    console.log('[Miniflare Setup] Starting workers...');
    try {
        // Start Customer API worker (port 8790)
        console.log('[Miniflare Setup] Starting Customer API worker...');
        const customerAPI = await unstable_dev(join(CUSTOMER_API_DIR, 'worker.ts'), {
            config: join(CUSTOMER_API_DIR, 'wrangler.toml'),
            experimental: { disableExperimentalWarning: true },
            port: 8790,
            local: true,
        });
        // Start OTP Auth Service worker (port 8787)
        console.log('[Miniflare Setup] Starting OTP Auth Service worker...');
        const otpAuthService = await unstable_dev(join(OTP_AUTH_SERVICE_DIR, 'worker.ts'), {
            config: join(OTP_AUTH_SERVICE_DIR, 'wrangler.toml'),
            experimental: { disableExperimentalWarning: true },
            port: 8787,
            local: true,
        });
        console.log(`[Miniflare Setup] ✓ Workers started successfully`);
        console.log(`[Miniflare Setup]   - OTP Auth Service: ${OTP_AUTH_SERVICE_URL}`);
        console.log(`[Miniflare Setup]   - Customer API: ${CUSTOMER_API_URL}`);
        // Cleanup function
        const cleanup = async () => {
            console.log('[Miniflare Setup] Stopping workers...');
            await Promise.all([
                otpAuthService.stop(),
                customerAPI.stop(),
            ]);
            console.log('[Miniflare Setup] ✓ Workers stopped');
        };
        return {
            otpAuthService,
            customerAPI,
            cleanup,
        };
    }
    catch (error) {
        console.error('[Miniflare Setup] ✗ Failed to start workers:', error);
        throw error;
    }
}
