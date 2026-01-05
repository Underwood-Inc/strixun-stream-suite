/**
 * OTP Code Loader for Integration Tests
 *
 * Loads the E2E_TEST_OTP_CODE from environment variables or .dev.vars file.
 * Tests that require this code should call assertE2ETestOTPCode() at the module level
 * to fail fast if the code is missing.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
/**
 * Load E2E_TEST_OTP_CODE from environment or .dev.vars
 *
 * @returns The OTP code if found, null otherwise
 */
export function loadE2ETestOTPCode() {
    // Check environment variable first
    if (process.env.E2E_TEST_OTP_CODE) {
        return process.env.E2E_TEST_OTP_CODE;
    }
    // Check .dev.vars file
    const devVarsPath = join(PROJECT_ROOT, '.dev.vars');
    if (existsSync(devVarsPath)) {
        try {
            const devVars = readFileSync(devVarsPath, 'utf-8');
            const match = devVars.match(/E2E_TEST_OTP_CODE\s*=\s*["']?([^"'\n\r]+)["']?/);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        catch (error) {
            console.warn(`[OTP Code Loader] Warning: Could not read .dev.vars file at ${devVarsPath}:`, error);
        }
    }
    return null;
}
/**
 * Assert that E2E_TEST_OTP_CODE is available, throw immediately if not.
 * Call this at module level (before beforeAll) to fail fast.
 *
 * @throws Error if E2E_TEST_OTP_CODE is not available
 * @returns The OTP code
 */
export function assertE2ETestOTPCode() {
    const otpCode = loadE2ETestOTPCode();
    if (!otpCode) {
        throw new Error('E2E_TEST_OTP_CODE is required for integration tests.\n' +
            '\n' +
            'To fix this:\n' +
            '1. Set E2E_TEST_OTP_CODE environment variable, OR\n' +
            '2. Add E2E_TEST_OTP_CODE="your-code" to .dev.vars file in otp-auth-service directory\n' +
            '\n' +
            'For GitHub Actions, ensure the secret is set in repository settings and passed to the test environment.');
    }
    return otpCode;
}
