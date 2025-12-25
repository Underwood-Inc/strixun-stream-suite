/**
 * Error utilities using API framework
 */

import { createRFC7807Error } from '@strixun/api-framework/enhanced';

interface APIRequest {
    id: string;
    method: string;
    url: string;
    path: string;
    params: Record<string, string>;
    headers: Record<string, string>;
}

/**
 * Convert Request to APIRequest
 */
function requestToAPIRequest(request: Request): APIRequest {
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
export function createError(
    request: Request,
    status: number,
    title: string,
    detail: string,
    additionalFields?: Record<string, any>
) {
    const apiRequest = requestToAPIRequest(request);
    return createRFC7807Error(apiRequest, status, title, detail, additionalFields);
}

