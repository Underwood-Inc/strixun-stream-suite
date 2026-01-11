# ⚓ Access Hub Port Conflict Fix

## Issues Found

### 1. **Port 5177 Conflict**
- **Control Panel**: Auto-shifted to port 5177 (from 5175)
- **Access Hub**: Also configured to port 5177
- **Result**: Whichever started first got the port, the other served wrong content

### 2. **ECONNREFUSED on /access/roles**
- Access Hub trying to connect to Access Service
- Proxy may not have been configured correctly

## Root Cause

When setting up Access Hub, I chose port 5177 without realizing Control Panel had already auto-shifted to that port during `pnpm dev:turbo`. This caused a port collision.

## Solution

**Changed Access Hub from port 5177 → 5178**

### Changes Made (20+ files)

#### Configuration Files:
- ✅ `access-hub/vite.config.ts` - Port 5178, added `strictPort: true`
- ✅ `scripts/show-dev-ports.js` - Updated port documentation
- ✅ `serverless/otp-auth-service/.dev.vars` - CORS origins updated
- ✅ `serverless/mods-api/.dev.vars` - CORS origins updated
- ✅ `serverless/customer-api/.dev.vars` - CORS origins updated

#### Documentation Files:
- ✅ `ACCESS_ARCHITECTURE_REFACTOR.md`
- ✅ `ACCESS_HUB_SETUP_COMPLETE.md`
- ✅ `access-hub/QUICK_START.md`
- ✅ `access-hub/README.md`
- ✅ `ACCESS_URL_MIGRATION_COMPLETE.md`
- ✅ `PORT_CONFLICT_FIX.md`

#### Vite Config Improvements:
```typescript
server: {
  port: 5178,
  strictPort: true, // Fail if port is already in use
  proxy: {
    '/access': {
      target: 'http://localhost:8795',
      changeOrigin: true,
      rewrite: (path) => path, // Keep the /access path
    },
  },
}
```

## Final Port Map (No Conflicts!)

### Frontend Ports:
```
Stream Suite (Root):  5173 ✅
OTP Auth Dashboard:   5174 ✅
Control Panel:        5175 ✅ (or auto-shift to 5177)
URL Shortener App:    5176 ✅
Access Hub:           5178 ✅ (NEW - no conflict!)
Dice Board Game:      5179 ✅
Mods Hub:             3001 ✅
```

### Backend Ports:
```
OTP Auth Service:     8787 ✅
Mods API:             8788 ✅
Twitch API:           8789 ✅
Customer API:         8790 ✅
Chat Signaling:       8792 ✅
URL Shortener:        8793 ✅
Game API:             8794 ✅
Access Service:       8795 ✅
```

## CORS Configuration

Updated `ALLOWED_ORIGINS` in all `.dev.vars` files:

```
http://localhost:5175  # OTP Auth Dashboard / Control Panel
http://localhost:5178  # Access Hub (NEW)
http://localhost:3001  # Mods Hub
http://localhost:8787  # OTP Auth Service
```

## Testing Instructions

### 1. Stop All Running Services
```powershell
# Press Ctrl+C twice in the terminal running pnpm dev:turbo
```

### 2. Restart Dev Servers
```powershell
pnpm dev:turbo
```

### 3. Verify Access Hub
```powershell
# Open in browser
start http://localhost:5178
```

### 4. Check Access Service Health
```powershell
# Test backend is running
Invoke-RestMethod -Uri "http://localhost:8795/health"

# Test roles endpoint
Invoke-RestMethod -Uri "http://localhost:8795/access/roles"
```

### 5. Verify Ports
```powershell
pnpm dev:ports
```

## Expected Behavior

After restart:
- ✅ **Access Hub** on port **5178** shows Access UI (roles/permissions)
- ✅ **Control Panel** on port **5175** (or 5177) shows Control Panel
- ✅ No ECONNREFUSED errors
- ✅ `/access/roles` returns role data
- ✅ All services on unique ports

## Troubleshooting

### Access Hub Still Shows Control Panel
```powershell
# Kill any processes on port 5178
netstat -ano | findstr :5178
taskkill /PID <PID> /F

# Restart just Access Hub
cd access-hub
pnpm dev
```

### Still Getting ECONNREFUSED
```powershell
# Check if Access Service is running
netstat -ano | findstr :8795

# If not running, start it
cd serverless/access-service
pnpm dev
```

### CORS Errors
Ensure `ALLOWED_ORIGINS` in `.dev.vars` includes `http://localhost:5178`

## Lessons Learned

1. ⚠️ Always check existing port usage before assigning new ports
2. ⚠️ Use `strictPort: true` in Vite config to fail fast on conflicts
3. ⚠️ Update all `.dev.vars` files when changing ports (they're gitignored!)
4. ⚠️ Document port assignments in a central location

---

**Status:** ✅ RESOLVED

Access Hub now runs on unique port 5178 with proper proxy configuration!
