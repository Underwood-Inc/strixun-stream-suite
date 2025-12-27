# Enhanced API Framework Architecture Proposal
## Cloudflare Workers-First, Composable, End-to-End Encrypted API Framework

> **Comprehensive architecture for a production-grade, secure, composable API framework designed PRIMARILY for Cloudflare Workers with E2E encryption, response filtering, and type-based response building**
>
> **Platform Support:**
> - **PRIMARY**: Cloudflare Workers (serverless edge computing) - All features designed for Workers first
> - **SECONDARY**: Browser (client-side dashboard/static sites served by Cloudflare Pages)
> - **OPTIONAL**: Node.js (local development/testing only, not required for production)

---

## Executive Summary

This document proposes an enhanced architecture for the existing API framework (`src/core/api/`) that:
- **Extends** the current framework (doesn't replace it)
- **Unifies** all Cloudflare Workers (OTP Auth, URL Shortener, Chat Signaling, Notes)
- **Adds** end-to-end encryption (JWT-based, only email holder can decrypt)
- **Implements** robust response filtering with opt-in tag system
- **Provides** type-based response building with automatic metric inclusion
- **Ensures** flawless error handling on every request
- **Maintains** backward compatibility with existing implementations

---

## Table of Contents

1. [Current State Audit](#current-state-audit)
2. [Feature Parity Analysis](#feature-parity-analysis)
3. [Enhanced Architecture Overview](#enhanced-architecture-overview)
4. [Core Components](#core-components)
5. [Implementation Details](#implementation-details)
6. [Migration Strategy](#migration-strategy)
7. [Security Considerations](#security-considerations)

---

## Current State Audit

### Existing API Framework (`src/core/api/`)

**✅ What We Have:**
- Middleware pipeline system
- Request/response transformation
- Caching (memory + IndexedDB)
- Retry logic with exponential backoff
- Circuit breaker
- Request deduplication
- Request queuing with priorities
- Offline queue
- Optimistic updates
- WebSocket support
- Plugin system
- Error handling middleware
- Auth middleware

**❌ What's Missing:**
- End-to-end encryption integration
- Response filtering/tagging system
- Type-based response building
- Automatic metric inclusion
- RFC 7807 error format support
- Cloudflare Worker compatibility layer
- Response field filtering (opt-in/opt-out)

### Current Cloudflare Worker Implementations

#### OTP Auth Service
- ✅ JWT-based E2E encryption (`utils/jwt-encryption.js`)
- ✅ RFC 7807 error responses
- ✅ Custom API client with decryption
- ✅ Rate limiting with detailed error info
- ❌ Not using framework

#### URL Shortener
- ✅ JWT verification
- ✅ CORS handling
- ✅ Custom error handling
- ❌ Not using framework
- ❌ No E2E encryption
- ❌ No standardized errors

#### Chat Signaling
- ✅ JWT verification
- ✅ CORS handling
- ✅ WebSocket support
- ❌ Not using framework
- ❌ No E2E encryption
- ❌ No standardized errors

---

## Feature Parity Analysis

### Required Features Across All Services

| Feature | OTP Auth | URL Shortener | Chat Signaling | Framework Has? |
|---------|----------|---------------|----------------|----------------|
| JWT Auth | ✅ | ✅ | ✅ | ✅ (middleware) |
| E2E Encryption | ✅ | ❌ | ❌ | ❌ |
| RFC 7807 Errors | ✅ | ❌ | ❌ | ❌ |
| Rate Limiting | ✅ | ❌ | ❌ | ❌ |
| CORS | ✅ | ✅ | ✅ | ❌ (needs worker layer) |
| Response Filtering | ❌ | ❌ | ❌ | ❌ |
| Type-based Responses | ❌ | ❌ | ❌ | ❌ |
| Metric Tagging | ❌ | ❌ | ❌ | ❌ |
| Error Legend Integration | ✅ (partial) | ❌ | ❌ | ❌ |

---

## Enhanced Architecture Overview

### Core Principles

1. **Cloudflare Workers First**: Designed primarily for Cloudflare Workers (serverless edge computing)
2. **Browser Compatible**: Client-side usage supported (dashboard, static sites)
3. **Composable**: All features are opt-in and composable
2. **Opt-in Everything**: All features are opt-in, no forced behavior
3. **Type-Safe**: Full TypeScript support with automatic type inference
4. **Security First**: E2E encryption, secure defaults, no data leakage
5. **Backward Compatible**: Existing code continues to work

### Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│              Application Layer (Services)               │
│  OTP Auth | URL Shortener | Chat Signaling | Notes     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│            Enhanced API Framework Layer                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ E2E Encrypt  │  │   Filter     │  │   Builder    │ │
│  │  Middleware  │  │  Middleware  │  │  Middleware  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Error Legend │  │   Metrics    │  │     Tags     │ │
│  │  Integration │  │   System     │  │    System    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│            Existing Framework Core                      │
│  Middleware Pipeline | Cache | Retry | Circuit Breaker │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│         Platform Abstraction Layer                      │
│  PRIMARY: Cloudflare Workers (serverless edge)          │
│  SECONDARY: Browser (client-side dashboard/static)      │
│  NOTE: Node.js support is optional/development only     │
└─────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. End-to-End Encryption Middleware

**Purpose**: Encrypt all responses using JWT token (only email holder can decrypt)

**Implementation**:
```typescript
interface E2EEncryptionConfig {
  enabled: boolean;
  tokenGetter: () => string | null | Promise<string | null>;
  algorithm?: 'AES-GCM-256';
  encryptCondition?: (request: APIRequest, response: APIResponse) => boolean;
}

// Middleware automatically:
// 1. Detects JWT token in request
// 2. Encrypts response data using JWT as key derivation source
// 3. Adds X-Encrypted: true header
// 4. Client automatically decrypts using same JWT
```

**Security**:
- Uses existing `jwt-encryption.js` logic
- PBKDF2 key derivation from JWT (100,000 iterations)
- AES-GCM-256 encryption
- Random salt and IV per encryption
- Token hash verification

### 2. Response Filtering & Tag System

**Purpose**: Opt-in/opt-out of response fields via query parameters or headers

**Implementation**:
```typescript
interface ResponseFilterConfig {
  // Root-level config: always include these fields
  alwaysInclude: string[]; // ['id', 'customerId']
  
  // Type definitions for automatic filtering
  typeDefinitions: Map<string, TypeDefinition>;
  
  // Tag system for ad-hoc filtering
  tags: {
    [tag: string]: string[]; // Tag -> field paths
  };
}

interface TypeDefinition {
  required: string[]; // Always included
  optional: string[]; // Included only if requested
  metrics: {
    [metric: string]: {
      required: boolean;
      compute: (data: any) => any;
    };
  };
}

// Usage:
// GET /api/customers/me?include=analytics,usage&tags=summary
// Automatically filters response based on type definition
```

**Example**:
```typescript
interface CustomerResponse {
  id: string;              // Always included
  customerId: string;      // Always included
  name?: string;           // Optional, include if requested
  email?: string;          // Optional
  analytics?: Analytics;   // Optional metric
  usage?: Usage;           // Optional metric
}

// Request: ?include=name,analytics
// Response: { id, customerId, name, analytics }
// (email and usage excluded)
```

### 3. Type-Based Response Builder with Root Config Enforcement

**Purpose**: Automatically build responses from TypeScript interfaces with compile-time root config enforcement

**Key Innovation**: Use TypeScript's type system to enforce root config at compile-time, ensuring all responses automatically include required fields without runtime checks.

**Implementation**:
```typescript
// Root config type definition (enforced at compile-time)
interface RootResponseConfig {
  id: string;              // Always included in ALL responses
  customerId: string;      // Always included in ALL responses
  // Add more root fields as needed
}

// Type utility to merge root config with any response type
type WithRootConfig<T> = RootResponseConfig & T;

// Example: User-defined response type
interface CustomerResponse {
  name?: string;          // Optional - include if requested
  email?: string;         // Optional - include if requested
  analytics?: Analytics;  // Optional metric - compute if requested
}

// TypeScript automatically enforces that CustomerResponse includes root fields
// The actual type becomes: RootResponseConfig & CustomerResponse
// Which means: { id: string, customerId: string, name?: string, ... }

// Configuration (runtime + compile-time)
interface ResponseBuilderConfig {
  // Root config type (compile-time enforcement)
  rootConfigType: typeof RootResponseConfig; // Type reference
  
  // Root config runtime values (for filtering logic)
  rootConfig: {
    alwaysInclude: (keyof RootResponseConfig)[]; // ['id', 'customerId']
    defaultInclude?: string[]; // Default optional fields
  };
  
  // Per-endpoint configs (inherit from root)
  endpoints: {
    [endpoint: string]: {
      type: string; // TypeScript type name
      inherit?: boolean; // Inherit root config (default: true)
      alwaysInclude?: string[]; // Override root (rarely needed)
      metrics?: string[]; // Metrics to compute
    };
  };
}

// Automatic behavior:
// 1. TypeScript enforces root config at compile-time
// 2. All response types automatically include root fields
// 3. Runtime filtering respects type definitions
// 4. No need to check root config - it's in the type signature
// 5. Inheritance: endpoint config inherits from root (automatic via types)
```

**Benefits**:
- ✅ **Compile-time safety**: TypeScript ensures all responses have root fields
- ✅ **No runtime checks needed**: Type system enforces it
- ✅ **Automatic**: All response types automatically include root config
- ✅ **Type inference**: IDE autocomplete shows root fields in all responses
- ✅ **Refactoring safe**: Changing root config updates all types automatically

**Example with Type Enforcement**:
```typescript
// 1. Define root config type (ONCE, applies to ALL responses)
interface RootResponseConfig {
  id: string;
  customerId: string;
}

// 2. Define your endpoint response type (root fields NOT needed - auto-added)
interface CustomerResponse {
  name?: string;          // Optional - include if requested
  email?: string;         // Optional - include if requested
  analytics?: Analytics;  // Optional metric - compute if requested
}

// 3. TypeScript automatically enforces root config
// Actual type: RootResponseConfig & CustomerResponse
// Which means: { id: string, customerId: string, name?: string, ... }

// 4. Configuration
const config: ResponseBuilderConfig = {
  rootConfigType: RootResponseConfig, // Type reference for compile-time
  rootConfig: {
    alwaysInclude: ['id', 'customerId'], // Runtime filtering
    defaultInclude: ['name'], // Include by default
  },
  endpoints: {
    '/api/customers/me': {
      type: 'CustomerResponse', // Automatically includes root config
      inherit: true, // Default - inherits root config
    },
  },
};

// 5. Usage - TypeScript ensures root fields are always present
// Request: GET /api/customers/me
// Response type: RootResponseConfig & CustomerResponse
// Response value: { id: string, customerId: string, name: string }
//                 ↑ Root fields automatically included

// Request: GET /api/customers/me?exclude=name&include=analytics
// Response type: RootResponseConfig & CustomerResponse
// Response value: { id: string, customerId: string, analytics: Analytics }
//                 ↑ Root fields always included, name excluded, analytics computed
```

**Type Utility for Automatic Merging**:
```typescript
// Utility type to automatically merge root config
type APIResponse<T> = RootResponseConfig & T;

// Usage in endpoint definitions
interface GetCustomerResponse {
  name?: string;
  email?: string;
}

// TypeScript automatically enforces:
// GetCustomerResponse must be: APIResponse<GetCustomerResponse>
// Which expands to: RootResponseConfig & GetCustomerResponse
// Result: { id: string, customerId: string, name?: string, email?: string }

// All responses automatically have root fields - no manual work needed!
```

### 4. Error Handling Integration

**Purpose**: Native RFC 7807 error format with error legend integration

**Implementation**:
```typescript
interface ErrorHandlingConfig {
  // Use error legend system
  useErrorLegend: boolean;
  errorLegendPath?: string; // Path to error-legend.ts
  
  // RFC 7807 format
  rfc7807: boolean;
  
  // Automatic error mapping
  errorMappers: {
    [errorCode: string]: (error: any) => RFC7807Error;
  };
}

// Every error automatically:
// 1. Converted to RFC 7807 format
// 2. Mapped to error legend
// 3. Includes detailed information
// 4. Includes rate limit details if applicable
```

### 5. Metrics System

**Purpose**: Automatic metric computation and inclusion

**Implementation**:
```typescript
interface MetricDefinition {
  name: string;
  required: boolean; // If true, always computed
  compute: (data: any, context: RequestContext) => any | Promise<any>;
  cache?: {
    ttl: number;
    key: (data: any) => string;
  };
}

// Metrics are:
// 1. Computed on-demand (if requested)
// 2. Cached if configured
// 3. Tagged for filtering
// 4. Can be required (always computed) or optional
```

### 6. Cloudflare Worker Compatibility Layer

**Purpose**: Make framework work seamlessly in Cloudflare Workers (PRIMARY TARGET)

**Important Notes**:
- **Cloudflare Workers is the PRIMARY target** - all features designed for Workers first
- **Browser support** is for client-side usage (dashboard, static sites served by Cloudflare Pages)
- **Node.js support** is optional/for local development only
- Uses **Web Standard APIs** only (no Node.js-specific APIs)
- **Storage**: Uses Cloudflare KV in Workers, IndexedDB only in browser (client-side)

**Implementation**:
```typescript
interface WorkerAdapter {
  // Cloudflare Worker environment (PRIMARY)
  env: {
    // KV namespaces for caching/storage
    CACHE_KV?: KVNamespace;
    SESSION_KV?: KVNamespace;
    
    // Durable Objects (if needed)
    SESSION_DO?: DurableObjectNamespace;
    
    // Environment variables
    [key: string]: any;
  };
  
  // Web Standard APIs (available in Workers)
  fetch: typeof fetch; // Web Standard
  crypto: Crypto; // Web Crypto API (available in Workers)
  
  // Request/Response adaptation
  adaptRequest: (request: Request) => APIRequest;
  adaptResponse: (apiResponse: APIResponse) => Response;
  
  // CORS handling (Cloudflare-specific)
  cors: (env: any, request: Request) => Headers;
  
  // Platform detection
  platform: 'cloudflare-worker' | 'browser' | 'node';
}
```

**Storage Strategy**:
- **Cloudflare Workers**: Uses KV namespaces (env.CACHE_KV, etc.)
- **Browser**: Uses IndexedDB (for client-side caching)
- **Node.js**: Uses in-memory cache only (development)

---

## Implementation Details

### File Structure

```
src/core/api/
├── enhanced/                    # New enhanced features
│   ├── encryption/
│   │   ├── jwt-encryption.ts    # E2E encryption middleware
│   │   ├── key-derivation.ts    # PBKDF2 key derivation (Web Crypto API)
│   │   └── index.ts
│   ├── filtering/
│   │   ├── response-filter.ts   # Response filtering middleware
│   │   ├── tag-system.ts        # Tag-based filtering
│   │   ├── type-parser.ts       # TypeScript interface parser
│   │   └── index.ts
│   ├── building/
│   │   ├── response-builder.ts  # Type-based response builder
│   │   ├── metric-computer.ts   # Metric computation
│   │   └── index.ts
│   ├── errors/
│   │   ├── rfc7807.ts           # RFC 7807 error formatter
│   │   ├── legend-integration.ts # Error legend integration
│   │   └── index.ts
│   ├── workers/                 # Cloudflare Workers support (PRIMARY)
│   │   ├── adapter.ts           # Cloudflare Worker adapter
│   │   ├── cors.ts              # CORS handler
│   │   ├── kv-cache.ts          # KV-based caching (replaces IndexedDB in Workers)
│   │   ├── platform.ts          # Platform detection (Worker vs Browser)
│   │   └── index.ts
│   ├── browser/                 # Browser-specific features (client-side)
│   │   ├── indexeddb-cache.ts   # IndexedDB cache (browser only)
│   │   └── index.ts
│   └── index.ts                 # Main export
├── [existing files...]          # Keep all existing framework code
│   ├── cache/
│   │   ├── indexeddb.ts         # Browser-only (will use KV in Workers)
│   │   └── memory.ts            # Works everywhere
│   └── ...
└── types.ts                     # Enhanced with new types
```

**Platform-Specific Notes**:
- **Cloudflare Workers**: Uses KV for caching, Web Crypto API, no IndexedDB
- **Browser**: Uses IndexedDB for caching, Web Crypto API, full DOM access
- **Node.js**: In-memory cache only, Node crypto (development only)

### Type Definitions

```typescript
// Enhanced types.ts additions

export interface E2EEncryptionConfig {
  enabled: boolean;
  tokenGetter: () => string | null | Promise<string | null>;
  algorithm?: 'AES-GCM-256';
  encryptCondition?: (request: APIRequest, response: APIResponse) => boolean;
}

// Root response config type (enforced at compile-time)
export interface RootResponseConfig {
  id: string;
  customerId: string;
  // Add more root fields as needed
}

// Type utility to automatically merge root config with any response
export type APIResponse<T> = RootResponseConfig & T;

// Type utility to extract optional fields from a type
export type OptionalFields<T> = {
  [K in keyof T as T[K] extends Required<T>[K] ? never : K]: T[K];
};

// Type utility to extract required fields from a type
export type RequiredFields<T> = {
  [K in keyof T as T[K] extends Required<T>[K] ? K : never]: T[K];
};

export interface ResponseFilterConfig {
  // Root config type (compile-time enforcement)
  rootConfigType: typeof RootResponseConfig;
  
  // Root config runtime (for filtering logic)
  rootConfig: {
    alwaysInclude: (keyof RootResponseConfig)[]; // Type-safe root fields
    defaultInclude?: string[]; // Default optional fields
  };
  
  // Type definitions (automatically inherit root config via types)
  typeDefinitions: Map<string, TypeDefinition>;
  tags: Record<string, string[]>; // Tag -> field paths
}

export interface TypeDefinition {
  // TypeScript type name (must extend RootResponseConfig)
  typeName: string;
  
  // Required fields (from type signature - no ?)
  required: string[]; // Extracted from TypeScript type
  
  // Optional fields (from type signature - has ?)
  optional: string[]; // Extracted from TypeScript type
  
  // Metrics (computed fields)
  metrics: Record<string, MetricDefinition>;
  
  // Inherit root config (default: true, enforced by type system)
  inherit?: boolean; // Default: true
}

export interface MetricDefinition {
  name: string;
  required: boolean;
  compute: (data: any, context: RequestContext) => any | Promise<any>;
  cache?: {
    ttl: number;
    key: (data: any) => string;
  };
}

export interface RFC7807Error {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  [key: string]: any; // Additional fields (rate_limit_details, etc.)
}

export interface RequestContext {
  request: APIRequest;
  response?: APIResponse;
  user?: {
    id: string;
    customerId: string;
    email: string;
  };
  env?: any; // Cloudflare Worker environment
}

export interface EnhancedAPIClientConfig extends APIClientConfig {
  encryption?: E2EEncryptionConfig;
  filtering?: ResponseFilterConfig;
  errorHandling?: {
    useErrorLegend: boolean;
    rfc7807: boolean;
  };
  worker?: {
    env?: any;
    cors?: boolean;
  };
}
```

### Middleware Integration

```typescript
// Enhanced client automatically sets up middleware in order:

1. Request Transformation (existing)
2. Authentication (existing)
3. E2E Encryption (NEW) - encrypts responses
4. Response Filtering (NEW) - filters response fields
5. Response Building (NEW) - builds from type definitions
6. Metrics Computation (NEW) - computes requested metrics
7. Error Handling (enhanced) - RFC 7807 + error legend
8. Response Transformation (existing)
```

---

## Migration Strategy

### Phase 1: Foundation (Week 1)
1. Create enhanced directory structure
2. Implement E2E encryption middleware
3. Implement Cloudflare Worker adapter
4. Add RFC 7807 error formatter

### Phase 2: Filtering & Building (Week 2)
1. Implement response filtering middleware
2. Implement tag system
3. Implement type parser
4. Implement response builder

### Phase 3: Integration (Week 3)
1. Integrate error legend system
2. Add metrics system
3. Create unified configuration
4. Write comprehensive tests

### Phase 4: Migration (Week 4)
1. Migrate OTP Auth Service (keep existing as fallback)
2. Migrate URL Shortener
3. Migrate Chat Signaling
4. Update documentation

### Phase 5: Optimization (Week 5)
1. Performance optimization
2. Cache optimization
3. Security audit
4. Final testing

---

## Security Considerations

### E2E Encryption
- ✅ JWT token used as key derivation source (only email holder has it)
- ✅ PBKDF2 with 100,000 iterations (resistant to brute force)
- ✅ AES-GCM-256 (authenticated encryption)
- ✅ Random salt and IV per encryption
- ✅ Token hash verification prevents tampering

### Response Filtering
- ✅ Prevents data leakage (only requested fields returned)
- ✅ Type-safe (TypeScript ensures correctness)
- ✅ Opt-in by default (no data unless requested)

### Error Handling
- ✅ No sensitive data in errors
- ✅ RFC 7807 standard format
- ✅ Detailed info only for authenticated users

### Backward Compatibility
- ✅ All existing code continues to work
- ✅ New features are opt-in
- ✅ Gradual migration possible

---

## Example Usage

### Basic Setup (Cloudflare Worker - PRIMARY)

```typescript
// In your Cloudflare Worker (worker.js or worker.ts)
import { createEnhancedAPIClient } from '@/core/api/enhanced';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Create API client for Cloudflare Worker
    const api = createEnhancedAPIClient({
      // No baseURL needed in Workers (same origin)
      
      // E2E Encryption
      encryption: {
        enabled: true,
        tokenGetter: () => {
          // Extract JWT from Authorization header
          const authHeader = request.headers.get('Authorization');
          return authHeader?.replace('Bearer ', '') || null;
        },
      },
      
      // Response Filtering
      filtering: {
        alwaysInclude: ['id', 'customerId'],
        typeDefinitions: new Map([
          ['CustomerResponse', {
            required: ['id', 'customerId'],
            optional: ['name', 'email', 'analytics', 'usage'],
            metrics: {
              analytics: {
                required: false,
                compute: async (data) => await computeAnalytics(data, env),
              },
            },
          }],
        ]),
      },
      
      // Error Handling
      errorHandling: {
        useErrorLegend: true,
        rfc7807: true,
      },
      
      // Cloudflare Worker (PRIMARY TARGET)
      worker: {
        env: env, // Cloudflare Worker environment (KV, Durable Objects, etc.)
        cors: true,
        // Platform auto-detected as 'cloudflare-worker'
        // Uses KV for caching (not IndexedDB)
        // Uses Web Crypto API (available in Workers)
      },
    });
    
    // Use API client to handle requests
    return await api.handleRequest(request);
  },
};
```

### Browser Setup (Client-Side - SECONDARY)

```typescript
// In your browser code (dashboard, static site)
import { createEnhancedAPIClient } from '@/core/api/enhanced';

const api = createEnhancedAPIClient({
  baseURL: 'https://api.example.com', // Your Cloudflare Worker URL
  
  // E2E Encryption
  encryption: {
    enabled: true,
    tokenGetter: () => localStorage.getItem('jwt_token'),
  },
  
  // Response Filtering (same config)
  filtering: {
    alwaysInclude: ['id', 'customerId'],
    // ... same as above
  },
  
  // Error Handling
  errorHandling: {
    useErrorLegend: true,
    rfc7807: true,
  },
  
  // Browser (client-side)
  // Platform auto-detected as 'browser'
  // Uses IndexedDB for caching automatically
  // Uses Web Crypto API (available in browsers)
});
```

**Important Notes:**
- **Cloudflare Workers is PRIMARY** - All features work in Workers
- **Browser support** is for client-side (dashboard, static sites)
- **No Node.js required** - Everything uses Web Standard APIs
- **Storage**: KV in Workers, IndexedDB in browser (automatic)
- **Static files**: Served by Cloudflare Pages (no Node.js needed)

### Making Requests

```typescript
// Automatic E2E encryption, filtering, and error handling
const customer = await api.get('/customers/me', {
  include: ['name', 'analytics'], // Only include these optional fields
  tags: ['summary'], // Include fields tagged as 'summary'
});

// Response automatically:
// 1. Decrypted using JWT
// 2. Filtered to only requested fields
// 3. Analytics metric computed on-demand
// 4. Errors in RFC 7807 format with error legend
```

---

## Next Steps

1. **Review this proposal** - Ensure all requirements are met
2. **Approve architecture** - Get sign-off on approach
3. **Begin Phase 1** - Start implementation
4. **Iterate** - Continuous feedback and improvement

---

## Questions & Considerations

### Open Questions
1. Should metrics be cached by default?
2. What's the default behavior for optional fields? (include or exclude)
3. Should filtering work on nested objects?
4. How deep should type inheritance go?

### Performance Considerations
1. Type parsing happens at startup (cached)
2. Metric computation is async and can be cached
3. Filtering is synchronous (fast)
4. Encryption adds ~10-50ms per response

### Edge Cases
1. What if JWT token expires during request?
2. What if type definition doesn't match actual data?
3. What if metric computation fails?
4. What if filtering removes all fields?

---

**End of Proposal**

