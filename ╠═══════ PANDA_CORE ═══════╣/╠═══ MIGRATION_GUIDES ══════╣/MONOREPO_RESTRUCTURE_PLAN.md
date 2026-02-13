# Monorepo Restructure: apps/ + services/ Pattern

## 🎯 Goal

Restructure the monorepo from inconsistent layout to industry-standard apps/services pattern.

**Target Structure:**
```
/
├── apps/
│   ├── stream-suite/       (current root app)
│   ├── mods-hub/
│   ├── control-panel/
│   ├── access-hub/
│   └── dice-board-game/
├── services/
│   ├── otp-auth-service/
│   ├── mods-api/
│   ├── customer-api/
│   ├── twitch-api/
│   ├── url-shortener/
│   ├── chat-signaling/
│   ├── game-api/
│   ├── access-service/
│   └── music-api/
└── packages/
    ├── api-framework/
    ├── auth-store/
    ├── types/
    └── ...
```

---

## ✅ Benefits

- **Clear semantic grouping** - "apps" = frontends, "services" = backends
- **Industry standard** - Matches Nx/Turborepo conventions
- **Consistent depth** - No more mixing root-level and nested apps
- **Easier Docker** - Simplified COPY paths
- **Room to grow** - Can add `tools/`, `scripts/`, `docs/` later
- **Better DX** - Easier to find things

---

## 📋 Task Checklist

### Phase 1: Preparation (1-2 hours)

- [ ] **1.1** Create feature branch: `feat/monorepo-restructure`
- [ ] **1.2** Back up current state (git tag `pre-restructure`)
- [ ] **1.3** Document all current import paths in a spreadsheet
- [ ] **1.4** Run full test suite to establish baseline (`pnpm test:all`)
- [ ] **1.5** Run E2E tests to establish baseline (`pnpm test:e2e`)
- [ ] **1.6** Build all projects to ensure clean state (`pnpm build:all`)
- [ ] **1.7** Create migration script (`scripts/migrate-to-apps-services.js`)

---

### Phase 2: File System Migration (30 minutes)

- [ ] **2.1** Create `apps/` directory
- [ ] **2.2** Create `services/` directory
- [ ] **2.3** Move frontend apps to `apps/`:
  - [ ] `mods-hub/` → `apps/mods-hub/`
  - [ ] `control-panel/` → `apps/control-panel/`
  - [ ] `access-hub/` → `apps/access-hub/`
  - [ ] `dice-board-game/` → `apps/dice-board-game/`
  - [ ] Root app (current `./*`) → `apps/stream-suite/`
- [ ] **2.4** Move services from `serverless/` to `services/`:
  - [ ] `serverless/otp-auth-service/` → `services/otp-auth-service/`
  - [ ] `serverless/mods-api/` → `services/mods-api/`
  - [ ] `serverless/customer-api/` → `services/customer-api/`
  - [ ] `serverless/twitch-api/` → `services/twitch-api/`
  - [ ] `serverless/url-shortener/` → `services/url-shortener/`
  - [ ] `serverless/chat-signaling/` → `services/chat-signaling/`
  - [ ] `serverless/game-api/` → `services/game-api/`
  - [ ] `serverless/access-service/` → `services/access-service/`
  - [ ] `serverless/music-api/` → `services/music-api/`
- [ ] **2.5** Delete empty `serverless/` directory
- [ ] **2.6** Keep `packages/` as-is (already correctly structured)

---

### Phase 3: Configuration Updates (1 hour)

#### 3.1 Update pnpm Workspace Configuration
- [ ] **3.1.1** Update `pnpm-workspace.yaml`:
  ```yaml
  packages:
    - 'apps/*'
    - 'services/*'
    - 'packages/*'
    - 'shared-components'
    - 'shared-config'
    - 'shared-styles'
  ```

#### 3.2 Update Turborepo Configuration
- [ ] **3.2.1** Update `turbo.json` if needed (no paths, should work as-is)

#### 3.3 Update Root package.json
- [ ] **3.3.1** Update `build:apps` script:
  ```json
  "build:apps": "turbo run build --filter=./apps/* --filter=./services/*/app --filter=./services/*/dashboard"
  ```
- [ ] **3.3.2** Update all script paths that reference specific apps/services
- [ ] **3.3.3** Update `workspaces` field if present

#### 3.4 Update TypeScript Configurations
- [ ] **3.4.1** Update root `tsconfig.json` paths if any reference apps/services
- [ ] **3.4.2** Update `packages/auth-store/tsconfig.json` paths
- [ ] **3.4.3** Update any project-specific tsconfig paths

---

### Phase 4: Import Path Updates (2-3 hours)

#### 4.1 Update Relative Imports
- [ ] **4.1.1** Search and replace in all files: `'../../serverless/` → `'../../services/`
- [ ] **4.1.2** Search and replace in all files: `'../serverless/` → `'../services/`
- [ ] **4.1.3** Update any hardcoded paths in config files

#### 4.2 Update Package Names (if using workspace protocol)
- [ ] **4.2.1** Check if any package.json has `"name"` that includes path
- [ ] **4.2.2** Update if necessary (usually not needed)

---

### Phase 5: Docker Configuration Updates (30 minutes)

#### 5.1 Update Dockerfile.dev
- [ ] **5.1.1** Update all COPY paths to use `apps/` and `services/`
- [ ] **5.1.2** Example:
  ```dockerfile
  # Old
  COPY mods-hub/package.json ./mods-hub/
  COPY serverless/otp-auth-service/package.json ./serverless/otp-auth-service/
  
  # New
  COPY apps/mods-hub/package.json ./apps/mods-hub/
  COPY services/otp-auth-service/package.json ./services/otp-auth-service/
  ```

#### 5.2 Update docker-compose.yml
- [ ] **5.2.1** Update all `build.context` paths
- [ ] **5.2.2** Update all volume mount paths
- [ ] **5.2.3** Update all `command` paths if they reference directories
- [ ] **5.2.4** Example service update:
  ```yaml
  # Old
  mods-hub:
    build:
      context: .
      dockerfile: Dockerfile.dev
      args:
        SERVICE_NAME: "mods-hub"
    volumes:
      - .:/app
    command: pnpm --filter @strixun/mods-hub dev
  
  # New (no change needed if using workspace packages)
  mods-hub:
    build:
      context: .
      dockerfile: Dockerfile.dev
      args:
        SERVICE_NAME: "apps/mods-hub"
    volumes:
      - .:/app
    command: pnpm --filter @strixun/mods-hub dev
  ```

#### 5.3 Update .dockerignore
- [ ] **5.3.1** Update paths if any are hardcoded (usually wildcards work)

---

### Phase 6: CI/CD Updates (1-2 hours)

#### 6.1 Update GitHub Workflows
- [ ] **6.1.1** `.github/workflows/deploy-mods-hub.yml`
  - Update all paths from `mods-hub/` to `apps/mods-hub/`
- [ ] **6.1.2** `.github/workflows/deploy-access-hub.yml`
  - Update all paths from `access-hub/` to `apps/access-hub/`
- [ ] **6.1.3** `.github/workflows/deploy-manager.yml`
  - Update all paths
- [ ] **6.1.4** `.github/workflows/deploy-pages.yml`
  - Update root app path to `apps/stream-suite/`
- [ ] **6.1.5** All service deployment workflows:
  - Update from `serverless/otp-auth-service/` to `services/otp-auth-service/`
  - Update from `serverless/mods-api/` to `services/mods-api/`
  - Update from `serverless/customer-api/` to `services/customer-api/`
  - etc.

#### 6.2 Update wrangler.toml files
- [ ] **6.2.1** Check each service's `wrangler.toml` for hardcoded paths
- [ ] **6.2.2** Update `main` entry points if they use relative paths

---

### Phase 7: Documentation Updates (1 hour)

- [ ] **7.1** Update root `README.md`:
  - Update all directory paths in structure section
  - Update quick start commands
  - Update Docker setup instructions
- [ ] **7.2** Update `DOCKER_SETUP.md`:
  - Update all example paths
- [ ] **7.3** Update individual project READMEs:
  - Update paths in development instructions
- [ ] **7.4** Update `docs/` if any have hardcoded paths
- [ ] **7.5** Update `WORKER_PORT_MAPPING.md` and other docs in `serverless/`
- [ ] **7.6** Move `serverless/` docs to appropriate locations or update paths

---

### Phase 8: Testing & Validation (2-3 hours)

#### 8.1 Build Validation
- [ ] **8.1.1** Run `pnpm install` (verify workspace resolution)
- [ ] **8.1.2** Run `pnpm build:packages` (verify packages build)
- [ ] **8.1.3** Run `pnpm build:apps` (verify apps build)
- [ ] **8.1.4** Run `pnpm build:all` (verify everything builds)

#### 8.2 Type Checking
- [ ] **8.2.1** Run `pnpm check:all` (verify TypeScript)
- [ ] **8.2.2** Run `pnpm lint:all` (verify linting)

#### 8.3 Testing
- [ ] **8.3.1** Run `pnpm test:all` (verify unit tests)
- [ ] **8.3.2** Run `pnpm test:integration` (verify integration tests)
- [ ] **8.3.3** Run `pnpm test:e2e` (verify end-to-end tests)

#### 8.4 Docker Validation
- [ ] **8.4.1** Run `pnpm dev:docker:build` (verify Docker build)
- [ ] **8.4.2** Run `pnpm dev:docker` (verify containers start)
- [ ] **8.4.3** Check Dozzle logs for errors (http://localhost:8080)
- [ ] **8.4.4** Test each app manually (click through UIs)

#### 8.5 Manual Testing
- [ ] **8.5.1** Start `apps/stream-suite` and verify it works
- [ ] **8.5.2** Start `apps/mods-hub` and verify it works
- [ ] **8.5.3** Test SSO between apps
- [ ] **8.5.4** Test API calls from frontend to services
- [ ] **8.5.5** Test file uploads (mods-api)
- [ ] **8.5.6** Test OTP authentication flow

---

### Phase 9: Script Updates (30 minutes)

- [ ] **9.1** Update `scripts/show-dev-ports.js`:
  - Update location paths to use `apps/` and `services/`
- [ ] **9.2** Update `scripts/setup-cloud-ide.js`:
  - Update paths from `serverless/` to `services/`
- [ ] **9.3** Update any other scripts in `scripts/` directory
- [ ] **9.4** Search entire codebase for "serverless/" string:
  ```bash
  grep -r "serverless/" --exclude-dir=node_modules --exclude-dir=.git
  ```

---

### Phase 10: Edge Cases & Cleanup (1 hour)

- [ ] **10.1** Check for any symbolic links that need updating
- [ ] **10.2** Update any shell scripts (`.sh`, `.ps1`) with hardcoded paths
- [ ] **10.3** Update any config files in root (`.env.example`, etc.)
- [ ] **10.4** Search for any remaining references to old structure:
  ```bash
  # Search for "mods-hub" NOT preceded by "apps/"
  # Search for "serverless/" references
  # Search for hardcoded paths in comments
  ```
- [ ] **10.5** Update `.gitignore` if any paths are hardcoded
- [ ] **10.6** Update `.cursorignore` if it exists

---

### Phase 11: Final Verification (30 minutes)

- [ ] **11.1** Fresh clone in new directory
- [ ] **11.2** Run `pnpm install` from scratch
- [ ] **11.3** Run `pnpm dev:docker:build` from scratch
- [ ] **11.4** Run full test suite
- [ ] **11.5** Deploy to staging environment (if available)
- [ ] **11.6** Test production builds

---

### Phase 12: Release (1 hour)

- [ ] **12.1** Create CHANGELOG entry for v2.0.0
- [ ] **12.2** Update version in all package.json files
- [ ] **12.3** Create migration guide for contributors
- [ ] **12.4** Create PR with detailed description
- [ ] **12.5** Get review from team (if applicable)
- [ ] **12.6** Merge to main
- [ ] **12.7** Create git tag: `v2.0.0-apps-services-restructure`
- [ ] **12.8** Update documentation site (if exists)
- [ ] **12.9** Announce in discussions/README

---

## 🚨 Rollback Plan

If something goes wrong:

1. **Git rollback**: `git checkout pre-restructure`
2. **Force push if needed**: `git push --force origin main` (ONLY if absolutely necessary)
3. **Redeploy previous version**: Use previous deployment workflow
4. **Document what went wrong**: Create issue for future attempt

---

## 📝 Migration Script Template

Create `scripts/migrate-to-apps-services.js`:

```javascript
#!/usr/bin/env node
/**
 * Automated migration script for apps/services restructure
 * 
 * Usage: node scripts/migrate-to-apps-services.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const dryRun = process.argv.includes('--dry-run');

const migrations = {
  // File moves
  moves: [
    { from: 'mods-hub', to: 'apps/mods-hub' },
    { from: 'control-panel', to: 'apps/control-panel' },
    { from: 'access-hub', to: 'apps/access-hub' },
    { from: 'dice-board-game', to: 'apps/dice-board-game' },
    { from: 'serverless/otp-auth-service', to: 'services/otp-auth-service' },
    // ... etc
  ],
  
  // String replacements in files
  replacements: [
    { pattern: /serverless\//g, replacement: 'services/', extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.yml', '.yaml', '.md'] },
    // ... etc
  ]
};

// Implementation here...
// 1. Validate current structure
// 2. Create backup
// 3. Create new directories
// 4. Move files
// 5. Update file contents
// 6. Validate new structure
// 7. Run tests
```

---

## ⏱️ Estimated Timeline

| Phase | Time | Dependencies |
|-------|------|--------------|
| Preparation | 1-2h | None |
| File System Migration | 30m | Phase 1 |
| Configuration Updates | 1h | Phase 2 |
| Import Path Updates | 2-3h | Phase 3 |
| Docker Updates | 30m | Phase 4 |
| CI/CD Updates | 1-2h | Phase 4 |
| Documentation | 1h | Phase 5, 6 |
| Testing & Validation | 2-3h | Phase 7 |
| Script Updates | 30m | Phase 7 |
| Edge Cases | 1h | Phase 8 |
| Final Verification | 30m | Phase 9, 10 |
| Release | 1h | Phase 11 |

**Total: 11-16 hours of focused work**

**Recommended Approach:** 
- Dedicate 2 full days
- Day 1: Phases 1-7 (preparation, migration, updates)
- Day 2: Phases 8-12 (testing, validation, release)

---

## 🎯 Success Criteria

- [ ] All tests pass
- [ ] All builds succeed
- [ ] Docker containers start successfully
- [ ] All apps accessible and functional
- [ ] SSO works across all apps
- [ ] No broken imports or paths
- [ ] CI/CD pipelines deploy successfully
- [ ] Documentation updated
- [ ] Zero production downtime

---

## 📚 References

- [Turborepo Docs - Structuring a Repository](https://turbo.build/repo/docs/handbook/structuring-your-repository)
- [Nx Workspace Structure](https://nx.dev/concepts/more-concepts/applications-and-libraries)
- [pnpm Workspaces](https://pnpm.io/workspaces)

---

## 💡 Notes

- This is a **breaking change** for contributors (requires new clone/pull)
- Consider doing this during a low-activity period
- Communicate clearly to all contributors
- Have rollback plan ready
- Test thoroughly before merging

---

**Created:** 2026-01-14  
**Target Version:** v2.0.0  
**Priority:** Medium (future enhancement)  
**Status:** Planned
