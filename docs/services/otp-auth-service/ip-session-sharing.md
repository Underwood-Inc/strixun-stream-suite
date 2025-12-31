# OTP Auth IP-Based Session Sharing

> **Implementation Date**: 2025-12-26  
> **Status**: [OK] **FULLY IMPLEMENTED AND PRODUCTION READY**  
> **Purpose**: Enable cross-application session sharing using IP-based session discovery

---

## [EMOJI] Implementation Status

### [OK] Core Features - **COMPLETE**

- [OK] IP address tracking in session storage
- [OK] IP-to-session mapping/index service
- [OK] Session lookup endpoint (`GET /auth/session-by-ip`)
- [OK] Session lifecycle management (create, update, delete)
- [OK] Automatic cleanup of expired IP mappings
- [OK] Multiple sessions per IP support
- [OK] Admin-only specific IP lookup
- [OK] Privacy-preserving (IPs hashed in storage)

### [WARNING] Optional Enhancements - **PARTIALLY IMPLEMENTED**

- [OK] **Rate limiting on session lookup endpoint** - **COMPLETE**
  - Uses consolidated `checkIPRateLimit` from existing rate limiting service
  - Respects customer plan limits (free: 10/hour, pro: 50/hour, enterprise: 500/hour)
  - Super admins exempt from rate limits
  - Rate limit headers included in responses
- [WARNING] Strict IP validation (optional per-customer config)
- [WARNING] City tracking (`CF-IPCity` header)
- [WARNING] Separate last access time per IP

**Note**: The core functionality is complete and ready for use. Rate limiting is implemented using the consolidated rate limiting service. Optional enhancements can be added based on specific requirements.

---

## [EMOJI] Overview

The OTP auth backend now supports **IP-based session tracking** and **cross-application session sharing**. This allows users logged in on a given IP address to access other applications using the same OTP auth backend without re-authentication.

---

## [EMOJI] How It Works

### Session Storage with IP Tracking

When a user logs in (via OTP verification), the system now:

1. **Stores IP address in session data**
   - IP address is extracted from `CF-Connecting-IP` or `X-Forwarded-For` headers
   - Stored alongside user session data in KV storage
   - Includes optional metadata: `userAgent`, `country`

2. **Creates IP-to-Session mapping**
   - Maps IP address (hashed for privacy) to active sessions
   - Supports multiple sessions per IP (different users on same IP)
   - Automatically expires with session TTL (7 hours)

3. **Maintains mapping on session lifecycle**
   - **Create**: IP mapping created on login
   - **Refresh**: IP mapping updated if IP changes
   - **Delete**: IP mapping cleaned up on logout

### Cross-Application Session Discovery

Applications can discover active sessions for a given IP address using the new endpoint:

```
GET /auth/session-by-ip
GET /auth/session-by-ip?ip={ip}
```

---

##  API Endpoints

### Get Sessions by IP

**Endpoint**: `GET /auth/session-by-ip`

**Description**: Returns active sessions for the request IP address (authenticated users can see their own sessions)

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Response**:
```json
{
  "sessions": [
    {
      "userId": "user_abc123",
      "email": "user@example.com",
      "customerId": "cust_xyz789",
      "expiresAt": "2025-12-26T12:00:00Z",
      "createdAt": "2025-12-26T05:00:00Z"
    }
  ],
  "count": 1
}
```

**Status Codes**:
- `200`: Success
- `401`: Unauthorized (missing or invalid token)
- `500`: Server error

---

### Get Sessions for Specific IP (Admin Only)

**Endpoint**: `GET /auth/session-by-ip?ip={ip_address}`

**Description**: Returns active sessions for a specific IP address (requires super admin authentication)

**Headers**:
```
Authorization: Bearer {admin_jwt_token}
```

**Query Parameters**:
- `ip` (required): IP address to query

**Response**: Same as above

**Status Codes**:
- `200`: Success
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (not a super admin)
- `500`: Server error

---

## [EMOJI] Usage Examples

### Example 1: Discover Active Sessions for Current IP

```typescript
// Application A: User is logged in
const response = await fetch('https://auth.idling.app/auth/session-by-ip', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
// Returns sessions for the request IP
console.log(`Found ${data.count} active sessions`);
```

### Example 2: Cross-Application Session Sharing

```typescript
// Application B: Check if user is already logged in on this IP
async function checkExistingSession() {
  // Get request IP from headers
  const clientIP = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('X-Forwarded-For');
  
  // Query OTP auth backend for active sessions
  const response = await fetch(
    `https://auth.idling.app/auth/session-by-ip`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tempToken}`, // Or use API key
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (response.ok) {
    const { sessions } = await response.json();
    
    // If session exists, use it to authenticate user
    if (sessions.length > 0) {
      const session = sessions[0];
      // Use session.userId to identify user
      // Application can then use this to auto-login user
      return session;
    }
  }
  
  return null;
}
```

### Example 3: Admin Query for Specific IP

```typescript
// Admin tool: Check sessions for a specific IP
async function getSessionsForIP(ip: string, adminToken: string) {
  const response = await fetch(
    `https://auth.idling.app/auth/session-by-ip?ip=${encodeURIComponent(ip)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (response.ok) {
    const data = await response.json();
    return data.sessions;
  }
  
  throw new Error('Failed to get sessions');
}
```

---

## [EMOJI] Security Considerations

### IP Address Privacy

- **IP addresses are hashed** in storage keys using SHA-256
- **Plaintext IP** is only stored in session data (for validation)
- **IP addresses are NOT included** in API responses (for privacy)

### Access Control

1. **Request IP Lookup** (`GET /auth/session-by-ip`)
   - Requires authentication (Bearer token)
   - Users can see sessions for their request IP
   - Returns sessions for the request IP only

2. **Specific IP Lookup** (`GET /auth/session-by-ip?ip={ip}`)
   - Requires **super admin** authentication
   - Only super admins can query specific IPs
   - Prevents unauthorized IP surveillance

### Rate Limiting [OK] **IMPLEMENTED**

- [OK] IP lookup endpoint is rate-limited using consolidated rate limiting service
- [OK] Per-IP rate limits based on customer plan (free/pro/enterprise)
- [OK] Uses `checkIPRateLimit` from `services/rate-limit.ts`
- [OK] Rate limit headers included in responses (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- [OK] Super admins exempt from rate limits
- [OK] Prevents abuse of session discovery

### Data Retention

- IP mappings expire with sessions (7 hours TTL)
- No long-term IP tracking
- Automatic cleanup of expired mappings

---

##  Architecture

### Storage Structure

1. **Session Data** (`cust_{customerId}_session_{userId}`)
   ```json
   {
     "userId": "user_abc123",
     "email": "user@example.com",
     "token": "hashed_token",
     "expiresAt": "2025-12-26T12:00:00Z",
     "createdAt": "2025-12-26T05:00:00Z",
     "ipAddress": "192.168.1.1",
     "userAgent": "Mozilla/5.0...",
     "country": "US"
   }
   ```

2. **IP-to-Session Index** (`ip_session_{hashedIP}`)
   ```json
   [
     {
       "userId": "user_abc123",
       "customerId": "cust_xyz789",
       "sessionKey": "cust_xyz789_session_user_abc123",
       "expiresAt": "2025-12-26T12:00:00Z",
       "email": "user@example.com",
       "createdAt": "2025-12-26T05:00:00Z"
     }
   ]
   ```

### Session Lifecycle

```
Login (OTP Verify)
  
Create Session (with IP)
  
Create IP Mapping
  
[Session Active]
  
Refresh Session (update IP if changed)
  
Logout/Expiration
  
Delete IP Mapping
  
Delete Session
```

---

## [OK] Benefits

1. **Seamless Cross-Application Access**
   - Users logged in on one app can access other apps without re-authentication
   - Reduces friction in multi-application environments

2. **IP-Based Session Discovery**
   - Applications can discover active sessions for a given IP
   - Enables automatic session sharing across applications

3. **Privacy-Preserving**
   - IP addresses are hashed in storage
   - No IP addresses in API responses
   - Automatic expiration and cleanup

4. **Secure**
   - Requires authentication for session lookup
   - Admin-only access for specific IP queries
   - Rate limiting support

---

## [EMOJI] Migration Guide

### For Existing Applications

No changes required! The new functionality is backward compatible:

- Existing sessions continue to work
- New sessions automatically include IP tracking
- Old sessions without IP are handled gracefully

### For New Applications

1. **Update to use IP-based session discovery**
   - Call `GET /auth/session-by-ip` on application startup
   - Use returned sessions to auto-authenticate users

2. **Handle multiple sessions per IP**
   - Applications may receive multiple sessions for an IP
   - Choose appropriate session based on your use case
   - Consider showing user selection if multiple users on same IP

---

## [EMOJI] Monitoring

### Key Metrics

- Number of IP-to-session mappings
- Session lookup requests per IP
- Cross-application session sharing success rate
- IP mapping cleanup rate

### Logging

The system logs:
- IP address on session creation
- IP changes on session refresh
- IP mapping cleanup on logout

---

## [EMOJI] Troubleshooting

### Issue: No sessions returned for IP

**Possible Causes**:
1. No active sessions for that IP
2. Sessions expired (7-hour TTL)
3. IP address extraction failed (check headers)

**Solution**:
- Verify IP address is being extracted correctly
- Check session expiration times
- Ensure sessions are being created with IP tracking

### Issue: Multiple sessions for same IP

**Expected Behavior**:
- Multiple users can be logged in from the same IP
- This is normal (e.g., shared network, VPN, etc.)

**Solution**:
- Applications should handle multiple sessions
- Consider user selection UI if needed

### Issue: Admin query returns 403

**Possible Causes**:
1. User is not a super admin
2. Token is invalid or expired

**Solution**:
- Verify user has super admin privileges
- Check token validity
- Ensure proper authentication headers

---

## [EMOJI] Related Documentation

- [OTP Auth Session Audit](./OTP_AUTH_SESSION_AUDIT.md) - Detailed audit and implementation plan
- [OTP Auth API Documentation](./OTP_AUTH_API_DOCUMENTATION.md) - Complete API reference
- [OTP Auth Implementation Summary](./AUTH_IMPLEMENTATION_SUMMARY.md) - Overall implementation details

