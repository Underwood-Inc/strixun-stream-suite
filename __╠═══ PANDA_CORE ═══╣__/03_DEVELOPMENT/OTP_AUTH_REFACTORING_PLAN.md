# OTP Auth Service Refactoring Plan

**Last Updated:** 2025-12-29

## Current State
- `worker.js`: 4,200+ lines - monolithic file with all functionality

## Target State
Modular architecture with clear separation of concerns:

```
serverless/otp-auth-service/
├── worker.js (thin entry point, ~50 lines)
├── router.js (routing logic, ~200 lines)
├── utils/
│   ├── cache.js ✓ (customer caching)
│   ├── cors.js ✓ (CORS headers)
│   ├── crypto.js ✓ (OTP, JWT, hashing)
│   └── email.js ✓ (email templates & providers)
├── services/
│   ├── customer.js ✓ (customer management)
│   ├── api-key.js ✓ (API key management)
│   ├── rate-limit.js ✓ (rate limiting)
│   ├── analytics.js (usage tracking)
│   ├── webhooks.js (webhook handling)
│   └── security.js (security logging, IP checks)
└── handlers/
    ├── auth.js (OTP auth handlers)
    ├── admin.js (admin endpoints)
    ├── config.js (config management)
    ├── domain.js (domain verification)
    └── public.js (public endpoints)
```

## Progress
- ✓ Utils modules created (cache, cors, crypto, email)
- ✓ Core services created (customer, api-key, rate-limit)
- ℹ Handler modules (in progress)
- ℹ Router module (pending)
- ℹ Worker.js refactor (pending)

## Next Steps
1. Create remaining service modules (analytics, webhooks, security)
2. Extract handlers into separate modules
3. Create router module
4. Refactor worker.js to be thin entry point
5. Test with wrangler deploy
