/**
 * Environment interface for Streamkit API Worker
 * 
 * This defines all available environment variables, KV namespaces, and secrets
 * for the Streamkit API Cloudflare Worker.
 */
export interface Env {
  // KV Namespaces
  STREAMKIT_KV: KVNamespace;
  
  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  ALLOWED_ORIGINS?: string;
  SERVICE_API_KEY?: string;
  NETWORK_INTEGRITY_KEYPHRASE?: string;
  
  // Environment variables
  ENVIRONMENT?: string;
  
  // Service URLs (for service-to-service communication)
  CUSTOMER_API_URL?: string;
  ACCESS_API_URL?: string;
  
  [key: string]: any;
}
