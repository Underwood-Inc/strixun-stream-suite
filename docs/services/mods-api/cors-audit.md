# CORS Origins Audit for Mods API [EMOJI]

## Overview

This document lists **ALL** origins that should be included in the `ALLOWED_ORIGINS` secret for the mods-api worker.

---

## [EMOJI] Production Domains (idling.app)

### Primary Domains

1. **`https://mods.idling.app`** [OK] **CRITICAL**
   - Mods Hub frontend (React app on Cloudflare Pages)
   - **MUST INCLUDE** - Primary consumer of mods API
   - Frontend makes all API calls from this origin

2. **`https://auth.idling.app`** [OK]
   - OTP Auth Service
   - May need to verify mod ownership/authorization
   - **SHOULD INCLUDE** - For auth-related API calls

3. **`https://api.idling.app`** [OK]
   - Main API worker (Twitch API proxy, legacy endpoints)
   - May call mods API for integration features
   - **SHOULD INCLUDE** - For API-to-API calls

4. **`https://customer.idling.app`** [OK]
   - Customer API worker
   - May need mod data for customer profiles
   - **SHOULD INCLUDE** - If customer features use mod data

5. **`https://game.idling.app`** [OK]
   - Game API worker
   - May need mod data for game features
   - **SHOULD INCLUDE** - If game features use mod data

6. **`https://s.idling.app`** [OK]
   - URL Shortener service
   - May need mod data for analytics
   - **SHOULD INCLUDE** - If URL shortener tracks mod downloads

7. **`https://chat.idling.app`** [OK]
   - Chat Signaling service
   - May need mod data for user profiles
   - **SHOULD INCLUDE** - If chat features use mod data

### Root Domain

8. **`https://idling.app`** [OK]
   - Main website domain
   - **SHOULD INCLUDE** - If main site embeds mod browser

9. **`https://www.idling.app`** [OK]
   - WWW subdomain
   - **SHOULD INCLUDE** - If www subdomain is used

---

##  Development/Local Origins

10. **`http://localhost:5173`** [OK]
    - Vite default development server (mods-hub frontend)
    - **MUST INCLUDE** - For local development
    - This is the default port for the mods-hub React app

11. **`http://localhost:3000`** [OK]
    - Common development server port
    - **SHOULD INCLUDE** - For alternative dev setups

12. **`http://localhost:3001`** [OK]
    - Mods Hub development server port (as specified in README)
    - **MUST INCLUDE** - For local development of mods-hub
    - This is the port used by the mods-hub React app

13. **`http://localhost:5174`** [OK]
    - Alternative Vite port
    - **SHOULD INCLUDE** - For multiple dev servers

14. **`http://127.0.0.1:5173`** [OK]
    - Localhost IP (alternative to localhost)
    - **SHOULD INCLUDE** - For IP-based local access

15. **`http://localhost:8080`** [OK]
    - Alternative development port
    - **SHOULD INCLUDE** - For various dev setups

---

## [EMOJI] Complete ALLOWED_ORIGINS String

### Production Only (Recommended for Production)

```bash
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app
```

### Production + Development (Recommended for Development/Staging)

```bash
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app,http://localhost:5173,http://localhost:3000,http://localhost:3001,http://localhost:5174,http://127.0.0.1:5173,http://localhost:8080
```

---

## [EMOJI] Priority Levels

### [EMOJI] CRITICAL (Must Include)
- `https://mods.idling.app` - Primary consumer (Mods Hub frontend)
- `http://localhost:5173` - Local development (mods-hub Vite server)
- `http://localhost:3001` - Local development (mods-hub React app port)

###  HIGH (Should Include)
- `https://auth.idling.app` - Authentication service
- `https://api.idling.app` - Main API worker
- `https://customer.idling.app` - Customer API integration
- `https://game.idling.app` - Game API integration
- `https://idling.app` - Main website
- `https://www.idling.app` - WWW subdomain

### [EMOJI] MEDIUM (Consider Including)
- `https://s.idling.app` - URL shortener
- `https://chat.idling.app` - Chat signaling
- `http://localhost:3000` - Alternative dev port
- `http://localhost:5174` - Alternative Vite port
- `http://127.0.0.1:5173` - IP-based localhost

### [EMOJI] LOW (Optional)
- `http://localhost:8080` - Alternative dev port

---

## [EMOJI] Setting ALLOWED_ORIGINS

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

## [EMOJI] Verification

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

## [WARNING] Security Notes

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

**[WARNING] WARNING:** Wildcards are less secure. Prefer explicit origins.

---

## [EMOJI] Summary Table

| Origin | Priority | Production | Development | Notes |
|--------|----------|-----------|-------------|-------|
| `https://mods.idling.app` | [EMOJI] CRITICAL | [OK] | [OK] | Primary consumer (Mods Hub frontend) |
| `https://auth.idling.app` |  HIGH | [OK] | [OK] | Authentication service |
| `https://api.idling.app` |  HIGH | [OK] | [OK] | Main API worker |
| `https://customer.idling.app` |  HIGH | [OK] | [OK] | Customer API |
| `https://game.idling.app` |  HIGH | [OK] | [OK] | Game API |
| `https://s.idling.app` | [EMOJI] MEDIUM | [OK] | [OK] | URL shortener |
| `https://chat.idling.app` | [EMOJI] MEDIUM | [OK] | [OK] | Chat signaling |
| `https://idling.app` |  HIGH | [OK] | [OK] | Main website |
| `https://www.idling.app` |  HIGH | [OK] | [OK] | WWW subdomain |
| `http://localhost:5173` | [EMOJI] CRITICAL | [ERROR] | [OK] | Vite dev server (mods-hub) |
| `http://localhost:3000` | [EMOJI] MEDIUM | [ERROR] | [OK] | Alternative dev |
| `http://localhost:3001` | [EMOJI] CRITICAL | [ERROR] | [OK] | Mods Hub React app port |
| `http://localhost:5174` | [EMOJI] MEDIUM | [ERROR] | [OK] | Alternative Vite |
| `http://127.0.0.1:5173` | [EMOJI] MEDIUM | [ERROR] | [OK] | IP localhost |
| `http://localhost:8080` | [EMOJI] LOW | [ERROR] | [OK] | Alternative dev |

---

## [EMOJI] Quick Setup Command

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

