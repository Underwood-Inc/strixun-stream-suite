# OTP Auth Service SDK

**Last Updated:** 2025-12-29

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
  apiKey: 'otp_live_sk_...',
  baseUrl: 'https://your-worker.workers.dev' // optional
});

// Request OTP
const result = await client.requestOTP('user@example.com');
console.log('OTP sent:', result);

// Verify OTP
const auth = await client.verifyOTP('user@example.com', '123456');
console.log('Token:', auth.token);

// Get user info
const user = await client.getMe(auth.token);
console.log('User:', user);

// Logout
await client.logout(auth.token);
```

## API Reference

See the TypeScript definitions in `index.ts` for full API documentation.

