# Documentation Reorganization Plan 📚

**Status:** ✅ In Progress  
**Date:** 2025-01-XX

---

## Overview

This document tracks the reorganization of all documentation into a proper documentation suite with logical categorization and navigation.

---

## New Structure

```
docs/
├── README.md (main index - ✅ created)
├── getting-started/
│   ├── README.md
│   ├── setup.md
│   ├── quick-start.md
│   └── environment-setup.md (✅ moved)
├── architecture/
│   ├── README.md
│   ├── system-overview.md
│   ├── technical-architecture.md (✅ moved)
│   ├── component-architecture.md
│   ├── data-flow.md
│   ├── storage-architecture.md
│   ├── api-architecture.md
│   ├── security-architecture.md
│   └── worker-organization.md (✅ moved)
├── api/
│   ├── README.md
│   ├── reference.md (✅ moved)
│   ├── endpoints.md (✅ moved)
│   ├── framework-guide.md
│   ├── examples.md
│   ├── error-handling.md
│   └── rate-limits.md
├── services/
│   ├── README.md
│   ├── otp-auth-service/ (✅ created)
│   ├── customer-api/ (✅ created)
│   ├── url-shortener/ (✅ created)
│   ├── chat-signaling/ (✅ created)
│   ├── game-api/
│   ├── mods-api/
│   └── twitch-api/
├── development/
│   ├── README.md
│   ├── setup.md
│   ├── contributing.md
│   ├── testing.md
│   ├── typescript-conversion.md
│   ├── code-style.md
│   └── modularization.md
├── deployment/
│   ├── README.md
│   ├── overview.md (✅ moved)
│   ├── cloudflare-workers.md
│   ├── cloudflare-pages.md
│   ├── github-actions.md
│   ├── environment.md
│   └── monitoring.md
├── security/
│   ├── README.md
│   ├── overview.md
│   ├── audit.md (✅ moved)
│   ├── analysis.md (✅ moved)
│   ├── security-audit.md (✅ moved)
│   ├── fixes-summary.md (✅ moved)
│   ├── encryption.md
│   ├── authentication.md
│   └── best-practices.md
├── guides/
│   ├── README.md
│   ├── encryption-setup.md
│   ├── cors-configuration.md (✅ moved)
│   ├── cors-quick-reference.md (✅ moved)
│   ├── auto-configuration.md (✅ moved)
│   ├── custom-domain.md (✅ moved)
│   ├── email-setup.md
│   └── storage-setup.md
└── reference/
    ├── README.md
    ├── database-schema.md (✅ moved)
    ├── design-system.md (✅ moved)
    ├── api-standards.md
    ├── storage-persistence.md
    └── layout-presets.md
```

---

## File Mapping

### Getting Started
- `ENV_SETUP_GUIDE.md` → `getting-started/environment-setup.md` ✅
- `serverless/SETUP.md` → `getting-started/setup.md` (to move)
- Create `getting-started/quick-start.md` (to create)

### Architecture
- `docs/TECHNICAL_ARCHITECTURE.md` → `architecture/technical-architecture.md` ✅
- `docs/WORKER_ORGANIZATION.md` → `architecture/worker-organization.md` ✅
- `product-docs/ARCHITECTURAL_OVERVIEW.md` → `architecture/system-overview.md` (to move)
- `docs/VOIP_ARCHITECTURE.md` → `architecture/voip-architecture.md` (to move)
- `docs/PROFILE_PICTURE_ARCHITECTURE.md` → `architecture/profile-picture-architecture.md` (to move)
- `docs/IDLE_GAME_SYSTEM_ARCHITECTURE.md` → `architecture/idle-game-architecture.md` (to move)
- `docs/P2P_VOIP_ARCHITECTURE.md` → `architecture/p2p-voip-architecture.md` (to move)

### API
- `docs/API_REFERENCE.md` → `api/reference.md` ✅
- `docs/API_ENDPOINTS_REFERENCE.md` → `api/endpoints.md` ✅
- `docs/API_FRAMEWORK_USAGE_GUIDE.md` → `api/framework-guide.md` (to move)
- `docs/API_FRAMEWORK_ENHANCED_ARCHITECTURE.md` → `api/framework-architecture.md` (to move)
- `docs/OTP_AUTH_API_DOCUMENTATION.md` → `api/otp-auth-api.md` (to move)

### Services
- `serverless/otp-auth-service/README.md` → `services/otp-auth-service/README.md` (to move)
- `serverless/customer-api/README.md` → `services/customer-api/README.md` (to move)
- `serverless/url-shortener/README.md` → `services/url-shortener/README.md` (to move)
- `serverless/chat-signaling/README.md` → `services/chat-signaling/README.md` (to move)
- All service-specific docs → respective service directories

### Development
- `serverless/TYPESCRIPT_CONVERSION_STATUS.md` → `development/typescript-conversion.md` (to move)
- `serverless/TYPESCRIPT_CONVERSION_PLAN.md` → `development/typescript-plan.md` (to move)
- `serverless/TYPESCRIPT_AUDIT.md` → `development/typescript-audit.md` (to move)
- `docs/MODULARIZATION_PROGRESS.md` → `development/modularization.md` (to move)
- `docs/DEAD_CODE_AND_MODULARIZATION.md` → `development/dead-code-modularization.md` (to move)

### Deployment
- `docs/DEPLOYMENT.md` → `deployment/overview.md` ✅
- `serverless/CUSTOM_DOMAIN_SETUP.md` → `deployment/custom-domain.md` (already in guides, move to deployment)
- `docs/GITHUB_PAGES_SSL_SETUP.md` → `deployment/github-pages-ssl.md` (to move)

### Security
- `SECURITY_AUDIT_REPORT.md` → `security/audit.md` ✅
- `docs/SECURITY_ANALYSIS.md` → `security/analysis.md` ✅
- `docs/SECURITY_AUDIT.md` → `security/security-audit.md` ✅
- `docs/SECURITY_FIXES_SUMMARY.md` → `security/fixes-summary.md` ✅
- `docs/ENCRYPTION_IMPLEMENTATION.md` → `security/encryption.md` (to move)
- `serverless/shared/encryption/README.md` → `security/encryption-guide.md` (to move)

### Guides
- `docs/AUTO_CONFIGURATION.md` → `guides/auto-configuration.md` ✅
- `serverless/CORS_CONFIGURATION_GUIDE.md` → `guides/cors-configuration.md` ✅
- `serverless/CORS_QUICK_REFERENCE.md` → `guides/cors-quick-reference.md` ✅
- `docs/RESEND_SETUP_GUIDE.md` → `guides/email-setup.md` (to move)
- `docs/RESEND_GITHUB_PAGES_DOMAIN.md` → `guides/resend-domain.md` (to move)

### Reference
- `docs/DATABASE_SCHEMA.md` → `reference/database-schema.md` ✅
- `docs/DESIGN_SYSTEM.md` → `reference/design-system.md` ✅
- `docs/STORAGE_PERSISTENCE.md` → `reference/storage-persistence.md` (to move)
- `docs/LAYOUT_PRESETS_SPEC.md` → `reference/layout-presets.md` (to move)
- `serverless/otp-auth-service/API_STANDARDS.md` → `reference/api-standards.md` (to move)

---

## Status

### ✅ Completed
- Created directory structure
- Created main docs/README.md
- Moved key files to new locations
- Created service directories

### ⏳ In Progress
- Moving remaining files
- Creating section README files
- Updating cross-references

### 📋 To Do
- Move all files to new locations
- Create README for each section
- Update all cross-references
- Remove old files (after verification)
- Update main README.md links

---

## Next Steps

1. Continue moving files systematically
2. Create README files for each section
3. Update cross-references in moved files
4. Verify all links work
5. Remove old duplicate files

---

*Last Updated: 2025-01-XX*

