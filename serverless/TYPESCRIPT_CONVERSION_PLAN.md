# TypeScript Conversion Plan

## Status: IN PROGRESS

### [SUCCESS] Completed Conversions
- `utils/cors.js` [EMOJI] `cors.ts`
- `router/auth-routes.js` [EMOJI] `auth-routes.ts`
- `handlers/auth/otp.js` [EMOJI] Split into 6 TypeScript modules

### [RED] Critical Priority - Convert Next (Used Everywhere)

#### Utilities (High Priority - Used by all handlers)
1. `utils/cors.js` [EMOJI] [SUCCESS] `cors.ts` - DONE
2. `utils/crypto.js` [EMOJI] `crypto.ts` - NEEDS CONVERSION
3. `utils/validation.js` [EMOJI] `validation.ts` - NEEDS CONVERSION
4. `utils/cache.js` [EMOJI] `cache.ts` - NEEDS CONVERSION
5. `utils/jwt-encryption.js` [EMOJI] `jwt-encryption.ts` - NEEDS CONVERSION

#### Services (High Priority - Core business logic)
1. `services/customer.js` [EMOJI] `customer.ts` - NEEDS CONVERSION
2. `services/api-key.js` [EMOJI] `api-key.ts` - NEEDS CONVERSION
3. `services/rate-limit.js` [EMOJI] `rate-limit.ts` - NEEDS CONVERSION
4. `services/analytics.js` [EMOJI] `analytics.ts` - NEEDS CONVERSION
5. `services/webhooks.js` [EMOJI] `webhooks.ts` - NEEDS CONVERSION
6. `services/security.js` [EMOJI] `security.ts` - NEEDS CONVERSION

#### Routers (High Priority - Request routing)
1. `router/auth-routes.js` [EMOJI] [SUCCESS] `auth-routes.ts` - DONE
2. `router/public-routes.js` [EMOJI] `public-routes.ts` - NEEDS CONVERSION
3. `router/admin-routes.js` [EMOJI] `admin-routes.ts` - NEEDS CONVERSION
4. `router/user-routes.js` [EMOJI] `user-routes.ts` - NEEDS CONVERSION
5. `router/game-routes.js` [EMOJI] `game-routes.ts` - NEEDS CONVERSION

#### Handlers (Medium Priority - Endpoint handlers)
1. `handlers/auth/session.js` [EMOJI] `session.ts`
2. `handlers/auth/quota.js` [EMOJI] `quota.ts`
3. `handlers/auth/debug.js` [EMOJI] `debug.ts`
4. `handlers/public.js` [EMOJI] `public.ts`
5. `handlers/admin.js` [EMOJI] `admin.ts`
6. All game handlers
7. All user handlers
8. All admin handlers

### [YELLOW] Medium Priority - Other Workers

#### URL Shortener
- `router/routes.js` [EMOJI] `routes.ts`
- `handlers/url.js` [EMOJI] `url.ts`
- `handlers/page.js` [EMOJI] `page.ts`
- `handlers/health.js` [EMOJI] `health.ts`
- `utils/cors.js` [EMOJI] `cors.ts`
- `utils/auth.js` [EMOJI] `auth.ts`
- `utils/url.js` [EMOJI] `url.ts`

#### Chat Signaling
- `router/routes.js` [EMOJI] `routes.ts`
- `handlers/signaling.js` [EMOJI] `signaling.ts`
- `handlers/party.js` [EMOJI] `party.ts`
- `handlers/health.js` [EMOJI] `health.ts`
- `utils/cors.js` [EMOJI] `cors.ts`
- `utils/auth.js` [EMOJI] `auth.ts`
- `utils/room.js` [EMOJI] `room.ts`

#### Game API
- `router/game-routes.js` [EMOJI] `game-routes.ts`
- All game handlers
- All utils

#### Twitch API
- `router.js` [EMOJI] `router.ts`
- All handlers
- All utils

### [GREEN] Low Priority - Scripts & Config
- Build scripts (can remain .js)
- Config files (svelte.config.js, etc.)
- Auto-generated files

## Rules Added to .cursorrules
- [SUCCESS] Added strict TypeScript prohibition rules
- [SUCCESS] Added type safety requirements
- [SUCCESS] Added examples of correct/incorrect usage

