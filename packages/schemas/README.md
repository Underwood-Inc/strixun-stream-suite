# @strixun/schemas

Centralized validation schemas for Strixun services using [Valibot](https://valibot.dev/).

## Why Valibot?

- **Tiny Bundle:** ~600 bytes (vs 14KB for Zod)
- **Edge-Optimized:** Designed for Cloudflare Workers/Vercel Edge
- **Fast:** Best runtime performance
- **Tree-Shakeable:** Only bundle what you use
- **Type-Safe:** Full TypeScript type inference

## Installation

```bash
pnpm add @strixun/schemas
```

## Usage

### Customer Schemas

```typescript
import { CustomerDataSchema, CustomerPreferencesSchema } from '@strixun/schemas/customer';
import * as v from 'valibot';

// Validate customer data
const result = v.safeParse(CustomerDataSchema, customerData);
if (result.success) {
  console.log('Valid customer:', result.output);
} else {
  console.error('Validation errors:', result.issues);
}
```

### Auth Schemas

```typescript
import { CustomerSessionSchema, OTPTokenSchema } from '@strixun/schemas/auth';
import * as v from 'valibot';

// Validate session data
const result = v.safeParse(CustomerSessionSchema, sessionData);
```

## Architecture

### Customer Data (`CUSTOMER_KV`)
- `CustomerDataSchema` - Complete customer profile
- `CustomerPreferencesSchema` - User preferences
- `DisplayNamePreferencesSchema` - Display name history

### Auth Data (`OTP_AUTH_KV`)
- `CustomerSessionSchema` - Minimal session data
- `OTPTokenSchema` - Temporary OTP codes
- `RateLimitDataSchema` - Rate limiting

## Schemas

### Customer

- `CustomerDataSchema` - Full customer data
- `CustomerPreferencesSchema` - Preferences
- `CustomerCreateRequestSchema` - Create customer
- `CustomerUpdateRequestSchema` - Update customer
- `DisplayNameUpdateRequestSchema` - Update display name

### Auth

- `CustomerSessionSchema` - Session data
- `OTPTokenSchema` - OTP token
- `OTPVerifyRequestSchema` - Verify OTP
- `APIKeyDataSchema` - API key data
- `JWTPayloadSchema` - JWT claims

## Type Exports

All schemas include TypeScript type exports:

```typescript
import type { CustomerData, CustomerPreferences } from '@strixun/schemas/customer';
import type { CustomerSession, OTPToken } from '@strixun/schemas/auth';
```
