# TTL Issue Analysis - User Data Expiration

## Problem

User data is currently stored with a **1 year TTL** (`expirationTtl: 31536000`), which means:

1. **User accounts will be deleted** if the user doesn't log in for 1 year
2. **Data loss risk** - inactive users lose their accounts permanently
3. **Inconsistent behavior** - User preferences have no TTL (persistent), but user data expires

## Current Implementation

### User Data (Has TTL - PROBLEM)
```typescript
await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { 
    expirationTtl: 31536000 // 1 year - USER DATA WILL BE DELETED
});
```

**Locations:**
- `handlers/auth/verify-otp.ts:72`
- `handlers/auth/session.ts:88, 102`
- `handlers/user/displayName.js:199, 296`
- `handlers/user/twitch.ts:305, 418`
- `handlers/user/profilePicture.ts:171, 286`

### User Preferences (Has TTL - UPDATED)
```typescript
await env.OTP_AUTH_KV.put(preferencesKey, JSON.stringify(preferences), { 
    expirationTtl: 31536000 // 1 year - matches user data TTL [SUCCESS]
});
```

**Location:** `services/user-preferences.ts:79`
**Status:** [SUCCESS] **UPDATED** - Now matches user data TTL for consistency

## Impact

### What Happens:
1. User creates account [EMOJI] Data stored with 1 year TTL
2. User logs in [EMOJI] TTL resets to 1 year from login
3. User doesn't log in for 1 year [EMOJI] **Data is automatically deleted**
4. User tries to log in [EMOJI] Account doesn't exist, must create new account

### Data Lost:
- User ID
- Display name
- Display name history (stored in preferences, but user object is gone)
- Customer association
- Account creation date
- Last login date

### Data Preserved:
- User preferences (no TTL) - but orphaned if user data is deleted
- Customer data (no TTL)

## Recommended Fix

### Option 1: Remove TTL (Recommended)
User accounts should be persistent and not expire automatically.

```typescript
// Remove expirationTtl
await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user));
```

**Pros:**
- [SUCCESS] User accounts never expire
- [SUCCESS] Consistent with preferences storage
- [SUCCESS] No data loss

**Cons:**
- [WARNING] Inactive accounts accumulate (but this is expected behavior)

### Option 2: Much Longer TTL
If TTL is desired for cleanup, use a much longer period (e.g., 10 years).

```typescript
await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { 
    expirationTtl: 315360000 // 10 years
});
```

**Pros:**
- [SUCCESS] Very long retention period
- [SUCCESS] Automatic cleanup of truly abandoned accounts

**Cons:**
- [WARNING] Still has expiration risk
- [WARNING] Users inactive for 10+ years lose data

### Option 3: TTL Only on Updates
Only reset TTL when user actively uses the account, not on every read.

**Pros:**
- [SUCCESS] Automatic cleanup of truly inactive accounts
- [SUCCESS] Active users keep their data

**Cons:**
- [WARNING] More complex logic
- [WARNING] Still has expiration risk

## Recommendation

**Remove TTL from user data** - User accounts should be persistent like customer data and preferences.

Only temporary data should have TTL:
- [SUCCESS] OTP codes (600s / 10 minutes)
- [SUCCESS] Sessions (25200s / 7 hours)
- [SUCCESS] Rate limit data (3600s / 1 hour)
- [SUCCESS] Analytics (2592000s / 30 days)
- [ERROR] User accounts (should be persistent)
- [ERROR] User preferences (already persistent [SUCCESS])

---

**Status:** [WARNING] **ISSUE IDENTIFIED** - User data TTL should be removed
**Priority:** [RED] **HIGH** - Data loss risk for inactive users

