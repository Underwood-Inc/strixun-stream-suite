# Environment Setup Guide

> **Complete environment variable configuration guide for Strixun Stream Suite**

This document consolidates all environment setup documentation from across the codebase.

---

## Overview

Strixun Stream Suite requires environment variables to be configured in multiple locations for different parts of the application. This guide covers all required configurations.

---

## Environment Variable Locations

You need to create `.env` files in **3 locations**:

### 1. Main App (Root)
**Location**: `.env` (in the root directory, same level as `package.json`)

```bash
# Root directory .env
VITE_SERVICE_ENCRYPTION_KEY=KEY_HERE
VITE_AUTH_API_URL=https://auth.idling.app
```

### 2. Mods Hub
**Location**: `mods-hub/.env` (inside the mods-hub directory)

```bash
# mods-hub/.env
VITE_SERVICE_ENCRYPTION_KEY=KEY_HERE
VITE_AUTH_API_URL=https://auth.idling.app
```

### 3. URL Shortener App
**Location**: `serverless/url-shortener/app/.env` (inside the url-shortener app directory)

```bash
# serverless/url-shortener/app/.env
VITE_SERVICE_ENCRYPTION_KEY=KEY_HERE
VITE_AUTH_API_URL=https://auth.idling.app
```

---

## Quick Setup Commands

```bash
# 1. Root directory
echo "VITE_SERVICE_ENCRYPTION_KEY=KEY_HERE" > .env
echo "VITE_AUTH_API_URL=https://auth.idling.app" >> .env

# 2. Mods Hub
echo "VITE_SERVICE_ENCRYPTION_KEY=KEY_HERE" > mods-hub/.env
echo "VITE_AUTH_API_URL=https://auth.idling.app" >> mods-hub/.env

# 3. URL Shortener App
echo "VITE_SERVICE_ENCRYPTION_KEY=KEY_HERE" > serverless/url-shortener/app/.env
echo "VITE_AUTH_API_URL=https://auth.idling.app" >> serverless/url-shortener/app/.env
```

---

## File Structure

```
.
├── .env                          ★ CREATE THIS (root)
├── package.json
├── mods-hub/
│   ├── .env                      ★ CREATE THIS
│   └── package.json
└── serverless/
    └── url-shortener/
        └── app/
            ├── .env              ★ CREATE THIS
            └── package.json
```

---

## Frontend vs Backend Naming Convention

**IMPORTANT**: Frontend and backend use different variable names for the same encryption key:

### Frontend (Vite Applications)
- **Variable Name**: `VITE_SERVICE_ENCRYPTION_KEY`
- **Location**: `.env` files in frontend app directories
- **Why**: Vite requires the `VITE_` prefix for environment variables to be exposed to the client
- **Example**: `VITE_SERVICE_ENCRYPTION_KEY=your-key-here`

### Backend (Cloudflare Workers)
- **Variable Name**: `SERVICE_ENCRYPTION_KEY`
- **Location**: Cloudflare Worker secrets (set via `wrangler secret put`)
- **Why**: Workers don't use the `VITE_` prefix (that's only for Vite)
- **Example**: `wrangler secret put SERVICE_ENCRYPTION_KEY`

**CRITICAL**: Both must have the **SAME VALUE**, but different names for their respective environments. The frontend `VITE_SERVICE_ENCRYPTION_KEY` value must match the backend `SERVICE_ENCRYPTION_KEY` value.

---

## Verification

After creating the files, verify they exist:

```bash
# Check if files exist
ls -la .env
ls -la mods-hub/.env
ls -la serverless/url-shortener/app/.env
```

---

## Security Notes

- ✓ `.env` files are already in `.gitignore` (won't be committed)
- ✓ Never commit `.env` files to git
- ✓ Use the same key in all 3 locations
- ✓ Key must match server-side `SERVICE_ENCRYPTION_KEY` secret (same key as all other services)

---

## Current SERVICE_ENCRYPTION_KEY

```
KEY_HERE
```

**This is the same key used by ALL services** - no separate OTP key needed!

---

## Development vs Production

### Development Environment
- Use development worker URLs
- Can use same encryption keys
- Separate KV namespaces (optional)

### Production Environment
- Use production worker URLs
- Production encryption keys
- Production KV namespaces

See [Development Deployment Setup](../04_DEPLOYMENT/DEVELOPMENT_DEPLOYMENT_SETUP.md) for more details.

---

## Related Documentation

- [Development Deployment Setup](../04_DEPLOYMENT/DEVELOPMENT_DEPLOYMENT_SETUP.md) - Worker deployment configuration
- [Environment Variable Audit](../09_AUDITS_AND_REPORTS/ENV_VAR_AUDIT.md) - Complete environment variable audit
- [Security Guide](../05_SECURITY/README.md) - Security best practices

---

**Last Updated**: 2025-01-27

