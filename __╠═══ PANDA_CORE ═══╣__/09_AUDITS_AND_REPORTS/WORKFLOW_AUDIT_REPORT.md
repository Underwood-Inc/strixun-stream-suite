# GitHub Actions Workflow Audit Report

> **Optimize workflows to use `test:all` as required check and make other workflows optional where appropriate**

**Date:** 2025-12-29

---

## Current Workflow Inventory

### Test Workflows
1. **test-coverage.yml** (NEW)
   - **Trigger:** Push to master branch
   - **Action:** Runs `pnpm test:all` + coverage
   - **Status:** Just created, not yet configured as required check

2. **test-manager.yml**
   - **Trigger:** Manual only (workflow_dispatch)
   - **Action:** Orchestrates tests for multiple services with checkboxes
   - **Status:** Optional manual workflow

3. **test-encryption.yml**
   - **Trigger:** Push/PR to main/develop/master (specific encryption file paths)
   - **Action:** Tests encryption libraries only
   - **Status:** Auto-runs on specific file changes

4. **test-otp-auth-integration.yml**
   - **Trigger:** Push/PR to main/develop (specific integration test paths)
   - **Action:** Integration tests for OTP auth service
   - **Status:** Auto-runs on specific file changes

5. **mods-hub-tests.yml**
   - **Trigger:** Push/PR to main/develop (mods-hub paths)
   - **Action:** Tests mods-hub API service
   - **Status:** Auto-runs on mods-hub changes

### Deployment Workflows
6. **deploy-manager.yml**
   - **Trigger:** Manual only (workflow_dispatch)
   - **Action:** Orchestrates ALL deployments with checkboxes
   - **Features:** Has built-in test steps before deployment
   - **Status:** Primary deployment orchestration tool

7. **deploy-otp-auth.yml**
   - **Trigger:** Push to main/master (otp-auth-service paths) + manual
   - **Action:** Tests + deploys OTP auth service
   - **Status:** Auto-runs on service changes

8. **deploy-mods-api.yml**
   - **Trigger:** Push to main/master (mods-api paths) + manual
   - **Action:** Tests + deploys Mods API
   - **Status:** Auto-runs on service changes

9-14. **Other deploy workflows** (twitch-api, customer-api, game-api, mods-hub, storybook, pages)
   - **Status:** Individual service deployments

### Utility Workflows
15. **release.yml** - Creates GitHub releases with Changesets
16. **sync-wiki.yml** - Syncs docs to GitHub wiki
17. **update-version-badge.yml** - Updates version badge in README

---

## Issues Identified

### 1. **Too Many Auto-Running Workflows**
- Multiple workflows auto-trigger on master branch changes
- Individual deploy workflows duplicate test logic
- Creates redundant CI runs and potential conflicts

### 2. **No Single Required Test Check**
- `test-coverage.yml` exists but isn't configured as a required status check
- Multiple test workflows run independently
- No unified test gate before deployments

### 3. **Deployment Workflow Duplication**
- Individual deploy workflows auto-run on path changes
- `deploy-manager.yml` already orchestrates all deployments
- Creates confusion about which workflow to use

### 4. **Test Workflow Fragmentation**
- Specialized test workflows (encryption, integration, mods-hub) run separately
- `test:all` should cover these but they run independently
- No clear hierarchy of test importance

---

## Recommendations

### ✅ **PRIMARY RECOMMENDATION: Centralized Test & Deploy Strategy**

#### 1. **Make `test-coverage.yml` the Required Check**
   - **Action:** Configure as required status check in branch protection
   - **Trigger:** Push to master branch (any code changes)
   - **Command:** `pnpm test:all` (as requested)
   - **Coverage:** Generates and uploads coverage reports
   - **Status:** REQUIRED - blocks merges if tests fail

#### 2. **Make Individual Deploy Workflows Optional**
   - **Action:** Remove auto-triggers (push events) from individual deploy workflows
   - **Keep:** `workflow_dispatch` for manual triggering
   - **Rationale:** `deploy-manager.yml` should be the primary deployment method
   - **Exception:** Keep `deploy-pages.yml` auto-trigger if needed for frontend-only changes

#### 3. **Enhance `deploy-manager.yml` as Primary Deployment Tool**
   - **Current State:** Already has test steps built-in
   - **Enhancement:** Add note that `test-coverage.yml` should pass first
   - **Usage:** Manual deployment with checkboxes for services
   - **Status:** PRIMARY deployment workflow

#### 4. **Make Specialized Test Workflows Optional**
   - **test-encryption.yml:** Keep for encryption-specific testing, but make optional
   - **test-otp-auth-integration.yml:** Keep for integration testing, but make optional
   - **mods-hub-tests.yml:** Keep for mods-hub testing, but make optional
   - **Rationale:** These are specialized tests that complement `test:all`, not replace it

#### 5. **Keep Utility Workflows As-Is**
   - **release.yml:** Keep auto-trigger (utility workflow)
   - **sync-wiki.yml:** Keep auto-trigger (utility workflow)
   - **update-version-badge.yml:** Keep auto-trigger (utility workflow)
   - **Rationale:** These don't interfere with test/deploy strategy

---

## Proposed Workflow Structure

### **Required Workflows (Block Merges)**
```
test-coverage.yml
├── Trigger: Push to master (any code changes)
├── Command: pnpm test:all
├── Coverage: Generates and uploads coverage
└── Status: REQUIRED CHECK (configure in branch protection)
```

### **Primary Deployment Workflow (Manual)**
```
deploy-manager.yml
├── Trigger: Manual only (workflow_dispatch)
├── Tests: Built-in test steps (or relies on test-coverage.yml passing)
├── Deploys: All services with checkboxes
└── Status: PRIMARY deployment method
```

### **Optional Test Workflows (Specialized)**
```
test-encryption.yml          → Optional (encryption-specific)
test-otp-auth-integration.yml → Optional (integration-specific)
mods-hub-tests.yml           → Optional (mods-hub-specific)
test-manager.yml             → Optional (manual testing)
```

### **Optional Deploy Workflows (Manual Only)**
```
deploy-otp-auth.yml    → Manual only (remove auto-trigger)
deploy-mods-api.yml    → Manual only (remove auto-trigger)
deploy-twitch-api.yml  → Manual only (remove auto-trigger)
deploy-customer-api.yml → Manual only (remove auto-trigger)
deploy-game-api.yml    → Manual only (remove auto-trigger)
deploy-mods-hub.yml    → Manual only (remove auto-trigger)
deploy-storybook.yml   → Manual only (remove auto-trigger)
deploy-pages.yml       → Keep auto-trigger OR make manual (your choice)
```

### **Utility Workflows (Keep As-Is)**
```
release.yml              → Auto-trigger (utility)
sync-wiki.yml            → Auto-trigger (utility)
update-version-badge.yml → Auto-trigger (utility)
```

---

## Implementation Steps

### Step 1: Configure `test-coverage.yml` as Required Check
1. Ensure workflow runs `pnpm test:all` correctly ✅ (already done)
2. Go to repository Settings → Branches → Branch protection rules
3. Add `test-coverage` as required status check for master branch
4. This will block merges if tests fail

### Step 2: Make Individual Deploy Workflows Optional
For each individual deploy workflow (`deploy-otp-auth.yml`, `deploy-mods-api.yml`, etc.):
1. Remove `push:` triggers (keep only `workflow_dispatch`)
2. Add comment explaining: "Use deploy-manager.yml for orchestrated deployments"
3. Keep workflow for manual single-service deployments

### Step 3: Update `deploy-manager.yml` Documentation
1. Add note at top: "Primary deployment workflow. Ensure test-coverage.yml passes first."
2. Optionally: Add check step that verifies test-coverage.yml passed (via API)

### Step 4: Make Specialized Test Workflows Optional
For `test-encryption.yml`, `test-otp-auth-integration.yml`, `mods-hub-tests.yml`:
1. Keep current triggers (they're path-specific, so less intrusive)
2. Add comment: "Optional specialized test. test-coverage.yml is the required check."
3. Consider adding `continue-on-error: true` if they shouldn't block

### Step 5: Decide on `deploy-pages.yml`
- **Option A:** Keep auto-trigger (frontend-only changes need quick deployment)
- **Option B:** Make manual only (use deploy-manager.yml instead)
- **Recommendation:** Keep auto-trigger since it's frontend-specific and has its own test step

---

## Benefits of This Structure

1. **Clear Test Gate:** `test-coverage.yml` is the single required check
2. **Reduced CI Load:** Fewer auto-running workflows
3. **Clear Deployment Path:** `deploy-manager.yml` is the primary deployment method
4. **Flexibility:** Individual workflows still available for manual use
5. **Coverage Tracking:** Centralized coverage reporting via test-coverage.yml
6. **No Breaking Changes:** All workflows still functional, just reorganized

---

## Summary

**Current State:** 17 workflows, many auto-running, no clear hierarchy  
**Proposed State:** 1 required test workflow, 1 primary deploy workflow, others optional  
**Result:** Cleaner CI/CD, clear test gate, reduced redundancy

---

**Last Updated**: 2025-12-29

