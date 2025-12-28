# Email OTP Authentication Flow

> **Complete user authentication flow documentation** [EMAIL][AUTH]

---

## [TARGET] Overview

The authentication system uses **email-based OTP (One-Time Password)** with JWT tokens for session management. No passwords, no OAuth complexity - just email verification.

---

## [CLIPBOARD] Complete User Flow

### **Step 1: User Requests OTP**

**User Action:**
- User enters their email address in the login UI
- Clicks "Send Code" or "Request OTP"

**Client-Side:**
```typescript
// POST /auth/request-otp
const response = await fetch(`${API_URL}/auth/request-otp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});
```

**Server-Side:**
1. [SUCCESS] Validates email format
2. [SUCCESS] Checks rate limit (3 requests per email per hour)
3. [SUCCESS] Generates secure 9-digit OTP
4. [SUCCESS] Stores OTP in KV (10-minute expiration)
5. [SUCCESS] Sends email via Resend with OTP code
6. [SUCCESS] Returns success response

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to email",
  "expiresIn": 600,
  "remaining": 2
}
```

**User Experience:**
- [SUCCESS] Email sent notification appears
- [SUCCESS] UI shows "Check your email" message
- [SUCCESS] Countdown timer (10 minutes)
- [SUCCESS] "Resend Code" button (if rate limit allows)

---

### **Step 2: User Receives Email**

**Email Content:**
```
Subject: Your Strixun Stream Suite OTP

Your Verification Code: 123456

This code will expire in 10 minutes.
If you didn't request this, please ignore this email.
```

**User Action:**
- User checks email inbox
- Copies the 9-digit code

---

### **Step 3: User Verifies OTP**

**User Action:**
- User enters the 9-digit OTP code in the login UI
- Clicks "Verify" or "Login"

**Client-Side:**
```typescript
// POST /auth/verify-otp
const response = await fetch(`${API_URL}/auth/verify-otp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    email: 'user@example.com',
    otp: '123456'
  })
});
```

**Server-Side:**
1. [SUCCESS] Validates email and OTP format
2. [SUCCESS] Looks up OTP in KV storage
3. [SUCCESS] Checks expiration (10 minutes)
4. [SUCCESS] Checks attempt limit (5 attempts max)
5. [SUCCESS] Verifies OTP matches
6. [SUCCESS] Deletes OTP (single-use only)
7. [SUCCESS] Creates/updates user account
8. [SUCCESS] Generates JWT token (30-day expiration)
9. [SUCCESS] Stores session in KV
10. [SUCCESS] Returns token and user info

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user_abc123...",
  "email": "user@example.com",
  "expiresAt": "2025-01-31T00:00:00Z"
}
```

**Client-Side (After Verification):**
```typescript
// Save to auth store
import { setAuth } from '../stores/auth';

setAuth({
  userId: response.userId,
  email: response.email,
  token: response.token,
  expiresAt: response.expiresAt
});

// Token is automatically saved to localStorage/IndexedDB
// isAuthenticated store becomes true
```

**User Experience:**
- [SUCCESS] "Login successful" notification
- [SUCCESS] User is redirected to app
- [SUCCESS] Authentication state persists (localStorage)
- [SUCCESS] Token is automatically included in API requests

---

### **Step 4: User Makes Authenticated Requests**

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
1. [SUCCESS] Extracts token from `Authorization: Bearer {token}` header
2. [SUCCESS] Validates JWT signature
3. [SUCCESS] Checks token expiration
4. [SUCCESS] Checks token blacklist (for logged-out tokens)
5. [SUCCESS] Extracts userId from token
6. [SUCCESS] Processes request with user context

**Protected Endpoints:**
- `POST /notes/save` - Save notebook
- `GET /notes/load` - Load notebook
- `GET /notes/list` - List notebooks
- `DELETE /notes/delete` - Delete notebook
- `GET /auth/me` - Get current user info

---

### **Step 5: Token Refresh (Automatic)**

**When Token Expires:**
- Token expires after 30 days
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
1. [SUCCESS] Validates current token
2. [SUCCESS] Generates new JWT token
3. [SUCCESS] Updates session in KV
4. [SUCCESS] Returns new token

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
setAuth({ ...user, token: response.token, expiresAt: response.expiresAt });
```

---

### **Step 6: User Logout**

**User Action:**
- User clicks "Logout" button

**Client-Side:**
```typescript
// POST /auth/logout
await authenticatedFetch('/auth/logout', { method: 'POST' });

// Clear local auth state
import { clearAuth } from '../stores/auth';
clearAuth();
```

**Server-Side:**
1. [SUCCESS] Validates token
2. [SUCCESS] Adds token to blacklist
3. [SUCCESS] Deletes session from KV
4. [SUCCESS] Returns success

**User Experience:**
- [SUCCESS] User is logged out
- [SUCCESS] Token removed from storage
- [SUCCESS] Redirected to login screen
- [SUCCESS] Token cannot be reused (blacklisted)

---

## [SYNC] Session Persistence

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
- **Keys:** `auth_user`, `auth_token`
- **Format:** JSON with userId, email, token, expiresAt

### **Auto-Refresh:**
- Token checked on every API call
- If expired, automatically refreshed
- If refresh fails, user logged out

---

## [PROTECT] Security Features

### **OTP Security:**
- [SUCCESS] 9-digit numeric codes (1,000,000,000 combinations)
- [SUCCESS] Cryptographically secure random generation
- [SUCCESS] 10-minute expiration
- [SUCCESS] Single-use only (deleted after verification)
- [SUCCESS] 5 attempt limit per OTP

### **Rate Limiting:**
- [SUCCESS] 3 OTP requests per email per hour
- [SUCCESS] Prevents spam/abuse
- [SUCCESS] Automatic reset after 1 hour

### **Token Security:**
- [SUCCESS] JWT tokens (HMAC-SHA256 signed)
- [SUCCESS] 30-day expiration
- [SUCCESS] Token blacklist (for logout)
- [SUCCESS] HTTPS only (enforced by Cloudflare)

### **Data Protection:**
- [SUCCESS] Email hashing (SHA-256) for storage keys
- [SUCCESS] No plaintext passwords
- [SUCCESS] CORS support
- [SUCCESS] User isolation (userId in all requests)

---

## [MOBILE] UI Flow (Expected)

### **Login Screen:**
```
┌─────────────────────────────────┐
│   Strixun Stream Suite         │
│                                 │
│   Email: [user@example.com]     │
│                                 │
│   [Send Verification Code]      │
│                                 │
│   ─────────────────────────     │
│                                 │
│   OTP Code: [______]            │
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
- User info in header (email)
- "Logout" button
- All protected features accessible
- Auto-save enabled (for Notes)

---

## [CONFIG] Implementation Status

### [SUCCESS] **Server-Side (Complete):**
- [x] OTP generation endpoint
- [x] OTP verification endpoint
- [x] JWT token generation
- [x] Token validation middleware
- [x] Rate limiting
- [x] Email sending (Resend)
- [x] Session management
- [x] Token refresh endpoint
- [x] Logout endpoint

### [EMOJI] **Client-Side (Pending):**
- [ ] Login UI component
- [ ] OTP input component
- [ ] Email input validation
- [ ] Error handling UI
- [ ] Loading states
- [ ] Auto-refresh logic
- [ ] Token expiration handling
- [ ] Logout UI

---

## [DEPLOY] Next Steps

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

3. **Add User Menu** (Header component)
   - Show user email
   - Logout button
   - User info display

4. **Test Complete Flow**
   - Request OTP
   - Verify OTP
   - Access protected pages
   - Make authenticated API calls
   - Test token refresh
   - Test logout

---

## [ANALYTICS] Flow Diagram

```
User [EMOJI] Enter Email [EMOJI] Request OTP [EMOJI] Server
                                    [EMOJI]
                              Generate OTP
                                    [EMOJI]
                              Send Email (Resend)
                                    [EMOJI]
                              Store in KV (10min TTL)
                                    [EMOJI]
User [EMOJI] Email Received [EMOJI]────────────┘
  [EMOJI]
Enter OTP [EMOJI] Verify OTP [EMOJI] Server
                          [EMOJI]
                    Validate OTP
                          [EMOJI]
                    Create/Update User
                          [EMOJI]
                    Generate JWT Token
                          [EMOJI]
                    Store Session
                          [EMOJI]
User [EMOJI] Token + User Info [EMOJI]┘
  [EMOJI]
Save to localStorage
  [EMOJI]
isAuthenticated = true
  [EMOJI]
Access Protected Features
  [EMOJI]
API Calls (with Bearer token)
  [EMOJI]
Token Expires? [EMOJI] Refresh Token
  [EMOJI]
Logout [EMOJI] Blacklist Token [EMOJI] Clear Storage
```

---

**Last Updated**: 2025-01-01  
**Status**: [SUCCESS] Server Complete - [EMOJI] Client UI Pending  
**Version**: 2.1.0

