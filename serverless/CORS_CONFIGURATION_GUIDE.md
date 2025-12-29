# CORS Configuration Guide 🔐

Complete guide for configuring CORS (Cross-Origin Resource Sharing) for all services in the Strixun Stream Suite.

**Last Updated:** 2025-01-XX  
**Status:** ✅ Production Ready

---

## 📋 Overview

This document provides **exact commands and values** to configure CORS for each service, ensuring all necessary communications are capable.

### Architecture Summary

- **Frontend:** `mods.idling.app` (Cloudflare Pages - React app)
- **Mods API:** `mods-api.idling.app` (Cloudflare Worker)
- **Auth Service:** `auth.idling.app` (Cloudflare Worker)
- **Customer API:** `customer.idling.app` (Cloudflare Worker)
- **Other Services:** `api.idling.app`, `game.idling.app`, `s.idling.app`, `chat.idling.app`

---

## 🎯 Communication Matrix

| From (Origin) | To (Service) | Purpose | Required CORS |
|--------------|--------------|---------|---------------|
| `mods.idling.app` | `mods-api.idling.app` | Frontend ❓ API calls | ✅ **CRITICAL** |
| `mods.idling.app` | `auth.idling.app` | Frontend ❓ Login/Auth | ✅ **CRITICAL** |
| `auth.idling.app` | `customer.idling.app` | Dashboard ❓ Customer data | ✅ **CRITICAL** |
| `auth.idling.app` | `mods-api.idling.app` | Auth verification | ❓ HIGH |
| `api.idling.app` | `mods-api.idling.app` | API integration | ❓ HIGH |
| `api.idling.app` | `customer.idling.app` | API integration | ❓ HIGH |
| `game.idling.app` | `mods-api.idling.app` | Game features | 🟡 MEDIUM |
| `game.idling.app` | `customer.idling.app` | Game features | 🟡 MEDIUM |
| `localhost:3001` | `mods-api.idling.app` | Local dev | ✅ **CRITICAL** |
| `localhost:3001` | `auth.idling.app` | Local dev | ✅ **CRITICAL** |

---

## 🔧 Service-by-Service Configuration

### 1. Mods API (`strixun-mods-api`)

**Service URL:** `https://mods-api.idling.app`  
**Worker Name:** `strixun-mods-api`  
**Primary Consumers:** `mods.idling.app` (frontend)

#### Production Configuration

```bash
cd serverless/mods-api
wrangler secret put ALLOWED_ORIGINS
```

**When prompted, paste this value:**

```
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app
```

#### Development Configuration (includes localhost)

```bash
cd serverless/mods-api
wrangler secret put ALLOWED_ORIGINS
```

**When prompted, paste this value:**

```
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app,http://localhost:5173,http://localhost:3000,http://localhost:3001,http://localhost:5174,http://127.0.0.1:5173,http://localhost:8080
```

#### Verification

```bash
# Test CORS from frontend origin
curl -H "Origin: https://mods.idling.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Authorization" \
     -X OPTIONS \
     https://mods-api.idling.app/mods

# Expected response headers:
# Access-Control-Allow-Origin: https://mods.idling.app
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
# Access-Control-Allow-Headers: Content-Type, Authorization, ...
```

---

### 2. OTP Auth Service (`strixun-otp-auth-service`)

**Service URL:** `https://auth.idling.app`  
**Worker Name:** `strixun-otp-auth-service`  
**Primary Consumers:** `mods.idling.app` (frontend), `auth.idling.app` (dashboard)

#### Production Configuration

```bash
cd serverless/otp-auth-service
wrangler secret put ALLOWED_ORIGINS
```

**When prompted, paste this value:**

```
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app
```

#### Development Configuration (includes localhost)

```bash
cd serverless/otp-auth-service
wrangler secret put ALLOWED_ORIGINS
```

**When prompted, paste this value:**

```
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app,http://localhost:5173,http://localhost:3000,http://localhost:3001,http://localhost:5174,http://127.0.0.1:5173,http://localhost:8080
```

#### Verification

```bash
# Test CORS from frontend origin
curl -H "Origin: https://mods.idling.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://auth.idling.app/auth/request-otp

# Expected response headers:
# Access-Control-Allow-Origin: https://mods.idling.app
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
# Access-Control-Allow-Headers: Content-Type, Authorization, ...
```

---

### 3. Customer API (`strixun-customer-api`)

**Service URL:** `https://customer.idling.app`  
**Worker Name:** `strixun-customer-api`  
**Primary Consumers:** `auth.idling.app` (dashboard)

#### Production Configuration

```bash
cd serverless/customer-api
wrangler secret put ALLOWED_ORIGINS
```

**When prompted, paste this value:**

```
https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://mods.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app
```

#### Development Configuration (includes localhost)

```bash
cd serverless/customer-api
wrangler secret put ALLOWED_ORIGINS
```

**When prompted, paste this value:**

```
https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://mods.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app,http://localhost:5173,http://localhost:3000,http://localhost:5174,http://127.0.0.1:5173,http://localhost:8080
```

#### Verification

```bash
# Test CORS from auth service origin
curl -H "Origin: https://auth.idling.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Authorization" \
     -X OPTIONS \
     https://customer.idling.app/customer/me

# Expected response headers:
# Access-Control-Allow-Origin: https://auth.idling.app
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
# Access-Control-Allow-Headers: Content-Type, Authorization, ...
```

---

## 🚀 Quick Setup Script

Run this script to configure all services at once:

```bash
#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Configuring CORS for all services...${NC}\n"

# Production origins (all services)
PROD_ORIGINS="https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app"

# Development origins (includes localhost)
DEV_ORIGINS="${PROD_ORIGINS},http://localhost:5173,http://localhost:3000,http://localhost:3001,http://localhost:5174,http://127.0.0.1:5173,http://localhost:8080"

# Ask user for environment
read -p "Configure for (p)roduction or (d)evelopment? [p/d]: " env_choice

if [ "$env_choice" = "d" ]; then
    ORIGINS=$DEV_ORIGINS
    echo -e "${GREEN}Using development configuration (includes localhost)${NC}\n"
else
    ORIGINS=$PROD_ORIGINS
    echo -e "${GREEN}Using production configuration${NC}\n"
fi

# Mods API
echo -e "${YELLOW}Configuring mods-api...${NC}"
cd serverless/mods-api
echo "$ORIGINS" | wrangler secret put ALLOWED_ORIGINS
echo -e "${GREEN}❓ mods-api configured${NC}\n"

# OTP Auth Service
echo -e "${YELLOW}Configuring otp-auth-service...${NC}"
cd ../otp-auth-service
echo "$ORIGINS" | wrangler secret put ALLOWED_ORIGINS
echo -e "${GREEN}❓ otp-auth-service configured${NC}\n"

# Customer API
echo -e "${YELLOW}Configuring customer-api...${NC}"
cd ../customer-api
echo "$ORIGINS" | wrangler secret put ALLOWED_ORIGINS
echo -e "${GREEN}❓ customer-api configured${NC}\n"

echo -e "${GREEN}All services configured!${NC}"
```

**Usage:**

```bash
chmod +x serverless/configure-cors.sh
./serverless/configure-cors.sh
```

---

## 📊 Complete Origin Reference

### Production Origins (All Services)

| Origin | Service | Priority | Notes |
|--------|---------|----------|-------|
| `https://mods.idling.app` | All | 🔴 CRITICAL | Frontend (Mods Hub) |
| `https://auth.idling.app` | All | 🔴 CRITICAL | Auth service (dashboard) |
| `https://api.idling.app` | All | ❓ HIGH | Main API worker |
| `https://customer.idling.app` | All | ❓ HIGH | Customer API |
| `https://game.idling.app` | All | ❓ HIGH | Game API |
| `https://s.idling.app` | All | 🟡 MEDIUM | URL shortener |
| `https://chat.idling.app` | All | 🟡 MEDIUM | Chat signaling |
| `https://idling.app` | All | ❓ HIGH | Root domain |
| `https://www.idling.app` | All | ❓ HIGH | WWW subdomain |

### Development Origins (Additional)

| Origin | Priority | Notes |
|--------|----------|-------|
| `http://localhost:5173` | 🔴 CRITICAL | Vite default port |
| `http://localhost:3001` | 🔴 CRITICAL | Mods Hub React app port |
| `http://localhost:3000` | 🟡 MEDIUM | Alternative dev port |
| `http://localhost:5174` | 🟡 MEDIUM | Alternative Vite port |
| `http://127.0.0.1:5173` | 🟡 MEDIUM | IP-based localhost |
| `http://localhost:8080` | 🟢 LOW | Alternative dev port |

---

## ✅ Verification Checklist

After configuring CORS, verify each service:

- [ ] **Mods API** accepts requests from `mods.idling.app`
- [ ] **Mods API** accepts requests from `localhost:3001` (if dev)
- [ ] **OTP Auth Service** accepts requests from `mods.idling.app`
- [ ] **OTP Auth Service** accepts requests from `localhost:3001` (if dev)
- [ ] **Customer API** accepts requests from `auth.idling.app`
- [ ] All services return proper CORS headers on OPTIONS requests
- [ ] All services return proper CORS headers on actual requests

---

## 🔍 Troubleshooting

### Issue: CORS errors in browser console

**Solution:**
1. Verify the origin is in `ALLOWED_ORIGINS`
2. Check that the origin matches exactly (case-sensitive, no trailing slash)
3. Ensure the service is deployed with the updated secret
4. Clear browser cache and try again

### Issue: Preflight (OPTIONS) request fails

**Solution:**
1. Verify OPTIONS handler returns 204 status
2. Check that CORS headers are set on OPTIONS response
3. Ensure `Access-Control-Allow-Methods` includes the requested method
4. Ensure `Access-Control-Allow-Headers` includes all required headers

### Issue: CORS works in dev but not production

**Solution:**
1. Verify production secret is set (not just dev)
2. Check that `ENVIRONMENT` variable is set correctly
3. Ensure production origins don't include localhost
4. Redeploy the service after updating secrets

---

## 📝 Notes

1. **Secrets are per-environment**: Production and development secrets are separate
2. **No wildcards in production**: Always specify exact origins for security
3. **Case-sensitive**: Origins must match exactly (including protocol)
4. **No trailing slashes**: Origins should not end with `/`
5. **Redeploy after changes**: Secrets take effect immediately, but you may need to clear cache

---

## 🔐 Security Best Practices

1. ✅ **Never use `*` in production** - Always specify exact origins
2. ✅ **Include protocol** - `https://` for production, `http://` for localhost
3. ✅ **No trailing slashes** - Origins should not end with `/`
4. ✅ **Case sensitive** - Origins are case-sensitive
5. ✅ **Minimal origins** - Only include origins that actually need access
6. ✅ **Separate dev/prod** - Use different configurations for dev and production

---

**Status:** ✅ **COMPLETE**  
**Last Updated:** 2025-01-XX  
**Maintained By:** Strixun Stream Suite Team

