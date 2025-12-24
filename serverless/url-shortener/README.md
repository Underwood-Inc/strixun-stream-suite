# Strixun URL Shortener Service

A free, self-hosted URL shortener built with Cloudflare Workers and integrated with the Strixun OTP authentication system.

## Features

- ✅ **Free URL Shortening** - Create short links for any URL
- ✅ **OTP Authentication** - Integrated with Strixun OTP auth system
- ✅ **Custom Short Codes** - Use your own custom codes (3-20 characters)
- ✅ **Click Analytics** - Track clicks on your shortened URLs
- ✅ **User Management** - List, view, and delete your shortened URLs
- ✅ **Expiration Support** - Set expiration times for URLs (default: 1 year)
- ✅ **Secure** - JWT-based authentication, CORS support, security headers
- ✅ **Fast** - Edge computing with Cloudflare Workers
- ✅ **Free** - Uses Cloudflare's free tier (100,000 requests/day)
- ✅ **Standalone Web Interface** - Full-featured HTML page with integrated OTP auth (no main app required)

## Setup

### Prerequisites

1. Cloudflare account with Workers enabled
2. Wrangler CLI installed: `npm install -g wrangler`
3. Access to your OTP auth service (to share JWT_SECRET)

### Installation

1. **Navigate to the URL shortener directory:**
   ```bash
   cd serverless/url-shortener
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create KV namespaces:**
   ```bash
   # Create main URL storage namespace
   wrangler kv namespace create "URL_SHORTENER_KV"
   
   # Create analytics namespace
   wrangler kv namespace create "URL_SHORTENER_ANALYTICS"
   ```

4. **Update `wrangler.toml` with your KV namespace IDs:**
   - After creating the namespaces, copy the IDs from the output
   - Update the `id` and `preview_id` fields in `wrangler.toml`

5. **Set environment secrets:**
   ```bash
   # IMPORTANT: Use the SAME JWT_SECRET as your OTP auth service
   wrangler secret put JWT_SECRET
   
   # Optional: Set allowed origins for CORS (comma-separated)
   wrangler secret put ALLOWED_ORIGINS
   ```

6. **Deploy the worker:**
   ```bash
   wrangler deploy
   ```

### Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Workers & Pages → strixun-url-shortener
2. Go to Settings → Triggers → Routes
3. Add custom domain route (e.g., `s.yourdomain.com/*` or `short.yourdomain.com/*`)
4. Update DNS records as instructed by Cloudflare

## Standalone Web Interface

A fully self-contained HTML page (`standalone.html`) is included that provides a complete URL shortener interface with integrated OTP authentication. Users can access this page directly without needing to load the main streaming suite application.

### Features

- ✅ **Complete OTP Authentication Flow** - Request and verify OTP codes directly in the page
- ✅ **URL Management** - Create, list, and delete short URLs
- ✅ **Modern UI** - Clean, responsive design with dark theme
- ✅ **Token Persistence** - JWT tokens stored in localStorage for automatic sign-in
- ✅ **Real-time Feedback** - Toast notifications for all actions
- ✅ **Mobile Responsive** - Works on all device sizes

### Deployment Options

#### Option 1: Cloudflare Pages (Recommended)

1. **Create a Cloudflare Pages project:**
   ```bash
   # In the url-shortener directory
   mkdir pages
   cp standalone.html pages/index.html
   ```

2. **Deploy to Cloudflare Pages:**
   - Go to Cloudflare Dashboard → Pages
   - Create a new project
   - Connect your repository or upload the `pages` folder
   - Set build command: (none needed, static HTML)
   - Set output directory: `pages`

3. **Configure custom domain:**
   - In Pages settings, add custom domain (e.g., `short.yourdomain.com`)
   - DNS will be automatically configured

#### Option 2: Static Hosting

Simply upload `standalone.html` to any static hosting service:
- GitHub Pages
- Netlify
- Vercel
- Your own web server

#### Option 3: Serve from Worker (Advanced)

You can modify the worker to serve the HTML file directly, but Cloudflare Pages is recommended for better performance.

### Configuration

Before using the standalone page, update the API URLs in `standalone.html`:

```javascript
// Update these constants at the top of the <script> section
const OTP_AUTH_API_URL = 'https://auth.idling.app';  // Your OTP auth service URL
const URL_SHORTENER_API_URL = 'https://s.idling.app'; // Your URL shortener service URL
```

### Usage

1. **Open the standalone page** in a web browser
2. **Enter your email address** and click "Send OTP Code"
3. **Check your email** for the 6-digit OTP code
4. **Enter the OTP code** and click "Verify & Sign In"
5. **Start creating short URLs!**

The page will automatically:
- Store your authentication token in localStorage
- Remember you for future visits
- Load your existing short URLs
- Handle token expiration gracefully

### Accessing the Standalone Page

Once deployed, users can access the URL shortener at:
- `https://short.yourdomain.com` (if using Cloudflare Pages with custom domain)
- `https://your-pages-project.pages.dev` (Cloudflare Pages default URL)
- Or wherever you've hosted the HTML file

## API Reference

### Authentication

All API endpoints (except redirects) require authentication using JWT tokens from the OTP auth service.

Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Endpoints

#### Create Short URL
**POST** `/api/create`

Create a new short URL. Requires authentication.

**Request Body:**
```json
{
  "url": "https://example.com/very/long/url",
  "customCode": "mycode",  // Optional: custom short code (3-20 chars)
  "expiresIn": 31536000    // Optional: expiration in seconds (default: 1 year)
}
```

**Response:**
```json
{
  "success": true,
  "shortUrl": "https://s.yourdomain.com/abc123",
  "shortCode": "abc123",
  "originalUrl": "https://example.com/very/long/url",
  "expiresAt": "2025-01-01T00:00:00.000Z"
}
```

#### Get URL Info
**GET** `/api/info/:shortCode`

Get information about a short URL. Requires authentication and ownership.

**Response:**
```json
{
  "success": true,
  "shortUrl": "https://s.yourdomain.com/abc123",
  "shortCode": "abc123",
  "originalUrl": "https://example.com/very/long/url",
  "clickCount": 42,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "expiresAt": "2025-01-01T00:00:00.000Z"
}
```

#### List User's URLs
**GET** `/api/list`

List all short URLs created by the authenticated user.

**Response:**
```json
{
  "success": true,
  "urls": [
    {
      "shortCode": "abc123",
      "url": "https://example.com/very/long/url",
      "shortUrl": "https://s.yourdomain.com/abc123",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "clickCount": 42
    }
  ],
  "count": 1
}
```

#### Delete Short URL
**DELETE** `/api/delete/:shortCode`

Delete a short URL. Requires authentication and ownership.

**Response:**
```json
{
  "success": true,
  "message": "Short URL deleted"
}
```

#### Redirect (Public)
**GET** `/:shortCode`

Redirect to the original URL. Public endpoint, no authentication required.

**Response:** HTTP 302 redirect to the original URL

#### Health Check
**GET** `/health`

Check if the service is running.

**Response:**
```json
{
  "status": "ok",
  "service": "url-shortener",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Usage Examples

### JavaScript/TypeScript

```javascript
// Get JWT token from OTP auth service first
const token = await getOTPToken(); // Your OTP auth implementation

// Create a short URL
const response = await fetch('https://s.yourdomain.com/api/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    url: 'https://example.com/very/long/url',
    customCode: 'mycode' // Optional
  })
});

const data = await response.json();
console.log(data.shortUrl); // https://s.yourdomain.com/mycode

// List all your URLs
const listResponse = await fetch('https://s.yourdomain.com/api/list', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const listData = await listResponse.json();
console.log(listData.urls);
```

### cURL

```bash
# Create short URL
curl -X POST https://s.yourdomain.com/api/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"url": "https://example.com/very/long/url", "customCode": "mycode"}'

# List URLs
curl https://s.yourdomain.com/api/list \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get URL info
curl https://s.yourdomain.com/api/info/mycode \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Delete URL
curl -X DELETE https://s.yourdomain.com/api/delete/mycode \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Integration with OTP Auth

This service uses the same JWT tokens as your OTP auth service. Users authenticate through the OTP auth service and receive a JWT token, which they can then use to access the URL shortener API.

### Authentication Flow

1. User requests OTP from OTP auth service
2. User verifies OTP and receives JWT token
3. User uses JWT token to authenticate with URL shortener API
4. URL shortener verifies JWT token using shared JWT_SECRET

**Important:** The `JWT_SECRET` must be the same in both services for authentication to work.

## Development

### Local Development

```bash
# Start local development server
npm run dev

# The worker will be available at http://localhost:8787
```

### Deploy

```bash
# Deploy to production
npm run deploy

# View logs
npm run tail
```

## Security Features

- ✅ JWT token authentication
- ✅ User ownership verification
- ✅ CORS support with origin whitelisting
- ✅ Security headers (XSS protection, frame options, etc.)
- ✅ URL validation
- ✅ Short code validation
- ✅ Rate limiting (via Cloudflare)

## Limitations

- **Free Tier:** 100,000 requests/day (Cloudflare free tier)
- **KV Storage:** 25MB per namespace (free tier)
- **Short Code Length:** 3-20 characters
- **Max Expiration:** 10 years
- **Custom Codes:** Must be unique

## Troubleshooting

### "JWT_SECRET environment variable is required"
- Make sure you've set the secret: `wrangler secret put JWT_SECRET`
- Ensure it matches your OTP auth service's JWT_SECRET

### "Custom code already in use"
- The custom code you're trying to use is already taken
- Try a different custom code or let the system generate one

### "Short URL not found"
- The short code doesn't exist
- The URL may have expired
- Check the short code spelling

### CORS errors
- Set `ALLOWED_ORIGINS` secret: `wrangler secret put ALLOWED_ORIGINS`
- Include your frontend domain in the comma-separated list

## License

Part of the Strixun Stream Suite.

