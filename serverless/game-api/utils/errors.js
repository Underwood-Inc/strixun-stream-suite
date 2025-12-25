/**
 * Error utilities using API framework
 */

import { createRFC7807Error } from '@strixun/api-framework/enhanced';

/**
 * Convert Request to APIRequest
 */
function requestToAPIRequest(request) {
    const url = new URL(request.url);
    return {
        id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        method: request.method,
        url: request.url,
        path: url.pathname,
        params: Object.fromEntries(url.searchParams.entries()),
        headers: Object.fromEntries(request.headers.entries()),
    };
}

/**
 * Create RFC 7807 error from Request
 */
export function createError(request, status, title, detail, additionalFields) {
    const apiRequest = requestToAPIRequest(request);
    return createRFC7807Error(apiRequest, status, title, detail, additionalFields);
}

