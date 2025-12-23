# Architectural Audit - Strixun Stream Suite

**Date:** 2024-12-19  
**Status:** 🔴 Critical Issues Found

## Executive Summary

The codebase has a modern architecture (Service Registry, Event Bus, Module Communicator) but many components still use legacy patterns. This creates inconsistency, potential bugs, and maintenance issues.

---

## 🔴 CRITICAL ISSUES

### 1. Storage Service Not Using Encrypted Storage

**Location:** `src/core/services/implementations.ts:18-50`

**Issue:** `StorageServiceImpl` uses raw `storage` instead of `encryptedStorage`, bypassing encryption entirely.

```typescript
// ❌ WRONG - Bypasses encryption
class StorageServiceImpl implements StorageService {
  get<T = any>(key: string): T | null {
    return storage.get<T>(key);  // Direct storage access
  }
}
```

**Impact:** All data accessed through ServiceRegistry is unencrypted, even when encryption is enabled.

**Fix Required:**
```typescript
// ✅ CORRECT - Uses encrypted storage
import { encryptedStorage } from '../encrypted-storage';

class StorageServiceImpl implements StorageService {
  async get<T = any>(key: string): Promise<T | null> {
    return await encryptedStorage.get<T>(key);
  }
  // ... make all methods async
}
```

---

### 2. Direct DOM Manipulation in Bootstrap

**Location:** `src/modules/bootstrap.ts:337`

**Issue:** Direct DOM manipulation instead of Svelte bindings.

```typescript
// ❌ WRONG - Direct DOM manipulation
const dockUrlEl = document.getElementById('dockUrl') as HTMLInputElement | null;
if (dockUrlEl) dockUrlEl.value = url;
```

**Impact:** Breaks Svelte reactivity, causes state inconsistencies.

**Fix:** Use Svelte stores or props to pass data to components.

---

### 3. Window Globals Instead of Service Registry

**Location:** Multiple files (bootstrap.ts, Dashboard.svelte, etc.)

**Issue:** Heavy reliance on `window.SourceSwaps`, `window.TextCycler`, etc. instead of Service Registry.

```typescript
// ❌ WRONG - Window globals
if ((window as any).SourceSwaps?.getConfigs) {
  swapConfigs = (window as any).SourceSwaps.getConfigs();
}
```

**Impact:** 
- No type safety
- No dependency injection
- Hard to test
- Breaks module isolation

**Fix:** Use ModuleRegistry or EventBus:
```typescript
// ✅ CORRECT - Service Registry
import { getService } from '@/core/init';
import { SERVICE_KEYS } from '@/core/services/interfaces';

const moduleRegistry = getService<ModuleService>(SERVICE_KEYS.MODULE_REGISTRY);
const sourceSwaps = moduleRegistry.get('source-swaps');
```

---

### 4. Window Events Instead of EventBus

**Location:** `src/pages/Dashboard.svelte:52`

**Issue:** Using `window.addEventListener` for custom events instead of EventBus.

```typescript
// ❌ WRONG - Window events
window.addEventListener('swapConfigsChanged', handleSwapConfigsChange);
```

**Impact:**
- No type safety
- No namespacing
- Hard to track event flow
- Can cause memory leaks

**Fix:** Use EventBus:
```typescript
// ✅ CORRECT - EventBus
import { EventBus } from '@/core/events/EventBus';

const unsubscribe = EventBus.on('source-swaps:configs-changed', () => {
  refreshSwapConfigs();
});

onDestroy(() => unsubscribe());
```

---

### 5. Reactive Statement Infinite Loop Risk

**Location:** `src/pages/Dashboard.svelte:28-30, 60-61`

**Issue:** Reactive statements that could cause infinite loops.

```typescript
// ⚠️ RISKY - Could trigger repeatedly
$: if ($connected !== undefined) {
  refreshSwapConfigs();
}

$: if ($connected) {
  updateDashboardStatus();
}
```

**Impact:** Performance issues, infinite loops if functions trigger reactive updates.

**Fix:** Use guards and change detection:
```typescript
// ✅ CORRECT - Change detection
let previousConnected: boolean | undefined = undefined;
$: {
  if ($connected !== previousConnected) {
    previousConnected = $connected;
    if ($connected !== undefined) {
      refreshSwapConfigs();
    }
  }
}
```

---

## 🟡 MODERATE ISSUES

### 6. Mixed Storage Patterns

**Location:** Multiple files use `storage` directly instead of `encryptedStorage`

**Files Affected:**
- `src/stores/auth.ts`
- `src/modules/app.ts`
- `src/modules/storage-sync.ts`
- Many others

**Issue:** Some code uses `storage`, some uses `encryptedStorage`, creating inconsistency.

**Recommendation:** 
1. Make `encryptedStorage` the default export
2. Deprecate direct `storage` imports
3. Migrate all code to use `encryptedStorage`

---

### 7. Module Initialization Pattern

**Location:** `src/modules/bootstrap.ts:170-302`

**Issue:** Modules are initialized and then exposed to `window` for "legacy compatibility", but new code also uses window globals.

**Impact:** No clear migration path, both patterns used simultaneously.

**Recommendation:**
1. Register modules in ModuleRegistry
2. Remove window globals gradually
3. Update all code to use Service Registry

---

### 8. Direct Storage Access in Stores

**Location:** `src/stores/auth.ts:38-39`

**Issue:** Stores use `storage` directly instead of encrypted storage.

```typescript
// ⚠️ Should use encryptedStorage
storage.set('auth_user', userData);
storage.set('auth_token', userData.token);
```

**Impact:** Auth data might not be encrypted if encryption is enabled.

**Fix:** Use `encryptedStorage` for sensitive data.

---

## 🟢 MINOR ISSUES

### 9. Console Logging in Production

**Location:** Multiple files

**Issue:** `console.log` statements throughout codebase.

**Recommendation:** Use LoggerService consistently, filter by environment.

---

### 10. Type Safety Issues

**Location:** Multiple files using `(window as any)`

**Issue:** Excessive use of `any` type, losing type safety.

**Recommendation:** Create proper type definitions for window globals or eliminate them.

---

## Migration Priority

### Phase 1: Critical (Do First)
1. ✅ Fix Storage Service to use encryptedStorage
2. ✅ Fix reactive statement infinite loops
3. ✅ Replace window events with EventBus

### Phase 2: High Priority
4. Replace window globals with Service Registry
5. Fix direct DOM manipulation
6. Migrate stores to use encryptedStorage

### Phase 3: Medium Priority
7. Standardize storage access pattern
8. Improve type safety
9. Add proper logging service usage

---

## Recommendations

1. **Create Migration Scripts:** Automate migration from window globals to Service Registry
2. **Add Linting Rules:** Prevent new code from using window globals or direct DOM manipulation
3. **Documentation:** Update architecture docs with migration examples
4. **Testing:** Add tests to catch infinite loops and architectural violations

---

## Files Requiring Immediate Attention

1. `src/core/services/implementations.ts` - Storage service encryption
2. `src/modules/bootstrap.ts` - DOM manipulation, window globals
3. `src/pages/Dashboard.svelte` - Window events, reactive statements
4. `src/stores/auth.ts` - Direct storage access
5. All files using `window.SourceSwaps`, `window.TextCycler`, etc.

---

## Success Metrics

- [ ] Zero direct `storage` imports (use `encryptedStorage`)
- [ ] Zero `window.addEventListener` for custom events (use EventBus)
- [ ] Zero `document.getElementById` in Svelte components
- [ ] Zero window globals for module access (use Service Registry)
- [ ] All reactive statements have change detection guards

