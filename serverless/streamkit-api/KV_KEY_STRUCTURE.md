# Streamkit API - KV Key Structure

**Comprehensive documentation of the Cloudflare KV key patterns used by Streamkit API.**

---

## 🔑 Key Pattern Overview

All keys follow a hierarchical, customer-isolated pattern:

```
cust_{customerId}_streamkit_{category}_{identifier}
```

### Key Components

| Component | Description | Example |
|-----------|-------------|---------|
| `cust_` | Fixed prefix for all customer data | `cust_` |
| `{customerId}` | Unique customer identifier from JWT | `12345` |
| `_streamkit_` | Service namespace | `_streamkit_` |
| `{category}` | Config type or feature | `text-cyclers`, `scene_activity` |
| `{identifier}` | Unique ID within category | `config1`, `Gaming Scene` |

---

## 📂 Key Categories

### 1. Text Cycler Configs

**Pattern:** `cust_{customerId}_streamkit_text-cyclers_{configId}`

**Example:**
```
cust_12345_streamkit_text-cyclers_config1
cust_12345_streamkit_text-cyclers_my-custom-cycler
```

**Value Structure:**
```json
{
  "id": "config1",
  "name": "My Text Cycler",
  "textLines": ["Line 1", "Line 2", "Line 3"],
  "cycleDuration": 5000,
  "transition": "fade",
  "transDuration": 300,
  "styles": {
    "fontSize": "24px",
    "color": "#ffffff"
  },
  "mode": "browser",
  "createdAt": "2026-01-18T12:00:00.000Z",
  "updatedAt": "2026-01-18T12:00:00.000Z"
}
```

**TTL:** None (persistent until deleted)

---

### 2. Swap Configs

**Pattern:** `cust_{customerId}_streamkit_swaps_{configId}`

**Example:**
```
cust_12345_streamkit_swaps_swap1
cust_12345_streamkit_swaps_camera-gameplay-swap
```

**Value Structure:**
```json
{
  "id": "swap1",
  "name": "Camera/Gameplay Swap",
  "sourceA": "Camera",
  "sourceB": "Gameplay",
  "style": "slide",
  "duration": 400,
  "easing": "ease",
  "preserveAspect": true,
  "createdAt": "2026-01-18T12:00:00.000Z",
  "updatedAt": "2026-01-18T12:00:00.000Z"
}
```

**TTL:** None (persistent until deleted)

---

### 3. Layout Presets

**Pattern:** `cust_{customerId}_streamkit_layouts_{layoutId}`

**Example:**
```
cust_12345_streamkit_layouts_layout1
cust_12345_streamkit_layouts_gaming-4cam
```

**Value Structure:**
```json
{
  "id": "layout1",
  "name": "Gaming 4-Cam",
  "scene": "Gaming Scene",
  "sources": [
    {
      "sourceName": "Camera 1",
      "positionX": 100,
      "positionY": 100,
      "scaleX": 0.5,
      "scaleY": 0.5
    },
    {
      "sourceName": "Camera 2",
      "positionX": 200,
      "positionY": 100,
      "scaleX": 0.5,
      "scaleY": 0.5
    }
  ],
  "timestamp": "2026-01-18T12:00:00.000Z",
  "createdAt": "2026-01-18T12:00:00.000Z",
  "updatedAt": "2026-01-18T12:00:00.000Z"
}
```

**TTL:** None (persistent until deleted)

---

### 4. Notes

**Pattern:** `cust_{customerId}_streamkit_notes_{noteId}`

**Example:**
```
cust_12345_streamkit_notes_note1
cust_12345_streamkit_notes_stream-ideas
```

**Value Structure:**
```json
{
  "id": "note1",
  "title": "Stream Ideas",
  "content": "1. Play new game\n2. Chat with viewers\n3. Giveaway",
  "createdAt": "2026-01-18T12:00:00.000Z",
  "updatedAt": "2026-01-18T12:05:00.000Z"
}
```

**TTL:** None (persistent until deleted)

---

### 5. Scene Activity Tracking

**Pattern:** `cust_{customerId}_streamkit_scene_activity_{sceneName}`

**Example:**
```
cust_12345_streamkit_scene_activity_Gaming Scene
cust_12345_streamkit_scene_activity_BRB Scene
cust_12345_streamkit_scene_activity_Just Chatting
```

**Value Structure:**
```json
{
  "sceneName": "Gaming Scene",
  "count": 42,
  "lastUsed": "2026-01-18T12:00:00.000Z"
}
```

**TTL:** 30 days (rolling FIFO window)

**Special Notes:**
- Automatically expires after 30 days of inactivity
- Count is atomically incremented on each scene switch
- `lastUsed` is updated on each scene switch

---

## 🔍 Key Parsing

### Building Keys

Use the `buildKVKey` utility function:

```typescript
import { buildKVKey } from './utils/kv-keys';

// Text cycler key
const key = buildKVKey('12345', 'text-cyclers', 'config1');
// Result: 'cust_12345_streamkit_text-cyclers_config1'

// Scene activity key
const key = buildKVKey('12345', 'scene_activity', 'Gaming Scene');
// Result: 'cust_12345_streamkit_scene_activity_Gaming Scene'
```

### Parsing Keys

Use the `parseKVKey` utility function:

```typescript
import { parseKVKey } from './utils/kv-keys';

const parsed = parseKVKey('cust_12345_streamkit_text-cyclers_config1');
// Result: {
//   customerId: '12345',
//   configType: 'text-cyclers',
//   configId: 'config1'
// }

const parsed = parseKVKey('invalid_key');
// Result: null
```

---

## 🔒 Customer Isolation

### How It Works

1. **JWT Extraction**: Customer ID is extracted from JWT token
2. **Key Prefixing**: All operations are prefixed with `cust_{customerId}_`
3. **Namespace Isolation**: No cross-customer access possible
4. **Atomic Operations**: All KV operations are customer-scoped

### Security Guarantees

✅ **No Cross-Customer Access**: Keys are customer-specific  
✅ **No Key Enumeration**: Cannot list other customers' keys  
✅ **Atomic Operations**: Race-condition safe  
✅ **JWT Expiration**: Enforced at every request  

### Example

**Customer A (ID: `12345`):**
```
cust_12345_streamkit_text-cyclers_config1
cust_12345_streamkit_swaps_swap1
cust_12345_streamkit_scene_activity_Gaming Scene
```

**Customer B (ID: `67890`):**
```
cust_67890_streamkit_text-cyclers_config1  ← Same ID, different customer
cust_67890_streamkit_swaps_swap1
cust_67890_streamkit_scene_activity_Gaming Scene
```

**Isolation Result:**
- Customer A can only access `cust_12345_*` keys
- Customer B can only access `cust_67890_*` keys
- No overlap, no collision, no cross-contamination

---

## 📊 Key Naming Best Practices

### DO ✅

- Use lowercase for config types (`text-cyclers`, not `TextCyclers`)
- Use hyphens for multi-word types (`text-cyclers`, not `text_cyclers`)
- Use underscores for internal separators (`scene_activity`)
- Keep IDs short and descriptive (`config1`, `swap-camera-gameplay`)
- Use URL-safe characters in IDs

### DON'T ❌

- Use spaces in keys (use hyphens or underscores)
- Use special characters (`/`, `?`, `&`, `=`, etc.)
- Use very long IDs (> 100 characters)
- Use customer-identifying information in IDs
- Use incremental IDs without customer prefix (e.g., `1`, `2`, `3`)

### Examples

**Good Keys:**
```
cust_12345_streamkit_text-cyclers_main-cycler
cust_12345_streamkit_swaps_cam-to-gameplay
cust_12345_streamkit_layouts_4cam-gaming
cust_12345_streamkit_notes_stream-schedule
```

**Bad Keys:**
```
cust_12345_streamkit_text cyclers_config 1          ← spaces
cust_12345_streamkit_swaps/config?id=1              ← special chars
cust_12345_streamkit_layouts_this-is-a-very-long-layout-name-that-should-be-shortened  ← too long
cust_12345_streamkit_notes_johns-note               ← customer-identifying
```

---

## 🗑️ Key Lifecycle

### Create

1. Client sends POST request with config data
2. JWT is validated, `customerId` extracted
3. Key is built: `cust_{customerId}_streamkit_{type}_{id}`
4. Value is stored in KV with metadata (`createdAt`, `updatedAt`)
5. Success response returned

### Read

1. Client sends GET request
2. JWT is validated, `customerId` extracted
3. Key is built: `cust_{customerId}_streamkit_{type}_{id}`
4. Value is retrieved from KV
5. Value is returned in response

### Update

1. Client sends PUT request with updated config data
2. JWT is validated, `customerId` extracted
3. Key is built: `cust_{customerId}_streamkit_{type}_{id}`
4. Existing value is retrieved (404 if not found)
5. New value is stored with updated `updatedAt` timestamp
6. Success response returned

### Delete

1. Client sends DELETE request
2. JWT is validated, `customerId` extracted
3. Key is built: `cust_{customerId}_streamkit_{type}_{id}`
4. Key is deleted from KV
5. Success response returned (even if key didn't exist)

### List

1. Client sends GET request for all configs of a type
2. JWT is validated, `customerId` extracted
3. All keys matching `cust_{customerId}_streamkit_{type}_*` are listed
4. Values are retrieved in parallel
5. Array of configs is returned

---

## 🔄 Key Migration

### Future-Proofing

If the key structure needs to change in the future:

1. **Versioned Keys**: Add a version component
   ```
   cust_{customerId}_streamkit_v2_{type}_{id}
   ```

2. **Backward Compatibility**: Support both old and new patterns
   ```typescript
   // Try v2 first, fallback to v1
   const keyV2 = `cust_${customerId}_streamkit_v2_${type}_${id}`;
   const keyV1 = `cust_${customerId}_streamkit_${type}_${id}`;
   const value = await KV.get(keyV2) || await KV.get(keyV1);
   ```

3. **Migration Script**: Batch copy v1 → v2
   ```typescript
   // List all v1 keys for customer
   const v1Keys = await listKeys(`cust_${customerId}_streamkit_${type}_`);
   
   // Copy to v2 keys
   for (const key of v1Keys) {
     const value = await KV.get(key);
     const newKey = key.replace('_streamkit_', '_streamkit_v2_');
     await KV.put(newKey, value);
   }
   
   // Delete v1 keys (after verification)
   for (const key of v1Keys) {
     await KV.delete(key);
   }
   ```

---

## 📈 Key Metrics

### Storage Estimates

**Per Config:**
- Text Cycler: ~500 bytes - 2KB (depending on text lines)
- Swap: ~300 bytes
- Layout: ~1KB - 5KB (depending on source count)
- Note: ~500 bytes - 10KB (depending on content length)
- Scene Activity: ~150 bytes

**Per Customer (100 configs):**
- Text Cyclers: ~50KB - 200KB
- Swaps: ~30KB
- Layouts: ~100KB - 500KB
- Notes: ~50KB - 1MB
- Scene Activity: ~15KB (30-day window, 100 unique scenes)

**Total Estimate (1000 active customers):**
- ~245MB - 1.7GB total storage
- Well within Cloudflare KV limits (unlimited storage)

---

## 🛠️ Debugging Keys

### List All Keys for Customer

```bash
# Using wrangler CLI
wrangler kv:key list --binding STREAMKIT_KV --prefix "cust_12345_"
```

### Get Specific Key

```bash
# Using wrangler CLI
wrangler kv:key get "cust_12345_streamkit_text-cyclers_config1" --binding STREAMKIT_KV
```

### Delete Specific Key

```bash
# Using wrangler CLI
wrangler kv:key delete "cust_12345_streamkit_text-cyclers_config1" --binding STREAMKIT_KV
```

### Bulk Operations

```bash
# Export all keys for backup
wrangler kv:key list --binding STREAMKIT_KV > keys-backup.json

# Import keys from backup
# (No direct import command, use API or custom script)
```

---

## 📝 Summary

### Key Takeaways

1. **Customer Isolation**: All keys are prefixed with `cust_{customerId}_`
2. **Namespace Isolation**: All keys include `_streamkit_` for service-level separation
3. **Type-Safe**: Each config type has its own namespace
4. **ID-Scoped**: Each config has a unique ID within its type
5. **Atomic**: One key per config item (no monolithic JSON blobs)
6. **TTL Strategy**: Persistent configs (no TTL) vs. scene activity (30-day TTL)
7. **Future-Proof**: Versioned keys can be added for migrations

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-18  
**Maintainer**: Underwood Inc.
