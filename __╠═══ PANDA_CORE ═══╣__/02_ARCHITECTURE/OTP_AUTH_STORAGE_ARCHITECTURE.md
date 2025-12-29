# Storage Architecture - Current Implementation

**Last Updated:** 2025-12-29

## Overview

All data is currently stored in a **single Cloudflare Worker** using **Cloudflare KV** (Key-Value store).

---

## Worker Configuration

**Worker Name:** `otp-auth-service`  
**Entry Point:** `worker.ts`  
**Location:** `serverless/otp-auth-service/`

**Configuration File:** `wrangler.toml`

```toml
name = "otp-auth-service"
main = "worker.ts"
compatibility_date = "2024-12-01"

[[kv_namespaces]]
binding = "OTP_AUTH_KV"
id = "680c9dbe86854c369dd23e278abb41f9"
```

---

## Storage Mechanism: Cloudflare KV

**KV Namespace:** `OTP_AUTH_KV` (single namespace for all data)

**Type:** Key-Value Store (eventually consistent, global edge storage)

**Characteristics:**
- Eventually consistent (reads may be slightly stale)
- Global edge distribution
- Key-value pairs (strings, up to 25MB per value)
- JSON serialization for complex data
- TTL (Time To Live) support for expiration

---

## Data Storage Keys

All keys use customer isolation via `getCustomerKey(customerId, key)` function.

### User Data
**Key Pattern:** `cust_{customerId}_user_{emailHash}` or `user_{emailHash}` (legacy)

**Storage:**
```typescript
{
  userId: string;
  email: string;
  displayName: string;
  customerId: string | null;
  createdAt: string;
  lastLogin: string;
}
```

**TTL:** 31536000 seconds (1 year) [WARNING] **ISSUE: User data expires after 1 year of inactivity**

**Location:** `services/customer.ts` -> `getCustomerKey()`

---

### User Preferences
**Key Pattern:** `cust_{customerId}_user_preferences_{userId}`

**Storage:**
```typescript
{
  emailVisibility: 'private' | 'public';
  displayName: {
    current: string;
    previousNames: Array<{
      name: string;
      changedAt: string;
      reason: 'auto-generated' | 'user-changed' | 'regenerated';
    }>;
    lastChangedAt: string | null;
    changeCount: number;
  };
  privacy: {
    showEmail: boolean;
    showProfilePicture: boolean;
  };
}
```

**TTL:** 31536000 seconds (1 year) [SUCCESS] **Matches user data TTL for consistency**

**Location:** `services/user-preferences.ts`

**Note:** TTL is reset when:
- User logs in (via `verify-otp.ts` and `session.ts`)
- Preferences are updated
- Display name is changed

---

### Customer Data
**Key Pattern:** `customer_{customerId}`

**Storage:**
```typescript
{
  customerId: string;
  name: string;
  email: string;
  companyName: string;
  plan: string;
  status: string;
  createdAt: string;
  config: {...};
  features: {...};
}
```

**TTL:** None (persistent)

**Location:** `services/customer.ts`

---

### Other Data Stored in OTP_AUTH_KV

1. **OTP Codes:** `cust_{customerId}_otp_{emailHash}_{timestamp}` (TTL: 600s)
2. **Sessions:** `cust_{customerId}_session_{userId}` (TTL: 25200s / 7 hours)
3. **API Keys:** `cust_{customerId}_api_key_{keyId}` (persistent)
4. **Rate Limits:** `cust_{customerId}_rate_limit_{identifier}` (TTL: 3600s)
5. **Analytics:** `cust_{customerId}_analytics_{date}` (TTL: 2592000s / 30 days)
6. **Display Names:** `cust_{customerId}_display_name_{name}` (persistent)
7. **Blacklisted Tokens:** `cust_{customerId}_blacklist_{tokenHash}` (TTL: 25200s)

---

## Customer Isolation

All data is isolated by `customerId` using the `getCustomerKey()` function:

```typescript
function getCustomerKey(customerId: string | null, key: string): string {
    if (customerId) {
        return `${customerId}_${key}`;
    }
    return key; // Legacy: no customer isolation
}
```

**Example:**
- With customerId (`cust_abc123`): `cust_cust_abc123_user_preferences_user_456`
- Without customerId: `user_preferences_user_456` (legacy)

**Note:** The `getCustomerKey()` function adds `cust_` prefix, so if customerId is already `cust_abc123`, the final key becomes `cust_cust_abc123_...`

---

## Current Architecture (Single Worker)

```
otp-auth-service (Worker)
├── OTP_AUTH_KV (KV Namespace)
│   ├── User Data
│   ├── User Preferences
│   ├── Customer Data
│   ├── OTP Codes
│   ├── Sessions
│   ├── API Keys
│   ├── Rate Limits
│   └── Analytics
└── All handlers/services in one worker
```

---

## [WARNING] Recommended Architecture (Not Yet Implemented)

According to audit documents, the recommended architecture is:

### Dedicated Customer API Worker

```
customer-api (Worker)
├── CUSTOMER_KV (KV Namespace)
│   ├── Customer Data
│   ├── User Preferences
│   └── Subscriptions
└── Separate worker for customer/user data

otp-auth-service (Worker)
├── OTP_AUTH_KV (KV Namespace)
│   ├── OTP Codes
│   ├── Sessions
│   ├── Rate Limits
│   └── Analytics
└── Auth-only worker
```

**Benefits:**
- [SUCCESS] Decoupled architecture
- [SUCCESS] Single concern per worker
- [SUCCESS] Easier to scale
- [SUCCESS] Better organization
- [SUCCESS] Similar to game-api pattern

**Status:** [ERROR] **NOT IMPLEMENTED** - All data still in `otp-auth-service` worker

---

## Data Access Pattern

### Reading Data
```typescript
const key = getCustomerKey(customerId, `user_preferences_${userId}`);
const preferences = await env.OTP_AUTH_KV.get(key, { type: 'json' });
```

### Writing Data
```typescript
const key = getCustomerKey(customerId, `user_preferences_${userId}`);
await env.OTP_AUTH_KV.put(key, JSON.stringify(preferences));
```

### With TTL
```typescript
await env.OTP_AUTH_KV.put(key, JSON.stringify(data), { 
    expirationTtl: 31536000 // 1 year in seconds
});
```

---

## Summary

**Current State:**
- [SUCCESS] Single worker: `otp-auth-service`
- [SUCCESS] Single KV namespace: `OTP_AUTH_KV`
- [SUCCESS] All data stored in one place
- [SUCCESS] Customer isolation via key prefixes
- [ERROR] No dedicated customer API worker (recommended but not implemented)

**Storage Mechanism:**
- **Type:** Cloudflare KV (Key-Value store)
- **Consistency:** Eventually consistent
- **Distribution:** Global edge
- **Max Value Size:** 25MB per key
- **TTL Support:** Yes

