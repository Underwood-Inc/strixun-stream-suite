# Email OTP Authentication Flow

> **Complete customer authentication flow documentation**

---

## Overview

The authentication system uses **email-based OTP (One-Time Password)** with JWT tokens for session management. No passwords, no OAuth complexity - just email verification.

---

## Complete Customer Flow

### **Step 1: Customer Requests OTP**

**Customer Action:**
- Customer enters their email address in the login UI
- Clicks "Send Code" or "Request OTP"

**Client-Side:**
```typescript
// POST /auth/request-otp
const response = await fetch(`${API_URL}/auth/request-otp`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-OTP-API-Key': 'otp_live_sk_...'  // Optional - for multi-tenant
  },
  body: JSON.stringify({ email: 'alice@example.com' })
});
```

**Server-Side:**
1. ✓ Validates email format
2. ✓ Checks rate limit (3 requests per email per hour)
3. ✓ Generates secure 9-digit OTP
4. ✓ Stores OTP in KV (10-minute expiration)
5. ✓ Sends email via Resend with OTP code
6. ✓ Returns success response

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to email",
  "expiresIn": 600,
  "remaining": 2
}
```

**Customer Experience:**
- ✓ Email sent notification appears
- ✓ UI shows "Check your email" message
- ✓ Countdown timer (10 minutes)
- ✓ "Resend Code" button (if rate limit allows)

---

### **Step 2: Customer Receives Email**

**Email Content:**
```
Subject: Your Strixun Stream Suite OTP

Your Verification Code: 123456789

This code will expire in 10 minutes.
If you didn't request this, please ignore this email.
```

**Customer Action:**
- Customer checks email inbox
- Copies the 9-digit code

---

### **Step 3: Customer Verifies OTP**

**Customer Action:**
- Customer enters the 9-digit OTP code in the login UI
- Clicks "Verify" or "Login"

**Client-Side:**
```typescript
// POST /auth/verify-otp
const response = await fetch(`${API_URL}/auth/verify-otp`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-OTP-API-Key': 'otp_live_sk_...'  // Optional - for multi-tenant
  },
  body: JSON.stringify({ 
    email: 'alice@example.com',
    otp: '123456789'
  })
});
```

**Server-Side:**
1. ✓ Validates email and OTP format
2. ✓ Looks up OTP in KV storage
3. ✓ Checks expiration (10 minutes)
4. ✓ Checks attempt limit (5 attempts max)
5. ✓ Verifies OTP matches
6. ✓ Deletes OTP (single-use only)
7. ✓ Creates/updates customer account
8. ✓ Generates JWT token (7-hour expiration)
9. ✓ Stores session in KV
10. ✓ Returns token and customer info

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customerId": "cust_abc123",
  "email": "alice@example.com",
  "displayName": "CoolPanda42",
  "expiresAt": "2025-01-31T00:00:00Z"
}
```

**Client-Side (After Verification):**
```typescript
// Save to auth store
import { setAuth } from '../stores/auth';

setAuth({
  customerId: response.customerId,
  email: response.email,
  displayName: response.displayName,
  token: response.token,
  expiresAt: response.expiresAt
});

// Token is automatically saved to localStorage/IndexedDB
// isAuthenticated store becomes true
```

**Customer Experience:**
- ✓ "Login successful" notification
- ✓ Customer is redirected to app
- ✓ Authentication state persists (localStorage)
- ✓ Token is automatically included in API requests

---

### **Step 4: Customer Makes Authenticated Requests**

**Client-Side:**
```typescript
// All protected API calls use authenticatedFetch
import { authenticatedFetch } from '../stores/auth';

const response = await authenticatedFetch('/notes/save', {
  method: 'POST',
  body: JSON.stringify({ notebookId: '123', content: '...' })
});

// Token is automatically added to Authorization header:
// Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Server-Side:**
1. ✓ Extracts token from `Authorization: Bearer {token}` header
2. ✓ Validates JWT signature
3. ✓ Checks token expiration
4. ✓ Checks token blacklist (for logged-out tokens)
5. ✓ Extracts customerId from token
6. ✓ Processes request with customer context

**Protected Endpoints:**
- `POST /notes/save` - Save notebook
- `GET /notes/load` - Load notebook
- `GET /notes/list` - List notebooks
- `DELETE /notes/delete` - Delete notebook
- `GET /auth/me` - Get current customer info
- `GET /auth/quota` - Get quota usage

---

### **Step 5: Token Refresh (Automatic)**

**When Token Expires:**
- Token expires after 7 hours
- Client detects expiration on next API call
- Automatically calls refresh endpoint

**Client-Side:**
```typescript
// POST /auth/refresh
const response = await fetch(`${API_URL}/auth/refresh`, {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${oldToken}`,
    'Content-Type': 'application/json'
  }
});
```

**Server-Side:**
1. ✓ Validates current token
2. ✓ Generates new JWT token
3. ✓ Updates session in KV
4. ✓ Returns new token

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2025-02-01T00:00:00Z"
}
```

**Client-Side:**
```typescript
// Update auth store with new token
setAuth({ ...customer, token: response.token, expiresAt: response.expiresAt });
```

---

### **Step 6: Customer Logout**

**Customer Action:**
- Customer clicks "Logout" button

**Client-Side:**
```typescript
// POST /auth/logout
await authenticatedFetch('/auth/logout', { method: 'POST' });

// Clear local auth state
import { clearAuth } from '../stores/auth';
clearAuth();
```

**Server-Side:**
1. ✓ Validates token
2. ✓ Adds token to blacklist
3. ✓ Deletes session from KV
4. ✓ Returns success

**Customer Experience:**
- ✓ Customer is logged out
- ✓ Token removed from storage
- ✓ Redirected to login screen
- ✓ Token cannot be reused (blacklisted)

---

## Session Persistence

### **On App Load:**
```typescript
// In bootstrap.ts
import { loadAuthState } from '../stores/auth';

loadAuthState(); // Loads token from localStorage/IndexedDB

// Checks:
// 1. Token exists in storage
// 2. Token is not expired
// 3. Sets isAuthenticated = true if valid
```

### **Token Storage:**
- **Location:** localStorage/IndexedDB (via storage module)
- **Keys:** `auth_customer`, `auth_token`
- **Format:** JSON with customerId, email, displayName, token, expiresAt

### **Auto-Refresh:**
- Token checked on every API call
- If expired, automatically refreshed
- If refresh fails, customer logged out

---

## Security Features

### **OTP Security:**
- ✓ 9-digit numeric codes (1,000,000,000 combinations)
- ✓ Cryptographically secure random generation
- ✓ 10-minute expiration
- ✓ Single-use only (deleted after verification)
- ✓ 5 attempt limit per OTP

### **Rate Limiting:**
- ✓ 3 OTP requests per email per hour
- ✓ Prevents spam/abuse
- ✓ Automatic reset after 1 hour

### **Token Security:**
- ✓ JWT tokens (HMAC-SHA256 signed)
- ✓ 7-hour expiration (configurable)
- ✓ Token blacklist (for logout)
- ✓ HTTPS only (enforced by Cloudflare)

### **Data Protection:**
- ✓ Email hashing (SHA-256) for storage keys
- ✓ No plaintext passwords
- ✓ CORS support
- ✓ Customer isolation (customerId in all requests)

---

## UI Flow (Expected)

### **Login Screen:**
```
┌─────────────────────────────────┐
│   Strixun Stream Suite         │
│                                 │
│   Email: [alice@example.com]   │
│                                 │
│   [Send Verification Code]      │
│                                 │
│   ─────────────────────────     │
│                                 │
│   OTP Code: [_________]         │
│                                 │
│   [Verify & Login]              │
│                                 │
│   Code expires in: 9:45         │
│   [Resend Code]                 │
└─────────────────────────────────┘
```

### **States:**
1. **Initial:** Email input + "Send Code" button
2. **Code Sent:** Email input (disabled) + OTP input + "Verify" button + countdown
3. **Verifying:** Loading spinner + "Verifying..."
4. **Success:** Redirect to app
5. **Error:** Error message + retry options

### **After Login:**
- Customer info in header (displayName or email)
- "Logout" button
- All protected features accessible
- Auto-save enabled (for Notes)

---

## Implementation Status

### ✓ **Server-Side (Complete):**
- [x] OTP generation endpoint
- [x] OTP verification endpoint
- [x] JWT token generation
- [x] Token validation middleware
- [x] Rate limiting
- [x] Email sending (Resend)
- [x] Session management
- [x] Token refresh endpoint
- [x] Logout endpoint
- [x] Multi-tenant support (API keys)

### **Client-Side (Pending):**
- [ ] Login UI component
- [ ] OTP input component
- [ ] Email input validation
- [ ] Error handling UI
- [ ] Loading states
- [ ] Auto-refresh logic
- [ ] Token expiration handling
- [ ] Logout UI

---

## Next Steps

1. **Create Login UI Component** (`src/components/auth/Login.svelte`)
   - Email input
   - OTP input (9 digits)
   - Send/Verify buttons
   - Error messages
   - Loading states

2. **Add Auth Guard** (Route protection)
   - Check `isAuthenticated` store
   - Redirect to login if not authenticated
   - Protect Notes page (require auth)

3. **Add Customer Menu** (Header component)
   - Show customer displayName or email
   - Logout button
   - Customer info display

4. **Test Complete Flow**
   - Request OTP
   - Verify OTP
   - Access protected pages
   - Make authenticated API calls
   - Test token refresh
   - Test logout

---

## Flow Diagram

```
Customer → Enter Email → Request OTP → Server
                                    ↓
                              Generate OTP
                                    ↓
                              Send Email (Resend)
                                    ↓
                              Store in KV (10min TTL)
                                    ↓
Customer ← Email Received ──────────┘
  ↓
Enter OTP → Verify OTP → Server
                          ↓
                    Validate OTP
                          ↓
                    Create/Update Customer
                          ↓
                    Generate JWT Token
                          ↓
                    Store Session
                          ↓
Customer ← Token + Customer Info ┘
  ↓
Save to localStorage
  ↓
isAuthenticated = true
  ↓
Access Protected Features
  ↓
API Calls (with Bearer token)
  ↓
Token Expires? → Refresh Token
  ↓
Logout → Blacklist Token → Clear Storage
```

---

## Data Model

**CRITICAL**: This system uses CUSTOMER entities, not "USER" entities.

- **CUSTOMER**: Individual person who authenticates via OTP
  - Has: customerId, email, displayName, session
  - Example: "Alice" with customerId "cust_abc123"

---

**Last Updated**: 2026-01-08  
**Status**: ✓ Server Complete - Client UI Pending  
**Version**: 2.2.0
