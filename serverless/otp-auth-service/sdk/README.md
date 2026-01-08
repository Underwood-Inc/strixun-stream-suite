# OTP Auth Service SDK

TypeScript/JavaScript SDK for the OTP Authentication Service.

## Installation

```bash
npm install @otpauth/sdk
# or
yarn add @otpauth/sdk
```

## Usage

```typescript
import { OTPAuth } from '@otpauth/sdk';

const client = new OTPAuth({
  apiKey: 'otp_live_sk_...',  // API key for tenant identification (NOT user authorization)
  baseUrl: 'https://your-worker.workers.dev' // optional
});

// Request OTP (uses API key for tenant identification)
const result = await client.requestOTP('user@example.com');
console.log('OTP sent:', result);

// Verify OTP (uses API key for tenant identification, returns JWT token)
const auth = await client.verifyOTP('user@example.com', '123456');
console.log('Token:', auth.token);  // This is a JWT token, NOT the API key

// Get user info (uses JWT token for authentication)
const customer = await client.getMe(auth.token);
console.log('User:', user);

// Logout (uses JWT token for authentication)
await client.logout(auth.token);
```

## Important: API Keys vs JWT Tokens

The SDK handles two types of credentials with distinct purposes:

### API Keys (`otp_live_sk_...`)
- **Purpose**: Tenant identification and configuration
- **Header**: `X-OTP-API-Key`
- **Used for**: Identifying which customer tenant (subscription tiers, rate limiting, entity separation)
- **Set once**: Configured when creating the SDK client instance
- **Usage**: Automatically included by the SDK in `requestOTP()` and `verifyOTP()` calls

### JWT Tokens
- **Purpose**: User authentication and authorization
- **Header**: `Authorization: Bearer <token>`
- **Used for**: Security, encryption, session management
- **Dynamic**: Obtained from `verifyOTP()`, expires after 7 hours
- **Usage**: Required for `getMe()`, `logout()`, and `refreshToken()` calls

**CRITICAL:** API keys do NOT replace JWT tokens - they serve completely different purposes and are used together but separately.

## API Reference

See the TypeScript definitions in `index.ts` for full API documentation.

