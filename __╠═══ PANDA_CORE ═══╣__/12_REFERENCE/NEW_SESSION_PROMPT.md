# Prompt for New Chat Session - User Management System

```
I need to implement a comprehensive user management system for the admin dashboard in my mods hub application. Please read CONTEXT_SUMMARY.md first to understand the full context, architecture requirements, and existing patterns.

## Task: User Management System for Admin Dashboard

Add a full user management system to the existing admin dashboard that allows super admins to manage EVERYTHING user-related.

### Requirements:

1. **Location & Integration:**
   - Extend the existing `mods-hub/src/pages/AdminPanel.tsx` OR create a new `UserManagementPage.tsx`
   - Add navigation/tabs to access user management from admin panel
   - Super-admin only access (use existing `AdminRoute` component)

2. **UI Components (MUST USE):**
   - Use `VirtualizedTable` from `shared-components/virtualized-table/VirtualizedTable` (same as mod triage)
   - Use `AdvancedSearchInput` from `shared-components/search-query-parser/AdvancedSearchInput` for epic filter search
   - Follow the same patterns as `AdminPanel.tsx` (mod triage page)

3. **Efficiency Requirements:**
   - Must handle large datasets efficiently (virtualization)
   - Pagination for API calls
   - Lazy loading where appropriate
   - Useful functions and utilities for large data sets

4. **User Management Features:**
   - List all users (from OTP auth service + Customer Service)
   - Search/filter users (by userId, displayName, customerId, email hash, etc.)
   - View user details (userId, displayName, customerId, created date, last login, mod count, etc.)
   - Manage user permissions (upload permissions via existing `/admin/approvals` endpoints)
   - View user's mods/activity
   - Bulk actions (approve/revoke upload permissions, etc.)

5. **API Endpoints Needed:**
   Create admin-protected endpoints in `serverless/mods-api`:
   - `GET /admin/users` - List all users (with pagination, filtering, search)
   - `GET /admin/users/:userId` - Get user details
   - `PUT /admin/users/:userId` - Update user (permissions, status, etc.)
   - `GET /admin/users/:userId/mods` - Get user's mods
   - `GET /admin/users/:userId/activity` - Get user activity/logs (optional)

6. **Data Aggregation:**
   - Need to aggregate data from:
     - OTP Auth Service: User accounts, userId, email (internal only - never display)
     - Customer Service: customerId, displayName
     - Mods API: User's mods, upload permissions
   - Use existing `/auth/user/:userId` endpoint for public user lookup
   - May need to query OTP auth service directly for admin operations

7. **Architecture Compliance (CRITICAL):**
   - NEVER store or display email - email is ONLY for OTP authentication
   - Use `userId` for ownership checks
   - Use `customerId` for data scoping
   - Use `displayName` for UI display (from Customer Service)
   - Follow shared API framework patterns (createAPIClient, wrapWithEncryption, etc.)
   - Use TypeScript only (no .js files except configs)

8. **Code Patterns to Follow:**
   - Backend handlers: Use `createCORSHeaders`, `createError`, `wrapWithEncryption`
   - Frontend API: Use `createAPIClient` from `@strixun/api-framework/client`
   - Admin routes: Add to `serverless/mods-api/router/admin-routes.ts`
   - Admin handlers: Create in `serverless/mods-api/handlers/admin/users.ts`
   - Virtualized table: Same pattern as `AdminPanel.tsx` mod triage
   - Search: Use `filterModsBySearchQuery` pattern but for users

9. **Files to Create/Modify:**
   - `serverless/mods-api/handlers/admin/users.ts` - User management handlers
   - `serverless/mods-api/router/admin-routes.ts` - Add user management routes
   - `mods-hub/src/services/api.ts` - Add user management API functions
   - `mods-hub/src/pages/UserManagementPage.tsx` OR extend `AdminPanel.tsx`
   - `mods-hub/src/types/user.ts` - User type definitions (if needed)

10. **Reference Existing Code:**
    - Look at `mods-hub/src/pages/AdminPanel.tsx` for UI patterns
    - Look at `serverless/mods-api/handlers/admin/list.ts` for admin handler patterns
    - Look at `serverless/mods-api/handlers/admin/approvals.ts` for permission management
    - Look at `serverless/otp-auth-service/handlers/auth/user-lookup.ts` for user lookup patterns

Please implement this user management system following all the patterns, architecture requirements, and code quality standards outlined in CONTEXT_SUMMARY.md.
```





