# Workers Deployment Audit

**Date**: 2024-12-19  
**Status**: [RED] **Missing mods-api in deploy-all.js**

## Summary

Found **7 workers** in the codebase, but `deploy-all.js` only deploys **6 workers**. The **mods-api** worker is missing from the deployment script.

---

## [SUCCESS] All Workers Found

1. **twitch-api** (`strixun-twitch-api`)
   - Path: `serverless/twitch-api`
   - Worker name: `strixun-twitch-api`
   - Custom domain: `api.idling.app`
   - [SUCCESS] **Included in deploy-all.js**

2. **otp-auth-service** (`otp-auth-service`)
   - Path: `serverless/otp-auth-service`
   - Worker name: `otp-auth-service`
   - Custom domain: `auth.idling.app`
   - [SUCCESS] **Included in deploy-all.js**

3. **customer-api** (`strixun-customer-api`)
   - Path: `serverless/customer-api`
   - Worker name: `strixun-customer-api`
   - Custom domain: `customer-api.idling.app`
   - [SUCCESS] **Included in deploy-all.js**

4. **game-api** (`strixun-game-api`)
   - Path: `serverless/game-api`
   - Worker name: `strixun-game-api`
   - Custom domain: `game.idling.app`
   - [SUCCESS] **Included in deploy-all.js**

5. **url-shortener** (`strixun-url-shortener`)
   - Path: `serverless/url-shortener`
   - Worker name: `strixun-url-shortener`
   - Custom domain: `s.idling.app`
   - [SUCCESS] **Included in deploy-all.js**

6. **chat-signaling** (`strixun-chat-signaling`)
   - Path: `serverless/chat-signaling`
   - Worker name: `strixun-chat-signaling`
   - Custom domain: `chat.idling.app`
   - [SUCCESS] **Included in deploy-all.js**

7. **mods-api** (`strixun-mods-api`) [RED] **MISSING**
   - Path: `serverless/mods-api`
   - Worker name: `strixun-mods-api`
   - Custom domain: `mods-api.idling.app` (configured in routes)
   - [ERROR] **NOT included in deploy-all.js**

---

## [CONFIG] Fix Required

Add `mods-api` to the `services` array in `serverless/deploy-all.js`:

```javascript
const services = [
  { name: 'Twitch API', path: 'twitch-api', worker: 'strixun-twitch-api', command: 'wrangler deploy' },
  { name: 'OTP Auth Service', path: 'otp-auth-service', worker: 'otp-auth-service', command: 'pnpm run deploy' },
  { name: 'Customer API', path: 'customer-api', worker: 'strixun-customer-api', command: 'wrangler deploy' },
  { name: 'Game API', path: 'game-api', worker: 'strixun-game-api', command: 'wrangler deploy' },
  { name: 'URL Shortener', path: 'url-shortener', worker: 'strixun-url-shortener', command: 'wrangler deploy --env production' },
  { name: 'Chat Signaling', path: 'chat-signaling', worker: 'strixun-chat-signaling', command: 'wrangler deploy' },
  { name: 'Mods API', path: 'mods-api', worker: 'strixun-mods-api', command: 'wrangler deploy' }, // [EMOJI] ADD THIS
];
```

---

## [CLIPBOARD] Deployment Commands

All workers use standard `wrangler deploy` except:
- **OTP Auth Service**: Uses `pnpm run deploy` (has build step)
- **URL Shortener**: Uses `wrangler deploy --env production` (has environment-specific config)

**Mods API** should use: `wrangler deploy`

---

## [SUCCESS] Verification

After adding mods-api, the deploy-all script should deploy **7 workers** instead of 6.

