# Enhanced API Framework - Examples

Examples of how to use the enhanced API framework in Cloudflare Workers.

## OTP Auth Service Integration

See `otp-auth-integration.ts` for a complete example of integrating the enhanced framework with an OTP Auth service.

### Key Features Demonstrated

1. **Type Definitions** - Define response types with required/optional fields
2. **Type Registry** - Centralized type management
3. **Enhanced Handlers** - Server-side request handlers with automatic root config
4. **Response Filtering** - Opt-in field filtering
5. **Error Handling** - RFC 7807 error format

### Usage

```typescript
import { registerOTPAuthTypes, handleOTPRequest } from './otp-auth-integration';

// Register types (do this once at startup)
registerOTPAuthTypes();

// Use handlers in your Worker
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    if (request.url.includes('/auth/request-otp')) {
      return handleOTPRequest(request, env, ctx);
    }
    // ...
  },
};
```

### Response Filtering Example

```typescript
// Client request with filtering
GET /auth/verify-otp?include=access_token,userId&tags=summary

// Response automatically includes:
// - Root config: id, customerId
// - Requested fields: access_token, userId
// - Tag fields: (from 'summary' tag)
```

### Metric Computation Example

```typescript
// Request with metrics
GET /customer?metrics=isActive,isPremium

// Response includes computed metrics:
{
  "id": "...",
  "customerId": "...",
  "name": "John Doe",
  "status": "active",
  "isActive": true,  // Computed metric
  "isPremium": false // Computed metric
}
```

