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
 */
export function createCORSHeaders(
  request: Request,
  options: CORSOptions = {}
): Headers {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const headers = new Headers();

  const origin = request.headers.get('Origin');

  // Handle allowed origins
  if (origin && isOriginAllowed(origin, opts.allowedOrigins)) {
    headers.set('Access-Control-Allow-Origin', origin);
    
    if (opts.credentials) {
      headers.set('Access-Control-Allow-Credentials', 'true');
    }
  } else if (Array.isArray(opts.allowedOrigins) && opts.allowedOrigins.includes('*')) {
    headers.set('Access-Control-Allow-Origin', '*');
  } else if (typeof opts.allowedOrigins === 'function') {
    // Function-based origin checking - handled separately
    const origin = request.headers.get('Origin');
    if (origin && opts.allowedOrigins(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
    }
  }

  // Handle preflight requests
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

