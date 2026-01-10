# Authorization Service - Quick Start Guide

## ⚡ **Correct Wrangler Commands**

### 1. Create KV Namespace (Production Only)

```bash
# Navigate to authorization service directory
cd serverless/authorization-service

# Create production KV namespace
wrangler kv namespace create AUTHORIZATION_KV
```

**Output Example:**
```
🌀 Creating namespace with title "strixun-authorization-service-AUTHORIZATION_KV"
✨ Success!
Add the following to your wrangler.toml:
[[kv_namespaces]]
binding = "AUTHORIZATION_KV"
id = "abcd1234efgh5678"
```

**Update `wrangler.toml` line 23:**
- Copy production ID: `id = "abcd1234efgh5678"`

**Note:** Development uses the same KV namespace for local testing (already configured)

---

### 2. Install Dependencies

```bash
pnpm install
```

---

### 3. Set Secrets

```bash
# JWT secret (must match OTP auth service)
wrangler secret put JWT_SECRET
# Enter value when prompted

# Super admin API key (for admin operations)
wrangler secret put SUPER_ADMIN_API_KEY
# Enter value when prompted

# CORS origins (optional, recommended for production)
wrangler secret put ALLOWED_ORIGINS
# Enter: https://mods.idling.app,https://admin.idling.app
```

---

### 4. Deploy

```bash
# Deploy to production
pnpm run deploy

# OR deploy to development
pnpm run deploy:dev
```

---

### 5. Seed Default Roles & Permissions

```bash
# After deployment, seed defaults (use workers.dev URL)
curl -X POST https://access.idling.app/access/seed

# OR for local development
curl -X POST http://localhost:8791/access/seed
```

**Expected Response:**
```json
{
  "message": "Default roles and permissions seeded successfully",
  "seeded": true,
  "rolesCount": 7,
  "permissionsCount": 10
}
```

---

### 6. Verify Deployment

```bash
# Health check (PowerShell)
Invoke-RestMethod -Uri "https://access.idling.app/health"

# List roles (PowerShell)
Invoke-RestMethod -Uri "https://access.idling.app/access/roles"

# List permissions (PowerShell)
Invoke-RestMethod -Uri "https://access.idling.app/access/permissions"
```

---

## 🚨 **Common Mistakes**

### ❌ WRONG (Old Syntax)
```bash
# DO NOT USE - Old wrangler v1/v2 syntax
wrangler kv:namespace create "AUTHORIZATION_KV"
wrangler kv:namespace create AUTHORIZATION_KV
```

### ✅ CORRECT (Current Syntax)
```bash
# USE THIS - Wrangler v3 syntax
wrangler kv namespace create AUTHORIZATION_KV
wrangler kv namespace create AUTHORIZATION_KV --preview
```

---

## 📋 **Full Deployment Checklist**

### Local Development:
- [ ] Navigate to `serverless/authorization-service`
- [ ] `.dev.vars` file already exists (gitignored, shared secrets)
- [ ] Run `pnpm install`
- [ ] Run `pnpm run dev` (starts on port 8791)
- [ ] Test: `Invoke-RestMethod -Uri "http://localhost:8791/health"`
- [ ] Seed: `Invoke-RestMethod -Method Post -Uri "http://localhost:8791/access/seed"`

### Production Deployment:
- [ ] Navigate to `serverless/authorization-service`
- [ ] Run `wrangler kv namespace create AUTHORIZATION_KV`
- [ ] Update `wrangler.toml` line 23 with production KV ID
- [ ] Run `pnpm install`
- [ ] Run `wrangler secret put JWT_SECRET`
- [ ] Run `wrangler secret put SUPER_ADMIN_API_KEY`
- [ ] Run `wrangler secret put ALLOWED_ORIGINS`
- [ ] Run `pnpm run deploy`
- [ ] Run `curl -X POST https://access.idling.app/access/seed`
- [ ] Run `curl https://access.idling.app/health` (verify working)
- [ ] Run `curl https://access.idling.app/access/roles` (verify seeded)

---

## 🧪 **Local Development**

```bash
# Start local dev server (automatically uses .dev.vars)
cd serverless/authorization-service
pnpm run dev
# Server runs on http://localhost:8791

# In another terminal, test endpoints (PowerShell)
Invoke-RestMethod -Uri "http://localhost:8791/health"
Invoke-RestMethod -Uri "http://localhost:8791/access/roles"

# Seed defaults locally (PowerShell)
Invoke-RestMethod -Method Post -Uri "http://localhost:8791/access/seed"
```

**What is "access"?**
"access" = the Access Service handles authorization (roles, permissions, quotas)
- It's available at access.idling.app
- It's just the service name / URL path prefix

**Local Dev Ports:**
- OTP Auth: `http://localhost:8787`
- Mods API: `http://localhost:8788`
- Twitch API: `http://localhost:8789`
- Customer API: `http://localhost:8790`
- **Authorization**: `http://localhost:8791` ← NEW
- URL Shortener: `http://localhost:8793`

**Note:** `.dev.vars` file is gitignored and contains shared secrets for local development. All secrets are auto-configured for local testing.

---

## 📚 **Next Steps**

After deployment:
1. Run migration script to migrate existing permissions
2. Update mods-api to use authorization service
3. Update admin UI with role management
4. Test permission checks in production

See full documentation: `README.md`
