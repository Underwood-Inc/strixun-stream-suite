# URL Shortener Integration Guide

> **Complete guide for integrating URL Shortener with other services**

**Date:** 2025-12-29

---

## Overview

This guide covers integrating the URL Shortener service with other parts of the Strixun Stream Suite, including authentication, API usage, and frontend integration.

---

## Authentication Integration

### OTP Auth Service Integration

The URL Shortener uses the OTP Auth Service for authentication. Both services must share the same `JWT_SECRET`:

```bash
# Both services must use the SAME JWT_SECRET
cd serverless/otp-auth-service
wrangler secret put JWT_SECRET
# Enter your JWT secret

cd ../url-shortener
wrangler secret put JWT_SECRET
# Enter the SAME JWT secret
```

### Authentication Flow

1. User visits `https://s.idling.app/`
2. User enters email address
3. OTP code sent via `auth.idling.app` (OTP Auth Service)
4. User enters OTP code
5. JWT token received and stored in localStorage
6. Token used for all authenticated API requests

---

## API Integration

### Using URL Shortener API from Other Services

```typescript
import { createAPIClient } from '@strixun/api-framework/client';

const urlShortenerApi = createAPIClient({
  baseURL: 'https://s.idling.app',
});

// Create short URL
const response = await urlShortenerApi.post('/api/create', {
  url: 'https://example.com/very/long/url',
  customCode: 'mycode', // optional
  expiresIn: 31536000, // optional, in seconds
}, {
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
  },
});

const { shortUrl, shortCode } = await response.json();
```

### Service-to-Service Authentication

If calling from another worker, you can use service API keys (if implemented):

```typescript
const response = await fetch('https://s.idling.app/api/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Key': env.SERVICE_API_KEY, // If service-to-service auth is implemented
  },
  body: JSON.stringify({
    url: 'https://example.com',
  }),
});
```

---

## Frontend Integration

### Standalone Web Interface

The URL Shortener includes a standalone Svelte app that works independently:

- **URL**: `https://s.idling.app/`
- **Authentication**: OTP via `auth.idling.app`
- **Features**: Create, list, view, and delete short URLs
- **Token Storage**: localStorage

### Embedding in Other Apps

You can embed the URL Shortener functionality in other apps:

```typescript
// In your app
import { createAPIClient } from '@strixun/api-framework/client';

const urlShortenerApi = createAPIClient({
  baseURL: 'https://s.idling.app',
});

async function shortenUrl(longUrl: string, jwtToken: string) {
  const response = await urlShortenerApi.post('/api/create', {
    url: longUrl,
  }, {
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
    },
  });
  
  const { shortUrl } = await response.json();
  return shortUrl;
}
```

---

## CORS Configuration

The URL Shortener must have `ALLOWED_ORIGINS` configured to allow requests from your frontend:

```bash
cd serverless/url-shortener
wrangler secret put ALLOWED_ORIGINS
# Enter: https://s.idling.app,https://idling.app,https://www.idling.app,http://localhost:5173
```

See [CORS Configuration Guide](../04_DEPLOYMENT/CORS_CONFIGURATION_GUIDE.md) for complete setup.

---

## Environment Variables

### Required

- `JWT_SECRET` - Must match OTP auth service

### Optional

- `ALLOWED_ORIGINS` - CORS allowed origins
- `SERVICE_ENCRYPTION_KEY` - For encrypted OTP requests (if using encryption)

---

## Data Flow

### Creating a Short URL

```
1. User enters long URL in frontend
2. Frontend sends POST /api/create with JWT token
3. Worker validates JWT token
4. Worker generates short code (or uses custom code)
5. Worker stores in KV: url_{shortCode}
6. Worker stores in user's URL list: user_urls_{userId}
7. Worker returns short URL to frontend
```

### Redirecting a Short URL

```
1. User clicks short URL: https://s.idling.app/abc123
2. Worker receives GET /abc123
3. Worker looks up url_abc123 in KV
4. Worker increments click count
5. Worker stores analytics entry
6. Worker returns 302 redirect to original URL
```

---

## Analytics Integration

Click analytics are stored in the `ANALYTICS_KV` namespace:

- Key format: `analytics_{shortCode}_{timestamp}`
- Data: `{ shortCode, timestamp, userAgent, referer, ip }`
- TTL: 1 year (31536000 seconds)

To retrieve analytics:

```typescript
// List all analytics for a short code
const analytics = await env.ANALYTICS_KV.list({
  prefix: `analytics_${shortCode}_`,
});
```

---

## Best Practices

1. **Always use HTTPS** - All API calls should use HTTPS
2. **Validate JWT tokens** - Check token expiration and signature
3. **Handle errors gracefully** - API may return 401, 403, 404, 409 errors
4. **Use API framework** - Use `createAPIClient` for automatic retry and error handling
5. **Respect rate limits** - Consider implementing rate limiting for production

---

## Related Documentation

- [URL Shortener README](../07_SERVICES/URL_SHORTENER_README.md) - Complete API documentation
- [URL Shortener Setup](../07_SERVICES/URL_SHORTENER_SETUP.md) - Setup instructions
- [CORS Configuration Guide](../04_DEPLOYMENT/CORS_CONFIGURATION_GUIDE.md) - CORS setup

---

**Last Updated**: 2025-12-29

