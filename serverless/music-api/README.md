# Music API Service

Cloudflare Worker for fetching copyright-free music from external sources.

## Features

- Search for music tracks from multiple sources
- Support for Free Music Archive, SoundCloud, Jamendo, and direct URLs
- CORS-enabled API endpoints
- Health check endpoint

## Endpoints

### GET /health
Health check endpoint.

### GET /api/music/search
Search for music tracks.

**Query Parameters:**
- `query` (optional): Search query
- `genre` (optional): Filter by genre (e.g., "lo-fi")
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Pagination offset (default: 0)
- `source` (optional): Filter by source (freemusicarchive, soundcloud, jamendo)

**Response:**
```json
{
  "tracks": [
    {
      "id": "track-id",
      "title": "Track Title",
      "artist": "Artist Name",
      "url": "https://...",
      "source": "freemusicarchive",
      "genre": "lo-fi",
      "license": "CC BY",
      "attribution": "Free Music Archive"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### POST /api/music/direct
Add a direct URL track.

**Request Body:**
```json
{
  "url": "https://example.com/audio.mp3"
}
```

## Development

```bash
# Install dependencies
pnpm install

# Build worker
pnpm build:worker

# Run locally (runs on port 8791)
pnpm dev

# Deploy
pnpm deploy
```

## Environment Variables

- `ENVIRONMENT`: Environment name (development/production)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
