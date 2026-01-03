# Master Work Plan - Strixun Stream Suite
## Comprehensive Defect Fixes, Component Extraction & API Framework Migration

**Date:** 2026-01-03  
**Status:** Investigation Complete - Ready for Implementation  
**Last Updated:** 2026-01-03 (Framework recommendations verified for 2026)  
**Scope:** All defects, component extraction, API framework migration, and architectural improvements

---

## Executive Summary

This master work plan consolidates multiple audit documents into a single, prioritized implementation plan:

1. **47+ Defects** across 15 modules requiring fixes
2. **15+ Components** ready for extraction to shared-components
3. **8+ Services** ready for extraction with logic separation
4. **12+ Locations** need API framework migration
5. **Framework Integration** opportunities for better resilience
6. **Display Name Generation** - Global uniqueness, retry limits, release rules
7. **Developer API Namespace** - Per-key isolation, transformation layer, service SSO

**Total Estimated Effort:** 6-8 weeks  
**Priority:** Critical defects first, then API architecture improvements, then extraction, then enhancements

---

## 📊 Work Breakdown by Category

### Defect Fixes
- **Critical:** 12 defects (Week 2-3)
- **High Priority:** 18 defects (Week 3-4)
- **Medium Priority:** 17+ defects (Week 4-5)

### Display Name Generation Fixes
- **Global Uniqueness:** Change from per-customer to global (Week 1-2)
- **Retry Limits:** Max 50 retries, return empty string if all fail (Week 1)
- **Release Rules:** Only release on user change or account deletion (Week 1)
- **Remove includeNumber:** Remove all references (Week 1)
- **UI Updates:** Inform user of generation progress (Week 1-2)

### Developer API Namespace & Architecture
- **Namespace Isolation:** Per-key isolation with `devkey_{keyId}_*` pattern (Week 2) ⚠️ **HIGH**
- **Service API Keys:** Generate and configure separate keys per service (Week 2) ⚠️ **HIGH**
- **Service SSO:** Augment NETWORK_INTEGRITY_KEYPHRASE with API keys (Week 2-3) ⚠️ **HIGH**
- **Transformation Layer:** Agnostic middleware in api-framework (Week 3-4)
- **Per-Key Analytics:** Track usage per developer key (Week 4-5)

### Component Extraction
- **Quick Wins:** 6 components (Week 4-5)
- **Refactoring Required:** 9 components (Week 5-6)

### Service Extraction
- **High Value:** 4 services (Week 5-6)
- **Medium Value:** 4 services (Week 6-7)

### API Framework Migration
- **Critical:** Replace `authenticatedFetch` (Week 4-5)
- **Enhancement:** Add retry/cache to all API calls

---

## 🔥 Phase 0: Display Name Generation & API Architecture (Week 1-2)

### Priority 0.1: Display Name Generation Fixes ⚠️ **CRITICAL**

#### Issue: Global Uniqueness Required
**Location:** `serverless/otp-auth-service/services/nameGenerator.ts`

**Problem:** Display names are currently scoped per-customer, but must be globally unique

**Fix:**
```typescript
// OLD: cust_{customerId}_displayname_{name}
// NEW: displayname_{name} (always global)

export async function isNameUnique(
  name: string,
  customerId: string | null, // Keep for backward compat but ignore
  env: CloudflareEnv
): Promise<boolean> {
  // Always use global scope
  const nameKey = `displayname_${name.toLowerCase()}`;
  const existing = await env.OTP_AUTH_KV.get(nameKey);
  return !existing;
}
```

**Files to Update:**
- `serverless/otp-auth-service/services/nameGenerator.ts:357-368` - `isNameUnique()`
- `serverless/otp-auth-service/services/nameGenerator.ts:373-390` - `reserveDisplayName()`
- `serverless/otp-auth-service/services/nameGenerator.ts:395-405` - `releaseDisplayName()`
- `serverless/otp-auth-service/handlers/user/displayName.ts:168` - Update call to remove customerId
- `serverless/otp-auth-service/handlers/auth/customer-creation.ts:213-221` - Remove customerId from call
- `serverless/otp-auth-service/handlers/auth/otp.js:761-769` - Remove customerId from call
- `serverless/customer-api/handlers/customer.ts:175-181` - Remove customerId from call

**Effort:** 2-3 hours  
**Testing:** Test uniqueness across different customers

---

#### Issue: Max Retry Cap (50 attempts)
**Location:** `serverless/otp-auth-service/services/nameGenerator.ts:415-512`

**Problem:** Final fallback returns name without uniqueness check

**Fix:**
```typescript
export async function generateUniqueDisplayName(
  options: NameGeneratorOptions = {},
  env: CloudflareEnv
): Promise<string> {
  const {
    maxAttempts = 20,
    pattern = 'random',
    maxWords = DISPLAY_NAME_MAX_WORDS
  } = options;

  const MAX_TOTAL_RETRIES = 50;
  let totalAttempts = 0;
  let name: string;

  // Primary generation
  while (totalAttempts < MAX_TOTAL_RETRIES && totalAttempts < maxAttempts) {
    name = generateNamePattern(pattern, maxWords);
    totalAttempts++;
    
    const wordCount = countWords(name);
    if (wordCount > maxWords) continue;

    const isUnique = await isNameUnique(name, null, env); // Global uniqueness
    if (isUnique) {
      return name;
    }
  }

  // Fallback patterns (continue until MAX_TOTAL_RETRIES)
  const fallbackPatterns = ['adjective-noun', 'adjective-noun-adjective', 'noun-adjective', 
                            'adjective-adjective-noun', 'adjective-noun-noun'];
  
  for (const fallbackPattern of fallbackPatterns) {
    if (fallbackPattern === pattern) continue;
    if (totalAttempts >= MAX_TOTAL_RETRIES) break;
    
    for (let i = 0; i < 5 && totalAttempts < MAX_TOTAL_RETRIES; i++) {
      name = generateNamePattern(fallbackPattern, maxWords);
      totalAttempts++;
      
      const wordCount = countWords(name);
      if (wordCount > maxWords) continue;
      
      const isUnique = await isNameUnique(name, null, env);
      if (isUnique) {
        return name;
      }
    }
  }

  // Last resort: Extended combinations (continue until MAX_TOTAL_RETRIES)
  for (let i = 0; i < 10 && totalAttempts < MAX_TOTAL_RETRIES; i++) {
    const adj1 = randomElement(ADJECTIVES);
    const adj2 = randomElement(ADJECTIVES);
    const noun1 = randomElement(NOUNS);
    const noun2 = randomElement(NOUNS);
    
    const patterns = [
      `${adj1} ${noun1} ${adj2}`,
      `${adj1} ${adj2} ${noun1}`,
      `${noun1} ${adj1} ${adj2}`,
      `${adj1} ${noun1} ${noun2}`,
    ];
    
    for (const pattern of patterns) {
      if (totalAttempts >= MAX_TOTAL_RETRIES) break;
      
      const words = pattern.split(/\s+/).slice(0, maxWords);
      name = words.join(' ');
      totalAttempts++;
      
      const wordCount = countWords(name);
      if (wordCount > maxWords) continue;
      
      const isUnique = await isNameUnique(name, null, env);
      if (isUnique) {
        return name;
      }
    }
  }

  // After 50 attempts, return empty string
  return '';
}
```

**Effort:** 1-2 hours  
**Testing:** Test with high collision scenarios, verify empty string handling

---

#### Issue: Display Name Release Rules
**Location:** `serverless/otp-auth-service/services/nameGenerator.ts:395-405`, `handlers/user/displayName.ts`

**Problem:** Display names may be released incorrectly

**Required Rules:**
- ✅ Release immediately when user changes display name themselves
- ✅ Release when user account is deleted (customer account deleted)
- ❌ DO NOT release for auto-generated names during randomization
- ❌ DO NOT release for regeneration (only release old name when new one is saved)

**Fix:**
```typescript
// In handleUpdateDisplayName - release old name immediately
if (user.displayName && user.displayName !== sanitized) {
  await releaseDisplayName(user.displayName, null, env); // Global scope
}

// In handleRegenerateDisplayName - release old name when new one is saved
if (user.displayName && user.displayName !== newDisplayName) {
  await releaseDisplayName(user.displayName, null, env); // Global scope
}

// DO NOT release during generation attempts
// DO NOT release for auto-generated names
```

**Effort:** 1 hour  
**Testing:** Test release scenarios

---

#### Issue: Remove includeNumber Completely
**Location:** Multiple files

**Files to Update:**
- `serverless/otp-auth-service/handlers/auth/customer-creation.ts:143, 217`
- `serverless/otp-auth-service/handlers/auth/otp.js:765, 788`
- `serverless/otp-auth-service/handlers/auth/verify-otp.ts:72, 113`

**Fix:** Remove all `includeNumber: true` references

**Effort:** 30 minutes  
**Testing:** Verify no references remain

---

#### Issue: UI Updates for Generation Progress
**Location:** Frontend components that call display name generation

**Required:**
- Show message if initial generation fails: "Initial name generation failed. Continuing to ensure uniqueness..."
- Show error if generation returns empty string: "Unable to generate unique display name. Please try again or contact support."

**Effort:** 1-2 hours  
**Testing:** Test UI messaging

---

### Priority 0.1.5: Mods Display Name Fix (Already Implemented) ✅

#### Issue: Mods Using Display Names Instead of Customer IDs
**Location:** `serverless/mods-api/handlers/mods/*`

**Status:** ✅ **ALREADY FIXED** - System correctly uses customerId to fetch display names

**Current Implementation:**
- ✅ Mods store `customerId` in metadata (not display names)
- ✅ Display names are fetched dynamically from customer-api using `fetchDisplayNameByCustomerId(mod.customerId, env)`
- ✅ Stored `authorDisplayName` is only a fallback (for backward compatibility)
- ✅ Legacy mods automatically get `customerId` set when accessed by author (detail.ts, list.ts)
- ✅ All handlers fetch fresh display names from customer-api on every request

**Files Verified:**
- `serverless/mods-api/handlers/mods/upload.ts` - Fetches display name from customer-api using customerId
- `serverless/mods-api/handlers/mods/detail.ts` - Fetches display name from customer-api using customerId
- `serverless/mods-api/handlers/mods/list.ts` - Batch fetches display names from customer-api using customerIds
- `serverless/mods-api/handlers/mods/update.ts` - Fetches display name from customer-api using customerId

**No Action Required** - System is correctly implemented ✅

---

### Priority 0.2: Developer API Namespace Isolation (Week 2)

#### Issue: Per-Key Namespace Isolation
**Location:** `serverless/otp-auth-service/services/api-key.ts`, `nameGenerator.ts`

**Problem:** All API keys for a customer share the same namespace

**Fix:**
```typescript
// Update API key storage to include namespace
interface ApiKeyData {
  customerId: string;
  keyId: string;
  namespace: string; // NEW: "devkey_{keyId}"
  // ... existing fields
}

// Update key generation
const namespace = `devkey_${keyId}`;

// Update KV key patterns
function getDeveloperKey(keyId: string, resource: string): string {
  return `devkey_${keyId}_${resource}`;
}

// Update all storage operations
// OLD: cust_{customerId}_otp_{emailHash}
// NEW: devkey_{keyId}_otp_{emailHash}
```

**Files to Update:**
- `serverless/otp-auth-service/services/api-key.ts` - Add namespace to ApiKeyData
- `serverless/otp-auth-service/services/nameGenerator.ts` - Update all KV key patterns
- All handlers that use storage operations

**Effort:** 4-6 hours  
**Testing:** Test namespace isolation, verify no cross-key access

---

### Priority 0.3: Service API Key Setup (Week 2)

#### Issue: Service-to-Service Authentication
**Location:** `packages/service-client/index.ts`, all service workers

**Problem:** Service-to-service calls only use NETWORK_INTEGRITY_KEYPHRASE

**Fix:**
1. Generate service API keys (see Section 9.2 in DEVELOPER_API_NAMESPACE_AUDIT.md)
2. Update service client to include API key in headers
3. Update service authentication to verify API keys (augment, don't replace NETWORK_INTEGRITY_KEYPHRASE)

**Effort:** 3-4 hours  
**Testing:** Test service-to-service calls with API keys

---

### Priority 0.4: Transformation Layer in API Framework (Week 3-4)

#### Issue: No Transformation Layer for External API Access
**Location:** `packages/api-framework/src/middleware/` (NEW)

**Problem:** External developers access services directly without transformation

**Current State:**
- External requests go directly to otp-auth-service
- No request validation or sanitization
- No response transformation (internal fields exposed)
- No per-key rate limiting

**Required Fix:**
1. Create `packages/api-framework/src/middleware/external-api-transform.ts`
2. Extend existing transformation middleware (`packages/api-framework/src/middleware/transform.ts`)
3. Apply to external endpoints in otp-auth-service (`/auth/*`, `/admin/*`)

**Implementation:**
```typescript
// packages/api-framework/src/middleware/external-api-transform.ts
export interface ExternalAPITransformConfig {
  validateRequest?: (request: Request, apiKey: string) => Promise<boolean>;
  sanitizeInput?: (body: any) => any;
  addInternalHeaders?: (request: Request, keyData: ApiKeyData) => Headers;
  transformRequestBody?: (body: any) => any;
  transformResponse?: (response: Response, keyData: ApiKeyData) => Response;
  removeInternalFields?: (data: any) => any;
  addRateLimitHeaders?: (response: Response, limits: RateLimits) => Response;
}

export function createExternalAPITransformMiddleware(
  config: ExternalAPITransformConfig
): Middleware {
  // Agnostic transformation logic
  // Works with api-framework's existing middleware system
}
```

**Request Flow:**
```
External Developer
  ↓
API Key Authentication
  ↓
Transformation Middleware
  ├─ Validate & Sanitize
  ├─ Add Internal Context (keyId, customerId)
  ├─ Check Rate Limits (per key)
  └─ Log for Analytics (per key)
  ↓
Internal Handler (uses devkey_{keyId}_* namespace)
  ↓
Transformation Middleware (response)
  ├─ Remove Internal Fields
  ├─ Transform Format
  └─ Add Rate Limit Headers
  ↓
External Developer
```

**Effort:** 6-8 hours  
**Testing:** Test request/response transformation, verify internal fields removed

---

### Priority 0.5: Per-Key Analytics (Week 4-5)

#### Issue: Analytics Not Scoped Per API Key
**Location:** `serverless/otp-auth-service/services/analytics.ts`

**Problem:** Analytics tracked per customer, not per developer API key

**Required Fix:**
```typescript
// Track per key
async function trackKeyUsage(
  keyId: string,
  customerId: string,
  metric: string,
  increment: number,
  env: Env
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  // Per-key analytics
  const keyKey = `devkey_${keyId}_analytics_${today}`;
  await updateAnalytics(keyKey, metric, increment, env);
  
  // Customer aggregate
  const customerKey = `analytics_customer_${customerId}_${today}`;
  await updateAnalytics(customerKey, metric, increment, env);
}
```

**New Endpoints:**
- `GET /admin/analytics/key/{keyId}` - Returns per-key analytics
- `GET /admin/analytics/customer/{customerId}` - Returns customer aggregate

**Effort:** 3-4 hours  
**Testing:** Test analytics tracking and aggregation

---

## 🔥 Phase 1: Critical Defects (Week 2-3)

### Priority 1.1: Text Rotator & OBS Communication ⚠️ **CRITICAL**

#### Issue 1: Text Rotator Local Serving Broken
**Location:** `src/modules/app.ts:876-880`

**Problem:**
```typescript
export function getBrowserSourceUrl(configId?: string): string {
  const currentPath = window.location.pathname;
  const displayPath = currentPath.replace('control_panel.html', 'text_cycler_display.html');
  return `file://${displayPath}?id=${configId || 'config1'}`; // ❌ Always file://
}
```

**Fix:**
```typescript
export function getBrowserSourceUrl(configId?: string): string {
  const configIdParam = configId || 'config1';
  
  // If running via HTTP (dev server or production), use HTTP URL
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    return `${baseUrl}/text_cycler_display.html?id=${configIdParam}`;
  }
  
  // Fallback to file:// for OBS dock (file:// protocol)
  const currentPath = window.location.pathname;
  const displayPath = currentPath.replace('control_panel.html', 'text_cycler_display.html');
  return `file://${displayPath}?id=${configIdParam}`;
}
```

**Effort:** 5 minutes  
**Testing:** Test with `vite dev` (HTTP) and OBS dock (file://)

---

#### Issue 2: OBS Communication Chain Fragility
**Location:** `src/modules/websocket.ts`, `src/modules/text-cycler.ts`

**Problems:**
- CustomEvent subscription may not be working
- OBS dock detection fails with HTTP
- localStorage polling race conditions
- No message delivery confirmation

**Fixes Required:**
1. Verify CustomEvent subscription (add logging)
2. Improve OBS dock detection (check for HTTP in dock)
3. Add message delivery confirmation
4. Add retry mechanism for failed sends
5. Add diagnostic mode to trace message flow

**Effort:** 2-3 hours  
**Testing:** Test remote → OBS → browser source flow

---

#### Issue 3: No JWT Security for Text Rotator
**Location:** `text_cycler_display.html`

**Problem:** Text rotator display page is completely open - anyone with URL can access

**Solution:** Implement JWT-locked text rotator (optional, can be Phase 3)

**Effort:** 4-6 hours  
**Priority:** Medium (security enhancement)

---

### Priority 1.2: WebSocket Reconnection & Cleanup ⚠️ **CRITICAL**

#### Issue 4: No Exponential Backoff Reconnection
**Location:** `src/modules/websocket.ts:364-370`

**Problem:**
```typescript
// Fixed 3-second delay - no backoff
setTimeout(() => {
  connect();
}, 3000);
```

**Fix Option 1 - Manual Implementation:**
```typescript
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 30 seconds max

function scheduleReconnect(): void {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  
  setTimeout(() => {
    connect().then(() => {
      reconnectAttempts = 0; // Reset on success
    }).catch(() => {
      scheduleReconnect(); // Retry with longer delay
    });
  }, delay);
}
```

**Fix Option 2 - Use Existing Framework (RECOMMENDED):**
Migrate to `@strixun/api-framework` WebSocketClient which already has:
- ✅ Exponential backoff reconnection
- ✅ Message queuing
- ✅ Request/response pattern
- ✅ Automatic cleanup

```typescript
import { WebSocketClient } from '@strixun/api-framework';

const ws = new WebSocketClient({
  url: `ws://${host}:${port}`,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  reconnectAttempts: Infinity,
  queueMessages: true,
});
```

**Effort:** 1 hour (manual) or 30 min (use existing framework)  
**Testing:** Test reconnection with OBS disconnected

---

#### Issue 5: Request Timeout Not Cleared
**Location:** `src/modules/websocket.ts:542-554`

**Problem:**
```typescript
const timeoutId = setTimeout(() => {
  reject(new Error('Request timeout'));
}, timeout);
// ❌ Timeout not cleared if request succeeds
```

**Fix:**
```typescript
const timeoutId = setTimeout(() => {
  delete pendingRequests[requestId];
  reject(new Error('Request timeout'));
}, timeout);

// Store timeout ID with request
pendingRequests[requestId] = { resolve, reject, timeoutId };

// Clear timeout on success
resolve(data);
clearTimeout(pendingRequests[requestId].timeoutId);
delete pendingRequests[requestId];
```

**Effort:** 30 minutes  
**Testing:** Test with slow OBS responses

---

#### Issue 6: Pending Requests Leak on Disconnect
**Location:** `src/modules/websocket.ts:445-454`

**Problem:** Pending requests never rejected when connection closes

**Fix:**
```typescript
ws.onclose = () => {
  // Reject all pending requests
  Object.values(pendingRequests).forEach(req => {
    if (req.timeoutId) clearTimeout(req.timeoutId);
    req.reject(new Error('Connection closed'));
  });
  pendingRequests = {};
  
  // Schedule reconnection
  if (shouldReconnect) {
    scheduleReconnect();
  }
};
```

**Effort:** 15 minutes  
**Testing:** Test disconnect during pending requests

---

### Priority 1.3: Memory Leaks - Animation Timers ⚠️ **CRITICAL**

#### Issue 7: Source Swaps - Animation Timers Not Cleaned Up
**Location:** `src/modules/source-swaps.ts:209-242, 262-312, 331-387, 614-649`

**Problem:**
```typescript
function animate(): void {
  // ... animation code ...
  if (rawT < 1) requestAnimationFrame(animate); // ❌ Never cancelled!
  else resolve();
}
requestAnimationFrame(animate);
```

**Fix:**
```typescript
let animationFrameId: number | null = null;

function animate(): void {
  // ... animation code ...
  if (rawT < 1) {
    animationFrameId = requestAnimationFrame(animate);
  } else {
    animationFrameId = null;
    resolve();
  }
}

animationFrameId = requestAnimationFrame(animate);

// Cleanup function
function cancelAnimation(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}
```

**Effort:** 2 hours (all animation functions)  
**Testing:** Test swap cancellation, page navigation during swap

---

#### Issue 8: Layouts - Animation Cleanup Missing
**Location:** `src/modules/layouts.ts:365-420`

**Same issue as source swaps - apply same fix**

**Effort:** 1 hour  
**Testing:** Test layout application cancellation

---

#### Issue 9: Text Cycler - Interval Not Cleared on Delete
**Location:** `src/modules/text-cycler.ts:527`

**Problem:**
```typescript
let intervalId: ReturnType<typeof setInterval> | null = null;

function startConfigCycling(configId: string): void {
  intervalId = setInterval(() => {
    // ... cycling logic ...
  }, interval);
}

// ❌ Never cleared when config deleted
```

**Fix:**
```typescript
function deleteTextCyclerConfig(configId: string): void {
  // Clear interval if this config is cycling
  if (activeCyclingConfig === configId && intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    activeCyclingConfig = null;
  }
  
  // ... rest of delete logic ...
}
```

**Effort:** 30 minutes  
**Testing:** Test config deletion during active cycling

---

#### Issue 10: Text Cycler - BroadcastChannel Never Closed
**Location:** `src/modules/text-cycler.ts:46`

**Problem:**
```typescript
const textChannels: Record<string, BroadcastChannel> = {};

function sendToDisplay(configId: string, message: any): void {
  if (!textChannels[configId]) {
    textChannels[configId] = new BroadcastChannel(`text_cycler_${configId}`);
  }
  // ❌ Never closed when config deleted
}
```

**Fix:**
```typescript
function deleteTextCyclerConfig(configId: string): void {
  // Close BroadcastChannel
  if (textChannels[configId]) {
    textChannels[configId].close();
    delete textChannels[configId];
  }
  
  // ... rest of delete logic ...
}
```

**Effort:** 15 minutes  
**Testing:** Test config deletion with active channels

---

### Priority 1.4: Storage & Initialization ⚠️ **CRITICAL**

#### Issue 11: Auto-Backup Timer Never Cleared
**Location:** `src/modules/storage.ts:489-498`

**Problem:**
```typescript
let autoBackupTimer: ReturnType<typeof setInterval> | null = null;

function startAutoBackup(): void {
  autoBackupTimer = setInterval(() => {
    // ... backup logic ...
  }, 5 * 60 * 1000);
}

// ❌ Never cleared on app shutdown
```

**Fix:**
```typescript
window.addEventListener('beforeunload', () => {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
});

// Also clear on module cleanup
export function cleanupStorage(): void {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
}
```

**Effort:** 10 minutes  
**Testing:** Test app shutdown/unload

---

#### Issue 12: Initialization Race Condition
**Location:** `src/modules/bootstrap.ts:281-304`

**Problem:**
```typescript
// Busy-wait loop for concurrency control
while (appInitializationInProgress) {
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

**Fix:**
```typescript
let initializationPromise: Promise<void> | null = null;

export async function initializeApp(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise; // Return existing promise
  }
  
  initializationPromise = (async () => {
    // ... initialization logic ...
    appInitializationCompleted = true;
  })();
  
  return initializationPromise;
}
```

**Effort:** 30 minutes  
**Testing:** Test concurrent initialization calls

---

## 🚀 Phase 2: High Priority Defects (Week 2)

### Priority 2.0: WebSocket Migration to Framework (OPTIONAL BUT RECOMMENDED)

#### Issue: Migrate to Existing WebSocketClient
**Location:** `src/modules/websocket.ts`

**Current State:** Custom WebSocket implementation with manual reconnection

**Recommended:** Migrate to `@strixun/api-framework` WebSocketClient

**Benefits:**
- ✅ Already has exponential backoff (no manual implementation needed)
- ✅ Message queuing built-in
- ✅ Request/response pattern
- ✅ Automatic cleanup
- ✅ Consistent with API framework usage

**Migration:**
```typescript
// BEFORE (src/modules/websocket.ts)
// Custom WebSocket implementation

// AFTER
import { WebSocketClient } from '@strixun/api-framework';

const ws = new WebSocketClient({
  url: `ws://${host}:${port}`,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  reconnectAttempts: Infinity,
  queueMessages: true,
});

// Use ws.request() for request/response
// Use ws.send() for fire-and-forget
// Use ws.on() for event listeners
```

**Effort:** 2-3 hours (migrate all WebSocket calls)  
**Testing:** Test all OBS communication flows  
**Note:** This can be done in Phase 2 or Phase 3, but doing it in Phase 2 fixes the reconnection issue automatically

---

### Priority 2.1: Race Conditions

#### Issue 13: Source Swaps - Concurrent Swaps Possible
**Location:** `src/modules/source-swaps.ts:451-460`

**Fix:** Use Promise-based lock
```typescript
let swapLock: Promise<void> | null = null;

async function executeSwap(sourceA: string, sourceB: string): Promise<void> {
  if (swapLock) {
    await swapLock; // Wait for current swap
  }
  
  swapLock = (async () => {
    try {
      // ... swap logic ...
    } finally {
      swapLock = null;
    }
  })();
  
  return swapLock;
}
```

**Effort:** 1 hour  
**Testing:** Test rapid swap clicks

---

#### Issue 14: Sources - Source List Refresh Race Condition
**Location:** `src/modules/sources.ts:243-275`

**Fix:** Use request deduplication
```typescript
let refreshPromise: Promise<Source[]> | null = null;

export async function refreshSources(): Promise<Source[]> {
  if (refreshPromise) {
    return refreshPromise; // Return existing request
  }
  
  refreshPromise = (async () => {
    try {
      const data = await request('GetSceneItemList', { sceneName: get(currentScene) });
      sources.set(/* ... */);
      return get(sources);
    } finally {
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
}
```

**Effort:** 30 minutes  
**Testing:** Test rapid refresh calls

---

### Priority 2.2: Error Recovery

#### Issue 15: Source Swaps - Transform Failures Not Handled
**Location:** `src/modules/source-swaps.ts:112-146`

**Fix:** Store original transforms, implement rollback
```typescript
async function animateSlide(...): Promise<void> {
  const originalA = await getTransform(idA);
  const originalB = await getTransform(idB);
  
  try {
    // ... animation logic ...
  } catch (error) {
    // Rollback on error
    await Promise.all([
      setTransform(idA, originalA),
      setTransform(idB, originalB)
    ]);
    throw error;
  }
}
```

**Effort:** 2 hours (all animation functions)  
**Testing:** Test transform failures during animation

---

#### Issue 16: Layouts - Scene Mismatch But Continues Anyway
**Location:** `src/modules/layouts.ts:262-265`

**Fix:** Add confirmation or abort
```typescript
if (preset.sceneName !== get(currentScene)) {
  const confirmed = confirm(
    `Layout preset is for scene "${preset.sceneName}" but current scene is "${get(currentScene)}". Continue anyway?`
  );
  if (!confirmed) {
    throw new Error('Layout application cancelled');
  }
}
```

**Effort:** 30 minutes  
**Testing:** Test layout application with scene mismatch

---

### Priority 2.3: Cleanup & Validation

#### Issue 17: Sources - Opacity Filter Cleanup Missing
**Location:** `src/modules/sources.ts:587-654`

**Fix:** Track filters, cleanup on source delete
```typescript
const opacityFilters = new Map<string, string>(); // sourceName -> filterName

export async function applyOpacityFilter(sourceName: string, opacity: number): Promise<void> {
  // ... create filter ...
  opacityFilters.set(sourceName, filterName);
}

// Cleanup on source delete
export async function cleanupSourceFilters(sourceName: string): Promise<void> {
  const filterName = opacityFilters.get(sourceName);
  if (filterName) {
    await removeOpacityFilter(sourceName, filterName);
    opacityFilters.delete(sourceName);
  }
}
```

**Effort:** 1 hour  
**Testing:** Test source deletion with opacity filters

---

#### Issue 18: Storage Sync - Hash Collision Risk
**Location:** `src/modules/storage-sync.ts`

**Fix:** Use stronger hash (SHA-256) or add collision detection
```typescript
import { createHash } from 'crypto';

function hashData(data: any): string {
  return createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}
```

**Effort:** 1 hour  
**Testing:** Test with large data sets

---

## 🔧 Phase 3: API Framework Migration (Week 2-3)

### Priority 3.1: Create API Client Setup

**Location:** `src/core/api.ts` (NEW FILE)

**Implementation:**
```typescript
import { createAPIClient } from '@strixun/api-framework';
import { getAuthToken, getCsrfToken } from '../stores/auth';

function getApiUrl(): string {
  if (typeof window.getWorkerApiUrl === 'function') {
    return window.getWorkerApiUrl();
  }
  return 'https://api.example.com'; // Fallback
}

let apiClient: APIClient | null = null;

export function getAPIClient(): APIClient {
  if (!apiClient) {
    apiClient = createAPIClient({
      baseURL: getApiUrl(),
      auth: {
        tokenGetter: () => getAuthToken(),
        csrfTokenGetter: () => getCsrfToken(),
      },
      features: {
        deduplication: true,
        retry: {
          maxAttempts: 3,
          backoff: 'exponential',
          initialDelay: 1000,
          maxDelay: 10000,
        },
        cache: {
          enabled: true,
          defaultStrategy: 'network-first',
          defaultTTL: 5 * 60 * 1000, // 5 minutes
        },
        cancellation: true,
        offlineQueue: true,
      },
    });
  }
  return apiClient;
}
```

**Effort:** 1 hour  
**Testing:** Test API client initialization

---

### Priority 3.2: Migrate Cloud Save

**Location:** `src/modules/cloud-save.ts`

**Before:**
```typescript
export async function saveToCloud(...): Promise<void> {
  const response = await authenticatedFetch(`/cloud-save/save?slot=${slot}`, {
    method: 'POST',
    body: JSON.stringify({ backup, metadata }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save to cloud');
  }
}
```

**After:**
```typescript
import { getAPIClient } from '../core/api';

export async function saveToCloud(...): Promise<void> {
  const api = getAPIClient();
  await api.post('/cloud-save/save', { backup, metadata }, {
    params: { slot },
    cache: { enabled: false }, // Don't cache writes
  });
}
```

**Effort:** 1 hour (all 4 functions)  
**Testing:** Test cloud save/load/list/delete

---

### Priority 3.3: Migrate Notes Storage

**Location:** `src/modules/notes-storage.ts`

**Same pattern as cloud-save - migrate all 4 functions**

**Effort:** 1 hour  
**Testing:** Test notes save/load/list/delete

---

### Priority 3.4: Remove `authenticatedFetch`

**Location:** `src/stores/auth.ts`, `src/stores/auth-new.ts`

**Action:**
1. Search for all `authenticatedFetch` usages
2. Replace with `getAPIClient()`
3. Remove `authenticatedFetch` function
4. Update all callers

**Effort:** 2 hours  
**Testing:** Test all API calls still work

---

## 📦 Phase 4: Component Extraction (Week 3-4)

### Priority 4.1: Quick Wins - Agnostic Components

**Components to Extract:**
1. **SearchBox** → `@strixun/search-box`
2. **ConfirmationModal** → `@strixun/confirmation-modal`
3. **Card** → `@strixun/card`
4. **LoadingSkeleton** → `@strixun/loading-skeleton`
5. **ProgressRing** → `@strixun/progress-ring`
6. **TruncatedText** → `@strixun/truncated-text`

**Process for Each:**
1. Move component to `shared-components/{name}/`
2. Create `package.json` with workspace reference
3. Create `index.ts` export
4. Update imports in main app
5. Test component still works

**Effort:** 2 hours per component (12 hours total)  
**Testing:** Test each component in main app

---

### Priority 4.2: Refactoring Required - Components

**Components Needing Refactor:**
1. **SourceSelect** - Dependency injection refactor
2. **Toast/ToastContainer** - Store abstraction
3. **VirtualList** - Svelte version (React exists)

**Effort:** 4-6 hours per component  
**Testing:** Test with mocked dependencies

---

## 🏗️ Phase 5: Service Extraction (Week 4-5)

### Priority 5.1: Animation Manager

**Location:** `packages/animation-manager/` (NEW)

**Extract from:**
- `src/modules/source-swaps.ts` (animation logic)
- `src/modules/layouts.ts` (animation logic)
- `src/modules/sources.ts` (animation logic)

**Implementation:**
```typescript
// packages/animation-manager/src/index.ts
export class AnimationManager {
  private activeAnimations = new Map<string, AnimationHandle>();
  
  animate(
    id: string,
    from: Transform,
    to: Transform,
    duration: number,
    easing: string,
    onFrame: (current: Transform) => Promise<void>
  ): AnimationHandle {
    // Centralized animation management
    // Automatic cleanup
    // Cancellation support
  }
  
  cancel(id: string): void {
    // Cancel and cleanup
  }
  
  cancelAll(): void {
    // Cancel all animations
  }
}

// packages/animation-manager/src/easing.ts
export { easeFunc, lerp, easingPresets };

// packages/animation-manager/src/transforms.ts
export class TransformCalculator {
  calculateSwapTransforms(...): TransformPair;
  sanitizeTransform(...): Transform;
  convertBoundsToScale(...): Scale;
}
```

**Effort:** 8-10 hours  
**Testing:** Unit tests for pure functions, integration tests for animations

---

### Priority 5.2: OBS WebSocket Client

**Location:** `packages/obs-websocket-client/` (NEW)

**Extract from:** `src/modules/websocket.ts`

**Implementation:**
```typescript
// packages/obs-websocket-client/src/client.ts
export class OBSWebSocketClient extends EventTarget {
  connect(host: string, port: number, password: string): Promise<void>;
  disconnect(): void;
  request(type: string, data: any): Promise<any>;
  subscribe(events: number): void;
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
}

// packages/obs-websocket-client/src/auth.ts
export class OBSCredentialManager {
  saveCredentials(host, port, password): Promise<void>;
  loadCredentials(): Promise<Credentials | null>;
  clearCredentials(): Promise<void>;
}
```

**Effort:** 10-12 hours  
**Testing:** Unit tests with mocked WebSocket, integration tests with real OBS

---

### Priority 5.3: Storage Service

**Location:** `packages/storage-service/` (NEW)

**Extract from:** `src/modules/storage.ts`

**Effort:** 6-8 hours  
**Testing:** Unit tests with mocked IndexedDB/localStorage

---

### Priority 5.4: Encryption Service

**Location:** `packages/encryption-service/` (NEW)

**Extract from:** `src/core/services/encryption.ts`

**Effort:** 8-10 hours  
**Testing:** Unit tests with mocked crypto APIs

---

## 🧪 Testing Strategy

### Unit Tests (Cheap, Fast)
- Animation calculations
- Transform sanitization
- Storage operations (mocked)
- Encryption/decryption (mocked)
- Search/filter logic

### Component Tests (Medium)
- Component rendering
- User interactions
- Props/events
- Mocked dependencies

### Integration Tests (Expensive, Slow)
- OBS communication end-to-end
- Storage sync across clients
- Source swap with scene changes
- Layout application with missing sources

### E2E Tests (Most Expensive)
- Full swap workflow
- Layout capture and apply
- Text cycler browser mode
- Storage sync remote → OBS dock
- Reconnection scenarios

---

## 🔗 Framework Recommendations

### WebSocket Reconnection
**Recommended:** Use existing `@strixun/api-framework` WebSocketClient
- ✅ Already in codebase (`packages/api-framework/src/websocket/client.ts`)
- ✅ Exponential backoff reconnection (already implemented)
- ✅ Message queuing support
- ✅ Request/response pattern
- ✅ TypeScript support
- **Integration:** Migrate `src/modules/websocket.ts` to use `WebSocketClient` from api-framework
- **Note:** `reconnecting-websocket` npm package is unmaintained (last update Feb 2020) - do not use

### Animation Management
**Recommended:** Custom animation manager (extract to package)
- Centralized animation lifecycle
- Automatic cleanup
- Cancellation support
- **Location:** `packages/animation-manager/`

### JWT Text Rotator
**Recommended:** Server-side validation (preferred)
- Validate on server before serving HTML
- Client-side verification for UX only
- Use existing JWT infrastructure
- **Alternative:** Client-side with `jose` library (actively maintained as of Jan 2026, 16M+ weekly downloads)
  - ✅ Latest version: 6.1.3 (released ~26 days ago)
  - ✅ No known security vulnerabilities
  - ✅ Strong community support (7K+ GitHub stars)
  - ⚠️ **Security Note:** Client-side validation is for UX only - never trust for security decisions

---

## 📋 Implementation Checklist

### Phase 1: Critical Defects (Week 1)
- [ ] Fix text rotator local serving
- [ ] Fix OBS communication chain
- [ ] Fix WebSocket reconnection (exponential backoff)
- [ ] Fix request timeout cleanup
- [ ] Fix pending request cleanup on disconnect
- [ ] Fix source swaps animation cleanup
- [ ] Fix layouts animation cleanup
- [ ] Fix text cycler interval cleanup
- [ ] Fix text cycler BroadcastChannel cleanup
- [ ] Fix auto-backup timer cleanup
- [ ] Fix initialization race condition
- [ ] Test all critical fixes

### Phase 2: High Priority Defects (Week 2)
- [ ] Fix source swaps race conditions
- [ ] Fix source refresh race condition
- [ ] Fix transform failure error recovery
- [ ] Fix layout scene mismatch handling
- [ ] Fix opacity filter cleanup
- [ ] Fix storage sync hash collision
- [ ] Fix remaining high priority issues
- [ ] Test all high priority fixes

### Phase 2.5: Transformation Layer (Week 3-4)
- [ ] Create external API transform middleware in api-framework
- [ ] Apply transformation to otp-auth-service external endpoints
- [ ] Add request validation
- [ ] Add response transformation
- [ ] Test transformation logic

### Phase 3: API Framework Migration (Week 4-5)
- [ ] Create `src/core/api.ts` with `getAPIClient()`
- [ ] Migrate `cloud-save.ts` to api-framework
- [ ] Migrate `notes-storage.ts` to api-framework
- [ ] Remove `authenticatedFetch` function
- [ ] Update all callers
- [ ] Test all API calls

### Phase 4: Component Extraction (Week 3-4)
- [ ] Extract SearchBox
- [ ] Extract ConfirmationModal
- [ ] Extract Card
- [ ] Extract LoadingSkeleton
- [ ] Extract ProgressRing
- [ ] Extract TruncatedText
- [ ] Refactor SourceSelect
- [ ] Refactor Toast components
- [ ] Test all extracted components

### Phase 5: Service Extraction (Week 6-7)
- [ ] Extract Animation Manager
- [ ] Extract OBS WebSocket Client
- [ ] Extract Storage Service
- [ ] Extract Encryption Service
- [ ] Update modules to use extracted services
- [ ] Test all extracted services

---

## 📊 Progress Tracking

### Defect Fixes
- **Critical:** 0/12 (0%)
- **High Priority:** 0/18 (0%)
- **Medium Priority:** 0/17 (0%)

### Component Extraction
- **Quick Wins:** 0/6 (0%)
- **Refactoring Required:** 0/3 (0%)

### Service Extraction
- **High Value:** 0/4 (0%)
- **Medium Value:** 0/4 (0%)

### Display Name Generation
- **Global Uniqueness:** 0/1 (0%)
- **Retry Limits:** 0/1 (0%)
- **Release Rules:** 0/1 (0%)
- **Remove includeNumber:** 0/1 (0%)
- **UI Updates:** 0/1 (0%)

### Developer API Namespace
- **Namespace Isolation:** 0/1 (0%)
- **Service API Keys:** 0/1 (0%)
- **Service SSO:** 0/1 (0%)
- **Transformation Layer:** 0/1 (0%)
- **Per-Key Analytics:** 0/1 (0%)

### API Framework Migration
- **Setup:** 0/1 (0%)
- **Modules Migrated:** 0/2 (0%)
- **authenticatedFetch Removed:** No

---

## 🎯 Success Criteria

### Phase 0 Complete When:
- ✅ Display names are globally unique
- ✅ Max retry cap implemented (50 attempts)
- ✅ Display name release rules enforced
- ✅ includeNumber removed completely
- ✅ UI shows generation progress
- ✅ Per-key namespace isolation working
- ✅ Service API keys generated and configured
- ✅ Service-to-service authentication with API keys working

### Phase 1 Complete When:
- ✅ All critical defects fixed
- ✅ All fixes tested
- ✅ No new memory leaks
- ✅ No race conditions in critical paths

### Phase 2 Complete When:
- ✅ All high priority defects fixed
- ✅ Error recovery implemented
- ✅ All fixes tested

### Phase 2.5 Complete When:
- ✅ Transformation middleware created in api-framework
- ✅ Applied to all external endpoints
- ✅ Request/response transformation working
- ✅ All transformation logic tested

### Phase 3 Complete When:
- ✅ API framework fully integrated
- ✅ All `authenticatedFetch` calls migrated
- ✅ Retry/cache working
- ✅ All API calls tested

### Phase 4 Complete When:
- ✅ All components extracted
- ✅ All components tested
- ✅ Imports updated
- ✅ No duplicate code

### Phase 5 Complete When:
- ✅ All services extracted
- ✅ All services tested
- ✅ Modules updated
- ✅ Unit tests passing

---

## 📝 Notes

- **Test as you go** - Don't wait until end to test
- **Small commits** - One fix per commit for easy rollback
- **Document changes** - Update architecture docs
- **Monitor performance** - Watch for regressions
- **User feedback** - Test with real users when possible

---

**End of Master Work Plan**

*This plan consolidates all audit findings into a single, actionable implementation guide. Ready to begin Phase 1.*
