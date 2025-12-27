# CORS Origins Audit for Mods API 🔍

## Overview

This document lists **ALL** origins that should be included in the `ALLOWED_ORIGINS` secret for the mods-api worker.

---

## 🌐 Production Domains (idling.app)

### Primary Domains

1. **`https://mods.idling.app`** ✅ **CRITICAL**
   - Mods Hub frontend (React app on Cloudflare Pages)
   - **MUST INCLUDE** - Primary consumer of mods API
   - Frontend makes all API calls from this origin

2. **`https://auth.idling.app`** ✅
   - OTP Auth Service
   - May need to verify mod ownership/authorization
   - **SHOULD INCLUDE** - For auth-related API calls

3. **`https://api.idling.app`** ✅
   - Main API worker (Twitch API proxy, legacy endpoints)
   - May call mods API for integration features
   - **SHOULD INCLUDE** - For API-to-API calls

4. **`https://customer.idling.app`** ✅
   - Customer API worker
   - May need mod data for customer profiles
   - **SHOULD INCLUDE** - If customer features use mod data

5. **`https://game.idling.app`** ✅
   - Game API worker
   - May need mod data for game features
   - **SHOULD INCLUDE** - If game features use mod data

6. **`https://s.idling.app`** ✅
   - URL Shortener service
   - May need mod data for analytics
   - **SHOULD INCLUDE** - If URL shortener tracks mod downloads

7. **`https://chat.idling.app`** ✅
   - Chat Signaling service
   - May need mod data for user profiles
   - **SHOULD INCLUDE** - If chat features use mod data

### Root Domain

8. **`https://idling.app`** ✅
   - Main website domain
   - **SHOULD INCLUDE** - If main site embeds mod browser

9. **`https://www.idling.app`** ✅
   - WWW subdomain
   - **SHOULD INCLUDE** - If www subdomain is used

---

## 🏠 Development/Local Origins

10. **`http://localhost:5173`** ✅
    - Vite default development server (mods-hub frontend)
    - **MUST INCLUDE** - For local development
    - This is the default port for the mods-hub React app

11. **`http://localhost:3000`** ✅
    - Common development server port
    - **SHOULD INCLUDE** - For alternative dev setups

12. **`http://localhost:3001`** ✅
    - Mods Hub development server port (as specified in README)
    - **MUST INCLUDE** - For local development of mods-hub
    - This is the port used by the mods-hub React app

13. **`http://localhost:5174`** ✅
    - Alternative Vite port
    - **SHOULD INCLUDE** - For multiple dev servers

14. **`http://127.0.0.1:5173`** ✅
    - Localhost IP (alternative to localhost)
    - **SHOULD INCLUDE** - For IP-based local access

15. **`http://localhost:8080`** ✅
    - Alternative development port
    - **SHOULD INCLUDE** - For various dev setups

---

## 📋 Complete ALLOWED_ORIGINS String

### Production Only (Recommended for Production)

```bash
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app
```

### Production + Development (Recommended for Development/Staging)

```bash
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app,http://localhost:5173,http://localhost:3000,http://localhost:3001,http://localhost:5174,http://127.0.0.1:5173,http://localhost:8080
```

---

## 🎯 Priority Levels

### 🔴 CRITICAL (Must Include)
- `https://mods.idling.app` - Primary consumer (Mods Hub frontend)
- `http://localhost:5173` - Local development (mods-hub Vite server)
- `http://localhost:3001` - Local development (mods-hub React app port)

### 🟠 HIGH (Should Include)
- `https://auth.idling.app` - Authentication service
- `https://api.idling.app` - Main API worker
- `https://customer.idling.app` - Customer API integration
- `https://game.idling.app` - Game API integration
- `https://idling.app` - Main website
- `https://www.idling.app` - WWW subdomain

### 🟡 MEDIUM (Consider Including)
- `https://s.idling.app` - URL shortener
- `https://chat.idling.app` - Chat signaling
- `http://localhost:3000` - Alternative dev port
- `http://localhost:5174` - Alternative Vite port
- `http://127.0.0.1:5173` - IP-based localhost

### 🟢 LOW (Optional)
- `http://localhost:8080` - Alternative dev port

---

## 📝 Setting ALLOWED_ORIGINS

### For Production (Recommended)

```bash
cd serverless/mods-api
wrangler secret put ALLOWED_ORIGINS
# When prompted, paste:
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app
```

### For Development/Staging (Full List)

```bash
cd serverless/mods-api
wrangler secret put ALLOWED_ORIGINS
# When prompted, paste:
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app,http://localhost:5173,http://localhost:3000,http://localhost:3001,http://localhost:5174,http://127.0.0.1:5173,http://localhost:8080
```

---

## 🔍 Verification

After setting ALLOWED_ORIGINS, test CORS from the primary origin:

```bash
# Test from mods.idling.app origin
curl -H "Origin: https://mods.idling.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Authorization" \
     -X OPTIONS \
     https://mods-api.idling.app/mods

# Should return:
# Access-Control-Allow-Origin: https://mods.idling.app
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
# Access-Control-Allow-Headers: Content-Type, Authorization, ...
```

---

## ⚠️ Security Notes

1. **Never use `*` in production** - Always specify exact origins
2. **Include protocol** - `https://` for production, `http://` for localhost
3. **No trailing slashes** - Origins should not end with `/`
4. **Case sensitive** - Origins are case-sensitive
5. **Wildcards supported** - You can use `https://*.idling.app` to match all subdomains (less secure)

### Wildcard Example (Less Secure - Not Recommended)

```bash
# Matches all idling.app subdomains
https://*.idling.app,http://localhost:*
```

**⚠️ WARNING:** Wildcards are less secure. Prefer explicit origins.

---

## 📊 Summary Table

| Origin | Priority | Production | Development | Notes |
|--------|----------|-----------|-------------|-------|
| `https://mods.idling.app` | 🔴 CRITICAL | ✅ | ✅ | Primary consumer (Mods Hub frontend) |
| `https://auth.idling.app` | 🟠 HIGH | ✅ | ✅ | Authentication service |
| `https://api.idling.app` | 🟠 HIGH | ✅ | ✅ | Main API worker |
| `https://customer.idling.app` | 🟠 HIGH | ✅ | ✅ | Customer API |
| `https://game.idling.app` | 🟠 HIGH | ✅ | ✅ | Game API |
| `https://s.idling.app` | 🟡 MEDIUM | ✅ | ✅ | URL shortener |
| `https://chat.idling.app` | 🟡 MEDIUM | ✅ | ✅ | Chat signaling |
| `https://idling.app` | 🟠 HIGH | ✅ | ✅ | Main website |
| `https://www.idling.app` | 🟠 HIGH | ✅ | ✅ | WWW subdomain |
| `http://localhost:5173` | 🔴 CRITICAL | ❌ | ✅ | Vite dev server (mods-hub) |
| `http://localhost:3000` | 🟡 MEDIUM | ❌ | ✅ | Alternative dev |
| `http://localhost:3001` | 🔴 CRITICAL | ❌ | ✅ | Mods Hub React app port |
| `http://localhost:5174` | 🟡 MEDIUM | ❌ | ✅ | Alternative Vite |
| `http://127.0.0.1:5173` | 🟡 MEDIUM | ❌ | ✅ | IP localhost |
| `http://localhost:8080` | 🟢 LOW | ❌ | ✅ | Alternative dev |

---

## 🚀 Quick Setup Command

### Production (Recommended)

```bash
cd serverless/mods-api
wrangler secret put ALLOWED_ORIGINS
# Paste this when prompted:
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app
```

### Development (Full List)

```bash
cd serverless/mods-api
wrangler secret put ALLOWED_ORIGINS
# Paste this when prompted:
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app,http://localhost:5173,http://localhost:3000,http://localhost:3001,http://localhost:5174,http://127.0.0.1:5173,http://localhost:8080
```

