# STREAMKIT CLOUD STORAGE ARCHITECTURE AUDIT & MIGRATION PLAN (REVISED)

**Target:** Streamkit OBS Control Panel  
**Scope:** Text Cyclers, Swaps, Layouts, Notes, Scene Activity Tracking  
**Migration Strategy:** **FULL REFACTOR - NO LEGACY CODE, NO DEPRECATION** 🏴‍☠️  
**Date:** 2026-01-18

---

## ⚠ **USER DECISION: OPTION A - FULL MIGRATION**

**THIS IS A COMPLETE REFACTOR, NOT AN INCREMENTAL MIGRATION**

This means:
- ✓ Migrate **ALL** features (text cyclers, swaps, layouts, notes, scene activity)
- ✓ Use generic atomic config API for all storage (`/configs/{type}`)
- ✓ **COMPLETELY DELETE** old notes handlers from OTP Auth Service
- ✓ **NO backward compatibility** for local storage (users re-sync from OBS or cloud)
- ✓ **NO deprecation warnings** or phased migration
- ✓ Clean, scalable, industry-standard architecture from day one
- ✓ Complete separation of concerns (notes OUT of auth service)
- ✓ Atomic storage design (one key per config item)
- ✓ Customer-isolated cloud storage

**What Gets Deleted (NO MERCY):**
- 🗑️ `serverless/otp-auth-service/handlers/notes/` - **COMPLETE REMOVAL**
- 🗑️ Notes routes in `otp-auth-service/router/admin-routes.ts` - **DELETE**
- 🗑️ Notes types in `otp-auth-service/types.ts` - **DELETE**
- 🗑️ All notes tests in otp-auth-service - **DELETE**
- 🗑️ Notes documentation in otp-auth-service README - **DELETE**

**NO "deprecated" warnings, NO legacy endpoints, NO gradual migration!**

---

## 📊 **CURRENT ARCHITECTURE ANALYSIS**

### **1. Current Streamkit Storage (Client-Side Only)**

#### Storage Layers (All Local):
```
┌─────────────────────────────────────────────────────────────────┐
│ Client-Side Storage (Streamkit Control Panel)                   │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: IndexedDB (Primary) - Long-term, async                 │
│ Layer 2: localStorage (Backup) - Sync, 10MB limit               │
│ Layer 3: Recovery Snapshot - JSON backup (localStorage)         │
│ Layer 4: OBS Persistent Data - Cross-client sync (WebSocket)    │
└─────────────────────────────────────────────────────────────────┘
            ↓ NO CLOUD PERSISTENCE ↓
     [ Data loss risk if all layers fail ]
```

**File:** `src/modules/storage.ts`

**API:**
- `storage.get(key)` - Get value from memory cache
- `storage.set(key, value)` - Write to IDB + localStorage + memory
- `storage.export()` - Create backup snapshot
- `storage.import(data)` - Restore from backup
- `storage.sync()` - Sync with OBS WebSocket (cross-client)

#### Data Structures Stored:
```typescript
// Text Cycler Configs
export interface TextCyclerConfig {
  id: string;
  name: string;
  mode: 'browser' | 'legacy';
  configId?: string;
  textSource?: string;
  textLines: string[];
  transition?: string;
  transDuration?: number;
  cycleDuration?: number;
  styles?: TextCyclerStyles;
  isRunning?: boolean;
  cycleIndex?: number;
}

// Swap Configs
export interface SwapConfig {
  name: string;
  sourceA: string;
  sourceB: string;
  style?: string;
  duration?: number;
  easing?: string;
  preserveAspect?: boolean;
}

// Layout Presets
export interface LayoutPreset {
  id: string;
  name: string;
  scene: string;
  sources: LayoutSource[];
  timestamp: string;
}

// Storage Backup (all configs)
export interface StorageBackup {
  version: number;
  timestamp: string;
  exportedCategories: string[];
  swapConfigs?: SwapConfig[];
  layoutPresets?: LayoutPreset[];
  textCyclerConfigs?: TextCyclerConfig[];
  ui_state?: Record<string, any>;
  connectionSettings?: { host?: string; port?: string };
}
```

#### Current Storage Keys:
```typescript
// Stored in IndexedDB + localStorage:
'swapConfigs'         // Array of SwapConfig
'layoutPresets'       // Array of LayoutPreset
'textCyclerConfigs'   // Array of TextCyclerConfig
'clipsConfigs'        // Array (not used yet)
'ui_*'                // UI state (e.g. ui_resizable_zones)
'connectionSettings'  // OBS WebSocket connection info
'storage_recovery_snapshot' // Full backup
```

**Problems:**
1. **NO cloud persistence** - All data is local
2. **Monolithic storage** - Single array per feature type (not atomic)
3. **No versioning** - Can't track config changes
4. **No conflict resolution** - Last-write-wins on sync
5. **No query capabilities** - Must load entire array to find one config

---

### **2. Current Notes Storage (Separate, Already Cloud-First)**

**File:** `src/modules/notes-storage.ts`  
**API Endpoint:** `https://auth.idling.app/notes/*` (OTP Auth Service)

**Current API:**
- `POST /notes/save` - Save notebook
- `GET /notes/load?notebookId=X` - Load notebook
- `GET /notes/list` - List all notebooks
- `DELETE /notes/delete?notebookId=X` - Delete notebook

**Storage:** `OTP_AUTH_KV` (Cloudflare KV in OTP Auth Service)

**Problems:**
1. **Wrong service** - Notes are NOT authentication-related
2. **Wrong KV namespace** - Should be in Streamkit KV, not OTP Auth KV
3. **Inconsistent API pattern** - Should use `/configs/notes` like other features
4. **Separation of concerns violation** - Auth service should NOT handle Streamkit data

---

### **3. Scene Activity Tracking (NOT IMPLEMENTED)**

**User Requirement:** Sort scene list by most actively used

**Current State:**
- ❌ NO tracking
- ❌ NO API
- ❌ NO storage
- ❌ Scenes are sorted in reverse order (least active first)

**Needed:**
- ✓ Track scene switches via API
- ✓ Store in cloud (Cloudflare KV with TTL)
- ✓ FIFO rolling overwrite (30-day TTL)
- ✓ Frontend fetches top scenes and sorts UI

---

## 🚨 **CRITICAL FLAWS IN CURRENT ARCHITECTURE**

### 1. **NO Cloud Persistence** ⚠
- **Risk:** Data loss if IndexedDB corrupted + localStorage cleared + OBS not running
- **Impact:** Users lose all configs (text cyclers, swaps, layouts)
- **Solution:** Cloud-first architecture with Cloudflare KV

### 2. **No Scene Activity Tracking** ⚠
- **Requirement:** Sort scenes by most actively used (user requested)
- **Current:** Scenes are NOT tracked, sorted in reverse order
- **Solution:** Track switches via API, store in KV, expose `/scene-activity/top` endpoint

### 3. **Monolithic Storage Design** ⚠
- **Problem:** Single array per feature type (e.g. `textCyclerConfigs[]`)
- **Impact:** Cannot add/update/delete one config without loading entire array
- **Impact:** No query/filter capabilities
- **Impact:** Merge conflicts on concurrent edits
- **Solution:** Atomic storage (one KV key per config item)

### 4. **Notes in Wrong Service** ⚠
- **Problem:** Notes stored in OTP Auth Service (`otp-auth-service/handlers/notes/`)
- **Impact:** Violates separation of concerns
- **Impact:** Uses wrong KV namespace (`OTP_AUTH_KV` instead of `STREAMKIT_KV`)
- **Impact:** Inconsistent API pattern (`/notes/*` instead of `/configs/notes`)
- **Solution:** **DELETE** notes handlers from auth service, move to Streamkit API

### 5. **No Customer Isolation** ⚠
- **Problem:** All storage is client-side (no server-side customer ID)
- **Impact:** Cannot enforce quotas or access control
- **Impact:** Cannot share configs across devices (cloud-first)
- **Solution:** Customer-isolated KV keys (`cust_{customerId}_streamkit_*`)

---

## 🎯 **PROPOSED SOLUTION: STREAMKIT-API WORKER**

Create a new **dedicated Cloudflare Worker** for Streamkit that:
1. Handles ALL Streamkit cloud storage (text cyclers, swaps, layouts, notes, scene activity)
2. Uses **atomic storage design** (one KV key per config item)
3. Follows **existing patterns** from `mods-api`, `customer-api`, `access-service`
4. Leverages **shared infrastructure** (`@strixun/api-framework`, `@strixun/service-client`, etc.)
5. **COMPLETELY REMOVES** notes from OTP Auth Service (no deprecation)

---

## 📦 **NEW STREAMKIT-API WORKER STRUCTURE**

### Worker Configuration

**File:** `serverless/streamkit-api/wrangler.toml`

```toml
name = "strixun-streamkit-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
node_compat = true

# Production environment (default)
[[kv_namespaces]]
binding = "STREAMKIT_KV"
id = "YOUR_KV_NAMESPACE_ID"  # Create with: wrangler kv namespace create "STREAMKIT_KV"

# Development environment
[env.development]
name = "strixun-streamkit-api-dev"

[[env.development.kv_namespaces]]
binding = "STREAMKIT_KV"
id = "YOUR_DEV_KV_NAMESPACE_ID"

[env.development.vars]
ENVIRONMENT = "development"

# Route configuration
[[routes]]
pattern = "streamkit-api.idling.app/*"
custom_domain = true
```

---

### Environment Interface

**File:** `serverless/streamkit-api/src/env.d.ts`

```typescript
export interface Env {
  // KV Namespaces
  STREAMKIT_KV: KVNamespace;
  
  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  ALLOWED_ORIGINS?: string;
  SERVICE_API_KEY?: string;
  NETWORK_INTEGRITY_KEYPHRASE?: string;
  
  // Environment variables
  ENVIRONMENT?: string;
  
  // Service URLs (for service-to-service communication)
  CUSTOMER_API_URL?: string;
  ACCESS_API_URL?: string;
  
  [key: string]: any;
}
```

---

### Package Configuration

**File:** `serverless/streamkit-api/package.json`

```json
{
  "name": "strixun-streamkit-api",
  "version": "1.0.0",
  "description": "Dedicated Cloudflare Worker for Streamkit cloud storage",
  "private": true,
  "packageManager": "pnpm@10.28.0",
  "type": "module",
  "scripts": {
    "build:deps": "pnpm --filter @strixun/types build && pnpm --filter @strixun/error-utils build && pnpm --filter @strixun/service-client build && pnpm --filter @strixun/api-framework build && pnpm --filter @strixun/schemas build",
    "predev": "pnpm run build:deps && pnpm run build:worker",
    "dev": "wrangler dev --port 8796 --local",
    "build:worker": "esbuild worker.ts --bundle --format=esm --outfile=dist/worker.js --platform=node --external:cloudflare:* --external:node:*",
    "predeploy": "pnpm run build:deps && pnpm run build:worker",
    "deploy": "wrangler deploy",
    "deploy:prod": "wrangler deploy --env production",
    "tail": "wrangler tail",
    "tail:prod": "wrangler tail --env production",
    "pretest": "pnpm run build:deps && pnpm run build:worker",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage --passWithNoTests"
  },
  "dependencies": {
    "@strixun/api-framework": "workspace:*",
    "@strixun/error-utils": "workspace:*",
    "@strixun/service-client": "workspace:*",
    "@strixun/types": "workspace:*",
    "@strixun/schemas": "workspace:*"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241127.0",
    "@vitest/coverage-v8": "^4.0.16",
    "esbuild": "^0.24.0",
    "vitest": "^4.0.16"
  }
}
```

**Port Assignment:** 8796 (next available after access-service on 8795)

---

### Generic Config API (One API for All Features!)

**Pattern:** `/configs/{type}` where `type` is `text-cyclers`, `swaps`, `layouts`, `notes`, etc.

**Endpoints:**
```
POST   /configs/text-cyclers       Create new text cycler config
GET    /configs/text-cyclers       List all text cycler configs
GET    /configs/text-cyclers/:id   Get specific text cycler config
PUT    /configs/text-cyclers/:id   Update text cycler config
DELETE /configs/text-cyclers/:id   Delete text cycler config

POST   /configs/swaps              Create new swap config
GET    /configs/swaps              List all swap configs
... (same pattern for all types)

POST   /configs/notes              Create new note/notebook
GET    /configs/notes              List all notes
... (same pattern)
```

**KV Key Pattern:**
```
cust_{customerId}_streamkit_{type}_{configId}

Examples:
cust_12345_streamkit_text-cyclers_TextRotatorA
cust_12345_streamkit_swaps_CamSwap1
cust_12345_streamkit_layouts_MainLayout
cust_12345_streamkit_notes_notebook-2024-01-01
```

**Handler:** `handlers/configs/index.ts` (ONE generic handler for ALL types!)

```typescript
import { enhancedHandler } from '@strixun/api-framework';
import { Request, ExecutionContext } from '@cloudflare/workers-types';
import type { Env } from '../../env.d.js';
import { extractCustomerFromJWT } from '../../utils/auth.js';
import { buildKVKey, parseKVKey } from '../../utils/kv-keys.js';

export const createConfig = enhancedHandler<Env>(async (request, env) => {
  const customerId = await extractCustomerFromJWT(request, env);
  const url = new URL(request.url);
  const configType = url.pathname.split('/')[2]; // e.g. "text-cyclers"
  
  const body = await request.json();
  const { id, ...config } = body;
  
  if (!id) {
    return Response.json({ detail: 'Config ID is required' }, { status: 400 });
  }
  
  const kvKey = buildKVKey(customerId, configType, id);
  const value = JSON.stringify({
    ...config,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  
  await env.STREAMKIT_KV.put(kvKey, value);
  
  return Response.json({ 
    message: 'Config created',
    configId: id,
    type: configType 
  }, { status: 201 });
});

export const listConfigs = enhancedHandler<Env>(async (request, env) => {
  const customerId = await extractCustomerFromJWT(request, env);
  const url = new URL(request.url);
  const configType = url.pathname.split('/')[2];
  
  const prefix = `cust_${customerId}_streamkit_${configType}_`;
  const list = await env.STREAMKIT_KV.list({ prefix });
  
  const configs = await Promise.all(
    list.keys.map(async (key) => {
      const value = await env.STREAMKIT_KV.get(key.name);
      return value ? JSON.parse(value) : null;
    })
  );
  
  return Response.json({ 
    configs: configs.filter(Boolean),
    type: configType,
    count: configs.length 
  });
});

export const getConfig = enhancedHandler<Env>(async (request, env) => {
  const customerId = await extractCustomerFromJWT(request, env);
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const configType = pathParts[2];
  const configId = pathParts[3];
  
  if (!configId) {
    return Response.json({ detail: 'Config ID is required' }, { status: 400 });
  }
  
  const kvKey = buildKVKey(customerId, configType, configId);
  const value = await env.STREAMKIT_KV.get(kvKey);
  
  if (!value) {
    return Response.json({ detail: 'Config not found' }, { status: 404 });
  }
  
  return Response.json({ config: JSON.parse(value), type: configType });
});

export const updateConfig = enhancedHandler<Env>(async (request, env) => {
  const customerId = await extractCustomerFromJWT(request, env);
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const configType = pathParts[2];
  const configId = pathParts[3];
  
  if (!configId) {
    return Response.json({ detail: 'Config ID is required' }, { status: 400 });
  }
  
  const kvKey = buildKVKey(customerId, configType, configId);
  const existing = await env.STREAMKIT_KV.get(kvKey);
  
  if (!existing) {
    return Response.json({ detail: 'Config not found' }, { status: 404 });
  }
  
  const body = await request.json();
  const updated = {
    ...JSON.parse(existing),
    ...body,
    id: configId,
    updatedAt: new Date().toISOString(),
  };
  
  await env.STREAMKIT_KV.put(kvKey, JSON.stringify(updated));
  
  return Response.json({ 
    message: 'Config updated',
    configId,
    type: configType 
  });
});

export const deleteConfig = enhancedHandler<Env>(async (request, env) => {
  const customerId = await extractCustomerFromJWT(request, env);
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const configType = pathParts[2];
  const configId = pathParts[3];
  
  if (!configId) {
    return Response.json({ detail: 'Config ID is required' }, { status: 400 });
  }
  
  const kvKey = buildKVKey(customerId, configType, configId);
  await env.STREAMKIT_KV.delete(kvKey);
  
  return Response.json({ 
    message: 'Config deleted',
    configId,
    type: configType 
  });
});
```

---

### Scene Activity Tracking API

**Endpoints:**
```
POST /scene-activity/record        Record scene switch
GET  /scene-activity/top?limit=10  Get top N most active scenes
```

**KV Key Pattern:**
```
cust_{customerId}_scene_activity_{sceneName}

Value: { count: number, lastUsed: ISO timestamp }
TTL: 30 days (FIFO rolling overwrite)
```

**Handler:** `handlers/scene-activity/record.ts`

```typescript
import { enhancedHandler } from '@strixun/api-framework';
import type { Env } from '../../env.d.js';
import { extractCustomerFromJWT } from '../../utils/auth.js';

export const recordSceneSwitch = enhancedHandler<Env>(async (request, env) => {
  const customerId = await extractCustomerFromJWT(request, env);
  const { sceneName } = await request.json();
  
  if (!sceneName) {
    return Response.json({ detail: 'Scene name is required' }, { status: 400 });
  }
  
  const kvKey = `cust_${customerId}_scene_activity_${sceneName}`;
  const existing = await env.STREAMKIT_KV.get(kvKey);
  
  const data = existing ? JSON.parse(existing) : { count: 0, lastUsed: null };
  data.count++;
  data.lastUsed = new Date().toISOString();
  
  // Store with 30-day TTL (FIFO rolling overwrite)
  await env.STREAMKIT_KV.put(kvKey, JSON.stringify(data), {
    expirationTtl: 60 * 60 * 24 * 30, // 30 days in seconds
  });
  
  return Response.json({ 
    message: 'Scene activity recorded',
    sceneName,
    count: data.count 
  });
});
```

**Handler:** `handlers/scene-activity/top.ts`

```typescript
import { enhancedHandler } from '@strixun/api-framework';
import type { Env } from '../../env.d.js';
import { extractCustomerFromJWT } from '../../utils/auth.js';

export const getTopScenes = enhancedHandler<Env>(async (request, env) => {
  const customerId = await extractCustomerFromJWT(request, env);
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '10');
  
  const prefix = `cust_${customerId}_scene_activity_`;
  const list = await env.STREAMKIT_KV.list({ prefix });
  
  const scenes = await Promise.all(
    list.keys.map(async (key) => {
      const value = await env.STREAMKIT_KV.get(key.name);
      const sceneName = key.name.replace(prefix, '');
      const data = value ? JSON.parse(value) : { count: 0, lastUsed: null };
      return { sceneName, ...data };
    })
  );
  
  // Sort by count DESC, then by lastUsed DESC
  scenes.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
  });
  
  return Response.json({ 
    scenes: scenes.slice(0, limit),
    total: scenes.length 
  });
});
```

---

### KV Key Utilities

**File:** `utils/kv-keys.ts`

```typescript
/**
 * Build a customer-isolated KV key for Streamkit configs
 * 
 * Pattern: cust_{customerId}_streamkit_{type}_{id}
 * 
 * @param customerId - Customer ID from JWT
 * @param configType - Config type (text-cyclers, swaps, layouts, notes, etc.)
 * @param configId - Unique config ID
 * @returns KV key string
 */
export function buildKVKey(customerId: string, configType: string, configId: string): string {
  return `cust_${customerId}_streamkit_${configType}_${configId}`;
}

/**
 * Parse a Streamkit KV key back into components
 * 
 * @param key - KV key string
 * @returns Parsed components or null if invalid format
 */
export function parseKVKey(key: string): {
  customerId: string;
  configType: string;
  configId: string;
} | null {
  const match = key.match(/^cust_([^_]+)_streamkit_([^_]+)_(.+)$/);
  if (!match) return null;
  
  return {
    customerId: match[1],
    configType: match[2],
    configId: match[3],
  };
}
```

---

### Router

**File:** `router/streamkit-routes.ts`

```typescript
import type { Env } from '../env.d.js';
import { createConfig, listConfigs, getConfig, updateConfig, deleteConfig } from '../handlers/configs/index.js';
import { recordSceneSwitch } from '../handlers/scene-activity/record.js';
import { getTopScenes } from '../handlers/scene-activity/top.js';

export function registerStreamkitRoutes(
  router: any
): void {
  // Generic Config API (works for ALL types: text-cyclers, swaps, layouts, notes, etc.)
  router.post('/configs/:type', createConfig);
  router.get('/configs/:type', listConfigs);
  router.get('/configs/:type/:id', getConfig);
  router.put('/configs/:type/:id', updateConfig);
  router.delete('/configs/:type/:id', deleteConfig);
  
  // Scene Activity Tracking
  router.post('/scene-activity/record', recordSceneSwitch);
  router.get('/scene-activity/top', getTopScenes);
}
```

---

## 🔄 **FRONTEND MIGRATION PLAN**

### 1. Update API Base URL

All frontend modules must point to the new Streamkit API:

```typescript
// src/config/api.ts
export const STREAMKIT_API_URL = import.meta.env.PROD 
  ? 'https://streamkit-api.idling.app' 
  : 'http://localhost:8796';
```

### 2. Update Text Cycler Storage

**File:** `src/pages/TextCycler.svelte`

```typescript
// OLD (local storage):
import { storage } from '../modules/storage';
const configs = storage.get('textCyclerConfigs') || [];

// NEW (cloud API):
import { STREAMKIT_API_URL } from '../config/api';
import { authenticatedFetch } from '../modules/auth';

async function loadConfigs() {
  const response = await authenticatedFetch(`${STREAMKIT_API_URL}/configs/text-cyclers`);
  const data = await response.json();
  return data.configs || [];
}

async function saveConfig(config: TextCyclerConfig) {
  await authenticatedFetch(`${STREAMKIT_API_URL}/configs/text-cyclers`, {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

async function deleteConfig(id: string) {
  await authenticatedFetch(`${STREAMKIT_API_URL}/configs/text-cyclers/${id}`, {
    method: 'DELETE',
  });
}
```

### 3. Update Swaps Storage

**File:** `src/modules/source-swaps.ts`

```typescript
// Same pattern as text cyclers, but use /configs/swaps endpoint
```

### 4. Update Layouts Storage

**File:** `src/modules/layouts.ts`

```typescript
// Same pattern, use /configs/layouts endpoint
```

### 5. Update Notes Storage

**File:** `src/modules/notes-storage.ts`

**CRITICAL:** Update API URL from `auth.idling.app/notes` to `streamkit-api.idling.app/configs/notes`

```typescript
// OLD (otp-auth-service):
const NOTES_API_URL = 'https://auth.idling.app';
POST /notes/save
GET /notes/load?notebookId=X
GET /notes/list
DELETE /notes/delete?notebookId=X

// NEW (streamkit-api, generic config API):
const STREAMKIT_API_URL = 'https://streamkit-api.idling.app';
POST /configs/notes
GET /configs/notes
GET /configs/notes/:id
DELETE /configs/notes/:id

// Update all functions:
export async function saveNotebook(notebookId: string, content: any, metadata: any) {
  await authenticatedFetch(`${STREAMKIT_API_URL}/configs/notes`, {
    method: 'POST',
    body: JSON.stringify({ id: notebookId, content, metadata }),
  });
}

export async function loadNotebook(notebookId: string) {
  const response = await authenticatedFetch(`${STREAMKIT_API_URL}/configs/notes/${notebookId}`);
  const data = await response.json();
  return data.config;
}

export async function listNotebooks() {
  const response = await authenticatedFetch(`${STREAMKIT_API_URL}/configs/notes`);
  const data = await response.json();
  return data.configs || [];
}

export async function deleteNotebook(notebookId: string) {
  await authenticatedFetch(`${STREAMKIT_API_URL}/configs/notes/${notebookId}`, {
    method: 'DELETE',
  });
}
```

### 6. Implement Scene Activity Tracking

**File:** `src/modules/scene-activity.ts` (NEW)

```typescript
import { STREAMKIT_API_URL } from '../config/api';
import { authenticatedFetch } from './auth';

/**
 * Record a scene switch for activity tracking
 */
export async function recordSceneSwitch(sceneName: string): Promise<void> {
  try {
    await authenticatedFetch(`${STREAMKIT_API_URL}/scene-activity/record`, {
      method: 'POST',
      body: JSON.stringify({ sceneName }),
    });
    console.log(`[Scene Activity] Recorded: ${sceneName}`);
  } catch (e) {
    console.warn(`[Scene Activity] Failed to record:`, e);
  }
}

/**
 * Get top N most active scenes
 */
export async function getTopScenes(limit: number = 10): Promise<Array<{ sceneName: string; count: number; lastUsed: string }>> {
  try {
    const response = await authenticatedFetch(`${STREAMKIT_API_URL}/scene-activity/top?limit=${limit}`);
    const data = await response.json();
    return data.scenes || [];
  } catch (e) {
    console.warn(`[Scene Activity] Failed to fetch top scenes:`, e);
    return [];
  }
}

/**
 * Sort scene list by activity (most active first)
 */
export function sortScenesByActivity(
  scenes: Array<{ sceneName: string; sceneIndex: number }>,
  activityData: Array<{ sceneName: string; count: number }>
): Array<{ sceneName: string; sceneIndex: number }> {
  return scenes.sort((a, b) => {
    const activityA = activityData.find(s => s.sceneName === a.sceneName)?.count || 0;
    const activityB = activityData.find(s => s.sceneName === b.sceneName)?.count || 0;
    return activityB - activityA; // Most active first
  });
}
```

### 7. Update Sources Module to Track Scene Switches

**File:** `src/modules/sources.ts`

```typescript
import { recordSceneSwitch } from './scene-activity';

export async function switchToScene(sceneName: string): Promise<void> {
  // ... existing OBS WebSocket logic ...
  
  await request('SetCurrentProgramScene', { sceneName });
  log(`Switched to scene: ${sceneName}`, 'success');
  
  // Track scene activity for sorting
  recordSceneSwitch(sceneName); // NO await - fire and forget
}
```

### 8. Update InfoBar to Sort Scenes by Activity

**File:** `src/lib/components/InfoBar.svelte`

```typescript
import { Sources } from '../../modules/sources';
import { getTopScenes, sortScenesByActivity } from '../../modules/scene-activity';

let sceneList: Array<{ sceneName: string; sceneIndex: number }> = [];
let activityData: Array<{ sceneName: string; count: number }> = [];

async function loadSceneList(): Promise<void> {
  await Sources.refreshSceneList();
  
  // Fetch activity data
  activityData = await getTopScenes(20);
  
  // Sort scenes by activity
  sceneList = sortScenesByActivity(Sources.allScenes, activityData);
}
```

---

## 🗑️ **COMPLETE CLEANUP (NO DEPRECATION)**

### Delete Notes from OTP Auth Service

**FULL REMOVAL - NO WARNINGS, NO PHASED MIGRATION**

```bash
# 1. Delete handlers
rm -rf serverless/otp-auth-service/handlers/notes/

# 2. Remove routes from router
# Edit: serverless/otp-auth-service/router/admin-routes.ts
# DELETE all /notes/* route handlers

# 3. Remove types
# Edit: serverless/otp-auth-service/types.ts
# DELETE NotebookMetadata, Notebook, etc.

# 4. Remove tests
rm -rf serverless/otp-auth-service/tests/notes/

# 5. Update README
# Edit: serverless/otp-auth-service/README.md
# DELETE all notes documentation

# 6. Test build
cd serverless/otp-auth-service
pnpm run build:worker  # Must succeed

# 7. Test deployment
pnpm exec wrangler deploy --dry-run

# 8. Deploy
pnpm exec wrangler deploy
```

**NO deprecation warnings in old endpoints - they're GONE!**

---

## 📋 **GITHUB WORKFLOW CONFIGURATION**

### Add Streamkit API to `.github/workflows/deploy-manager.yml`

#### 1. Add Input (line ~85, after `deploy_chat_hub`)
```yaml
deploy_streamkit_api:
  description: 'Deploy Streamkit API'
  type: boolean
  default: true
```

#### 2. Add Test Job (line ~513, after `test_chat_api`)
```yaml
test_streamkit_api:
  needs: setup
  if: ${{ inputs.deploy_streamkit_api }}
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Setup pnpm
      uses: pnpm/action-setup@v4
      with:
        version: 10.28.0
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'pnpm'
        cache-dependency-path: 'pnpm-lock.yaml'
    
    - name: Install all dependencies
      working-directory: .
      run: pnpm install --frozen-lockfile
    
    - name: Check for test script
      id: check_test
      working-directory: serverless/streamkit-api
      run: |
        if [ -f "vitest.config.ts" ] || [ -f "vitest.config.js" ]; then
          echo "has_tests=true" >> $GITHUB_OUTPUT
        elif grep -q '"test"' package.json && ! grep -q 'Error: no test specified' package.json; then
          echo "has_tests=true" >> $GITHUB_OUTPUT
        else
          echo "has_tests=false" >> $GITHUB_OUTPUT
        fi
    
    - name: Run Streamkit API Tests
      if: steps.check_test.outputs.has_tests == 'true'
      working-directory: serverless/streamkit-api
      env:
        JWT_SECRET: ${{ secrets.JWT_SECRET }}
        NETWORK_INTEGRITY_KEYPHRASE: ${{ secrets.NETWORK_INTEGRITY_KEYPHRASE }}
      run: pnpm run build:deps && pnpm test
    
    - name: Skip Tests (No test script)
      if: steps.check_test.outputs.has_tests == 'false'
      run: echo "⚠ No test script found in Streamkit API - skipping tests"
```

#### 3. Add Deployment Job (line ~1211, after `deploy_chat_api`)
```yaml
# Streamkit API Deployment
deploy_streamkit_api:
  needs: [setup, test_streamkit_api]
  if: ${{ inputs.deploy_streamkit_api && (needs.test_streamkit_api.result == 'success' || needs.test_streamkit_api.result == 'skipped') }}
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Setup pnpm
      uses: pnpm/action-setup@v4
      with:
        version: 10.28.0
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'pnpm'
        cache-dependency-path: 'pnpm-lock.yaml'
    
    - name: Install all dependencies
      working-directory: .
      run: pnpm install --frozen-lockfile
    
    - name: Build Worker
      working-directory: serverless/streamkit-api
      run: pnpm run build:deps && pnpm run build:worker
    
    - name: Create KV Namespace (if needed)
      working-directory: serverless/streamkit-api
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
        CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
      run: |
        echo "Creating KV namespace STREAMKIT_KV (if it doesn't exist)..."
        pnpm exec wrangler kv namespace create "STREAMKIT_KV" || true
      continue-on-error: true
    
    - name: Deploy to Cloudflare Workers
      id: deploy
      working-directory: serverless/streamkit-api
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
        CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
      run: |
        if [ "${{ inputs.environment }}" == "development" ]; then
          pnpm exec wrangler deploy --env development
        else
          pnpm exec wrangler deploy
        fi

    - name: Rollback on Failure
      if: failure()
      run: |
        echo "✗ Deployment failed - manual rollback required"
        echo "Please check Cloudflare dashboard and rollback if needed"
        exit 1
    
    - name: Set Worker Secrets
      working-directory: serverless/streamkit-api
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
        CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
      run: |
        ENV_FLAG=""
        if [ "${{ inputs.environment }}" == "development" ]; then
          ENV_FLAG="--env development"
        fi
        if [ -n "${{ secrets.JWT_SECRET }}" ]; then
          echo "${{ secrets.JWT_SECRET }}" | pnpm exec wrangler secret put JWT_SECRET $ENV_FLAG || true
        fi
        if [ -n "${{ secrets.ALLOWED_ORIGINS }}" ]; then
          echo "${{ secrets.ALLOWED_ORIGINS }}" | pnpm exec wrangler secret put ALLOWED_ORIGINS $ENV_FLAG || true
        else
          echo "⚠  WARNING: ALLOWED_ORIGINS GitHub secret is not set! CORS will fail in production."
        fi
        if [ -n "${{ secrets.SERVICE_API_KEY }}" ]; then
          echo "${{ secrets.SERVICE_API_KEY }}" | pnpm exec wrangler secret put SERVICE_API_KEY $ENV_FLAG || true
        fi
        if [ -n "${{ secrets.NETWORK_INTEGRITY_KEYPHRASE }}" ]; then
          echo "${{ secrets.NETWORK_INTEGRITY_KEYPHRASE }}" | pnpm exec wrangler secret put NETWORK_INTEGRITY_KEYPHRASE $ENV_FLAG || true
        fi
      continue-on-error: true
```

#### 4. Update Summary Job (line ~1649)
```yaml
# Update the needs array to include:
summary:
  needs: [test_root, test_otp_auth, test_twitch_api, test_mods_api, test_customer_api, test_game_api, test_url_shortener, test_access_service, test_chat_api, test_streamkit_api, deploy_twitch_api, deploy_mods_api, deploy_otp_auth, deploy_customer_api, deploy_game_api, deploy_url_shortener, deploy_access_service, deploy_chat_api, deploy_streamkit_api, deploy_mods_hub, deploy_access_hub, deploy_chat_hub, deploy_storybook, deploy_pages]
```

#### 5. Add Test Summary Output (line ~1760, after chat_api test)
```yaml
if [ "${{ inputs.deploy_streamkit_api }}" == "true" ]; then
  if [ "${{ needs.test_streamkit_api.result }}" == "success" ]; then
    echo "✓ **Streamkit API Tests** - Passed" >> $GITHUB_STEP_SUMMARY
  elif [ "${{ needs.test_streamkit_api.result }}" == "failure" ]; then
    echo "✗ **Streamkit API Tests** - Failed (deployment blocked)" >> $GITHUB_STEP_SUMMARY
  elif [ "${{ needs.test_streamkit_api.result }}" == "skipped" ]; then
    echo "⏭️ **Streamkit API Tests** - Skipped (no test script)" >> $GITHUB_STEP_SUMMARY
  else
    echo "⏭️ **Streamkit API Tests** - Skipped" >> $GITHUB_STEP_SUMMARY
  fi
fi
```

#### 6. Add Deployment Summary Output (line ~1868, after chat_hub deployment)
```yaml
if [ "${{ inputs.deploy_streamkit_api }}" == "true" ]; then
  if [ "${{ needs.deploy_streamkit_api.result }}" == "success" ]; then
    echo "✓ **Streamkit API** - Deployed to streamkit-api.idling.app" >> $GITHUB_STEP_SUMMARY
  else
    echo "✗ **Streamkit API** - Deployment Failed or Blocked by Tests" >> $GITHUB_STEP_SUMMARY
  fi
fi
```

---

## 📋 **DEV SCRIPT CONFIGURATION**

### Streamkit API Package Configuration

**File:** `serverless/streamkit-api/package.json`

```json
{
  "name": "strixun-streamkit-api",
  "version": "1.0.0",
  "description": "Dedicated Cloudflare Worker for Streamkit cloud storage",
  "private": true,
  "packageManager": "pnpm@10.28.0",
  "type": "module",
  "scripts": {
    "build:deps": "pnpm --filter @strixun/types build && pnpm --filter @strixun/error-utils build && pnpm --filter @strixun/service-client build && pnpm --filter @strixun/api-framework build && pnpm --filter @strixun/schemas build",
    "predev": "pnpm run build:deps && pnpm run build:worker",
    "dev": "wrangler dev --port 8796 --local",
    "build:worker": "esbuild worker.ts --bundle --format=esm --outfile=dist/worker.js --platform=node --external:cloudflare:* --external:node:*",
    "predeploy": "pnpm run build:deps && pnpm run build:worker",
    "deploy": "wrangler deploy",
    "deploy:prod": "wrangler deploy --env production",
    "tail": "wrangler tail",
    "tail:prod": "wrangler tail --env production",
    "pretest": "pnpm run build:deps && pnpm run build:worker",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage --passWithNoTests"
  }
}
```

**CRITICAL:** Port 8796 is the next available port in the worker lineup:
- 8787: otp-auth-service
- 8788: mods-api
- 8789: twitch-api
- 8790: customer-api
- 8791: music-api
- 8792: chat-signaling
- 8793: url-shortener
- 8794: game-api
- 8795: access-service
- **8796: streamkit-api** ← NEW!

### Root Package.json (NO CHANGES NEEDED!)

**The root `package.json` already has the correct configuration:**

```json
{
  "scripts": {
    "dev": "pnpm build:packages && vite",
    "dev:turbo": "turbo run dev --concurrency=25"
  }
}
```

**NO filters, NO exclusions** - `dev:turbo` runs `dev` on EVERY package that has a `dev` script!

### Usage

```bash
# Start EVERYTHING (Streamkit UI + Streamkit API + ALL workers + ALL apps)
pnpm dev:turbo

# This will start:
# - Streamkit UI (root vite on port 5173)
# - Streamkit API (wrangler on port 8796)
# - All other workers (8787-8795)
# - All frontend apps (mods-hub, access-hub, etc.)

# Start Streamkit UI only (no workers)
pnpm dev

# Start Streamkit API only (for testing)
pnpm --filter strixun-streamkit-api dev
```

**RECOMMENDED:** Just use `pnpm dev:turbo` - it starts EVERYTHING in parallel!

---

## ✅ **IMPLEMENTATION CHECKLIST**

### Phase 1: Worker Creation & Setup
- [ ] Create `serverless/streamkit-api/` directory
- [ ] Create `wrangler.toml` (copy from mods-api, update bindings, set port to 8796)
- [ ] Create `package.json` with dependencies and dev script (`wrangler dev --port 8796 --local`)
- [ ] Create `tsconfig.json`
- [ ] Create `src/env.d.ts` (Env interface)
- [ ] Create `src/index.ts` (worker entry point)
- [ ] Add to root workspace `package.json` (`pnpm-workspace.yaml` should auto-detect)
- [ ] Install dependencies: `cd serverless/streamkit-api && pnpm install`
- [ ] Create KV namespace: `pnpm exec wrangler kv namespace create "STREAMKIT_KV"`
- [ ] Update `wrangler.toml` with KV namespace ID
- [ ] Test build: `pnpm run build:deps && pnpm run build:worker`
- [ ] Test local dev: `pnpm dev` (should start on localhost:8796)
- [ ] Verify `pnpm dev:turbo` from root includes streamkit-api

### Phase 2: Generic Config API (ALL Features)
- [ ] Create `utils/kv-keys.ts` (buildKVKey, parseKVKey)
- [ ] Create `utils/auth.ts` (extractCustomerFromJWT)
- [ ] Create `handlers/configs/index.ts` (createConfig, listConfigs, getConfig, updateConfig, deleteConfig)
- [ ] Create `router/streamkit-routes.ts`
- [ ] Add routes to main `src/index.ts`
- [ ] Test POST /configs/text-cyclers (create)
- [ ] Test GET /configs/text-cyclers (list)
- [ ] Test GET /configs/text-cyclers/:id (get)
- [ ] Test PUT /configs/text-cyclers/:id (update)
- [ ] Test DELETE /configs/text-cyclers/:id (delete)
- [ ] Verify customer isolation (check KV keys in Cloudflare Dashboard)
- [ ] Test with swaps: POST /configs/swaps, GET /configs/swaps, etc.
- [ ] Test with layouts: POST /configs/layouts, GET /configs/layouts, etc.
- [ ] Test with notes: POST /configs/notes, GET /configs/notes, etc.

### Phase 3: Scene Activity Tracking
- [ ] Create `handlers/scene-activity/record.ts`
- [ ] Create `handlers/scene-activity/top.ts`
- [ ] Add routes to `router/streamkit-routes.ts`
- [ ] Create `src/modules/scene-activity.ts` (frontend)
- [ ] Update `src/modules/sources.ts` to call `recordSceneSwitch()`
- [ ] Verify `src/lib/components/InfoBar.svelte` uses `sortScenesByActivity()`
- [ ] Test scene switch recording (check KV in Cloudflare Dashboard)
- [ ] Test top scenes retrieval (GET /scene-activity/top)
- [ ] Test scene list sorting in UI
- [ ] Verify FIFO (check TTL in Cloudflare Dashboard - should be 30 days)

### Phase 4: Frontend Migration (Text Cyclers)
- [ ] Create `src/config/api.ts` (STREAMKIT_API_URL)
- [ ] Update `src/pages/TextCycler.svelte` to use /configs/text-cyclers API
- [ ] Test save operation
- [ ] Test list operation
- [ ] Test get operation
- [ ] Test update operation
- [ ] Test delete operation
- [ ] Test cross-client sync (OBS dock + remote browser)

### Phase 5: Frontend Migration (Swaps & Layouts)
- [ ] Update `src/modules/source-swaps.ts` to use /configs/swaps API
- [ ] Update `src/modules/layouts.ts` to use /configs/layouts API
- [ ] Test swaps save/load/delete operations
- [ ] Test layouts save/load/delete operations

### Phase 6: Frontend Migration (Notes)
- [ ] Update `src/modules/notes-storage.ts` API URL (auth.idling.app → streamkit-api.idling.app)
- [ ] Update endpoints (/notes/save → /configs/notes, etc.)
- [ ] Test notes save/load/delete with new API
- [ ] Verify customer isolation

### Phase 7: **COMPLETE DELETION** of Notes from OTP Auth Service
- [ ] **DELETE** `serverless/otp-auth-service/handlers/notes/` directory
- [ ] **DELETE** notes routes from `serverless/otp-auth-service/router/admin-routes.ts`
- [ ] **DELETE** notes types from `serverless/otp-auth-service/types.ts`
- [ ] **REMOVE** all references to notes in otp-auth-service README
- [ ] **REMOVE** notes test files from otp-auth-service
- [ ] Test that `otp-auth-service` builds without notes: `cd serverless/otp-auth-service && pnpm run build:worker`
- [ ] Test that `otp-auth-service` tests pass without notes: `cd serverless/otp-auth-service && pnpm test`
- [ ] Deploy `otp-auth-service` to verify no breaking changes
- [ ] **NO deprecation warnings** - clean removal confirmed!

### Phase 8: GitHub Workflow Configuration
- [ ] Add `deploy_streamkit_api` input to `.github/workflows/deploy-manager.yml` (line ~85)
- [ ] Add `test_streamkit_api` job (after `test_chat_api`, line ~513)
- [ ] Add `deploy_streamkit_api` job (after `deploy_chat_api`, line ~1211)
- [ ] Add `test_streamkit_api` and `deploy_streamkit_api` to `summary` job needs array
- [ ] Add test result output to summary (tests section)
- [ ] Add deployment result output to summary (deployment section)
- [ ] Test workflow locally with `act` or validate YAML syntax
- [ ] Verify KV namespace creation step
- [ ] Verify secret injection step
- [ ] Test full deployment via GitHub Actions

### Phase 9: Dev Script Configuration
- [ ] Create `serverless/streamkit-api/package.json` with `dev` script (`wrangler dev --port 8796 --local`)
- [ ] Add `predev` script to build deps before starting worker
- [ ] Add `build:deps`, `build:worker`, `test` scripts (follow mods-api pattern)
- [ ] Verify root `package.json` has `dev:turbo` without filters (should already be correct)
- [ ] Test `pnpm dev:turbo` (SHOULD start streamkit-api on localhost:8796 + all other workers)
- [ ] Test `pnpm --filter strixun-streamkit-api dev` (should start API only on localhost:8796)
- [ ] Test `pnpm dev` (should start Streamkit UI only, no workers)
- [ ] Verify port 8796 is not conflicting with other services
- [ ] Document dev commands in root README

### Phase 10: Documentation & Testing
- [ ] Write `serverless/streamkit-api/README.md`
- [ ] Write API documentation (endpoints, request/response formats)
- [ ] Write migration guide for users
- [ ] Document KV key structure
- [ ] Document sync strategy
- [ ] Add E2E tests for critical flows
- [ ] Load test scene activity tracking (stress test)
- [ ] Security audit (JWT validation, customer isolation)
- [ ] Performance test (measure API response times)
- [ ] Final QA pass

---

## 📈 **ESTIMATED EFFORT**

**Total: ~2-3 days** (with existing infrastructure)

| Phase | Task | Effort |
|-------|------|--------|
| 1 | Worker creation & setup | 2 hours |
| 2 | Generic config API (ALL features) | 4 hours |
| 3 | Scene activity tracking | 2 hours |
| 4 | Frontend migration (text cyclers) | 2 hours |
| 5 | Frontend migration (swaps & layouts) | 2 hours |
| 6 | Frontend migration (notes) | 1 hour |
| 7 | **DELETE** notes from otp-auth-service | 1 hour |
| 8 | GitHub workflow configuration | 1 hour |
| 9 | Dev script configuration | 30 minutes |
| 10 | Documentation & testing | 4 hours |
| **Total** | | **19.5 hours (~2.5 days)** |

---

## 🏁 **SUCCESS CRITERIA**

1. ✓ **Streamkit API deployed** to `streamkit-api.idling.app`
2. ✓ **All features use cloud storage** (text cyclers, swaps, layouts, notes)
3. ✓ **Scene activity tracking works** (records switches, sorts by most active)
4. ✓ **Customer isolation verified** (KV keys use `cust_{customerId}_*` pattern)
5. ✓ **Notes COMPLETELY REMOVED** from OTP Auth Service (no handlers, routes, types, or tests)
6. ✓ **NO deprecation warnings** anywhere in codebase
7. ✓ **GitHub workflow includes streamkit-api** (tests + deployment)
8. ✓ **Dev scripts work** (`pnpm dev:turbo` starts API on port 8796, `pnpm --filter strixun-streamkit-api dev` works)
9. ✓ **Cross-client sync works** (OBS dock + remote browser)
10. ✓ **No data loss** (cloud-first architecture)

---

## 📚 **RESOURCES**

### Existing Patterns to Reference
- `serverless/mods-api/` - Worker structure, router, handlers
- `serverless/customer-api/` - Customer-isolated KV storage
- `serverless/access-service/` - Permissions & quotas
- `serverless/otp-auth-service/` - JWT authentication, customer extraction
- `packages/api-framework/` - Enhanced handlers, CORS, RFC 7807 errors
- `packages/service-client/` - Service-to-service communication
- `packages/schemas/` - Valibot validation

### Documentation
- `serverless/otp-auth-service/STORAGE_ARCHITECTURE.md` - Storage patterns
- `serverless/mods-api/README.md` - Mods API reference
- `packages/api-framework/README.md` - API framework docs
- `packages/service-client/README.md` - Service client docs
- `packages/schemas/README.md` - Schema validation docs

---

**Document Version:** 2.0 (REVISED)  
**Last Updated:** 2026-01-18  
**Author:** AI Assistant (Wise Old Sage 🧙‍♂️)  
**Status:** 📋 Awaiting Approval (Full Migration Selected)
