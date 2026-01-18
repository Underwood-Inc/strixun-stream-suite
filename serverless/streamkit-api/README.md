# Streamkit API

**Dedicated cloud storage and scene activity tracking API for the Strixun Streamkit OBS Control Panel.**

---

## 📋 Overview

The Streamkit API is a Cloudflare Worker that provides:

- **Cloud Storage**: Persistent, customer-isolated storage for Streamkit configurations
- **Scene Activity Tracking**: Records and ranks OBS scenes by usage frequency
- **Generic Config API**: Atomic storage for all Streamkit features (text cyclers, swaps, layouts, notes)
- **Cross-Client Sync**: Data accessible from OBS dock, remote browsers, and multiple devices

### Key Features

✅ **Customer Isolation**: All data is scoped by customer ID (extracted from JWT)  
✅ **Atomic Storage**: One KV key per config item (no monolithic JSON blobs)  
✅ **Type-Safe**: Generic endpoints work for all config types  
✅ **Scalable**: Built on Cloudflare KV with 30-day TTL for activity tracking  
✅ **Secure**: JWT-based authentication via HttpOnly cookies  
✅ **Fast**: Edge-deployed with global low-latency access  

---

## 🚀 Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Start local dev server (port 8796)
pnpm dev

# Or start all workers + frontends
pnpm dev:turbo
```

The API will be available at `http://localhost:8796`.

### Build

```bash
# Build worker bundle
pnpm run build:worker

# Build dependencies + worker
pnpm run build:deps
```

### Deploy

```bash
# Deploy to production
pnpm run deploy

# Deploy with specific environment
pnpm run deploy:prod
```

### Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

---

## 📡 API Endpoints

### Base URL

- **Production**: `https://streamkit-api.idling.app`
- **Development**: `http://localhost:8796`

### Authentication

All endpoints require authentication via:
- **HttpOnly Cookie**: `auth_token` (preferred for browsers)
- **Authorization Header**: `Bearer <jwt_token>` (for service-to-service)

The JWT must contain a `customerId`, `userId`, or `sub` claim.

---

## 🔧 Generic Config API

Universal CRUD endpoints for all Streamkit configuration types.

### Supported Config Types

- `text-cyclers` - Text rotation configurations
- `swaps` - Source swap presets
- `layouts` - Layout snapshots
- `notes` - User notes/notebooks

---

### Create Config

**POST** `/configs/:type`

Creates a new configuration.

**Request Body:**
```json
{
  "id": "unique-id",
  "name": "My Config",
  ...additional properties
}
```

**Response:**
```json
{
  "success": true,
  "config": {
    "id": "unique-id",
    "name": "My Config",
    "createdAt": "2026-01-18T12:00:00.000Z",
    "updatedAt": "2026-01-18T12:00:00.000Z",
    ...additional properties
  }
}
```

**Status Codes:**
- `201` - Created successfully
- `400` - Invalid request body
- `401` - Unauthorized (missing/invalid JWT)
- `409` - Config with ID already exists

**Example:**
```bash
curl -X POST https://streamkit-api.idling.app/configs/text-cyclers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "config1",
    "name": "My Text Cycler",
    "textLines": ["Line 1", "Line 2", "Line 3"],
    "cycleDuration": 5000
  }'
```

---

### List Configs

**GET** `/configs/:type`

Retrieves all configurations of a specific type for the authenticated customer.

**Response:**
```json
{
  "configs": [
    {
      "id": "config1",
      "name": "My Config",
      "createdAt": "2026-01-18T12:00:00.000Z",
      "updatedAt": "2026-01-18T12:00:00.000Z",
      ...additional properties
    }
  ],
  "count": 1
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized

**Example:**
```bash
curl https://streamkit-api.idling.app/configs/text-cyclers \
  -H "Authorization: Bearer <token>"
```

---

### Get Config

**GET** `/configs/:type/:id`

Retrieves a specific configuration by ID.

**Response:**
```json
{
  "id": "config1",
  "name": "My Config",
  "createdAt": "2026-01-18T12:00:00.000Z",
  "updatedAt": "2026-01-18T12:00:00.000Z",
  ...additional properties
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `404` - Config not found

**Example:**
```bash
curl https://streamkit-api.idling.app/configs/text-cyclers/config1 \
  -H "Authorization: Bearer <token>"
```

---

### Update Config

**PUT** `/configs/:type/:id`

Updates an existing configuration (full replacement).

**Request Body:**
```json
{
  "id": "config1",
  "name": "Updated Config",
  ...additional properties
}
```

**Response:**
```json
{
  "success": true,
  "config": {
    "id": "config1",
    "name": "Updated Config",
    "createdAt": "2026-01-18T12:00:00.000Z",
    "updatedAt": "2026-01-18T12:05:00.000Z",
    ...additional properties
  }
}
```

**Status Codes:**
- `200` - Updated successfully
- `400` - Invalid request body
- `401` - Unauthorized
- `404` - Config not found

**Example:**
```bash
curl -X PUT https://streamkit-api.idling.app/configs/text-cyclers/config1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "config1",
    "name": "Updated Text Cycler",
    "textLines": ["New Line 1", "New Line 2"],
    "cycleDuration": 3000
  }'
```

---

### Delete Config

**DELETE** `/configs/:type/:id`

Permanently deletes a configuration.

**Response:**
```json
{
  "success": true,
  "message": "Config deleted successfully"
}
```

**Status Codes:**
- `200` - Deleted successfully
- `401` - Unauthorized
- `404` - Config not found

**Example:**
```bash
curl -X DELETE https://streamkit-api.idling.app/configs/text-cyclers/config1 \
  -H "Authorization: Bearer <token>"
```

---

## 🎯 Scene Activity Tracking

Tracks OBS scene switches and provides sorted lists by usage frequency.

### Record Scene Switch

**POST** `/scene-activity/record`

Records a scene switch event.

**Request Body:**
```json
{
  "sceneName": "Gaming Scene"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Scene activity recorded"
}
```

**Status Codes:**
- `200` - Recorded successfully
- `400` - Missing sceneName
- `401` - Unauthorized

**Example:**
```bash
curl -X POST https://streamkit-api.idling.app/scene-activity/record \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "Gaming Scene"}'
```

**Implementation Details:**
- Uses **FIFO rolling window** (30-day TTL)
- Atomic increments per scene
- No data loss when switching scenes rapidly
- Automatically expires old activity data

---

### Get Top Scenes

**GET** `/scene-activity/top?limit=10`

Retrieves the most active scenes for the authenticated customer.

**Query Parameters:**
- `limit` (optional) - Number of scenes to return (default: 10, max: 100)

**Response:**
```json
{
  "scenes": [
    {
      "sceneName": "Gaming Scene",
      "count": 42,
      "lastUsed": "2026-01-18T12:00:00.000Z"
    },
    {
      "sceneName": "BRB Scene",
      "count": 18,
      "lastUsed": "2026-01-18T11:30:00.000Z"
    }
  ],
  "total": 2
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized

**Example:**
```bash
curl https://streamkit-api.idling.app/scene-activity/top?limit=5 \
  -H "Authorization: Bearer <token>"
```

---

## 🗄️ Storage Architecture

### KV Key Structure

All KV keys follow a customer-isolated pattern:

```
cust_{customerId}_streamkit_{type}_{id}
```

**Examples:**
- `cust_12345_streamkit_text-cyclers_config1`
- `cust_12345_streamkit_swaps_swap1`
- `cust_12345_streamkit_layouts_layout1`
- `cust_12345_streamkit_notes_note1`
- `cust_12345_streamkit_scene_activity_Gaming Scene`

### KV Namespaces

**Production:**
- **Binding**: `STREAMKIT_KV`
- **ID**: `193c308cee734e1bb08bba03ae2d65b0`

**Development:**
- **Binding**: `STREAMKIT_KV`
- **ID**: `a70d6c00bcc44a9ba9310c4590f228a8`

### Data Isolation

- ✅ **Customer-scoped**: Each customer's data is isolated by `customerId` prefix
- ✅ **Type-scoped**: Different config types are namespaced (`text-cyclers`, `swaps`, etc.)
- ✅ **ID-scoped**: Each config has a unique ID within its type
- ✅ **No cross-contamination**: Impossible to access another customer's data

### TTL Strategy

- **Configs**: No TTL (persistent until deleted)
- **Scene Activity**: 30-day TTL (rolling FIFO window)

---

## 🔐 Security

### Authentication Flow

1. User authenticates via OTP Auth Service (`auth.idling.app`)
2. Auth service sets HttpOnly cookie with JWT (`auth_token`)
3. Streamkit API extracts JWT from cookie or `Authorization` header
4. JWT is verified using shared `JWT_SECRET`
5. `customerId` is extracted from JWT claims
6. All operations are scoped to that `customerId`

### Customer Isolation

**Every request:**
1. Extracts `customerId` from JWT
2. Prefixes all KV keys with `cust_{customerId}_`
3. Ensures no cross-customer data access

**Security guarantees:**
- ✅ Customers cannot access other customers' data
- ✅ Customers cannot list other customers' keys
- ✅ All operations are atomic and race-condition safe
- ✅ JWT expiration is enforced (no stale tokens)

### Environment Variables

Required secrets (set via `wrangler secret put`):

```bash
# JWT verification secret (shared with auth service)
wrangler secret put JWT_SECRET

# Optional: Service-to-service API key
wrangler secret put SERVICE_API_KEY

# Optional: Network integrity keyphrase
wrangler secret put NETWORK_INTEGRITY_KEYPHRASE
```

---

## 🏗️ Architecture

### Tech Stack

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Storage**: Cloudflare KV (eventually consistent, globally replicated)
- **Framework**: `@strixun/api-framework` (enhanced handlers, CORS, RFC 7807 errors)
- **Auth**: JWT-based (HttpOnly cookies + Bearer tokens)
- **Language**: TypeScript (strict mode)

### Project Structure

```
serverless/streamkit-api/
├── wrangler.toml              # Worker configuration
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript config
├── worker.ts                  # Main entry point (manual routing)
├── src/
│   └── env.d.ts               # Environment interface
├── utils/
│   ├── kv-keys.ts             # KV key builders (buildKVKey, parseKVKey)
│   └── auth.ts                # JWT extraction (extractCustomerFromJWT)
├── handlers/
│   ├── configs/
│   │   └── index.ts           # Generic CRUD handlers (all config types)
│   └── scene-activity/
│       ├── record.ts          # Record scene switch
│       └── top.ts             # Get top scenes
└── dist/
    └── worker.js              # Built bundle (48.4kb)
```

### Dependencies

- `@strixun/api-framework` - Enhanced request handling
- `@strixun/error-utils` - RFC 7807 error responses
- `@strixun/service-client` - Service-to-service communication
- `@strixun/types` - Shared type definitions
- `@strixun/schemas` - Valibot validation schemas

---

## 🔄 Frontend Integration

### API Client

The frontend uses a type-safe API client (`src/modules/streamkit-api-client.ts`):

```typescript
import * as API from './streamkit-api-client';

// Text Cyclers
const configs = await API.textCyclers.list();
await API.textCyclers.create({ id: 'config1', name: 'My Cycler', ... });
await API.textCyclers.update('config1', { name: 'Updated' });
await API.textCyclers.delete('config1');

// Swaps
const swaps = await API.swaps.list();
await API.swaps.create({ name: 'Swap 1', sourceA: 'Camera', sourceB: 'Gameplay' });

// Layouts
const layouts = await API.layouts.list();
await API.layouts.create({ id: 'layout1', name: 'My Layout', scene: 'Main', sources: [] });

// Notes
const notes = await API.notes.list();
await API.notes.create({ title: 'My Note', content: 'Note content' });

// Scene Activity
import { recordSceneSwitch, getTopScenes } from './scene-activity';
await recordSceneSwitch('Gaming Scene');
const topScenes = await getTopScenes(10);
```

### Cloud Storage Integration

The frontend uses a hybrid storage model (`src/modules/cloud-storage.ts`):

1. **Local-first**: Writes go to IndexedDB + localStorage immediately (fast)
2. **Cloud sync**: Async write-through to Streamkit API (1-second debounce)
3. **Read strategy**: Read from local cache, sync from cloud on app init
4. **Conflict resolution**: Cloud is source of truth (last-write-wins)

**Benefits:**
- ✅ Instant responsiveness (local writes)
- ✅ No data loss (cloud backup)
- ✅ Cross-device sync (cloud-first)
- ✅ Offline-capable (local fallback)

---

## 📊 Performance

### Response Times

- **GET requests**: ~10-50ms (global edge cache)
- **POST/PUT/DELETE**: ~50-150ms (KV write latency)
- **Scene activity**: ~20-100ms (atomic increments)

### Throughput

- **Max requests/second**: 1000+ (Cloudflare Workers scale automatically)
- **KV operations**: Unlimited (globally distributed)
- **Concurrent users**: Unlimited (serverless auto-scaling)

### Caching

- **KV reads**: Eventually consistent (global replication)
- **Config reads**: No caching (always fresh from KV)
- **Scene activity**: 30-day TTL (automatic expiration)

---

## 🧪 Testing

### Manual Testing

```bash
# 1. Start local dev server
pnpm dev

# 2. Get auth token (from browser DevTools after logging in at auth.idling.app)
export AUTH_TOKEN="eyJhbGciOiJIUzI1NiIs..."

# 3. Test endpoints
curl http://localhost:8796/configs/text-cyclers \
  -H "Authorization: Bearer $AUTH_TOKEN"

curl -X POST http://localhost:8796/configs/text-cyclers \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "test1", "name": "Test Config", "textLines": ["Line 1"]}'

curl -X POST http://localhost:8796/scene-activity/record \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "Test Scene"}'

curl http://localhost:8796/scene-activity/top?limit=5 \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

### Automated Testing

```bash
# Run all tests
pnpm test

# Watch mode (auto-rerun on file changes)
pnpm test:watch

# Coverage report
pnpm test:coverage
```

---

## 🚨 Troubleshooting

### Common Issues

**Issue**: `401 Unauthorized` errors  
**Solution**: Check JWT token validity, ensure `JWT_SECRET` is set correctly

**Issue**: `404 Not Found` for configs  
**Solution**: Verify config was created successfully, check KV namespace binding

**Issue**: Scene activity not updating  
**Solution**: Verify `sceneName` matches exactly (case-sensitive)

**Issue**: CORS errors  
**Solution**: Check `ALLOWED_ORIGINS` environment variable

**Issue**: Slow response times  
**Solution**: Check KV namespace region, verify network latency

### Debug Mode

Enable debug logging in the frontend:

```javascript
// In browser console
localStorage.setItem('debug', 'streamkit:*');
```

Check worker logs:

```bash
# Stream production logs
pnpm run tail

# Stream production logs (env-specific)
pnpm run tail:prod
```

---

## 📚 Additional Resources

### Related Services
- **OTP Auth Service**: `auth.idling.app` - Authentication & customer management
- **Customer API**: `customer-api.idling.app` - Customer CRUD operations
- **Access API**: `access-api.idling.app` - Permissions & quotas

### Documentation
- [OTP Auth Service Storage Architecture](../otp-auth-service/STORAGE_ARCHITECTURE.md)
- [API Framework Documentation](../../packages/api-framework/README.md)
- [Service Client Documentation](../../packages/service-client/README.md)

### External Resources
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare KV Docs](https://developers.cloudflare.com/kv/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

---

## 📝 Migration Guide

### For Users

**Before (Local Storage Only):**
- Configs stored in browser IndexedDB/localStorage
- OBS WebSocket sync for cross-client access
- Risk of data loss if all layers fail

**After (Cloud Storage):**
- Configs stored in cloud (Cloudflare KV)
- Local cache for instant responsiveness
- No data loss (cloud backup)
- Access from any device

**Migration Steps:**
1. Open Streamkit Control Panel
2. Configs automatically sync to cloud on first use
3. No manual migration needed!

### For Developers

**Old Pattern (Local Storage):**
```typescript
import { storage } from './storage';
const configs = storage.get('textCyclerConfigs') || [];
storage.set('textCyclerConfigs', configs);
```

**New Pattern (Cloud Storage):**
```typescript
import * as API from './streamkit-api-client';
const configs = await API.textCyclers.list();
await API.textCyclers.create({ id: 'config1', ... });
```

---

## 🤝 Contributing

### Code Style
- Use TypeScript strict mode
- Follow existing patterns (see `mods-api`, `customer-api`)
- Use `@strixun/api-framework` for handlers
- Use `@strixun/error-utils` for RFC 7807 errors

### Commit Messages
Use conventional commits:
```
feat(streamkit-api): add batch config update endpoint
fix(streamkit-api): handle missing customerId in JWT
docs(streamkit-api): update API endpoint examples
```

---

## 📄 License

Part of the Strixun Stream Suite  
© 2026 Strixun. All rights reserved.

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-18  
**Maintainer**: Underwood Inc.  
**Support**: Open an issue on GitHub
