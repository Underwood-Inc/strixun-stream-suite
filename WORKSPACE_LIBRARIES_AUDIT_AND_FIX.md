# Workspace Libraries Audit and Fix - Work Tracking Document

**Created:** 2025-01-XX  
**Status:** IN PROGRESS  
**Last Updated:** 2025-01-XX

---

## Overview

This document tracks the complete audit and fix of all workspace library dependencies and imports across the entire codebase. The goal is to ensure:
1. All workspace libraries are properly configured
2. All projects have correct workspace dependencies declared
3. All imports use workspace package names (not relative paths)

---

## Phase 1: Workspace Library Inventory

### ✅ Confirmed Workspace Libraries

| Library Name | Location | Package.json | Status |
|-------------|----------|--------------|--------|
| `@strixun/api-framework` | `serverless/shared/api` | ✅ Exists | ✅ Configured |
| `@strixun/types` | `serverless/shared/types` | ✅ Exists | ✅ Configured |
| `@strixun/service-client` | `serverless/shared/service-client` | ✅ Exists | ✅ Configured |
| `@strixun/e2e-helpers` | `serverless/shared/e2e` | ✅ Exists | ✅ Configured |
| `@strixun/otp-auth-service` | `serverless/otp-auth-service` | ✅ Exists | ✅ Configured |
| `@strixun/mods-hub` | `mods-hub` | ✅ Exists | ✅ Configured |
| `@strixun/control-panel` | `control-panel` | ✅ Exists | ⚠️ Needs audit |
| `@strixun/shared-components` | `shared-components` | ✅ Exists | ✅ Configured |
| `@strixun/otp-login` | `shared-components/otp-login` | ✅ Exists | ✅ Configured |
| `@strixun/search-query-parser` | `shared-components/search-query-parser` | ✅ Exists | ✅ Configured |
| `@strixun/virtualized-table` | `shared-components/virtualized-table` | ✅ Exists | ✅ Configured |
| `@strixun/status-flair` | `shared-components/status-flair` | ✅ Exists | ✅ Configured |
| `@strixun/error-mapping` | `shared-components/error-mapping` | ✅ Exists | ✅ Configured |
| `@strixun/ad-carousel` | `shared-components/ad-carousel` | ✅ Exists | ✅ Configured |
| `@strixun/tooltip` | `shared-components/tooltip` | ✅ Exists | ✅ Configured |
| `@strixun/idle-game-overlay` | `shared-components/idle-game-overlay` | ✅ Exists | ✅ Configured |
| `@strixun/rate-limit-info` | `shared-components/rate-limit-info` | ✅ Exists | ✅ Configured |
| `@strixun/url-shortener-app` | `serverless/url-shortener/app` | ✅ Exists | ⚠️ Needs audit |

---

## Phase 2: Project Dependency Audit

### Serverless Workers

#### `serverless/mods-api`
- **Current Dependencies:**
  - ✅ `@strixun/api-framework: workspace:*`
  - ✅ `@strixun/otp-auth-service: workspace:*`
  - ✅ `@strixun/service-client: workspace:*`
  - ✅ `@strixun/types: workspace:*`
- **Missing Dependencies:**
  - ❌ `@strixun/e2e-helpers: workspace:*` (has health.e2e.spec.ts)
- **Status:** ⚠️ Needs e2e-helpers dependency

#### `serverless/otp-auth-service`
- **Current Dependencies:**
  - ✅ `@strixun/api-framework: workspace:*`
  - ✅ `@strixun/service-client: workspace:*`
  - ✅ `@strixun/types: workspace:*`
- **Missing Dependencies:**
  - ❌ `@strixun/e2e-helpers: workspace:*` (has health.e2e.spec.ts)
- **Status:** ⚠️ Needs e2e-helpers dependency

#### `serverless/customer-api`
- **Current Dependencies:**
  - ✅ `@strixun/api-framework: workspace:*`
  - ✅ `@strixun/types: workspace:*`
- **Missing Dependencies:**
  - ❌ `@strixun/e2e-helpers: workspace:*` (has health.e2e.spec.ts)
- **Status:** ⚠️ Needs e2e-helpers dependency

#### `serverless/twitch-api`
- **Current Dependencies:**
  - ✅ `@strixun/api-framework: workspace:*`
  - ✅ `@strixun/types: workspace:*`
- **Missing Dependencies:**
  - ❌ `@strixun/e2e-helpers: workspace:*` (has health.e2e.spec.ts)
- **Status:** ⚠️ Needs e2e-helpers dependency

#### `serverless/game-api`
- **Current Dependencies:**
  - ✅ `@strixun/api-framework: workspace:*`
  - ✅ `@strixun/types: workspace:*`
- **Missing Dependencies:**
  - ❌ `@strixun/e2e-helpers: workspace:*` (has health.e2e.spec.ts)
- **Status:** ⚠️ Needs e2e-helpers dependency

#### `serverless/chat-signaling`
- **Current Dependencies:**
  - ✅ `@strixun/api-framework: workspace:*`
  - ✅ `@strixun/types: workspace:*`
- **Missing Dependencies:**
  - ❌ `@strixun/e2e-helpers: workspace:*` (has health.e2e.spec.ts)
- **Status:** ⚠️ Needs e2e-helpers dependency

#### `serverless/url-shortener`
- **Current Dependencies:**
  - ✅ `@strixun/api-framework: workspace:*`
  - ✅ `@strixun/types: workspace:*`
- **Missing Dependencies:**
  - ❌ `@strixun/e2e-helpers: workspace:*` (has health.e2e.spec.ts)
- **Status:** ⚠️ Needs e2e-helpers dependency

### Frontend Applications

#### `mods-hub`
- **Current Dependencies:**
  - ✅ `@strixun/api-framework: workspace:*`
  - ✅ `@strixun/search-query-parser: workspace:*`
  - ✅ `@strixun/virtualized-table: workspace:*`
  - ✅ `@strixun/e2e-helpers: workspace:*`
- **Status:** ✅ Complete

#### `control-panel`
- **Current Dependencies:**
  - ❌ None declared
- **Needs Audit:** Check for imports from workspace libraries
- **Status:** ⚠️ Needs audit

#### Root `src/` (Main App)
- **Current Dependencies:**
  - ✅ `@strixun/status-flair: workspace:*`
  - ✅ `@strixun/search-query-parser: workspace:*`
  - ✅ `@strixun/ad-carousel: workspace:*`
  - ✅ `@strixun/error-mapping: workspace:*`
  - ✅ `@strixun/otp-login: workspace:*`
  - ✅ `@strixun/e2e-helpers: workspace:*`
- **Status:** ✅ Complete

### Sub-Applications

#### `serverless/url-shortener/app`
- **Current Dependencies:**
  - ❌ None declared
- **Needs Audit:** Check for imports from workspace libraries
- **Status:** ⚠️ Needs audit

#### `serverless/otp-auth-service/dashboard`
- **Current Dependencies:**
  - ❌ None declared
- **Needs Audit:** Check for imports from workspace libraries
- **Status:** ⚠️ Needs audit

---

## Phase 3: Import Audit

### Direct Imports to Fix (Relative Paths to Workspace Libraries)

#### E2E Test Files
- [ ] `mods-hub/src/pages/mod-detail.e2e.spec.ts` - ✅ FIXED
- [ ] `mods-hub/src/pages/mod-list.e2e.spec.ts` - ✅ FIXED
- [ ] `mods-hub/src/pages/mod-upload.e2e.spec.ts` - ✅ FIXED
- [ ] `mods-hub/src/pages/login.e2e.spec.ts` - ✅ FIXED
- [ ] `src/pages/auth.e2e.spec.ts` - ✅ FIXED
- [ ] `serverless/mods-api/health.e2e.spec.ts` - ⚠️ PENDING (uses @playwright/test directly)
- [ ] `serverless/otp-auth-service/health.e2e.spec.ts` - ⚠️ PENDING (uses @playwright/test directly)
- [ ] `serverless/customer-api/health.e2e.spec.ts` - ⚠️ PENDING (uses @playwright/test directly)
- [ ] `serverless/twitch-api/health.e2e.spec.ts` - ⚠️ PENDING (uses @playwright/test directly)
- [ ] `serverless/game-api/health.e2e.spec.ts` - ⚠️ PENDING (uses @playwright/test directly)
- [ ] `serverless/chat-signaling/health.e2e.spec.ts` - ⚠️ PENDING (uses @playwright/test directly)
- [ ] `serverless/url-shortener/health.e2e.spec.ts` - ⚠️ PENDING (uses @playwright/test directly)

#### Encryption Imports
- [ ] `src/core/api/enhanced/encryption/jwt-encryption.ts` - ✅ FIXED

#### API Framework Imports
- [ ] TBD - Need to search for relative imports to `serverless/shared/api`

#### Types Imports
- [ ] TBD - Need to search for relative imports to `serverless/shared/types`

#### Service Client Imports
- [ ] TBD - Need to search for relative imports to `serverless/shared/service-client`

#### Shared Components Imports
- [ ] TBD - Need to search for relative imports to `shared-components/*`

---

## Phase 4: Work Progress

### Step 1: Add Missing Dependencies
- [ ] Add `@strixun/e2e-helpers` to `serverless/mods-api/package.json`
- [ ] Add `@strixun/e2e-helpers` to `serverless/otp-auth-service/package.json`
- [ ] Add `@strixun/e2e-helpers` to `serverless/customer-api/package.json`
- [ ] Add `@strixun/e2e-helpers` to `serverless/twitch-api/package.json`
- [ ] Add `@strixun/e2e-helpers` to `serverless/game-api/package.json`
- [ ] Add `@strixun/e2e-helpers` to `serverless/chat-signaling/package.json`
- [ ] Add `@strixun/e2e-helpers` to `serverless/url-shortener/package.json`
- [ ] Audit `control-panel` for needed dependencies
- [ ] Audit `serverless/url-shortener/app` for needed dependencies
- [ ] Audit `serverless/otp-auth-service/dashboard` for needed dependencies

### Step 2: Comprehensive Import Search
- [ ] Search for all imports from `serverless/shared/api` (relative paths)
- [ ] Search for all imports from `serverless/shared/types` (relative paths)
- [ ] Search for all imports from `serverless/shared/service-client` (relative paths)
- [ ] Search for all imports from `serverless/shared/e2e` (relative paths)
- [ ] Search for all imports from `serverless/shared/encryption` (relative paths)
- [ ] Search for all imports from `shared-components/*` (relative paths)
- [ ] Search for all imports from `serverless/otp-auth-service` (relative paths)

### Step 3: Fix All Imports
- [ ] Replace relative imports with workspace package names
- [ ] Verify all imports compile correctly
- [ ] Run linter to check for errors

### Step 4: Verification
- [ ] Run `pnpm install` to verify all dependencies resolve
- [ ] Run build for each project to verify no import errors
- [ ] Run tests to verify functionality

---

## Phase 5: Files Changed Log

### Dependencies Added
- [ ] `serverless/mods-api/package.json` - Added `@strixun/e2e-helpers`
- [ ] `serverless/otp-auth-service/package.json` - Added `@strixun/e2e-helpers`
- [ ] `serverless/customer-api/package.json` - Added `@strixun/e2e-helpers`
- [ ] `serverless/twitch-api/package.json` - Added `@strixun/e2e-helpers`
- [ ] `serverless/game-api/package.json` - Added `@strixun/e2e-helpers`
- [ ] `serverless/chat-signaling/package.json` - Added `@strixun/e2e-helpers`
- [ ] `serverless/url-shortener/package.json` - Added `@strixun/e2e-helpers`

### Imports Fixed
- [x] `mods-hub/src/pages/mod-detail.e2e.spec.ts` - Changed to `@strixun/e2e-helpers`
- [x] `mods-hub/src/pages/mod-list.e2e.spec.ts` - Changed to `@strixun/e2e-helpers`
- [x] `mods-hub/src/pages/mod-upload.e2e.spec.ts` - Changed to `@strixun/e2e-helpers`
- [x] `mods-hub/src/pages/login.e2e.spec.ts` - Changed to `@strixun/e2e-helpers`
- [x] `src/pages/auth.e2e.spec.ts` - Changed to `@strixun/e2e-helpers`
- [x] `src/core/api/enhanced/encryption/jwt-encryption.ts` - Changed to `@strixun/api-framework`

---

## Phase 6: Issues and Notes

### Known Issues
- None yet

### Notes
- Health E2E test files currently use `@playwright/test` directly - may not need to change if they don't use shared helpers
- Need to verify if `control-panel`, `url-shortener/app`, and `otp-auth-service/dashboard` actually import from workspace libraries

---

## Completion Checklist

- [ ] All workspace libraries verified and properly configured
- [ ] All projects have correct workspace dependencies
- [ ] All relative imports to workspace libraries replaced with package names
- [ ] All projects build successfully
- [ ] All tests pass
- [ ] Documentation updated

---

**Next Action:** Add missing `@strixun/e2e-helpers` dependencies to all serverless workers

