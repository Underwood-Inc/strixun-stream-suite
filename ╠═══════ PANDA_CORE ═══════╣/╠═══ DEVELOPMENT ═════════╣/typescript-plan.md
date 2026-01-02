# TypeScript Conversion Plan

## Status: IN PROGRESS

### ✓ Completed Conversions
- `utils/cors.js`  `cors.ts`
- `router/auth-routes.js`  `auth-routes.ts`
- `handlers/auth/otp.js`  Split into 6 TypeScript modules

### ★ Critical Priority - Convert Next (Used Everywhere)

#### Utilities (High Priority - Used by all handlers)
1. `utils/cors.js`  ✓ `cors.ts` - DONE
2. `utils/crypto.js`  `crypto.ts` - NEEDS CONVERSION
3. `utils/validation.js`  `validation.ts` - NEEDS CONVERSION
4. `utils/cache.js`  `cache.ts` - NEEDS CONVERSION
5. `utils/jwt-encryption.js`  `jwt-encryption.ts` - NEEDS CONVERSION

#### Services (High Priority - Core business logic)
1. `services/customer.js`  `customer.ts` - NEEDS CONVERSION
2. `services/api-key.js`  `api-key.ts` - NEEDS CONVERSION
3. `services/rate-limit.js`  `rate-limit.ts` - NEEDS CONVERSION
4. `services/analytics.js`  `analytics.ts` - NEEDS CONVERSION
5. `services/webhooks.js`  `webhooks.ts` - NEEDS CONVERSION
6. `services/security.js`  `security.ts` - NEEDS CONVERSION

#### Routers (High Priority - Request routing)
1. `router/auth-routes.js`  ✓ `auth-routes.ts` - DONE
2. `router/public-routes.js`  `public-routes.ts` - NEEDS CONVERSION
3. `router/admin-routes.js`  `admin-routes.ts` - NEEDS CONVERSION
4. `router/user-routes.js`  `user-routes.ts` - NEEDS CONVERSION
5. `router/game-routes.js`  `game-routes.ts` - NEEDS CONVERSION

#### Handlers (Medium Priority - Endpoint handlers)
1. `handlers/auth/session.js`  `session.ts`
2. `handlers/auth/quota.js`  `quota.ts`
3. `handlers/auth/debug.js`  `debug.ts`
4. `handlers/public.js`  `public.ts`
5. `handlers/admin.js`  `admin.ts`
6. All game handlers
7. All user handlers
8. All admin handlers

### ★ Medium Priority - Other Workers

#### URL Shortener
- `router/routes.js`  `routes.ts`
- `handlers/url.js`  `url.ts`
- `handlers/page.js`  `page.ts`
- `handlers/health.js`  `health.ts`
- `utils/cors.js`  `cors.ts`
- `utils/auth.js`  `auth.ts`
- `utils/url.js`  `url.ts`

#### Chat Signaling
- `router/routes.js`  `routes.ts`
- `handlers/signaling.js`  `signaling.ts`
- `handlers/party.js`  `party.ts`
- `handlers/health.js`  `health.ts`
- `utils/cors.js`  `cors.ts`
- `utils/auth.js`  `auth.ts`
- `utils/room.js`  `room.ts`

#### Game API
- `router/game-routes.js`  `game-routes.ts`
- All game handlers
- All utils

#### Twitch API
- `router.js`  `router.ts`
- All handlers
- All utils

### ★ Low Priority - Scripts & Config
- Build scripts (can remain .js)
- Config files (svelte.config.js, etc.)
- Auto-generated files

## Rules Added to .cursorrules
- ✓ Added strict TypeScript prohibition rules
- ✓ Added type safety requirements
- ✓ Added examples of correct/incorrect usage

