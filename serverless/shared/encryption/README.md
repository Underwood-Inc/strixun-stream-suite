# 🔒 Shared Encryption Suite

Unified encryption utilities for all Strixun Stream Suite services.

## Features

- ✅ **Universal JWT Encryption** - Works in Cloudflare Workers and browser
- ✅ **Multi-Stage Encryption** - Support for 2+ parties (all keys required to decrypt)
- ✅ **Two-Stage Encryption** - Backward compatible with existing two-stage implementation
- ✅ **Router Middleware** - Automatic response encryption for API routes
- ✅ **TypeScript First** - Full type safety throughout

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

// Decrypt (requires ALL parties' keys in same order)
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

Multi-stage encryption chains encryption layers where each party adds a layer:

```
Data → [Party1 Encrypt] → [Party2 Encrypt] → [Party3 Encrypt] → Encrypted
```

To decrypt, you need ALL parties' keys in reverse order:

```
Encrypted → [Party3 Decrypt] → [Party2 Decrypt] → [Party1 Decrypt] → Data
```

**Key Points:**
- All parties must be known at encryption time
- All parties' keys are required for decryption
- Order matters: encryption order is reversed for decryption
- Each party can use JWT token, request key, or custom key

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
Decrypts multi-stage encrypted data (requires all parties' keys).

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

// All three parties must provide keys to decrypt
const decrypted = await decryptMultiStage(encrypted, [
  { id: 'owner', key: ownerJWT, keyType: 'jwt' },
  { id: 'requester', key: requesterJWT, keyType: 'jwt' },
  { id: 'auditor', key: auditorKey, keyType: 'custom' },
]);
```

## License

Part of Strixun Stream Suite - Internal use only.

