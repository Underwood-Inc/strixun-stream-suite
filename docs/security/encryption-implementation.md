# [EMOJI] Shared Encryption Suite

Unified encryption utilities for all Strixun Stream Suite services.

## Features

- [OK] **Universal JWT Encryption** - Works in Cloudflare Workers and browser
- [OK] **Multi-Stage Encryption** - Support for 2+ parties (all keys required to decrypt)
- [OK] **Two-Stage Encryption** - Backward compatible with existing two-stage implementation
- [OK] **Router Middleware** - Automatic response encryption for API routes
- [OK] **TypeScript First** - Full type safety throughout

## Installation

This package is part of the pnpm workspace and is automatically available to all packages.

## Usage

### Basic JWT Encryption

```typescript
import { encryptWithJWT, decryptWithJWT } from '@strixun/shared-utils/encryption';

// Encrypt data
const encrypted = await encryptWithJWT({ secret: 'data' }, jwtToken);

// Decrypt data
const decrypted = await decryptWithJWT(encrypted, jwtToken);
```

### Two-Stage Encryption (2 Parties)

```typescript
import { encryptTwoStage, decryptTwoStage } from '@strixun/shared-utils/encryption';

// Encrypt with owner's JWT + request key
const encrypted = await encryptTwoStage(
  { email: 'user@example.com' },
  ownerJWT,
  requestKey
);

// Decrypt (requires both keys)
const decrypted = await decryptTwoStage(encrypted, ownerJWT, requestKey);
```

### Multi-Stage Encryption (N Parties)

```typescript
import { encryptMultiStage, decryptMultiStage } from '@strixun/shared-utils/encryption';
import type { EncryptionParty } from '@strixun/shared-utils/encryption';

// Encrypt with multiple parties
const parties: EncryptionParty[] = [
  { id: 'owner', key: ownerJWT, keyType: 'jwt', label: 'Data Owner' },
  { id: 'requester', key: requesterJWT, keyType: 'jwt', label: 'Requester' },
  { id: 'auditor', key: auditorKey, keyType: 'custom', label: 'Auditor' },
];

const encrypted = await encryptMultiStage({ sensitive: 'data' }, parties);

// Decrypt (requires ALL parties' keys - order does NOT matter!)
const decrypted = await decryptMultiStage(encrypted, parties);
```

### Router Middleware

```typescript
import { wrapWithEncryption } from '@strixun/shared-utils/encryption';

async function handleRoute(
  handler: (req: Request, env: Env, auth: AuthResult) => Promise<Response>,
  request: Request,
  env: Env,
  auth: AuthResult
): Promise<RouteResult> {
  const handlerResponse = await handler(request, env, auth);
  
  // Automatically encrypts if JWT token is present
  return await wrapWithEncryption(handlerResponse, auth);
}
```

## Architecture

### Multi-Stage Encryption

Multi-stage encryption uses a master key approach for order-independent decryption:

```
1. Generate random master key
2. Encrypt data with master key  Encrypted Data
3. Encrypt master key with each party's key independently (parallel)
    Encrypted Master Key 1 (Party1)
    Encrypted Master Key 2 (Party2)
    Encrypted Master Key 3 (Party3)
```

To decrypt, you need ALL parties' keys (order does NOT matter):

```
For each party:
  Encrypted Master Key  [Decrypt with Party's Key]  Master Key (verify all match)
  
Once ALL parties verified:
  Master Key  [Decrypt Data]  Original Data
```

**Important:** ALL parties must successfully decrypt their encrypted master keys before the data can be decrypted. The order in which parties are verified does NOT matter.

**Key Points:**
- All parties must be known at encryption time
- All parties' keys are required for decryption
- **Decryption order: COMPLETELY ORDER-INDEPENDENT** - can decrypt in any order
- Parties can be provided in any order (matched by key hash)
- Each party can use JWT token, request key, or custom key
- Version 3+ uses order-independent architecture (backward compatible with version 2)

### Two-Stage Encryption

Two-stage encryption is a special case of multi-stage with exactly 2 parties:
- **Stage 1**: Encrypted with first party's key (typically data owner's JWT)
- **Stage 2**: Encrypted with second party's key (typically request key)

This is backward compatible with the existing two-stage implementation.

## Security

- **Algorithm**: AES-GCM-256 (authenticated encryption)
- **Key Derivation**: PBKDF2 with SHA-256 (100,000 iterations)
- **Random Salt**: 16 bytes per encryption
- **Random IV**: 12 bytes per encryption
- **Token Verification**: SHA-256 hash of JWT token for verification

## API Reference

### Core Functions

#### `encryptWithJWT(data: unknown, token: string): Promise<EncryptedData>`
Encrypts data using a JWT token.

#### `decryptWithJWT(encryptedData: EncryptedData | unknown, token: string): Promise<unknown>`
Decrypts data using a JWT token.

### Multi-Stage Functions

#### `encryptMultiStage(data: unknown, parties: EncryptionParty[]): Promise<MultiStageEncryptedData>`
Encrypts data with multiple parties (2-10 parties supported).

#### `decryptMultiStage(encryptedData: MultiStageEncryptedData, parties: EncryptionParty[]): Promise<unknown>`
Decrypts multi-stage encrypted data (requires all parties' keys). **Order does NOT matter** - parties can be provided in any order.

#### `encryptTwoStage(data: unknown, userToken: string, requestKey: string): Promise<TwoStageEncryptedData>`
Encrypts data with two-stage encryption (backward compatible).

#### `decryptTwoStage(encryptedData: TwoStageEncryptedData, userToken: string, requestKey: string): Promise<unknown>`
Decrypts two-stage encrypted data (backward compatible).

#### `generateRequestKey(): string`
Generates a secure random request key.

### Utility Functions

#### `isMultiEncrypted(data: unknown): boolean`
Checks if data is multi-encrypted.

#### `isDoubleEncrypted(data: unknown): boolean`
Checks if data is double-encrypted (two-stage).

### Middleware Functions

#### `wrapWithEncryption(handlerResponse: Response, auth: AuthResult): Promise<RouteResult>`
Automatically encrypts a response if JWT token is present.

#### `createEncryptionWrapper(handler: Function, options?: EncryptionWrapperOptions): Function`
Creates a wrapper function that automatically encrypts handler responses.

## Types

### `EncryptionParty`
```typescript
interface EncryptionParty {
  id: string;                    // Unique identifier
  key: string;                   // Encryption key (JWT, request key, or custom)
  keyType: 'jwt' | 'request-key' | 'custom';
  label?: string;                // Optional label/description
}
```

### `EncryptedData`
```typescript
interface EncryptedData {
  version: number;
  encrypted: boolean;
  algorithm: string;
  iv: string;                    // Base64 encoded
  salt: string;                  // Base64 encoded
  tokenHash?: string;            // SHA-256 hash of JWT token
  data: string;                  // Base64 encoded encrypted data
  timestamp?: string;
}
```

### `MultiStageEncryptedData`
```typescript
interface MultiStageEncryptedData {
  version: number;
  multiEncrypted: boolean;
  stageCount: number;
  stages: Array<{
    stage: number;
    encrypted: boolean;
    algorithm: string;
    iv: string;
    salt: string;
    keyHash: string;
    keyType: 'jwt' | 'request-key' | 'custom';
    data: string;
  }>;
  timestamp: string;
}
```

## Migration Guide

### From Service-Specific Encryption

**Before:**
```typescript
import { encryptWithJWT } from '../utils/jwt-encryption.js';
```

**After:**
```typescript
import { encryptWithJWT } from '@strixun/shared-utils/encryption';
```

### From Two-Stage Encryption

**Before:**
```typescript
import { encryptTwoStage } from '../utils/two-stage-encryption.js';
```

**After:**
```typescript
import { encryptTwoStage } from '@strixun/shared-utils/encryption';
```

The API is backward compatible - no changes needed to function calls.

## Examples

### Example 1: Basic API Route Encryption

```typescript
import { wrapWithEncryption } from '@strixun/shared-utils/encryption';

export async function handleGetCustomer(
  request: Request,
  env: Env,
  auth: AuthResult
): Promise<RouteResult> {
  const customer = await getCustomer(auth.customerId, env);
  const response = new Response(JSON.stringify(customer), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  return await wrapWithEncryption(response, auth);
}
```

### Example 2: Multi-Party Data Sharing

```typescript
import { encryptMultiStage, decryptMultiStage } from '@strixun/shared-utils/encryption';

// Owner shares data with requester and auditor
const encrypted = await encryptMultiStage(sensitiveData, [
  { id: 'owner', key: ownerJWT, keyType: 'jwt' },
  { id: 'requester', key: requesterJWT, keyType: 'jwt' },
  { id: 'auditor', key: auditorKey, keyType: 'custom' },
]);

// All three parties must provide keys to decrypt (order does NOT matter!)
const decrypted = await decryptMultiStage(encrypted, [
  { id: 'auditor', key: auditorKey, keyType: 'custom' },  // Can be first
  { id: 'owner', key: ownerJWT, keyType: 'jwt' },          // Can be second
  { id: 'requester', key: requesterJWT, keyType: 'jwt' },  // Can be third
]);
```

## Testing

Comprehensive unit tests are available in `multi-stage-encryption.test.ts` covering:

- [OK] Order-independent decryption (all order combinations)
- [OK] All parties required verification
- [OK] Missing/wrong key detection
- [OK] Different key types (JWT, request-key, custom)
- [OK] Multi-party scenarios (2-10 parties)
- [OK] Edge cases (empty data, large data, special characters)
- [OK] Security properties (tampering detection, master key verification)
- [OK] Performance benchmarks

### Running Tests

From the `serverless/otp-auth-service` directory:
```bash
# Run all encryption tests (includes shared encryption tests)
pnpm test

# Run only multi-stage encryption tests
pnpm exec vitest run ../shared/encryption/multi-stage-encryption.test.ts

# Run with coverage
pnpm test:coverage
```

The vitest config in `serverless/otp-auth-service/vitest.config.ts` is configured to find tests in both `otp-auth-service` and `shared/encryption` directories using the pattern `../shared/**/*.{test,spec}.{js,ts}`.

Tests are automatically run in CI/CD on push to main/master branches.

## License

Part of Strixun Stream Suite - Internal use only.

