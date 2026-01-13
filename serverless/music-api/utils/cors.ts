/**
 * CORS utility functions for Music API
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';

export function getCorsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
  
  const isLocalhost = origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'));
  
  let effectiveOrigins = allowedOrigins.length > 0 ? allowedOrigins : ['*'];
  
  if (isLocalhost) {
    const localhostAllowed = allowedOrigins.some(o => {
      if (o === '*' || o === origin) return true;
      if (o.endsWith('*')) {
        const prefix = o.slice(0, -1);
        return origin && origin.startsWith(prefix);
      }
      return false;
    });
    
    if (!localhostAllowed) {
      effectiveOrigins = ['*'];
    }
  }
  
  const corsHeaders = createCORSHeaders(request, {
    allowedOrigins: effectiveOrigins,
    credentials: true,
  });
  
  const headers: Record<string, string> = {};
  corsHeaders.forEach((value, key) => {
    headers[key] = value;
  });
  
  if (!headers['Access-Control-Allow-Methods']) {
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
  }
  if (!headers['Access-Control-Allow-Headers']) {
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
  }
  if (!headers['Access-Control-Max-Age']) {
    headers['Access-Control-Max-Age'] = '86400';
  }
  
  return headers;
}
