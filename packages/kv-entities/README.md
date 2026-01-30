# @strixun/kv-entities

Unified KV entity storage pattern for all Cloudflare Workers services.

## Why This Exists

The old architecture used string-concatenated "scopes" for multi-tenancy:

```
customer_cust_123_mod_abc    ← Customer scope
mod_abc                       ← Global scope (DUPLICATE!)
```

This led to:
- Same data stored in multiple places
- String parsing to extract customer IDs
- Expensive O(n) searches through all customer keys
- Inconsistent separators (`_` vs `/` vs `:`)
- Constant normalization functions everywhere

## New Architecture

### Key Patterns

**Entities** (single source of truth):
```
{service}:{entity}:{id}

mods:mod:abc123
mods:version:xyz789
mods:variant:var456
customer:profile:cust_123
access:permission:perm_456
```

**Indexes** (for queries):
```
idx:{service}:{relationship}:{parentId}

idx:mods:by-customer:cust_123      → ["mod_abc", "mod_xyz"]
idx:mods:by-visibility:public      → ["mod_abc", "mod_def"]
idx:mods:versions-for:mod_abc      → ["ver_1", "ver_2"]
idx:mods:by-slug:my-cool-mod       → "mod_abc"
```

### Key Principles

1. **Single Source of Truth**: Each entity stored exactly once
2. **Ownership in Data**: `customerId` is a field on the entity, not in the key
3. **Visibility in Data**: `visibility` field controls access, not key structure
4. **Indexes for Queries**: Separate index keys for lookups by relationship
5. **No String Manipulation**: Simple `service:entity:id` pattern

## Usage

### Entity Operations

```typescript
import { getEntity, putEntity, deleteEntity } from '@strixun/kv-entities';

// Get
const mod = await getEntity<ModMetadata>(kv, 'mods', 'mod', modId);

// Put
await putEntity(kv, 'mods', 'mod', modId, modData);

// Delete
await deleteEntity(kv, 'mods', 'mod', modId);

// Batch get
const mods = await getExistingEntities<ModMetadata>(kv, 'mods', 'mod', modIds);
```

### Index Operations

```typescript
import { indexGet, indexAdd, indexRemove, indexGetSingle } from '@strixun/kv-entities';

// Get all mods for a customer
const modIds = await indexGet(kv, 'mods', 'by-customer', customerId);

// Add mod to customer's index
await indexAdd(kv, 'mods', 'by-customer', customerId, modId);

// Remove from index
await indexRemove(kv, 'mods', 'by-customer', customerId, modId);

// 1:1 lookup (slug → modId)
const modId = await indexGetSingle(kv, 'mods', 'by-slug', 'my-cool-mod');
```

### Access Control

```typescript
import { canAccessVisible, canModify, assertAccess } from '@strixun/kv-entities';

const context = { customerId: auth.customerId, isAdmin: false };

// Check read access
if (!canAccessVisible(mod, context)) {
  return new Response('Not Found', { status: 404 });
}

// Check write access
if (!canModify(mod, context)) {
  return new Response('Forbidden', { status: 403 });
}

// Or throw on denied
assertAccess(mod, context, 'modify');
```

### Convenience Key Builders

```typescript
import { Keys, Indexes } from '@strixun/kv-entities';

// Entity keys
const modKey = Keys.mod('abc123');           // { key: 'mods:mod:abc123', ... }
const versionKey = Keys.version('xyz789');   // { key: 'mods:version:xyz789', ... }

// Index keys
const customerModsIdx = Indexes.modsByCustomer('cust_123');
const publicModsIdx = Indexes.publicMods();
const slugIdx = Indexes.modBySlug('my-cool-mod');
```

## Migration

### From Old Keys to New

```typescript
import { migrateService } from '@strixun/kv-entities';

const result = await migrateService(
  kv,
  'mods',
  ['customer_', 'mod_', 'version_', 'slug_'],
  (oldKey, oldData) => {
    // Transform logic here
    return {
      entityType: 'mod',
      id: oldData.modId,
      data: oldData,
      indexes: [
        { relationship: 'by-customer', parentId: oldData.customerId, id: oldData.modId },
        ...(oldData.visibility === 'public' 
          ? [{ relationship: 'by-visibility', parentId: 'public', id: oldData.modId }]
          : []),
      ],
    };
  },
  { dryRun: false, deleteOld: false }
);

console.log(`Migrated ${result.processedCount} entities, ${result.errorCount} errors`);
```

## Services

| Service | Entities | Indexes |
|---------|----------|---------|
| `mods` | mod, version, variant | by-customer, by-visibility, versions-for, variants-for, by-slug |
| `customer` | profile, settings | by-email |
| `access` | permission, definition | by-customer |
| `auth` | session, otp | - |
| `streamkit` | config | - |

## Migration Order

1. Create and publish `@strixun/kv-entities` package
2. Migrate `customer-api` (foundational)
3. Migrate `access-service` (permissions)
4. Migrate `mods-api` (largest)
5. Migrate remaining services
6. Delete old utility files (`customer.ts`, `kv-keys.ts`)
