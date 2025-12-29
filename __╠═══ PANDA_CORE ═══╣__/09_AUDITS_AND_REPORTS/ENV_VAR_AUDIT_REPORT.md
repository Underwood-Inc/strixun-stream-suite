# Environment Variable Audit Report - streamkit.idling.app

**Date**: 2024-12-XX  
**Project**: streamkit.idling.app (main)  
**Status**: [FIXED] Critical naming conflicts resolved

## Executive Summary

This audit identified and fixed critical environment variable naming conflicts between frontend (Vite) and backend (Cloudflare Workers) configurations. The main issue was confusion between `VITE_SERVICE_ENCRYPTION_KEY` (frontend) and `SERVICE_ENCRYPTION_KEY` (backend).

## Critical Issues Found and Fixed

### 1. [CRITICAL] Naming Conflict: VITE_SERVICE_ENCRYPTION_KEY vs SERVICE_ENCRYPTION_KEY

**Problem**: 
- OTP auth service handlers were looking for `env.VITE_SERVICE_ENCRYPTION_KEY` in Cloudflare Workers
- PowerShell script was setting `SERVICE_ENCRYPTION_KEY` in workers
- GitHub Actions workflow was setting `VITE_SERVICE_ENCRYPTION_KEY` as a worker secret
- This mismatch caused decryption failures

**Root Cause**:
- Frontend (Vite) uses `VITE_SERVICE_ENCRYPTION_KEY` (correct - Vite prefix required)
- Backend (Cloudflare Workers) should use `SERVICE_ENCRYPTION_KEY` (not VITE_ prefix)
- Code was incorrectly using `VITE_SERVICE_ENCRYPTION_KEY` in worker handlers

**Files Fixed**:
- `serverless/otp-auth-service/handlers/auth/request-otp.ts` - Changed to use `SERVICE_ENCRYPTION_KEY`
- `serverless/otp-auth-service/handlers/auth/verify-otp.ts` - Changed to use `SERVICE_ENCRYPTION_KEY`
- `.github/workflows/deploy-otp-auth.yml` - Fixed to set `SERVICE_ENCRYPTION_KEY` (not `VITE_SERVICE_ENCRYPTION_KEY`)
- `.github/workflows/deploy-manager.yml` - Added `SERVICE_ENCRYPTION_KEY` and `NETWORK_INTEGRITY_KEYPHRASE` setup

**Solution**:
- Workers now correctly use `SERVICE_ENCRYPTION_KEY`
- Frontend continues to use `VITE_SERVICE_ENCRYPTION_KEY`
- Both must have the SAME value, but different names for their respective environments
- GitHub Actions workflows now correctly map `VITE_SERVICE_ENCRYPTION_KEY` secret to `SERVICE_ENCRYPTION_KEY` worker secret

### 2. [MEDIUM] Missing NETWORK_INTEGRITY_KEYPHRASE in Deploy Manager

**Problem**:
- `NETWORK_INTEGRITY_KEYPHRASE` was missing from `deploy-manager.yml` workflow
- Required for service-to-service integrity verification

**Files Fixed**:
- `.github/workflows/deploy-manager.yml` - Added `NETWORK_INTEGRITY_KEYPHRASE` setup for customer-api

## Environment Variable Naming Convention

### Frontend (Vite Applications)
- **Pattern**: `VITE_*` prefix required
- **Examples**:
  - `VITE_SERVICE_ENCRYPTION_KEY` - Encryption key for OTP requests
  - `VITE_AUTH_API_URL` - Auth API URL
  - `VITE_MODS_API_URL` - Mods API URL

### Backend (Cloudflare Workers)
- **Pattern**: No `VITE_` prefix (standard environment variable names)
- **Examples**:
  - `SERVICE_ENCRYPTION_KEY` - Encryption key (must match frontend `VITE_SERVICE_ENCRYPTION_KEY` value)
  - `SERVICE_API_KEY` - Service-to-service authentication key
  - `JWT_SECRET` - JWT signing secret
  - `NETWORK_INTEGRITY_KEYPHRASE` - Network integrity verification keyphrase
  - `RESEND_API_KEY` - Resend email API key
  - `RESEND_FROM_EMAIL` - Resend from email address

## Required GitHub Secrets

The following secrets must be set in GitHub repository settings:

### Required for All Services
- `CF_API_TOKEN` - Cloudflare API token
- `CF_ACCOUNT_ID` - Cloudflare account ID
- `JWT_SECRET` - JWT signing secret (must match across all services)
- `VITE_SERVICE_ENCRYPTION_KEY` - Encryption key (used for frontend builds AND mapped to `SERVICE_ENCRYPTION_KEY` for workers)

### Required for OTP Auth Service
- `RESEND_API_KEY` - Resend email API key
- `RESEND_FROM_EMAIL` - Verified email address
- `SERVICE_API_KEY` - Service-to-service authentication key
- `NETWORK_INTEGRITY_KEYPHRASE` - Network integrity verification keyphrase

### Required for Customer API
- `SERVICE_API_KEY` - Service-to-service authentication key
- `NETWORK_INTEGRITY_KEYPHRASE` - Network integrity verification keyphrase

### Optional
- `ALLOWED_ORIGINS` - Comma-separated CORS origins
- `VITE_AUTH_API_URL` - Override auth API URL (defaults to https://auth.idling.app)
- `VITE_MODS_API_URL` - Override mods API URL (defaults to https://mods-api.idling.app)

## Configuration Sources Priority

### Frontend Builds (GitHub Actions)
1. GitHub Secrets: `VITE_SERVICE_ENCRYPTION_KEY`
2. Injected at build time via `env:` in workflow

### Cloudflare Workers
1. Worker Secrets (set via `wrangler secret put`)
2. Environment variables from `wrangler.toml` `[vars]` section
3. Secrets take precedence over vars

### Local Development
1. `.env` files (frontend)
2. `.dev.vars` files (workers)
3. Environment variables

## Verification Steps

### 1. Verify Worker Secrets
```bash
cd serverless/otp-auth-service
wrangler secret list
# Should show:
# - SERVICE_ENCRYPTION_KEY
# - JWT_SECRET
# - SERVICE_API_KEY
# - NETWORK_INTEGRITY_KEYPHRASE
# - RESEND_API_KEY
# - RESEND_FROM_EMAIL
```

### 2. Verify Frontend Build
```bash
# Check that VITE_SERVICE_ENCRYPTION_KEY is set
echo $VITE_SERVICE_ENCRYPTION_KEY
# Should output the key (32+ characters)
```

### 3. Verify Key Matching
```bash
# Get worker secret
cd serverless/otp-auth-service
wrangler secret get SERVICE_ENCRYPTION_KEY

# Compare with frontend .env
cat .env | grep VITE_SERVICE_ENCRYPTION_KEY

# They should have the SAME value
```

## PowerShell Script Status

The `serverless/set-all-encryption-keys.ps1` script is **CORRECT**:
- Sets `VITE_SERVICE_ENCRYPTION_KEY` in frontend `.env` files
- Sets `SERVICE_ENCRYPTION_KEY` in Cloudflare Workers
- Sets `SERVICE_API_KEY` in required workers

**No changes needed** - script already uses correct naming.

## Remaining Tasks

1. [x] Verify `NETWORK_INTEGRITY_KEYPHRASE` is set in all workers that use service client
   - [x] Added to `deploy-otp-auth.yml` workflow
   - [x] Added to `deploy-customer-api.yml` workflow
   - [x] Added to `deploy-mods-api.yml` workflow
   - [x] Added to `deploy-manager.yml` workflow (for otp-auth, customer-api, and mods-api)
2. [x] Update documentation to clarify frontend vs backend naming
   - [x] Updated `ENV_SETUP_GUIDE.md` with naming convention section
3. [ ] Add validation to prevent setting `VITE_*` variables in workers
   - **Note**: This would require runtime validation in worker code. Currently handled by documentation and code review.

## Testing Checklist

- [ ] OTP request/verify endpoints work with encrypted requests
- [ ] Service-to-service calls work (customer-api from otp-auth-service)
- [ ] Frontend builds successfully with `VITE_SERVICE_ENCRYPTION_KEY`
- [ ] Workers can decrypt requests using `SERVICE_ENCRYPTION_KEY`
- [ ] Network integrity verification works (if enabled)

## Related Files

### Code Changes
- `serverless/otp-auth-service/handlers/auth/request-otp.ts`
- `serverless/otp-auth-service/handlers/auth/verify-otp.ts`
- `.github/workflows/deploy-otp-auth.yml`
- `.github/workflows/deploy-manager.yml`

### Documentation
- `ENV_SETUP_GUIDE.md` - Environment setup guide
- `serverless/SET_SERVICE_KEY.md` - Service key setup
- `shared-config/README.md` - Shared configuration

## Notes

- The PowerShell script (`set-all-encryption-keys.ps1`) is already correct and doesn't need changes
- Frontend and backend use different variable names but must have the same value
- GitHub Actions workflows now correctly map frontend secrets to backend secrets
- All workers that use service-to-service calls need `NETWORK_INTEGRITY_KEYPHRASE`
