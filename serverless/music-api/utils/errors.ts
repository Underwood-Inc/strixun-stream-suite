/**
 * Music API - Error Utilities
 * 
 * Re-exports from @strixun/error-utils for centralized error handling.
 * 
 * @deprecated Import directly from '@strixun/error-utils' in new code
 */

import {
    createRFC7807,
    type HTTPStatusCode,
    type RFC7807Error,
} from '@strixun/error-utils';

// Re-export everything from error-utils for convenience
export * from '@strixun/error-utils';

// Re-export RFC7807Error type for backward compatibility
export type { RFC7807Error };

/**
 * Legacy createError function for backward compatibility
 * 
 * @deprecated Use createRFC7807 from '@strixun/error-utils' instead
 */
export function createError(
    request: Request,
    status: number,
    title: string,
    detail: string
): RFC7807Error {
    return createRFC7807(status as HTTPStatusCode, detail, {
        title,
        instance: request.url,
    });
}
