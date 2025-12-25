/**
 * Enhanced Router Wrapper
 *
 * Wraps existing router functions with enhanced framework features
 */
import { createErrorResponse, createEnhancedResponse, extractUserFromRequest } from './enhanced-wrapper.js';
/**
 * Wrap router response with enhanced features
 */
export async function enhanceRouterResponse(response, request, env, context = {}) {
    // If not a Response object, return as-is
    if (!(response instanceof Response)) {
        return response;
    }
    // Extract user from request if not provided
    if (!context.user) {
        context.user = await extractUserFromRequest(request, env);
    }
    // For JSON responses, add root config
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
        try {
            const data = await response.json();
            // Clone response to avoid "body already read" error
            const enhancedData = createEnhancedResponse(data, context);
            // Create new response with enhanced data
            return new Response(JSON.stringify(enhancedData), {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            });
        }
        catch (error) {
            // If JSON parsing fails, return original response
            return response;
        }
    }
    return response;
}
/**
 * Wrap router error with RFC 7807 format
 */
export function enhanceRouterError(error, request, env, status = 500) {
    return createErrorResponse(request, error, status);
}
/**
 * Enhanced router wrapper
 *
 * Wraps existing router function with enhanced features
 */
export function createEnhancedRouter(originalRouter) {
    return async (request, env, ctx) => {
        try {
            // Call original router
            const response = await originalRouter(request, env, ctx);
            // Enhance response
            return await enhanceRouterResponse(response, request, env);
        }
        catch (error) {
            // Log error for debugging
            console.error('[Enhanced Router] Unhandled error:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                url: request.url,
                method: request.method,
            });
            // Enhance error
            return enhanceRouterError(error, request, env);
        }
    };
}
//# sourceMappingURL=enhanced-router.js.map