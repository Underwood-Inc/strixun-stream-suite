# @strixun/error-utils

Framework-agnostic error handling utilities with RFC 7807 Problem Details support, strong typing, and composable error transformations.

## Features

- **RFC 7807 Compliant** - Full implementation of Problem Details for HTTP APIs
- **Strongly Typed** - Generic types for error data and extensions
- **Framework Agnostic** - Works with Cloudflare Workers, Node.js, Deno, and browsers
- **Composable Transformers** - Pipeline-based error transformation
- **Type Guards** - Runtime type checking utilities
- **Zero Dependencies** - No external runtime dependencies

## Installation

```bash
pnpm add @strixun/error-utils
```

## Quick Start

### Creating Errors

```typescript
import {
  createNotFoundError,
  createValidationError,
  createRateLimitError,
} from '@strixun/error-utils';

// Simple not found error
const userError = createNotFoundError('User', '123');
// { status: 404, code: 'user_not_found', message: "User with ID '123' was not found" }

// Validation error with field details
const validationError = createValidationError({
  message: 'Request validation failed',
  errors: [
    { field: 'email', message: 'Invalid email format' },
    { field: 'age', message: 'Must be a positive number', value: -5 },
  ],
});

// Rate limit error with retry information
const rateLimitError = createRateLimitError('Too many requests', 30000);
```

### Building Responses

```typescript
import { buildWebResponse, buildErrorResponseWithCors } from '@strixun/error-utils';

// In a Cloudflare Worker
export default {
  async fetch(request: Request): Promise<Response> {
    try {
      // ... handle request
    } catch (error) {
      return buildWebResponse(error, {
        url: request.url,
        requestId: request.headers.get('X-Request-ID'),
        environment: 'production',
      });
    }
  }
}
```

Response body (RFC 7807 format):

```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.4",
  "title": "Not Found",
  "status": 404,
  "detail": "User with ID '123' was not found",
  "instance": "https://api.example.com/users/123",
  "extensions": {
    "errorCode": "user_not_found",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "traceId": "abc-123-xyz"
  }
}
```

## API Reference

### Error Factory Functions

| Function | Status | Description |
|----------|--------|-------------|
| `createError(options)` | Custom | Create error with full options |
| `createNotFoundError(resource, id?)` | 404 | Resource not found |
| `createUnauthorizedError(message?)` | 401 | Authentication required |
| `createForbiddenError(message?)` | 403 | Access denied |
| `createValidationError(options)` | 422 | Validation failed |
| `createBadRequestError(message, code?)` | 400 | Bad request |
| `createConflictError(message, resource?)` | 409 | Resource conflict |
| `createRateLimitError(message?, retryMs?)` | 429 | Rate limit exceeded |
| `createInternalError(message?, cause?)` | 500 | Internal server error |
| `createServiceUnavailableError(message?, retryMs?)` | 503 | Service unavailable |
| `createTimeoutError(message?)` | 504 | Request timeout |
| `createExternalServiceError(service, cause?)` | 502 | External service failed |
| `createConfigurationError(message, config?)` | 500 | Configuration error |

### RFC 7807 Functions

```typescript
import {
  createRFC7807,
  createRFC7807WithContext,
  createValidationRFC7807,
  createRateLimitRFC7807,
} from '@strixun/error-utils/rfc7807';

// Basic RFC 7807 error
const error = createRFC7807(404, 'User not found', {
  instance: '/api/users/123',
  extensions: { userId: '123' },
});

// With request context
const errorWithContext = createRFC7807WithContext(
  400,
  'Invalid request',
  { url: '/api/users', requestId: 'req-123' }
);
```

### Transformers

Composable transformers for error processing pipelines:

```typescript
import {
  createTransformerPipeline,
  normalizeError,
  addTraceId,
  sanitizeForProduction,
  maskSensitiveFields,
  withStatus,
  withRetry,
} from '@strixun/error-utils/transformers';

// Create a custom pipeline
const processError = createTransformerPipeline(
  normalizeError,           // Convert any error to ApplicationError
  addTraceId,               // Add trace ID from context
  maskSensitiveFields,      // Mask passwords, tokens, etc.
  sanitizeForProduction,    // Remove stack traces in production
);

const processed = processError(error, context);
```

### Type Guards

Runtime type checking for error handling:

```typescript
import {
  isAppError,
  isRFC7807Error,
  isValidationError,
  isRetryable,
  isClientErrorStatus,
  isServerErrorStatus,
  assertApplicationError,
} from '@strixun/error-utils/guards';

// Type guard usage
if (isRFC7807Error(response.body)) {
  console.log('RFC 7807 error:', response.body.detail);
}

// Assertion (throws if not valid)
assertApplicationError(error);
// error is now typed as ApplicationError
```

### Response Builders

```typescript
import {
  buildWebResponse,
  buildWebResponseWithCors,
  buildSimpleWebResponse,
  buildCorsHeaders,
} from '@strixun/error-utils/response';

// Standard RFC 7807 response
const response = buildWebResponse(error, context);

// With CORS headers
const corsResponse = buildWebResponseWithCors(error, origin, context, {
  allowedOrigins: ['https://app.example.com'],
  credentials: true,
});

// Simple { error: "message" } format (legacy compatibility)
const simpleResponse = buildSimpleWebResponse(400, 'Bad request');
```

## Types

### ApplicationError

```typescript
interface ApplicationError<TData = unknown> {
  name: string;
  message: string;
  status: HTTPStatusCode;
  category: ErrorCategory;
  code: string;
  cause?: Error | unknown;
  data?: TData;
  stack?: string;
  isOperational: boolean;
  retryable: boolean;
  retryAfterMs?: number;
  timestamp: string;
}
```

### RFC7807Error

```typescript
interface RFC7807Error<TExtensions = Record<string, unknown>> {
  type: string;           // URI reference identifying the problem type
  title: string;          // Short, human-readable summary
  status: HTTPStatusCode; // HTTP status code
  detail: string;         // Human-readable explanation
  instance?: string;      // URI reference for this occurrence
  extensions?: TExtensions;
}
```

### ErrorCategory

```typescript
type ErrorCategory =
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'rate_limit'
  | 'server'
  | 'network'
  | 'timeout'
  | 'configuration'
  | 'external_service'
  | 'business_logic'
  | 'unknown';
```

## Subpath Exports

For tree-shaking and smaller bundles:

```typescript
// Types only
import type { ApplicationError, RFC7807Error } from '@strixun/error-utils/types';

// RFC 7807 only
import { createRFC7807 } from '@strixun/error-utils/rfc7807';

// Factory only
import { createNotFoundError } from '@strixun/error-utils/factory';

// Transformers only
import { toRFC7807 } from '@strixun/error-utils/transformers';

// Response builders only
import { buildWebResponse } from '@strixun/error-utils/response';

// Type guards only
import { isRFC7807Error } from '@strixun/error-utils/guards';
```

## Migration from Existing Error Handling

### From Simple `{ error: "..." }` Format

```typescript
// Before
return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

// After
import { createNotFoundError, buildWebResponse } from '@strixun/error-utils';

const error = createNotFoundError('Resource');
return buildWebResponse(error, { url: request.url });

// Or with backward compatibility
return buildWebResponse(error, context, { includeBackwardCompatError: true });
// Response includes both "detail" and "error" fields
```

### From Custom Error Classes

```typescript
// Before
class CustomError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// After
import { AppError, createError } from '@strixun/error-utils';

// Use AppError directly
const error = new AppError({
  message: 'Custom error',
  status: 400,
  category: 'business_logic',
  code: 'custom_error',
});

// Or extend AppError for domain-specific errors
class DomainError extends AppError {
  constructor(message: string, public readonly domainCode: string) {
    super({
      message,
      status: 400,
      category: 'business_logic',
      code: domainCode,
    });
  }
}
```

## Best Practices

1. **Use specific factory functions** - `createNotFoundError('User', id)` is clearer than `createError({ ... })`

2. **Include request context** - Always pass `url` and `requestId` for debugging

3. **Differentiate operational vs programmer errors** - Set `isOperational: false` for bugs

4. **Use transformers in pipelines** - Compose error processing logic

5. **Sanitize in production** - Use `sanitizeForProduction` transformer

6. **Include error codes** - Make errors programmatically identifiable

## License

ISC
