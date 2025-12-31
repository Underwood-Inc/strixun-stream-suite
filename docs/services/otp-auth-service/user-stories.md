# ★ OTP Auth Service - User Stories & Work Items

> **Detailed user stories for productizing the OTP authentication service** ‍

This document contains all user stories organized by epic/phase for implementing a multi-tenant, white-label OTP authentication service.

---

##  Epic 1: Foundation & Multi-Tenancy

### Story 1.1: Extract OTP Auth to Separate Worker
**As a** developer  
**I want** the OTP authentication service to be in a separate Cloudflare Worker  
**So that** it can be independently deployed, scaled, and maintained

**Acceptance Criteria:**
- [ ] Create new `serverless/otp-auth-service/` directory structure
- [ ] Copy all OTP-related functions from main worker (`handleRequestOTP`, `handleVerifyOTP`, `handleGetMe`, `handleLogout`, `handleRefresh`)
- [ ] Copy all helper functions (`generateOTP`, `hashEmail`, `createJWT`, `verifyJWT`, `checkOTPRateLimit`, `sendOTPEmail`)
- [ ] Create new `wrangler.toml` with dedicated KV namespaces
- [ ] Deploy worker to `otp-auth-service` worker name
- [ ] Verify all endpoints work independently
- [ ] Update main worker to optionally proxy to new service (backward compatibility)

**Technical Notes:**
- Keep main worker functional during migration
- Use feature flag to switch between old/new implementation
- New worker should have its own KV namespace: `OTP_AUTH_KV`

**Dependencies:** None  
**Priority:** P0 (Critical)  
**Estimated Effort:** 2 days

---

### Story 1.2: Implement Customer API Key System
**As a** service administrator  
**I want** to generate unique API keys for each customer  
**So that** customers can authenticate their requests to the OTP service

**Acceptance Criteria:**
- [ ] Create `POST /admin/customers` endpoint to register new customers
- [ ] Generate cryptographically secure API keys (32+ characters, base64)
- [ ] Hash API keys using SHA-256 before storage
- [ ] Store API key hash in KV: `apikey_{hash} = { customerId, createdAt, lastUsed, status }`
- [ ] Return API key only once during creation (never again)
- [ ] Create `GET /admin/customers/{customerId}/api-keys` to list keys
- [ ] Create `POST /admin/customers/{customerId}/api-keys` to generate new keys
- [ ] Create `DELETE /admin/customers/{customerId}/api-keys/{keyId}` to revoke keys
- [ ] API keys must be prefixed: `otp_live_sk_` for production, `otp_test_sk_` for test

**Technical Notes:**
- Use `crypto.subtle.digest('SHA-256')` for hashing
- Store only hash, never plaintext
- API keys should be URL-safe base64
- Support key rotation (multiple active keys per customer)

**Dependencies:** Story 1.1  
**Priority:** P0 (Critical)  
**Estimated Effort:** 3 days

---

### Story 1.3: Add API Key Authentication Middleware
**As a** customer  
**I want** to authenticate requests using my API key  
**So that** the service knows which customer I am and applies my configuration

**Acceptance Criteria:**
- [ ] Create `authenticateRequest(request, env)` middleware function
- [ ] Extract API key from `Authorization: Bearer {key}` header
- [ ] Extract API key from `X-OTP-API-Key` header (alternative)
- [ ] Hash provided API key and lookup in KV
- [ ] Verify key exists, is active, and belongs to active customer
- [ ] Update `lastUsed` timestamp on successful authentication
- [ ] Return 401 if API key is invalid, expired, or customer is suspended
- [ ] Attach `customerId` to request context for downstream handlers
- [ ] Apply to all OTP endpoints: `/auth/request-otp`, `/auth/verify-otp`, `/auth/me`, `/auth/logout`, `/auth/refresh`

**Technical Notes:**
- Cache customer data in memory for performance (5-minute TTL)
- Log failed authentication attempts
- Support both header formats for flexibility

**Dependencies:** Story 1.2  
**Priority:** P0 (Critical)  
**Estimated Effort:** 2 days

---

### Story 1.4: Implement Customer KV Namespace Isolation
**As a** customer  
**I want** my data to be completely isolated from other customers  
**So that** there's no risk of data leakage or cross-customer access

**Acceptance Criteria:**
- [ ] Create `getCustomerKey(customerId, key)` helper function
- [ ] Prefix all OTP keys: `cust_{customerId}_otp_{emailHash}_{timestamp}`
- [ ] Prefix all user keys: `cust_{customerId}_user_{emailHash}`
- [ ] Prefix all session keys: `cust_{customerId}_session_{userId}`
- [ ] Prefix all rate limit keys: `cust_{customerId}_ratelimit_{emailHash}`
- [ ] Prefix all blacklist keys: `cust_{customerId}_blacklist_{tokenHash}`
- [ ] Update all KV operations to use customer-prefixed keys
- [ ] Verify no cross-customer data access is possible
- [ ] Add unit tests to verify isolation

**Technical Notes:**
- Customer ID must be validated before use in keys
- Never allow customer ID from user input without validation
- Use customer ID from authenticated request context only

**Dependencies:** Story 1.3  
**Priority:** P0 (Critical)  
**Estimated Effort:** 2 days

---

### Story 1.5: Create Customer Registration Endpoint
**As a** new customer  
**I want** to register for the OTP auth service  
**So that** I can get an API key and start using the service

**Acceptance Criteria:**
- [ ] Create `POST /admin/customers` endpoint (public, no auth required)
- [ ] Accept: `{ name, email, companyName, plan }`
- [ ] Validate email format and company name
- [ ] Generate customer ID: `cust_{random12chars}`
- [ ] Create customer record in KV: `customer_{customerId}`
- [ ] Generate initial API key (via Story 1.2)
- [ ] Send welcome email with API key
- [ ] Return customer ID and API key in response
- [ ] Set customer status to `pending_verification`
- [ ] Create `POST /admin/customers/{customerId}/verify` for email verification
- [ ] Update status to `active` after verification

**Technical Notes:**
- Use secure random for customer ID generation
- Store customer email for notifications
- Plan defaults to `free` if not specified
- API key should be returned only in initial response

**Dependencies:** Story 1.2, Story 1.4  
**Priority:** P1 (High)  
**Estimated Effort:** 2 days

---

## ★ Epic 2: Customer Configuration & Management

### Story 2.1: Implement Customer Configuration Storage
**As a** customer  
**I want** to store my service configuration  
**So that** the OTP service uses my settings (email templates, rate limits, webhooks)

**Acceptance Criteria:**
- [ ] Extend customer record to include configuration object
- [ ] Store in KV: `customer_{customerId}` with full config
- [ ] Configuration includes:
  - `emailConfig`: fromEmail, fromName, subjectTemplate, htmlTemplate, textTemplate
  - `rateLimits`: otpRequestsPerHour, otpRequestsPerDay, maxUsers
  - `webhookConfig`: url, secret, events
  - `allowedOrigins`: array of CORS origins
  - `features`: object with feature flags
- [ ] Create `GET /admin/config` endpoint (requires API key)
- [ ] Create `PUT /admin/config` endpoint to update configuration
- [ ] Validate configuration on update (email format, URL format, etc.)
- [ ] Return 400 for invalid configuration

**Technical Notes:**
- Configuration should be versioned (add `configVersion` field)
- Validate email templates contain required variables (`{{otp}}`, `{{expiresIn}}`)
- Rate limits should respect plan limits (enforced in separate story)

**Dependencies:** Story 1.4  
**Priority:** P1 (High)  
**Estimated Effort:** 3 days

---

### Story 2.2: Add Per-Customer Rate Limiting
**As a** customer  
**I want** rate limits applied per my configuration  
**So that** I can control usage and costs

**Acceptance Criteria:**
- [ ] Modify `checkOTPRateLimit` to accept `customerId` parameter
- [ ] Load customer configuration to get rate limits
- [ ] Check per-hour limit: `ratelimit_{customerId}_{emailHash}_{hour}`
- [ ] Check per-day limit: `ratelimit_{customerId}_{emailHash}_{day}`
- [ ] Return 429 with `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
- [ ] Respect plan-level rate limits (cannot exceed plan quota)
- [ ] Log rate limit violations for analytics
- [ ] Support different limits per customer (based on plan)

**Technical Notes:**
- Use hour/day buckets for rate limit keys
- TTL on rate limit keys should match the limit period
- Check customer plan limits before applying custom limits

**Dependencies:** Story 2.1  
**Priority:** P1 (High)  
**Estimated Effort:** 2 days

---

### Story 2.3: Implement CORS Configuration Per Customer
**As a** customer  
**I want** to configure which origins can access the OTP API  
**So that** I can restrict access to my domains only

**Acceptance Criteria:**
- [ ] Load customer `allowedOrigins` from configuration
- [ ] Create `checkCORS(customerId, origin, env)` function
- [ ] Support exact match: `https://app.customer.com`
- [ ] Support wildcard subdomain: `https://*.customer.com`
- [ ] Support wildcard all: `*` (for development)
- [ ] Apply CORS check in request handler
- [ ] Return 403 if origin not allowed
- [ ] Set `Access-Control-Allow-Origin` header to matched origin (not `*`)
- [ ] Default to `*` if `allowedOrigins` is empty (backward compatible)

**Technical Notes:**
- CORS check should happen after API key authentication
- Cache CORS config in memory for performance
- Log CORS violations for security monitoring

**Dependencies:** Story 2.1  
**Priority:** P1 (High)  
**Estimated Effort:** 1 day

---

### Story 2.4: Add Customer Status Management
**As a** service administrator  
**I want** to manage customer account status  
**So that** I can suspend accounts for non-payment or abuse

**Acceptance Criteria:**
- [ ] Add `status` field to customer record: `active`, `suspended`, `cancelled`, `pending_verification`
- [ ] Check customer status in authentication middleware
- [ ] Return 403 for suspended/cancelled customers
- [ ] Create `PUT /admin/customers/{customerId}/status` endpoint (admin only)
- [ ] Create `POST /admin/customers/{customerId}/suspend` endpoint
- [ ] Create `POST /admin/customers/{customerId}/activate` endpoint
- [ ] Send notification email on status change
- [ ] Log all status changes for audit trail
- [ ] Prevent API key authentication for non-active customers

**Technical Notes:**
- Status changes should be atomic (use KV transactions if available)
- Add `statusChangedAt` and `statusChangedBy` fields
- Suspended customers should see clear error message

**Dependencies:** Story 1.4  
**Priority:** P1 (High)  
**Estimated Effort:** 2 days

---

### Story 2.5: Create Customer Admin Endpoints
**As a** customer  
**I want** to manage my account settings via API  
**So that** I can programmatically configure the service

**Acceptance Criteria:**
- [ ] `GET /admin/customers/me` - Get current customer info (requires API key)
- [ ] `PUT /admin/customers/me` - Update customer name, email
- [ ] `GET /admin/customers/me/usage` - Get usage statistics
- [ ] `GET /admin/customers/me/plan` - Get current plan details
- [ ] `POST /admin/customers/me/upgrade` - Request plan upgrade
- [ ] All endpoints require valid API key authentication
- [ ] Return 404 if customer not found
- [ ] Return 403 if customer is suspended

**Technical Notes:**
- Use `/admin/customers/me` pattern (customer identified by API key)
- Don't expose sensitive data (API key hashes, internal IDs)
- Include rate limiting on admin endpoints

**Dependencies:** Story 1.3, Story 2.1  
**Priority:** P2 (Medium)  
**Estimated Effort:** 2 days

---

## ★ Epic 3: White-Label Email Templates

### Story 3.1: Implement Custom Email Templates
**As a** customer  
**I want** to customize the OTP email template  
**So that** emails match my brand and messaging

**Acceptance Criteria:**
- [ ] Extend customer config with `emailConfig` object
- [ ] Support `htmlTemplate` and `textTemplate` fields
- [ ] Support template variables: `{{otp}}`, `{{expiresIn}}`, `{{appName}}`, `{{userEmail}}`, `{{supportUrl}}`, `{{logoUrl}}`
- [ ] Validate templates contain required `{{otp}}` variable
- [ ] Render templates with actual values before sending
- [ ] Update `sendOTPEmail` function to use customer template
- [ ] Fallback to default template if customer template is invalid
- [ ] Support both HTML and plain text versions

**Technical Notes:**
- Use simple string replacement for variables (no complex templating engine)
- Sanitize HTML templates to prevent XSS
- Cache rendered templates for performance

**Dependencies:** Story 2.1  
**Priority:** P1 (High)  
**Estimated Effort:** 3 days

---

### Story 3.2: Add Email Template Variables System
**As a** customer  
**I want** to use dynamic variables in my email templates  
**So that** I can personalize emails with user and app data

**Acceptance Criteria:**
- [ ] Support variable: `{{otp}}` - The 9-digit OTP code
- [ ] Support variable: `{{expiresIn}}` - Expiration time in minutes
- [ ] Support variable: `{{appName}}` - Customer's app name (from config)
- [ ] Support variable: `{{userEmail}}` - User's email address
- [ ] Support variable: `{{supportUrl}}` - Customer support URL (from config)
- [ ] Support variable: `{{logoUrl}}` - Customer logo URL (from config)
- [ ] Support variable: `{{brandColor}}` - Brand color (from config)
- [ ] Support variable: `{{footerText}}` - Custom footer text (from config)
- [ ] Create `renderEmailTemplate(template, variables)` function
- [ ] Validate all required variables are provided
- [ ] Escape HTML in variables to prevent XSS (except in HTML template)

**Technical Notes:**
- Variables should be case-insensitive
- Support default values for optional variables
- Log template rendering errors

**Dependencies:** Story 3.1  
**Priority:** P1 (High)  
**Estimated Effort:** 2 days

---

### Story 3.3: Create Domain Verification System
**As a** customer  
**I want** to verify my email domain  
**So that** I can send emails from my own domain (e.g., `noreply@mycompany.com`)

**Acceptance Criteria:**
- [ ] Create `POST /admin/domains/verify` endpoint
- [ ] Accept domain name: `{ "domain": "mycompany.com" }`
- [ ] Generate verification token
- [ ] Create DNS TXT record requirement: `_otpauth-verify.{domain} = {token}`
- [ ] Store verification status: `domain_{domain} = { customerId, status, token, verifiedAt }`
- [ ] Create `GET /admin/domains/{domain}/status` to check verification
- [ ] Create `POST /admin/domains/{domain}/verify` to trigger verification check
- [ ] Verify DNS record exists and matches token
- [ ] Update status to `verified` on success
- [ ] Allow customer to use verified domain in `fromEmail` config
- [ ] Return 400 if domain not verified when setting `fromEmail`

**Technical Notes:**
- Use DNS-over-HTTPS or similar to verify DNS records
- Support both root domain and subdomain verification
- Verification should expire after 7 days if not completed

**Dependencies:** Story 2.1  
**Priority:** P2 (Medium)  
**Estimated Effort:** 4 days

---

### Story 3.4: Add Email Provider Abstraction
**As a** customer  
**I want** to use my own email provider  
**So that** I can use existing email infrastructure (SendGrid, AWS SES, etc.)

**Acceptance Criteria:**
- [ ] Create `EmailProvider` interface/contract
- [ ] Implement `ResendProvider` (current implementation)
- [ ] Implement `SendGridProvider`
- [ ] Implement `SESProvider` (AWS SES)
- [ ] Implement `SMTPProvider` (generic SMTP)
- [ ] Add `emailProvider` field to customer config
- [ ] Add provider-specific config (API keys, endpoints) to customer config
- [ ] Create `getEmailProvider(customerId, env)` factory function
- [ ] Support customer using their own provider or default provider
- [ ] Encrypt provider API keys in storage (use Cloudflare Workers Secrets or encryption)

**Technical Notes:**
- Provider config should be encrypted at rest
- Support fallback to default provider if customer provider fails
- Log provider errors for debugging

**Dependencies:** Story 2.1, Story 3.1  
**Priority:** P2 (Medium)  
**Estimated Effort:** 5 days

---

### Story 3.5: Build Email Template Editor UI
**As a** customer  
**I want** a web UI to edit my email templates  
**So that** I can customize emails without writing HTML

**Acceptance Criteria:**
- [ ] Create `/admin/email-templates` page in customer dashboard
- [ ] Show current HTML and text templates
- [ ] Provide WYSIWYG editor for HTML template
- [ ] Show available variables with insert buttons
- [ ] Preview template with sample data
- [ ] Save template via `PUT /admin/config/email` endpoint
- [ ] Validate template before saving
- [ ] Show success/error messages
- [ ] Support template reset to default

**Technical Notes:**
- Use existing Svelte components if available
- Consider using a rich text editor library (TinyMCE, Quill, etc.)
- Template preview should use actual variable examples

**Dependencies:** Story 3.1, Story 3.2  
**Priority:** P3 (Low)  
**Estimated Effort:** 5 days

---

##  Epic 4: Usage Tracking & Billing

### Story 4.1: Implement Usage Tracking
**As a** service administrator  
**I want** to track usage metrics per customer  
**So that** I can bill customers accurately and provide analytics

**Acceptance Criteria:**
- [ ] Create usage record structure:
  ```javascript
  {
    customerId: string,
    date: string (YYYY-MM-DD),
    otpRequests: number,
    otpVerifications: number,
    successfulLogins: number,
    failedAttempts: number,
    emailsSent: number,
    apiCalls: number,
    storageUsed: number (bytes)
  }
  ```
- [ ] Store in KV: `usage_{customerId}_{date}`
- [ ] Increment counters on each operation:
  - `otpRequests` on `POST /auth/request-otp`
  - `otpVerifications` on `POST /auth/verify-otp`
  - `successfulLogins` on successful verification
  - `emailsSent` on email send
- [ ] Update counters atomically (use KV put with JSON merge)
- [ ] Create daily aggregation job (Cloudflare Cron Trigger)
- [ ] Support both real-time and aggregated metrics

**Technical Notes:**
- Use atomic increments where possible
- Batch updates for high-volume customers
- Consider D1 database for better querying (future enhancement)

**Dependencies:** Story 1.4  
**Priority:** P1 (High)  
**Estimated Effort:** 3 days

---

### Story 4.2: Add Quota Enforcement
**As a** service administrator  
**I want** to enforce usage quotas per customer plan  
**So that** customers don't exceed their plan limits

**Acceptance Criteria:**
- [ ] Define plan quotas in configuration:
  ```javascript
  {
    free: { otpRequestsPerMonth: 1000, otpRequestsPerDay: 50 },
    starter: { otpRequestsPerMonth: 10000, otpRequestsPerDay: 500 },
    pro: { otpRequestsPerMonth: 100000, otpRequestsPerDay: 5000 },
    enterprise: { otpRequestsPerMonth: 'unlimited', otpRequestsPerDay: 'unlimited' }
  }
  ```
- [ ] Create `checkQuota(customerId, env)` function
- [ ] Check daily quota before processing OTP request
- [ ] Check monthly quota (aggregate daily usage)
- [ ] Return 429 with quota information if exceeded
- [ ] Include `X-Quota-Limit`, `X-Quota-Remaining`, `X-Quota-Reset` headers
- [ ] Send webhook event `quota.exceeded` when quota hit
- [ ] Support soft limits (warn) and hard limits (block)

**Technical Notes:**
- Cache quota checks for performance (1-minute TTL)
- Calculate monthly usage from daily aggregates
- Enterprise plan should bypass quota checks

**Dependencies:** Story 4.1, Story 2.1  
**Priority:** P1 (High)  
**Estimated Effort:** 2 days

---

### Story 4.3: Create Analytics Endpoints
**As a** customer  
**I want** to view my usage analytics via API  
**So that** I can monitor usage and plan for scaling

**Acceptance Criteria:**
- [ ] Create `GET /admin/analytics` endpoint
- [ ] Query params: `?startDate=2025-01-01&endDate=2025-01-31&granularity=day`
- [ ] Return aggregated metrics for date range:
  - Total OTP requests
  - Total verifications
  - Success rate
  - Average response time
  - Emails sent
  - Email delivery rate
  - Unique users
  - New users
- [ ] Return daily/hourly breakdown if `granularity=day` or `granularity=hour`
- [ ] Support `granularity=month` for monthly aggregates
- [ ] Include period summary (start/end dates)
- [ ] Cache results for 5 minutes

**Technical Notes:**
- Aggregate from daily usage records
- Calculate success rate: `verifications / requests * 100`
- Response time should be tracked separately (add to usage tracking)

**Dependencies:** Story 4.1  
**Priority:** P2 (Medium)  
**Estimated Effort:** 3 days

---

### Story 4.4: Integrate Billing Provider (Stripe)
**As a** service administrator  
**I want** to integrate with Stripe for billing  
**So that** customers can be charged automatically based on usage

**Acceptance Criteria:**
- [ ] Create Stripe customer on customer registration
- [ ] Store Stripe customer ID in customer record: `stripeCustomerId`
- [ ] Create `POST /admin/billing/webhook` endpoint for Stripe webhooks
- [ ] Handle webhook events:
  - `customer.subscription.created` - Link subscription to customer
  - `customer.subscription.updated` - Update plan
  - `customer.subscription.deleted` - Downgrade to free
  - `invoice.payment_succeeded` - Record payment
  - `invoice.payment_failed` - Suspend customer
- [ ] Verify webhook signatures using Stripe secret
- [ ] Update customer plan based on subscription
- [ ] Create usage-based invoices for overages
- [ ] Support both subscription and usage-based billing

**Technical Notes:**
- Use Stripe webhook secret from environment
- Idempotent webhook handling (check if event already processed)
- Store webhook events for audit trail

**Dependencies:** Story 4.1, Story 4.2  
**Priority:** P2 (Medium)  
**Estimated Effort:** 5 days

---

### Story 4.5: Build Usage Dashboard UI
**As a** customer  
**I want** a visual dashboard showing my usage  
**So that** I can easily see my consumption and quotas

**Acceptance Criteria:**
- [ ] Create `/admin/dashboard` page in customer portal
- [ ] Display current month usage vs quota (progress bars)
- [ ] Show daily usage chart (last 30 days)
- [ ] Display key metrics: OTP requests, verifications, success rate
- [ ] Show quota warnings when approaching limits (80%, 90%, 100%)
- [ ] Link to upgrade plan if quota exceeded
- [ ] Show real-time usage (last hour)
- [ ] Export usage data as CSV
- [ ] Responsive design for mobile

**Technical Notes:**
- Use charting library (Chart.js, D3.js, etc.)
- Fetch data from `/admin/analytics` endpoint
- Auto-refresh every 5 minutes

**Dependencies:** Story 4.3  
**Priority:** P3 (Low)  
**Estimated Effort:** 5 days

---

## ★ Epic 5: Webhooks & Events

### Story 5.1: Implement Webhook System
**As a** customer  
**I want** to receive webhook events for OTP operations  
**So that** I can integrate with my own systems

**Acceptance Criteria:**
- [ ] Add `webhookConfig` to customer configuration:
  ```javascript
  {
    url: string,
    secret: string,
    events: string[] // ['otp.requested', 'otp.verified', etc.]
  }
  ```
- [ ] Create webhook event types:
  - `otp.requested` - OTP code requested
  - `otp.verified` - OTP successfully verified
  - `otp.failed` - OTP verification failed
  - `user.created` - New user account created
  - `user.logged_in` - User logged in
  - `user.logged_out` - User logged out
  - `quota.exceeded` - Customer quota exceeded
  - `rate_limit.exceeded` - Rate limit hit
- [ ] Create `sendWebhook(customerId, event, data, env)` function
- [ ] Send POST request to customer webhook URL
- [ ] Include webhook signature in `X-OTP-Signature` header
- [ ] Include event type in `X-OTP-Event` header
- [ ] Retry failed webhooks (3 attempts with exponential backoff)
- [ ] Log webhook deliveries for debugging

**Technical Notes:**
- Use HMAC-SHA256 for webhook signatures
- Signature: `HMAC(webhookSecret, JSON.stringify(payload))`
- Store webhook delivery status in KV for retry logic

**Dependencies:** Story 2.1  
**Priority:** P1 (High)  
**Estimated Effort:** 4 days

---

### Story 5.2: Add Webhook Signature Verification
**As a** customer  
**I want** to verify webhook signatures  
**So that** I can trust webhooks are from the OTP service

**Acceptance Criteria:**
- [ ] Document webhook signature algorithm in API docs
- [ ] Include `X-OTP-Signature` header in all webhooks
- [ ] Signature format: `HMAC-SHA256(webhookSecret, JSON.stringify(payload))`
- [ ] Include `X-OTP-Timestamp` header for replay attack prevention
- [ ] Provide example verification code in documentation:
  ```javascript
  const signature = request.headers.get('X-OTP-Signature');
  const expectedSignature = hmac(webhookSecret, JSON.stringify(payload));
  const isValid = crypto.timingSafeEqual(signature, expectedSignature);
  ```
- [ ] Support signature verification in customer SDKs

**Technical Notes:**
- Use constant-time comparison for signature verification
- Include timestamp to prevent replay attacks (reject if > 5 minutes old)

**Dependencies:** Story 5.1  
**Priority:** P1 (High)  
**Estimated Effort:** 1 day

---

### Story 5.3: Create Webhook Retry Queue
**As a** service administrator  
**I want** failed webhooks to be retried  
**So that** customers don't miss important events

**Acceptance Criteria:**
- [ ] Store failed webhook in retry queue: `webhook_retry_{customerId}_{event}_{timestamp}`
- [ ] Retry schedule: immediate, 1 minute, 5 minutes, 15 minutes, 1 hour
- [ ] Maximum 5 retry attempts
- [ ] Mark as failed after max retries
- [ ] Create Cloudflare Cron Trigger to process retry queue
- [ ] Send notification email to customer if webhook consistently fails
- [ ] Provide webhook delivery status in customer dashboard
- [ ] Support manual retry via API: `POST /admin/webhooks/{deliveryId}/retry`

**Technical Notes:**
- Use exponential backoff for retries
- Store retry count and next retry time in queue entry
- Consider using Durable Objects for reliable queue processing

**Dependencies:** Story 5.1  
**Priority:** P2 (Medium)  
**Estimated Effort:** 3 days

---

### Story 5.4: Add Webhook Event Types
**As a** customer  
**I want** to subscribe to specific webhook events  
**So that** I only receive events I care about

**Acceptance Criteria:**
- [ ] Allow customers to configure `events` array in webhook config
- [ ] Only send webhooks for subscribed events
- [ ] Support `*` wildcard to subscribe to all events
- [ ] Create `PUT /admin/config/webhooks` endpoint to update subscriptions
- [ ] Validate event names (reject invalid event types)
- [ ] Include event type in webhook payload
- [ ] Document all available event types in API docs

**Technical Notes:**
- Default to all events if `events` array is empty
- Event names should be lowercase with dots: `otp.requested`

**Dependencies:** Story 5.1  
**Priority:** P2 (Medium)  
**Estimated Effort:** 1 day

---

### Story 5.5: Build Webhook Testing Tool
**As a** customer  
**I want** to test my webhook endpoint  
**So that** I can verify my integration works

**Acceptance Criteria:**
- [ ] Create `POST /admin/webhooks/test` endpoint
- [ ] Send test webhook to customer's configured URL
- [ ] Use test event type: `webhook.test`
- [ ] Include sample payload data
- [ ] Return delivery status (success/failure)
- [ ] Show webhook payload in customer dashboard
- [ ] Support testing with different event types
- [ ] Provide webhook testing UI in dashboard

**Technical Notes:**
- Test webhooks should not trigger retry logic
- Use distinct test event type to avoid confusion
- Show full request/response for debugging

**Dependencies:** Story 5.1  
**Priority:** P3 (Low)  
**Estimated Effort:** 2 days

---

## ★ Epic 6: Analytics & Monitoring

### Story 6.1: Add Real-Time Metrics Endpoint
**As a** customer  
**I want** to see real-time usage metrics  
**So that** I can monitor current activity

**Acceptance Criteria:**
- [ ] Create `GET /admin/analytics/realtime` endpoint
- [ ] Return current hour metrics:
  - OTP requests in last hour
  - OTP verifications in last hour
  - Active users (unique emails in last hour)
  - Success rate for last hour
- [ ] Return last 24 hours summary
- [ ] Update metrics in real-time (no caching)
- [ ] Include timestamp of last update

**Technical Notes:**
- Calculate from recent usage records
- Use in-memory counters for very recent data (< 1 minute)
- Consider using Durable Objects for real-time aggregation

**Dependencies:** Story 4.1  
**Priority:** P2 (Medium)  
**Estimated Effort:** 2 days

---

### Story 6.2: Implement Response Time Tracking
**As a** service administrator  
**I want** to track API response times  
**So that** I can monitor performance and identify bottlenecks

**Acceptance Criteria:**
- [ ] Add response time tracking to all endpoints
- [ ] Measure time from request start to response send
- [ ] Store response times in usage metrics: `avgResponseTime`, `p50ResponseTime`, `p95ResponseTime`, `p99ResponseTime`
- [ ] Include response time in analytics endpoints
- [ ] Alert if response time exceeds threshold (e.g., 500ms p95)
- [ ] Track response times per endpoint
- [ ] Store in KV: `metrics_{customerId}_{date}_{endpoint}`

**Technical Notes:**
- Use `performance.now()` for high-resolution timing
- Calculate percentiles from sample data (store raw times, calculate on read)
- Consider using Cloudflare Analytics for built-in metrics

**Dependencies:** Story 4.1  
**Priority:** P2 (Medium)  
**Estimated Effort:** 2 days

---

### Story 6.3: Create Error Tracking System
**As a** service administrator  
**I want** to track and monitor errors  
**So that** I can identify and fix issues quickly

**Acceptance Criteria:**
- [ ] Log all errors with context:
  - Error message and stack trace
  - Customer ID
  - Request endpoint and method
  - User email (if available)
  - Timestamp
- [ ] Store errors in KV: `errors_{customerId}_{date}`
- [ ] Categorize errors: `validation`, `authentication`, `rate_limit`, `quota`, `email_delivery`, `internal`
- [ ] Create `GET /admin/analytics/errors` endpoint
- [ ] Return error counts by category
- [ ] Include error rate in analytics: `errors / total_requests * 100`
- [ ] Alert on high error rates (> 5%)
- [ ] Support error filtering by date range and category

**Technical Notes:**
- Don't log sensitive data (API keys, OTP codes)
- Use structured logging format (JSON)
- Consider integrating with external error tracking (Sentry, etc.)

**Dependencies:** Story 4.1  
**Priority:** P2 (Medium)  
**Estimated Effort:** 3 days

---

### Story 6.4: Build Analytics Dashboard UI
**As a** customer  
**I want** a visual analytics dashboard  
**So that** I can understand my usage patterns

**Acceptance Criteria:**
- [ ] Create `/admin/analytics` page in customer portal
- [ ] Display usage charts:
  - Daily OTP requests (line chart, last 30 days)
  - Success rate over time
  - Response time trends
  - Error rate trends
- [ ] Show summary cards: total requests, success rate, avg response time
- [ ] Support date range picker
- [ ] Export data as CSV/JSON
- [ ] Responsive design
- [ ] Real-time updates (auto-refresh)

**Technical Notes:**
- Use charting library (Chart.js recommended)
- Fetch data from `/admin/analytics` endpoint
- Cache data client-side for smooth interactions

**Dependencies:** Story 4.3, Story 6.1  
**Priority:** P3 (Low)  
**Estimated Effort:** 5 days

---

## ★ Epic 7: Self-Service Onboarding

### Story 7.1: Create Public Signup Flow
**As a** new customer  
**I want** to sign up for the service  
**So that** I can start using OTP authentication

**Acceptance Criteria:**
- [ ] Create `POST /signup` endpoint (public, no auth)
- [ ] Accept: `{ email, companyName, password }`
- [ ] Validate email format and company name
- [ ] Hash password using bcrypt or similar
- [ ] Generate verification token
- [ ] Send verification email
- [ ] Store signup record: `signup_{emailHash} = { email, companyName, passwordHash, token, createdAt }`
- [ ] Return signup token (for email verification)
- [ ] Create `POST /signup/verify` endpoint
- [ ] Verify token and activate account
- [ ] Create customer record and API key on verification

**Technical Notes:**
- Use secure password hashing (bcrypt, argon2)
- Verification token should expire after 24 hours
- Rate limit signup requests (5 per hour per IP)

**Dependencies:** Story 1.5  
**Priority:** P1 (High)  
**Estimated Effort:** 3 days

---

### Story 7.2: Build Onboarding Wizard
**As a** new customer  
**I want** a guided onboarding experience  
**So that** I can quickly set up the service

**Acceptance Criteria:**
- [ ] Create onboarding flow with steps:
  1. Account creation (email, company name)
  2. Email verification
  3. API key generation and display
  4. First integration test (test OTP request)
  5. Webhook configuration (optional)
  6. Custom email template setup (optional)
- [ ] Track onboarding progress: `onboarding_{customerId} = { step, completed }`
- [ ] Allow skipping optional steps
- [ ] Show progress indicator
- [ ] Save progress between steps
- [ ] Send welcome email after completion
- [ ] Provide "Skip onboarding" option

**Technical Notes:**
- Use Svelte components for wizard UI
- Store onboarding state in KV
- Auto-advance on step completion

**Dependencies:** Story 7.1  
**Priority:** P2 (Medium)  
**Estimated Effort:** 5 days

---

### Story 7.3: Add Email Verification
**As a** new customer  
**I want** to verify my email address  
**So that** I can activate my account

**Acceptance Criteria:**
- [ ] Send verification email on signup
- [ ] Include verification link: `https://otpauth.com/verify?token={token}`
- [ ] Include verification code in email (9-digit code)
- [ ] Support both link and code verification
- [ ] Create `POST /signup/verify` endpoint
- [ ] Accept token or code
- [ ] Verify token/code matches
- [ ] Activate customer account
- [ ] Generate API key automatically
- [ ] Send welcome email with API key
- [ ] Token expires after 24 hours

**Technical Notes:**
- Use same OTP generation for verification codes
- Store verification tokens in KV with TTL
- Support resending verification email

**Dependencies:** Story 7.1  
**Priority:** P1 (High)  
**Estimated Effort:** 2 days

---

### Story 7.4: Create Customer Dashboard
**As a** customer  
**I want** a web dashboard to manage my account  
**So that** I can configure settings and view usage

**Acceptance Criteria:**
- [ ] Create customer portal at `/dashboard`
- [ ] Require API key authentication (or separate login)
- [ ] Dashboard sections:
  - Overview (usage summary, quota status)
  - API Keys (view, create, revoke)
  - Configuration (email templates, webhooks, rate limits)
  - Analytics (usage charts, metrics)
  - Billing (plan, invoices, payment methods)
  - Settings (company info, notifications)
- [ ] Responsive design
- [ ] Dark mode support
- [ ] Navigation menu

**Technical Notes:**
- Use Svelte for frontend
- Authenticate using API key or JWT token
- Store dashboard preferences in localStorage

**Dependencies:** Story 2.5, Story 4.3  
**Priority:** P2 (Medium)  
**Estimated Effort:** 8 days

---

### Story 7.5: Add Plan Management UI
**As a** customer  
**I want** to view and upgrade my plan  
**So that** I can access more features and higher quotas

**Acceptance Criteria:**
- [ ] Create `/dashboard/plan` page
- [ ] Display current plan and features
- [ ] Show plan comparison table
- [ ] Display usage vs quota (progress bars)
- [ ] "Upgrade" button for higher plans
- [ ] "Downgrade" option (with confirmation)
- [ ] Show pricing for each plan
- [ ] Link to Stripe checkout for upgrades
- [ ] Show billing history
- [ ] Display next billing date

**Technical Notes:**
- Integrate with Stripe for payment processing
- Handle plan changes immediately (pro-rated billing)
- Show upgrade benefits clearly

**Dependencies:** Story 4.4, Story 7.4  
**Priority:** P2 (Medium)  
**Estimated Effort:** 3 days

---

## ★ Epic 8: Documentation & SDKs

### Story 8.1: Write Comprehensive API Documentation
**As a** developer  
**I want** complete API documentation  
**So that** I can integrate the OTP service easily

**Acceptance Criteria:**
- [ ] Document all endpoints with:
  - HTTP method and path
  - Request headers and body
  - Response format and status codes
  - Error codes and messages
  - Rate limits
  - Example requests/responses
- [ ] Create authentication guide
- [ ] Document webhook system
- [ ] Include integration examples
- [ ] Add troubleshooting section
- [ ] Publish to `/docs` or external site
- [ ] Support OpenAPI/Swagger spec
- [ ] Include code examples in multiple languages

**Technical Notes:**
- Use Markdown or dedicated docs tool (GitBook, Docusaurus)
- Generate OpenAPI spec from code comments
- Keep examples up-to-date with API changes

**Dependencies:** All API endpoints  
**Priority:** P1 (High)  
**Estimated Effort:** 5 days

---

### Story 8.2: Create TypeScript/JavaScript SDK
**As a** developer  
**I want** an SDK for TypeScript/JavaScript  
**So that** I can integrate quickly without writing HTTP calls

**Acceptance Criteria:**
- [ ] Create `@otpauth/sdk` npm package
- [ ] Implement `OTPAuth` class:
  ```typescript
  class OTPAuth {
    constructor(config: { apiKey: string, baseUrl?: string })
    requestOTP(email: string): Promise<OTPResponse>
    verifyOTP(email: string, otp: string): Promise<AuthResponse>
    getMe(token: string): Promise<UserResponse>
    logout(token: string): Promise<void>
    refreshToken(token: string): Promise<AuthResponse>
  }
  ```
- [ ] Include TypeScript types
- [ ] Handle errors gracefully
- [ ] Support retries for transient errors
- [ ] Include request/response logging (optional)
- [ ] Publish to npm
- [ ] Write usage documentation

**Technical Notes:**
- Use fetch API (works in Node.js and browsers)
- Support both CommonJS and ES modules
- Include polyfills for older browsers

**Dependencies:** Story 8.1  
**Priority:** P1 (High)  
**Estimated Effort:** 4 days

---

### Story 8.3: Add Code Examples
**As a** developer  
**I want** ready-to-use code examples  
**So that** I can copy-paste and adapt for my app

**Acceptance Criteria:**
- [ ] Create examples for:
  - React (hooks, components)
  - Vue (Composition API)
  - Svelte (stores, components)
  - Next.js (API routes, pages)
  - Node.js (Express, Fastify)
  - Python (Flask, FastAPI)
  - Mobile (React Native, Flutter)
- [ ] Each example should be complete and runnable
- [ ] Include setup instructions
- [ ] Show error handling
- [ ] Demonstrate best practices
- [ ] Host examples in GitHub repository
- [ ] Link from documentation

**Technical Notes:**
- Use CodeSandbox/StackBlitz for interactive examples
- Keep examples simple and focused
- Update examples when API changes

**Dependencies:** Story 8.1, Story 8.2  
**Priority:** P2 (Medium)  
**Estimated Effort:** 5 days

---

### Story 8.4: Create Integration Guides
**As a** developer  
**I want** step-by-step integration guides  
**So that** I can implement OTP auth in my app

**Acceptance Criteria:**
- [ ] Create guides for:
  - Quick start (5-minute setup)
  - React integration
  - Vue integration
  - Backend integration (Node.js, Python)
  - Mobile app integration
  - Custom email templates
  - Webhook setup
- [ ] Each guide should include:
  - Prerequisites
  - Step-by-step instructions
  - Code snippets
  - Testing steps
  - Troubleshooting
- [ ] Include screenshots/videos where helpful
- [ ] Link to relevant API docs

**Technical Notes:**
- Use clear, simple language
- Test all guides with fresh accounts
- Keep guides updated with API changes

**Dependencies:** Story 8.1  
**Priority:** P2 (Medium)  
**Estimated Effort:** 4 days

---

### Story 8.5: Build Video Tutorials
**As a** new customer  
**I want** video tutorials  
**So that** I can learn how to use the service visually

**Acceptance Criteria:**
- [ ] Create video tutorials:
  - Getting started (signup, API key)
  - First integration (5 minutes)
  - Custom email templates
  - Webhook setup
  - Advanced features
- [ ] Keep videos under 10 minutes each
- [ ] Include captions/transcripts
- [ ] Host on YouTube/Vimeo
- [ ] Embed in documentation
- [ ] Update videos when features change

**Technical Notes:**
- Use screen recording software
- Edit for clarity and brevity
- Include timestamps in description

**Dependencies:** Story 8.1  
**Priority:** P3 (Low)  
**Estimated Effort:** 3 days

---

## ★ Epic 9: Security & Compliance

### Story 9.1: Implement API Key Rotation
**As a** customer  
**I want** to rotate my API keys  
**So that** I can maintain security best practices

**Acceptance Criteria:**
- [ ] Create `POST /admin/api-keys/{keyId}/rotate` endpoint
- [ ] Generate new API key
- [ ] Keep old key active for 7 days (grace period)
- [ ] Send notification email with new key
- [ ] Allow multiple active keys during rotation
- [ ] Create `POST /admin/api-keys/{keyId}/revoke` to immediately revoke
- [ ] Log all key rotations for audit

**Technical Notes:**
- Old key should be marked as `rotated` not deleted
- Support rolling back to old key if needed
- Warn customers about key expiration

**Dependencies:** Story 1.2  
**Priority:** P2 (Medium)  
**Estimated Effort:** 2 days

---

### Story 9.2: Add Security Audit Logging
**As a** service administrator  
**I want** to log all security-relevant events  
**So that** I can audit access and detect abuse

**Acceptance Criteria:**
- [ ] Log security events:
  - API key authentication (success/failure)
  - OTP requests and verifications
  - Failed login attempts
  - Rate limit violations
  - Quota exceedances
  - Configuration changes
  - Account status changes
- [ ] Include in logs: timestamp, customer ID, IP address, user agent, event type
- [ ] Store logs in KV: `audit_{customerId}_{date}`
- [ ] Create `GET /admin/audit-logs` endpoint (admin only)
- [ ] Support filtering by date range and event type
- [ ] Retain logs for 90 days
- [ ] Encrypt sensitive data in logs

**Technical Notes:**
- Don't log sensitive data (API keys, OTP codes, passwords)
- Use structured logging (JSON format)
- Consider external logging service (Axiom, Datadog) for scale

**Dependencies:** Story 1.3  
**Priority:** P2 (Medium)  
**Estimated Effort:** 3 days

---

### Story 9.3: Implement IP Allowlisting
**As a** customer  
**I want** to restrict API access to specific IP addresses  
**So that** I can enhance security

**Acceptance Criteria:**
- [ ] Add `allowedIPs` array to customer configuration
- [ ] Support individual IPs: `["1.2.3.4"]`
- [ ] Support CIDR ranges: `["1.2.3.0/24"]`
- [ ] Support wildcard: `["*"]` (allow all, default)
- [ ] Check IP address in authentication middleware
- [ ] Return 403 if IP not allowed
- [ ] Create `PUT /admin/config/ip-whitelist` endpoint
- [ ] Log IP violations for security monitoring

**Technical Notes:**
- Extract IP from `CF-Connecting-IP` header (Cloudflare)
- Support IPv4 and IPv6
- Cache IP checks for performance

**Dependencies:** Story 2.1  
**Priority:** P3 (Low)  
**Estimated Effort:** 2 days

---

### Story 9.4: Add GDPR Compliance Features
**As a** customer  
**I want** GDPR-compliant data handling  
**So that** I can use the service in EU

**Acceptance Criteria:**
- [ ] Create `POST /admin/users/{userId}/export` endpoint (export user data)
- [ ] Create `DELETE /admin/users/{userId}` endpoint (delete user data)
- [ ] Support data export in JSON format
- [ ] Anonymize or delete all user data on deletion
- [ ] Create `GET /admin/privacy-policy` endpoint
- [ ] Create `GET /admin/terms-of-service` endpoint
- [ ] Add consent tracking for data processing
- [ ] Support data retention policies
- [ ] Document data processing activities

**Technical Notes:**
- Deletion should be permanent (not soft delete)
- Export should include all user-related data
- Consider data residency requirements (EU data in EU)

**Dependencies:** Story 1.4  
**Priority:** P2 (Medium)  
**Estimated Effort:** 4 days

---

##  Epic 10: Infrastructure & Performance

### Story 10.1: Optimize KV Operations
**As a** service administrator  
**I want** optimized KV operations  
**So that** the service is fast and cost-effective

**Acceptance Criteria:**
- [ ] Batch KV operations where possible
- [ ] Use KV transactions for atomic updates
- [ ] Implement caching layer for frequently accessed data (customer config)
- [ ] Cache customer data for 5 minutes (in-memory)
- [ ] Use KV metadata for conditional updates
- [ ] Minimize KV reads (read once, use multiple times)
- [ ] Use appropriate TTLs to auto-cleanup old data
- [ ] Monitor KV usage and costs

**Technical Notes:**
- KV has rate limits (1000 reads/second per namespace)
- Consider D1 database for complex queries (future)
- Use Durable Objects for high-frequency updates

**Dependencies:** All KV operations  
**Priority:** P2 (Medium)  
**Estimated Effort:** 3 days

---

### Story 10.2: Add Health Check Endpoint
**As a** monitoring system  
**I want** a health check endpoint  
**So that** I can monitor service availability

**Acceptance Criteria:**
- [ ] Create `GET /health` endpoint (public, no auth)
- [ ] Return 200 if service is healthy
- [ ] Check KV connectivity
- [ ] Check email provider connectivity (optional)
- [ ] Return response time
- [ ] Include service version
- [ ] Return 503 if any check fails
- [ ] Support `GET /health/ready` for readiness probe
- [ ] Support `GET /health/live` for liveness probe

**Technical Notes:**
- Health checks should be fast (< 100ms)
- Don't check external services in health (only internal)
- Use for load balancer health checks

**Dependencies:** None  
**Priority:** P2 (Medium)  
**Estimated Effort:** 1 day

---

### Story 10.3: Implement Request Caching
**As a** customer  
**I want** fast API responses  
**So that** my users have a good experience

**Acceptance Criteria:**
- [ ] Cache customer configuration (5-minute TTL)
- [ ] Cache plan quotas (1-hour TTL)
- [ ] Cache CORS config (5-minute TTL)
- [ ] Use Cloudflare Cache API for public endpoints
- [ ] Set appropriate cache headers: `Cache-Control`, `ETag`
- [ ] Support cache invalidation on config updates
- [ ] Don't cache sensitive endpoints (OTP requests, verifications)
- [ ] Monitor cache hit rates

**Technical Notes:**
- Use in-memory cache for worker-level caching
- Use Cloudflare Cache for edge caching
- Invalidate cache on updates

**Dependencies:** Story 2.1  
**Priority:** P2 (Medium)  
**Estimated Effort:** 2 days

---

### Story 10.4: Add Monitoring & Alerting
**As a** service administrator  
**I want** monitoring and alerts  
**So that** I can respond to issues quickly

**Acceptance Criteria:**
- [ ] Integrate with monitoring service (Datadog, New Relic, etc.)
- [ ] Track metrics:
  - Request rate
  - Error rate
  - Response times (p50, p95, p99)
  - KV operation latency
  - Email delivery success rate
- [ ] Set up alerts for:
  - High error rate (> 5%)
  - Slow response times (> 500ms p95)
  - Service downtime
  - Quota exhaustion warnings
- [ ] Create status page (status.otpauth.com)
- [ ] Send alerts to email/Slack/PagerDuty

**Technical Notes:**
- Use Cloudflare Analytics for basic metrics
- Consider external APM for detailed monitoring
- Set up alerting thresholds based on baseline

**Dependencies:** Story 6.2, Story 6.3  
**Priority:** P2 (Medium)  
**Estimated Effort:** 3 days

---

## ★ Summary

### Total Stories: 60+
### Estimated Total Effort: ~120 days (6 months with 1 developer)

### Priority Breakdown:
- **P0 (Critical)**: 5 stories - Foundation & core functionality
- **P1 (High)**: 20 stories - Essential features for launch
- **P2 (Medium)**: 25 stories - Important but not blocking
- **P3 (Low)**: 10 stories - Nice-to-have features

### Recommended Phases:
1. **Phase 1 (Weeks 1-4)**: Foundation & Multi-Tenancy (Epic 1)
2. **Phase 2 (Weeks 5-8)**: Configuration & White-Labeling (Epic 2, 3)
3. **Phase 3 (Weeks 9-12)**: Usage & Billing (Epic 4)
4. **Phase 4 (Weeks 13-16)**: Webhooks & Analytics (Epic 5, 6)
5. **Phase 5 (Weeks 17-20)**: Self-Service & Documentation (Epic 7, 8)
6. **Phase 6 (Weeks 21-24)**: Security & Infrastructure (Epic 9, 10)

---

**Good luck with the productization, ye brave soul!** ‍ May these stories guide ye to a successful launch! [FEATURE]

