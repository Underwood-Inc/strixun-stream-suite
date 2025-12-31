# Game API Architecture Audit & Migration Report

> **Comprehensive audit of game API architecture and migration to dedicated Cloudflare Worker** [FEATURE]

---

## [EMOJI] Executive Summary

The game API has been successfully migrated from the OTP Auth Service worker to a **dedicated Game API worker** (`strixun-game-api`). This separation provides:

- [OK] **Dedicated resource allocation** for game operations
- [OK] **Better scalability** and performance isolation
- [OK] **Organized architecture** with clear service boundaries
- [OK] **Maintained integration** with OTP auth service via JWT

---

##  Architecture Overview

### Before Migration

```
┌─────────────────────────────────────┐
│   OTP Auth Service Worker           │
│   (otp-auth-service)                 │
│                                      │
│  ┌──────────────────────────────┐  │
│  │  Auth Routes                  │  │
│  │  Admin Routes                 │  │
│  │  User Routes                  │  │
│  │  Game Routes (23 endpoints)  │  │  Heavy workload
│  └──────────────────────────────┘  │
│                                      │
│  KV: OTP_AUTH_KV                    │
└─────────────────────────────────────┘
```

**Issues:**
- Game API shared resources with auth service
- No dedicated scaling for game operations
- Mixed concerns in single worker

### After Migration

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│  OTP Auth Service Worker    │     │   Game API Worker           │
│  (otp-auth-service)          │     │   (strixun-game-api)        │
│                              │     │                              │
│  ┌──────────────────────┐   │     │  ┌──────────────────────┐  │
│  │  Auth Routes          │   │     │  │  Game Routes          │  │
│  │  Admin Routes         │   │     │  │  (23 endpoints)        │  │
│  │  User Routes          │   │     │  │                        │  │
│  └──────────────────────┘   │     │  │  - Save State          │  │
│                              │     │  │  - Loot Boxes          │  │
│  KV: OTP_AUTH_KV            │     │  │  - Idle Mechanics       │  │
│                              │     │  │  - Crafting            │  │
└─────────────────────────────┘     │  │  - Dungeons            │  │
                                     │  │  - Inventory           │  │
                                     │  │  - Character           │  │
                                     │  │  - Loot Generation     │  │
                                     │  └──────────────────────┘  │
                                     │                              │
                                     │  KV: GAME_KV                │
                                     └─────────────────────────────┘
                                              ▲
                                              │
                                     JWT Authentication
                                     (shared JWT_SECRET)
```

**Benefits:**
- [OK] Dedicated worker for game operations
- [OK] Separate KV namespace for game data
- [OK] Independent scaling and resource allocation
- [OK] Clear service boundaries
- [OK] Maintained security via JWT authentication

---

## [EMOJI] Game API Endpoints

### Total: 23 Endpoints

#### Save State (2)
- `POST /game/save-state` - Save game state
- `GET /game/save-state` - Load game state

#### Daily Loot Boxes (2)
- `GET /game/loot-box/status` - Get loot box status
- `POST /game/loot-box/claim` - Claim daily loot box

#### Idle Mechanics (4)
- `GET /game/idle/progress` - Get offline progress
- `POST /game/idle/claim` - Claim idle rewards
- `POST /game/idle/activity/start` - Start idle activity
- `POST /game/idle/activity/stop` - Stop idle activity

#### Crafting (3)
- `POST /game/crafting/start` - Start crafting session
- `POST /game/crafting/collect` - Collect crafting result
- `GET /game/crafting/sessions` - Get active sessions

#### Dungeons (4)
- `POST /game/dungeons/start` - Start dungeon instance
- `POST /game/dungeons/complete-room` - Complete room
- `POST /game/dungeons/complete` - Complete dungeon
- `GET /game/dungeons/instances` - Get active instances

#### Inventory (4)
- `GET /game/inventory` - Get inventory and equipment
- `POST /game/inventory/item` - Add item
- `DELETE /game/inventory/item` - Remove item
- `POST /game/inventory/equip` - Equip item

#### Character (3)
- `GET /game/character` - Get character
- `POST /game/character` - Create character
- `PUT /game/character/appearance` - Update appearance

#### Loot Generation (2)
- `POST /game/loot/generate` - Generate loot item
- `GET /game/loot/tables` - Get available loot tables

---

## [EMOJI] Authentication & Security

### JWT Authentication

All game endpoints require JWT authentication via `Authorization: Bearer <token>` header.

**Integration:**
- Game API uses the **same JWT_SECRET** as OTP Auth Service
- Tokens are issued by OTP Auth Service
- Game API verifies tokens independently
- No dependency on OTP Auth Service for request processing

**Flow:**
```
1. User authenticates  OTP Auth Service
2. OTP Auth Service issues JWT token
3. Client sends request to Game API with JWT token
4. Game API verifies JWT token (using shared JWT_SECRET)
5. Game API processes request
```

### End-to-End Encryption

All game API responses are automatically encrypted using JWT token-based encryption:
- AES-GCM-256 encryption
- PBKDF2 key derivation from JWT token
- Only the token holder can decrypt responses
- Automatic encryption/decryption in router wrapper

---

##  Storage Architecture

### KV Namespace: GAME_KV

**Data Keys:**
- Save states: `cust_{customerId}_game_save_{userId}_{characterId}`
- Loot box streaks: `cust_{customerId}_loot_box_streak_{userId}`
- Idle activities: `cust_{customerId}_idle_activities_{userId}`
- Crafting sessions: `cust_{customerId}_crafting_session_{sessionId}`
- Dungeon instances: `cust_{customerId}_dungeon_instance_{instanceId}`
- Inventory: `cust_{customerId}_inventory_{characterId}`
- Equipment: `cust_{customerId}_equipment_{characterId}`
- Characters: `cust_{customerId}_character_{characterId}`
- Character textures: `cust_{customerId}_character_texture_{characterId}_{type}`

**Customer Isolation:**
- All keys prefixed with `cust_{customerId}_`
- Multi-tenant support maintained
- Data isolation per customer

---

## [EMOJI] Deployment

### Worker Configuration

**Worker Name:** `strixun-game-api`  
**Custom Domain:** `game.idling.app`  
**KV Namespace:** `GAME_API_KV` (binding: `GAME_KV`)

### Deployment Scripts

```bash
# Deploy game API only
cd serverless/game-api
pnpm exec wrangler deploy

# Deploy all workers (includes game API)
cd serverless
pnpm run deploy:all
```

### GitHub Actions

Automated deployment via `.github/workflows/deploy-game-api.yml`:
- Triggers on changes to `serverless/game-api/**`
- Deploys to Cloudflare Workers
- Sets secrets (JWT_SECRET, ALLOWED_ORIGINS)

---

## [EMOJI] Migration Checklist

### [OK] Completed

- [x] Created dedicated `game-api` worker structure
- [x] Moved all 8 game handlers to dedicated worker
- [x] Updated KV bindings (OTP_AUTH_KV  GAME_KV)
- [x] Updated import paths for utilities
- [x] Created game router with authentication
- [x] Set up JWT authentication integration
- [x] Created worker.js entry point
- [x] Updated deployment scripts
- [x] Created GitHub Actions workflow
- [x] Created comprehensive documentation

### [WARNING] Required Actions

1. **Create KV Namespace:**
   ```bash
   cd serverless/game-api
   wrangler kv namespace create "GAME_API_KV"
   ```
   Then update `wrangler.toml` with the namespace ID.

2. **Set Secrets:**
   ```bash
   cd serverless/game-api
   wrangler secret put JWT_SECRET  # Must match OTP auth service
   wrangler secret put ALLOWED_ORIGINS  # Optional, for CORS
   ```

3. **Deploy Worker:**
   ```bash
   cd serverless/game-api
   pnpm exec wrangler deploy
   ```

4. **Update Client Configuration:**
   - Update `shared-components/idle-game-overlay/services/game-api.ts`
   - Point `baseUrl` to `https://game.idling.app` or worker URL

5. **Remove Game Routes from OTP Auth Service:**
   - Remove game route handling from `serverless/otp-auth-service/router.js`
   - Remove `serverless/otp-auth-service/router/game-routes.js`
   - Remove `serverless/otp-auth-service/handlers/game/` directory
   - **Note:** Keep for backward compatibility during transition

---

## [EMOJI] Performance Considerations

### Resource Allocation

**Before:**
- Game API shared CPU/memory with auth service
- Single worker handling all requests
- Potential resource contention

**After:**
- Dedicated worker for game operations
- Independent scaling
- Better resource isolation
- Improved performance for game-heavy workloads

### Scalability

- Game API can scale independently
- No impact on auth service performance
- Better handling of game traffic spikes
- Separate KV namespace reduces contention

---

## [EMOJI] Integration Points

### Client Integration

**Service:** `shared-components/idle-game-overlay/services/game-api.ts`

**Current:** Points to OTP auth service  
**Required:** Update to point to game API worker

```typescript
// Update baseUrl
constructor() {
  this.baseUrl = 'https://game.idling.app'; // or worker URL
}
```

### Authentication Flow

1. User authenticates via OTP Auth Service
2. Receives JWT token
3. Uses same token for Game API requests
4. Game API verifies token independently

**No changes required** - existing auth flow works seamlessly.

---

## [EMOJI] File Structure

```
serverless/game-api/
├── handlers/
│   └── game/
│       ├── character.js
│       ├── crafting.js
│       ├── dungeons.js
│       ├── idle.js
│       ├── inventory.js
│       ├── loot-box.js
│       ├── loot.js
│       └── save-state.js
├── router/
│   └── game-routes.js
├── utils/
│   ├── auth.js
│   ├── cors.js
│   ├── customer.js
│   └── jwt-encryption.js
├── package.json
├── wrangler.toml
└── worker.js
```

---

## [EMOJI] Next Steps

1. **Create KV Namespace** and update `wrangler.toml`
2. **Deploy Game API Worker** to Cloudflare
3. **Update Client Configuration** to point to new worker
4. **Test All Endpoints** to ensure functionality
5. **Monitor Performance** and adjust scaling as needed
6. **Remove Game Routes from OTP Auth Service** (after transition period)

---

## [EMOJI] Related Documentation

- [API Implementation Status](./API_IMPLEMENTATION_STATUS.md)
- [API Endpoints Reference](./API_ENDPOINTS_REFERENCE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Idle Game System Architecture](./IDLE_GAME_SYSTEM_ARCHITECTURE.md)

---

**Status:** [OK] Migration Complete - Ready for Deployment  
**Last Updated:** 2024-12-XX  
**Version:** 1.0.0
