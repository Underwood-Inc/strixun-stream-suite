# Documentation Reorganization Plan [DOCS]

**Status:** [SUCCESS] In Progress  
**Date:** 2025-01-XX

---

## Overview

This document tracks the reorganization of all documentation into a proper documentation suite with logical categorization and navigation.

---

## New Structure

```
docs/
├── README.md (main index - [SUCCESS] created)
├── getting-started/
│   ├── README.md
│   ├── setup.md
│   ├── quick-start.md
│   └── environment-setup.md ([SUCCESS] moved)
├── architecture/
│   ├── README.md
│   ├── system-overview.md
│   ├── technical-architecture.md ([SUCCESS] moved)
│   ├── component-architecture.md
│   ├── data-flow.md
│   ├── storage-architecture.md
│   ├── api-architecture.md
│   ├── security-architecture.md
│   └── worker-organization.md ([SUCCESS] moved)
├── api/
│   ├── README.md
│   ├── reference.md ([SUCCESS] moved)
│   ├── endpoints.md ([SUCCESS] moved)
│   ├── framework-guide.md
│   ├── examples.md
│   ├── error-handling.md
│   └── rate-limits.md
├── services/
│   ├── README.md
│   ├── otp-auth-service/ ([SUCCESS] created)
│   ├── customer-api/ ([SUCCESS] created)
│   ├── url-shortener/ ([SUCCESS] created)
│   ├── chat-signaling/ ([SUCCESS] created)
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
│   ├── overview.md ([SUCCESS] moved)
│   ├── cloudflare-workers.md
│   ├── cloudflare-pages.md
│   ├── github-actions.md
│   ├── environment.md
│   └── monitoring.md
├── security/
│   ├── README.md
│   ├── overview.md
│   ├── audit.md ([SUCCESS] moved)
│   ├── analysis.md ([SUCCESS] moved)
│   ├── security-audit.md ([SUCCESS] moved)
│   ├── fixes-summary.md ([SUCCESS] moved)
│   ├── encryption.md
│   ├── authentication.md
│   └── best-practices.md
├── guides/
│   ├── README.md
│   ├── encryption-setup.md
│   ├── cors-configuration.md ([SUCCESS] moved)
│   ├── cors-quick-reference.md ([SUCCESS] moved)
│   ├── auto-configuration.md ([SUCCESS] moved)
│   ├── custom-domain.md ([SUCCESS] moved)
│   ├── email-setup.md
│   └── storage-setup.md
└── reference/
    ├── README.md
    ├── database-schema.md ([SUCCESS] moved)
    ├── design-system.md ([SUCCESS] moved)
    ├── api-standards.md
    ├── storage-persistence.md
    └── layout-presets.md
```

---

## File Mapping

### Getting Started
- `ENV_SETUP_GUIDE.md` [EMOJI] `getting-started/environment-setup.md` [SUCCESS]
- `serverless/SETUP.md` [EMOJI] `getting-started/setup.md` (to move)
- Create `getting-started/quick-start.md` (to create)

### Architecture
- `docs/TECHNICAL_ARCHITECTURE.md` [EMOJI] `architecture/technical-architecture.md` [SUCCESS]
- `docs/WORKER_ORGANIZATION.md` [EMOJI] `architecture/worker-organization.md` [SUCCESS]
- `product-docs/ARCHITECTURAL_OVERVIEW.md` [EMOJI] `architecture/system-overview.md` (to move)
- `docs/VOIP_ARCHITECTURE.md` [EMOJI] `architecture/voip-architecture.md` (to move)
- `docs/PROFILE_PICTURE_ARCHITECTURE.md` [EMOJI] `architecture/profile-picture-architecture.md` (to move)
- `docs/IDLE_GAME_SYSTEM_ARCHITECTURE.md` [EMOJI] `architecture/idle-game-architecture.md` (to move)
- `docs/P2P_VOIP_ARCHITECTURE.md` [EMOJI] `architecture/p2p-voip-architecture.md` (to move)

### API
- `docs/API_REFERENCE.md` [EMOJI] `api/reference.md` [SUCCESS]
- `docs/API_ENDPOINTS_REFERENCE.md` [EMOJI] `api/endpoints.md` [SUCCESS]
- `docs/API_FRAMEWORK_USAGE_GUIDE.md` [EMOJI] `api/framework-guide.md` (to move)
- `docs/API_FRAMEWORK_ENHANCED_ARCHITECTURE.md` [EMOJI] `api/framework-architecture.md` (to move)
- `docs/OTP_AUTH_API_DOCUMENTATION.md` [EMOJI] `api/otp-auth-api.md` (to move)

### Services
- `serverless/otp-auth-service/README.md` [EMOJI] `services/otp-auth-service/README.md` (to move)
- `serverless/customer-api/README.md` [EMOJI] `services/customer-api/README.md` (to move)
- `serverless/url-shortener/README.md` [EMOJI] `services/url-shortener/README.md` (to move)
- `serverless/chat-signaling/README.md` [EMOJI] `services/chat-signaling/README.md` (to move)
- All service-specific docs [EMOJI] respective service directories

### Development
- `serverless/TYPESCRIPT_CONVERSION_STATUS.md` [EMOJI] `development/typescript-conversion.md` (to move)
- `serverless/TYPESCRIPT_CONVERSION_PLAN.md` [EMOJI] `development/typescript-plan.md` (to move)
- `serverless/TYPESCRIPT_AUDIT.md` [EMOJI] `development/typescript-audit.md` (to move)
- `docs/MODULARIZATION_PROGRESS.md` [EMOJI] `development/modularization.md` (to move)
- `docs/DEAD_CODE_AND_MODULARIZATION.md` [EMOJI] `development/dead-code-modularization.md` (to move)

### Deployment
- `docs/DEPLOYMENT.md` [EMOJI] `deployment/overview.md` [SUCCESS]
- `serverless/CUSTOM_DOMAIN_SETUP.md` [EMOJI] `deployment/custom-domain.md` (already in guides, move to deployment)
- `docs/GITHUB_PAGES_SSL_SETUP.md` [EMOJI] `deployment/github-pages-ssl.md` (to move)

### Security
- `SECURITY_AUDIT_REPORT.md` [EMOJI] `security/audit.md` [SUCCESS]
- `docs/SECURITY_ANALYSIS.md` [EMOJI] `security/analysis.md` [SUCCESS]
- `docs/SECURITY_AUDIT.md` [EMOJI] `security/security-audit.md` [SUCCESS]
- `docs/SECURITY_FIXES_SUMMARY.md` [EMOJI] `security/fixes-summary.md` [SUCCESS]
- `docs/ENCRYPTION_IMPLEMENTATION.md` [EMOJI] `security/encryption.md` (to move)
- `serverless/shared/encryption/README.md` [EMOJI] `security/encryption-guide.md` (to move)

### Guides
- `docs/AUTO_CONFIGURATION.md` [EMOJI] `guides/auto-configuration.md` [SUCCESS]
- `serverless/CORS_CONFIGURATION_GUIDE.md` [EMOJI] `guides/cors-configuration.md` [SUCCESS]
- `serverless/CORS_QUICK_REFERENCE.md` [EMOJI] `guides/cors-quick-reference.md` [SUCCESS]
- `docs/RESEND_SETUP_GUIDE.md` [EMOJI] `guides/email-setup.md` (to move)
- `docs/RESEND_GITHUB_PAGES_DOMAIN.md` [EMOJI] `guides/resend-domain.md` (to move)

### Reference
- `docs/DATABASE_SCHEMA.md` [EMOJI] `reference/database-schema.md` [SUCCESS]
- `docs/DESIGN_SYSTEM.md` [EMOJI] `reference/design-system.md` [SUCCESS]
- `docs/STORAGE_PERSISTENCE.md` [EMOJI] `reference/storage-persistence.md` (to move)
- `docs/LAYOUT_PRESETS_SPEC.md` [EMOJI] `reference/layout-presets.md` (to move)
- `serverless/otp-auth-service/API_STANDARDS.md` [EMOJI] `reference/api-standards.md` (to move)

---

## Status

### [SUCCESS] Completed
- Created directory structure
- Created main docs/README.md
- Moved key files to new locations
- Created service directories

### [EMOJI] In Progress
- Moving remaining files
- Creating section README files
- Updating cross-references

### [CLIPBOARD] To Do
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

