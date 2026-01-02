# URL Shortener Integration Guide

**Last Updated:** 2025-12-29

## Quick Start

1. **Set up KV namespaces:**
   ```bash
   cd serverless/url-shortener
   wrangler kv namespace create "URL_SHORTENER_KV"
   wrangler kv namespace create "URL_SHORTENER_ANALYTICS"
   ```

2. **Update `wrangler.toml` with the KV namespace IDs from step 1**

3. **Set JWT_SECRET (must match OTP auth service):**
   ```bash
   wrangler secret put JWT_SECRET
   ```

4. **Deploy:**
   ```bash
   npm install
   wrangler deploy
   ```

## Integration with Frontend

### Using the OTP Auth SDK

```typescript
import { OTPAuth } from '@strixun/otp-auth-sdk';

// Initialize OTP auth
const auth = new OTPAuth({
  apiUrl: 'https://your-otp-auth-service.workers.dev',
});

// Authenticate user
const token = await auth.login(email, otp);

// Use token with URL shortener
const response = await fetch('https://s.yourdomain.com/api/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    url: 'https://example.com/very/long/url',
    customCode: 'mycode'
  })
});
```

### Svelte Component Example

```svelte
<script lang="ts">
  import { authStore } from '@/stores/auth';
  
  let url = '';
  let customCode = '';
  let shortUrl = '';
  let error = '';
  
  async function createShortUrl() {
    const token = $authStore.token;
    if (!token) {
      error = 'Please log in first';
      return;
    }
    
    try {
      const response = await fetch('https://s.yourdomain.com/api/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url,
          customCode: customCode || undefined
        })
      });
      
      const data = await response.json();
      if (data.success) {
        shortUrl = data.shortUrl;
        error = '';
      } else {
        error = data.error || 'Failed to create short URL';
      }
    } catch (e) {
      error = 'Network error';
    }
  }
</script>

<div class="url-shortener">
  <input type="url" bind:value={url} placeholder="Enter URL to shorten" />
  <input type="text" bind:value={customCode} placeholder="Custom code (optional)" />
  <button on:click={createShortUrl}>Shorten</button>
  
  {#if shortUrl}
    <div class="result">
      <p>Short URL: <a href={shortUrl} target="_blank">{shortUrl}</a></p>
    </div>
  {/if}
  
  {#if error}
    <div class="error">{error}</div>
  {/if}
</div>
```

## API Endpoints Summary

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/api/create` | Yes | Create a short URL |
| GET | `/api/info/:shortCode` | Yes | Get URL info (must own) |
| GET | `/api/list` | Yes | List user's URLs |
| DELETE | `/api/delete/:shortCode` | Yes | Delete URL (must own) |
| GET | `/:shortCode` | No | Redirect to original URL |
| GET | `/health` | No | Health check |

## Error Codes

- `400` - Bad Request (invalid URL, invalid code format)
- `401` - Unauthorized (missing or invalid JWT token)
- `403` - Forbidden (user doesn't own the URL)
- `404` - Not Found (short code doesn't exist)
- `409` - Conflict (custom code already in use)
- `500` - Internal Server Error

## Best Practices

1. **Always validate URLs** on the frontend before sending to the API
2. **Store JWT tokens securely** (httpOnly cookies or secure storage)
3. **Handle token expiration** - redirect to login when token expires
4. **Show loading states** when creating/deleting URLs
5. **Display click counts** to show URL performance
6. **Use custom codes** for memorable, branded links

## Rate Limiting

Cloudflare Workers free tier includes:
- 100,000 requests/day
- 10ms CPU time per request
- 50ms CPU time per request (paid tier)

For production use, consider upgrading to Cloudflare Workers paid tier for higher limits.
