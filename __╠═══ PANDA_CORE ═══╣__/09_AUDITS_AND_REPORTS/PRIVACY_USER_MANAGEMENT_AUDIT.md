# Privacy & User Management System - Comprehensive Audit & Implementation Plan [LOCK]

> **Complete audit of privacy features, user preferences, customer creation, and sensitive data access request system**

**Last Updated:** 2025-12-29

---

## Executive Summary

This document provides a comprehensive audit of the privacy and user management system requirements, identifying what exists, what's missing, and what needs to be built to support:

1. **Email Privacy by Default** - Emails hidden unless user makes them public
2. **Display Name Management** - Random names, regeneration, monthly changes, history tracking
3. **User Preferences API** - Privacy settings, email visibility, display name preferences
4. **Customer Creation Flow** - Automatic customer account creation with subscriptions, tiers, flairs
5. **Sensitive Data Request System** - Super admin can request access to encrypted user data
6. **Two-Stage Encryption** - Public decryptable vs. request-required encrypted data
7. **Obfuscation Animations** - UI/UX for revealing sensitive data

---

## [SUCCESS] What Exists (Current State)

### 1. Display Name System [SUCCESS] **PARTIALLY COMPLETE**

**Location:** `serverless/otp-auth-service/services/nameGenerator.ts`, `handlers/user/displayName.js`

**What Works:**
- [SUCCESS] Random display name generation (`generateUniqueDisplayName`)
- [SUCCESS] Display name uniqueness checking (`isNameUnique`)
- [SUCCESS] Display name reservation/release (`reserveDisplayName`, `releaseDisplayName`)
- [SUCCESS] Display name validation (`validateDisplayName`, `sanitizeDisplayName`)
- [SUCCESS] Display name stored in user object (`user.displayName`)
- [SUCCESS] Display name auto-generated on user creation (in `verify-otp.ts`)
- [SUCCESS] Display name update endpoint (`PUT /user/display-name`)

**What's Missing:**
- [ERROR] Display name change history tracking ("previously known as")
- [ERROR] Monthly change limit enforcement (once per month)
- [ERROR] Display name regeneration endpoint
- [ERROR] Display name history in user object
- [ERROR] Tooltip support for "previously known as" display

---

### 2. JWT Encryption System [SUCCESS] **COMPLETE**

**Location:** `serverless/otp-auth-service/utils/jwt-encryption.js`

**What Works:**
- [SUCCESS] AES-GCM-256 encryption
- [SUCCESS] PBKDF2 key derivation from JWT token
- [SUCCESS] Token hash verification (prevents wrong token decryption)
- [SUCCESS] Random salt and IV per encryption
- [SUCCESS] No fallback decryption (secure - throws error if token doesn't match)
- [SUCCESS] Client-side decryption (`dashboard/src/lib/jwt-decrypt.ts`)

**Security:**
- [SUCCESS] **No fallbacks** - encryption is secure, throws error if token doesn't match
- [SUCCESS] Token hash verification prevents unauthorized decryption
- [SUCCESS] Only JWT token holder can decrypt (email OTP required)

---

### 3. Customer Creation [SUCCESS] **PARTIALLY COMPLETE**

**Location:** `serverless/otp-auth-service/handlers/auth/customer-creation.ts`

**What Works:**
- [SUCCESS] Automatic customer creation (`ensureCustomerAccount`)
- [SUCCESS] Customer lookup by email (`getCustomerByEmail`)
- [SUCCESS] Customer storage in KV (`storeCustomer`)
- [SUCCESS] Customer ID generation (`generateCustomerId`)
- [SUCCESS] Basic customer data structure (plan, status, config)

**What's Missing:**
- [ERROR] Subscription management (subscriptions array)
- [ERROR] Tier system (tier assignment)
- [ERROR] Flair system (user flairs/badges)
- [ERROR] Customer creation in dedicated customer DB (currently in OTP_AUTH_KV)
- [ERROR] Customer creation verification in OTP flow (needs to check EVERY auth)
- [ERROR] Random display name generation during customer creation

---

### 4. Obfuscation Animations [SUCCESS] **COMPLETE**

**Location:** `src/core/animations/presets.ts`, `text_cycler_display.html`, `src/modules/text-cycler.ts`

**What Works:**
- [SUCCESS] Obfuscate animation (Minecraft enchantment table style)
- [SUCCESS] Typewriter animation
- [SUCCESS] Glitch animation
- [SUCCESS] Scramble animation
- [SUCCESS] Wave animation
- [SUCCESS] Fade animations
- [SUCCESS] Slide animations

**Available Animations:**
- `obfuscate` - Scramble then reveal (left to right)
- `typewriter` - Character by character reveal
- `glitch` - Random glitch characters that settle
- `scramble` - All random then snap to final
- `wave` - Wave pattern reveal
- `fade` - Fade in/out
- `slide_left`, `slide_right`, `slide_up`, `slide_down` - Slide transitions

---

### 5. Super Admin System [SUCCESS] **COMPLETE**

**Location:** `serverless/otp-auth-service/utils/super-admin.js`, `SUPER_ADMIN_SETUP.md`

**What Works:**
- [SUCCESS] Super admin API key authentication
- [SUCCESS] Super admin email list authentication
- [SUCCESS] Super admin check in admin routes
- [SUCCESS] Super admin can access all endpoints

---

## [ERROR] What's Missing (Required Features)

### 1. Email Privacy System [ERROR] **NOT IMPLEMENTED**

**Requirements:**
- Emails should NOT be rendered unless user makes them public
- Only display name shown by default
- If email is public, show as tooltip on hover over display name
- Email visibility controlled by user preference

**What Needs to Be Built:**
- [ ] User preferences structure with `emailVisibility` field
- [ ] User preferences API (`GET /user/me/preferences`, `PUT /user/me/preferences`)
- [ ] Email filtering in all API responses (remove email unless `emailVisibility === 'public'`)
- [ ] Tooltip component integration for email display
- [ ] Frontend logic to show/hide email based on preference

---

### 2. User Preferences API [ERROR] **NOT IMPLEMENTED**

**Requirements:**
- User preferences storage
- Privacy settings (email visibility, etc.)
- Display name preferences
- Preference update endpoints

**What Needs to Be Built:**
- [ ] User preferences data structure:
  ```typescript
  interface UserPreferences {
    emailVisibility: 'private' | 'public';
    displayName: {
      current: string;
      previousNames: Array<{
        name: string;
        changedAt: string;
      }>;
      lastChangedAt: string | null;
      changeCount: number;
    };
    privacy: {
      showEmail: boolean;
      showProfilePicture: boolean;
      // ... other privacy settings
    };
  }
  ```
- [ ] Preferences storage in KV (`user_preferences_${userId}`)
- [ ] `GET /user/me/preferences` endpoint
- [ ] `PUT /user/me/preferences` endpoint
- [ ] Preferences validation
- [ ] Preferences default values

---

### 3. Display Name History Tracking [ERROR] **NOT IMPLEMENTED**

**Requirements:**
- Track all display name changes
- Show "previously known as" in tooltips
- Enforce monthly change limit
- Display name regeneration

**What Needs to Be Built:**
- [ ] Display name history array in user object:
  ```typescript
  displayNameHistory: Array<{
    name: string;
    changedAt: string;
    reason: 'auto-generated' | 'user-changed' | 'regenerated';
  }>;
  ```
- [ ] Monthly change limit check (once per month)
- [ ] `POST /user/display-name/regenerate` endpoint
- [ ] Update `PUT /user/display-name` to track history
- [ ] Tooltip component to show "previously known as"
- [ ] Frontend logic to display history

---

### 4. Customer Creation Enhancement [ERROR] **INCOMPLETE**

**Requirements:**
- Check EVERY authentication for customer existence
- Create customer with subscriptions, tiers, flairs
- Generate random display name during customer creation
- Dedicated customer storage DB (like game-api pattern)

**What Needs to Be Built:**
- [ ] Customer creation check in ALL auth flows:
  - [ ] `POST /auth/verify-otp`
  - [ ] `GET /auth/me`
  - [ ] `POST /auth/refresh`
  - [ ] Any JWT verification
- [ ] Enhanced customer data structure:
  ```typescript
  interface CustomerData {
    customerId: string;
    email: string;
    displayName: string; // Randomly generated
    subscriptions: Array<{
      planId: string;
      status: 'active' | 'cancelled' | 'expired';
      startDate: string;
      endDate: string | null;
    }>;
    tier: 'free' | 'basic' | 'premium' | 'enterprise';
    flairs: Array<{
      flairId: string;
      name: string;
      icon: string;
      earnedAt: string;
    }>;
    // ... existing fields
  }
  ```
- [ ] Dedicated customer KV namespace (like `GAME_KV` in game-api)
- [ ] Customer service migration to dedicated namespace
- [ ] Random display name generation during customer creation

---

### 5. Sensitive Data Request System [ERROR] **NOT IMPLEMENTED**

**Requirements:**
- Super admin can request access to encrypted user data
- Request system that allows decryption of double-encrypted data
- Agnostic/reusable for any sensitive information
- Two-stage encryption (public decryptable vs. request-required)

**What Needs to Be Built:**
- [ ] Request data structure:
  ```typescript
  interface DataRequest {
    requestId: string;
    requesterId: string; // Super admin customer ID
    targetCustomerId: string;
    dataType: 'email' | 'profile' | 'custom';
    status: 'pending' | 'approved' | 'rejected' | 'expired';
    requestedAt: string;
    expiresAt: string;
    approvedAt: string | null;
    decryptionKey: string | null; // Encrypted with requester's JWT
  }
  ```
- [ ] Request storage in KV (`data_request_${requestId}`)
- [ ] `POST /admin/data-requests` - Create request
- [ ] `GET /admin/data-requests` - List requests
- [ ] `GET /admin/data-requests/:id` - Get request details
- [ ] `POST /admin/data-requests/:id/approve` - Approve request
- [ ] `POST /admin/data-requests/:id/reject` - Reject request
- [ ] Two-stage encryption system:
  - Stage 1: Public decryptable (user's JWT can decrypt)
  - Stage 2: Request-required (requires approved request + user's JWT)
- [ ] Data encryption with request flag
- [ ] Data decryption with request verification

---

### 6. Customer Storage DB (Dedicated) [ERROR] **NOT IMPLEMENTED**

**Requirements:**
- Dedicated customer KV namespace (like game-api pattern)
- Decoupled, single concern architecture
- Customer service similar to game-api structure

**What Needs to Be Built:**
- [ ] Create `CUSTOMER_KV` namespace in Cloudflare
- [ ] Update `wrangler.toml` with customer KV binding
- [ ] Migrate customer service to use `CUSTOMER_KV`
- [ ] Update all customer operations to use new namespace
- [ ] Customer service structure (similar to `game-api/utils/customer.js`):
  ```
  serverless/customer-api/
  ├── worker.ts
  ├── wrangler.toml
  ├── services/
  │   └── customer-service.ts
  ├── handlers/
  │   ├── customer.ts
  │   └── preferences.ts
  └── utils/
      └── customer.js
  ```

---

### 7. OTP Auth Flow Customer Check [ERROR] **INCOMPLETE**

**Requirements:**
- Check EVERY authentication for customer existence
- Create customer if doesn't exist
- Ensure customer creation happens before JWT creation

**What Needs to Be Fixed:**
- [ ] Add customer check in `POST /auth/verify-otp` (already exists but needs verification)
- [ ] Add customer check in `GET /auth/me`
- [ ] Add customer check in `POST /auth/refresh`
- [ ] Ensure customer creation happens BEFORE JWT creation
- [ ] Verify customer exists in KV before returning JWT

---

## Architecture Recommendations

### 1. Customer API Worker (Dedicated)

**Recommendation:** Create dedicated `customer-api` worker (similar to `game-api`)

**Structure:**
```
serverless/customer-api/
├── worker.ts                    # Entry point
├── wrangler.toml                # Worker config with CUSTOMER_KV
├── router/
│   └── customer-routes.ts      # Route definitions
├── handlers/
│   ├── customer.ts             # Customer CRUD
│   ├── preferences.ts           # User preferences
│   └── subscriptions.ts         # Subscription management
├── services/
│   ├── customer-service.ts     # Customer business logic
│   ├── preference-service.ts   # Preference management
│   └── subscription-service.ts # Subscription management
└── utils/
    ├── auth.ts                 # JWT verification
    ├── cors.ts                 # CORS headers
    └── customer.js             # Customer utilities
```

**Benefits:**
- [SUCCESS] Decoupled architecture
- [SUCCESS] Single concern (customer data)
- [SUCCESS] Easier to scale
- [SUCCESS] Better organization
- [SUCCESS] Similar to game-api pattern (familiar)

---

## Implementation Plan

### Phase 1: Fix Immediate Issues (Week 1)

**Priority: CRITICAL**

1. **Fix Customer Creation Logic**
   - [ ] Update `ensureCustomerAccount` to verify customer exists
   - [ ] Fix customer creation in OTP flow
   - [ ] Ensure customer creation happens before JWT creation

2. **Fix Response Format**
   - [ ] Update `handlers/admin/customers.js` to return Customer directly
   - [ ] Update API client to handle both formats (backward compatibility)

3. **Add Customer Check to All Auth Flows**
   - [ ] Add check in `GET /auth/me`
   - [ ] Add check in `POST /auth/refresh`
   - [ ] Verify check in `POST /auth/verify-otp`

---

### Phase 2: User Preferences System (Week 2)

**Priority: HIGH**

1. **Create User Preferences Structure**
   - [ ] Define `UserPreferences` interface
   - [ ] Add preferences to user object
   - [ ] Create default preferences

2. **Build Preferences API**
   - [ ] `GET /user/me/preferences` endpoint
   - [ ] `PUT /user/me/preferences` endpoint
   - [ ] Preferences validation
   - [ ] Preferences storage in KV

3. **Implement Email Privacy**
   - [ ] Add `emailVisibility` to preferences
   - [ ] Filter email from API responses
   - [ ] Add tooltip for email display
   - [ ] Update frontend to respect privacy settings

---

### Phase 3: Display Name Enhancements (Week 3)

**Priority: HIGH**

1. **Add Display Name History**
   - [ ] Add `displayNameHistory` to user object
   - [ ] Track all name changes
   - [ ] Update `PUT /user/display-name` to track history

2. **Implement Monthly Change Limit**
   - [ ] Add `lastChangedAt` to user object
   - [ ] Check monthly limit in update endpoint
   - [ ] Return error if limit exceeded

3. **Add Regeneration Endpoint**
   - [ ] `POST /user/display-name/regenerate` endpoint
   - [ ] Generate new random name
   - [ ] Track as "regenerated" in history

4. **Add Tooltip Support**
   - [ ] Tooltip component for "previously known as"
   - [ ] Frontend integration
   - [ ] Display history in tooltip

---

### Phase 4: Customer Creation Enhancement (Week 4)

**Priority: MEDIUM**

1. **Enhance Customer Data Structure**
   - [ ] Add `subscriptions` array
   - [ ] Add `tier` field
   - [ ] Add `flairs` array
   - [ ] Add `displayName` to customer

2. **Update Customer Creation**
   - [ ] Generate random display name during creation
   - [ ] Initialize subscriptions array
   - [ ] Set default tier
   - [ ] Initialize flairs array

3. **Create Dedicated Customer KV**
   - [ ] Create `CUSTOMER_KV` namespace
   - [ ] Update `wrangler.toml`
   - [ ] Migrate customer service

---

### Phase 5: Sensitive Data Request System (Week 5-6)

**Priority: MEDIUM**

1. **Build Request System**
   - [ ] Request data structure
   - [ ] Request storage in KV
   - [ ] Request endpoints (create, list, get, approve, reject)

2. **Implement Two-Stage Encryption**
   - [ ] Stage 1: Public decryptable encryption
   - [ ] Stage 2: Request-required encryption
   - [ ] Encryption flag in data structure
   - [ ] Decryption with request verification

3. **Integrate with Super Admin**
   - [ ] Super admin can create requests
   - [ ] Super admin can approve requests
   - [ ] Request notification system (optional)

---

**Status:** [WARNING] **AWAITING INSTRUCTIONS** - Ready to proceed with implementation

**Next Steps:**
1. Review this audit
2. Prioritize phases
3. Start with Phase 1 (immediate fixes)
4. Proceed with subsequent phases

