# Encryption & Privacy System - Comprehensive Audit 🔒⚓

> **Fresh audit of encryption architecture, privacy features, and what's needed for userId (email) double-encryption**

---

## 📋 Executive Summary

This audit identifies:
1. ✅ **What exists** - Router encryption, two-stage encryption utilities
2. ❌ **What's missing** - User preferences, data request system, email privacy, userId double-encryption
3. 🔧 **What needs integration** - Two-stage encryption with router, userId field handling

---

## ✅ What Exists (Current State)

### 1. Router-Level Automatic Encryption ✅ **COMPLETE**

**Location:** `serverless/otp-auth-service/router/admin-routes.ts`, `router/game-routes.js`

**What Works:**
- ✅ Router automatically encrypts ALL responses with requester's JWT
- ✅ Encryption happens in `handleAdminRoute()` and `handleGameRoute()`
- ✅ Uses `encryptWithJWT()` from `utils/jwt-encryption.js`
- ✅ Sets `X-Encrypted: true` header
- ✅ Client automatically decrypts with `decryptWithJWT()` in API client
- ✅ Works for all authenticated routes (admin, game, user routes)

**Code Flow:**
```typescript
// router/admin-routes.ts:179-183
if ('jwtToken' in auth && auth.jwtToken && handlerResponse.ok) {
    const { encryptWithJWT } = await import('../utils/jwt-encryption.js');
    const responseData = await handlerResponse.json();
    const encrypted = await encryptWithJWT(responseData, auth.jwtToken);
    // ... returns encrypted response
}
```

**Status:** ✅ **WORKING** - All responses are automatically encrypted with requester's JWT

---

### 2. Two-Stage Encryption Utilities ✅ **COMPLETE**

**Location:** `serverless/otp-auth-service/utils/two-stage-encryption.ts`

**What Works:**
- ✅ `encryptTwoStage()` - Encrypts data with owner's JWT (Stage 1) + request key (Stage 2)
- ✅ `decryptTwoStage()` - Decrypts Stage 2 with request key, then Stage 1 with owner's JWT
- ✅ `generateRequestKey()` - Generates secure request keys
- ✅ `isDoubleEncrypted()` - Checks if data is double-encrypted
- ✅ Proper error handling and key verification
- ✅ Uses PBKDF2 key derivation (100,000 iterations)
- ✅ AES-GCM-256 encryption

**Status:** ✅ **COMPLETE** - Utilities exist but NOT integrated into handlers

---

### 3. JWT Encryption Utilities ✅ **COMPLETE**

**Location:** `serverless/otp-auth-service/utils/jwt-encryption.js`

**What Works:**
- ✅ `encryptWithJWT()` - Encrypts data with JWT token
- ✅ `decryptWithJWT()` - Decrypts data with JWT token
- ✅ Token hash verification
- ✅ AES-GCM-256 encryption
- ✅ PBKDF2 key derivation

**Status:** ✅ **WORKING** - Used by router for automatic encryption

---

### 4. Display Name System ✅ **PARTIALLY COMPLETE**

**Location:** `serverless/otp-auth-service/services/nameGenerator.ts`, `handlers/user/displayName.js`

**What Works:**
- ✅ Random display name generation
- ✅ Display name uniqueness checking
- ✅ Display name reservation/release
- ✅ Display name validation
- ✅ Display name stored in user object
- ✅ Display name auto-generated on user creation
- ✅ Display name update endpoint (`PUT /user/display-name`)

**What's Missing:**
- ❌ Display name change history tracking
- ❌ Monthly change limit enforcement
- ❌ Display name regeneration endpoint
- ❌ "Previously known as" tooltip support

**Status:** ✅ **PARTIAL** - Core functionality works, history/limits missing

---

### 5. Super Admin System ✅ **COMPLETE**

**Location:** `serverless/otp-auth-service/utils/super-admin.js`

**What Works:**
- ✅ Super admin API key authentication
- ✅ Super admin email list authentication
- ✅ Super admin check in admin routes

**Status:** ✅ **WORKING**

---

## ❌ What's Missing (Required Features)

### 1. userId (Email) Double-Encryption ❌ **NOT IMPLEMENTED**

**Current State:**
- ❌ `userId` field is returned in plain text (single-encrypted by router only)
- ❌ No double-encryption applied to `userId` field
- ❌ No check for user preferences (email visibility)
- ❌ No request system integration

**Where userId is Currently Returned:**
1. `handlers/auth/session.js:76-77` - `GET /auth/me` returns `sub: user.userId, email: user.email`
2. `handlers/admin/customers.js:83` - `GET /admin/customers/me` returns `email: customer.email`
3. `handlers/auth/jwt-creation.ts:133` - Token response includes `email: emailLower`

**What Needs to Be Built:**
- [ ] Check user preferences for `emailVisibility`
- [ ] If `emailVisibility === 'private'`, double-encrypt `userId` field
- [ ] If `emailVisibility === 'public'`, return `userId` single-encrypted (router handles this)
- [ ] Integrate two-stage encryption into response builders
- [ ] Update all handlers that return `userId` or `email` fields

**Architecture:**
```
Handler Response:
{
  id: "req_123...",           // Single-encrypted (router)
  customerId: "cust_abc...",  // Single-encrypted (router)
  userId: {                   // Double-encrypted (if private)
    doubleEncrypted: true,
    stage1: {...},            // Owner's JWT
    stage2: {...}             // Request key
  }
}
    ↓
Router encrypts entire response with requester's JWT
    ↓
Client receives encrypted blob
    ↓
Client decrypts router encryption → gets double-encrypted userId
    ↓
To decrypt userId: Need owner's JWT + approved request key
```

---

### 2. User Preferences System ❌ **NOT IMPLEMENTED**

**Requirements:**
- User preferences storage (email visibility, privacy settings)
- Preferences API endpoints
- Default preferences on user creation

**What Needs to Be Built:**
- [ ] User preferences data structure:
  ```typescript
  interface UserPreferences {
    emailVisibility: 'private' | 'public';  // Default: 'private'
    displayName: {
      current: string;
      previousNames: Array<{
        name: string;
        changedAt: string;
        reason: 'auto-generated' | 'user-changed' | 'regenerated';
      }>;
      lastChangedAt: string | null;
      changeCount: number;
    };
    privacy: {
      showEmail: boolean;
      showProfilePicture: boolean;
    };
  }
  ```
- [ ] Preferences storage in user object (KV: `user_${emailHash}`)
- [ ] `GET /user/me/preferences` endpoint
- [ ] `PUT /user/me/preferences` endpoint
- [ ] Preferences validation
- [ ] Default preferences on user creation

**Status:** ❌ **NOT IMPLEMENTED**

---

### 3. Sensitive Data Request System ❌ **NOT IMPLEMENTED**

**Requirements:**
- Super admin can create requests for sensitive data
- User (owner) can approve/reject requests
- Request key management
- Request status tracking

**What Needs to Be Built:**
- [ ] Request data structure:
  ```typescript
  interface DataRequest {
    requestId: string;
    requesterId: string;        // Super admin customerId
    targetUserId: string;        // User whose data is requested
    dataType: 'email' | 'userId' | 'custom';
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'expired';
    requestKey?: string;         // Encrypted with requester's JWT when approved
    createdAt: string;
    approvedAt?: string;
    rejectedAt?: string;
    expiresAt: string;
  }
  ```
- [ ] Request storage in KV (`data_request_${requestId}`)
- [ ] `POST /admin/data-requests` - Create request
- [ ] `GET /admin/data-requests` - List requests
- [ ] `GET /admin/data-requests/:id` - Get request details
- [ ] `POST /admin/data-requests/:id/approve` - Approve request (user endpoint)
- [ ] `POST /admin/data-requests/:id/reject` - Reject request (user endpoint)
- [ ] Request key encryption with requester's JWT
- [ ] Request expiration handling

**Status:** ❌ **NOT IMPLEMENTED**

---

### 4. Email Privacy Filtering ❌ **NOT IMPLEMENTED**

**Requirements:**
- Emails should NOT be rendered unless user makes them public
- Only display name shown by default
- If email is public, show as tooltip on hover over display name

**What Needs to Be Built:**
- [ ] Filter email from API responses if `emailVisibility === 'private'`
- [ ] Return `userId` as double-encrypted object if private
- [ ] Frontend logic to show/hide email based on preference
- [ ] Tooltip component integration for email display
- [ ] Update all handlers that return email/userId

**Status:** ❌ **NOT IMPLEMENTED**

---

### 5. Display Name History & Limits ❌ **NOT IMPLEMENTED**

**Requirements:**
- Track all display name changes
- Show "previously known as" in tooltips
- Enforce monthly change limit (once per month)
- Display name regeneration endpoint

**What Needs to Be Built:**
- [ ] Display name history array in user object
- [ ] Monthly change limit check in `PUT /user/display-name`
- [ ] `POST /user/display-name/regenerate` endpoint
- [ ] Tooltip component for "previously known as"
- [ ] Frontend integration

**Status:** ❌ **NOT IMPLEMENTED**

---

## 🔧 Integration Requirements

### 1. Two-Stage Encryption Integration

**Current State:**
- ✅ Two-stage encryption utilities exist
- ❌ NOT integrated into response builders
- ❌ NOT used in any handlers

**What Needs to Happen:**
1. Create response builder utility that:
   - Checks user preferences for `emailVisibility`
   - If private, double-encrypts `userId` field with owner's JWT + request key
   - If public, returns `userId` as normal (router will single-encrypt)
2. Update all handlers that return `userId`/`email`:
   - `handlers/auth/session.js` - `GET /auth/me`
   - `handlers/admin/customers.js` - `GET /admin/customers/me`
   - Any other handlers returning user data

**Challenge:**
- Need owner's JWT token to encrypt Stage 1
- Need request key to encrypt Stage 2 (but requests don't exist yet)
- **Solution:** For initial implementation, use a default request key or generate one per user

---

### 2. Router Encryption + Double-Encryption Flow

**Architecture:**
```
Handler Response:
{
  id: "req_123...",           // Single-encrypted (router)
  customerId: "cust_abc...",  // Single-encrypted (router)
  userId: {                   // Double-encrypted (if private)
    doubleEncrypted: true,
    stage1: {...},            // Owner's JWT
    stage2: {...}             // Request key
  }
}
    ↓
Router encrypts ENTIRE response with requester's JWT
    ↓
Client receives:
{
  version: 3,
  encrypted: true,
  data: "<encrypted_base64>"  // Contains id, customerId, and double-encrypted userId
}
    ↓
Client decrypts router encryption:
{
  id: "req_123...",           // ✅ Available (single-encrypted)
  customerId: "cust_abc...",  // ✅ Available (single-encrypted)
  userId: {                   // ⚠️ Still double-encrypted
    doubleEncrypted: true,
    stage1: {...},
    stage2: {...}
  }
}
    ↓
To decrypt userId:
1. Get approved request (has request key encrypted with requester's JWT)
2. Decrypt request key with requester's JWT
3. Decrypt Stage 2 with request key
4. Decrypt Stage 1 with owner's JWT (provided by system)
5. Get: "user@example.com"
```

---

## 📊 Implementation Priority

### Phase 1: Foundation (CRITICAL) 🔴
1. **User Preferences System**
   - Create preferences structure
   - Add to user object
   - Create default preferences
   - Build preferences API

2. **userId Double-Encryption Integration**
   - Create response builder utility
   - Integrate two-stage encryption
   - Update handlers to use response builder
   - Handle owner's JWT retrieval

### Phase 2: Request System (HIGH) 🟠
3. **Sensitive Data Request System**
   - Request data structure
   - Request storage
   - Request endpoints (create, list, approve, reject)
   - Request key management

### Phase 3: Display Name Enhancements (MEDIUM) 🟡
4. **Display Name History & Limits**
   - History tracking
   - Monthly limit enforcement
   - Regeneration endpoint
   - Tooltip support

### Phase 4: Frontend Integration (MEDIUM) 🟡
5. **Email Privacy UI**
   - Tooltip component
   - Email visibility toggle
   - "Previously known as" display

---

## 🎯 Key Findings

### ✅ What's Working
1. Router automatically encrypts all responses ✅
2. Two-stage encryption utilities exist ✅
3. JWT encryption utilities work ✅
4. Display name generation works ✅
5. Super admin system works ✅

### ❌ What's Missing
1. userId field is NOT double-encrypted ❌
2. User preferences system doesn't exist ❌
3. Data request system doesn't exist ❌
4. Email privacy filtering doesn't exist ❌
5. Display name history doesn't exist ❌

### 🔧 What Needs Integration
1. Two-stage encryption into response builders
2. User preferences check before encrypting userId
3. Request system for decrypting double-encrypted data
4. Owner's JWT retrieval for Stage 1 encryption

---

## 🚀 Next Steps

1. **Create User Preferences System** (Phase 1)
   - Define preferences structure
   - Add to user object
   - Create preferences API

2. **Integrate Two-Stage Encryption** (Phase 1)
   - Create response builder utility
   - Check preferences before encrypting
   - Update handlers to use response builder

3. **Build Request System** (Phase 2)
   - Request data structure
   - Request endpoints
   - Request key management

4. **Add Display Name History** (Phase 3)
   - History tracking
   - Monthly limits
   - Regeneration endpoint

---

**Last Updated:** 2024-12-19
**Status:** 🔴 **CRITICAL WORK NEEDED** - Foundation missing for userId double-encryption

