# Local R2 Storage Guide

**Last Updated:** 2025-01-02

## Quick Answer: Yes, We Have Local R2 Storage!

When you run `pnpm dev:all` or `wrangler dev --local`, **all R2 buckets are stored locally** on your filesystem. No cloud storage is used during local development.

## How It Works

### Local R2 Storage

When you use `wrangler dev --local` (which all our dev scripts now use):

1. **R2 buckets are stored locally** in `~/.wrangler/state/v3/r2/`
2. **Files are stored on your filesystem** - you can browse them directly
3. **No cloud access needed** - works completely offline
4. **Ephemeral by default** - cleared when worker stops (unless you persist it)

### Storage Location

**Windows:**
```
C:\Users\{YourUsername}\.wrangler\state\v3\r2\
```

**Mac/Linux:**
```
~/.wrangler/state/v3/r2/
```

### What Gets Stored Locally

When you upload files in local dev:

- **Mod files** → `~/.wrangler/state/v3/r2/{bucket-name}/mods/{modId}/{versionId}.zip`
- **Thumbnails** → `~/.wrangler/state/v3/r2/{bucket-name}/thumbnails/{modId}.{ext}`
- **Profile pictures** → `~/.wrangler/state/v3/r2/{bucket-name}/profile-pictures/{customerId}/...`

## How to Use

### Start Local Dev with R2

```bash
# From mods-hub directory
pnpm dev:all
```

This starts all workers with `--local` flag, which means:
- ✅ R2 buckets are stored locally
- ✅ KV namespaces are stored locally
- ✅ No cloud access needed
- ✅ Fast local file access

### Browse Local R2 Files

**Windows PowerShell:**
```powershell
# View R2 bucket contents
Get-ChildItem "$env:USERPROFILE\.wrangler\state\v3\r2" -Recurse

# View mods specifically
Get-ChildItem "$env:USERPROFILE\.wrangler\state\v3\r2\*\mods" -Recurse
```

**Mac/Linux:**
```bash
# View R2 bucket contents
ls -la ~/.wrangler/state/v3/r2/

# View mods specifically
find ~/.wrangler/state/v3/r2 -name "*.zip" -o -name "*.png" -o -name "*.jpg"
```

### Clear Local R2 Storage

If you want to reset your local R2 storage:

**Windows PowerShell:**
```powershell
# Remove all local R2 data
Remove-Item "$env:USERPROFILE\.wrangler\state\v3\r2" -Recurse -Force
```

**Mac/Linux:**
```bash
# Remove all local R2 data
rm -rf ~/.wrangler/state/v3/r2
```

**Note:** Wrangler will recreate the directory structure on next `wrangler dev --local` run.

## Configuration

### All Dev Scripts Use `--local`

All worker `package.json` files now use `--local` flag:

```json
{
  "scripts": {
    "dev": "wrangler dev --port 8788 --local"
  }
}
```

This ensures:
- ✅ Local R2 storage (not cloud)
- ✅ Local KV storage (not cloud)
- ✅ Uses `.dev.vars` (not cloud secrets)
- ✅ Works offline

### R2 Bucket Configuration

R2 buckets are configured in `wrangler.toml`:

```toml
# Development R2 Bucket
[[env.development.r2_buckets]]
binding = "MODS_R2"
bucket_name = "mods-storage"
```

When using `--local`, this bucket is created automatically in `~/.wrangler/state/v3/r2/mods-storage/`.

## Upload Flow in Local Dev

1. **User uploads file** via frontend
2. **Worker receives upload** (mods-api worker)
3. **File is stored locally** in `~/.wrangler/state/v3/r2/mods-storage/`
4. **File is immediately available** for download/retrieval
5. **No cloud upload** - everything stays local

## Benefits of Local R2

### ✅ Fast Development
- **No network latency** - files stored on local disk
- **Instant access** - no waiting for cloud uploads
- **Unlimited bandwidth** - local disk speed

### ✅ Safe Testing
- **No production data** - completely isolated
- **No costs** - no Cloudflare R2 usage
- **Easy cleanup** - just delete the directory

### ✅ Offline Development
- **Works without internet** - all storage is local
- **No cloud dependencies** - fully self-contained
- **Fast iteration** - no deployment needed

### ✅ Easy Debugging
- **Browse files directly** - see what's actually stored
- **Inspect file contents** - open files in any editor
- **Clear and reset** - delete directory to start fresh

## Production vs Local

| Aspect | Local Dev (`--local`) | Production |
|--------|----------------------|------------|
| **Storage** | Local filesystem | Cloudflare R2 (cloud) |
| **Location** | `~/.wrangler/state/v3/r2/` | Cloudflare data centers |
| **Persistence** | Ephemeral (cleared on stop) | Permanent |
| **Speed** | Very fast (local disk) | Fast (edge network) |
| **Cost** | Free | Cloudflare usage costs |
| **Access** | Direct file access | API only |
| **Network** | Not required | Required |

## Troubleshooting

### Files Not Appearing

**Problem:** Uploaded files don't show up

**Solutions:**
1. **Check `--local` flag** - Ensure dev script uses `--local`
2. **Check storage location** - Verify `~/.wrangler/state/v3/r2/` exists
3. **Check worker logs** - Look for R2 upload errors
4. **Restart worker** - Sometimes state needs refresh

### Storage Location Not Found

**Problem:** `~/.wrangler/state/` doesn't exist

**Solution:**
- This is normal! Wrangler creates it on first `wrangler dev --local` run
- Just start your dev server and the directory will be created automatically

### Files Persisting After Restart

**Problem:** Files still there after stopping worker

**Solution:**
- This is expected! Local R2 storage persists until you delete it
- To clear: Delete `~/.wrangler/state/v3/r2/` directory
- Or use `wrangler dev --local --persist-to=./.wrangler` for project-specific storage

### Seeing Production Data in Local Dev

**Problem:** You see mods in local dev that you didn't upload locally (e.g., "compressy LITE")

**Cause:** Local KV storage contains production data from a previous run without `--local` flag

**Solution:**
1. **Clear local KV storage:**
   ```powershell
   # Windows PowerShell
   Remove-Item "$env:USERPROFILE\.wrangler\state\v3" -Recurse -Force
   ```
   ```bash
   # Mac/Linux
   rm -rf ~/.wrangler/state/v3
   ```

2. **Restart dev servers:**
   ```bash
   cd mods-hub
   pnpm dev:all
   ```

3. **Verify isolation:**
   - Upload a test mod
   - It should only appear in local dev, not production
   - Check worker logs for `[ListMods] Local dev mode` message

**Prevention:**
- Always use `--local` flag in dev scripts (already configured)
- Never run `wrangler dev` without `--local` flag
- Clear local storage if you suspect production data contamination

### Want to Use Cloud R2 Instead?

If you want to use real cloud R2 during local dev (not recommended for testing):

1. **Remove `--local` flag** from dev script
2. **Ensure R2 bucket exists** in Cloudflare Dashboard
3. **Authenticate** with `wrangler login`
4. **Files will upload to cloud** - costs apply!

**Note:** We recommend using `--local` for all local development to avoid costs and keep data isolated.

## Example: Uploading a Mod

```bash
# 1. Start dev servers
cd mods-hub
pnpm dev:all

# 2. Upload a mod via frontend (http://localhost:3001)
# 3. File is stored locally at:
#    ~/.wrangler/state/v3/r2/mods-storage/mods/{modId}/{versionId}.zip

# 4. View the file:
# Windows:
Get-ChildItem "$env:USERPROFILE\.wrangler\state\v3\r2\mods-storage\mods" -Recurse

# Mac/Linux:
ls -la ~/.wrangler/state/v3/r2/mods-storage/mods/
```

## Summary

**Yes, we have local R2 storage!** When you run `pnpm dev:all`, all uploads are stored locally in `~/.wrangler/state/v3/r2/`. No cloud storage is used, no costs apply, and everything works offline. Perfect for local development and testing!

