# Context Summary - Mods Hub & Admin Management System

> **Critical architecture requirements and completed work summary**

**Date:** 2025-12-29

---

## Architecture Requirements (CRITICAL)

### OTP Auth + Customer Architecture
- **Email is ONLY for OTP authentication** - NEVER store or display email in application data
- **Data Binding System:**
  - `userId` (from OTP auth service) - used for ownership checks
  - `customerId` (from OTP auth service) - used for data scoping
  - `displayName` (from Customer Service/customer account) - used for UI display
- **Customer accounts** are created/ensured when OTP auth succeeds
- **Display names** come from Customer Service, not OTP auth email
- **Public user lookup:** `/auth/user/:userId` returns only `{ userId, displayName }` (no email)

### Data Storage Patterns
- **Mods stored by customerId:** `customer_{customerId}_mod_${modId}`
- **Global/public mods:** `mod_${modId}` (no customer prefix)
- **Versions stored in mod's customer scope:** `customer_{mod.customerId}_version_${versionId}`
- **Always use mod's customerId** (not auth customerId) when updating mods

---

## Completed Work

### 1. R2 Management System (Admin Only)
**Backend:**
- `serverless/mods-api/handlers/admin/r2-management.ts` - Complete handler with:
  - `handleListR2Files()` - List all R2 files with pagination
  - `handleDetectDuplicates()` - Detect duplicate and orphaned files
  - `handleDeleteR2File()` - Delete single or bulk files
- Routes in `serverless/mods-api/router/admin-routes.ts`:
  - `GET /admin/r2/files` - List files
  - `GET /admin/r2/duplicates` - Detect duplicates
  - `DELETE /admin/r2/files/:key` - Delete single file
  - `POST /admin/r2/files/delete` - Bulk delete

**Frontend:**
- `mods-hub/src/pages/R2ManagementPage.tsx` - Complete UI with:
  - Three tabs: Duplicates, Orphaned Files, All Files
  - Summary dashboard with statistics
  - Bulk selection and deletion
  - File listing with metadata
- API functions in `mods-hub/src/services/api.ts`:
  - `listR2Files()`, `detectDuplicates()`, `deleteR2File()`, `bulkDeleteR2Files()`
- Route added: `/admin/r2` (admin-protected)
- Navigation link in `AdminPanel` header

### 2. Download Authorization Fix
- Changed from `<a href>` to authenticated `fetch()` with JWT token
- `downloadVersion()` function in `mods-hub/src/services/api.ts`:
  - Gets JWT token from auth store
  - Uses `fetch()` with `Authorization: Bearer <token>` header
  - Creates blob URL and triggers download
  - Handles 401 errors properly
- Updated components:
  - `ModVersionList.tsx` - Uses button with `onClick` handler
  - `ModDetailPage.tsx` - Same pattern with loading states

### 3. Confirmation Modal Text Wrapping
- Fixed in `mods-hub/src/components/common/ConfirmationModal.tsx`:
  - Added `word-wrap: break-word`, `overflow-wrap: break-word`, `word-break: break-word`
  - Added `white-space: pre-wrap` for `ConfirmationText`
  - Increased modal `max-width` to 600px
  - Added `max-height: 90vh` and `overflow-y: auto`

### 4. Badge/Thumbnail 404 Fixes
- Updated `serverless/mods-api/handlers/versions/badge.ts`:
  - Allow badges for `published`/`approved` mods to everyone
  - Allow badges for `pending`/other statuses to author or admin
- Updated `serverless/mods-api/handlers/mods/thumbnail.ts`:
  - Same status filtering logic as badge handler

### 5. Email Architecture Compliance (COMPLETE)
**Removed email from:**
- `ModMetadata` type (backend & frontend) - removed `authorEmail`
- `ModRating` type (backend & frontend) - removed `userEmail`
- `ModReviewComment` type (backend & frontend) - removed `authorEmail`
- `ModStatusHistory` type (backend & frontend) - removed `changedByEmail`
- All handlers now fetch and store `displayName` only
- Export utilities - CSV uses "Author Display Name" instead of email
- Search utilities - removed email from search fields
- OG image generation - displays `authorDisplayName` instead of email

**Display name fetching:**
- Upload handler: Fetches from `/auth/me` (decrypts if encrypted)
- List handler: Uses `fetchDisplayNamesByUserIds()` for batch lookup
- Detail handler: Uses `fetchDisplayNameByUserId()` for single lookup
- Triage handler: Fetches displayName for comments and status history

---

## Current Codebase Patterns

### Shared API Framework Usage
- **Backend:** Uses `createCORSHeaders`, `createError`, `wrapWithEncryption` from `@strixun/api-framework`
- **Frontend:** Uses `createAPIClient` from `@strixun/api-framework/client`
- **Encryption:** Automatic via `wrapWithEncryption()` in routes
- **Decryption:** Automatic via API client when `X-Encrypted: true` header present

### Admin Routes Pattern
- All admin routes in `serverless/mods-api/router/admin-routes.ts`
- Require super-admin authentication via `isSuperAdminEmail()`
- Wrap responses with `wrapWithEncryption(response, auth)`
- Pattern: Check auth [EMOJI] verify admin [EMOJI] resolve slug if needed [EMOJI] call handler [EMOJI] wrap response

### Virtualized Table Component
- Located in: `shared-components/virtualized-table/VirtualizedTable`
- Used in: `AdminPanel.tsx` for mod triage
- Features: Virtualization, sorting, selection, filtering
- Pattern: Define columns with `render` functions, use `VirtualizedTable` component

### Advanced Search Component
- Located in: `shared-components/search-query-parser/AdvancedSearchInput`
- Used in: `AdminPanel.tsx`
- Features: Human-friendly query parser (quotes, AND, OR, wildcards)
- Pattern: `filterModsBySearchQuery()` utility function

---

## Pending/New Task: User Management System

### Requirement
Add comprehensive user management system to existing admin dashboard:
- **Location:** Extend `mods-hub/src/pages/AdminPanel.tsx` or create new `UserManagementPage.tsx`
- **Access:** Super-admin only
- **Requirements:**
  1. Use shared virtualization list component (same as mod triage)
  2. Keep it very efficient for large datasets
  3. Include useful functions and utilities
  4. Use epic filter search (AdvancedSearchInput)
  5. Allow super admins to manage EVERYTHING user-related

### User Management Features Needed
- List all users (from OTP auth service)
- Search/filter users (by userId, displayName, customerId, etc.)
- View user details (userId, displayName, customerId, created date, last login, etc.)
- Manage user permissions (upload permissions, admin status, etc.)
- View user's mods/activity
- Potentially: Reset passwords, disable accounts, etc.

### Technical Requirements
- **Component:** Use `VirtualizedTable` from shared components
- **Search:** Use `AdvancedSearchInput` with query parser
- **API:** Create admin-protected endpoints in `serverless/mods-api/router/admin-routes.ts`
- **Handlers:** Create `serverless/mods-api/handlers/admin/users.ts`
- **Efficiency:** Virtualization, pagination, lazy loading for large datasets
- **Architecture:** Follow existing patterns (CORS, encryption, error handling)

### API Endpoints Needed
- `GET /admin/users` - List all users (with pagination, filtering, search)
- `GET /admin/users/:userId` - Get user details
- `PUT /admin/users/:userId` - Update user (permissions, status, etc.)
- `GET /admin/users/:userId/mods` - Get user's mods
- `GET /admin/users/:userId/activity` - Get user activity/logs

### Data Sources
- **OTP Auth Service:** User accounts, userId, email (internal only)
- **Customer Service:** customerId, displayName
- **Mods API:** User's mods, upload permissions
- **Need to aggregate:** Combine data from multiple services

---

## Key Files Reference

### Backend
- `serverless/mods-api/router/admin-routes.ts` - Admin route definitions
- `serverless/mods-api/handlers/admin/` - Admin handlers directory
- `serverless/mods-api/utils/displayName.ts` - Display name fetching utility
- `serverless/mods-api/utils/admin.ts` - Admin utilities (isSuperAdminEmail)
- `serverless/otp-auth-service/handlers/auth/user-lookup.ts` - Public user lookup

### Frontend
- `mods-hub/src/pages/AdminPanel.tsx` - Existing admin panel (mod triage)
- `mods-hub/src/pages/R2ManagementPage.tsx` - R2 management page
- `mods-hub/src/components/common/ConfirmationModal.tsx` - Reusable confirmation modal
- `mods-hub/src/services/api.ts` - API client functions
- `mods-hub/src/types/mod.ts` - Type definitions

### Shared Components
- `shared-components/virtualized-table/VirtualizedTable` - Virtualized table component
- `shared-components/search-query-parser/AdvancedSearchInput` - Advanced search input

---

## Critical Rules

1. **NEVER store or display email** - Only use for OTP authentication
2. **Always use customerId for data scoping** - Not auth customerId when updating mods
3. **Use shared API framework** - Don't create custom HTTP clients
4. **Encryption is automatic** - Use `wrapWithEncryption()` in routes
5. **Virtualization for large lists** - Use `VirtualizedTable` component
6. **Advanced search** - Use `AdvancedSearchInput` with query parser
7. **TypeScript only** - No `.js` files (except config files)
8. **No nested BEM in Svelte** - Use explicit descendant selectors
9. **CSS variables** - Use `var(--color-name)` not hardcoded colors
10. **Portal rendering** - Tooltips/modals must render at body level

---

## Next Steps

1. Create user management API endpoints in `serverless/mods-api/handlers/admin/users.ts`
2. Add routes to `serverless/mods-api/router/admin-routes.ts`
3. Create API client functions in `mods-hub/src/services/api.ts`
4. Create `UserManagementPage.tsx` or extend `AdminPanel.tsx` with tabs
5. Use `VirtualizedTable` for efficient user listing
6. Use `AdvancedSearchInput` for user search/filtering
7. Aggregate data from OTP auth service and Customer Service
8. Implement user management actions (permissions, status, etc.)

---

**Last Updated**: 2025-12-29

