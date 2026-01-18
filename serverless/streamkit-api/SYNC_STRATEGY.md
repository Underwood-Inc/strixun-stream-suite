# Streamkit API - Sync Strategy

**Comprehensive documentation of the cloud synchronization strategy for Streamkit configurations.**

---

## 🎯 Overview

Streamkit uses a **hybrid local-first + cloud-sync** architecture that provides:

✅ **Instant responsiveness** (local writes)  
✅ **No data loss** (cloud backup)  
✅ **Cross-device sync** (cloud-first)  
✅ **Offline capability** (local fallback)  
✅ **Multi-client sync** (OBS WebSocket + Cloud)  

---

## 🏗️ Architecture Layers

### Layer 1: Memory Cache (Fastest)

**Location**: JavaScript heap  
**Purpose**: Instant read access  
**Persistence**: Session-only  

```typescript
// In-memory cache
const storageCache: Record<string, unknown> = {};

// Read from cache
const value = storageCache['textCyclerConfigs'];
```

**Characteristics:**
- ⚡ **Speed**: ~1μs read time
- 💾 **Capacity**: Unlimited (within heap limits)
- 🔄 **Persistence**: Lost on page reload
- 🎯 **Use Case**: Hot path reads

---

### Layer 2: IndexedDB (Primary Local Storage)

**Location**: Browser IndexedDB  
**Purpose**: Persistent local storage  
**Persistence**: Survives page reload, browser restart  

```typescript
// Write to IndexedDB
const db = await openDB('StrixunStreamkit', 1);
await db.put('storage', value, key);

// Read from IndexedDB
const value = await db.get('storage', key);
```

**Characteristics:**
- ⚡ **Speed**: ~1-5ms read/write
- 💾 **Capacity**: ~50MB - 100MB+ (browser-dependent)
- 🔄 **Persistence**: Permanent (until cleared)
- 🎯 **Use Case**: Primary local persistence

---

### Layer 3: localStorage (Backup Local Storage)

**Location**: Browser localStorage  
**Purpose**: Backup for IndexedDB failures  
**Persistence**: Survives page reload, browser restart  

```typescript
// Write to localStorage
localStorage.setItem('strixun_textCyclerConfigs', JSON.stringify(value));

// Read from localStorage
const value = JSON.parse(localStorage.getItem('strixun_textCyclerConfigs') || 'null');
```

**Characteristics:**
- ⚡ **Speed**: ~1-2ms read/write (synchronous)
- 💾 **Capacity**: ~5-10MB (browser-dependent)
- 🔄 **Persistence**: Permanent (until cleared)
- 🎯 **Use Case**: Backup storage, recovery

---

### Layer 4: OBS Persistent Data (Cross-Client Local Sync)

**Location**: OBS WebSocket persistent storage  
**Purpose**: Sync between OBS dock and remote browsers  
**Persistence**: Survives OBS restart  

```typescript
// Write to OBS persistent data
await request('SetPersistentData', {
  realm: 'OBS_WEBSOCKET_DATA_REALM_GLOBAL',
  slotName: 'strixun_configs',
  slotValue: JSON.stringify(storageData)
});

// Read from OBS persistent data
const data = await request('GetPersistentData', {
  realm: 'OBS_WEBSOCKET_DATA_REALM_GLOBAL',
  slotName: 'strixun_configs'
});
```

**Characteristics:**
- ⚡ **Speed**: ~50-200ms read/write (WebSocket)
- 💾 **Capacity**: ~100MB+ (OBS-dependent)
- 🔄 **Persistence**: Permanent (stored in OBS profile)
- 🎯 **Use Case**: Multi-client sync (OBS dock ↔ remote browser)

---

### Layer 5: Cloud Storage (Ultimate Backup)

**Location**: Cloudflare KV (Streamkit API)  
**Purpose**: Cloud backup and cross-device sync  
**Persistence**: Permanent (until deleted)  

```typescript
// Write to cloud
await API.textCyclers.create({ id: 'config1', name: 'My Config', ... });
await API.textCyclers.update('config1', { name: 'Updated' });

// Read from cloud
const configs = await API.textCyclers.list();
const config = await API.textCyclers.get('config1');
```

**Characteristics:**
- ⚡ **Speed**: ~50-150ms read/write (edge-deployed)
- 💾 **Capacity**: Unlimited (Cloudflare KV)
- 🔄 **Persistence**: Permanent (customer-isolated)
- 🎯 **Use Case**: Cloud backup, cross-device sync

---

## 🔄 Sync Flow

### Write Flow (Create/Update Config)

```
User Action (e.g., save text cycler)
    ↓
1. Write to Memory Cache (instant)
    ↓
2. Write to IndexedDB (async, ~1-5ms)
    ↓
3. Write to localStorage (sync, ~1-2ms)
    ↓
4. Trigger Cloud Sync (debounced, 1 second)
    ↓
5. Write to Streamkit API (async, ~50-150ms)
    ↓
6. (If OBS dock) Broadcast to OBS WebSocket (debounced, 2 seconds)
```

**Debouncing:**
- **Cloud Sync**: 1-second debounce (batches rapid changes)
- **OBS Sync**: 2-second debounce (avoids WebSocket spam)

**Benefits:**
- ✅ Instant UI feedback (memory + IndexedDB)
- ✅ Reliable local backup (localStorage)
- ✅ Cloud backup (Streamkit API)
- ✅ Cross-client sync (OBS WebSocket)

---

### Read Flow (Load Configs)

```
App Initialization
    ↓
1. Read from Memory Cache (instant, if available)
    ↓ (if miss)
2. Read from IndexedDB (async, ~1-5ms)
    ↓ (if miss)
3. Read from localStorage (sync, ~1-2ms)
    ↓ (if miss)
4. Read from OBS WebSocket (if OBS dock, ~50-200ms)
    ↓ (if miss)
5. Read from Streamkit API (async, ~50-150ms)
    ↓
6. Populate all local layers (memory, IndexedDB, localStorage)
```

**Priority:**
1. Memory Cache (fastest)
2. IndexedDB (primary)
3. localStorage (backup)
4. OBS WebSocket (OBS dock only)
5. Streamkit API (cloud, slowest but most reliable)

**Benefits:**
- ✅ Fast initial load (local cache)
- ✅ Automatic cloud sync (on first load)
- ✅ Resilient to local storage failures

---

## 🔀 Conflict Resolution

### Last-Write-Wins (LWW)

Streamkit uses a **last-write-wins** strategy with `updatedAt` timestamps.

**How It Works:**
1. Each config has an `updatedAt` timestamp
2. On conflict, the config with the newest `updatedAt` wins
3. No merge logic (configs are replaced atomically)

**Example:**

```typescript
// Local config (edited 5 minutes ago)
const localConfig = {
  id: 'config1',
  name: 'Local Name',
  updatedAt: '2026-01-18T12:00:00.000Z'
};

// Cloud config (edited 1 minute ago)
const cloudConfig = {
  id: 'config1',
  name: 'Cloud Name',
  updatedAt: '2026-01-18T12:04:00.000Z'
};

// Result: Cloud wins (newest timestamp)
const winner = cloudConfig;
```

**Edge Cases:**
- **Simultaneous edits**: Cloud timestamp takes precedence
- **Clock skew**: NTP-synced timestamps (Cloudflare Workers use UTC)
- **Deleted configs**: Deletion is a write operation (newest wins)

---

### Sync Conflicts (Multi-Device)

**Scenario**: User edits config on Device A, then Device B (without syncing)

**Resolution:**
1. Device A saves config to cloud (timestamp: T1)
2. Device B saves config to cloud (timestamp: T2, T2 > T1)
3. Device A refreshes → pulls config from cloud (T2)
4. Device A's local edit is overwritten by Device B's

**Prevention:**
- Always fetch latest from cloud before editing
- Use optimistic locking (check `updatedAt` before update)
- Implement conflict UI (future enhancement)

---

## 📊 Sync Modes

### Mode 1: OBS Dock (Local + OBS WebSocket + Cloud)

**Scenario**: Control panel running as OBS custom browser dock

**Sync Strategy:**
- **Local**: IndexedDB + localStorage (primary)
- **OBS WebSocket**: Persistent data (cross-client sync)
- **Cloud**: Streamkit API (backup + cross-device)

**Flow:**
```
Write:
  Memory → IndexedDB → localStorage → Cloud (1s debounce) → OBS WebSocket (2s debounce)

Read:
  Memory → IndexedDB → localStorage → OBS WebSocket → Cloud
```

**Benefits:**
- ✅ Works offline (local storage)
- ✅ Syncs with remote browser (OBS WebSocket)
- ✅ Cloud backup for disaster recovery

---

### Mode 2: Remote Browser (Local + Cloud Only)

**Scenario**: Control panel running in standalone browser (not OBS dock)

**Sync Strategy:**
- **Local**: IndexedDB + localStorage (primary)
- **Cloud**: Streamkit API (backup + cross-device)
- **No OBS WebSocket**: Not connected to OBS

**Flow:**
```
Write:
  Memory → IndexedDB → localStorage → Cloud (1s debounce)

Read:
  Memory → IndexedDB → localStorage → Cloud
```

**Benefits:**
- ✅ Works offline (local storage)
- ✅ Cloud backup for cross-device sync
- ✅ No dependency on OBS

---

### Mode 3: Multi-Device (Cloud-First)

**Scenario**: User switches between devices (laptop, desktop, mobile)

**Sync Strategy:**
- **Cloud-First**: Always sync from cloud on app load
- **Local Cache**: IndexedDB + localStorage for offline work
- **Periodic Sync**: Background sync every 5 minutes (future)

**Flow:**
```
App Load:
  Cloud (fetch latest) → Memory → IndexedDB → localStorage

Write:
  Memory → IndexedDB → localStorage → Cloud (1s debounce)

Periodic Sync:
  Cloud (check for updates) → Memory → IndexedDB → localStorage
```

**Benefits:**
- ✅ Always up-to-date (cloud-first)
- ✅ Works offline (local cache)
- ✅ Automatic sync on app load

---

## 🚀 Performance Optimizations

### 1. Write Batching

**Problem**: Rapid config changes cause excessive API calls

**Solution**: Debounce cloud writes (1-second delay)

```typescript
let cloudWriteDebounce: Record<string, ReturnType<typeof setTimeout>> = {};
const DEBOUNCE_TIME = 1000; // 1 second

function scheduleCloudWrite(key: string, value: any): void {
  if (cloudWriteDebounce[key]) {
    clearTimeout(cloudWriteDebounce[key]);
  }
  
  cloudWriteDebounce[key] = setTimeout(async () => {
    await API.configs.update(key, value);
    delete cloudWriteDebounce[key];
  }, DEBOUNCE_TIME);
}
```

**Benefits:**
- ✅ Reduces API calls by ~90%
- ✅ Batches rapid changes
- ✅ Still responsive (local writes are instant)

---

### 2. Incremental Sync

**Problem**: Syncing 100+ configs on app load is slow

**Solution**: Only sync configs that changed since last sync

```typescript
// Store last sync timestamp
const lastSyncTime = localStorage.getItem('lastSyncTime');

// Fetch only configs updated since last sync
const updatedConfigs = await API.configs.listSince(lastSyncTime);

// Update local storage with only changed configs
for (const config of updatedConfigs) {
  localStorage.setItem(`config_${config.id}`, JSON.stringify(config));
}

// Update last sync timestamp
localStorage.setItem('lastSyncTime', new Date().toISOString());
```

**Benefits:**
- ✅ Faster initial load
- ✅ Less bandwidth
- ✅ Scales to 1000+ configs

**Status**: Not yet implemented (future enhancement)

---

### 3. Parallel Reads

**Problem**: Loading 100 configs sequentially is slow

**Solution**: Fetch all configs in parallel

```typescript
// Sequential (slow)
const configs = [];
for (const id of configIds) {
  const config = await API.configs.get(id);
  configs.push(config);
}

// Parallel (fast)
const configs = await Promise.all(
  configIds.map(id => API.configs.get(id))
);
```

**Benefits:**
- ✅ 10x faster for large config lists
- ✅ Better user experience
- ✅ Scales to 1000+ configs

**Status**: Already implemented in `cloud-storage.ts`

---

### 4. Lazy Loading

**Problem**: Loading all configs on app start is slow

**Solution**: Only load configs when needed

```typescript
// Eager loading (slow)
const allConfigs = await API.configs.list();

// Lazy loading (fast)
const configIds = await API.configs.listIds(); // Only IDs, not full configs
// Load full config only when user clicks
const config = await API.configs.get(selectedId);
```

**Benefits:**
- ✅ Faster app start
- ✅ Less memory usage
- ✅ Scales to 1000+ configs

**Status**: Not yet implemented (future enhancement)

---

## 🔐 Security Considerations

### JWT Expiration

**Problem**: JWT tokens expire, causing API calls to fail

**Solution**: Refresh JWT before expiration

```typescript
// Check JWT expiration before API call
async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Check if JWT is expired or near expiration
  const token = getToken();
  const decoded = jwtDecode(token);
  const expiresAt = decoded.exp * 1000;
  const now = Date.now();
  
  // If token expires in < 5 minutes, refresh it
  if (expiresAt - now < 5 * 60 * 1000) {
    await refreshToken();
  }
  
  // Proceed with API call
  return fetch(url, options);
}
```

**Status**: Token refresh is handled by OTP Auth Service

---

### HTTPS Only

**Requirement**: All cloud sync must use HTTPS (not HTTP)

**Enforcement:**
- Production API: `https://streamkit-api.idling.app` (enforced)
- Development: `http://localhost:8796` (local only)

**Why:**
- ✅ Prevents MITM attacks
- ✅ Protects JWT tokens in transit
- ✅ Required for HttpOnly cookies

---

## 🧪 Testing Sync Strategy

### Test 1: Offline Write + Online Sync

1. Disconnect from internet
2. Create/update config (should succeed locally)
3. Reconnect to internet
4. Verify config syncs to cloud automatically

**Expected Result**: ✅ Config syncs within 1-2 seconds of reconnection

---

### Test 2: Multi-Device Sync

1. Open Streamkit on Device A
2. Create config on Device A
3. Open Streamkit on Device B
4. Verify config appears on Device B

**Expected Result**: ✅ Config appears on Device B after page load

---

### Test 3: OBS Dock + Remote Browser Sync

1. Open Streamkit as OBS dock
2. Create config in OBS dock
3. Open Streamkit in remote browser (not OBS)
4. Verify config appears in remote browser

**Expected Result**: ✅ Config appears in remote browser (via cloud, not OBS WebSocket)

---

### Test 4: Conflict Resolution

1. Open Streamkit on Device A (offline)
2. Edit config on Device A
3. Open Streamkit on Device B (online)
4. Edit same config on Device B
5. Bring Device A online
6. Verify Device B's edit wins (newest timestamp)

**Expected Result**: ✅ Device B's edit persists (LWW)

---

## 📈 Monitoring & Observability

### Metrics to Track

1. **Sync Success Rate**: % of successful cloud syncs
2. **Sync Latency**: Time from local write to cloud confirmation
3. **Conflict Rate**: % of writes that encountered conflicts
4. **Error Rate**: % of API calls that failed
5. **Cache Hit Rate**: % of reads served from local cache

### Logging

```typescript
// Log sync events
console.log('[Sync] Cloud write started', { type, id });
console.log('[Sync] Cloud write succeeded', { type, id, latency: 123 });
console.log('[Sync] Cloud write failed', { type, id, error: 'Network timeout' });

// Log conflict resolutions
console.log('[Sync] Conflict detected', { type, id, localTimestamp, cloudTimestamp });
console.log('[Sync] Conflict resolved', { type, id, winner: 'cloud' });
```

---

## 🛠️ Troubleshooting

### Issue: Configs not syncing to cloud

**Symptoms**: Local changes don't appear on other devices

**Possible Causes:**
1. Network connectivity issue
2. JWT token expired
3. API rate limiting
4. KV storage quota exceeded

**Resolution:**
1. Check browser console for errors
2. Verify JWT token is valid
3. Check Cloudflare Worker logs
4. Verify KV storage usage

---

### Issue: Configs lost after browser restart

**Symptoms**: Local configs disappear after closing browser

**Possible Causes:**
1. IndexedDB cleared by browser
2. localStorage cleared by user
3. Cloud sync not enabled

**Resolution:**
1. Enable cloud sync (check JWT authentication)
2. Verify IndexedDB persistence
3. Export configs as backup (JSON)

---

### Issue: Slow sync performance

**Symptoms**: Long delays between local write and cloud confirmation

**Possible Causes:**
1. Slow network connection
2. API rate limiting
3. Large config payloads
4. Edge cache miss

**Resolution:**
1. Check network latency
2. Reduce debounce time (test only)
3. Compress large payloads (future)
4. Optimize KV reads (use edge cache)

---

## 📚 Future Enhancements

### 1. Incremental Sync

Only sync configs that changed since last sync (not yet implemented).

**Benefit**: Faster initial load, less bandwidth

---

### 2. Lazy Loading

Load config IDs first, fetch full configs on demand (not yet implemented).

**Benefit**: Faster app start, scales to 1000+ configs

---

### 3. Conflict UI

Show conflict resolution UI when multiple devices edit the same config (not yet implemented).

**Benefit**: User control over conflict resolution

---

### 4. Offline Queue

Queue failed sync operations and retry when online (partial implementation).

**Benefit**: More reliable sync in poor network conditions

---

### 5. Real-Time Sync

Use WebSockets for real-time sync across devices (not yet implemented).

**Benefit**: Instant sync (no polling), better UX

---

## 📝 Summary

### Key Takeaways

1. **Hybrid Architecture**: Local-first + cloud backup
2. **5 Storage Layers**: Memory, IndexedDB, localStorage, OBS WebSocket, Cloud
3. **Instant Responsiveness**: Local writes are synchronous
4. **Cloud Backup**: Async write-through with 1-second debounce
5. **Conflict Resolution**: Last-write-wins (LWW) with timestamps
6. **Security**: JWT-based authentication, HTTPS-only
7. **Performance**: Write batching, parallel reads, debouncing

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-18  
**Maintainer**: Underwood Inc.
