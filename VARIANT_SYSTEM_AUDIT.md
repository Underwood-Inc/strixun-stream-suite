# VARIANT SYSTEM - COMPLETE AUDIT

**Date:** 2026-01-10  
**Status:** BROKEN - Multiple critical defects identified  
**Days Broken:** 2+

---

## EXECUTIVE SUMMARY

The variant system is fundamentally broken due to a **data synchronization issue** between in-memory state and KV storage during variant uploads. `currentVersionId` is never set for new variants, making them undownloadable.

**Root Cause:** `handleUploadVersion` loads the mod fresh from KV, but new variants are only in memory (not yet saved to KV), so it can't find them to update `currentVersionId`.

---

## CRITICAL DEFECTS

### **DEFECT #1: NEW VARIANTS NEVER GET currentVersionId SET** ⚠️ **CRITICAL**

**Location:** `serverless/mods-api/handlers/mods/update.ts` (lines 252-398)

**Flow:**
1. Line 254-283: Initialize `mod.variants` **in memory** with new variant
2. Line 319-377: Call `handleUploadVersion` for variant file
3. **BUG**: `handleUploadVersion` loads mod **from KV** (line 78 of `upload.ts`)
4. KV mod **doesn't have** the new variant (never saved)
5. Line 420-428 of `upload.ts`: Can't find variant → skips setting `currentVersionId`
6. Line 382-398 of `update.ts`: Try to reload and merge → `currentVersionId` is still `null`
7. **Result**: Variant is saved with `currentVersionId: null` → **undownloadable**

**Evidence from logs:**
```
[UpdateMod] Updated currentVersionId from reloaded mod: currentVersionId: null
[UpdateMod] Returning mod with variants: currentVersionId: null
```

**Impact:**
- 100% of new variants are broken on creation
- Downloads fail with "No Version Available" 404
- Users cannot download variants they just uploaded

---

### **DEFECT #2: VARIANT INITIALIZATION HAPPENS TOO EARLY**

**Location:** `serverless/mods-api/handlers/mods/update.ts` (lines 254-283)

**Problem:**
- Variants are initialized in memory but never persisted to KV before file upload
- `handleUploadVersion` expects the variant to exist in KV
- Creates a chicken-and-egg problem: need version to set `currentVersionId`, but need `currentVersionId` to have a valid variant

**Code:**
```typescript
// Line 254-283: Initialize variants in memory
mod.variants = Array.from(existingVariantsMap.values());

// Line 355-361: Call handleUploadVersion (loads mod from KV, can't find variant)
const uploadResponse = await handleUploadVersion(
    variantUploadRequest,
    env,
    modId,
    auth,
    variant.variantId  
);
```

---

### **DEFECT #3: RELOAD LOGIC DOESN'T FIX THE ISSUE**

**Location:** `serverless/mods-api/handlers/mods/update.ts` (lines 380-408)

**Problem:**
- Reloading after `handleUploadVersion` doesn't help if `currentVersionId` was never set
- The reload finds `currentVersionId: null` and merges it → still `null`
- This is a band-aid, not a solution

**Code:**
```typescript
const reloadedMod = await env.MODS_KV.get(modKey, { type: 'json' });
// reloadedMod.variants[x].currentVersionId is null because it was never set
```

---

### **DEFECT #4: TIGHT COUPLING BETWEEN update.ts AND upload.ts**

**Location:** Multiple files

**Problem:**
- `update.ts` depends on `upload.ts` to update `currentVersionId`
- `upload.ts` depends on variant existing in KV
- Creates circular dependency and fragile logic
- Violates single responsibility principle

**Evidence:**
- `update.ts` calls `handleUploadVersion` as a "side effect" to update metadata
- `handleUploadVersion` has special logic for variants vs. main mod versions
- No clear ownership of who updates what

---

### **DEFECT #5: INCONSISTENT DATA FLOW**

**Location:** Entire upload/update flow

**Current Flow (BROKEN):**
```
Frontend
  ↓
API Client (api.ts)
  ↓
update.ts (handler)
  ↓ calls ↓
upload.ts (handler) → tries to update variant in KV
  ↓ returns ↓
update.ts → reload + merge + save
```

**Problem:**
- Multiple handlers modifying the same data
- No single source of truth
- Race conditions possible
- Difficult to debug

---

## SECONDARY ISSUES

### **ISSUE #6: VERSION NUMBER GENERATION IS PRIMITIVE**

**Location:** `serverless/mods-api/handlers/mods/update.ts` (line 337)

**Code:**
```typescript
const newVersionNumber = versionCount > 0 ? `1.0.${versionCount}` : '1.0.0';
```

**Problems:**
- Hardcoded version format
- No semantic versioning support
- No way for users to specify version
- Changelog is always "Uploaded via mod update"

---

### **ISSUE #7: NO VARIANT DELETION IMPLEMENTATION**

**Location:** `serverless/mods-api/handlers/mods/update.ts`

**Problem:**
- Frontend tracks `deletedVariantIds`
- Backend receives them but **doesn't delete anything**
- Orphaned variants in KV
- Orphaned R2 files

---

### **ISSUE #8: DUPLICATE CODE BETWEEN MOD VERSIONS AND VARIANT VERSIONS**

**Location:** `serverless/mods-api/handlers/versions/upload.ts` (lines 412-440)

**Problem:**
- Separate logic for `if (variantId)` vs. main mod
- Almost identical code paths
- Not truly "unified"

---

### **ISSUE #9: NO TRANSACTION SUPPORT**

**Location:** Entire system

**Problem:**
- KV operations are not atomic
- If any step fails mid-process, data is inconsistent
- No rollback mechanism
- Manual cleanup required

---

### **ISSUE #10: COMPLEX VARIANT LOOKUP IN DOWNLOAD**

**Location:** `serverless/mods-api/handlers/variants/download.ts` (lines 46-66)

**Problem:**
- Falls back to searching ALL customer scopes if not found
- O(n) where n = number of customers
- Slow and inefficient
- Should use slug index or direct lookup

---

## DATA MODEL ANALYSIS

### Current Structures:

#### ModMetadata
```typescript
{
  modId: string;
  variants: ModVariant[];  // Inline array
  // ... other fields
}
```

#### ModVariant
```typescript
{
  variantId: string;
  modId: string;  // Redundant - already in parent
  name: string;
  currentVersionId: string | null;  // CRITICAL FIELD
  createdAt: string;
  updatedAt: string;
}
```

#### ModVersion (used for variant versions)
```typescript
{
  versionId: string;
  variantId?: string;  // Optional - set if this is a variant version
  version: string;  // e.g., "1.0.0"
  r2Key: string;
  // ... other fields
}
```

### KV Keys:

#### Mod Storage:
- `customer_{customerId}/mod_{modId}` → `ModMetadata` (includes variants array)
- `mod_{modId}` → `ModMetadata` (global, if public)

#### Version Storage:
- `customer_{customerId}/version_{versionId}` → `ModVersion`
- `version_{versionId}` → `ModVersion` (global, if public)

#### Version Lists:
- `customer_{customerId}/variant_{variantId}_versions` → `string[]` (list of versionIds)
- `customer_{customerId}/mod_{modId}_versions` → `string[]` (list of main mod versionIds)

### Issues with Current Model:

1. **Denormalized Variants**
   - Variants are embedded in `ModMetadata`
   - Must load entire mod to access one variant
   - Updating variant requires rewriting entire mod

2. **Redundant modId**
   - `ModVariant.modId` duplicates parent relationship
   - Stored in every variant

3. **No Direct Variant Storage**
   - Variants don't have their own KV keys
   - Can't query variants directly
   - Can't list variants without loading mods

4. **Version Lists Are Separate**
   - `variant_{variantId}_versions` is a separate key
   - Not co-located with variant metadata
   - Extra KV reads required

---

## ARCHITECTURE PROBLEMS

### 1. **Mixed Responsibilities**
- `update.ts` handles mod metadata AND variant uploads
- `upload.ts` handles file storage AND metadata updates
- No clear separation of concerns

### 2. **Tight Coupling**
- Handlers call other handlers directly
- Shared mutable state (mod object)
- Difficult to test in isolation

### 3. **No Service Layer**
- Business logic in HTTP handlers
- No reusable services
- Duplication across handlers

### 4. **Lack of Abstraction**
- Direct KV and R2 access everywhere
- No repository pattern
- Hard to mock or test

### 5. **Inconsistent Error Handling**
- Some errors return early
- Some errors are logged and ignored
- No standardized error types

---

## PROPOSED NEW ARCHITECTURE

### Design Principles:
1. **Single Responsibility** - Each module does one thing
2. **Separation of Concerns** - Clear boundaries between layers
3. **Testability** - Easy to unit test
4. **Reusability** - Services can be used by multiple handlers
5. **Agnostic** - Works across multiple resource types (mods, plugins, etc.)

### Service Layer Structure:

```
handlers/
  ├── mods/
  │   ├── create.ts          # POST /mods
  │   ├── update.ts          # PATCH /mods/:id (metadata only)
  │   ├── delete.ts          # DELETE /mods/:id
  │   └── list.ts            # GET /mods
  │
  ├── variants/
  │   ├── create.ts          # POST /mods/:id/variants
  │   ├── update.ts          # PATCH /mods/:id/variants/:vid (metadata only)
  │   ├── delete.ts          # DELETE /mods/:id/variants/:vid
  │   ├── list.ts            # GET /mods/:id/variants
  │   └── download.ts        # GET /mods/:id/variants/:vid/download
  │
  └── versions/
      ├── upload.ts          # POST /mods/:id/variants/:vid/versions
      ├── list.ts            # GET /mods/:id/variants/:vid/versions
      ├── download.ts        # GET /mods/:id/variants/:vid/versions/:ver/download
      └── set-current.ts     # POST /mods/:id/variants/:vid/versions/:ver/set-current

services/
  ├── mod-service.ts         # Mod CRUD operations
  ├── variant-service.ts     # Variant CRUD operations
  ├── version-service.ts     # Version CRUD operations
  └── storage-service.ts     # KV + R2 abstraction

repositories/
  ├── mod-repository.ts      # KV operations for mods
  ├── variant-repository.ts  # KV operations for variants
  └── version-repository.ts  # KV operations for versions

utils/
  ├── validation.ts          # Input validation
  ├── errors.ts              # Error types
  └── keys.ts                # KV key generation
```

### Proposed Data Model:

#### Separate Variant Storage:
```typescript
// KV Keys:
// customer_{customerId}/mod_{modId} → ModMetadata (NO variants array)
// customer_{customerId}/variant_{variantId} → VariantMetadata
// customer_{customerId}/mod_{modId}_variants → string[] (list of variantIds)
// customer_{customerId}/variant_{variantId}_versions → string[] (list of versionIds)
// customer_{customerId}/version_{versionId} → VersionMetadata

interface ModMetadata {
  modId: string;
  title: string;
  description: string;
  // ... other fields
  // NO variants array
}

interface VariantMetadata {
  variantId: string;
  parentId: string;  // Generic - could be modId, pluginId, etc.
  parentType: 'mod' | 'plugin';  // Agnostic
  name: string;
  description?: string;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VersionMetadata {
  versionId: string;
  parentId: string;  // variantId or modId
  parentType: 'variant' | 'mod';  // Agnostic
  version: string;
  changelog?: string;
  r2Key: string;
  fileSize: number;
  fileName: string;
  hash: string;
  createdAt: string;
}
```

### Proposed Flow for New Variant Upload:

```
1. Frontend POSTs to /mods/{modId}/variants (metadata only)
   ↓
2. Backend creates VariantMetadata (currentVersionId: null)
   ↓
3. Backend saves to KV: customer_{customerId}/variant_{variantId}
   ↓
4. Backend adds variantId to mod's variant list
   ↓
5. Backend returns 201 with variantId
   ↓
6. Frontend POSTs file to /mods/{modId}/variants/{variantId}/versions
   ↓
7. Backend uploads file to R2
   ↓
8. Backend creates VersionMetadata
   ↓
9. Backend saves version to KV
   ↓
10. Backend updates variant.currentVersionId
   ↓
11. Backend returns 201 with versionId
```

**Benefits:**
- Each step is atomic and independent
- Clear error boundaries
- Easy to retry failed steps
- Each handler has one job
- Testable in isolation

---

## REFACTORING STRATEGY

### Phase 1: Service Layer (Keep existing handlers working)
1. Create `variant-service.ts` with CRUD operations
2. Create `version-service.ts` with upload/download operations
3. Create repositories for KV abstraction
4. Add comprehensive unit tests

### Phase 2: Update Handlers (Gradually migrate)
1. Update `variants/create.ts` to use services
2. Update `versions/upload.ts` to use services
3. Update `variants/download.ts` to use services
4. Ensure backward compatibility

### Phase 3: Data Migration
1. Create migration script to normalize existing variants
2. Add `variant_{variantId}` keys for all existing variants
3. Update variant lists for all mods
4. Verify data integrity

### Phase 4: Clean Up
1. Remove old denormalized variant code
2. Remove duplicate logic
3. Update frontend to use new endpoints
4. Delete dead code

---

## IMMEDIATE FIX (Temporary)

**To unblock users NOW without full refactor:**

1. In `update.ts`, **SAVE** `mod.variants` to KV **BEFORE** calling `handleUploadVersion`:

```typescript
// Line 283 - after initializing variants in memory
mod.variants = Array.from(existingVariantsMap.values());

// ADD THIS:
await env.MODS_KV.put(modKey, JSON.stringify(mod));
console.log('[UpdateMod] Saved new variant to KV before file upload');

// THEN proceed with file uploads (line 287+)
```

2. Remove the reload logic (lines 380-408) - no longer needed

**Why this works:**
- New variant is persisted to KV before `handleUploadVersion` loads it
- `handleUploadVersion` finds the variant and sets `currentVersionId`
- No need to reload and merge

**Limitations:**
- Still tightly coupled
- Still inefficient (multiple KV writes)
- Still violates SRP
- Just a **BAND-AID** until proper refactor

---

## TESTING REQUIREMENTS

### Unit Tests Needed:
- [ ] `variant-service.ts` - All CRUD operations
- [ ] `version-service.ts` - Upload, download, list
- [ ] `variant-repository.ts` - KV operations
- [ ] `version-repository.ts` - KV operations

### Integration Tests Needed:
- [ ] Create variant + upload version (happy path)
- [ ] Create variant + upload version + download (E2E)
- [ ] Update variant metadata
- [ ] Delete variant + cascade delete versions
- [ ] List all versions for a variant

### E2E Tests Needed:
- [ ] Upload new mod with variant via UI
- [ ] Download variant via UI
- [ ] Upload new version for existing variant
- [ ] Delete variant via UI

---

## CONCLUSION

The variant system is fundamentally broken due to **poor separation of concerns** and **data synchronization issues**. A **temporary fix** can unblock users, but a **full refactor** with proper service layer is required for long-term maintainability.

**Estimated Effort:**
- **Immediate Fix:** 1 hour
- **Full Refactor:** 8-16 hours
- **Testing:** 4-8 hours
- **Total:** 2-3 days for production-ready solution

---

**End of Audit**
