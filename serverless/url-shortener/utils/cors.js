/**
 * CORS Utilities
 * 
 * CORS header generation for URL Shortener worker
 */

/**
 * Get CORS headers with dynamic origin whitelist
 * @param {*} env - Worker environment
 * @param {Request} request - Request object
 * @returns {Object} CORS headers
 */
export function getCorsHeaders(env, request) {
  const origin = request.headers.get('Origin');
  
  // Get allowed origins from environment (comma-separated)
  const allowedOrigins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [];
  
  // If no origins configured, allow all (for development only)
  // In production, you MUST set ALLOWED_ORIGINS via: wrangler secret put ALLOWED_ORIGINS
  const allowOrigin = allowedOrigins.length > 0 
      ? (origin && allowedOrigins.includes(origin) ? origin : null)
      : '*'; // Fallback for development
  
  return {
      'Access-Control-Allow-Origin': allowOrigin || 'null',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': allowOrigin !== '*' ? 'true' : 'false',
      'Access-Control-Max-Age': '86400',
      // Security headers
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  };
}

