# Dead Code & Modularization Plan

## Current State

### File Sizes
- `serverless/worker.js`: **3277 lines** ❌ (should be ~300)
- `serverless/url-shortener/worker.js`: **1628 lines** ❌ (should be ~300)
- `serverless/chat-signaling/worker.js`: **915 lines** ❌ (should be ~300)
- `serverless/otp-auth-service/worker.js`: **25 lines** ✅ (already modularized)

## Dead Code Identified

### 1. Duplicate OTP Auth in Root Worker ❌
**Location**: `serverless/worker.js` lines ~1774-2534

**Problem**: Root worker has its own OTP auth implementation that duplicates `otp-auth-service/`

**Functions to Remove**:
- `generateOTP()` - line 1780
- `hashEmail()` - line 1796
- `generateUserId()` - line 1809
- `createJWT()` - line 1820
- `verifyJWT()` - line 1853
- `getJWTSecret()` - line 1909
- `checkOTPRateLimit()` - line 1922
- `sendOTPEmail()` - line 1978
- `handleRequestOTP()` - line 2081
- `handleVerifyOTP()` - line 2177
- `handleGetMe()` - line 2347
- `handleLogout()` - line 2404
- `handleRefresh()` - line 2458
- `authenticateRequest()` - line 2551 (duplicate, but used by other handlers)

**Action**: Remove all OTP auth endpoints from root worker. Users should use `otp-auth-service` instead.

**Endpoints to Remove**:
- `/auth/request-otp` - line 3203
- `/auth/verify-otp` - line 3204
- `/auth/me` - line 3205
- `/auth/logout` - line 3206
- `/auth/refresh` - line 3207
- `/debug/clear-rate-limit` - line 3224

### 2. Duplicate CORS Function ❌
**Location**: Multiple files

**Problem**: `getCorsHeaders()` is duplicated in:
- `serverless/worker.js` - line 18
- `serverless/url-shortener/worker.js` - line 16
- `serverless/chat-signaling/worker.js` - line 16
- `serverless/otp-auth-service/utils/cors.js` - ✅ (already extracted)

**Action**: Use shared `serverless/utils/cors.js` (already created)

### 3. Duplicate JWT Functions ❌
**Location**: `serverless/url-shortener/worker.js` and `serverless/chat-signaling/worker.js`

**Problem**: Both have their own `verifyJWT()` implementations

**Action**: Extract to shared utility or use from OTP auth service

## Modularization Plan

### Root Worker (`serverless/worker.js`)

**Current**: 3277 lines
**Target**: ~300 lines

**Extract to Modules**:

1. **Twitch API** → `serverless/handlers/twitch.js` ✅ (created)
   - `handleClips()`
   - `handleFollowing()`
   - `handleGame()`
   - `handleUser()`
   - `getAppAccessToken()`
   - `twitchApiRequest()`
   - `getUserId()`

2. **Cloud Storage** → `serverless/handlers/cloud-storage.js`
   - `handleCloudSave()`
   - `handleCloudLoad()`
   - `handleCloudList()`
   - `handleCloudDelete()`
   - `updateCloudSaveSlotList()`

3. **Notes** → `serverless/handlers/notes.js`
   - `handleNotesSave()`
   - `handleNotesLoad()`
   - `handleNotesList()`
   - `handleNotesDelete()`

4. **OBS Credentials** → `serverless/handlers/obs.js`
   - `handleOBSCredentialsSave()`
   - `handleOBSCredentialsLoad()`
   - `handleOBSCredentialsDelete()`

5. **Scrollbar CDN** → `serverless/cdn/scrollbar.js`
   - Extract inline code strings to separate files
   - `handleScrollbar()`
   - `handleScrollbarCustomizer()`
   - `handleScrollbarCompensation()`

6. **Auth Utilities** → `serverless/utils/auth.js`
   - `authenticateRequest()` (keep, used by other handlers)
   - Move JWT functions here if needed

7. **Test Endpoints** → `serverless/handlers/test.js`
   - `handleTestEmail()`

### URL Shortener (`serverless/url-shortener/worker.js`)

**Current**: 1628 lines
**Target**: ~300 lines

**Extract to Modules**:

1. **Handlers** → `serverless/url-shortener/handlers/`
   - `handleCreateShortUrl()`
   - `handleGetUrlInfo()`
   - `handleListUrls()`
   - `handleDeleteUrl()`
   - `handleRedirect()`
   - `handleHealth()`
   - `handleStandalonePage()`

2. **Utils** → `serverless/url-shortener/utils/`
   - `verifyJWT()` → use shared or OTP auth service
   - `generateShortCode()`
   - `isValidUrl()`
   - `isValidShortCode()`
   - `getJWTSecret()`

3. **Services** → `serverless/url-shortener/services/`
   - URL storage/retrieval logic

### Chat Signaling (`serverless/chat-signaling/worker.js`)

**Current**: 915 lines
**Target**: ~300 lines

**Extract to Modules**:

1. **Handlers** → `serverless/chat-signaling/handlers/`
   - `handleCreateRoom()`
   - `handleJoinRoom()`
   - `handleSendOffer()`
   - `handleGetOffer()`
   - `handleSendAnswer()`
   - `handleGetAnswer()`
   - `handleHeartbeat()`
   - `handleGetRooms()`
   - `handleLeaveRoom()`
   - `handleCreatePartyRoom()`
   - `handleGetPartyRooms()`
   - `handleInviteToPartyRoom()`
   - `handleHealth()`

2. **Utils** → `serverless/chat-signaling/utils/`
   - `hashEmail()` → use shared
   - `verifyJWT()` → use shared or OTP auth service

3. **Services** → `serverless/chat-signaling/services/`
   - Room management
   - Signaling logic

## Implementation Order

1. ✅ Create shared CORS utility
2. ✅ Extract Twitch handlers
3. ⏳ Remove duplicate OTP auth from root worker
4. ⏳ Extract Cloud Storage handlers
5. ⏳ Extract Notes handlers
6. ⏳ Extract OBS handlers
7. ⏳ Extract Scrollbar CDN code
8. ⏳ Modularize URL Shortener
9. ⏳ Modularize Chat Signaling
10. ⏳ Create shared auth utilities
11. ⏳ Update all workers to use shared utilities

## Dead Code Removal Checklist

- [ ] Remove OTP auth endpoints from root worker (use otp-auth-service instead)
- [ ] Remove duplicate `getCorsHeaders()` from all workers (use shared)
- [ ] Remove duplicate `verifyJWT()` from url-shortener (use shared)
- [ ] Remove duplicate `verifyJWT()` from chat-signaling (use shared)
- [ ] Remove duplicate `hashEmail()` from chat-signaling (use shared)
- [ ] Remove test/debug endpoints if not needed in production

## Benefits

1. **Maintainability**: Each module < 300 lines, single responsibility
2. **Reusability**: Shared utilities across all workers
3. **Testability**: Individual modules can be tested in isolation
4. **Performance**: Smaller bundle sizes, faster cold starts
5. **Clarity**: Clear separation of concerns

