# OTP Authentication Service

**Production-ready multi-tenant OTP (One-Time Password) authentication service** built on Cloudflare Workers.

## 🚀 Features

### Core Authentication
- ✅ Email-based OTP authentication (no passwords)
- ✅ JWT token generation and validation (7-hour expiration)
- ✅ Token refresh and blacklisting
- ✅ CSRF protection
- ✅ Secure 6-digit cryptographically random OTP codes
- ✅ 10-minute OTP expiration
- ✅ Single-use OTP codes
- ✅ 5 attempt limit per OTP

### Multi-Tenancy
- ✅ Complete customer data isolation
- ✅ Per-customer API keys with rotation
- ✅ Per-customer configuration
- ✅ Per-customer rate limiting
- ✅ Per-customer CORS settings
- ✅ Per-customer IP allowlisting
- ✅ Customer status management

### Email System
- ✅ Custom email templates (HTML & text)
- ✅ Template variables (`{{otp}}`, `{{appName}}`, etc.)
- ✅ Domain verification via DNS
- ✅ Multiple email provider support (Resend, SendGrid, AWS SES)
- ✅ Customer-specific email providers

### Usage & Analytics
- ✅ Real-time usage tracking
- ✅ Daily and monthly quotas
- ✅ Analytics endpoints with date ranges
- ✅ Response time tracking (p50, p95, p99)
- ✅ Error tracking and categorization
- ✅ Success rate calculations

### Webhooks
- ✅ Event system (8 event types)
- ✅ HMAC-SHA256 signature verification
- ✅ Event subscription filtering
- ✅ Retry queue for failed deliveries

### Security
- ✅ Security audit logging (90-day retention)
- ✅ API key rotation with grace period
- ✅ IP allowlisting (exact and CIDR)
- ✅ GDPR compliance (data export/deletion)
- ✅ Failed authentication tracking

### Self-Service
- ✅ Public signup flow
- ✅ Email verification
- ✅ Onboarding wizard endpoints
- ✅ Customer dashboard endpoints

### Infrastructure
- ✅ Health check endpoints (health, ready, live)
- ✅ Request caching (5-minute TTL)
- ✅ Error rate monitoring and alerts
- ✅ Performance metrics

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

## 📚 Documentation

- **API Documentation**: See `docs/OTP_AUTH_API_DOCUMENTATION.md`
- **Integration Guide**: See `INTEGRATION_GUIDE.md`
- **User Stories**: See `docs/OTP_AUTH_USER_STORIES.md`
- **SDK**: See `sdk/README.md`
- **Examples**: See `examples/` directory

## 🔌 API Endpoints

### Public Endpoints
- `POST /signup` - Public customer signup
- `POST /signup/verify` - Verify signup email
- `GET /health` - Health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

### Authentication Endpoints
- `POST /auth/request-otp` - Request OTP code
- `POST /auth/verify-otp` - Verify OTP and get JWT
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - Logout and revoke token
- `POST /auth/refresh` - Refresh JWT token

### Customer Management
- `GET /admin/customers/me` - Get current customer
- `PUT /admin/customers/me` - Update customer info
- `GET /admin/config` - Get configuration
- `PUT /admin/config` - Update configuration
- `PUT /admin/config/email` - Update email config

### API Key Management
- `GET /admin/customers/{customerId}/api-keys` - List keys
- `POST /admin/customers/{customerId}/api-keys` - Create key
- `POST /admin/customers/{customerId}/api-keys/{keyId}/rotate` - Rotate key
- `DELETE /admin/customers/{customerId}/api-keys/{keyId}` - Revoke key

### Domain Verification
- `POST /admin/domains/verify` - Request verification
- `GET /admin/domains/{domain}/status` - Get status
- `POST /admin/domains/{domain}/verify` - Verify DNS

### Analytics
- `GET /admin/analytics` - Get usage analytics
- `GET /admin/analytics/realtime` - Real-time metrics
- `GET /admin/analytics/errors` - Error analytics

### Onboarding
- `GET /admin/onboarding` - Get onboarding status
- `PUT /admin/onboarding` - Update onboarding
- `POST /admin/onboarding/test-otp` - Test OTP

### GDPR
- `GET /admin/users/{userId}/export` - Export user data
- `DELETE /admin/users/{userId}` - Delete user data

### Audit Logs
- `GET /admin/audit-logs` - Get security audit logs

### Example: POST `/auth/request-otp`
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

## 📦 SDK

TypeScript/JavaScript SDK available in `sdk/` directory:

```typescript
import { OTPAuth } from '@otpauth/sdk';

const client = new OTPAuth({
  apiKey: 'otp_live_sk_...',
  baseUrl: 'https://otp-auth-service.workers.dev'
});
```

## 📝 Code Examples

See `examples/` directory for:
- React integration
- Node.js/Express integration
- Svelte integration
- Python/Flask integration

## 🎯 Production Ready

This service is **fully productized** and ready for customers:
- ✅ Multi-tenant architecture
- ✅ White-label capabilities
- ✅ Usage tracking and quotas
- ✅ Webhook integrations
- ✅ Security and compliance
- ✅ Self-service onboarding
- ✅ Complete documentation
- ✅ SDK and examples

## 📊 Implementation Status

**All core epics completed!** See `docs/OTP_AUTH_IMPLEMENTATION_COMPLETE.md` for full status.

## License

Part of Strixun Stream Suite

