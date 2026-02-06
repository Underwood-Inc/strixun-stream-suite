# Multi-Tenancy API Key Guide

## Overview

The OTP Auth Service supports multi-tenant usage via API keys. Third-party developers can integrate our authentication service into their applications.

## How API Keys Work

### What API Keys Do

| Purpose | Description |
|---------|-------------|
| **Tenant Identification** | Identifies which customer account the request belongs to |
| **Per-Key CORS Control** | Each key can have its own allowed origins (or none for any origin) |
| **Rate Limiting** | Applies the customer's rate limits to requests |
| **Billing/Usage Tracking** | Tracks usage per customer for billing |

### Security Model - How It Actually Works

**The API key itself IS the security. No valid key = no access. Period.**

| Scenario | What Happens |
|----------|--------------|
| **No API key provided** | 401 Unauthorized — Nothing happens |
| **Invalid/revoked API key** | 401 Unauthorized — Nothing happens |
| **Valid key, NO origins configured** | ✓ Works — Key authenticates, any origin allowed |
| **Valid key, origins configured** | ✓ Works — Only from those specific origins |

**Think of it like a password:**
- **Backend keys:** Stored in env vars, never exposed. Works from "any origin" because it's only used from YOUR server.
- **Frontend keys:** Visible in browser JS. Configure origins to prevent someone from copying it and using it elsewhere.

> ⚠️ **"Any origin" doesn't mean "anyone can access"** — it means "anyone WITH THE VALID KEY can access from any origin."

This gives developers flexibility:
- **Simple mode**: No origin restriction - just use the key anywhere (backend usage)
- **Strict mode**: Lock key to specific domains for extra security (frontend usage)

### What API Keys Do NOT Do

| NOT For | Why |
|---------|-----|
| **User Authentication** | JWT tokens handle user authentication |
| **Data Access Control** | User's JWT determines what data they can access |
| **Security/Encryption** | JWT-based encryption handles this |

## Integration Methods

### Method 1: Backend-Only Integration (RECOMMENDED)

**Security Level: HIGHEST**

The API key never leaves your server. Your frontend talks to YOUR backend, which then talks to OTP Auth API.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SECURE FLOW                                  │
│                                                                     │
│  ┌──────────┐    (1) Login     ┌──────────────┐    (2) OTP Request │
│  │  User's  │ ───────────────► │ Your Backend │ ──────────────────►│
│  │  Browser │                  │   Server     │                    │
│  │          │ ◄─────────────── │              │ ◄──────────────────│
│  └──────────┘   (4) JWT Token  └──────────────┘   (3) OTP Sent     │
│       │                              │                              │
│       │                              │ API Key stored              │
│       │                              │ in env vars                 │
│       │                              │ (NEVER exposed)             │
│       │                              ▼                              │
│       │                        ┌──────────────┐                    │
│       │                        │ OTP Auth API │                    │
│       │                        │ auth.idling  │                    │
│       │                        │    .app      │                    │
│       │                        └──────────────┘                    │
│       │                              ▲                              │
│       │                              │                              │
│       └──────────────────────────────┘                              │
│              (5) Subsequent requests use JWT                        │
│                  (no API key needed)                                │
└─────────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```javascript
// YOUR BACKEND SERVER (Node.js example)
// API key is in environment variable, never sent to browser

const OTP_AUTH_API_KEY = process.env.OTP_AUTH_API_KEY; // Stored securely

app.post('/api/auth/request-otp', async (req, res) => {
  const { email } = req.body;
  
  // Your backend calls OTP Auth API with the API key
  const response = await fetch('https://auth.idling.app/auth/request-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OTP-API-Key': OTP_AUTH_API_KEY  // API key only on server
    },
    body: JSON.stringify({ email })
  });
  
  const data = await response.json();
  res.json(data);
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  
  const response = await fetch('https://auth.idling.app/auth/verify-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OTP-API-Key': OTP_AUTH_API_KEY
    },
    body: JSON.stringify({ email, otp })
  });
  
  const data = await response.json();
  
  // Forward the JWT to the client (via cookie or response)
  if (data.token) {
    res.cookie('auth_token', data.token, { httpOnly: true, secure: true });
  }
  
  res.json(data);
});
```

```javascript
// YOUR FRONTEND (React/Vue/etc)
// No API key here - talks to YOUR backend only

async function requestOTP(email) {
  const response = await fetch('/api/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return response.json();
}

async function verifyOTP(email, otp) {
  const response = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
    credentials: 'include'  // For HttpOnly cookie
  });
  return response.json();
}
```

**Pros:**
- API key is 100% hidden from end users
- Maximum security
- No CORS configuration needed (your backend handles it)

**Cons:**
- Requires a backend server
- Slightly more complex setup

---

### Method 2: Direct Frontend Integration (CLIENT-SIDE)

**Security Level: MODERATE**

The API key IS exposed in browser JavaScript, but protected by origin restrictions.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DIRECT FRONTEND FLOW                            │
│                                                                     │
│  ┌──────────┐         Direct API call          ┌──────────────────┐│
│  │  User's  │ ──────────────────────────────► │   OTP Auth API   ││
│  │  Browser │                                  │  auth.idling.app ││
│  │          │ ◄────────────────────────────── │                  ││
│  └──────────┘         Response                 └──────────────────┘│
│       │                                               │            │
│       │                                               │            │
│       ▼                                               ▼            │
│  ┌──────────────────────────┐              ┌──────────────────────┐│
│  │ API Key visible in JS    │              │ Origin Validation    ││
│  │ Anyone can see it        │              │ (optional per-key)   ││
│  │ in browser DevTools      │              │                      ││
│  └──────────────────────────┘              └──────────────────────┘│
│                                                                     │
│  ⚠️  KEY IS EXPOSED but can be protected by:                       │
│     1. Origin restriction (optional - configure per-key)           │
│     2. Rate limiting (abuse is throttled)                          │
│     3. Instant revocation (can disable key if compromised)         │
└─────────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```javascript
// YOUR FRONTEND (Direct calls to OTP Auth API)
// API key IS visible here - this is intentional

const OTP_API_KEY = 'otp_live_sk_xxxxxxxxxxxxxxxx';  // Visible in source

async function requestOTP(email) {
  const response = await fetch('https://auth.idling.app/auth/request-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OTP-API-Key': OTP_API_KEY  // Key sent from browser
    },
    body: JSON.stringify({ email })
  });
  return response.json();
}
```

**OPTIONAL: Configure Allowed Origins for Extra Security**

By default, API keys work from ANY origin. For extra security, you can restrict to specific origins:

1. Go to **Dashboard → API Keys**
2. Click the **🌐** button next to your API key
3. Add your domains:
   - `https://myapp.com`
   - `https://www.myapp.com`
   - `https://staging.myapp.com`
   - `http://localhost:3000` (for development)
4. Click **Save Origins**

**Note:** If you don't configure any origins, the key works from anywhere. This is useful for server-to-server or when you don't need origin restrictions.

**What happens if someone steals the key?**

Depends on your configuration:

**If you configured origins (recommended for frontend):**
- They CANNOT use it from unauthorized origins
- Requests from `https://hacker-site.com` will be rejected
- Only YOUR configured origins are allowed

**If you didn't configure origins:**
- They CAN use it (key works from any origin)
- Rate limits prevent abuse
- You can revoke and rotate the key instantly

**Recommendation:** Always configure origins for keys used in frontend code.

**Pros:**
- No backend required
- Simpler setup for static sites/SPAs
- Good for JAMstack architectures

**Cons:**
- API key is visible (use origin restrictions if concerned)
- Should configure origins for public-facing keys
- Must trust origin-based security model (if using origins)

---

## Security Comparison

| Aspect | Backend-Only | Direct Frontend |
|--------|--------------|-----------------|
| API Key Visibility | Hidden (in server env vars) | Visible (in browser JS) |
| CORS Config | Not needed | Optional (add per-key origins for extra security) |
| Protection Method | Key never exposed | Key is auth (optionally restrict by origin) |
| Backend Required | Yes | No |
| Security Level | Highest | Moderate (High with origin restrictions) |
| Best For | Production apps with backends | Static sites, SPAs |

---

## Setting Up Allowed Origins (Per-Key)

Each API key has its own origin configuration. Navigate to **Dashboard → API Keys**, then click the **🌐** button next to the key you want to configure.

**Default Behavior (No Origins):** Key works from any origin - the API key itself is the authentication.

**With Origins Configured:** Key only works from those specific origins.

### Valid Origin Examples

```
https://myapp.com           ✓ Production domain
https://www.myapp.com       ✓ www subdomain  
https://app.myapp.com       ✓ App subdomain
https://staging.myapp.com   ✓ Staging environment
http://localhost:3000       ✓ Local development
http://localhost:5173       ✓ Vite dev server
http://127.0.0.1:8080       ✓ Local dev with IP
```

### Invalid Origins

```
https://myapp.com/           ✗ No trailing slash
myapp.com                    ✗ Must include protocol
*.myapp.com                  ✗ Wildcards not supported (add each subdomain)
```

---

## Frequently Asked Questions

### Q: If the API key is visible, isn't that insecure?

**A:** The API key by itself only:
- Identifies your tenant account
- Can be restricted to configured origins (optional per-key setting)
- Doesn't authenticate users (JWT does that)

For frontend keys, we recommend configuring allowed origins for extra protection. This is the same model used by Stripe (publishable keys), Firebase, and many other services.

### Q: Can someone use my API key from their website?

**A:** It depends on your configuration:
- **If you configured origins**: No. Requests from unlisted origins will be rejected.
- **If you didn't configure origins**: Yes, but they still need the valid key. The key itself is the authentication.

For maximum security with frontend keys, always configure allowed origins.

### Q: What if I need maximum security?

**A:** Use the **Backend-Only** integration method. The API key never leaves your server.

### Q: Do I need to configure origins for server-to-server calls?

**A:** No. Server-to-server calls don't have an `Origin` header, so origin validation is skipped. This allows your backend to use the API key without restrictions.

### Q: What happens if my key is compromised?

**A:** 
1. Go to Dashboard → API Keys
2. Click **Revoke** on the compromised key
3. Create a new key
4. Update your application with the new key

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OTP AUTH SERVICE - MULTI-TENANCY                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         CUSTOMER A (Tenant)                          │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐  │   │
│  │  │ API Key:    │    │ Allowed     │    │ Rate Limits:            │  │   │
│  │  │ otp_live_sk │    │ Origins:    │    │ 1000 req/hour           │  │   │
│  │  │ _abc123...  │    │ myapp.com   │    │ 10000 req/day           │  │   │
│  │  └─────────────┘    │ staging...  │    └─────────────────────────┘  │   │
│  │                     └─────────────┘                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         CUSTOMER B (Tenant)                          │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐  │   │
│  │  │ API Key:    │    │ Allowed     │    │ Rate Limits:            │  │   │
│  │  │ otp_live_sk │    │ Origins:    │    │ 5000 req/hour           │  │   │
│  │  │ _xyz789...  │    │ otherapp.io │    │ 50000 req/day           │  │   │
│  │  └─────────────┘    │ dev.other.. │    └─────────────────────────┘  │   │
│  │                     └─────────────┘                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     REQUEST FLOW WITH API KEY                        │   │
│  │                                                                      │   │
│  │  Request arrives ──► Extract API Key ──► Validate Key               │   │
│  │                           │                    │                     │   │
│  │                           ▼                    ▼                     │   │
│  │                    Key Invalid?  ────────► 401 Unauthorized          │   │
│  │                           │                    (STOP)                │   │
│  │                           ▼                                          │   │
│  │                    Key Valid ──► Get Key's Allowed Origins           │   │
│  │                           │                                          │   │
│  │                    ┌──────┴──────────┐                               │   │
│  │                    ▼                 ▼                               │   │
│  │            No Origins         Has Origins                            │   │
│  │            Configured         Configured                             │   │
│  │                    │                 │                               │   │
│  │                    ▼                 ▼                               │   │
│  │            Allow ANY          Check Origin                           │   │
│  │            Origin             Against List                           │   │
│  │                    │          ┌─────┴─────┐                          │   │
│  │                    │          ▼           ▼                          │   │
│  │                    │     Origin OK   Origin NOT OK                   │   │
│  │                    │          │           │                          │   │
│  │                    ▼          ▼           ▼                          │   │
│  │               Process Request      403 Forbidden                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start Checklist

### For Backend Integration:
- [ ] Store API key in environment variable (never in code)
- [ ] Create backend endpoints that proxy to OTP Auth API
- [ ] Frontend calls YOUR backend, not OTP Auth directly
- [ ] No origin configuration needed

### For Frontend Integration:
- [ ] Get API key from Dashboard
- [ ] (OPTIONAL) Configure allowed origins on the key for extra security
- [ ] If using origins, include `http://localhost:*` for development
- [ ] Test the key works from your domain(s)
- [ ] Accept that key is visible (protect with origins if needed)

---

## Support

If you have questions about multi-tenancy integration:
1. Check this guide first
2. Review the API documentation at `/docs`
3. Contact support with your customer ID
