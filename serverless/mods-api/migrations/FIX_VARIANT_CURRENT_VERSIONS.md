# Migration: Fix Variants Missing currentVersionId

**Date Created:** 2026-01-10  
**Purpose:** Fix variants that had their `currentVersionId` overwritten to null/undefined due to a bug in the mod update logic

---

## Problem

A bug in `serverless/mods-api/handlers/mods/update.ts` caused variant `currentVersionId` values to be overwritten when mod metadata was updated. The frontend would send variant metadata without `currentVersionId` (because it didn't have that information), and the backend would replace the entire `mod.variants` array, losing the `currentVersionId` that was set when the variant file was uploaded.

**Symptoms:**
- Variants exist in the mod metadata
- Variant versions exist in KV
- Download button shows "No Version Available"
- `currentVersionId` is null/undefined in mod.variants

## Solution

This migration:
1. Scans all mods in KV across all customers
2. For each variant without a `currentVersionId`:
   - Retrieves the variant's version list
   - Sets `currentVersionId` to the latest version (newest first)
3. Saves the updated mod metadata

---

## Usage

### Dry Run (Recommended First)

```bash
# Test the migration without making changes
curl -X GET "https://mods-api.idling.app/admin/migrate/fix-variant-versions?dryRun=true" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_JWT"
```

### Actual Migration

```bash
# Run the actual migration (makes changes!)
curl -X POST "https://mods-api.idling.app/admin/migrate/fix-variant-versions" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_JWT"
```

### Local Development

```bash
# Dry run
curl -X GET "http://localhost:8792/admin/migrate/fix-variant-versions?dryRun=true" \
  -H "Authorization: Bearer YOUR_LOCAL_JWT"

# Actual migration
curl -X POST "http://localhost:8792/admin/migrate/fix-variant-versions" \
  -H "Authorization: Bearer YOUR_LOCAL_JWT"
```

---

## Response Format

```json
{
  "success": true,
  "dryRun": false,
  "duration": "523ms",
  "result": {
    "totalMods": 42,
    "modsWithVariants": 15,
    "variantsChecked": 28,
    "variantsFixed": 5,
    "variantsAlreadyValid": 20,
    "variantsSkipped": 3,
    "errors": [
      {
        "modId": "mod_123",
        "variantId": "variant_456",
        "error": "No versions found for variant"
      }
    ],
    "fixedVariants": [
      {
        "modId": "mod_789",
        "modTitle": "My Awesome Mod",
        "variantId": "variant_abc",
        "variantName": "Forge",
        "restoredVersionId": "varver_xyz"
      }
    ]
  },
  "message": "Migration complete. Fixed 5 variants."
}
```

---

## Safety

- ✓ **Idempotent**: Safe to run multiple times
- ✓ **Non-destructive**: Only adds missing data, never deletes
- ✓ **Dry run**: Test mode available to preview changes
- ✓ **Super-admin only**: Requires authentication
- ✓ **Error handling**: Continues on error, reports all issues

---

## When to Run

Run this migration if:
- Users report "No Version Available" on variant downloads
- Variants were created/updated between 2026-01-09 and 2026-01-10
- You see variants with null `currentVersionId` in the database

---

## Related Files

- **Handler:** `serverless/mods-api/handlers/admin/fix-variant-current-versions.ts`
- **Routes:** `serverless/mods-api/router/admin-routes.ts` (lines 209-234)
- **Bug Fix:** `serverless/mods-api/handlers/mods/update.ts` (currentVersionId merge logic)

---

## Post-Migration

After running the migration:
1. Check the `fixedVariants` array in the response
2. Verify that variant downloads work on the affected mods
3. Confirm no errors were reported
4. Test a few fixed mods manually in the UI

If any errors are reported, investigate those specific mods/variants separately.
