# Storage Persistence & OBS Sync Guide

## Overview

This document describes how storage persistence works in the Strixun Stream Suite, including automatic OBS client synchronization for UI state (resizable zones, panel states, etc.).

## Storage Architecture

The storage system uses a multi-layer persistence approach:

1. **IndexedDB** (Primary) - Survives most OBS cache clears
2. **localStorage** (Backup) - Synced on every write
3. **OBS Persistent Data** (Cross-client sync) - Shared across all WebSocket clients

## UI State Persistence Pattern

### Automatic OBS Sync

**CRITICAL**: Any storage key starting with `ui_` is automatically synced to OBS client.

When you call `storage.set()` with a key starting with `ui_`:
1. Value is saved to IndexedDB and localStorage
2. OBS sync is automatically scheduled (debounced)
3. UI state is included in the next `broadcastStorage()` call
4. Remote clients receive and apply the UI state

### Resizable Zone Sizes

Resizable zones automatically persist their sizes when using the storage system:

```svelte
<ResizableZone 
  direction="vertical" 
  storageKey="ui_my-panel-height"
  defaultSize={300}
>
  <div slot="content">
    <!-- Content here -->
  </div>
</ResizableZone>
```

**Key Requirements**:
- Use `ui_` prefix for storage keys to enable automatic OBS sync
- The component automatically uses the storage system (not raw localStorage)
- Sizes are automatically synced to OBS client when changed

### Known UI State Keys

The following UI state keys are automatically synced:

- `ui_filter_aside_width` - Filter aside panel width
- `ui_collapsed_cards` - Collapsed card states
- `ui_split_panel` - Split panel state (height, collapsed)

**When adding new UI state keys**:
1. Use the `ui_` prefix
2. Add the key to `knownUIKeys` in `src/modules/storage-sync.ts` (for explicit documentation)
3. The key will automatically be synced via the `ui_` prefix pattern

## Storage API

### Basic Usage

```typescript
import { storage } from './modules/storage';

// Save a value (automatically persists to IndexedDB + localStorage)
storage.set('myKey', { data: 'value' });

// Get a value
const value = storage.get('myKey');

// Remove a value
storage.remove('myKey');
```

### UI State with Auto-Sync

```typescript
import { storage } from './modules/storage';

// Save UI state (automatically triggers OBS sync)
storage.set('ui_my_panel_width', { width: 280 });

// The above automatically:
// 1. Saves to IndexedDB
// 2. Saves to localStorage
// 3. Schedules OBS sync (if OBS dock)
```

## OBS Sync Details

### How It Works

1. **OBS Dock** (source of truth):
   - Writes to OBS persistent data via `broadcastStorage()`
   - Includes configs (swaps, layouts, text cyclers) and UI state
   - Rate-limited to max 1 write per second

2. **Remote Clients**:
   - Read from OBS persistent data on connection (if auto-sync enabled)
   - Apply incoming storage data (overwrites local)
   - UI state is automatically restored

### Manual Sync

```typescript
import { scheduleBroadcast, scheduleUISync } from './modules/storage-sync';

// Schedule a full storage broadcast (configs + UI state)
scheduleBroadcast();

// Schedule UI state sync only (for UI state changes)
scheduleUISync();
```

## Best Practices

### ✅ DO

- Use `ui_` prefix for all UI state keys
- Let `storage.set()` automatically trigger OBS sync for UI state
- Use the storage system (not raw localStorage) for persistence
- Add new UI state keys to `knownUIKeys` in `storage-sync.ts` for documentation

### ❌ DON'T

- Don't use raw `localStorage` directly for UI state
- Don't manually call `broadcastStorage()` for UI state (it's automatic)
- Don't forget the `ui_` prefix for UI state keys
- Don't bypass the storage system for persistence

## Implementation Checklist

When adding new UI state that needs persistence:

- [ ] Use `storage.set()` with `ui_` prefixed key
- [ ] Add key to `knownUIKeys` in `storage-sync.ts`
- [ ] Test that state persists across page reloads
- [ ] Test that state syncs to OBS client (if OBS dock)
- [ ] Test that state is restored on remote clients

## Examples

### Resizable Zone

```svelte
<script>
  import ResizableZone from './components/primitives/ResizableZone/ResizableZone.svelte';
</script>

<ResizableZone 
  direction="vertical" 
  storageKey="ui_activity_log_filter_width"
  defaultSize={280}
  minSize={200}
  maxSize={600}
>
  <div slot="content">
    <!-- Filter content -->
  </div>
</ResizableZone>
```

### Custom UI State

```typescript
import { storage } from './modules/storage';

// Save panel state
storage.set('ui_my_panel_state', {
  width: 300,
  collapsed: false,
  position: 'left'
});

// Automatically synced to OBS!
```

## Troubleshooting

### UI State Not Syncing

1. Check that key starts with `ui_`
2. Verify you're using `storage.set()` (not raw localStorage)
3. Check console for OBS sync errors
4. Ensure you're running as OBS dock (only dock writes to OBS)

### State Not Persisting

1. Check IndexedDB is initialized (`initIndexedDB()` called)
2. Check storage cache is loaded (`loadStorageCache()` called)
3. Verify key doesn't conflict with existing keys
4. Check browser console for storage errors

## Related Files

- `src/modules/storage.ts` - Storage system implementation
- `src/modules/storage-sync.ts` - OBS sync implementation
- `src/components/primitives/ResizableZone/` - Resizable zone component
- `src/modules/bootstrap.ts` - Module initialization

