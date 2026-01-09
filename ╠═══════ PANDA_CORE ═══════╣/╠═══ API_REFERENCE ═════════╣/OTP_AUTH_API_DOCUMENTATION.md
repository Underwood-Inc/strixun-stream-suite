# OTP Auth Service - Complete API Documentation

> **Complete API reference for the OTP Authentication Service**

## Base URL

```
https://your-worker.workers.dev
```

## Authentication

The OTP Auth Service uses a two-layer authentication system:

### Layer 1: Tenant Identification (API Keys)
For tenant identification and configuration (multi-tenancy):
- **Header**: `X-OTP-API-Key: {api_key}`
- **Purpose**: Identifies which tenant/organization
- **Format**: `otp_live_sk_...` or `otp_test_sk_...`
- **Used for**: `/auth/request-otp`, `/auth/verify-otp` (optional)

### Layer 2: Customer Authentication (JWT Tokens)
For customer authentication and authorization:
- **Header**: `Authorization: Bearer {jwt_token}`
- **Purpose**: Authenticates specific customer
- **Format**: JWT token from `/auth/verify-otp`
- **Used for**: `/auth/me`, `/auth/logout`, `/auth/quota`, etc.

**CRITICAL**: API keys do NOT go in `Authorization` header. JWT tokens do NOT go in `X-OTP-API-Key` header.

---

## Public Endpoints

### POST `/signup`
Public customer signup (tenant registration).

**Request:**
```json
{
  "email": "admin@company.com",
  "companyName": "Acme Corp",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Signup successful. Check your email for verification code.",
  "expiresAt": "2025-01-02T00:00:00.000Z"
}
```

### POST `/signup/verify`
Verify signup email and create tenant account.

**Request:**
```json
{
  "email": "admin@company.com",
  "token": "verification_token",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "customerId": "cust_abc123",
  "apiKey": "otp_live_sk_...",
  "keyId": "key_123",
  "message": "Account verified and created successfully.",
  "customer": {
    "customerId": "cust_abc123",
    "name": "Acme Corp",
    "email": "admin@company.com",
    "plan": "free",
    "status": "active"
  }
}
```

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "otp-auth-service",
  "version": "2.0.0",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### GET `/health/ready`
Readiness probe.

**Response:**
```json
{
  "status": "ready"
}
```

### GET `/health/live`
Liveness probe.

**Response:**
```json
{
  "status": "alive"
}
```

---

## Authentication Endpoints

### POST `/auth/request-otp`
Request an OTP code to be sent to a customer's email address.

**Headers:**
- `X-OTP-API-Key: {api_key}` (optional - for multi-tenant identification)

**Request:**
```json
{
  "email": "alice@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to email",
  "expiresIn": 600,
  "remaining": 2
}
```

**Error Responses:**
- `400` - Invalid email format
- `429` - Rate limit exceeded or quota exceeded
- `500` - Email sending failed

### POST `/auth/verify-otp`
Verify an OTP code and get a JWT token for the customer.

**Headers:**
- `X-OTP-API-Key: {api_key}` (optional - for multi-tenant identification)

**Request:**
```json
{
  "email": "alice@example.com",
  "otp": "123456789"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customerId": "cust_abc123",
  "email": "alice@example.com",
  "displayName": "CoolPanda42",
  "expiresAt": "2025-01-01T07:00:00.000Z"
}
```

**Error Responses:**
- `400` - Invalid email or OTP format
- `401` - Invalid OTP, expired, or too many attempts
- `404` - OTP not found

### GET `/auth/me`
Get current customer information (requires JWT token).

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT from verify-otp)

**Response:**
```json
{
  "success": true,
  "customerId": "cust_abc123",
  "email": "alice@example.com",
  "displayName": "CoolPanda42",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "lastLogin": "2025-01-01T00:00:00.000Z"
}
```

### POST `/auth/logout`
Logout and revoke the current JWT token.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT from verify-otp)

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST `/auth/refresh`
Refresh an expiring JWT token.

**Request:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2025-01-01T07:00:00.000Z"
}
```

### GET `/auth/quota`
Get current quota usage for the authenticated customer.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT from verify-otp)
- `X-OTP-API-Key: {api_key}` (optional - for cross-validation)

**Response:**
```json
{
  "success": true,
  "quota": {
    "plan": "pro",
    "otpRequests": {
      "used": 1250,
      "limit": 10000,
      "remaining": 8750
    },
    "period": {
      "start": "2025-01-01T00:00:00.000Z",
      "end": "2025-02-01T00:00:00.000Z"
    }
  }
}
```

---

## Tenant Management Endpoints

**Note**: These endpoints use JWT authentication for tenant administrators, NOT API keys.

### GET `/admin/customers/me`
Get current tenant information.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Response:**
```json
{
  "success": true,
  "customer": {
    "customerId": "cust_abc123",
    "name": "Acme Corp",
    "email": "admin@company.com",
    "companyName": "Acme Corp",
    "plan": "pro",
    "status": "active",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "features": {
      "customEmailTemplates": true,
      "webhooks": true,
      "analytics": true,
      "sso": false
    }
  }
}
```

### PUT `/admin/customers/me`
Update tenant information.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Request:**
```json
{
  "name": "Updated Name",
  "companyName": "Updated Company"
}
```

**Response:**
```json
{
  "success": true,
  "customer": {
    "customerId": "cust_abc123",
    "name": "Updated Name",
    "companyName": "Updated Company",
    "plan": "pro",
    "status": "active"
  },
  "message": "Customer info updated successfully"
}
```

---

## Configuration Endpoints

### GET `/admin/config`
Get tenant configuration.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Response:**
```json
{
  "success": true,
  "config": {
    "emailConfig": {
      "fromEmail": "noreply@company.com",
      "fromName": "Acme Corp",
      "subjectTemplate": "Your {{appName}} Verification Code",
      "htmlTemplate": "<custom HTML>",
      "textTemplate": "<custom text>",
      "variables": {
        "appName": "Acme Corp",
        "brandColor": "#007bff",
        "footerText": "© 2025 Acme Corp"
      }
    },
    "rateLimits": {
      "otpRequestsPerHour": 50,
      "otpRequestsPerDay": 5000,
      "maxCustomers": 10000
    },
    "webhookConfig": {
      "url": "https://company.com/webhooks",
      "secret": "webhook_secret",
      "events": ["otp.verified", "customer.created"]
    },
    "allowedOrigins": ["https://app.company.com"]
  },
  "configVersion": 2,
  "plan": "pro",
  "features": {
    "customEmailTemplates": true,
    "webhooks": true,
    "analytics": true
  }
}
```

### PUT `/admin/config`
Update tenant configuration.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Request:**
```json
{
  "config": {
    "rateLimits": {
      "otpRequestsPerHour": 20
    },
    "allowedOrigins": ["https://app.company.com", "https://*.company.com"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "config": { /* updated config */ },
  "configVersion": 3,
  "message": "Configuration updated successfully"
}
```

### PUT `/admin/config/email`
Update email configuration.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Request:**
```json
{
  "fromEmail": "noreply@company.com",
  "fromName": "Acme Corp",
  "subjectTemplate": "Your Code: {{otp}}",
  "htmlTemplate": "<custom HTML with {{otp}}>"
}
```

**Response:**
```json
{
  "success": true,
  "emailConfig": { /* updated email config */ },
  "message": "Email configuration updated successfully"
}
```

---

## API Key Management Endpoints

### GET `/admin/customers/{customerId}/api-keys`
List all API keys for a tenant.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Response:**
```json
{
  "success": true,
  "keys": [
    {
      "keyId": "key_123",
      "name": "Production API Key",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "lastUsed": "2025-01-01T12:00:00.000Z",
      "status": "active"
    }
  ]
}
```

### POST `/admin/customers/{customerId}/api-keys`
Create a new API key.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Request:**
```json
{
  "name": "New API Key"
}
```

**Response:**
```json
{
  "success": true,
  "apiKey": "otp_live_sk_...",
  "keyId": "key_456",
  "name": "New API Key",
  "message": "API key created successfully. Save your API key - it will not be shown again."
}
```

### POST `/admin/customers/{customerId}/api-keys/{keyId}/rotate`
Rotate an API key.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Response:**
```json
{
  "success": true,
  "apiKey": "otp_live_sk_...",
  "keyId": "key_789",
  "oldKeyId": "key_123",
  "message": "API key rotated successfully. Old key will work for 7 days."
}
```

### DELETE `/admin/customers/{customerId}/api-keys/{keyId}`
Revoke an API key.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Response:**
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

---

## Domain Verification Endpoints

### POST `/admin/domains/verify`
Request domain verification.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Request:**
```json
{
  "domain": "company.com"
}
```

**Response:**
```json
{
  "success": true,
  "domain": "company.com",
  "status": "pending",
  "dnsRecord": {
    "type": "TXT",
    "name": "_otpauth-verify.company.com",
    "value": "verification_token",
    "ttl": 3600
  },
  "instructions": "Add a TXT record to your DNS..."
}
```

### GET `/admin/domains/{domain}/status`
Get domain verification status.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Response:**
```json
{
  "success": true,
  "domain": "company.com",
  "status": "verified",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "verifiedAt": "2025-01-01T01:00:00.000Z",
  "expiresAt": "2025-01-08T00:00:00.000Z"
}
```

### POST `/admin/domains/{domain}/verify`
Verify domain DNS record.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Response:**
```json
{
  "success": true,
  "domain": "company.com",
  "status": "verified",
  "verifiedAt": "2025-01-01T01:00:00.000Z",
  "message": "Domain verified successfully"
}
```

---

## Analytics Endpoints

### GET `/admin/analytics`
Get usage analytics for tenant.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Query Parameters:**
- `startDate` (optional) - Start date (YYYY-MM-DD), default: 30 days ago
- `endDate` (optional) - End date (YYYY-MM-DD), default: today
- `granularity` (optional) - `day` or `hour`, default: `day`

**Response:**
```json
{
  "success": true,
  "period": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "metrics": {
    "otpRequests": 12500,
    "otpVerifications": 11800,
    "successRate": 94.4,
    "emailsSent": 12500,
    "uniqueCustomers": 850,
    "newCustomers": 120
  },
  "dailyBreakdown": [
    {
      "date": "2025-01-01",
      "otpRequests": 450,
      "otpVerifications": 420,
      "successfulLogins": 415,
      "failedAttempts": 5,
      "emailsSent": 450
    }
  ]
}
```

### GET `/admin/analytics/realtime`
Get real-time metrics.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Response:**
```json
{
  "success": true,
  "currentHour": {
    "otpRequests": 125,
    "otpVerifications": 118,
    "activeCustomers": 45
  },
  "last24Hours": {
    "otpRequests": 2500,
    "otpVerifications": 2350
  },
  "responseTimeMetrics": {
    "request-otp": {
      "avg": 145,
      "p50": 120,
      "p95": 250,
      "p99": 350
    }
  },
  "errorRate": 2.5,
  "lastUpdated": "2025-01-01T12:00:00.000Z"
}
```

### GET `/admin/analytics/errors`
Get error analytics.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Query Parameters:**
- `startDate` (optional)
- `endDate` (optional)
- `category` (optional) - Filter by error category

**Response:**
```json
{
  "success": true,
  "period": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "total": 125,
  "byCategory": {
    "validation": 50,
    "authentication": 30,
    "rate_limit": 25,
    "quota": 10,
    "email_delivery": 5,
    "internal": 5
  },
  "byEndpoint": {
    "/auth/request-otp": 60,
    "/auth/verify-otp": 40,
    "/auth/me": 25
  },
  "recentErrors": [
    {
      "category": "validation",
      "message": "Invalid email format",
      "endpoint": "/auth/request-otp",
      "timestamp": "2025-01-01T12:00:00.000Z"
    }
  ]
}
```

---

## Onboarding Endpoints

### GET `/admin/onboarding`
Get onboarding progress for tenant.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Response:**
```json
{
  "success": true,
  "onboarding": {
    "customerId": "cust_abc123",
    "step": 4,
    "completed": false,
    "steps": {
      "accountCreated": true,
      "emailVerified": true,
      "apiKeyGenerated": true,
      "firstTestCompleted": true,
      "webhookConfigured": false,
      "emailTemplateConfigured": false
    },
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### PUT `/admin/onboarding`
Update onboarding progress.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Request:**
```json
{
  "step": 5,
  "steps": {
    "webhookConfigured": true
  }
}
```

### POST `/admin/onboarding/test-otp`
Test OTP request (for onboarding).

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Request:**
```json
{
  "email": "test@example.com"
}
```

---

## Tenant Status Endpoints

### PUT `/admin/customers/{customerId}/status`
Update tenant status.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for super admin)

**Request:**
```json
{
  "status": "suspended"
}
```

**Response:**
```json
{
  "success": true,
  "customerId": "cust_abc123",
  "oldStatus": "active",
  "newStatus": "suspended",
  "statusChangedAt": "2025-01-01T12:00:00.000Z",
  "message": "Customer status updated to suspended"
}
```

### POST `/admin/customers/{customerId}/suspend`
Suspend tenant.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for super admin)

### POST `/admin/customers/{customerId}/activate`
Activate tenant.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for super admin)

---

## GDPR Endpoints

### GET `/admin/customers/{customerId}/export`
Export customer data (GDPR compliance).

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for customer)

**Response:**
```json
{
  "success": true,
  "data": {
    "customerId": "cust_abc123",
    "email": "alice@example.com",
    "displayName": "CoolPanda42",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastLogin": "2025-01-01T12:00:00.000Z"
  },
  "exportedAt": "2025-01-01T13:00:00.000Z"
}
```

### DELETE `/admin/customers/{customerId}`
Delete customer data (GDPR compliance - right to be forgotten).

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for customer)

**Response:**
```json
{
  "success": true,
  "message": "Customer data deleted successfully"
}
```

---

## Audit Logs Endpoint

### GET `/admin/audit-logs`
Get security audit logs for tenant.

**Headers:**
- `Authorization: Bearer {jwt_token}` (REQUIRED - JWT for tenant admin)

**Query Parameters:**
- `startDate` (optional)
- `endDate` (optional)
- `eventType` (optional) - Filter by event type

**Response:**
```json
{
  "success": true,
  "period": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "total": 500,
  "events": [
    {
      "eventType": "api_key_auth",
      "timestamp": "2025-01-01T12:00:00.000Z",
      "keyId": "key_123",
      "endpoint": "/auth/request-otp",
      "method": "POST",
      "ip": "192.168.1.1"
    }
  ]
}
```

---

## Error Codes

| Status Code | Description |
|------------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing authentication |
| 403 | Forbidden - IP not allowed or insufficient permissions |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit or quota exceeded |
| 500 | Internal Server Error |
| 503 | Service Unavailable - Health check failed |

---

## Rate Limits

- **Per Email**: 3 OTP requests per hour (configurable per tenant)
- **Per Tenant**: Based on plan (see quota endpoints)
- **API Endpoints**: No specific limit (subject to Cloudflare Workers limits)

---

## Webhook Events

All webhook events include:
- `event` - Event type
- `timestamp` - ISO 8601 timestamp
- `customerId` - Customer ID (tenant)
- `data` - Event-specific data

### Event Types

- `otp.requested` - OTP code requested
- `otp.verified` - OTP successfully verified
- `otp.failed` - OTP verification failed
- `customer.created` - New customer account created (person logging in)
- `customer.logged_in` - Customer logged in
- `customer.logged_out` - Customer logged out
- `quota.exceeded` - Tenant quota exceeded
- `rate_limit.exceeded` - Rate limit hit
- `error_rate_high` - Error rate exceeds threshold

### Webhook Signature

Webhooks include `X-OTP-Signature` header with HMAC-SHA256 signature:

```javascript
const signature = request.headers.get('X-OTP-Signature');
const payload = await request.json();
const expectedSignature = await hmac(webhookSecret, JSON.stringify(payload));
const isValid = crypto.timingSafeEqual(signature, expectedSignature);
```

---

## SDK Usage

```typescript
import { OTPAuth } from '@otpauth/sdk';

const client = new OTPAuth({
  apiKey: 'otp_live_sk_...',  // API key for tenant identification
  baseUrl: 'https://your-worker.workers.dev'
});

// Request OTP (uses API key for tenant identification)
await client.requestOTP('alice@example.com');

// Verify OTP (uses API key, returns JWT token)
const auth = await client.verifyOTP('alice@example.com', '123456789');

// Use JWT token for authenticated requests
const customer = await client.getMe(auth.token);  // Returns customer data
```

---

## Data Model

**CRITICAL**: This system uses CUSTOMER entities, not "USER" entities.

- **TENANT**: Organization/company that uses the OTP Auth Service (has API key)
- **CUSTOMER**: Individual person who logs in with OTP (has JWT token)

**Entities:**
- **TENANT** (identified by API key)
  - Has: customerId (tenant ID), plan, configuration, API keys
  - Example: "Acme Corp" tenant

- **CUSTOMER** (authenticated by JWT)
  - Has: customerId, email, displayName, session
  - Example: "Alice" customer logging into Acme Corp's app

---

**Complete API documentation for OTP Auth Service**
