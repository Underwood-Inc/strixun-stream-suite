/**
 * @strixun/error-utils - Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
    // Factory
    AppError,
    createError,
    createNotFoundError,
    createValidationError,
    createUnauthorizedError,
    createForbiddenError,
    createRateLimitError,
    createInternalError,
    wrapError,
    
    // RFC 7807
    createRFC7807,
    createRFC7807WithContext,
    createValidationRFC7807,
    getTypeUri,
    getTitle,
    
    // Transformers
    toRFC7807,
    appErrorToRFC7807,
    createTransformerPipeline,
    normalizeError,
    addTraceId,
    sanitizeForProduction,
    
    // Response
    buildErrorResponse,
    buildWebResponse,
    buildSimpleErrorResponse,
    PROBLEM_JSON_CONTENT_TYPE,
    
    // Guards
    isAppError,
    isApplicationError,
    isRFC7807Error,
    isClientErrorStatus,
    isServerErrorStatus,
    isRetryable,
    
    // Types
    type ApplicationError,
    type RFC7807Error,
    type ErrorContext,
} from './index';

describe('Error Factory', () => {
    describe('createError', () => {
        it('should create error with all options', () => {
            const error = createError({
                message: 'Test error',
                status: 400,
                category: 'validation',
                code: 'test_error',
                data: { field: 'value' },
            });

            expect(error.message).toBe('Test error');
            expect(error.status).toBe(400);
            expect(error.category).toBe('validation');
            expect(error.code).toBe('test_error');
            expect(error.data).toEqual({ field: 'value' });
            expect(error.timestamp).toBeDefined();
        });

        it('should default to 500 status', () => {
            const error = createError({ message: 'Error' });
            expect(error.status).toBe(500);
        });
    });

    describe('createNotFoundError', () => {
        it('should create 404 error with resource and id', () => {
            const error = createNotFoundError('User', '123');
            
            expect(error.status).toBe(404);
            expect(error.message).toBe("User with ID '123' was not found");
            expect(error.code).toBe('user_not_found');
            expect(error.data).toEqual({ resource: 'User', identifier: '123' });
        });

        it('should create 404 error without id', () => {
            const error = createNotFoundError('Resource');
            expect(error.message).toBe('Resource was not found');
        });
    });

    describe('createValidationError', () => {
        it('should create 422 error with validation details', () => {
            const error = createValidationError({
                message: 'Validation failed',
                errors: [
                    { field: 'email', message: 'Invalid format' },
                ],
            });

            expect(error.status).toBe(422);
            expect(error.category).toBe('validation');
            expect(error.data?.errors).toHaveLength(1);
        });
    });

    describe('createRateLimitError', () => {
        it('should create 429 error with retry info', () => {
            const error = createRateLimitError('Too many requests', 30000);
            
            expect(error.status).toBe(429);
            expect(error.retryable).toBe(true);
            expect(error.retryAfterMs).toBe(30000);
        });
    });

    describe('wrapError', () => {
        it('should return AppError unchanged', () => {
            const original = createNotFoundError('Test');
            const wrapped = wrapError(original);
            expect(wrapped).toBe(original);
        });

        it('should wrap native Error', () => {
            const native = new Error('Native error');
            const wrapped = wrapError(native);
            
            expect(wrapped.message).toBe('Native error');
            expect(wrapped.status).toBe(500);
            expect(wrapped.originalCause).toBe(native);
        });

        it('should wrap string', () => {
            const wrapped = wrapError('String error');
            expect(wrapped.message).toBe('String error');
        });
    });
});

describe('RFC 7807', () => {
    describe('createRFC7807', () => {
        it('should create RFC 7807 compliant error', () => {
            const error = createRFC7807(404, 'Not found', {
                instance: '/api/users/123',
            });

            expect(error.type).toBe('https://tools.ietf.org/html/rfc7231#section-6.5.4');
            expect(error.title).toBe('Not Found');
            expect(error.status).toBe(404);
            expect(error.detail).toBe('Not found');
            expect(error.instance).toBe('/api/users/123');
        });

        it('should include extensions', () => {
            const error = createRFC7807(400, 'Bad request', {
                extensions: { errorCode: 'invalid_input' },
            });

            expect(error.extensions?.errorCode).toBe('invalid_input');
        });
    });

    describe('getTypeUri', () => {
        it('should return correct URI for known status', () => {
            expect(getTypeUri(404)).toBe('https://tools.ietf.org/html/rfc7231#section-6.5.4');
            expect(getTypeUri(429)).toBe('https://tools.ietf.org/html/rfc6585#section-4');
        });

        it('should return 500 URI for unknown status', () => {
            expect(getTypeUri(999)).toBe('https://tools.ietf.org/html/rfc7231#section-6.6.1');
        });

        it('should use custom base URI', () => {
            expect(getTypeUri(404, 'https://api.example.com')).toBe('https://api.example.com/errors/404');
        });
    });

    describe('getTitle', () => {
        it('should return correct title', () => {
            expect(getTitle(404)).toBe('Not Found');
            expect(getTitle(500)).toBe('Internal Server Error');
            expect(getTitle(999)).toBe('Error');
        });
    });
});

describe('Transformers', () => {
    describe('toRFC7807', () => {
        it('should transform AppError to RFC 7807', () => {
            const appError = createNotFoundError('User', '123');
            const rfc7807 = toRFC7807(appError, { url: '/api/users/123' });

            expect(rfc7807.type).toBeDefined();
            expect(rfc7807.title).toBe('Not Found');
            expect(rfc7807.status).toBe(404);
            expect(rfc7807.detail).toBe("User with ID '123' was not found");
            expect(rfc7807.instance).toBe('/api/users/123');
        });

        it('should transform native Error', () => {
            const error = new Error('Something went wrong');
            const rfc7807 = toRFC7807(error);

            expect(rfc7807.status).toBe(500);
            expect(rfc7807.detail).toBe('Something went wrong');
        });
    });

    describe('createTransformerPipeline', () => {
        it('should apply transformers in sequence', () => {
            const pipeline = createTransformerPipeline(
                normalizeError,
                addTraceId,
            );

            const result = pipeline(new Error('Test'), { requestId: 'trace-123' }) as AppError;
            
            expect(result.message).toBe('Test');
            expect(result.extensions?.traceId).toBe('trace-123');
        });
    });

    describe('sanitizeForProduction', () => {
        it('should remove sensitive data in production', () => {
            const error = createInternalError('DB connection failed', new Error('cause'));
            const sanitized = sanitizeForProduction(error, { environment: 'production' });

            expect(sanitized.stack).toBeUndefined();
            expect(sanitized.cause).toBeUndefined();
            expect(sanitized.message).toBe('An unexpected error occurred. Please try again later.');
        });

        it('should preserve data in development', () => {
            const error = createInternalError('DB connection failed');
            const preserved = sanitizeForProduction(error, { environment: 'development' });

            expect(preserved.message).toBe('DB connection failed');
        });
    });
});

describe('Response Builders', () => {
    describe('buildErrorResponse', () => {
        it('should build correct response structure', () => {
            const error = createNotFoundError('User');
            const response = buildErrorResponse(error, { url: '/api/users' });

            expect(response.status).toBe(404);
            expect(response.headers['Content-Type']).toBe(PROBLEM_JSON_CONTENT_TYPE);
            expect(response.body.type).toBeDefined();
            expect(response.body.title).toBe('Not Found');
        });

        it('should include retry-after header for rate limit', () => {
            const error = createRateLimitError('Rate limited', 30000);
            const response = buildErrorResponse(error);

            expect(response.headers['Retry-After']).toBe('30');
        });
    });

    describe('buildWebResponse', () => {
        it('should return Web API Response', () => {
            const error = createUnauthorizedError();
            const response = buildWebResponse(error);

            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(401);
            expect(response.headers.get('Content-Type')).toBe(PROBLEM_JSON_CONTENT_TYPE);
        });
    });

    describe('buildSimpleErrorResponse', () => {
        it('should build simple error format', () => {
            const response = buildSimpleErrorResponse(400, 'Bad request');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Bad request');
        });
    });
});

describe('Type Guards', () => {
    describe('isAppError', () => {
        it('should return true for AppError', () => {
            const error = createNotFoundError('Test');
            expect(isAppError(error)).toBe(true);
        });

        it('should return false for native Error', () => {
            expect(isAppError(new Error())).toBe(false);
        });
    });

    describe('isRFC7807Error', () => {
        it('should return true for RFC 7807 error', () => {
            const error = createRFC7807(404, 'Not found');
            expect(isRFC7807Error(error)).toBe(true);
        });

        it('should return false for simple error object', () => {
            expect(isRFC7807Error({ error: 'test' })).toBe(false);
        });
    });

    describe('isClientErrorStatus', () => {
        it('should return true for 4xx status', () => {
            expect(isClientErrorStatus(400)).toBe(true);
            expect(isClientErrorStatus(404)).toBe(true);
            expect(isClientErrorStatus(499)).toBe(true);
        });

        it('should return false for other status', () => {
            expect(isClientErrorStatus(200)).toBe(false);
            expect(isClientErrorStatus(500)).toBe(false);
        });
    });

    describe('isServerErrorStatus', () => {
        it('should return true for 5xx status', () => {
            expect(isServerErrorStatus(500)).toBe(true);
            expect(isServerErrorStatus(503)).toBe(true);
        });

        it('should return false for other status', () => {
            expect(isServerErrorStatus(400)).toBe(false);
        });
    });

    describe('isRetryable', () => {
        it('should return true for retryable errors', () => {
            const error = createRateLimitError();
            expect(isRetryable(error)).toBe(true);
        });

        it('should return false for non-retryable errors', () => {
            const error = createNotFoundError('Test');
            expect(isRetryable(error)).toBe(false);
        });
    });
});
