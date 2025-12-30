# Troubleshooting Wrangler Dev Issues

Common issues and solutions when running `wrangler dev` for local development.

## JSON Parsing Errors

### Symptom
```
X [ERROR] Build failed with 1 error:
X [ERROR] Unexpected end of file in JSON
    package.json:1:0:
      1 │
        ╵ ^
```

### Causes
1. **File system race condition** - Wrangler reading files while they're being written
2. **Cached build artifacts** - Stale `.wrangler` directory
3. **File locking** - Another process has the file open
4. **Transient I/O error** - Windows file system timing issue

### Solutions

#### 1. Stop All Wrangler Processes
```powershell
# Find and stop all wrangler processes
Get-Process | Where-Object {$_.ProcessName -like "*wrangler*" -or $_.CommandLine -like "*wrangler*"} | Stop-Process -Force
```

#### 2. Clear Wrangler Cache Directory
```powershell
# Remove .wrangler directories (local build cache)
Get-ChildItem -Path . -Recurse -Directory -Filter ".wrangler" | Remove-Item -Recurse -Force

# Or manually delete:
# serverless/*/.wrangler
```

#### 3. Verify package.json Files
```powershell
# Check if package.json files are valid JSON
cd serverless/mods-api
Get-Content package.json | ConvertFrom-Json | Out-Null
Write-Host "[SUCCESS] package.json is valid"

# Repeat for other workers
```

#### 4. Restart Dev Servers
After clearing cache, restart dev servers one at a time:
```powershell
# From mods-hub directory
cd mods-hub
pnpm dev:all
```

#### 5. Check for File Locks
```powershell
# Check if any processes are locking package.json files
Get-Process | Where-Object {$_.Path -like "*wrangler*" -or $_.Path -like "*node*"}
```

## Port Already in Use

### Symptom
```
X [ERROR] Port 8787 is already in use
```

### Solution
```powershell
# Find process using the port
netstat -ano | findstr :8787

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or use the worker's dev script which specifies the port
cd serverless/otp-auth-service
pnpm dev  # Uses --port 8787 automatically
```

## Assertion Failures

### Symptom
```
Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
```

### Causes
- Wrangler internal error (Node.js/UV handle issue)
- Multiple wrangler instances conflicting
- Windows-specific async handle issue

### Solutions

1. **Close all wrangler processes** and restart
2. **Update wrangler** to latest version:
   ```powershell
   pnpm update wrangler
   ```
3. **Use `--local` flag** explicitly:
   ```powershell
   wrangler dev --local --port 8787
   ```

## Worker Not Starting

### Check Worker Health
```powershell
# Test if worker is responding
curl http://localhost:8787/health

# Or use PowerShell
Invoke-WebRequest -Uri http://localhost:8787/health
```

### Verify Configuration
```powershell
# Check wrangler.toml exists
Test-Path serverless/mods-api/wrangler.toml

# Check .dev.vars exists (if needed)
Test-Path serverless/mods-api/.dev.vars
```

## Common Fixes Summary

1. **Stop all processes**: Kill all wrangler/node processes
2. **Clear cache**: Delete `.wrangler` directories
3. **Verify files**: Check package.json is valid JSON
4. **Restart fresh**: Start dev servers one at a time
5. **Check ports**: Ensure ports aren't in use (see [WORKER_PORT_MAPPING.md](./WORKER_PORT_MAPPING.md))

## Prevention

- Always use `--port` flag in package.json dev scripts (see [WORKER_PORT_MAPPING.md](./WORKER_PORT_MAPPING.md))
- Don't run multiple instances of the same worker
- Use `pnpm dev:all` from mods-hub instead of starting workers individually
- Keep wrangler updated: `pnpm update wrangler`

## Still Having Issues?

1. Check wrangler logs: `C:\Users\<user>\AppData\Roaming\xdg.config\.wrangler\logs\`
2. Run with verbose logging: `wrangler dev --log-level debug`
3. Check Windows Event Viewer for system errors
4. Try running workers individually to isolate the issue

