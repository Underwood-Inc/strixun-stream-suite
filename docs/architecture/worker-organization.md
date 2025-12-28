# Worker Organization Structure

> **Per-worker code organization for Cloudflare Workers** [EMOJI][EMOJI][FEATURE]

---

## [CLIPBOARD] Overview

All workers are now organized with clear per-worker structure, making it easy to identify which code belongs to which worker.

---

## [EMOJI][EMOJI] Worker Structure

### Twitch API Worker (`serverless/twitch-api/`)

**Location:** `serverless/worker.js` (entry point)  
**Worker Name:** `strixun-twitch-api`  
**Custom Domain:** `api.idling.app`

```
serverless/
├── worker.js                    # Entry point (delegates to router)
├── twitch-api/
│   ├── router.js                # Main router for all endpoints
│   ├── handlers/
│   │   ├── auth.js              # OTP authentication handlers (legacy)
│   │   ├── cloud-storage.js     # Cloud save/load handlers
│   │   ├── notes.js             # Notes/notebook handlers
│   │   ├── obs.js               # OBS credentials handlers
│   │   ├── scrollbar.js         # Scrollbar CDN handlers
│   │   ├── test.js              # Test/debug handlers
│   │   └── twitch.js            # Twitch API proxy handlers
│   └── utils/
│       ├── auth.js              # JWT/auth utilities
│       └── cors.js              # CORS header utilities
└── wrangler.toml                # Worker configuration
```

**Endpoints:**
- Twitch API: `/clips`, `/following`, `/game`, `/user`
- Cloud Storage: `/cloud-save/*`, `/cloud/*` (legacy)
- Notes: `/notes/*`
- OBS Credentials: `/obs-credentials/*`
- CDN: `/cdn/scrollbar.js`, `/cdn/scrollbar-customizer.js`, `/cdn/scrollbar-compensation.js`
- Auth (legacy): `/auth/*`
- Test: `/test/email`, `/debug/clear-rate-limit`
- Health: `/health`, `/`

---

### Game API Worker (`serverless/game-api/`)

**Location:** `serverless/game-api/worker.js`  
**Worker Name:** `strixun-game-api`  
**Custom Domain:** `game.idling.app`

```
serverless/game-api/
├── worker.js                    # Entry point
├── router/
│   └── game-routes.js           # Game routes router
├── handlers/
│   └── game/
│       ├── character.js          # Character management
│       ├── crafting.js           # Crafting system
│       ├── dungeons.js           # Dungeon system
│       ├── idle.js               # Idle mechanics
│       ├── inventory.js          # Inventory management
│       ├── loot-box.js           # Daily loot boxes
│       ├── loot.js               # Loot generation
│       └── save-state.js         # Save/load state
├── utils/
│   ├── auth.js                  # JWT authentication
│   ├── cors.js                  # CORS headers
│   ├── customer.js              # Customer isolation
│   └── jwt-encryption.js        # JWT-based encryption
├── package.json
└── wrangler.toml
```

**Endpoints:** 23 game API endpoints (see `docs/GAME_API_AUDIT.md`)

---

### OTP Auth Service (`serverless/otp-auth-service/`)

**Location:** `serverless/otp-auth-service/worker.js`  
**Worker Name:** `otp-auth-service`  
**Custom Domain:** `auth.idling.app`

```
serverless/otp-auth-service/
├── worker.js                    # Entry point
├── router.js                    # Main router
├── router/
│   ├── admin-routes.js          # Admin endpoints
│   ├── auth-routes.js           # Auth endpoints
│   ├── game-routes.js           # Game routes (legacy - use game-api)
│   ├── public-routes.js         # Public endpoints
│   └── user-routes.js           # User endpoints
├── handlers/
│   ├── admin/                   # Admin handlers
│   ├── auth/                    # Auth handlers
│   ├── game/                    # Game handlers (legacy)
│   ├── public.js                # Public handlers
│   └── user/                    # User handlers
├── services/                    # Business logic services
├── utils/                       # Utilities
└── wrangler.toml
```

**Endpoints:** OTP authentication, admin, user management

---

### URL Shortener (`serverless/url-shortener/`)

**Location:** `serverless/url-shortener/worker.js`  
**Worker Name:** `strixun-url-shortener`  
**Custom Domain:** `s.idling.app`

```
serverless/url-shortener/
├── worker.js                    # Entry point (monolithic - needs organization)
├── handlers/                    # (to be created)
│   └── url.js                   # URL shortening handlers
├── utils/                       # (to be created)
│   ├── auth.js                  # JWT verification
│   └── cors.js                  # CORS headers
├── package.json
└── wrangler.toml
```

**Endpoints:**
- `POST /shorten` - Create short URL
- `GET /:code` - Redirect to original URL
- `GET /info/:code` - Get URL info
- `GET /list` - List user's URLs
- `DELETE /:code` - Delete short URL

**Status:** [WARNING] Needs organization (utilities inline in worker.js)

---

### Chat Signaling (`serverless/chat-signaling/`)

**Location:** `serverless/chat-signaling/worker.js`  
**Worker Name:** `strixun-chat-signaling`  
**Custom Domain:** `chat.idling.app`

```
serverless/chat-signaling/
├── worker.js                    # Entry point (monolithic - needs organization)
├── handlers/                    # (to be created)
│   └── signaling.js             # WebRTC signaling handlers
├── utils/                       # (to be created)
│   ├── auth.js                  # JWT verification
│   └── cors.js                  # CORS headers
├── package.json
└── wrangler.toml
```

**Endpoints:**
- WebRTC signaling endpoints

**Status:** [WARNING] Needs organization (utilities inline in worker.js)

---

## [PACKAGE] Shared Code

### Shared Utilities (`serverless/shared/`)

Code shared across multiple workers:

```
serverless/shared/
├── enhanced-router.js           # Enhanced router wrapper
├── enhanced-wrapper.js          # Enhanced wrapper utilities
└── types.js                     # Shared TypeScript types
```

**Usage:**
- Used by OTP Auth Service, URL Shortener, Chat Signaling
- Provides consistent routing patterns
- Type definitions for service communication

---

## [SYNC] Migration Status

### [SUCCESS] Completed

- [x] Twitch API Worker - Fully organized
  - [x] Handlers moved to `twitch-api/handlers/`
  - [x] Utils moved to `twitch-api/utils/`
  - [x] Router created
  - [x] OTP auth handlers extracted
  - [x] Test handlers extracted
  - [x] Worker.js cleaned up

- [x] Game API Worker - Fully organized
  - [x] Dedicated worker structure
  - [x] Handlers organized
  - [x] Router created
  - [x] Utils organized

- [x] OTP Auth Service - Already organized
  - [x] Well-structured from start

### [WARNING] Needs Organization

- [ ] URL Shortener
  - [ ] Extract CORS utilities to `utils/cors.js`
  - [ ] Extract JWT utilities to `utils/auth.js`
  - [ ] Extract handlers to `handlers/url.js`
  - [ ] Create router

- [ ] Chat Signaling
  - [ ] Extract CORS utilities to `utils/cors.js`
  - [ ] Extract JWT utilities to `utils/auth.js`
  - [ ] Extract handlers to `handlers/signaling.js`
  - [ ] Create router

---

## [NOTE] Import Patterns

### Twitch API Worker

```javascript
// From router
import { route } from './twitch-api/router.js';

// From handlers
import { handleClips } from './twitch-api/handlers/twitch.js';
import { handleRequestOTP } from './twitch-api/handlers/auth.js';

// From utils
import { getCorsHeaders } from './twitch-api/utils/cors.js';
import { authenticateRequest } from './twitch-api/utils/auth.js';
```

### Game API Worker

```javascript
// From router
import { handleGameRoutes } from './router/game-routes.js';

// From handlers
import { handleGameSaveState } from './handlers/game/save-state.js';

// From utils
import { getCorsHeaders } from './utils/cors.js';
import { authenticateRequest } from './utils/auth.js';
```

### Shared Code

```javascript
// From shared
import { createEnhancedRouter } from '../shared/enhanced-router.js';
import { initializeServiceTypes } from '../shared/types.js';
```

---

## [TARGET] Benefits

1. **Clear Ownership** - Easy to see which code belongs to which worker
2. **Better Organization** - Handlers, utils, and routers are clearly separated
3. **Easier Maintenance** - Changes to one worker don't affect others
4. **Scalability** - Each worker can be developed/deployed independently
5. **Code Reuse** - Shared utilities in `shared/` directory

---

## [DOCS] Related Documentation

- [Game API Audit](./GAME_API_AUDIT.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [API Implementation Status](./API_IMPLEMENTATION_STATUS.md)

---

**Last Updated:** 2024-12-XX  
**Version:** 1.0.0

