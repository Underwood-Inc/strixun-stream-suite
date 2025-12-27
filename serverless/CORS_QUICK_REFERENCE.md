# CORS Quick Reference 🚀

**Quick commands to configure CORS for all services.**

---

## 🎯 Production Configuration

### 1. Mods API

```bash
cd serverless/mods-api
wrangler secret put ALLOWED_ORIGINS
# Paste when prompted:
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app
```

### 2. OTP Auth Service

```bash
cd serverless/otp-auth-service
wrangler secret put ALLOWED_ORIGINS
# Paste when prompted:
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app
```

### 3. Customer API

```bash
cd serverless/customer-api
wrangler secret put ALLOWED_ORIGINS
# Paste when prompted:
https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://mods.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app
```

---

## 🛠️ Development Configuration (includes localhost)

### 1. Mods API

```bash
cd serverless/mods-api
wrangler secret put ALLOWED_ORIGINS
# Paste when prompted:
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app,http://localhost:5173,http://localhost:3000,http://localhost:3001,http://localhost:5174,http://127.0.0.1:5173,http://localhost:8080
```

### 2. OTP Auth Service

```bash
cd serverless/otp-auth-service
wrangler secret put ALLOWED_ORIGINS
# Paste when prompted:
https://mods.idling.app,https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app,http://localhost:5173,http://localhost:3000,http://localhost:3001,http://localhost:5174,http://127.0.0.1:5173,http://localhost:8080
```

### 3. Customer API

```bash
cd serverless/customer-api
wrangler secret put ALLOWED_ORIGINS
# Paste when prompted:
https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://mods.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app,http://localhost:5173,http://localhost:3000,http://localhost:5174,http://127.0.0.1:5173,http://localhost:8080
```

---

## ✅ Verification Commands

### Test Mods API CORS

```bash
curl -H "Origin: https://mods.idling.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Authorization" \
     -X OPTIONS \
     https://mods-api.idling.app/mods
```

### Test Auth Service CORS

```bash
curl -H "Origin: https://mods.idling.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://auth.idling.app/auth/request-otp
```

### Test Customer API CORS

```bash
curl -H "Origin: https://auth.idling.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Authorization" \
     -X OPTIONS \
     https://customer.idling.app/customer/me
```

---

## 📋 Critical Origins (Must Include)

- ✅ `https://mods.idling.app` - Frontend (Mods Hub)
- ✅ `https://auth.idling.app` - Auth service (dashboard)
- ✅ `http://localhost:3001` - Local development (Mods Hub)

---

**See [CORS_CONFIGURATION_GUIDE.md](./CORS_CONFIGURATION_GUIDE.md) for complete documentation.**

