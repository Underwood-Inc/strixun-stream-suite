# OTP Auth Service - Industry Standards Compliance

This document outlines the industry standards and protocols that `auth.idling.app` follows, making it compatible with any application that needs authentication.

## Standards Compliance

### OAuth 2.0 (RFC 6749)
The service implements OAuth 2.0 token response format:

**Token Response (`POST /auth/verify-otp`):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 25200,
  "scope": "openid email profile",
  "sub": "user_abc123",
  "email": "user@example.com",
  "email_verified": true
}
```

**Standard Fields:**
- `access_token`: JWT token (RFC 7519)
- `token_type`: Always "Bearer"
- `expires_in`: Token expiration in seconds (7 hours = 25200)
- `scope`: OIDC scopes granted

### OpenID Connect (OIDC)
The service follows OIDC UserInfo endpoint format:

**UserInfo Response (`GET /auth/me`):**
```json
{
  "sub": "user_abc123",
  "email": "user@example.com",
  "email_verified": true,
  "iss": "auth.idling.app",
  "aud": "customer_id_or_default"
}
```

**Standard Claims:**
- `sub`: Subject identifier (user ID) - **Required**
- `email`: User's email address
- `email_verified`: Boolean indicating email verification status
- `iss`: Issuer identifier
- `aud`: Audience (customer/tenant ID)

### JWT Standard Claims (RFC 7519)
All JWT tokens include standard claims:

```json
{
  "sub": "user_abc123",        // Subject (user identifier)
  "iss": "auth.idling.app",    // Issuer
  "aud": "customer_id",        // Audience
  "exp": 1735689600,           // Expiration time (Unix timestamp)
  "iat": 1735664400,           // Issued at (Unix timestamp)
  "jti": "unique-token-id",    // JWT ID (unique token identifier)
  "email": "user@example.com",
  "email_verified": true
}
```

### RFC 7807 Problem Details for HTTP APIs
All error responses follow RFC 7807 standard:

**Error Response Format:**
```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
  "title": "Bad Request",
  "status": 400,
  "detail": "Valid email address required",
  "instance": "https://auth.idling.app/auth/request-otp"
}
```

**Common Error Types:**
- `400 Bad Request`: Invalid input (email, OTP format)
- `401 Unauthorized`: Invalid/expired token, invalid OTP
- `404 Not Found`: OTP not found or expired
- `429 Too Many Requests`: Rate limit or quota exceeded
- `500 Internal Server Error`: Server error

**Error Response Headers:**
- `Content-Type: application/problem+json`
- `WWW-Authenticate: Bearer` (for 401 errors)
- `Retry-After: 3600` (for 429 errors)

## API Endpoints

### POST `/auth/request-otp`
Request an OTP code via email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP sent to email",
  "expiresIn": 600,
  "remaining": 2
}
```

**Error Response (400/429):**
```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
  "title": "Bad Request",
  "status": 400,
  "detail": "Valid email address required",
  "instance": "https://auth.idling.app/auth/request-otp"
}
```

### POST `/auth/verify-otp`
Verify OTP code and receive access token.

**Request:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Success Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 25200,
  "scope": "openid email profile",
  "sub": "user_abc123",
  "email": "user@example.com",
  "email_verified": true
}
```

**Error Response (400/401/404/429):**
```json
{
  "type": "https://tools.ietf.org/html/rfc7235#section-3.1",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Invalid OTP code",
  "instance": "https://auth.idling.app/auth/verify-otp",
  "remaining_attempts": 4
}
```

### GET `/auth/me`
Get current user information (requires Bearer token).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Success Response (200):**
```json
{
  "sub": "user_abc123",
  "email": "user@example.com",
  "email_verified": true,
  "iss": "auth.idling.app",
  "aud": "customer_id"
}
```

**Error Response (401):**
```json
{
  "type": "https://tools.ietf.org/html/rfc7235#section-3.1",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Invalid or expired token",
  "instance": "https://auth.idling.app/auth/me"
}
```

### POST `/auth/logout`
Logout and revoke the current token.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST `/auth/refresh`
Refresh an expiring access token.

**Request:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 25200,
  "scope": "openid email profile"
}
```

## Multi-Tenant Support

The service supports multi-tenant usage via API keys:

**Request with API Key:**
```
X-OTP-API-Key: {api_key}
```

When an API key is provided:
- All data is isolated per customer
- Rate limits are per-customer
- JWT tokens include `customerId` in `aud` claim
- Quotas are enforced per-customer

**Without API Key:**
- Uses default tenant
- All data is isolated to default customer
- Suitable for single-application use

## Integration Examples

### JavaScript/TypeScript
```javascript
// Request OTP
const response = await fetch('https://auth.idling.app/auth/request-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});

// Verify OTP
const verifyResponse = await fetch('https://auth.idling.app/auth/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', otp: '123456' })
});

const { access_token } = await verifyResponse.json();

// Use token
const userResponse = await fetch('https://auth.idling.app/auth/me', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
```

### Python
```python
import requests

# Request OTP
response = requests.post('https://auth.idling.app/auth/request-otp', 
    json={'email': 'user@example.com'})

# Verify OTP
verify_response = requests.post('https://auth.idling.app/auth/verify-otp',
    json={'email': 'user@example.com', 'otp': '123456'})
access_token = verify_response.json()['access_token']

# Use token
user_response = requests.get('https://auth.idling.app/auth/me',
    headers={'Authorization': f'Bearer {access_token}'})
```

### cURL
```bash
# Request OTP
curl -X POST https://auth.idling.app/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'

# Verify OTP
curl -X POST https://auth.idling.app/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","otp":"123456"}'

# Get user info
curl https://auth.idling.app/auth/me \
  -H "Authorization: Bearer {access_token}"
```

## Security Features

- **JWT Tokens**: HMAC-SHA256 signed, 7-hour expiration
- **OTP Codes**: 6-digit, cryptographically secure, 10-minute expiration
- **Rate Limiting**: 3 OTP requests per email per hour
- **Attempt Limits**: 5 attempts per OTP code
- **CSRF Protection**: CSRF token included in JWT
- **CORS**: Configurable allowed origins
- **HTTPS Only**: All endpoints require HTTPS
- **Security Headers**: HSTS, X-Frame-Options, CSP, etc.

## Compatibility

This service is compatible with:
- ✅ OAuth 2.0 clients
- ✅ OpenID Connect (OIDC) clients
- ✅ Any application that can make HTTP requests
- ✅ Any language/framework (JavaScript, Python, Go, Rust, etc.)
- ✅ Mobile apps (iOS, Android)
- ✅ Desktop applications
- ✅ Server-to-server authentication

## Backward Compatibility

The service maintains backward compatibility with custom response formats:
- `token` field (deprecated, use `access_token`)
- `userId` field (deprecated, use `sub`)
- `success` field in responses

These fields are included alongside standard fields for compatibility with existing integrations.

