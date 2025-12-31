# URL Shortener - Strixun Stream Suite

Cloudflare Worker for URL shortening with OTP authentication, click analytics, and standalone web interface.

## Features

- [OK] Secure OTP authentication using shared Strixun OTP component
- [OK] Create and manage short URLs
- [OK] Click analytics tracking
- [OK] Standalone web interface with Strixun branding
- [OK] Full encryption support for API responses
- [OK] Custom URL codes
- [OK] Automatic expiration support
- [OK] User-specific URL management

## Setup

### Prerequisites

- Cloudflare account
- Wrangler CLI installed
- Node.js 18+
- pnpm package manager

### Installation

```bash
cd serverless/url-shortener
pnpm install
```

### Configuration

1. **Create KV Namespaces:**
```bash
# Create URL storage namespace
wrangler kv namespace create "URL_SHORTENER_KV"

# Create analytics namespace
wrangler kv namespace create "URL_SHORTENER_ANALYTICS"
```

2. **Update `wrangler.toml`** with the KV namespace IDs

3. **Set Secrets:**
```bash
# JWT secret (must match OTP auth service)
wrangler secret put JWT_SECRET

# Optional: CORS allowed origins
wrangler secret put ALLOWED_ORIGINS
```

**Note:** The `JWT_SECRET` must match the one used in your OTP auth service for authentication to work.

## Local Development

### Quick Start

```bash
# From the url-shortener directory
cd serverless/url-shortener

# Build dependencies and start dev server
pnpm dev
```

The `predev` script automatically builds:
- Decryption library (`/decrypt.js`)
- OTP core library (`/otp-core.js`)
- OTP Login Svelte component (`/otp-login-svelte.js`)

### Manual Build (if needed)

```bash
# Build all dependencies
pnpm build:all

# Or build individually
pnpm build:decrypt      # Builds decryption library
pnpm build:otp-core     # Builds OTP core logic
pnpm build:otp-login    # Builds shared OTP Svelte component
```

### Development Server

```bash
# Start wrangler dev server (auto-builds dependencies first)
pnpm dev

# Or use explicit watch mode
pnpm dev:watch
```

The dev server will be available at `http://localhost:8787` (or the port wrangler assigns).

### Updating Shared OTP Component

If you make changes to the shared OTP component (`shared-components/otp-login/`), rebuild it:

```bash
# From url-shortener directory
pnpm build:otp-login

# Or from root
pnpm --filter @strixun/otp-login build
```

The `predev` script automatically rebuilds everything, so just restart `pnpm dev` after making changes.

## Production Deployment

```bash
# Build and deploy
pnpm deploy

# Or deploy to production environment
pnpm deploy:prod
```

## API Endpoints

### Web Interface

- `GET /` - Standalone web interface with OTP authentication

### API Endpoints (require authentication)

- `POST /api/create` - Create short URL
- `GET /api/list` - List user's URLs
- `GET /api/info/:code` - Get URL info
- `DELETE /api/delete/:code` - Delete URL

### Public Endpoints

- `GET /:code` - Redirect to original URL (public, tracks clicks)
- `GET /health` - Health check

## Request/Response Examples

### Create Short URL

```bash
curl -X POST https://s.idling.app/api/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/very/long/url",
    "customCode": "mycode",
    "expiresIn": 31536000
  }'
```

**Response:**
```json
{
  "success": true,
  "shortUrl": "https://s.idling.app/mycode",
  "shortCode": "mycode",
  "originalUrl": "https://example.com/very/long/url",
  "expiresAt": "2025-01-01T00:00:00.000Z"
}
```

### List URLs

```bash
curl https://s.idling.app/api/list \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "urls": [
    {
      "shortUrl": "https://s.idling.app/mycode",
      "shortCode": "mycode",
      "url": "https://example.com/very/long/url",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "clickCount": 42
    }
  ],
  "count": 1
}
```

### Get URL Info

```bash
curl https://s.idling.app/api/info/mycode \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "shortUrl": "https://s.idling.app/mycode",
  "shortCode": "mycode",
  "originalUrl": "https://example.com/very/long/url",
  "clickCount": 42,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "expiresAt": "2025-01-01T00:00:00.000Z"
}
```

### Delete URL

```bash
curl -X DELETE https://s.idling.app/api/delete/mycode \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Short URL deleted"
}
```

### Redirect (Public)

```bash
curl -I https://s.idling.app/mycode
# Returns 302 redirect to original URL
```

## Data Models

### URL Data (stored in KV)

```typescript
{
  url: string;                    // Original URL
  shortCode: string;              // Short code (3-20 chars)
  userId: string;                 // User ID from JWT
  email: string;                   // User email
  createdAt: string;              // ISO timestamp
  clickCount: number;             // Number of clicks
  expiresAt: string;              // ISO timestamp
}
```

### User URL List Entry

```typescript
{
  shortCode: string;              // Short code
  url: string;                    // Original URL
  createdAt: string;              // ISO timestamp
  clickCount: number;             // Number of clicks
}
```

**Note:** The user URL list stores a simplified version without `expiresAt` or user metadata.

### Create Request

```typescript
{
  url: string;                    // Required: URL to shorten
  customCode?: string;            // Optional: Custom short code (3-20 chars)
  expiresIn?: number;             // Optional: Expiration in seconds (max 10 years, default: 1 year)
}
```

**Note:** The `customCode` parameter name matches the API, but the request body uses `customCode` (camelCase).

## Storage

### KV Structure

- `url_{shortCode}` - URL data (with expiration TTL)
- `user_urls_{userId}` - List of short codes for a user
- `analytics_{shortCode}_{timestamp}` - Individual click analytics entries

### Analytics

Click tracking stores (per click):
- `shortCode` - The short code that was clicked
- `timestamp` - ISO timestamp of the click
- `userAgent` - User agent string (raw, not hashed)
- `referer` - Referrer header
- `ip` - IP address from Cloudflare (CF-Connecting-IP, raw, not hashed)

Analytics entries expire after 1 year (31536000 seconds).

## Authentication

All authenticated endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

The JWT token is obtained from the OTP auth service (`https://auth.idling.app`) and must use the same `JWT_SECRET`.

### OTP Authentication Flow

1. User enters email on standalone page
2. OTP code sent to email via OTP auth service
3. User enters OTP code
4. JWT token received and stored in localStorage
5. Token used for all API requests

## CORS

CORS is configured via the `ALLOWED_ORIGINS` environment variable. If not set, all origins are allowed (development only).

For production, set:
```bash
wrangler secret put ALLOWED_ORIGINS
# Paste: https://s.idling.app,https://idling.app,https://www.idling.app
```

## Error Handling

Most errors return JSON with this structure:

```json
{
  "error": "Error message"
}
```

Internal server errors (500) include additional details:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

Common errors:
- `400` - Bad Request (invalid URL, invalid code format, missing short code)
- `401` - Unauthorized (missing or invalid JWT token)
- `403` - Forbidden (user doesn't own the URL)
- `404` - Not Found (URL doesn't exist)
- `409` - Conflict (custom code already in use)
- `500` - Internal Server Error (includes `message` field with details)

## Encryption

All API responses are automatically encrypted when authenticated using JWT-based encryption. The client must decrypt responses using the bundled `decryptWithJWT` function from `/decrypt.js`.

Responses include an `X-Encrypted: true` header when encrypted.

## Security

- JWT token verification on all authenticated endpoints
- User-specific URL isolation (users can only see/manage their own URLs)
- URL validation (must be http:// or https://)
- Custom code validation (3-20 chars, alphanumeric + hyphens/underscores)
- CORS protection
- Input validation
- Encrypted API responses

## Performance

- KV for fast URL lookups (sub-millisecond)
- Automatic code generation with collision detection
- TTL-based expiration (automatic cleanup)
- Click analytics stored separately for performance

## Architecture

- **Worker**: `worker.ts` - Main entry point
- **Router**: `router/routes.js` - Request routing
- **Handlers**: `handlers/*.js` - Request handlers
- **App**: Svelte app in `app/` directory using shared OTP login component
- **Scripts**: `scripts/*.js` - Build scripts for dependencies
- **Utils**: `utils/*.js` - Utility functions (auth, CORS, URL validation)

## Dependencies

- `@strixun/api-framework` - Shared API framework
- `@strixun/otp-login` - Shared OTP login component (built at dev time)

## Notes

- The Svelte app uses the shared OTP login component from `@shared-components/otp-login`
- All API responses are encrypted when authenticated
- Custom URL codes must be 3-20 characters (letters, numbers, hyphens, underscores)
- URLs are stored in Cloudflare KV for fast lookups
- Default expiration is 1 year (configurable up to 10 years)
- Click analytics are tracked automatically on redirects

## License

Private - Strixun Stream Suite
