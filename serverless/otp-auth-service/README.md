# OTP Authentication Service

Standalone multi-tenant OTP (One-Time Password) authentication service built on Cloudflare Workers.

## Features

- ✅ Email-based OTP authentication (no passwords)
- ✅ JWT token generation and validation
- ✅ Rate limiting (3 requests per email per hour)
- ✅ Secure 6-digit OTP codes
- ✅ Session management
- ✅ Multi-tenant ready (customer isolation infrastructure)
- ✅ CORS support

## Setup

### 1. Create KV Namespace

```bash
cd serverless/otp-auth-service
wrangler kv namespace create "OTP_AUTH_KV"
```

Copy the returned namespace ID and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "OTP_AUTH_KV"
id = "your-namespace-id-here"
```

### 2. Set Secrets

```bash
# JWT secret for token signing (required)
wrangler secret put JWT_SECRET
# Enter a long random string (e.g., from: openssl rand -hex 32)

# Resend API key for email sending (required)
wrangler secret put RESEND_API_KEY
# Get from: https://resend.com/api-keys

# From email address (required)
wrangler secret put RESEND_FROM_EMAIL
# Must be a verified domain email (e.g., noreply@yourdomain.com)

# Allowed CORS origins (optional)
wrangler secret put ALLOWED_ORIGINS
# Comma-separated: https://app1.com,https://app2.com
# If not set, allows all origins (development only)
```

### 3. Deploy

```bash
wrangler deploy
```

## API Endpoints

### POST `/auth/request-otp`
Request an OTP code to be sent to an email address.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to email",
  "expiresIn": 600,
  "remaining": 2
}
```

### POST `/auth/verify-otp`
Verify an OTP code and get a JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user_abc123",
  "email": "user@example.com",
  "expiresAt": "2025-01-01T07:00:00.000Z"
}
```

### GET `/auth/me`
Get current user information (requires JWT token).

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "userId": "user_abc123",
  "email": "user@example.com",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "lastLogin": "2025-01-01T00:00:00.000Z"
}
```

### POST `/auth/logout`
Logout and revoke the current token.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST `/auth/refresh`
Refresh an expiring JWT token.

**Request:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2025-01-01T07:00:00.000Z"
}
```

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "otp-auth-service",
  "version": "1.0.0"
}
```

## Security Features

- **6-digit OTP codes** (1,000,000 combinations)
- **Cryptographically secure random** generation
- **10-minute expiration** (auto-deleted from KV)
- **Single-use only** (deleted after verification)
- **5 attempt limit** per OTP (prevents brute force)
- **Rate limiting** (3 requests per email per hour)
- **JWT tokens** (HMAC-SHA256 signed)
- **7-hour token expiration**
- **Token blacklist** (for logout/revocation)
- **CSRF protection** (CSRF token in JWT)

## Multi-Tenant Architecture

The service is designed for multi-tenancy with customer isolation:

- All KV keys are prefixed with `cust_{customerId}_` when customer ID is available
- Customer ID is included in JWT tokens
- Rate limiting is per-customer
- Data is completely isolated between customers

**Note:** API key authentication for multi-tenancy is coming in Story 1.2 and 1.3.

## Development

### Local Testing

```bash
# Start local dev server
wrangler dev

# Test endpoints
curl -X POST http://localhost:8787/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Environment Variables

For local development, create a `.dev.vars` file (not committed to git):

```env
JWT_SECRET=your-local-secret-key
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
ENVIRONMENT=development
```

## Migration from Main Worker

This service was extracted from the main `strixun-twitch-api` worker. The main worker can optionally proxy to this service for backward compatibility during migration.

## Next Steps

See `docs/OTP_AUTH_USER_STORIES.md` for the full productization roadmap:

- **Story 1.2**: Implement Customer API Key System
- **Story 1.3**: Add API Key Authentication Middleware
- **Story 1.4**: Implement Customer KV Namespace Isolation (partially done)
- **Story 1.5**: Create Customer Registration Endpoint

## License

Part of Strixun Stream Suite

