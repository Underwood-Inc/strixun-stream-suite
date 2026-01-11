/**
 * CORS Utilities for Access Service
 * Provides consistent CORS configuration across all handlers
 */

import { createCORSHeaders as frameworkCreateCORSHeaders, type CORSOptions } from '@strixun/api-framework/enhanced';

/**
 * Default CORS options for Access Service
 * Includes x-service-key header for service-to-service communication
 */
const DEFAULT_ACCESS_SERVICE_CORS_OPTIONS: CORSOptions = {
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-service-key'],
};

/**
 * Create CORS headers with Access Service defaults
 */
export function createCORSHeaders(request: Request, additionalOptions: CORSOptions = {}): Headers {
    return frameworkCreateCORSHeaders(request, {
        ...DEFAULT_ACCESS_SERVICE_CORS_OPTIONS,
        ...additionalOptions,
    });
}
