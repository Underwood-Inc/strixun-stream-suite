# Two-Stage Encryption Architecture [LOCK]

> **Double encryption system where data owners control access to their sensitive information**

**Last Updated:** 2025-12-29

---

## Core Concept

**Two-Stage Encryption:**
1. **Stage 1:** Encrypt with user's JWT (user can always decrypt)
2. **Stage 2:** Encrypt Stage 1 result with request key (requires approved request to decrypt)

**Owner Control:**
- User (owner) must approve requests to view their double-encrypted data
- Super admin can request access, but user decides
- Request key is only provided after user approval

---

## Response Structure

### Root Config Fields (Always Available)

```json
{
  "id": "req_123...",           // [SUCCESS] Always included, single-encrypted (user's JWT)
  "customerId": "cust_abc...",  // [SUCCESS] Always included, single-encrypted (user's JWT)
  // ... other fields
}
```

**Encryption:** Single-encrypted with user's JWT (router handles this)
**Access:** User can always decrypt these fields with their JWT token

---

### Sensitive Fields (Double-Encrypted)

```json
{
  "id": "req_123...",
  "customerId": "cust_abc...",
  "email": {
    "doubleEncrypted": true,
    "stage1": {
      "encrypted": true,
      "algorithm": "AES-GCM-256",
      "iv": "...",
      "salt": "...",
      "tokenHash": "...",
      "data": "..."  // Encrypted with user's JWT
    },
    "stage2": {
      "encrypted": true,
      "algorithm": "AES-GCM-256",
      "iv": "...",
      "salt": "...",
      "keyHash": "...",
      "data": "..."  // Encrypted with request key (contains Stage 1 data)
    },
    "timestamp": "2024-12-25T..."
  }
}
```

**Encryption:** Double-encrypted (Stage 1: user's JWT, Stage 2: request key)
**Access:** Requires approved request + user's JWT to decrypt

---

## Encryption Flow

### When Storing Sensitive Data

```
User's Email: "user@example.com"
    ->
Stage 1: Encrypt with User's JWT
    ->
Stage 1 Encrypted Data
    ->
Stage 2: Encrypt with Request Key
    ->
Double-Encrypted Email Object
    ->
Stored in Response
```

### When User Views Their Own Data

```
Double-Encrypted Email Object
    ->
User has their JWT (Stage 1 key)
    ->
User has request key (from approved request OR generated for self-access)
    ->
Stage 2: Decrypt with Request Key
    ->
Stage 1 Encrypted Data
    ->
Stage 1: Decrypt with User's JWT
    ->
Decrypted Email: "user@example.com"
```

### When Requester Views Data (After Approval)

```
Double-Encrypted Email Object
    ->
Requester has User's JWT (from request context)
    ->
Requester has Request Key (from approved request, encrypted with requester's JWT)
    ->
Decrypt Request Key with Requester's JWT
    ->
Stage 2: Decrypt with Request Key
    ->
Stage 1 Encrypted Data
    ->
Stage 1: Decrypt with User's JWT
    ->
Decrypted Email: "user@example.com"
```

---

## Request System Flow

### 1. Super Admin Creates Request

```typescript
POST /admin/data-requests
{
  "targetCustomerId": "cust_abc...",
  "dataType": "email",
  "reason": "Support request"
}
```

**Result:**
- Request stored with `status: 'pending'`
- Request key generated but NOT yet accessible
- User notified (optional)

---

### 2. User Approves Request

```typescript
POST /user/data-requests/:requestId/approve
Authorization: Bearer <user_jwt_token>
```

**What Happens:**
- Request status changed to `approved`
- Request key encrypted with requester's JWT
- Encrypted request key stored in request object
- User can revoke later if needed

---

### 3. Requester Accesses Data

```typescript
GET /admin/data-requests/:requestId/decrypt
Authorization: Bearer <requester_jwt_token>
```

**What Happens:**
1. Verify request is approved
2. Decrypt request key with requester's JWT
3. Use request key + user's JWT to decrypt double-encrypted data
4. Return decrypted data

---

## Implementation Details

### Response Building

**Pattern:**
```javascript
// Always include id and customerId (single-encrypted)
const response = {
    id: requestId,
    customerId: customerId,
    // ... other fields
};

// For sensitive fields, use double-encryption if user hasn't made them public
if (userPreferences.emailVisibility === 'private') {
    const requestKey = await getOrCreateRequestKey(userId, customerId, env);
    response.email = await encryptTwoStage(
        customer.email,
        userToken,
        requestKey
    );
} else {
    // Public - single-encrypted only (user's JWT)
    response.email = customer.email; // Will be encrypted by router
}
```

---

### Request Key Management

**Storage:**
- Request keys stored encrypted in KV
- Key: `user_request_key_${userId}_${dataType}`
- Value: Encrypted request key (encrypted with user's JWT for self-access)

**Self-Access:**
- User can always decrypt their own double-encrypted data
- Request key encrypted with user's JWT for storage
- User decrypts key with their JWT, then uses it to decrypt data

**Requester Access:**
- Request key encrypted with requester's JWT after approval
- Stored in request object: `request.decryptionKey` (encrypted)
- Requester decrypts key with their JWT, then uses it + user's JWT to decrypt data

---

## [SUCCESS] Compliance with API Architecture

### Root Config Fields

- [SUCCESS] `id` - Always included, single-encrypted (user's JWT)
- [SUCCESS] `customerId` - Always included, single-encrypted (user's JWT)
- [SUCCESS] Available after router decryption
- [SUCCESS] No special handling needed

### Sensitive Fields

- [SUCCESS] Double-encrypted when user hasn't made them public
- [SUCCESS] Requires approved request to decrypt (for requesters)
- [SUCCESS] User can always decrypt their own data
- [SUCCESS] Agnostic/reusable for any sensitive field

---

## [LOCK] Security Guarantees

1. **No Fallback Decryption:**
   - If request key doesn't match, decryption fails
   - If user's JWT doesn't match, decryption fails
   - No way to decrypt without both keys

2. **Owner Control:**
   - User must approve requests
   - User can revoke requests
   - User controls who sees their data

3. **Audit Trail:**
   - All requests logged
   - All decryption attempts logged
   - User can see who accessed their data

---

## Next Steps

1. [SUCCESS] **DONE:** Created two-stage encryption utilities
2. [WARNING] **TODO:** Create request system handlers
3. [WARNING] **TODO:** Update response builders to use double-encryption for sensitive fields
4. [WARNING] **TODO:** Create user approval endpoints
5. [WARNING] **TODO:** Integrate with user preferences (email visibility)

---

**Status:** [SUCCESS] **TWO-STAGE ENCRYPTION SYSTEM CREATED** - Ready for request system implementation

