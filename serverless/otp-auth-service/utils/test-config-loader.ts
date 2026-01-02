/**
 * Test Configuration Loader
 * Loads integration test configuration for LOCAL testing only
 * 
 * CRITICAL: Integration tests ONLY work with LOCAL workers!
 * - OTP Auth Service: http://localhost:8787
 * - Customer API: http://localhost:8790
 * 
 * NO SUPPORT FOR DEPLOYED/LIVE WORKERS - LOCAL ONLY!
 */

interface TestConfig {
  customerApiUrl: string;
  otpAuthServiceUrl: string;
  superAdminApiKey: string;
}

/**
 * Load test configuration for LOCAL integration tests
 * Always uses localhost - no deployed worker support
 */
export function loadTestConfig(environment: 'dev' | 'prod' = 'dev'): TestConfig {
  // ALWAYS use localhost for integration tests
  // Environment variables can override, but defaults to localhost
  const customerApiUrl = 
    process.env.CUSTOMER_API_URL || 'http://localhost:8790';
  
  const otpAuthServiceUrl = 
    process.env.OTP_AUTH_SERVICE_URL || 'http://localhost:8787';
  
  // Super admin API key is optional for local testing
  const superAdminApiKey = process.env.SUPER_ADMIN_API_KEY || '';
  
  // Validate URLs are localhost (safety check)
  if (!customerApiUrl.includes('localhost') && !customerApiUrl.includes('127.0.0.1')) {
    throw new Error(
      `✗ CUSTOMER_API_URL must point to localhost for integration tests!\n` +
      `   Current: ${customerApiUrl}\n` +
      `   Required: http://localhost:8790\n` +
      `   \n` +
      `   Integration tests ONLY work with LOCAL workers, not deployed workers!`
    );
  }
  
  if (!otpAuthServiceUrl.includes('localhost') && !otpAuthServiceUrl.includes('127.0.0.1')) {
    throw new Error(
      `✗ OTP_AUTH_SERVICE_URL must point to localhost for integration tests!\n` +
      `   Current: ${otpAuthServiceUrl}\n` +
      `   Required: http://localhost:8787\n` +
      `   \n` +
      `   Integration tests ONLY work with LOCAL workers, not deployed workers!`
    );
  }
  
  return {
    customerApiUrl,
    otpAuthServiceUrl,
    superAdminApiKey,
  };
}

