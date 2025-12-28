# API Framework - Type-Based Root Config Enforcement
## Compile-Time Safety for Response Structure

This document demonstrates how the root config is enforced using TypeScript's type system, ensuring all responses automatically include required fields without runtime checks.

---

## The Problem

Without type enforcement:
- [ERROR] Have to manually check root config at runtime
- [ERROR] Easy to forget to include root fields
- [ERROR] No compile-time safety
- [ERROR] Refactoring is error-prone

---

## The Solution: Type-Based Enforcement

With TypeScript type system:
- [SUCCESS] Root config enforced at compile-time
- [SUCCESS] All responses automatically include root fields
- [SUCCESS] TypeScript ensures correctness
- [SUCCESS] IDE autocomplete shows root fields
- [SUCCESS] Refactoring is safe

---

## Implementation

### Step 1: Define Root Config Type (Once)

```typescript
// src/core/api/enhanced/types.ts

/**
 * Root Response Config
 * 
 * All API responses MUST include these fields.
 * Enforced at compile-time via TypeScript.
 */
export interface RootResponseConfig {
  id: string;              // Always included
  customerId: string;      // Always included
  // Add more root fields as needed
}
```

### Step 2: Create Type Utility

```typescript
// src/core/api/enhanced/types.ts

/**
 * Type utility to automatically merge root config with any response type
 * 
 * Usage: APIResponse<YourResponseType>
 * Result: RootResponseConfig & YourResponseType
 */
export type APIResponse<T> = RootResponseConfig & T;

/**
 * Extract optional fields from a type
 */
export type OptionalFields<T> = {
  [K in keyof T as T[K] extends Required<T>[K] ? never : K]: T[K];
};

/**
 * Extract required fields from a type
 */
export type RequiredFields<T> = {
  [K in keyof T as T[K] extends Required<T>[K] ? K : never]: T[K];
};
```

### Step 3: Define Endpoint Response Types

```typescript
// Your endpoint types (root fields NOT needed - auto-added)

interface CustomerResponse {
  name?: string;          // Optional
  email?: string;         // Optional
  companyName?: string;   // Optional
  analytics?: Analytics;  // Optional metric
}

// TypeScript automatically enforces:
// CustomerResponse must be: APIResponse<CustomerResponse>
// Which expands to: RootResponseConfig & CustomerResponse
// Result: { id: string, customerId: string, name?: string, ... }
```

### Step 4: Use in Endpoint Handlers

```typescript
// In your endpoint handler

async function getCustomer(
  request: Request,
  env: Env
): Promise<APIResponse<CustomerResponse>> {
  // TypeScript enforces return type includes RootResponseConfig
  
  const customer = await fetchCustomerFromKV(env);
  
  // Must return root fields (TypeScript error if missing)
  return {
    id: customer.id,                    // [SUCCESS] Required by RootResponseConfig
    customerId: customer.customerId,     // [SUCCESS] Required by RootResponseConfig
    name: customer.name,                 // Optional
    email: customer.email,               // Optional
    // TypeScript error if id or customerId missing!
  };
}
```

### Step 5: Configuration

```typescript
// Framework configuration

const config: ResponseBuilderConfig = {
  rootConfigType: RootResponseConfig, // Type reference
  
  rootConfig: {
    // Runtime filtering (must match RootResponseConfig keys)
    alwaysInclude: ['id', 'customerId'] as (keyof RootResponseConfig)[],
    defaultInclude: ['name'], // Default optional fields
  },
  
  endpoints: {
    '/api/customers/me': {
      typeName: 'CustomerResponse', // Must extend RootResponseConfig
      inherit: true, // Default - root config automatically included
      metrics: {
        analytics: {
          required: false,
          compute: async (data) => await computeAnalytics(data),
        },
      },
    },
  },
};
```

---

## Type Safety Examples

### [SUCCESS] Correct Usage

```typescript
// TypeScript ensures root fields are present
interface MyResponse {
  data: string;
}

// This is correct - root fields automatically included
const response: APIResponse<MyResponse> = {
  id: '123',              // [SUCCESS] From RootResponseConfig
  customerId: 'cust_456',  // [SUCCESS] From RootResponseConfig
  data: 'hello',          // [SUCCESS] From MyResponse
};
```

### [ERROR] TypeScript Error (Missing Root Fields)

```typescript
// TypeScript error: missing 'id' and 'customerId'
const response: APIResponse<MyResponse> = {
  data: 'hello', // [ERROR] Error: Property 'id' is missing
};
```

### [SUCCESS] Automatic Type Inference

```typescript
// Framework automatically infers full type
async function handleRequest(): Promise<APIResponse<CustomerResponse>> {
  // TypeScript knows this must include:
  // - id: string (from RootResponseConfig)
  // - customerId: string (from RootResponseConfig)
  // - name?: string (from CustomerResponse)
  // - email?: string (from CustomerResponse)
  
  return {
    id: 'user_123',
    customerId: 'cust_456',
    name: 'John Doe',
    email: 'john@example.com',
  };
}
```

---

## Runtime Filtering with Type Safety

```typescript
// Request: GET /api/customers/me?include=name,analytics

// Framework automatically:
// 1. Checks type definition for CustomerResponse
// 2. Includes root fields (id, customerId) - always
// 3. Includes requested optional fields (name)
// 4. Computes requested metrics (analytics)
// 5. Excludes non-requested optional fields (email)

// Response:
{
  id: 'user_123',              // [SUCCESS] Always included (root config)
  customerId: 'cust_456',      // [SUCCESS] Always included (root config)
  name: 'John Doe',            // [SUCCESS] Requested optional field
  analytics: { ... },          // [SUCCESS] Requested metric (computed)
  // email excluded (not requested)
}
```

---

## Benefits

### 1. Compile-Time Safety
- TypeScript ensures all responses have root fields
- No runtime checks needed
- Errors caught at compile-time

### 2. Automatic Inheritance
- All response types automatically include root config
- No manual work needed
- Type system enforces it

### 3. IDE Support
- Autocomplete shows root fields in all responses
- Type hints show what's required
- Refactoring is safe

### 4. Refactoring Safety
- Change root config [EMOJI] all types update automatically
- TypeScript errors show what needs updating
- No runtime surprises

### 5. Documentation
- Type signatures document what's always included
- Self-documenting code
- Clear contracts

---

## Advanced: Nested Types

```typescript
// Root config applies to top-level only
interface NestedResponse {
  user: {
    name: string;
    email: string;
  };
  settings: {
    theme: string;
  };
}

// TypeScript enforces:
// APIResponse<NestedResponse> = {
//   id: string,              // [SUCCESS] Root level
//   customerId: string,     // [SUCCESS] Root level
//   user: { ... },          // Nested (no root fields)
//   settings: { ... },      // Nested (no root fields)
// }
```

---

## Migration Example

### Before (Manual Root Config)

```typescript
// [ERROR] Manual root config checking
function buildResponse(data: any) {
  return {
    id: data.id,                    // Manual
    customerId: data.customerId,    // Manual
    ...data,                        // Rest of data
  };
}
```

### After (Type Enforcement)

```typescript
// [SUCCESS] TypeScript enforces root config
function buildResponse<T>(
  data: T
): APIResponse<T> {
  // TypeScript ensures return type includes RootResponseConfig
  // No manual work needed - type system enforces it
  return {
    id: data.id,
    customerId: data.customerId,
    ...data,
  } as APIResponse<T>;
}
```

---

## Summary

**Type-based root config enforcement**:
- [SUCCESS] Defined once in `RootResponseConfig`
- [SUCCESS] Automatically applied to all responses via `APIResponse<T>`
- [SUCCESS] Enforced at compile-time by TypeScript
- [SUCCESS] No runtime checks needed
- [SUCCESS] Refactoring-safe
- [SUCCESS] IDE-friendly

**Result**: All responses automatically include root fields, guaranteed by TypeScript's type system! [TARGET]

---

**End of Example**

