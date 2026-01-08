# Upload Permissions System

**Last Updated:** 2025-01-XX

## Overview

The mods-api implements a two-tier upload permission system:

1. **Super Admins** - Full admin access + automatic upload permission (from `SUPER_ADMIN_EMAILS` env var)
2. **Approved Uploaders** - Regular users with explicit upload permission (managed via admin dashboard)

## Permission Levels

### Super Admins
- **Source:** `SUPER_ADMIN_EMAILS` environment variable (comma-separated list)
- **Access:** 
  - Full admin dashboard access
  - Automatic upload permission (no approval needed)
  - Can approve/revoke other users' upload permissions
  - Bypass upload quotas
- **Purpose:** Hardcoded backup list in case the admin dashboard UI is broken
- **Example:** `SUPER_ADMIN_EMAILS=admin@example.com,backup@example.com`

### Approved Uploaders
- **Source:** Stored in Cloudflare KV as `upload_approval_{customerId}`
- **Access:**
  - Upload and manage their own mods
  - Cannot access admin dashboard
  - Subject to upload quotas
- **Management:** Via admin dashboard UI at `/admin/customers` (super admin only)

## Permission Check Flow

```typescript
// 1. Check if user is super admin (from env var)
if (isSuperAdminEmail(email, env)) {
    return true; // Super admins always have permission
}

// 2. Check if user has explicit approval in KV
const approval = await env.MODS_KV.get(`upload_approval_${customerId}`);
return approval === 'approved';
```

## API Endpoints

### Admin Endpoints (Super Admin Only)

#### List Approved Uploaders
- **GET** `/admin/approvals`
- **Response:** `{ approvedUsers: string[] }` (array of userIds)

#### Approve User for Upload
- **POST** `/admin/approvals/:customerId`
- **Body:** `{ email?: string }` (optional, for metadata)
- **Response:** `{ success: true, customerId: string }`

#### Revoke User Upload Permission
- **DELETE** `/admin/approvals/:customerId`
- **Response:** `{ success: true, customerId: string }`

#### Update User (includes upload permission)
- **PUT** `/admin/customers/:customerId`
- **Body:** `{ hasUploadPermission: boolean }`
- **Response:** `{ success: true, customerId: string }`

### User Endpoints (authenticated customers)

#### Check Own Upload Permission
- **GET** `/mods/permissions/me`
- **Response:** `{ hasPermission: boolean, isSuperAdmin: boolean, customerId: string }`

## Admin Dashboard UI

The admin dashboard at `/admin/customers` provides:

- **User List:** Virtualized table showing all users
- **Permission Status:** Visual badges showing approved/not approved
- **Individual Actions:** Approve/Revoke buttons per user
- **Bulk Actions:** Approve/Revoke multiple users at once
- **Search & Filter:** Advanced search with query parser
- **Statistics:** Total users, approved uploaders, mod counts

## Storage Structure

### KV Keys

```
upload_approval_{customerId}          # Value: "approved" (with metadata)
approved_uploaders                # Value: JSON array of userIds
```

### Metadata

When approving a user, metadata is stored:
```json
{
  "approvedAt": "2025-01-XXT...",
  "email": "user@example.com"
}
```

## Environment Variables

### Required for Local Development

```bash
# .dev.vars

# Super Admin Emails (full admin access + upload permission)
SUPER_ADMIN_EMAILS=m.seaward@pm.me

# Approved Uploader Emails (upload permission ONLY, NO admin access)
# This is a hardcoded backup list in case the admin dashboard UI is broken
APPROVED_UPLOADER_EMAILS=user1@example.com,user2@example.com
```

### Production

Set via Cloudflare Workers dashboard:
- Navigate to Workers & Pages → mods-api → Settings → Variables
- Add `SUPER_ADMIN_EMAILS` with comma-separated email list (for admin access)
- Add `APPROVED_UPLOADER_EMAILS` with comma-separated email list (for upload permission only, no admin access)

## Security Notes

1. **Three-Tier System:** 
   - `SUPER_ADMIN_EMAILS` grants full admin access + upload permission
   - `APPROVED_UPLOADER_EMAILS` grants upload permission ONLY (NO admin access)
   - KV-stored approvals grant upload permission ONLY (NO admin access)

2. **Approved Uploader List is Backup:** The `APPROVED_UPLOADER_EMAILS` env var serves as a hardcoded backup in case the admin dashboard UI is broken or inaccessible. These users get upload permission but NOT admin access.

3. **Permission Checks:** All upload endpoints check `hasUploadPermission()` which verifies:
   - Super admin status (from `SUPER_ADMIN_EMAILS`)
   - Approved uploader status (from `APPROVED_UPLOADER_EMAILS`)
   - KV-stored approval

4. **Admin Routes:** All admin routes are protected by `protectAdminRoute()` which requires super admin authentication (checks `SUPER_ADMIN_EMAILS` only, NOT `APPROVED_UPLOADER_EMAILS`).

5. **No Email Exposure:** User emails are never returned in API responses (privacy protection).

## Troubleshooting

### User Can't Upload
1. Check if email is in `SUPER_ADMIN_EMAILS` (grants admin + upload)
2. Check if email is in `APPROVED_UPLOADER_EMAILS` (grants upload only)
3. Check KV for `upload_approval_{customerId}` key
4. Verify user is authenticated (JWT token valid)
5. Check admin dashboard to see permission status

### User Has Upload Permission But Can't Access Admin Dashboard
- This is expected! Only users in `SUPER_ADMIN_EMAILS` can access admin dashboard
- Users in `APPROVED_UPLOADER_EMAILS` or KV approvals have upload permission ONLY
- To grant admin access, add email to `SUPER_ADMIN_EMAILS` (not `APPROVED_UPLOADER_EMAILS`)

### Admin Dashboard Not Working
- Use `SUPER_ADMIN_EMAILS` env var as backup for admin access
- Use `APPROVED_UPLOADER_EMAILS` env var as backup for upload permissions (no admin access)
- Can manually set KV keys: `upload_approval_{customerId} = "approved"`
- Can use API endpoints directly with super admin authentication
