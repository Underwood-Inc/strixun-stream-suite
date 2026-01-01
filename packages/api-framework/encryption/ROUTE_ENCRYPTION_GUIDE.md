# Per-Route Encryption System Guide ★ > **Industry-standard encryption middleware that ensures ALL routes encrypt responses with appropriate keys based on route type and authentication status.**

---

## ★ Overview

The Per-Route Encryption System provides:

- **Mandatory Encryption**: All routes encrypt responses (defense in depth)
- **Route-Level Policies**: Different encryption strategies per route type
- **JWT-Based Encryption**: For authenticated routes (user's JWT token)
- **Service Key Encryption**: For public routes (shared service key)
- **Conditional Encryption**: Smart fallback between JWT and service key
- **Industry Standard**: Follows security best practices for API encryption

---

##  Architecture

### Encryption Strategies

1. **`jwt`** - Use JWT token (authenticated routes)
   - Requires valid JWT token in `Authorization` header
   - Encrypts with user's JWT token
   - Only the token holder can decrypt

2. **`service-key`** - Use service key (public routes)
   - Uses shared service key from environment
   - Encrypts with service key
   - Anyone with service key can decrypt

3. **`conditional-jwt`** - Smart fallback
   - Tries JWT first, falls back to service key
   - Best for routes that may or may not be authenticated

4. **`none`** - No encryption
   - Only for special cases (health checks, public docs)

### Default Policies

The system comes with sensible defaults:

```typescript
// Public routes - use service key
{ pattern: '/signup', strategy: 'service-key', mandatory: true }
{ pattern: '/signup/**', strategy: 'service-key', mandatory: true }
{ pattern: '/health/**', strategy: 'none' } // Health checks don't need encryption

// Auth routes - conditional
{ pattern: '/auth/request-otp', strategy: 'service-key', mandatory: true }
{ pattern: '/auth/**', strategy: 'conditional-jwt', mandatory: true }

// Protected routes - require JWT
{ pattern: '/user/**', strategy: 'jwt', mandatory: true }
{ pattern: '/game/**', strategy: 'jwt', mandatory: true }
{ pattern: '/admin/**', strategy: 'jwt', mandatory: true }

// Default catch-all
{ pattern: '/**', strategy: 'conditional-jwt', mandatory: false }
```

---

## ★ Quick Start

### 1. Use Middleware in Router

```typescript
import { applyEncryptionMiddleware } from '@strixun/api-framework';

// In your route handler
async function handleUserRoute(request: Request, env: Env): Promise<Response> {
  // Your handler logic
  const response = new Response(JSON.stringify({ data: '...' }), {
    headers: { 'Content-Type': 'application/json' },
  });

  // Apply encryption middleware
  return await applyEncryptionMiddleware(response, request, env);
}
```

### 3. Wrap Handler Function

```typescript
import { withEncryption } from '@strixun/api-framework';

// Wrap your handler
export const handleGetUser = withEncryption(async (request: Request, env: Env) => {
  const data = await getUserData();
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

---

## ★ Advanced Usage

### Custom Policies

Define service-specific encryption policies:

```typescript
import { 
  applyEncryptionMiddleware, 
  createServicePolicies,
  type RouteEncryptionPolicy 
} from '@strixun/api-framework';

const customPolicies: RouteEncryptionPolicy[] = [
  {
    pattern: '/api/public/**',
    strategy: 'service-key',
    mandatory: true,
  },
  {
    pattern: '/api/private/**',
    strategy: 'jwt',
    mandatory: true,
  },
  {
    pattern: '/api/mixed/**',
    strategy: 'conditional-jwt',
    mandatory: false,
  },
];

// Use in middleware
const encryptedResponse = await applyEncryptionMiddleware(
  response,
  request,
  env,
  { policies: customPolicies }
);
```

### Conditional Policies

Policies can have custom conditions:

```typescript
const conditionalPolicy: RouteEncryptionPolicy = {
  pattern: '/api/data/**',
  strategy: 'jwt',
  mandatory: true,
  condition: (request: Request) => {
    // Only apply to POST/PUT requests
    return ['POST', 'PUT'].includes(request.method);
  },
};
```

### Error Handling

Custom error handling for encryption failures:

```typescript
const encryptedResponse = await applyEncryptionMiddleware(
  response,
  request,
  env,
  {
    onEncryptionError: (error, context) => {
      // Log to monitoring service
      console.error('Encryption failed:', {
        error: error.message,
        path: context.path,
        method: context.method,
      });
      
      // Send alert
      sendAlert('Encryption failure', error);
    },
  }
);
```

---

## ★ Integration Examples

### Example 1: Update Existing Router

```typescript
// Before (conditional encryption)
async function handleUserRoute(handler, request, env, auth) {
  const handlerResponse = await handler(request, env);
  
  if (auth.jwtToken && handlerResponse.ok) {
    // Only encrypts if JWT present
    const encrypted = await encryptWithJWT(responseData, auth.jwtToken);
    return new Response(JSON.stringify(encrypted), { ... });
  }
  
  return handlerResponse; // ⚠ Unencrypted if no JWT
}

// After (mandatory encryption)
import { applyEncryptionMiddleware } from '@strixun/api-framework';

async function handleUserRoute(handler, request, env, auth) {
  const handlerResponse = await handler(request, env);
  
  // ✓ Always encrypts (JWT or service key)
  return await applyEncryptionMiddleware(handlerResponse, request, env);
}
```

### Example 2: Public Routes

```typescript
// Public signup route
async function handleSignup(request: Request, env: Env): Promise<Response> {
  const data = await createUser();
  
  const response = new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  // ✓ Encrypts with service key (no JWT required)
  return await applyEncryptionMiddleware(response, request, env);
}
```

### Example 3: Main Router Integration

```typescript
import { applyEncryptionMiddleware } from '@strixun/api-framework';

export async function route(request: Request, env: Env): Promise<Response> {
  // ... route matching logic ...
  
  let response: Response;
  
  // Handle different route types
  if (path.startsWith('/user/')) {
    response = await handleUserRoutes(request, path, env);
  } else if (path.startsWith('/auth/')) {
    response = await handleAuthRoutes(request, path, env);
  } else {
    response = await handlePublicRoutes(request, path, env);
  }
  
  // ✓ Apply encryption middleware to ALL responses
  return await applyEncryptionMiddleware(response, request, env);
}
```

---

## ★ Security Benefits

### Defense in Depth

- **Even if authentication is bypassed**, data is still encrypted
- **Multiple layers of protection** (authentication + encryption)
- **No plaintext data in transit** (industry standard)

### Key Isolation

- **Public routes** use service key (isolated from user keys)
- **Authenticated routes** use JWT (user-specific keys)
- **No key leakage** between route types

### Mandatory Encryption

- **Policy-based enforcement** (can't accidentally skip encryption)
- **Error on failure** (mandatory routes fail if encryption fails)
- **Consistent security** across all routes

---

## ★ Response Headers

Encrypted responses include:

- `X-Encrypted: true` - Indicates response is encrypted
- `X-Encryption-Strategy: jwt|service-key|none` - Strategy used

---

##  Configuration

### Environment Variables

```bash
# Required: Service encryption key (minimum 32 characters)
SERVICE_ENCRYPTION_KEY=your-strong-random-key-here
```

### Policy Configuration

Policies are defined in code and can be:
- **Service-specific**: Each service can define its own policies
- **Route-specific**: Different strategies per route pattern
- **Conditional**: Based on request properties

---

## ⚠ Important Notes

1. **Service Key Security**
   - Store service key as Cloudflare Worker secret
   - Never commit to version control
   - Rotate periodically (requires client updates)

2. **Mandatory vs Optional**
   - `mandatory: true` - Returns error if encryption fails
   - `mandatory: false` - Returns unencrypted if encryption fails (fallback)

3. **Performance**
   - Encryption adds ~10-50ms per response
   - PBKDF2 key derivation is CPU-intensive (100k iterations)
   - Consider caching for high-traffic routes

4. **Client Compatibility**
   - Clients must decrypt responses
   - Use `decryptWithJWT()` for JWT-encrypted responses
   - Use `decryptWithServiceKey()` for service-key-encrypted responses

---

## ★ Related Documentation

- [JWT Encryption](./jwt-encryption.ts) - JWT-based encryption
- [Multi-Stage Encryption](./multi-stage-encryption.ts) - Multi-party encryption
- [Encryption Types](./types.ts) - Type definitions

---

*Last Updated: 2024-12-25*

