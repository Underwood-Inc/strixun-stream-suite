# Variant API Refactoring - Architectural Improvement

## Problem

The original implementation had a **critical architectural flaw** where updating variants for a single mod version required sending the **entire variants array** for all versions. This caused:

1. **Data loss**: When updating variants for Version 1.0, all variants for Version 2.0, 3.0, etc. were deleted
2. **Inefficiency**: Frontend had to load all variants, modify the array, and send everything back
3. **Race conditions**: Multiple simultaneous variant updates could overwrite each other
4. **Unnecessary complexity**: Frontend required merge logic to preserve other version's variants

### Root Cause

The API only exposed a single endpoint for variant management:

```
PATCH /mods/:modId
Body: { variants: ModVariant[] }  // Replaces ENTIRE variants array
```

This is bad REST API design - there were no proper CRUD endpoints for individual variants.

## Solution

Implemented **proper REST endpoints** for variant management:

### New Backend Endpoints

```typescript
// Create a single variant
POST /mods/:modId/variants
Body: { name: string, description?: string, parentVersionId: string }
Response: { variant: ModVariant }

// Update a single variant
PUT /mods/:modId/variants/:variantId
Body: { name?: string, description?: string }
Response: { variant: ModVariant }

// Delete a single variant (already existed)
DELETE /mods/:modId/variants/:variantId
Response: 204 No Content
```

### New Frontend API Functions

```typescript
// mods-hub/src/services/mods/modVariantsApi.ts
export async function createVariant(
    modSlug: string,
    request: CreateVariantRequest
): Promise<{ variant: ModVariant }>

export async function updateVariant(
    modSlug: string,
    variantId: string,
    updates: UpdateVariantRequest
): Promise<{ variant: ModVariant }>
```

### Component Updates

**VersionVariantManager.tsx**:
- Removed local variant state management
- Removed bulk save logic
- Now calls `createVariant()` API directly when adding a variant
- Simplified to just show existing variants and a create form
- No more "Save All" button that replaces entire array

**ModVersionManagement.tsx**:
- Removed complex merge logic
- Simplified to just refetch data after variant operations
- No longer sends entire variants array to server

## Benefits

1. **✓ Data Integrity**: Each variant operation is atomic - no accidental deletion of other variants
2. **✓ Proper REST Design**: Each resource has its own CRUD endpoints
3. **✓ Simpler Frontend**: No merge logic required - just call the API
4. **✓ Better Performance**: Only send changed data, not entire arrays
5. **✓ Concurrent Safety**: Multiple users can update different variants without conflicts
6. **✓ Clearer Intent**: Each API call has a single, clear purpose

## Files Modified

### Backend
- `serverless/mods-api/handlers/variants/create.ts` - New handler for creating variants
- `serverless/mods-api/handlers/variants/update.ts` - New handler for updating variants
- `serverless/mods-api/router/mod-routes.ts` - Added POST and PUT routes for variants

### Frontend
- `mods-hub/src/services/mods/modVariantsApi.ts` - Added `createVariant()` and `updateVariant()` functions
- `mods-hub/src/components/mod/VersionVariantManager.tsx` - Refactored to use new API endpoints
- `mods-hub/src/components/mod/ModVersionManagement.tsx` - Simplified variant management callbacks

## Testing

To verify the fix:

1. Create a mod with multiple versions
2. Add a variant to Version 1.0 (e.g., "Forge")
3. Add a variant to Version 2.0 (e.g., "Fabric")
4. Add another variant to Version 1.0 (e.g., "Quilt")
5. Verify all variants still exist for both versions

**Expected**: All variants remain intact  
**Before**: Only the last variant created would exist, all others would be deleted

## Migration Notes

- The old `PATCH /mods/:modId` endpoint still exists and still accepts the `variants` array for backward compatibility
- However, frontend now uses the new dedicated variant endpoints
- No database migration required - this is purely an API architecture improvement

## Future Improvements

Consider removing the `variants` field from the `PATCH /mods/:modId` endpoint entirely to enforce proper REST design, or deprecate it with a warning.
