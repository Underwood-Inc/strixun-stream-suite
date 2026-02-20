/**
 * Environment interface for Streamkit API Worker
 * 
 * This defines all available environment variables, KV namespaces, and secrets
 * for the Streamkit API Cloudflare Worker.
 */

// Allow importing HTML files as strings (esbuild --loader:.html=text)
declare module '*.html' {
  const content: string;
  export default content;
}

export interface Env {
  // KV Namespaces
  STREAMKIT_KV: KVNamespace;
  /** Service binding to otp-auth-service (for JWKS fetch; avoids same-zone 522) */
  AUTH_SERVICE?: Fetcher;
  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  ALLOWED_ORIGINS?: string;
  SERVICE_API_KEY?: string;
  NETWORK_INTEGRITY_KEYPHRASE?: string;
  
  // Environment variables
  ENVIRONMENT?: string;
  
  // OIDC issuer URL for JWKS discovery (e.g. https://auth.idling.app)
  JWT_ISSUER?: string;
  AUTH_SERVICE_URL?: string;
  
  // Service URLs (for service-to-service communication)
  CUSTOMER_API_URL?: string;
  ACCESS_API_URL?: string;
  
  [key: string]: any;
}
