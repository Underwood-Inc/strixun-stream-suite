/**
 * Customer API - Error Utilities
 * 
 * Re-exports from @strixun/error-utils for centralized error handling.
 * 
 * @deprecated Import directly from '@strixun/error-utils' in new code
 */

import {
    createRFC7807,
    getTypeUri,
    getTitle,
    type HTTPStatusCode,
} from '@strixun/error-utils';

// Re-export everything from error-utils for convenience
export * from '@strixun/error-utils';

/**
 * Legacy createError function for backward compatibility
 * 
 * @deprecated Use createRFC7807 from '@strixun/error-utils' instead
 */
export function createError(
    request: Request,
    status: number,
    title: string,
    detail: string,
    additionalFields?: Record<string, unknown>
) {
    const url = new URL(request.url);
    
    const error = createRFC7807(status as HTTPStatusCode, detail, {
        title,
        instance: url.pathname,
        extensions: additionalFields,
    });

    // Flatten extensions for backward compatibility with existing handlers
    return {
        type: error.type,
        title: error.title,
        status: error.status,
        detail: error.detail,
        instance: error.instance,
        ...additionalFields,
    };
}
