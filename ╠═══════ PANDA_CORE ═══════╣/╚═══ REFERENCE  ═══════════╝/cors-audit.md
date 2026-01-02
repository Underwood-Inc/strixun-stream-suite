# CORS Origins Audit for Customer API ★ ## Overview

This document lists **ALL** origins that should be included in the `ALLOWED_ORIGINS` secret for the customer-api worker.

---

## ★ Production Domains (idling.app)

### Primary Domains

1. **`https://auth.idling.app`** ✓
   - OTP Auth Service (main authentication service)
   - Dashboard is served from `/dashboard` path
   - **MUST INCLUDE** - Primary consumer of customer API

2. **`https://api.idling.app`** ✓
   - Main API worker (Twitch API proxy, legacy endpoints)
   - May call customer API for customer data
   - **SHOULD INCLUDE** - For API-to-API calls

3. **`https://customer.idling.app`** ✓
   - Customer API worker itself (for same-origin requests)
   - **SHOULD INCLUDE** - For consistency

4. **`https://game.idling.app`** ✓
   - Game API worker
   - May need customer data for game features
   - **SHOULD INCLUDE** - If game features use customer data

5. **`https://mods.idling.app`** ✓
   - Mods API worker
   - May need customer data for mod management
   - **SHOULD INCLUDE** - If mod features use customer data

6. **`https://s.idling.app`** ✓
   - URL Shortener service
   - May need customer data for analytics
   - **SHOULD INCLUDE** - If URL shortener tracks customer data

7. **`https://chat.idling.app`** ✓
   - Chat Signaling service
   - May need customer data for user profiles
   - **SHOULD INCLUDE** - If chat features use customer data

### Root Domain

8. **`https://idling.app`** ✓
   - Main website domain
   - **SHOULD INCLUDE** - If main site calls customer API

9. **`https://www.idling.app`** ✓
   - WWW subdomain
   - **SHOULD INCLUDE** - If www subdomain is used

---

##  Development/Local Origins

10. **`http://localhost:5173`** ✓
    - Vite default development server
    - **MUST INCLUDE** - For local development

11. **`http://localhost:3000`** ✓
    - Common development server port
    - **SHOULD INCLUDE** - For alternative dev setups

12. **`http://localhost:5174`** ✓
    - Alternative Vite port
    - **SHOULD INCLUDE** - For multiple dev servers

13. **`http://127.0.0.1:5173`** ✓
    - Localhost IP (alternative to localhost)
    - **SHOULD INCLUDE** - For IP-based local access

14. **`http://localhost:8080`** ✓
    - Alternative development port
    - **SHOULD INCLUDE** - For various dev setups

---

## ★ Complete ALLOWED_ORIGINS String

### Production Only (Recommended for Production)

```bash
https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://mods.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app
```

### Production + Development (Recommended for Development/Staging)

```bash
https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://mods.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app,http://localhost:5173,http://localhost:3000,http://localhost:5174,http://127.0.0.1:5173,http://localhost:8080
```

---

## ★ Priority Levels

### ★ CRITICAL (Must Include)
- `https://auth.idling.app` - Primary consumer
- `http://localhost:5173` - Local development

###  HIGH (Should Include)
- `https://api.idling.app` - Main API worker
- `https://customer.idling.app` - Same-origin
- `https://game.idling.app` - Game API integration
- `https://mods.idling.app` - Mods API integration
- `https://idling.app` - Main website
- `https://www.idling.app` - WWW subdomain

### ★ MEDIUM (Consider Including)
- `https://s.idling.app` - URL shortener
- `https://chat.idling.app` - Chat signaling
- `http://localhost:3000` - Alternative dev port
- `http://localhost:5174` - Alternative Vite port
- `http://127.0.0.1:5173` - IP-based localhost

### ★ LOW (Optional)
- `http://localhost:8080` - Alternative dev port

---

## ★ Setting ALLOWED_ORIGINS

### For Production

```bash
cd serverless/customer-api
wrangler secret put ALLOWED_ORIGINS
# When prompted, paste:
https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://mods.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app
```

### For Development/Staging

```bash
cd serverless/customer-api
wrangler secret put ALLOWED_ORIGINS
# When prompted, paste:
https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://mods.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app,http://localhost:5173,http://localhost:3000,http://localhost:5174,http://127.0.0.1:5173,http://localhost:8080
```

---

## ★ Verification

After setting ALLOWED_ORIGINS, test CORS from each origin:

```bash
# Test from auth.idling.app origin
curl -H "Origin: https://auth.idling.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Authorization" \
     -X OPTIONS \
     https://customer.idling.app/customer/me

# Should return:
# Access-Control-Allow-Origin: https://auth.idling.app
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
# Access-Control-Allow-Headers: Content-Type, Authorization, ...
```

---

## ⚠ Security Notes

1. **Never use `*` in production** - Always specify exact origins
2. **Include protocol** - `https://` for production, `http://` for localhost
3. **No trailing slashes** - Origins should not end with `/`
4. **Case sensitive** - Origins are case-sensitive
5. **Wildcards supported** - You can use `https://*.idling.app` to match all subdomains (less secure)

### Wildcard Example (Less Secure)

```bash
# Matches all idling.app subdomains
https://*.idling.app,http://localhost:*
```

**⚠ WARNING:** Wildcards are less secure. Prefer explicit origins.

---

## ★ Summary Table

| Origin | Priority | Production | Development | Notes |
|--------|----------|-----------|-------------|-------|
| `https://auth.idling.app` | ★ CRITICAL | ✓ | ✓ | Primary consumer |
| `https://api.idling.app` |  HIGH | ✓ | ✓ | Main API worker |
| `https://customer.idling.app` |  HIGH | ✓ | ✓ | Same-origin |
| `https://game.idling.app` |  HIGH | ✓ | ✓ | Game API |
| `https://mods.idling.app` |  HIGH | ✓ | ✓ | Mods API |
| `https://s.idling.app` | ★ MEDIUM | ✓ | ✓ | URL shortener |
| `https://chat.idling.app` | ★ MEDIUM | ✓ | ✓ | Chat signaling |
| `https://idling.app` |  HIGH | ✓ | ✓ | Main website |
| `https://www.idling.app` |  HIGH | ✓ | ✓ | WWW subdomain |
| `http://localhost:5173` | ★ CRITICAL | ✗ | ✓ | Vite dev server |
| `http://localhost:3000` | ★ MEDIUM | ✗ | ✓ | Alternative dev |
| `http://localhost:5174` | ★ MEDIUM | ✗ | ✓ | Alternative Vite |
| `http://127.0.0.1:5173` | ★ MEDIUM | ✗ | ✓ | IP localhost |
| `http://localhost:8080` | ★ LOW | ✗ | ✓ | Alternative dev |

---

## ★ Quick Setup Command

### Production (Recommended)

```bash
cd serverless/customer-api
wrangler secret put ALLOWED_ORIGINS
# Paste this when prompted:
https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://mods.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app
```

### Development (Full List)

```bash
cd serverless/customer-api
wrangler secret put ALLOWED_ORIGINS
# Paste this when prompted:
https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://mods.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app,http://localhost:5173,http://localhost:3000,http://localhost:5174,http://127.0.0.1:5173,http://localhost:8080
```

---

**Status:** ✓ **COMPLETE AUDIT**
**Last Updated:** 2024-12-19
**Total Origins:** 14 (9 production + 5 development)

