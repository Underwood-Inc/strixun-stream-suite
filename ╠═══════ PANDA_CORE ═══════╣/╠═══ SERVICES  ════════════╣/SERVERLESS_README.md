# Serverless API - Cloudflare Workers

**Last Updated:** 2025-12-29

This directory contains the Cloudflare Workers implementation for serverless API functionality.

## Status: ACTIVE - Cloud Storage Integration

This serverless API provides **Twitch API proxying** and **Cloud Save System** for true cross-device configuration backup and sync.

## What's Included

- **`worker.js`** - Main Cloudflare Worker code (Twitch API + Cloud Storage)
- **`wrangler.toml`** - Cloudflare Worker configuration
- **`package.json`** - Dependencies for local development
- **`SETUP.md`** - Complete setup and deployment guide
- **`../assets/js/cloud-storage.js`** - Client-side cloud storage adapter

## Features

### Twitch API Proxy
- **App Access Token Management** - Automatic token generation and caching
- **Clips Fetching** - Get Twitch clips with filtering and shuffling
- **User Following** - Retrieve followed channels
- **Game Data** - Fetch game information
- **CORS Support** - Cross-origin requests enabled

### Cloud Storage System (NEW!)
- **Device-Based Saves** - Unique device ID for each installation
- **Multiple Save Slots** - default, backup1, backup2, autosave, etc.
- **Auto-Sync** - Optional automatic cloud saves every 5 minutes
- **Conflict Detection** - Smart timestamp-based conflict resolution
- **Config Backup** - Saves all configs: swaps, layouts, text cyclers, clips, opacity
- **10MB Storage** - Per save (Cloudflare KV backed)
- **1 Year Retention** - Auto-expires after 1 year

## API Endpoints

### Twitch API
| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /clips` | GET | Fetch clips for a channel |
| `GET /following` | GET | Get followed channels |
| `GET /game` | GET | Get game info by ID |
| `GET /user` | GET | Get user info by login |
| `GET /health` | GET | Health check |

### Cloud Storage
| Endpoint | Method | Description | Headers |
|----------|--------|-------------|---------|
| `POST /cloud/save?slot=default` | POST | Save configs to cloud | `X-Device-ID` |
| `GET /cloud/load?slot=default` | GET | Load configs from cloud | `X-Device-ID` |
| `GET /cloud/list` | GET | List all save slots | `X-Device-ID` |
| `DELETE /cloud/delete?slot=default` | DELETE | Delete a save slot | `X-Device-ID` |

#### Device ID
The `X-Device-ID` header is automatically generated and managed by the client (`cloud-storage.js`). Format: `sss_<timestamp>_<random>` (e.g., `sss_lq8x2z_9k3j5n7p2q`).

## Deployment

See **`SETUP.md`** for complete deployment instructions.

Quick deploy:
```bash
cd serverless
npm install
wrangler login
wrangler deploy
```

## Original Implementation

This code was originally part of the Twitch Clips Player feature and was extracted from git history (commit `ce69c2e`) for preservation and potential reuse in other serverless API projects.

## License

Part of the Strixun Stream Suite
