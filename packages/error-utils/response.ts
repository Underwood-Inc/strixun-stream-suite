/**
 * @strixun/error-utils - Response Builders
 * 
 * Framework-agnostic response builders for error responses.
 * Works with Cloudflare Workers, Node.js, and browser environments.
 */

import type {
    RFC7807ErrorWithExtensions,
    ErrorContext,
    ErrorResponse,
    HTTPStatusCode,
    ResponseBuilderConfig,
} from './types';
import { toRFC7807, ToRFC7807Options } from './transformers';

// ============================================================================
// Content Types
// ============================================================================

/**
 * RFC 7807 Problem Details content type
 */
export const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';

/**
 * Standard JSON content type
 */
export const JSON_CONTENT_TYPE = 'application/json';

// ============================================================================
// Response Builders
// ============================================================================

/**
 * Build an error response object (framework-agnostic)
 * 
 * @example
 * ```typescript
 * const response = buildErrorResponse(error, context, {
 *   includeBackwardCompatError: true
 * });
 * 
 * // Use with Cloudflare Workers
 * return new Response(JSON.stringify(response.body), {
 *   status: response.status,
 *   headers: response.headers
 * });
 * ```
 */
export function buildErrorResponse(
    error: unknown,
    context?: ErrorContext,
    config: ResponseBuilderConfig & ToRFC7807Options = {}
): ErrorResponse<RFC7807ErrorWithExtensions> {
    const rfc7807 = toRFC7807(error, context, {
        includeDebug: config.includeDebug ?? context?.environment === 'development',
        includeStack: config.includeStack ?? false,
        includeBackwardCompat: config.includeBackwardCompatError ?? false,
        typeBaseUri: config.typeBaseUri,
        includeErrorCode: config.includeErrorCode ?? true,
    });

    const headers: Record<string, string> = {
        'Content-Type': PROBLEM_JSON_CONTENT_TYPE,
        ...config.additionalHeaders,
    };

    // Add CORS headers if configured
    if (config.includeCors) {
        const origin = context?.metadata?.origin as string | undefined;
        headers['Access-Control-Allow-Origin'] = resolveAllowedOrigin(
            origin,
            config.allowedOrigins
        );
        headers['Access-Control-Allow-Credentials'] = 'true';
    }

    // Add Retry-After header if applicable
    if (rfc7807.extensions?.retryAfter) {
        headers['Retry-After'] = String(rfc7807.extensions.retryAfter);
    }

    return {
        status: rfc7807.status,
        headers,
        body: rfc7807,
    };
}

/**
 * Build a Web API Response object
 * 
 * This function returns a standard Web API Response, which works in:
 * - Cloudflare Workers
 * - Deno
 * - Node.js 18+ (with fetch API)
 * - Modern browsers
 * 
 * @example
 * ```typescript
 * // In a Cloudflare Worker
 * export default {
 *   async fetch(request: Request): Promise<Response> {
 *     try {
 *       // ... handle request
 *     } catch (error) {
 *       return buildWebResponse(error, { url: request.url });
 *     }
 *   }
 * }
 * ```
 */
export function buildWebResponse(
    error: unknown,
    context?: ErrorContext,
    config: ResponseBuilderConfig & ToRFC7807Options = {}
): Response {
    const errorResponse = buildErrorResponse(error, context, config);
    
    return new Response(
        JSON.stringify(errorResponse.body),
        {
            status: errorResponse.status,
            headers: errorResponse.headers,
        }
    );
}

/**
 * Build a simple JSON response (not RFC 7807)
 * 
 * For cases where you need backward compatibility with legacy clients
 * expecting `{ error: "message" }` format.
 */
export function buildSimpleErrorResponse(
    status: HTTPStatusCode,
    message: string,
    additionalFields?: Record<string, unknown>
): ErrorResponse<{ error: string } & Record<string, unknown>> {
    return {
        status,
        headers: {
            'Content-Type': JSON_CONTENT_TYPE,
        },
        body: {
            error: message,
            ...additionalFields,
        },
    };
}

/**
 * Build a simple JSON Web Response
 */
export function buildSimpleWebResponse(
    status: HTTPStatusCode,
    message: string,
    additionalFields?: Record<string, unknown>
): Response {
    const errorResponse = buildSimpleErrorResponse(status, message, additionalFields);
    
    return new Response(
        JSON.stringify(errorResponse.body),
        {
            status: errorResponse.status,
            headers: errorResponse.headers,
        }
    );
}

// ============================================================================
// Response with CORS
// ============================================================================

/**
 * Options for CORS-enabled responses
 */
export interface CorsOptions {
    /** Allowed origins (defaults to ['*']) */
    allowedOrigins?: string[];
    /** Allowed methods (defaults to common methods) */
    allowedMethods?: string[];
    /** Allowed headers */
    allowedHeaders?: string[];
    /** Exposed headers */
    exposedHeaders?: string[];
    /** Max age for preflight cache */
    maxAge?: number;
    /** Allow credentials */
    credentials?: boolean;
}

/**
 * Build CORS headers
 */
export function buildCorsHeaders(
    requestOrigin?: string,
    options: CorsOptions = {}
): Record<string, string> {
    const {
        allowedOrigins = ['*'],
        allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders = ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders = [],
        maxAge = 86400,
        credentials = true,
    } = options;

    const origin = resolveAllowedOrigin(requestOrigin, allowedOrigins);

    const headers: Record<string, string> = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': allowedMethods.join(', '),
        'Access-Control-Allow-Headers': allowedHeaders.join(', '),
        'Access-Control-Max-Age': String(maxAge),
    };

    if (credentials && origin !== '*') {
        headers['Access-Control-Allow-Credentials'] = 'true';
    }

    if (exposedHeaders.length > 0) {
        headers['Access-Control-Expose-Headers'] = exposedHeaders.join(', ');
    }

    return headers;
}

/**
 * Build error response with CORS headers
 */
export function buildErrorResponseWithCors(
    error: unknown,
    requestOrigin?: string,
    context?: ErrorContext,
    config: ResponseBuilderConfig & ToRFC7807Options & CorsOptions = {}
): ErrorResponse<RFC7807ErrorWithExtensions> {
    const response = buildErrorResponse(error, context, config);
    const corsHeaders = buildCorsHeaders(requestOrigin, config);

    return {
        ...response,
        headers: {
            ...response.headers,
            ...corsHeaders,
        },
    };
}

/**
 * Build Web Response with CORS headers
 */
export function buildWebResponseWithCors(
    error: unknown,
    requestOrigin?: string,
    context?: ErrorContext,
    config: ResponseBuilderConfig & ToRFC7807Options & CorsOptions = {}
): Response {
    const errorResponse = buildErrorResponseWithCors(error, requestOrigin, context, config);
    
    return new Response(
        JSON.stringify(errorResponse.body),
        {
            status: errorResponse.status,
            headers: errorResponse.headers,
        }
    );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Resolve the allowed origin for CORS
 */
function resolveAllowedOrigin(
    requestOrigin?: string,
    allowedOrigins: string[] = ['*']
): string {
    // If wildcard is allowed, return it
    if (allowedOrigins.includes('*')) {
        return '*';
    }

    // If no request origin, use first allowed
    if (!requestOrigin) {
        return allowedOrigins[0] || '*';
    }

    // Check if request origin is allowed
    if (allowedOrigins.includes(requestOrigin)) {
        return requestOrigin;
    }

    // Check for pattern matching (e.g., *.example.com)
    for (const allowed of allowedOrigins) {
        if (allowed.startsWith('*.')) {
            const domain = allowed.slice(2);
            if (requestOrigin.endsWith(domain)) {
                return requestOrigin;
            }
        }
    }

    // Default to first allowed origin
    return allowedOrigins[0] || '*';
}

/**
 * Check if a response is an error response
 */
export function isErrorResponse<T>(response: ErrorResponse<T>): boolean {
    return response.status >= 400;
}

/**
 * Extract error message from response body
 */
export function extractErrorMessage(body: unknown): string {
    if (!body || typeof body !== 'object') {
        return 'Unknown error';
    }

    // RFC 7807 format
    if ('detail' in body && typeof (body as { detail: unknown }).detail === 'string') {
        return (body as { detail: string }).detail;
    }

    // Simple format
    if ('error' in body && typeof (body as { error: unknown }).error === 'string') {
        return (body as { error: string }).error;
    }

    // Message field
    if ('message' in body && typeof (body as { message: unknown }).message === 'string') {
        return (body as { message: string }).message;
    }

    return 'Unknown error';
}
