# Shared Configuration

This directory contains centralized configuration that is shared across all applications in the workspace.

## Encryption

All encryption uses **JWT tokens** (per-user, per-session) via `@strixun/api-framework`:

```typescript
import { encryptWithJWT, decryptWithJWT } from '@strixun/api-framework';

// Client-side: Encrypt with user's JWT token
const encrypted = await encryptWithJWT(data, jwtToken);

// Server-side: Decrypt with same JWT token
const decrypted = await decryptWithJWT(encrypted, jwtToken);
```

See `packages/api-framework/encryption/` for implementation details.

