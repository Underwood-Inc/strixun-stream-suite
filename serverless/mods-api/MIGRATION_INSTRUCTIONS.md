# Variant Migration Instructions

**CRITICAL: Read this ENTIRE document before running migration**

## Overview

This migration converts the old variant system (flat structure, no version control) to the new variant version system (hierarchical, full version history).

## What This Migration Does

1. Scans all mods in KV for variants
2. For each variant with a file:
   - Creates a `VariantVersion` record from the old variant data
   - Copies the R2 file to the new hierarchical path
   - Updates the variant to the new structure (removes file fields, adds version tracking)
   - Creates version lists for each variant
3. Preserves all existing data (no data loss)
4. Maintains backward compatibility during transition

## Prerequisites

- [ ] Backup your KV and R2 data (use Cloudflare dashboard exports)
- [ ] Verify you have super-admin access
- [ ] Ensure the mods-api worker is deployed with migration endpoints
- [ ] Test on development environment first

## Migration Options

### Option 1: Via Admin API (RECOMMENDED)

**Dry Run (Test without changes):**
```bash
curl -X POST https://mods-api.idling.app/admin/migrate/dry-run \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_JWT"
```

**Actual Migration:**
```bash
curl -X POST https://mods-api.idling.app/admin/migrate/run \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_JWT"
```

### Option 2: Via Wrangler Dev (Local)

**Dry Run:**
```bash
cd serverless/mods-api
wrangler dev --local --test-scheduled --var MIGRATION_DRY_RUN:true
```

**Actual Migration:**
```bash
cd serverless/mods-api
wrangler dev --local --test-scheduled
# Then trigger via scheduled event or HTTP
```

### Option 3: Via Wrangler Remote (Production)

⚠ **USE WITH EXTREME CAUTION - THIS RUNS ON PRODUCTION DATA**

```bash
cd serverless/mods-api
wrangler dev --remote --test-scheduled
```

## Step-by-Step Process

### Step 1: Dry Run Analysis

```bash
# Get your super-admin JWT token first
export ADMIN_JWT="your_jwt_token_here"

# Run dry run
curl -X POST https://mods-api.idling.app/admin/migrate/dry-run \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" | jq
```

Expected output:
```json
{
  "modsToMigrate": 10,
  "variantsToMigrate": 25,
  "variantsAlreadyMigrated": 0
}
```

### Step 2: Review Results

- Check if the numbers make sense
- Verify you have backups
- Ensure you have time for the full migration (estimated: ~1 second per variant)

### Step 3: Run Migration

```bash
# Run actual migration
curl -X POST https://mods-api.idling.app/admin/migrate/run \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" | jq
```

Expected output:
```json
{
  "totalMods": 123,
  "modsWithVariants": 10,
  "variantsMigrated": 25,
  "variantsSkipped": 0,
  "errors": []
}
```

### Step 4: Verify Migration

After migration, verify:

1. **Check variant structure:**
```bash
# Get a mod with variants
curl https://mods-api.idling.app/mods/YOUR_MOD_SLUG | jq '.mod.variants'
```

Expected: Variants should have `currentVersionId`, `versionCount`, `totalDownloads` fields

2. **Check variant versions:**
```bash
# Get variant versions list
curl https://mods-api.idling.app/mods/YOUR_MOD_SLUG/variants/VARIANT_ID/versions | jq
```

Expected: Should return array of variant versions

3. **Test download:**
```bash
# Download a variant version
curl https://mods-api.idling.app/mods/YOUR_MOD_SLUG/variants/VARIANT_ID/versions/VERSION_ID/download -o test.zip
```

Expected: File downloads successfully and is valid

## Rollback Plan

If migration fails or causes issues:

1. **Restore from KV backup** (via Cloudflare dashboard)
2. **R2 files are NOT deleted** - old files remain at original paths
3. **Redeploy previous worker version** if needed

## Migration Safety Features

- ✓ **No data deletion** - Old R2 files are copied, not moved
- ✓ **Idempotent** - Running twice won't duplicate data
- ✓ **Skip already migrated** - Detects and skips migrated variants
- ✓ **Error handling** - Continues on errors, reports them at end
- ✓ **Detailed logging** - Tracks every step

## Expected Duration

- Small instances (< 50 variants): 1-2 minutes
- Medium instances (50-200 variants): 3-5 minutes
- Large instances (> 200 variants): 10+ minutes

## Troubleshooting

### "Variant already migrated" messages
- **Normal** - Script detects and skips already migrated variants
- **Safe to ignore** - No action needed

### R2 file copy errors
- **Check**: Does the old R2 path still exist?
- **Action**: Migration continues, but version won't have a file
- **Fix**: Re-upload the variant version manually

### Authentication errors
- **Check**: Is your JWT token valid and super-admin?
- **Action**: Refresh your JWT token from OTP auth service

### Timeout errors
- **Reason**: Too many variants to process in one request
- **Solution**: Migration is automatic - it processes in batches

## Post-Migration Tasks

After successful migration:

1. [ ] Update frontend to use new variant version endpoints
2. [ ] Test variant upload flow
3. [ ] Test variant download flow
4. [ ] Test variant version history display
5. [ ] Monitor error logs for any issues
6. [ ] Update documentation for users

## Support

If you encounter issues:

1. Check Cloudflare Worker logs
2. Review error array in migration response
3. Check KV for partially migrated data
4. Contact system administrator

---

**Last Updated:** 2026-01-06  
**Migration Version:** 1.0.0  
**Status:** Ready for Testing

