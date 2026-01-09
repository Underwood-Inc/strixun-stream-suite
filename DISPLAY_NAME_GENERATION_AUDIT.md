# Display Name Generation Audit Report 🔍

**Date:** 2026-01-03  
**Scope:** Random display name generation utility, uniqueness handling, and change interval enforcement

---

## Executive Summary ⚡

This audit examines the random display name generation system used for customers, focusing on:
1. **Uniqueness enforcement** - How uniqueness is checked and scoped
2. **Change interval** - Rate limiting for display name changes
3. **End-to-end usage** - How the system is used across the codebase

### Key Findings 🎯

- ⚠ **REQUIRED CHANGE: Uniqueness must be globally unique** (currently per-customer)
- ✓ **Change interval: 30 days** (once per month)
- ✓ **Auto-generated names bypass the change limit** (only count on save)
- ⚠ **REQUIRED CHANGE: No fallback name returns** - must continue generation until unique
- ⚠ **REQUIRED CHANGE: Display name release rules** - only on user change or account deletion
- ⚠ **REQUIRED CHANGE: Remove includeNumber** - not supported
- ✓ **Customer IDs must be globally unique**

---

## 1. Display Name Generation Utility 📦

### Location
**Primary Implementation:** `serverless/otp-auth-service/services/nameGenerator.ts`

### Core Function
```typescript
generateUniqueDisplayName(options: NameGeneratorOptions, env: CloudflareEnv): Promise<string>
```

### Generation Strategy
- **Word pools:** 200+ adjectives × 200+ nouns = 40,000+ base combinations
- **Patterns:** Supports multiple generation patterns (adjective-noun, adjective-noun-adjective, etc.)
- **Max attempts:** 20 primary attempts + fallback strategies
- **Word count:** Maximum 8 words (supports dash-separated names like "Swift-Bold")

### Generation Process
1. Primary generation (up to 20 attempts)
2. Fallback patterns if primary fails
3. Last resort: Extended word combinations
4. **CRITICAL: Maximum 50 total retries** - After 50 attempts, return empty string
5. **UI must inform user** if initial generation failed and continuing to ensure uniqueness
6. **If all retries fail (50 attempts):** Return empty string (caller must handle)

---

## 2. Uniqueness Enforcement 🔒

### Implementation
**Function:** `isNameUnique(name: string, customerId: string | null, env: CloudflareEnv): Promise<boolean>`

**Location:** `serverless/otp-auth-service/services/nameGenerator.ts:357-368`

### Uniqueness Scoping ⚠

```typescript
const nameKey = customerId 
  ? `cust_${customerId}_displayname_${name.toLowerCase()}`
  : `displayname_${name.toLowerCase()}`;
```

**CRITICAL FINDING:** Uniqueness is **scoped per customer**, not globally!

- **With customerId:** `cust_{customerId}_displayname_{name}`
- **Without customerId:** `displayname_{name}` (global scope)

### Implications 🎭

1. **Different customers CAN have the same display name**
   - Customer A can have "Swift Eagle"
   - Customer B can also have "Swift Eagle"
   - This is **by design** - uniqueness is per-customer

2. **Within a customer, display names are unique**
   - All users under Customer A must have unique display names
   - All users under Customer B must have unique display names

3. **Global uniqueness only when customerId is null**
   - Rare edge case (likely for system-level accounts)

### Usage in End-to-End Scenarios 🔄

#### Customer Account Creation
**Location:** `serverless/otp-auth-service/handlers/auth/customer-creation.ts:213-221`

```typescript
// REQUIRED CHANGE: Remove customerId from uniqueness check
// REQUIRED CHANGE: Remove includeNumber (not supported)
const customerDisplayName = await generateUniqueDisplayName({
    maxAttempts: 10,  // Will continue beyond maxAttempts if needed
    pattern: 'random'
}, env);
await reserveDisplayName(customerDisplayName, resolvedCustomerId, resolvedCustomerId, env);
```

**Uniqueness scope:** Global (no customerId in check)

#### User Account Creation
**Location:** `serverless/otp-auth-service/handlers/auth/otp.js:761-769`

```typescript
const displayName = await generateUniqueDisplayName({
    customerId: resolvedCustomerId,
    maxAttempts: 10,
}, env);
await reserveDisplayName(displayName, userId, resolvedCustomerId, env);
```

**Uniqueness scope:** Per-customer (uses `customerId`)

#### Customer API - Missing Display Name
**Location:** `serverless/customer-api/handlers/customer.ts:175-181`

```typescript
const customerDisplayName = await generateUniqueDisplayName({
    customerId: customer.customerId,
    maxAttempts: 10,
}, nameGeneratorEnv);
await reserveDisplayName(customerDisplayName, customer.customerId, customer.customerId, nameGeneratorEnv);
```

**Uniqueness scope:** Per-customer (uses `customerId`)

#### User Display Name Update
**Location:** `serverless/otp-auth-service/handlers/user/displayName.ts:168`

```typescript
const unique = await isNameUnique(sanitized, auth.customerId, env);
```

**Uniqueness scope:** Per-customer (uses `customerId`)

### Reservation System 🔐

**Function:** `reserveDisplayName(name: string, userId: string, customerId: string | null, env: CloudflareEnv)`

- **Storage:** KV namespace with key pattern: `cust_{customerId}_displayname_{name}`
- **TTL:** 1 year (31536000 seconds)
- **Data stored:** `{ userId, name, reservedAt }`

**Release Function:** `releaseDisplayName(name: string, customerId: string | null, env: CloudflareEnv)`
- Deletes the reservation when a user changes their display name

---

## 3. Change Interval Enforcement ⏰

### Implementation
**Function:** `canChangeDisplayName(userId: string, customerId: string | null, env: Env)`

**Location:** `serverless/otp-auth-service/services/user-preferences.ts:141-183`

### Change Interval: 30 Days 📅

```typescript
const daysSinceLastChange = Math.floor((now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24));

if (daysSinceLastChange < 30) {
    const nextChangeDate = new Date(lastChanged);
    nextChangeDate.setDate(nextChangeDate.getDate() + 30);
    return {
        allowed: false,
        reason: `Display name can only be changed once per month. Last changed: ${lastChanged.toLocaleDateString()}`,
        nextChangeDate: nextChangeDate.toISOString(),
    };
}
```

### Exceptions & Edge Cases 🎯

1. **Auto-generated names don't count**
   ```typescript
   const userChanges = preferences.displayName.previousNames.filter(
       entry => entry.reason !== 'auto-generated'
   );
   
   if (userChanges.length === 0) {
       // Reset lastChangedAt - allow change
       return { allowed: true };
   }
   ```

2. **First change always allowed**
   - If `lastChangedAt` is `null`, change is always allowed

3. **Auto-generated name history**
   - System tracks `reason: 'auto-generated' | 'user-changed' | 'regenerated'`
   - **CRITICAL: Auto-generated names don't count toward quota**
   - **Quota is only hit when name is SAVED** (not during generation)
   - Only `'user-changed'` counts toward the limit (when saved)
   - `'regenerated'` also counts when saved (user-initiated regeneration)

### Usage in Endpoints 🛣️

#### Update Display Name
**Location:** `serverless/otp-auth-service/handlers/user/displayName.ts:154-165`

```typescript
const canChange = await canChangeDisplayName(auth.userId!, auth.customerId, env);
if (!canChange.allowed) {
    return new Response(JSON.stringify({ 
        error: 'Display name change limit exceeded',
        detail: canChange.reason,
        nextChangeDate: canChange.nextChangeDate
    }), {
        status: 429, // Too Many Requests
    });
}
```

#### Regenerate Display Name
**Location:** `serverless/otp-auth-service/handlers/user/displayName.ts:259-270`

```typescript
const canChange = await canChangeDisplayName(auth.userId!, auth.customerId, env);
if (!canChange.allowed) {
    return new Response(JSON.stringify({ 
        error: 'Display name change limit exceeded',
        detail: canChange.reason,
        nextChangeDate: canChange.nextChangeDate
    }), {
        status: 429, // Too Many Requests
    });
}
```

**Note:** Regeneration also enforces the 30-day limit, but uses `reason: 'regenerated'` which counts toward the limit.

---

## 4. End-to-End Flow Analysis 🔄

### Customer Account Creation Flow

1. **Trigger:** User authenticates via OTP
2. **Location:** `serverless/otp-auth-service/handlers/auth/customer-creation.ts`
3. **Process:**
   - Generate unique display name (scoped to customerId)
   - Reserve the display name
   - Create customer account with display name
4. **Uniqueness:** ✓ Enforced per customer
5. **Change limit:** ✗ Not applicable (initial creation)

### User Account Creation Flow

1. **Trigger:** User verifies OTP
2. **Location:** `serverless/otp-auth-service/handlers/auth/otp.js`
3. **Process:**
   - Generate unique display name (scoped to customerId)
   - Reserve the display name
   - Create user account with display name
4. **Uniqueness:** ✓ Enforced per customer
5. **Change limit:** ✗ Not applicable (initial creation)

### Display Name Update Flow

1. **Trigger:** User requests display name change
2. **Location:** `serverless/otp-auth-service/handlers/user/displayName.ts:119-243`
3. **Process:**
   - Validate format
   - **Check 30-day limit** ✓
   - **Check uniqueness (per customer)** ✓
   - Release old display name
   - Reserve new display name
   - Update user preferences (tracks history)
4. **Uniqueness:** ✓ Enforced per customer
5. **Change limit:** ✓ 30 days enforced

### Display Name Regeneration Flow

1. **Trigger:** User requests display name regeneration
2. **Location:** `serverless/otp-auth-service/handlers/user/displayName.ts:249-345`
3. **Process:**
   - **Check 30-day limit** ✓
   - Generate new unique display name (scoped to customerId)
   - Release old display name
   - Reserve new display name
   - Update user preferences (tracks history with `reason: 'regenerated'`)
4. **Uniqueness:** ✓ Enforced per customer
5. **Change limit:** ✓ 30 days enforced

---

## 5. Potential Issues & Recommendations 🚨

### Issue 1: Per-Customer Uniqueness (Not Global)

**Current Behavior:**
- Display names are unique **within a customer**, not globally
- Different customers can have identical display names

**Impact:**
- If display names are used for cross-customer identification, this could cause confusion
- If display names are used in global contexts (e.g., public profiles), duplicates are possible

**Recommendation:**
- **If global uniqueness is required:** Modify `isNameUnique` to always use global scope
- **If per-customer uniqueness is intentional:** Document this behavior clearly
- **Consider:** Adding a configuration option to choose between global and per-customer uniqueness

### Issue 2: Change Limit Applies to Regeneration

**Current Behavior:**
- Regenerating a display name counts toward the 30-day limit
- Only auto-generated names (during account creation) bypass the limit

**Impact:**
- Users who regenerate their name must wait 30 days before changing again
- This may be intentional to prevent abuse

**Recommendation:**
- **If intentional:** Document this behavior
- **If regeneration should bypass limit:** Modify `canChangeDisplayName` to allow regeneration without limit

### Issue 3: Missing Option in Customer Creation

**Location:** `serverless/otp-auth-service/handlers/auth/customer-creation.ts:217`

```typescript
const customerDisplayName = await generateUniqueDisplayName({
    customerId: resolvedCustomerId,
    maxAttempts: 10,
    includeNumber: true  // ✗ This option doesn't exist!
}, env);
```

**Issue:** `includeNumber` option is referenced but doesn't exist in `NameGeneratorOptions`

**Recommendation:**
- Remove the `includeNumber: true` option (it's not used anyway - numbers are not allowed in display names)

### Issue 4: Final Fallback Must Continue Generation

**Location:** `serverless/otp-auth-service/services/nameGenerator.ts:501-511`

**CRITICAL REQUIREMENT:** No fallback name returns - must continue generation until unique

**Current Problem:**
```typescript
// Final fallback: Returns name without uniqueness check
return finalWords.join(' ');  // ✗ WRONG - no uniqueness check!
```

**Required Fix:**
```typescript
// Must continue generation loop until unique
// Never return a name without uniqueness verification
while (true) {
  name = generateNamePattern(...);
  if (await isNameUnique(name, null, env)) {  // Global uniqueness
    return name;
  }
  // Continue generating - no fallback return
}
```

**UI Requirements:**
- If initial generation fails (collision), show message: "Initial name generation failed. Continuing to ensure uniqueness..."
- Update UI to show generation progress if it takes longer than expected
- Never show a name to user until it's verified unique
- If generation returns empty string (50 retries failed), show error: "Unable to generate unique display name. Please try again or contact support."

---

## 6. Summary Table 📊

| Aspect | Status | Details |
|--------|--------|---------|
| **Uniqueness Scope** | ⚠ Per-Customer | Not globally unique |
| **Change Interval** | ✓ 30 Days | Once per month |
| **Auto-Generated Bypass** | ✓ Yes | Auto-generated names don't count |
| **Regeneration Limit** | ✓ Yes | Regeneration counts toward limit |
| **Reservation System** | ✓ Implemented | KV storage with 1-year TTL |
| **Release on Change** | ✓ Implemented | Old name released when changed |
| **History Tracking** | ✓ Implemented | Tracks previous names with reasons |
| **End-to-End Usage** | ✓ Consistent | Used consistently across codebase |

---

## 7. Code Locations Reference 📍

### Core Implementation
- **Name Generator:** `serverless/otp-auth-service/services/nameGenerator.ts`
- **User Preferences:** `serverless/otp-auth-service/services/user-preferences.ts`
- **Display Name Handler:** `serverless/otp-auth-service/handlers/user/displayName.ts`

### Usage Points
- **Customer Creation:** `serverless/otp-auth-service/handlers/auth/customer-creation.ts:213-221`
- **User Creation:** `serverless/otp-auth-service/handlers/auth/otp.js:761-769`
- **Customer API:** `serverless/customer-api/handlers/customer.ts:175-181`

### Constants
- **Display Name Constants:** `shared-config/display-name-constants.ts`
  - `DISPLAY_NAME_MIN_LENGTH = 3`
  - `DISPLAY_NAME_MAX_LENGTH = 50`
  - `DISPLAY_NAME_MAX_WORDS = 8`

---

## Conclusion 🎯

The display name generation system is **well-implemented** with proper uniqueness checking and change interval enforcement. The main consideration is whether **per-customer uniqueness** (current behavior) or **global uniqueness** is the desired behavior for your use case.

**Key Takeaways:**
1. ⚠ **REQUIRED:** Uniqueness MUST be globally enforced (currently per-customer)
2. ✓ Change interval is 30 days (once per month)
3. ✓ Auto-generated names don't count (only count on save)
4. ⚠ **REQUIRED:** No fallback returns - must continue generation until unique
5. ⚠ **REQUIRED:** Display name release only on user change or account deletion
6. ⚠ **REQUIRED:** Remove includeNumber completely
7. ✓ Customer IDs must be globally unique (verify collision probability)

---

*Audit completed by codebase analysis* 🧙‍♂️⚓
