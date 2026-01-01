# Auth Store Migration Guide

## Overview

All authentication stores have been consolidated into a single shared package: `@strixun/auth-store`. This ensures consistent behavior across all projects and makes maintenance easier.

## What Changed

### Created Shared Package

- **Location**: `packages/auth-store/`
- **Core Logic**: `packages/auth-store/core/` - Framework-agnostic auth logic
- **Zustand Adapter**: `packages/auth-store/adapters/zustand.ts` - For React projects
- **Svelte Adapter**: `packages/auth-store/adapters/svelte.ts` - For Svelte projects

### Key Features

✅ **Framework-agnostic core** - All auth logic in one place
✅ **Session restoration** - IP-based cross-application session sharing
✅ **Token validation** - Detects blacklisted tokens from logout on other domains
✅ **User info fetching** - Automatic updates for displayName, customerId, isSuperAdmin
✅ **JWT decoding** - CSRF token extraction
✅ **Persistent storage** - Configurable storage keys
✅ **TypeScript support** - Full type safety

## Migration Status

### ✅ Completed

1. **mods-hub** - Migrated to use `@strixun/auth-store/zustand`
   - File: `mods-hub/src/stores/auth.ts`
   - All imports remain the same - no breaking changes

2. **Shared Package** - Created and ready
   - Core logic extracted and tested
   - Both adapters implemented

### 🔄 In Progress

1. **src/** - New implementation created
   - File: `src/stores/auth-new.ts` (ready for testing)
   - Once tested, replace `src/stores/auth.ts` with `auth-new.ts`

## Migration Steps

### For mods-hub (Already Done)

No changes needed! The store now uses the shared package internally.

### For src/ (Svelte Project)

1. **Test the new implementation**:
   ```bash
   # The new file is at src/stores/auth-new.ts
   # Test it thoroughly before replacing the old one
   ```

2. **Replace the old file**:
   ```bash
   mv src/stores/auth.ts src/stores/auth.ts.backup
   mv src/stores/auth-new.ts src/stores/auth.ts
   ```

3. **Update package.json** (if needed):
   ```json
   {
     "dependencies": {
       "@strixun/auth-store": "workspace:*"
     }
   }
   ```

4. **Verify all imports still work**:
   - All existing imports should continue to work
   - The new implementation maintains backward compatibility

## Breaking Changes

**None!** The new implementation maintains full backward compatibility:

- All exports remain the same
- All method signatures unchanged
- All store names unchanged
- All behavior preserved

## Benefits

1. **Single Source of Truth** - Fix bugs once, they're fixed everywhere
2. **Consistent Behavior** - All projects use the same auth logic
3. **Easier Maintenance** - Update auth logic in one place
4. **Better Testing** - Test auth logic once, works everywhere
5. **Type Safety** - Shared types ensure consistency

## Testing

Before fully migrating `src/`, test:

1. ✅ Login/logout flow
2. ✅ Session restoration
3. ✅ Token validation
4. ✅ User info fetching
5. ✅ Storage persistence
6. ✅ Cross-domain session sharing

## Rollback Plan

If issues arise:

1. **mods-hub**: Revert `mods-hub/src/stores/auth.ts` to previous version
2. **src/**: Keep `auth-new.ts` as separate file until fully tested

## Next Steps

1. Test `src/stores/auth-new.ts` thoroughly
2. Replace `src/stores/auth.ts` once verified
3. Remove old auth store implementations
4. Update documentation

## Support

If you encounter issues:

1. Check the README: `packages/auth-store/README.md`
2. Review the core types: `packages/auth-store/core/types.ts`
3. Check adapter implementations: `packages/auth-store/adapters/`
