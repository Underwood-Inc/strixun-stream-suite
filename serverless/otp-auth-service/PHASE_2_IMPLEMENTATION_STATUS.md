# Phase 2 Implementation - Sensitive Data Request System ✅

## Summary

Phase 2 implementation is now complete. The sensitive data request system allows super admins to request access to double-encrypted user data (like email/userId), and users can approve/reject these requests.

---

## ✅ Completed Tasks

### 1. Data Request Service ✅
- ✅ Created `services/data-request.ts` with full request management
- ✅ Request data structure with TypeScript interfaces
- ✅ KV storage with proper indexing (user index, requester index)
- ✅ Request creation, retrieval, approval, and rejection
- ✅ Request key encryption with requester's JWT
- ✅ Request expiration handling (default: 30 days)

### 2. Admin Data Request Handlers ✅
- ✅ Created `handlers/admin/data-requests.ts`
- ✅ `POST /admin/data-requests` - Create new request
- ✅ `GET /admin/data-requests` - List all requests by requester
- ✅ `GET /admin/data-requests/:id` - Get request details
- ✅ Super-admin authentication required
- ✅ Proper validation and error handling

### 3. User Data Request Handlers ✅
- ✅ Created `handlers/user/data-requests.ts`
- ✅ `GET /user/data-requests` - List requests for user's data
- ✅ `GET /user/data-requests/:id` - Get specific request
- ✅ `POST /user/data-requests/:id/approve` - Approve request
- ✅ `POST /user/data-requests/:id/reject` - Reject request
- ✅ `POST /user/data-requests/:id/decrypt` - Decrypt double-encrypted data
- ✅ User authentication and authorization checks

### 4. Route Integration ✅
- ✅ Added routes to `router/admin-routes.ts`
- ✅ Added routes to `router/user-routes.ts`
- ✅ All routes properly integrated with authentication

### 5. Two-Stage Encryption Integration ✅
- ✅ Request system integrated with two-stage encryption
- ✅ Request keys encrypted with requester's JWT when approved
- ✅ Decrypt endpoint allows requester to decrypt double-encrypted data
- ✅ Owner's JWT required for Stage 1 decryption

---

## 📋 API Endpoints

### Admin Endpoints (Super-Admin Only)

#### Create Data Request
```
POST /admin/data-requests
Authorization: Bearer <super-admin-jwt-or-api-key>

Body:
{
  "targetUserId": "user@example.com",
  "targetCustomerId": "cust_123...", // optional
  "dataType": "email" | "userId" | "custom",
  "reason": "Need to contact user for support",
  "expiresIn": 2592000 // optional, default: 30 days
}

Response:
{
  "success": true,
  "request": {
    "requestId": "req_123...",
    "requesterId": "cust_456...",
    "requesterEmail": "admin@example.com",
    "targetUserId": "user@example.com",
    "targetCustomerId": "cust_123...",
    "dataType": "email",
    "reason": "Need to contact user for support",
    "status": "pending",
    "createdAt": "2024-12-19T...",
    "expiresAt": "2025-01-18T..."
  }
}
```

#### List Data Requests
```
GET /admin/data-requests
Authorization: Bearer <super-admin-jwt-or-api-key>

Response:
{
  "success": true,
  "requests": [
    {
      "requestId": "req_123...",
      "requesterId": "cust_456...",
      "requesterEmail": "admin@example.com",
      "targetUserId": "user@example.com",
      "targetCustomerId": "cust_123...",
      "dataType": "email",
      "reason": "Need to contact user for support",
      "status": "pending" | "approved" | "rejected" | "expired",
      "createdAt": "2024-12-19T...",
      "approvedAt": "2024-12-20T...", // if approved
      "rejectedAt": null, // if rejected
      "expiresAt": "2025-01-18T..."
    }
  ]
}
```

#### Get Data Request
```
GET /admin/data-requests/:id
Authorization: Bearer <super-admin-jwt-or-api-key>

Response:
{
  "success": true,
  "request": {
    "requestId": "req_123...",
    "requesterId": "cust_456...",
    "requesterEmail": "admin@example.com",
    "targetUserId": "user@example.com",
    "targetCustomerId": "cust_123...",
    "dataType": "email",
    "reason": "Need to contact user for support",
    "status": "approved",
    "createdAt": "2024-12-19T...",
    "approvedAt": "2024-12-20T...",
    "expiresAt": "2025-01-18T..."
  }
}
```

### User Endpoints (Authenticated Users)

#### List User's Data Requests
```
GET /user/data-requests
Authorization: Bearer <user-jwt>

Response:
{
  "success": true,
  "requests": [
    {
      "requestId": "req_123...",
      "requesterId": "cust_456...",
      "requesterEmail": "admin@example.com",
      "dataType": "email",
      "reason": "Need to contact user for support",
      "status": "pending",
      "createdAt": "2024-12-19T...",
      "approvedAt": null,
      "rejectedAt": null,
      "expiresAt": "2025-01-18T..."
    }
  ]
}
```

#### Get User's Data Request
```
GET /user/data-requests/:id
Authorization: Bearer <user-jwt>

Response:
{
  "success": true,
  "request": {
    "requestId": "req_123...",
    "requesterId": "cust_456...",
    "requesterEmail": "admin@example.com",
    "dataType": "email",
    "reason": "Need to contact user for support",
    "status": "pending",
    "createdAt": "2024-12-19T...",
    "expiresAt": "2025-01-18T..."
  }
}
```

#### Approve Data Request
```
POST /user/data-requests/:id/approve
Authorization: Bearer <user-jwt>

Body (optional):
{
  "requesterToken": "jwt_token_of_requester" // Optional, defaults to owner's token
}

Response:
{
  "success": true,
  "request": {
    "requestId": "req_123...",
    "status": "approved",
    "approvedAt": "2024-12-20T..."
  },
  "message": "Data request approved successfully"
}
```

#### Reject Data Request
```
POST /user/data-requests/:id/reject
Authorization: Bearer <user-jwt>

Response:
{
  "success": true,
  "request": {
    "requestId": "req_123...",
    "status": "rejected",
    "rejectedAt": "2024-12-20T..."
  },
  "message": "Data request rejected successfully"
}
```

#### Decrypt Double-Encrypted Data
```
POST /user/data-requests/:id/decrypt
Authorization: Bearer <requester-jwt>

Body:
{
  "encryptedData": {
    "doubleEncrypted": true,
    "stage1": {...},
    "stage2": {...}
  },
  "ownerToken": "jwt_token_of_data_owner" // Provided by system
}

Response:
{
  "success": true,
  "decryptedData": "user@example.com"
}
```

---

## 🔐 Encryption Flow

### Request Creation & Approval Flow

```
1. Super Admin creates request:
   POST /admin/data-requests
   {
     "targetUserId": "user@example.com",
     "dataType": "email",
     "reason": "Support request"
   }
   ↓
   Request stored in KV with status: "pending"

2. User (data owner) approves request:
   POST /user/data-requests/:id/approve
   ↓
   - Generate request key
   - Encrypt request key with requester's JWT
   - Store encrypted request key in request
   - Update status to "approved"

3. Requester decrypts data:
   POST /user/data-requests/:id/decrypt
   {
     "encryptedData": { doubleEncrypted: true, ... },
     "ownerToken": "owner_jwt_token"
   }
   ↓
   - Get decrypted request key (using requester's JWT)
   - Decrypt Stage 2 with request key
   - Decrypt Stage 1 with owner's JWT
   - Return decrypted data
```

### Data Encryption Flow

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
Client receives encrypted blob
    ↓
Client decrypts router encryption:
{
  id: "req_123...",           // ✅ Available (single-encrypted)
  customerId: "cust_abc...",  // ✅ Available (single-encrypted)
  userId: {                   // ⚠️ Still double-encrypted (if private)
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

## 📊 Data Request Structure

```typescript
interface DataRequest {
  requestId: string;
  requesterId: string;        // Super admin customerId
  requesterEmail: string;     // Super admin email
  targetUserId: string;        // User whose data is requested (email)
  targetCustomerId: string | null; // User's customerId
  dataType: 'email' | 'userId' | 'custom';
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  encryptedRequestKey?: string; // Request key encrypted with requester's JWT (when approved)
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  expiresAt: string;
  expiresIn: number;           // TTL in seconds (default: 30 days)
}
```

---

## 🔒 Security Features

1. **Super-Admin Authentication**: All admin endpoints require super-admin authentication (API key or email-based)
2. **User Authorization**: Users can only view/approve/reject requests for their own data
3. **Request Key Encryption**: Request keys are encrypted with requester's JWT when approved
4. **Request Expiration**: Requests expire after 30 days (configurable)
5. **Two-Stage Encryption**: Data requires both owner's JWT and approved request key to decrypt
6. **Request Verification**: Decrypt endpoint verifies requester matches approved request

---

## ⚠️ Known Limitations & Future Enhancements

1. **Request Key in Response Builder**:
   - Currently, `response-builder.ts` generates a default request key for each encryption
   - When a request is approved, the requester can decrypt using the decrypt endpoint
   - Future: Store approved request keys per user and use them in responses

2. **Owner JWT Token Retrieval**:
   - Currently, owner's JWT token must be provided in decrypt request
   - Future: System should provide owner's JWT token automatically when decrypting for approved requesters

3. **Request Notifications**:
   - Currently, users must check for requests manually
   - Future: Add notification system (email, in-app) when requests are created

4. **Request History**:
   - Currently, requests are stored with expiration
   - Future: Add permanent audit log of all requests (approved/rejected)

5. **Bulk Requests**:
   - Currently, one request per user
   - Future: Support bulk requests for multiple users

---

## 🧪 Testing

All code is TypeScript with proper type safety:
- ✅ No linter errors
- ✅ Proper error handling
- ✅ Type-safe interfaces
- ✅ Comprehensive validation

**Recommended Test Cases:**
1. Create request as super admin
2. List requests as super admin
3. View request as user
4. Approve request as user
5. Reject request as user
6. Decrypt data with approved request
7. Verify unauthorized access is blocked
8. Verify request expiration

---

## 📋 Next Steps (Phase 3)

1. **Customer Creation Enhancement**:
   - Enhanced customer data structure (subscriptions, tiers, flairs)
   - Dedicated customer KV namespace (`CUSTOMER_KV`)
   - Customer service migration to dedicated namespace
   - Random display name generation during customer creation

2. **Customer API Worker**:
   - Create Customer API Worker (structure, routes, handlers)
   - Migrate Customer Operations (move handlers, update OTP service/dashboard)
   - Test and Deploy

---

**Status:** ✅ **Phase 2 COMPLETE**
**Last Updated:** 2024-12-19
**Files Created:**
- `serverless/otp-auth-service/services/data-request.ts`
- `serverless/otp-auth-service/handlers/admin/data-requests.ts`
- `serverless/otp-auth-service/handlers/user/data-requests.ts`

**Files Modified:**
- `serverless/otp-auth-service/router/admin-routes.ts`
- `serverless/otp-auth-service/router/user-routes.ts`

