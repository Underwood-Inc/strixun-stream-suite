# Authorization Service

**Service-agnostic authorization system for Strixun platform.**

## Overview

The Authorization Service handles:
- ✓ Roles & permissions management
- ✓ Access control decisions
- ✓ Quota enforcement
- ✓ Audit logging

**What it does NOT do:**
- ✗ Authentication (handled by OTP Auth Service)
- ✗ Store customer data (handled by Customer Service)
- ✗ Business logic (service-agnostic)

## Architecture

### Service Boundaries
```
┌─────────────────────────────┐
│  Authorization Service       │
│  ─────────────────────────  │
│  • Roles & permissions      │
│  • Quota enforcement        │
│  • Authorization decisions  │
│  • Service-agnostic         │
└─────────────────────────────┘
```

### Data Model

**Customer Authorization:**
```typescript
{
  customerId: "cust_123",
  roles: ["uploader", "premium"],
  permissions: ["upload:mod", "edit:mod-own"],
  quotas: {
    "upload:mod": {
      limit: 50,
      period: "day",
      current: 12,
      resetAt: "2026-01-10T00:00:00Z"
    }
  }
}
```

**Role Definition:**
```typescript
{
  name: "uploader",
  displayName: "Uploader",
  permissions: ["upload:mod", "edit:mod-own"],
  defaultQuotas: {
    "upload:mod": { limit: 10, period: "day" }
  },
  priority: 100
}
```

## API Reference

### Read-Only Endpoints (Any Service)

```bash
# Get full authorization data
GET /access/:customerId

# Get permissions only
GET /access/:customerId/permissions

# Get roles only
GET /access/:customerId/roles

# Get quotas only
GET /access/:customerId/quotas

# Check permission
POST /access/check-permission
{
  "customerId": "cust_123",
  "permission": "upload:mod"
}

# Check quota
POST /access/check-quota
{
  "customerId": "cust_123",
  "resource": "upload:mod",
  "amount": 1
}
```

### Management Endpoints (Admin-Only)

```bash
# Assign roles
PUT /access/:customerId/roles
{
  "roles": ["uploader", "premium"],
  "reason": "Customer upgraded"
}

# Grant permissions
PUT /access/:customerId/permissions
{
  "permissions": ["upload:mod", "edit:mod-own"],
  "reason": "Manual permission grant"
}

# Set quotas
PUT /access/:customerId/quotas
{
  "quotas": {
    "upload:mod": { "limit": 50, "period": "day" }
  },
  "reason": "Increased quota for premium user"
}

# Reset quotas
POST /access/:customerId/quotas/reset
{
  "resources": ["upload:mod"],
  "reason": "Monthly reset"
}

# Increment quota (called by services)
POST /access/:customerId/quotas/increment
{
  "resource": "upload:mod",
  "amount": 1
}
```

### Role & Permission Definitions

```bash
# List all roles
GET /access/roles

# Get specific role
GET /access/roles/:roleName

# Create/update role
PUT /access/roles/:roleName
{
  "displayName": "Uploader",
  "description": "Can upload mods",
  "permissions": ["upload:mod"],
  "defaultQuotas": {
    "upload:mod": { "limit": 10, "period": "day" }
  },
  "priority": 100
}

# List all permissions
GET /access/permissions
```

### Audit Log

```bash
# Get audit log
GET /access/:customerId/audit-log?limit=100
```

## Setup

### 1. Create KV Namespace

```bash
# Production
wrangler kv namespace create AUTHORIZATION_KV

# Development/Preview
wrangler kv namespace create AUTHORIZATION_KV --preview
```

**Copy the namespace IDs from output and update `wrangler.toml`:**
- Production ID → line 18: `id = "YOUR_PRODUCTION_ID"`
- Preview ID → env.development section: `id = "YOUR_PREVIEW_ID"`

### 2. Set Secrets

```bash
wrangler secret put JWT_SECRET
wrangler secret put SUPER_ADMIN_API_KEY
wrangler secret put ALLOWED_ORIGINS
```

### 3. Deploy

```bash
# Development
pnpm run deploy:dev

# Production
pnpm run deploy
```

### 4. ~~Seed Defaults~~ (AUTOMATIC)

**No manual seeding required!** The service automatically seeds defaults on first request.

### 5. ~~Run Migrations~~ (AUTOMATIC)

**No manual migrations required!** The service automatically runs pending migrations on first request after deploy.

## Default Roles

- **super-admin**: Full system access (all permissions)
- **admin**: Admin dashboard + customer management
- **moderator**: Mod approval and editing
- **uploader**: Upload and manage own mods (10/day quota)
- **premium**: Enhanced upload quotas (50/day, 50GB storage)
- **customer**: Basic access
- **banned**: No permissions

## Default Permissions

### Mod Management
- `upload:mod` - Upload mods
- `edit:mod-own` - Edit own mods
- `edit:mod-any` - Edit any mod
- `delete:mod-own` - Delete own mods
- `delete:mod-any` - Delete any mod
- `approve:mod` - Approve/deny mod submissions

### Admin
- `access:admin-panel` - Access admin dashboard
- `manage:customers` - Manage customer accounts
- `manage:roles` - Assign/remove roles

### Analytics
- `view:analytics` - View system analytics

### API
- `api:unlimited` - No API rate limits

## Usage Examples

### Check Permission (Mods Service)

```typescript
// In mods service handler
const response = await fetch('https://access.idling.app/access/check-permission', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerId: 'cust_123',
    permission: 'upload:mod'
  })
});

const result = await response.json();
if (!result.allowed) {
  return new Response('Forbidden', { status: 403 });
}
```

### Check Quota (Mods Service)

```typescript
// Before processing upload
const response = await fetch('https://access.idling.app/access/check-quota', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerId: 'cust_123',
    resource: 'upload:mod',
    amount: 1
  })
});

const result = await response.json();
if (!result.allowed) {
  return new Response('Quota exceeded', { status: 429 });
}

// ... process upload ...

// After successful upload, increment quota
await fetch(`https://access.idling.app/access/cust_123/quotas/increment`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    resource: 'upload:mod',
    amount: 1
  })
});
```

### Assign Role (Admin UI)

```typescript
// Admin assigns uploader role to customer
await fetch(`https://access.idling.app/access/cust_123/roles`, {
  method: 'PUT',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminJWT}`
  },
  body: JSON.stringify({
    roles: ['uploader'],
    reason: 'Approved by admin'
  })
});
```

## Development

```bash
# Install dependencies
pnpm install

# Run locally
pnpm run dev

# Run tests
pnpm test

# Type check
pnpm run typecheck

# Deploy
pnpm run deploy
```

## Monitoring

- Health check: `GET /health`
- Logs: `wrangler tail`
- Metrics: Cloudflare Dashboard

## Security

- All admin endpoints require authentication (super-admin)
- Audit log for all authorization changes
- Quotas prevent abuse
- Service-to-service calls use API keys

## Migration

See `scripts/migrate-permissions.ts` for migration from existing system.

**Note:** Email-based permissions must be manually mapped to customer IDs before migration.

## Support

See main architecture document: `__AUTHORIZATION_AND_PERMISSIONS_REDESIGN.md`
