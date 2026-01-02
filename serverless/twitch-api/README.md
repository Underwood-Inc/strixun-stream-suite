# Twitch API - Cloudflare Worker

Cloudflare Worker for Twitch API proxy with cloud storage, authentication, and CDN endpoints.

## Overview

This service provides a proxy layer for Twitch API requests, with caching, authentication handling, and CDN integration for optimized performance.

## Features

- ✓ **Twitch API Proxy** - Proxy requests to Twitch API
- ✓ **Cloud Storage** - Cache responses in Cloudflare R2
- ✓ **Authentication** - Handle Twitch OAuth tokens
- ✓ **CDN Integration** - Serve cached content via CDN
- ✓ **Rate Limiting** - Respect Twitch API rate limits
- ✓ **TypeScript** - Fully typed

## Setup

### Prerequisites

- Cloudflare account
- Wrangler CLI installed
- Node.js 18+
- pnpm package manager
- Twitch API credentials

### Installation

```bash
cd serverless/twitch-api
pnpm install
```

### Configuration

1. **Create R2 Bucket (optional, for caching):**
```bash
wrangler r2 bucket create "twitch-cache"
```

2. **Update `wrangler.toml`** with R2 bucket name if using caching

3. **Set Secrets:**
```bash
wrangler secret put TWITCH_CLIENT_ID      # REQUIRED: Twitch API client ID
wrangler secret put TWITCH_CLIENT_SECRET  # REQUIRED: Twitch API client secret
wrangler secret put ALLOWED_ORIGINS       # OPTIONAL: CORS origins
```

### Development

```bash
pnpm dev
```

The dev server runs on `http://localhost:8789`

### Deployment

```bash
pnpm deploy
```

## API Endpoints

### Twitch Proxy

- `GET /api/*` - Proxy to Twitch API
- `POST /api/*` - Proxy to Twitch API

### Health

- `GET /health` - Health check

## Usage

The service acts as a proxy, forwarding requests to the Twitch API while adding:
- Authentication handling
- Response caching (if configured)
- Rate limit management
- Error handling

## Tech Stack

- **Cloudflare Workers** - Edge runtime
- **TypeScript** - Type safety
- **@strixun/api-framework** - Shared API framework
- **Cloudflare R2** - Optional caching storage

## License

Private - Part of Strixun Stream Suite
