# Game API - Cloudflare Worker

Dedicated Cloudflare Worker for idle game API endpoints and game state management.

## Overview

This service provides API endpoints for managing game state, player progress, and game-related data for idle games and game overlays.

## Features

- ✓ **Game State Management** - Save and load game state
- ✓ **Player Progress** - Track player progress and achievements
- ✓ **JWT Authentication** - Integrated with OTP auth service
- ✓ **TypeScript** - Fully typed API
- ✓ **Cloudflare Workers** - Edge computing for low latency
- ✓ **KV Storage** - Fast game state storage

## Setup

### Prerequisites

- Cloudflare account
- Wrangler CLI installed
- Node.js 18+
- pnpm package manager

### Installation

```bash
cd serverless/game-api
pnpm install
```

### Configuration

1. **Create KV Namespace:**
```bash
wrangler kv namespace create "GAME_KV"
```

2. **Update `wrangler.toml`** with the KV namespace ID

3. **Set Secrets:**
```bash
wrangler secret put JWT_SECRET          # REQUIRED: Must match OTP auth service
wrangler secret put ALLOWED_ORIGINS     # OPTIONAL: CORS origins
```

### Development

```bash
pnpm dev
```

The dev server runs on `http://localhost:8791`

### Deployment

```bash
pnpm deploy
```

## API Endpoints

### Game State

- `GET /game/save-state` - Get saved game state (requires auth)
- `POST /game/save-state` - Save game state (requires auth)
- `DELETE /game/save-state` - Delete game state (requires auth)

### Player Progress

- `GET /game/progress` - Get player progress (requires auth)
- `POST /game/progress` - Update player progress (requires auth)

### Health

- `GET /health` - Health check

## Authentication

All endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

The JWT token is obtained from the OTP auth service and must use the same `JWT_SECRET`.

## Integration

This API integrates with:
- **Dice Board Game** (`@strixun/dice-board-game`) - 3D dice board game component
- **Idle Game Overlay** (`@strixun/idle-game-overlay`) - Idle game overlay components

## Tech Stack

- **Cloudflare Workers** - Edge runtime
- **TypeScript** - Type safety
- **@strixun/api-framework** - Shared API framework
- **Cloudflare KV** - Game state storage

## License

Private - Part of Strixun Stream Suite
