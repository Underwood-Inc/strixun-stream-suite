# Email OTP Authentication Flow

> **Complete user authentication flow documentation** [EMOJI][EMOJI]

---

## [EMOJI] Overview

The authentication system uses **email-based OTP (One-Time Password)** with JWT tokens for session management. No passwords, no OAuth complexity - just email verification.

---

## [EMOJI] Complete User Flow

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
1. [OK] Validates email format
2. [OK] Checks rate limit (3 requests per email per hour)
3. [OK] Generates secure 9-digit OTP
4. [OK] Stores OTP in KV (10-minute expiration)
5. [OK] Sends email via Resend with OTP code
6. [OK] Returns success response

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
- [OK] Email sent notification appears
- [OK] UI shows "Check your email" message
- [OK] Countdown timer (10 minutes)
- [OK] "Resend Code" button (if rate limit allows)

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
1. [OK] Validates email and OTP format
2. [OK] Looks up OTP in KV storage
3. [OK] Checks expiration (10 minutes)
4. [OK] Checks attempt limit (5 attempts max)
5. [OK] Verifies OTP matches
6. [OK] Deletes OTP (single-use only)
7. [OK] Creates/updates user account
8. [OK] Generates JWT token (30-day expiration)
9. [OK] Stores session in KV
10. [OK] Returns token and user info

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
- [OK] "Login successful" notification
- [OK] User is redirected to app
- [OK] Authentication state persists (localStorage)
- [OK] Token is automatically included in API requests

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
1. [OK] Extracts token from `Authorization: Bearer {token}` header
2. [OK] Validates JWT signature
3. [OK] Checks token expiration
4. [OK] Checks token blacklist (for logged-out tokens)
5. [OK] Extracts userId from token
6. [OK] Processes request with user context

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
1. [OK] Validates current token
2. [OK] Generates new JWT token
3. [OK] Updates session in KV
4. [OK] Returns new token

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
1. [OK] Validates token
2. [OK] Adds token to blacklist
3. [OK] Deletes session from KV
4. [OK] Returns success

**User Experience:**
- [OK] User is logged out
- [OK] Token removed from storage
- [OK] Redirected to login screen
- [OK] Token cannot be reused (blacklisted)

---

## [EMOJI] Session Persistence

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

## [EMOJI]️ Security Features

### **OTP Security:**
- [OK] 9-digit numeric codes (1,000,000,000 combinations)
- [OK] Cryptographically secure random generation
- [OK] 10-minute expiration
- [OK] Single-use only (deleted after verification)
- [OK] 5 attempt limit per OTP

### **Rate Limiting:**
- [OK] 3 OTP requests per email per hour
- [OK] Prevents spam/abuse
- [OK] Automatic reset after 1 hour

### **Token Security:**
- [OK] JWT tokens (HMAC-SHA256 signed)
- [OK] 30-day expiration
- [OK] Token blacklist (for logout)
- [OK] HTTPS only (enforced by Cloudflare)

### **Data Protection:**
- [OK] Email hashing (SHA-256) for storage keys
- [OK] No plaintext passwords
- [OK] CORS support
- [OK] User isolation (userId in all requests)

---

## [EMOJI] UI Flow (Expected)

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

## [EMOJI] Implementation Status

### [OK] **Server-Side (Complete):**
- [x] OTP generation endpoint
- [x] OTP verification endpoint
- [x] JWT token generation
- [x] Token validation middleware
- [x] Rate limiting
- [x] Email sending (Resend)
- [x] Session management
- [x] Token refresh endpoint
- [x] Logout endpoint

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

## [EMOJI] Next Steps

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

## [EMOJI] Flow Diagram

```
User → Enter Email → Request OTP → Server
                                    
                              Generate OTP
                                    
                              Send Email (Resend)
                                    
                              Store in KV (10min TTL)
                                    
User ← Email Received ────────────┘
  
Enter OTP → Verify OTP → Server
                          
                    Validate OTP
                          
                    Create/Update User
                          
                    Generate JWT Token
                          
                    Store Session
                          
User ← Token + User Info ┘
  
Save to localStorage
  
isAuthenticated = true
  
Access Protected Features
  
API Calls (with Bearer token)
  
Token Expires? → Refresh Token
  
Logout → Blacklist Token → Clear Storage
```

---

**Last Updated**: 2025-01-01  
**Status**: [OK] Server Complete - Client UI Pending  
**Version**: 2.1.0
