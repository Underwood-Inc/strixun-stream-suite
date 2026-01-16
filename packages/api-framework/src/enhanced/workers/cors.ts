/**
 * Enhanced API Framework - CORS Handler
 * 
 * CORS handling for Cloudflare Workers
 */

export interface CORSOptions {
  allowedOrigins?: string[] | ((origin: string) => boolean);
  allowedMethods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
  credentials?: boolean;
}

const DEFAULT_OPTIONS: Required<CORSOptions> = {
  allowedOrigins: ['*'],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: [],
  maxAge: 86400, // 24 hours
  credentials: false,
};

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string, allowedOrigins: string[] | ((origin: string) => boolean)): boolean {
  if (typeof allowedOrigins === 'function') {
    return allowedOrigins(origin);
  }

  if (allowedOrigins.includes('*')) {
    return true;
  }

  return allowedOrigins.includes(origin);
}

/**
 * Create CORS headers
 * 
 * CRITICAL: When credentials mode is enabled, we CANNOT use '*' as the origin.
 * Browsers require the exact origin to be echoed back when credentials are included.
 * See: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS/Errors/CORSNotSupportingCredentials
 */
export function createCORSHeaders(
  request: Request,
  options: CORSOptions = {}
): Headers {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const headers = new Headers();

  const origin = request.headers.get('Origin');
  let originAllowed = false;

  // Handle allowed origins
  if (origin) {
    // Check if origin is explicitly allowed
    if (isOriginAllowed(origin, opts.allowedOrigins)) {
      headers.set('Access-Control-Allow-Origin', origin);
      originAllowed = true;
    } 
    // If wildcard '*' is in allowed origins AND credentials is requested,
    // we MUST echo back the exact origin (browsers reject '*' with credentials)
    else if (Array.isArray(opts.allowedOrigins) && opts.allowedOrigins.includes('*')) {
      if (opts.credentials) {
        // With credentials, echo back the exact origin instead of '*'
        headers.set('Access-Control-Allow-Origin', origin);
        originAllowed = true;
      } else {
        // Without credentials, '*' is fine
        headers.set('Access-Control-Allow-Origin', '*');
        originAllowed = true;
      }
    }
    // Function-based origin checking
    else if (typeof opts.allowedOrigins === 'function' && opts.allowedOrigins(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      originAllowed = true;
    }
  } else if (Array.isArray(opts.allowedOrigins) && opts.allowedOrigins.includes('*') && !opts.credentials) {
    // No origin header but wildcard allowed (non-credentialed request)
    headers.set('Access-Control-Allow-Origin', '*');
    originAllowed = true;
  }

  // Set credentials header if origin was allowed and credentials are enabled
  if (originAllowed && opts.credentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight requests - ALWAYS set these for OPTIONS
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', opts.allowedMethods.join(', '));
    headers.set('Access-Control-Allow-Headers', opts.allowedHeaders.join(', '));
    headers.set('Access-Control-Max-Age', opts.maxAge.toString());

    if (opts.exposedHeaders.length > 0) {
      headers.set('Access-Control-Expose-Headers', opts.exposedHeaders.join(', '));
    }
  } else if (opts.exposedHeaders.length > 0) {
    headers.set('Access-Control-Expose-Headers', opts.exposedHeaders.join(', '));
  }

  return headers;
}

/**
 * Handle CORS preflight request
 */
export function handleCORSPreflight(
  request: Request,
  options: CORSOptions = {}
): Response | null {
  if (request.method !== 'OPTIONS') {
    return null;
  }

  const headers = createCORSHeaders(request, options);

  return new Response(null, {
    status: 204,
    headers,
  });
}

/**
 * Create CORS middleware
 */
export function createCORSMiddleware(options: CORSOptions = {}) {
  return async (
    request: Request,
    next: (request: Request) => Promise<Response>
  ): Promise<Response> => {
    // Handle preflight
    const preflightResponse = handleCORSPreflight(request, options);
    if (preflightResponse) {
      return preflightResponse;
    }

    // Execute request
    const response = await next(request);

    // Add CORS headers to response
    const corsHeaders = createCORSHeaders(request, options);
    
    // Merge with existing headers
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of corsHeaders.entries()) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

/**
 * Production CORS helper for Cloudflare Workers
 * Reads ALLOWED_ORIGINS from env - NO wildcards, NO localhost magic
 */
export function getCorsHeaders(
    env: { ALLOWED_ORIGINS?: string; [key: string]: any },
    request: Request,
    customer?: { config?: { allowedOrigins?: string[] }; [key: string]: any } | null
): Headers {
    // CRITICAL: env.ALLOWED_ORIGINS is ALWAYS checked first, never a fallback
    // Get base allowed origins from env.ALLOWED_ORIGINS (required)
    let allowedOrigins: string[] = [];
    
    if (env.ALLOWED_ORIGINS) {
        allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o.length > 0);
    }
    
    // If customer config exists, intersect with env.ALLOWED_ORIGINS (customer can only restrict further)
    if (customer?.config?.allowedOrigins && customer.config.allowedOrigins.length > 0) {
        const customerOrigins = customer.config.allowedOrigins;
        // Intersect: only allow origins that are in BOTH env.ALLOWED_ORIGINS and customer config
        allowedOrigins = allowedOrigins.filter(origin => 
            customerOrigins.includes('*') || customerOrigins.includes(origin)
        );
    }
    
    // No ALLOWED_ORIGINS = log error
    if (allowedOrigins.length === 0) {
        console.error('[CORS] ERROR: ALLOWED_ORIGINS not configured! Set the ALLOWED_ORIGINS secret.');
    }
    
    return createCORSHeaders(request, {
        allowedOrigins,
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-OTP-API-Key',
            'X-Requested-With',
            'X-CSRF-Token',
            'X-Dashboard-Request',
        ],
        credentials: true,
    });
}

