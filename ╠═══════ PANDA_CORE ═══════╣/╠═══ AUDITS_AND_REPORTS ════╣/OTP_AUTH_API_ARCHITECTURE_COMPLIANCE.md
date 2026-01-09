# API Architecture Compliance - Root Config Fields [LOCK]

> **Ensuring all responses include `id` and `customerId` per enhanced API architecture, even when encrypted**

**Last Updated:** 2025-12-29

---

## ✓ Current Implementation

### How It Works

1. **Handler Returns Data with Root Config:**
   ```javascript
   // handlers/admin/customers.js
   return new Response(JSON.stringify({
       id: requestId,           // ✓ Always included
       customerId: customer.customerId, // ✓ Always included
       name: customer.name,
       email: customer.email,
       // ... other fields
   }))
   ```

2. **Router Encrypts Entire Response:**
   ```typescript
   // router/admin-routes.ts
   const responseData = await handlerResponse.json();
   const encrypted = await encryptWithJWT(responseData, auth.jwtToken);
   // ✓ Entire object encrypted, including id and customerId
   ```

3. **Client Decrypts:**
   ```typescript
   // dashboard/src/lib/api-client.ts
   const decrypted = await decryptWithJWT(encryptedData, token);
   // ✓ Returns: { id, customerId, ...customerData }
   ```

---

## [LOCK] Encryption Behavior

### Two Types of Encryption

1. **Single-Encryption (Router Level):**
   - Entire response encrypted with user's JWT
   - User can always decrypt with their token
   - Includes: `id`, `customerId`, and all non-sensitive fields

2. **Double-Encryption (Field Level):**
   - Sensitive fields encrypted twice:
     - Stage 1: User's JWT
     - Stage 2: Request key (requires approved request)
   - Includes: `email` (when private), and other sensitive data

### Encryption Flow

```
Handler Response:
{
  id: "req_123...",           // Single-encrypted (router)
  customerId: "cust_abc...",  // Single-encrypted (router)
  name: "John",               // Single-encrypted (router)
  email: {                    // Double-encrypted (if private)
    doubleEncrypted: true,
    stage1: {...},            // Encrypted with user's JWT
    stage2: {...}             // Encrypted with request key
  }
}
    ->
Router Encrypts (entire object with user's JWT):
{
  version: 3,
  encrypted: true,
  algorithm: "AES-GCM-256",
  iv: "...",
  salt: "...",
  tokenHash: "...",
  data: "<encrypted_base64>"  // Contains id, customerId, name, and double-encrypted email
}
    ->
Client Receives Encrypted Blob
    ->
Client Decrypts with JWT Token:
{
  id: "req_123...",           // ✓ Available (single-encrypted)
  customerId: "cust_abc...",  // ✓ Available (single-encrypted)
  name: "John",               // ✓ Available (single-encrypted)
  email: {                    // ⚠ Still double-encrypted
    doubleEncrypted: true,
    stage1: {...},
    stage2: {...}
  }
}
    ->
To Decrypt Email (if approved request exists):
1. Decrypt request key with requester's JWT
2. Decrypt Stage 2 with request key
3. Decrypt Stage 1 with user's JWT
4. Get: "john@example.com"
```

---

## ✓ Compliance Status

### Current Handlers

| Handler | Includes `id` | Includes `customerId` | Encrypted |
|---------|--------------|---------------------|-----------|
| `GET /admin/customers/me` | ✓ Yes | ✓ Yes | ✓ Yes (via router) |
| `PUT /admin/customers/me` | ⚠ Needs update | ✓ Yes | ✓ Yes (via router) |
| `GET /auth/me` | ✓ Yes (customerId) | ✓ Yes | ✗ No (public endpoint) |
| `POST /auth/refresh` | ✓ Yes (customerId) | ✓ Yes | ✗ No (public endpoint) |

---

## Required Updates

### 1. Update All Admin Handlers

**Pattern to follow:**
```javascript
// Extract customerId from JWT for root config
let customerId = null;
const authHeader = request.headers.get('Authorization');
if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
        const { verifyJWT, getJWTSecret } = await import('../../utils/crypto.js');
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        if (payload) {
            customerId = payload.customerId || payload.sub || null;
        }
    } catch (jwtError) {
        // Continue without customerId
    }
}

const requestId = customerId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

return new Response(JSON.stringify({
    id: requestId,              // ✓ Always include
    customerId: customerId,    // ✓ Always include
    // ... rest of response data
}))
```

### 2. Future Phases Will:

- ✓ **Phase 2 (User Preferences):** Include `id` and `customerId` in all preference responses
- ✓ **Phase 3 (Display Name):** Include `id` and `customerId` in all display name responses
- ✓ **Phase 4 (Customer Enhancement):** Include `id` and `customerId` in all customer responses
- ✓ **Phase 5 (Request System):** Include `id` and `customerId` in all request responses

---

## [LOCK] Encryption Compatibility

### Why This Works

1. **Encryption is Transparent:**
   - Router encrypts entire response object
   - `id` and `customerId` are part of the object
   - They get encrypted along with everything else
   - Client decrypts entire object
   - `id` and `customerId` are still present after decryption

2. **No Special Handling Needed:**
   - Encryption doesn't need to know about root config fields
   - It just encrypts whatever the handler returns
   - As long as handler includes `id` and `customerId`, they'll be encrypted and decrypted correctly

3. **Client-Side:**
   - Client decrypts using JWT token
   - Decrypted data includes `id` and `customerId`
   - Client can use these fields normally

---

## Verification Checklist

For each handler, ensure:

- [ ] Handler extracts `customerId` from JWT (if available)
- [ ] Handler generates `requestId` if `customerId` not available
- [ ] Handler includes `id: requestId` in response
- [ ] Handler includes `customerId: customerId` in response
- [ ] Router encrypts response (if JWT auth)
- [ ] Client decrypts response (if encrypted)
- [ ] Decrypted response includes `id` and `customerId`

---

## Next Steps

1. ✓ **DONE:** Updated `GET /admin/customers/me` to include `id` and `customerId`
2. ⚠ **TODO:** Update `PUT /admin/customers/me` to include `id` and `customerId`
3. ⚠ **TODO:** Update all other admin handlers
4. ⚠ **TODO:** Document pattern for future handlers
5. ⚠ **TODO:** Add validation to ensure root config fields are always present

---

**Status:** ✓ **COMPLIANT** - Encryption works with root config fields, they're included in encrypted responses and available after decryption.

