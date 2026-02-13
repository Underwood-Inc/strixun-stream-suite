# Access Hub - Frontend UI

Minimal frontend UI for the Strixun Access Control System.

## Architecture

- **Frontend**: `access.idling.app` (Cloudflare Pages - this app)
- **Backend API**: `access-api.idling.app` (Cloudflare Worker)

This follows the same pattern as Mods Hub:
- `mods.idling.app` → Frontend
- `mods-api.idling.app` → Backend API

## Features

- View all available roles
- View all available permissions  
- Simple, clean UI
- Direct API integration with Access Service

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (port 5175)
pnpm dev

# Build for production
pnpm build
```

## Deployment

Deployed via GitHub Actions to Cloudflare Pages at `access.idling.app`.

The build output goes to `../dist/access-hub` to be deployed alongside other frontend apps.

## Environment Variables

- `VITE_ACCESS_API_URL`: Access API URL (defaults to `https://access-api.idling.app`)
