# Privacy & User Management System - Comprehensive Audit & Implementation Plan ★ > **Complete audit of privacy features, user preferences, customer creation, and sensitive data access request system**

---

## ★ Executive Summary

This document provides a comprehensive audit of the privacy and customer management system requirements, identifying what exists, what's missing, and what needs to be built to support:

1. **Email Privacy by Default** - Emails hidden unless user makes them public
2. **Display Name Management** - Random names, regeneration, monthly changes, history tracking
3. **User Preferences API** - Privacy settings, email visibility, display name preferences
4. **Customer Creation Flow** - Automatic customer account creation with subscriptions, tiers, flairs
5. **Sensitive Data Request System** - Super admin can request access to encrypted user data
6. **Two-Stage Encryption** - Public decryptable vs. request-required encrypted data
7. **Obfuscation Animations** - UI/UX for revealing sensitive data

---

## ✓ What Exists (Current State)

### 1. Display Name System ✓ **PARTIALLY COMPLETE**

**Location:** `serverless/otp-auth-service/services/nameGenerator.ts`, `handlers/user/displayName.js`

**What Works:**
- ✓ Random display name generation (`generateUniqueDisplayName`)
- ✓ Display name uniqueness checking (`isNameUnique`)
- ✓ Display name reservation/release (`reserveDisplayName`, `releaseDisplayName`)
- ✓ Display name validation (`validateDisplayName`, `sanitizeDisplayName`)
- ✓ Display name stored in user object (`user.displayName`)
- ✓ Display name auto-generated on user creation (in `verify-otp.ts`)
- ✓ Display name update endpoint (`PUT /user/display-name`)

**What's Missing:**
- ✗ Display name change history tracking ("previously known as")
- ✗ Monthly change limit enforcement (once per month)
- ✗ Display name regeneration endpoint
- ✗ Display name history in user object
- ✗ Tooltip support for "previously known as" display

---

### 2. JWT Encryption System ✓ **COMPLETE**

**Location:** `serverless/otp-auth-service/utils/jwt-encryption.js`

**What Works:**
- ✓ AES-GCM-256 encryption
- ✓ PBKDF2 key derivation from JWT token
- ✓ Token hash verification (prevents wrong token decryption)
- ✓ Random salt and IV per encryption
- ✓ No fallback decryption (secure - throws error if token doesn't match)
- ✓ Client-side decryption (`dashboard/src/lib/jwt-decrypt.ts`)

**Security:**
- ✓ **No fallbacks** - encryption is secure, throws error if token doesn't match
- ✓ Token hash verification prevents unauthorized decryption
- ✓ Only JWT token holder can decrypt (email OTP required)

---

### 3. Customer Creation ✓ **PARTIALLY COMPLETE**

**Location:** `serverless/otp-auth-service/handlers/auth/customer-creation.ts`

**What Works:**
- ✓ Automatic customer creation (`ensureCustomerAccount`)
- ✓ Customer lookup by email (`getCustomerByEmail`)
- ✓ Customer storage in KV (`storeCustomer`)
- ✓ Customer ID generation (`generateCustomerId`)
- ✓ Basic customer data structure (plan, status, config)

**What's Missing:**
- ✗ Subscription management (subscriptions array)
- ✗ Tier system (tier assignment)
- ✗ Flair system (user flairs/badges)
- ✗ Customer creation in dedicated customer DB (currently in OTP_AUTH_KV)
- ✗ Customer creation verification in OTP flow (needs to check EVERY auth)
- ✗ Random display name generation during customer creation

---

### 4. Obfuscation Animations ✓ **COMPLETE**

**Location:** `src/core/animations/presets.ts`, `text_cycler_display.html`, `src/modules/text-cycler.ts`

**What Works:**
- ✓ Obfuscate animation (Minecraft enchantment table style)
- ✓ Typewriter animation
- ✓ Glitch animation
- ✓ Scramble animation
- ✓ Wave animation
- ✓ Fade animations
- ✓ Slide animations

**Available Animations:**
- `obfuscate` - Scramble then reveal (left to right)
- `typewriter` - Character by character reveal
- `glitch` - Random glitch characters that settle
- `scramble` - All random then snap to final
- `wave` - Wave pattern reveal
- `fade` - Fade in/out
- `slide_left`, `slide_right`, `slide_up`, `slide_down` - Slide transitions

---

### 5. Super Admin System ✓ **COMPLETE**

**Location:** `serverless/otp-auth-service/utils/super-admin.js`, `SUPER_ADMIN_SETUP.md`

**What Works:**
- ✓ Super admin API key authentication
- ✓ Super admin email list authentication
- ✓ Super admin check in admin routes
- ✓ Super admin can access all endpoints

---

## ✗ What's Missing (Required Features)

### 1. Email Privacy System ✗ **NOT IMPLEMENTED**

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

### 2. User Preferences API ✗ **NOT IMPLEMENTED**

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

### 3. Display Name History Tracking ✗ **NOT IMPLEMENTED**

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

### 4. Customer Creation Enhancement ✗ **INCOMPLETE**

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

### 5. Sensitive Data Request System ✗ **NOT IMPLEMENTED**

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

### 6. Customer Storage DB (Dedicated) ✗ **NOT IMPLEMENTED**

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

### 7. OTP Auth Flow Customer Check ✗ **INCOMPLETE**

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

##  Architecture Recommendations

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
- ✓ Decoupled architecture
- ✓ Single concern (customer data)
- ✓ Easier to scale
- ✓ Better organization
- ✓ Similar to game-api pattern (familiar)

---

### 2. User Preferences Storage

**Recommendation:** Store preferences in user object (KV) with separate key for quick access

**Storage Structure:**
```
KV Keys:
- `user_${emailHash}` - Full user object (includes preferences)
- `user_preferences_${userId}` - Quick access to preferences (optional cache)
```

**Data Structure:**
```typescript
interface User {
  userId: string;
  email: string;
  displayName: string;
  displayNameHistory: Array<{
    name: string;
    changedAt: string;
    reason: 'auto-generated' | 'user-changed' | 'regenerated';
  }>;
  preferences: {
    emailVisibility: 'private' | 'public';
    privacy: {
      showEmail: boolean;
      showProfilePicture: boolean;
    };
  };
  customerId: string | null;
  createdAt: string;
  lastLogin: string;
}
```

---

### 3. Sensitive Data Request System

**Recommendation:** Implement request system with two-stage encryption

**Encryption Stages:**
1. **Stage 1 (Public Decryptable):**
   - Encrypted with user's JWT
   - User can decrypt with their token
   - Used for data user can always access

2. **Stage 2 (Request-Required):**
   - Encrypted with user's JWT + request key
   - Requires approved request + user's JWT to decrypt
   - Used for sensitive data (email, etc.)

**Request Flow:**
1. Super admin creates request via `POST /admin/data-requests`
2. Request stored in KV with `pending` status
3. System notifies user (optional - via email/webhook)
4. Super admin approves request
5. Decryption key generated and encrypted with requester's JWT
6. Requester can decrypt data using request key + user's JWT

---

## ★ Implementation Plan

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

### Phase 6: Customer API Worker (Week 7-8)

**Priority: LOW (Future Enhancement)**

1. **Create Customer API Worker**
   - [ ] Worker structure
   - [ ] Route definitions
   - [ ] Handler implementations

2. **Migrate Customer Operations**
   - [ ] Move customer handlers to new worker
   - [ ] Update OTP service to call customer API
   - [ ] Update dashboard to call customer API

3. **Test and Deploy**
   - [ ] End-to-end testing
   - [ ] Performance testing
   - [ ] Deploy to production

---

## ★ Security Considerations

### 1. Encryption Security ✓

**Current State:**
- ✓ No fallback decryption (secure)
- ✓ Token hash verification
- ✓ Only JWT token holder can decrypt

**Recommendations:**
- ✓ Keep current implementation (no changes needed)
- ✓ Ensure no fallback decryption in request system
- ✓ Verify token hash in all decryption operations

---

### 2. Privacy by Default ✓

**Implementation:**
- ✓ Emails hidden by default
- ✓ Only display name shown
- ✓ Email visibility controlled by user preference
- ✓ Super admin can request access (with approval)

---

### 3. Request System Security

**Requirements:**
- ✓ Super admin authentication required
- ✓ Request expiration (time-limited)
- ✓ Request approval required
- ✓ Decryption key encrypted with requester's JWT
- ✓ Audit logging for all requests

---

## ★ Data Flow Diagrams

### Customer Creation Flow

```
User Login (OTP)
    
Verify OTP
    
Check Customer Exists (by email)
    
[If Not Exists]
    
Generate Customer ID
    
Generate Random Display Name
    
Create Customer Object:
  - customerId
  - email
  - displayName (random)
  - subscriptions: []
  - tier: 'free'
  - flairs: []
    
Store in CUSTOMER_KV
    
Create User Object:
  - userId
  - email
  - displayName (from customer)
  - displayNameHistory: [{name, changedAt, reason: 'auto-generated'}]
  - preferences: {emailVisibility: 'private', ...}
    
Store in OTP_AUTH_KV
    
Create JWT (includes customerId)
    
Return JWT to User
```

### Sensitive Data Request Flow

```
Super Admin Creates Request
    
Request Stored (status: 'pending')
    
[Optional] Notify User
    
Super Admin Approves Request
    
Generate Decryption Key
    
Encrypt Key with Requester's JWT
    
Store Request (status: 'approved', decryptionKey)
    
Requester Retrieves Request
    
Decrypt Key with Requester's JWT
    
Use Key + User's JWT to Decrypt Data
    
Return Decrypted Data
```

---

## ✓ Criteria

### Phase 1 (Immediate Fixes)
- ✓ Customer creation works in all auth flows
- ✓ Customer data displays correctly in dashboard
- ✓ Response format matches API client expectations

### Phase 2 (User Preferences)
- ✓ Email privacy works (hidden by default)
- ✓ User can make email public
- ✓ Email shown in tooltip when public
- ✓ Preferences API functional

### Phase 3 (Display Name)
- ✓ Display name history tracked
- ✓ Monthly change limit enforced
- ✓ Regeneration endpoint works
- ✓ "Previously known as" shown in tooltips

### Phase 4 (Customer Enhancement)
- ✓ Customer created with subscriptions, tier, flairs
- ✓ Random display name generated during creation
- ✓ Dedicated customer KV namespace

### Phase 5 (Request System)
- ✓ Super admin can create requests
- ✓ Two-stage encryption works
- ✓ Request approval system functional
- ✓ Data decryption with request works

---

## ★ Notes

### Obfuscation Animations

**Available Animations:**
- `obfuscate` - Best for sensitive data reveal (Minecraft enchantment style)
- `typewriter` - Good for gradual reveal
- `glitch` - Good for error states
- `scramble` - Good for quick reveal

**Recommendation:** Use `obfuscate` for email reveal (matches privacy theme)

### Customer Storage

**Current:** `OTP_AUTH_KV` (shared with auth data)
**Recommended:** `CUSTOMER_KV` (dedicated namespace)

**Migration Strategy:**
1. Create `CUSTOMER_KV` namespace
2. Update customer service to use new namespace
3. Migrate existing customers (optional - can be gradual)
4. Update all customer operations

### Request System

**Use Cases:**
- Super admin needs to view user email for support
- Compliance requests (GDPR, etc.)
- Security investigations
- Account recovery

**Security:**
- All requests logged
- Request expiration (e.g., 24 hours)
- Approval required
- Decryption key encrypted with requester's JWT

---

**Status:**  **AWAITING INSTRUCTIONS** - Ready to proceed with implementation

**Next Steps:**
1. Review this audit
2. Prioritize phases
3. Start with Phase 1 (immediate fixes)
4. Proceed with subsequent phases

