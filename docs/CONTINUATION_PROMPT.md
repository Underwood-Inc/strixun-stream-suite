# Continuation Prompt for Enhanced API Framework Implementation

**Copy and paste this entire prompt into a new chat instance to continue the work:**

---

## Context: Enhanced API Framework Implementation

I'm implementing an enhanced API framework architecture for a Cloudflare Workers + Cloudflare Pages (static files) serverless application. The framework extends the existing `src/core/api/` framework with:

1. **End-to-End Encryption** (JWT-based, only email holder can decrypt)
2. **Response Filtering** (opt-in tag system, type-based)
3. **Type-Based Response Building** (TypeScript type enforcement)
4. **RFC 7807 Error Handling** (with error legend integration)
5. **Cloudflare Worker Compatibility** (PRIMARY target)

## Current State

### ✅ Completed
- Architecture proposal documents (`docs/API_FRAMEWORK_ENHANCED_ARCHITECTURE.md`)
- Type definitions (`src/core/api/enhanced/types.ts`)
- E2E encryption middleware (`src/core/api/enhanced/encryption/jwt-encryption.ts`)
- RFC 7807 error formatter (`src/core/api/enhanced/errors/rfc7807.ts`)
- Error legend integration (`src/core/api/enhanced/errors/legend-integration.ts`)
- Response filtering middleware (`src/core/api/enhanced/filtering/response-filter.ts`)
- Tag system (`src/core/api/enhanced/filtering/tag-system.ts`)
- Type parser placeholder (`src/core/api/enhanced/filtering/type-parser.ts`)

### ❌ Still Need to Implement
1. **Response Builder** (`src/core/api/enhanced/building/response-builder.ts`) - Type-based response building with automatic root config inclusion
2. **Metric Computer** (`src/core/api/enhanced/building/metric-computer.ts`) - On-demand metric computation with caching
3. **Cloudflare Worker Adapter** (`src/core/api/enhanced/workers/adapter.ts`) - Worker compatibility layer
4. **KV Cache** (`src/core/api/enhanced/workers/kv-cache.ts`) - KV-based caching for Workers
5. **Platform Detection** (`src/core/api/enhanced/workers/platform.ts`) - Auto-detect Worker vs Browser
6. **CORS Handler** (`src/core/api/enhanced/workers/cors.ts`) - CORS handling for Workers
7. **Enhanced API Client Factory** (`src/core/api/enhanced/client.ts`) - Main client that ties everything together
8. **Main Export** (`src/core/api/enhanced/index.ts`) - Public API

## Key Requirements

### Root Config Type Enforcement
- Define `RootResponseConfig` interface with `id` and `customerId` (always included)
- Use `APIResponse<T> = RootResponseConfig & T` type utility
- TypeScript enforces at compile-time (no runtime checks needed)
- All responses automatically include root fields

### E2E Encryption
- Uses JWT token as key derivation source (PBKDF2, 100,000 iterations)
- AES-GCM-256 encryption
- Only JWT holder (email owner) can decrypt
- Automatic encryption/decryption middleware

### Response Filtering
- Opt-in tag system (`?tags=summary,detailed`)
- Field-level filtering (`?include=field1,field2&exclude=field3`)
- Type-based (extracts from TypeScript interfaces)
- Root config fields always included

### Error Handling
- RFC 7807 format on every error
- Error legend integration (from `shared-components/error-mapping/error-legend.ts`)
- Rate limit details included
- Standardized across all services

### Cloudflare Workers (PRIMARY)
- Uses KV for caching (not IndexedDB)
- Uses Web Crypto API (available in Workers)
- CORS handling
- Platform auto-detection

## Architecture Files to Reference

- `docs/API_FRAMEWORK_ENHANCED_ARCHITECTURE.md` - Full architecture proposal
- `docs/API_FRAMEWORK_TYPE_ENFORCEMENT_EXAMPLE.md` - Type enforcement examples
- `docs/API_FRAMEWORK_CLOUDFLARE_WORKERS_FOCUS.md` - Workers compatibility details
- `shared-components/error-mapping/error-legend.ts` - Error legend system (already exists)
- `serverless/otp-auth-service/utils/jwt-encryption.js` - Reference implementation for E2E encryption

## Existing Framework

The enhanced framework extends `src/core/api/` which already has:
- Middleware pipeline
- Caching (memory + IndexedDB for browser)
- Retry logic
- Circuit breaker
- Request deduplication
- Request queuing
- Error handling middleware
- Auth middleware

## Services to Migrate

1. **OTP Auth Service** (`serverless/otp-auth-service/`) - Has E2E encryption, RFC 7807 errors
2. **URL Shortener** (`serverless/url-shortener/`) - Needs migration
3. **Chat Signaling** (`serverless/chat-signaling/`) - Needs migration

## Next Steps

1. Complete the response builder with type-based building
2. Implement metric computation system
3. Create Cloudflare Worker adapter
4. Create KV cache adapter
5. Build enhanced API client factory
6. Create main export
7. Test with existing services
8. Migrate services one by one

## Important Notes

- **Cloudflare Workers is PRIMARY** - all features designed for Workers first
- **Browser support is SECONDARY** - for client-side (dashboard, static sites)
- **Node.js is OPTIONAL** - development only
- **No Node.js APIs** - only Web Standard APIs
- **Backward compatible** - existing code continues to work
- **Opt-in everything** - all features are opt-in

## Code Style

- TypeScript with strict types
- Use existing patterns from `src/core/api/`
- Follow Cloudflare Workers best practices
- Maintain backward compatibility
- Comprehensive error handling
- Type-safe everywhere

---

**Please continue implementing the remaining components, starting with the response builder and metric computer, then the Cloudflare Worker adapter, and finally the enhanced client factory. Make sure everything is type-safe and follows the architecture we've designed.**

