#  OTP Auth Service Productization Guide

> **Making your OTP authentication service truly agnostic and productizable** ‍

This guide outlines everything you need to transform your current OTP auth implementation into a white-label, multi-tenant SaaS product that other developers can use for a fee.

---

## ★ Current State Analysis

### What You Have ✓
- ✓ Working OTP authentication flow (request  verify  JWT)
- ✓ Rate limiting (3 requests/hour per email)
- ✓ Secure OTP generation (9-digit, cryptographically random)
- ✓ JWT token management (30-day expiration)
- ✓ Session management with KV storage
- ✓ Email delivery via Resend
- ✓ Security features (attempt limits, expiration, blacklisting)

### What's Missing for Productization ✗
- ✗ Multi-tenancy (customer isolation)
- ✗ API key management for customers
- ✗ Usage tracking and billing
- ✗ White-label email templates
- ✗ Customer configuration API
- ✗ Webhooks for events
- ✗ Analytics and monitoring dashboard
- ✗ Self-service onboarding
- ✗ Pricing tiers and quotas
- ✗ Customer admin portal
- ✗ Documentation and SDKs

---

## ★ Core Requirements for Productization

### 1. **Multi-Tenancy Architecture** 

**Problem**: Currently all users share the same KV namespace and storage keys.

**Solution**: Implement customer isolation using API keys.

#### 1.1 Customer API Key System

```typescript
// Customer registration endpoint
POST /admin/customers
{
  "name": "Acme Corp",
  "email": "admin@acme.com",
  "plan": "pro", // free, starter, pro, enterprise
  "webhookUrl": "https://acme.com/webhooks/auth",
  "allowedOrigins": ["https://acme.com", "https://app.acme.com"]
}

// Response includes API key
{
  "customerId": "cust_abc123",
  "apiKey": "otp_live_sk_abc123...",
  "apiSecret": "otp_live_secret_xyz789...", // Only shown once
  "createdAt": "2025-01-01T00:00:00Z"
}
```

#### 1.2 Request Authentication

All OTP auth requests must include customer API key:

```typescript
// Request header
Authorization: Bearer otp_live_sk_abc123...

// Or API key header
X-OTP-API-Key: otp_live_sk_abc123...
```

#### 1.3 KV Namespace Isolation

Use customer-specific prefixes for all KV operations:

```javascript
// Instead of: otp_{emailHash}
// Use: cust_{customerId}_otp_{emailHash}

// Instead of: user_{emailHash}
// Use: cust_{customerId}_user_{emailHash}

// Instead of: session_{userId}
// Use: cust_{customerId}_session_{userId}
```

#### 1.4 Customer Metadata Storage

Store customer configuration in KV:

```javascript
customer_{customerId} = {
  customerId: "cust_abc123",
  name: "Acme Corp",
  email: "admin@acme.com",
  plan: "pro",
  apiKeyHash: "hashed_api_key",
  webhookUrl: "https://acme.com/webhooks/auth",
  allowedOrigins: ["https://acme.com"],
  emailConfig: {
    fromEmail: "noreply@acme.com", // Customer's verified domain
    fromName: "Acme Corp",
    subjectTemplate: "Your Acme Verification Code",
    htmlTemplate: "<custom HTML>",
    textTemplate: "<custom text>"
  },
  rateLimits: {
    otpRequestsPerHour: 10, // Based on plan
    otpRequestsPerDay: 100,
    maxUsers: 10000
  },
  features: {
    customEmailTemplates: true,
    webhooks: true,
    analytics: true,
    sso: false
  },
  createdAt: "2025-01-01T00:00:00Z",
  status: "active" // active, suspended, cancelled
}
```

---

### 2. **Usage Tracking & Billing** 

#### 2.1 Usage Metrics

Track per-customer usage in real-time:

```javascript
usage_{customerId}_{date} = {
  customerId: "cust_abc123",
  date: "2025-01-01",
  otpRequests: 1250,
  otpVerifications: 1180,
  successfulLogins: 1150,
  failedAttempts: 30,
  emailsSent: 1250,
  apiCalls: 2500,
  storageUsed: 1024000, // bytes
  lastUpdated: "2025-01-01T23:59:59Z"
}
```

#### 2.2 Quota Enforcement

Check quotas before processing requests:

```javascript
async function checkQuota(customerId, env) {
  const customer = await getCustomer(customerId, env);
  const usage = await getUsage(customerId, new Date(), env);
  const plan = getPlanConfig(customer.plan);
  
  // Check daily quota
  if (usage.otpRequests >= plan.quota.otpRequestsPerDay) {
    return { allowed: false, reason: 'daily_quota_exceeded' };
  }
  
  // Check monthly quota
  const monthlyUsage = await getMonthlyUsage(customerId, env);
  if (monthlyUsage.otpRequests >= plan.quota.otpRequestsPerMonth) {
    return { allowed: false, reason: 'monthly_quota_exceeded' };
  }
  
  return { allowed: true };
}
```

#### 2.3 Billing Integration

Integrate with billing providers (Stripe, Paddle, etc.):

```javascript
// Webhook handler for billing events
async function handleBillingWebhook(event, env) {
  if (event.type === 'subscription.updated') {
    const customer = await getCustomerByBillingId(event.customerId, env);
    await updateCustomerPlan(customer.customerId, event.plan, env);
  }
  
  if (event.type === 'payment.failed') {
    await suspendCustomer(customer.customerId, env);
  }
}
```

---

### 3. **White-Label Email Templates** ★ #### 3.1 Customizable Email Templates

Allow customers to customize email appearance:

```javascript
// Customer email config
emailConfig = {
  fromEmail: "noreply@customerdomain.com", // Must be verified
  fromName: "Customer Name",
  subjectTemplate: "Your {{appName}} Verification Code",
  htmlTemplate: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .otp-code { 
          font-size: 32px; 
          font-weight: bold; 
          color: {{brandColor}};
        }
      </style>
    </head>
    <body>
      <h1>Welcome to {{appName}}</h1>
      <p>Your verification code is:</p>
      <div class="otp-code">{{otp}}</div>
      <p>This code expires in {{expiresIn}} minutes.</p>
      <p>{{footerText}}</p>
    </body>
    </html>
  `,
  textTemplate: "Your {{appName}} verification code is {{otp}}. Expires in {{expiresIn}} minutes.",
  variables: {
    appName: "Customer App",
    brandColor: "#007bff",
    footerText: "© 2025 Customer Inc."
  }
}
```

#### 3.2 Template Variables

Support dynamic variables in templates:

- `{{otp}}` - The OTP code
- `{{expiresIn}}` - Expiration time in minutes
- `{{appName}}` - Customer's app name
- `{{userEmail}}` - User's email address
- `{{supportUrl}}` - Customer support URL
- `{{logoUrl}}` - Customer logo URL

#### 3.3 Email Provider Abstraction

Support multiple email providers (Resend, SendGrid, AWS SES, etc.):

```javascript
// Email provider interface
interface EmailProvider {
  sendEmail(config: EmailConfig): Promise<EmailResult>;
  verifyDomain(domain: string): Promise<VerificationResult>;
}

// Provider factory
async function getEmailProvider(customerId, env) {
  const customer = await getCustomer(customerId, env);
  
  // Customer can use their own provider
  if (customer.emailProvider === 'custom') {
    return new CustomEmailProvider(customer.emailConfig);
  }
  
  // Or use your default provider
  return new ResendProvider(env.RESEND_API_KEY);
}
```

---

### 4. **Customer Configuration API** [SETTINGS]

#### 4.1 Configuration Endpoints

```typescript
// Get customer config
GET /admin/config
Headers: Authorization: Bearer {customer_api_key}

// Update email templates
PUT /admin/config/email
{
  "fromEmail": "noreply@customer.com",
  "fromName": "Customer Name",
  "subjectTemplate": "Your Code: {{otp}}",
  "htmlTemplate": "<custom HTML>"
}

// Update rate limits (if plan allows)
PUT /admin/config/rate-limits
{
  "otpRequestsPerHour": 20,
  "otpRequestsPerDay": 500
}

// Update webhook settings
PUT /admin/config/webhooks
{
  "url": "https://customer.com/webhooks/auth",
  "secret": "webhook_secret",
  "events": ["otp.sent", "otp.verified", "user.created"]
}
```

#### 4.2 Domain Verification

Allow customers to use their own email domains:

```typescript
// Request domain verification
POST /admin/domains/verify
{
  "domain": "customer.com"
}

// Response includes DNS records to add
{
  "domain": "customer.com",
  "status": "pending",
  "dnsRecords": [
    {
      "type": "TXT",
      "name": "_resend",
      "value": "verification_token"
    }
  ]
}

// Check verification status
GET /admin/domains/{domain}/status
{
  "domain": "customer.com",
  "status": "verified",
  "verifiedAt": "2025-01-01T00:00:00Z"
}
```

---

### 5. **Webhooks System** ★ #### 5.1 Webhook Events

Send events to customer webhooks:

```typescript
// Event types
type WebhookEvent = 
  | 'otp.requested'
  | 'otp.verified'
  | 'otp.failed'
  | 'user.created'
  | 'user.logged_in'
  | 'user.logged_out'
  | 'quota.exceeded'
  | 'rate_limit.exceeded';

// Webhook payload
{
  "event": "otp.verified",
  "timestamp": "2025-01-01T00:00:00Z",
  "customerId": "cust_abc123",
  "data": {
    "userId": "user_xyz789",
    "email": "user@example.com",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

#### 5.2 Webhook Delivery

```javascript
async function sendWebhook(customerId, event, data, env) {
  const customer = await getCustomer(customerId, env);
  
  if (!customer.webhookUrl) return;
  
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    customerId,
    data
  };
  
  const signature = await signWebhook(payload, customer.webhookSecret);
  
  try {
    const response = await fetch(customer.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OTP-Signature': signature,
        'X-OTP-Event': event
      },
      body: JSON.stringify(payload)
    });
    
    // Retry logic for failed webhooks
    if (!response.ok) {
      await queueWebhookRetry(customerId, event, data, env);
    }
  } catch (error) {
    await queueWebhookRetry(customerId, event, data, env);
  }
}
```

---

### 6. **Analytics & Monitoring** ★ #### 6.1 Analytics Endpoints

```typescript
// Get usage analytics
GET /admin/analytics
Query params: ?startDate=2025-01-01&endDate=2025-01-31&granularity=day

Response:
{
  "period": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-01-31T23:59:59Z"
  },
  "metrics": {
    "otpRequests": 12500,
    "otpVerifications": 11800,
    "successRate": 94.4,
    "averageResponseTime": 145, // ms
    "emailsSent": 12500,
    "emailDeliveryRate": 99.8,
    "uniqueUsers": 3500,
    "newUsers": 250
  },
  "dailyBreakdown": [
    {
      "date": "2025-01-01",
      "otpRequests": 450,
      "otpVerifications": 420,
      "successRate": 93.3
    }
  ]
}

// Get real-time metrics
GET /admin/analytics/realtime
{
  "currentHour": {
    "otpRequests": 125,
    "otpVerifications": 118,
    "activeUsers": 45
  },
  "last24Hours": {
    "otpRequests": 2500,
    "otpVerifications": 2350
  }
}
```

#### 6.2 Monitoring Dashboard

Create a customer-facing dashboard showing:
- Real-time usage metrics
- Success rates
- Response times
- Error rates
- Quota usage
- Billing information

---

### 7. **Self-Service Onboarding** ★ #### 7.1 Signup Flow

```typescript
// Public signup endpoint
POST /signup
{
  "email": "admin@customer.com",
  "companyName": "Acme Corp",
  "password": "secure_password"
}

// Email verification
POST /signup/verify
{
  "token": "verification_token",
  "email": "admin@customer.com"
}

// Create API key
POST /signup/api-key
Headers: Authorization: Bearer {signup_token}
{
  "name": "Production API Key"
}
```

#### 7.2 Onboarding Wizard

Guide new customers through:
1. Account creation
2. Email domain verification
3. API key generation
4. First integration test
5. Webhook configuration
6. Custom email template setup

---

### 8. **Pricing Tiers & Plans** 

#### 8.1 Plan Structure

```typescript
const PLANS = {
  free: {
    name: "Free",
    price: 0,
    quota: {
      otpRequestsPerMonth: 1000,
      otpRequestsPerDay: 50,
      maxUsers: 100,
      webhooks: false,
      customEmailTemplates: false,
      analytics: false
    },
    features: {
      emailSupport: false,
      ssl: true,
      rateLimiting: true
    }
  },
  starter: {
    name: "Starter",
    price: 29, // per month
    quota: {
      otpRequestsPerMonth: 10000,
      otpRequestsPerDay: 500,
      maxUsers: 1000,
      webhooks: true,
      customEmailTemplates: true,
      analytics: true
    },
    features: {
      emailSupport: true,
      ssl: true,
      rateLimiting: true,
      customDomain: true
    }
  },
  pro: {
    name: "Pro",
    price: 99,
    quota: {
      otpRequestsPerMonth: 100000,
      otpRequestsPerDay: 5000,
      maxUsers: 10000,
      webhooks: true,
      customEmailTemplates: true,
      analytics: true,
      sso: true
    },
    features: {
      prioritySupport: true,
      ssl: true,
      rateLimiting: true,
      customDomain: true,
      sla: "99.9%"
    }
  },
  enterprise: {
    name: "Enterprise",
    price: "custom",
    quota: {
      otpRequestsPerMonth: "unlimited",
      otpRequestsPerDay: "unlimited",
      maxUsers: "unlimited",
      webhooks: true,
      customEmailTemplates: true,
      analytics: true,
      sso: true
    },
    features: {
      dedicatedSupport: true,
      ssl: true,
      rateLimiting: true,
      customDomain: true,
      sla: "99.99%",
      customIntegration: true,
      onPremise: true
    }
  }
};
```

#### 8.2 Usage-Based Billing

For high-volume customers, offer usage-based pricing:

```typescript
const USAGE_PRICING = {
  basePrice: 99, // Pro plan base
  perOTPRequest: 0.001, // $0.001 per OTP request
  perOTPVerification: 0.0005, // $0.0005 per verification
  includedRequests: 100000 // Included in base price
};

// Calculate bill
function calculateBill(usage, plan) {
  const base = plan.price;
  const overage = Math.max(0, usage.otpRequests - plan.quota.otpRequestsPerMonth);
  const overageCost = overage * USAGE_PRICING.perOTPRequest;
  return base + overageCost;
}
```

---

### 9. **Security & Compliance** ★ #### 9.1 API Key Security

```javascript
// Store hashed API keys
async function createApiKey(customerId, env) {
  const apiKey = generateSecureKey(); // 32+ character random string
  const apiKeyHash = await hashApiKey(apiKey);
  
  await env.CUSTOMER_KV.put(
    `apikey_${apiKeyHash}`,
    JSON.stringify({
      customerId,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      status: 'active'
    })
  );
  
  return apiKey; // Only return once, never store plaintext
}

// Verify API key
async function verifyApiKey(apiKey, env) {
  const apiKeyHash = await hashApiKey(apiKey);
  const keyData = await env.CUSTOMER_KV.get(`apikey_${apiKeyHash}`, { type: 'json' });
  
  if (!keyData || keyData.status !== 'active') {
    return null;
  }
  
  // Update last used
  keyData.lastUsed = new Date().toISOString();
  await env.CUSTOMER_KV.put(`apikey_${apiKeyHash}`, JSON.stringify(keyData));
  
  return keyData.customerId;
}
```

#### 9.2 Rate Limiting Per Customer

```javascript
async function checkCustomerRateLimit(customerId, env) {
  const customer = await getCustomer(customerId, env);
  const plan = getPlanConfig(customer.plan);
  
  // Check per-hour limit
  const hourKey = `ratelimit_${customerId}_${Math.floor(Date.now() / 3600000)}`;
  const hourCount = await env.CUSTOMER_KV.get(hourKey) || 0;
  
  if (hourCount >= plan.quota.otpRequestsPerHour) {
    return { allowed: false, resetAt: getNextHour() };
  }
  
  // Increment counter
  await env.CUSTOMER_KV.put(hourKey, (hourCount + 1).toString(), { expirationTtl: 3600 });
  
  return { allowed: true, remaining: plan.quota.otpRequestsPerHour - hourCount - 1 };
}
```

#### 9.3 CORS Configuration Per Customer

```javascript
async function checkCORS(customerId, origin, env) {
  const customer = await getCustomer(customerId, env);
  
  if (!customer.allowedOrigins || customer.allowedOrigins.length === 0) {
    return true; // Allow all if not configured
  }
  
  return customer.allowedOrigins.some(allowed => {
    if (allowed === '*') return true;
    if (allowed.endsWith('*')) {
      return origin.startsWith(allowed.slice(0, -1));
    }
    return origin === allowed;
  });
}
```

#### 9.4 Data Isolation

Ensure complete data isolation between customers:

```javascript
// All KV operations must include customer ID
function getCustomerKey(customerId, key) {
  return `cust_${customerId}_${key}`;
}

// Never allow cross-customer data access
async function getUser(customerId, emailHash, env) {
  const userKey = getCustomerKey(customerId, `user_${emailHash}`);
  return await env.CUSTOMER_KV.get(userKey, { type: 'json' });
}
```

---

### 10. **Documentation & SDKs** ★ #### 10.1 API Documentation

Create comprehensive API docs with:
- Authentication guide
- Endpoint reference
- Request/response examples
- Error codes
- Rate limits
- Webhooks documentation
- Integration guides

#### 10.2 SDK Development

Provide SDKs for popular languages:

```typescript
// TypeScript/JavaScript SDK
import { OTPAuth } from '@otpauth/sdk';

const client = new OTPAuth({
  apiKey: 'otp_live_sk_...',
  baseUrl: 'https://api.otpauth.com'
});

// Request OTP
const result = await client.requestOTP({
  email: 'user@example.com'
});

// Verify OTP
const token = await client.verifyOTP({
  email: 'user@example.com',
  otp: '123456'
});
```

#### 10.3 Code Examples

Provide ready-to-use code examples:
- React integration
- Vue integration
- Svelte integration
- Node.js backend
- Python backend
- Mobile apps (React Native, Flutter)

---

### 11. **Infrastructure Requirements** 

#### 11.1 Separate Worker Deployment

Create a dedicated worker for OTP auth service:

```toml
# serverless/otp-auth-service/wrangler.toml
name = "otp-auth-service"
main = "worker.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "CUSTOMER_KV"
id = "customer-kv-namespace-id"

[[kv_namespaces]]
binding = "USAGE_KV"
id = "usage-kv-namespace-id"

[vars]
ENVIRONMENT = "production"
```

#### 11.2 Database Considerations

For high-scale, consider D1 (SQL) or Durable Objects:

```sql
-- Customer table
CREATE TABLE customers (
  customer_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  plan TEXT NOT NULL,
  api_key_hash TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage tracking
CREATE TABLE usage (
  customer_id TEXT NOT NULL,
  date DATE NOT NULL,
  otp_requests INTEGER DEFAULT 0,
  otp_verifications INTEGER DEFAULT 0,
  PRIMARY KEY (customer_id, date)
);
```

#### 11.3 Monitoring & Logging

```javascript
// Structured logging
async function logEvent(customerId, event, data, env) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    customerId,
    event,
    data,
    workerId: env.WORKER_ID
  };
  
  // Send to logging service (e.g., Axiom, Datadog)
  await fetch(env.LOGGING_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logEntry)
  });
}
```

---

### 12. **Migration Strategy** ★ #### 12.1 Extract OTP Auth to Separate Service

1. Create new `serverless/otp-auth-service/` directory
2. Copy OTP-related functions from main worker
3. Add multi-tenancy layer
4. Deploy as separate worker
5. Update main worker to proxy to new service (or deprecate)

#### 12.2 Backward Compatibility

Maintain backward compatibility during migration:

```javascript
// In main worker
async function handleRequestOTP(request, env) {
  // Check if using new service
  if (request.headers.get('X-OTP-API-Key')) {
    return await proxyToOTPService(request, env);
  }
  
  // Legacy: use old implementation
  return await handleRequestOTPLegacy(request, env);
}
```

---

## ★ Implementation Checklist

### Phase 1: Foundation (Week 1-2)
- [ ] Extract OTP auth to separate worker
- [ ] Implement customer API key system
- [ ] Add customer KV namespace isolation
- [ ] Create customer registration endpoint
- [ ] Add API key authentication middleware

### Phase 2: Multi-Tenancy (Week 3-4)
- [ ] Implement customer configuration storage
- [ ] Add per-customer rate limiting
- [ ] Implement CORS per customer
- [ ] Add customer status management (active/suspended)
- [ ] Create customer admin endpoints

### Phase 3: White-Labeling (Week 5-6)
- [ ] Implement custom email templates
- [ ] Add email template variables
- [ ] Create domain verification system
- [ ] Add email provider abstraction
- [ ] Build template editor UI

### Phase 4: Usage & Billing (Week 7-8)
- [ ] Implement usage tracking
- [ ] Add quota enforcement
- [ ] Create analytics endpoints
- [ ] Integrate billing provider (Stripe/Paddle)
- [ ] Build usage dashboard

### Phase 5: Webhooks & Events (Week 9-10)
- [ ] Implement webhook system
- [ ] Add webhook signature verification
- [ ] Create webhook retry queue
- [ ] Add webhook event types
- [ ] Build webhook testing tool

### Phase 6: Documentation & SDKs (Week 11-12)
- [ ] Write API documentation
- [ ] Create TypeScript/JavaScript SDK
- [ ] Add code examples
- [ ] Build integration guides
- [ ] Create video tutorials

### Phase 7: Self-Service (Week 13-14)
- [ ] Build signup flow
- [ ] Create onboarding wizard
- [ ] Add email verification
- [ ] Build customer dashboard
- [ ] Add plan management UI

### Phase 8: Launch Prep (Week 15-16)
- [ ] Security audit
- [ ] Load testing
- [ ] Performance optimization
- [ ] SLA definition
- [ ] Support system setup

---

##  Pricing Recommendations

### Suggested Pricing Tiers

1. **Free Tier**
   - 1,000 OTP requests/month
   - Basic email templates
   - Community support
   - Perfect for testing/small projects

2. **Starter - $29/month**
   - 10,000 OTP requests/month
   - Custom email templates
   - Webhooks
   - Email support
   - Good for small apps

3. **Pro - $99/month**
   - 100,000 OTP requests/month
   - All Starter features
   - Analytics dashboard
   - Priority support
   - SSO support
   - Good for growing apps

4. **Enterprise - Custom**
   - Unlimited requests
   - Dedicated support
   - Custom SLA
   - On-premise option
   - Custom integrations
   - For large organizations

### Usage-Based Add-Ons

- Additional OTP requests: $0.001 per request
- Additional email sends: $0.0005 per email
- Custom domain: $10/month
- Priority support: $50/month

---

## ★ Next Steps

1. **Start with Phase 1**: Extract and isolate the service
2. **Build MVP**: Get basic multi-tenancy working
3. **Test with beta customers**: Get real feedback
4. **Iterate**: Add features based on demand
5. **Launch**: Open to public with marketing

---

##  Support & Resources

- **API Status Page**: Monitor service health
- **Status Page**: https://status.otpauth.com
- **Support Email**: support@otpauth.com
- **Documentation**: https://docs.otpauth.com
- **Discord Community**: https://discord.gg/otpauth

---

**Good luck, ye brave soul!** ‍ May yer OTP service bring ye many customers and much gold! [FEATURE]
