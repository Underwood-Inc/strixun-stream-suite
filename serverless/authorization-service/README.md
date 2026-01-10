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
GET /authz/:customerId

# Get permissions only
GET /authz/:customerId/permissions

# Get roles only
GET /authz/:customerId/roles

# Get quotas only
GET /authz/:customerId/quotas

# Check permission
POST /authz/check-permission
{
  "customerId": "cust_123",
  "permission": "upload:mod"
}

# Check quota
POST /authz/check-quota
{
  "customerId": "cust_123",
  "resource": "upload:mod",
  "amount": 1
}
```

### Management Endpoints (Admin-Only)

```bash
# Assign roles
PUT /authz/:customerId/roles
{
  "roles": ["uploader", "premium"],
  "reason": "Customer upgraded"
}

# Grant permissions
PUT /authz/:customerId/permissions
{
  "permissions": ["upload:mod", "edit:mod-own"],
  "reason": "Manual permission grant"
}

# Set quotas
PUT /authz/:customerId/quotas
{
  "quotas": {
    "upload:mod": { "limit": 50, "period": "day" }
  },
  "reason": "Increased quota for premium user"
}

# Reset quotas
POST /authz/:customerId/quotas/reset
{
  "resources": ["upload:mod"],
  "reason": "Monthly reset"
}

# Increment quota (called by services)
POST /authz/:customerId/quotas/increment
{
  "resource": "upload:mod",
  "amount": 1
}
```

### Role & Permission Definitions

```bash
# List all roles
GET /authz/roles

# Get specific role
GET /authz/roles/:roleName

# Create/update role
PUT /authz/roles/:roleName
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
GET /authz/permissions
```

### Audit Log

```bash
# Get audit log
GET /authz/:customerId/audit-log?limit=100
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

### 4. Seed Default Roles/Permissions

```bash
# First time seed (one-time only)
curl -X POST https://strixun-authorization-service.strixuns-script-suite.workers.dev/authz/seed
```

### 5. Run Migrations

Migrations update role definitions and fix issues without re-seeding everything.

```bash
# Check migration status
curl https://strixun-authorization-service.strixuns-script-suite.workers.dev/authz/migrations/status

# Run pending migrations
curl -X POST https://strixun-authorization-service.strixuns-script-suite.workers.dev/authz/migrate
```

**Important:** After deploying code changes that include new migrations, always run migrations in production!

### 5. Run Migration (Optional)

If migrating from existing permission system:

```bash
curl -X POST https://strixun-authorization-service.strixuns-script-suite.workers.dev/migrate
```

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
const response = await fetch('https://strixun-authorization-service.strixuns-script-suite.workers.dev/authz/check-permission', {
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
const response = await fetch('https://strixun-authorization-service.strixuns-script-suite.workers.dev/authz/check-quota', {
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
await fetch(`https://strixun-authorization-service.strixuns-script-suite.workers.dev/authz/cust_123/quotas/increment`, {
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
await fetch(`https://strixun-authorization-service.strixuns-script-suite.workers.dev/authz/cust_123/roles`, {
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
