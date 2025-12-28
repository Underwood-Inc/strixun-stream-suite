# OTP Auth Service - Integration Guide

> **Complete integration guide for developers** [DEPLOY]

## Quick Start

### 1. Get Your API Key

Sign up at the service and get your API key:
```bash
curl -X POST https://otp-auth-service.workers.dev/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "companyName": "My Company",
    "password": "secure_password"
  }'
```

Verify your email, then use the returned `apiKey`.

### 2. Install SDK (Optional)

```bash
npm install @otpauth/sdk
```

### 3. Make Your First Request

```typescript
import { OTPAuth } from '@otpauth/sdk';

const client = new OTPAuth({
  apiKey: 'otp_live_sk_...',
  baseUrl: 'https://otp-auth-service.workers.dev'
});

// Request OTP
await client.requestOTP('user@example.com');

// Verify OTP
const auth = await client.verifyOTP('user@example.com', '123456');
console.log('Token:', auth.token);
```

---

## Integration Examples

### React

See `examples/react-example.tsx` for a complete React component.

### Node.js/Express

See `examples/node-example.js` for Express.js integration.

### Svelte

See `examples/svelte-example.svelte` for Svelte integration.

### Python/Flask

See `examples/python-example.py` for Flask integration.

---

## Webhook Integration

### Setting Up Webhooks

```typescript
// Update webhook configuration
const response = await fetch('https://otp-auth-service.workers.dev/admin/config', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    config: {
      webhookConfig: {
        url: 'https://your-app.com/webhooks/otp',
        secret: 'your_webhook_secret',
        events: ['otp.verified', 'user.created', 'quota.exceeded']
      }
    }
  })
});
```

### Verifying Webhook Signatures

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSignature = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// In your webhook handler
app.post('/webhooks/otp', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-otp-signature'];
  const isValid = verifyWebhookSignature(req.body.toString(), signature, WEBHOOK_SECRET);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const event = JSON.parse(req.body.toString());
  // Handle event
  console.log('Event:', event.event, event.data);
  
  res.json({ received: true });
});
```

---

## Custom Email Templates

### Setting Up Custom Templates

```typescript
await fetch('https://otp-auth-service.workers.dev/admin/config/email', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fromEmail: 'noreply@yourdomain.com',
    fromName: 'Your Company',
    subjectTemplate: 'Your {{appName}} Verification Code',
    htmlTemplate: `
      <!DOCTYPE html>
      <html>
      <body>
        <h1>Welcome to {{appName}}</h1>
        <p>Your verification code is: <strong>{{otp}}</strong></p>
        <p>This code expires in {{expiresIn}} minutes.</p>
        <p>{{footerText}}</p>
      </body>
      </html>
    `,
    variables: {
      appName: 'Your App',
      brandColor: '#007bff',
      footerText: '© 2025 Your Company'
    }
  })
});
```

### Available Template Variables

- `{{otp}}` - The 9-digit OTP code
- `{{expiresIn}}` - Expiration time in minutes
- `{{appName}}` - Your app/company name
- `{{userEmail}}` - User's email address
- `{{brandColor}}` - Brand color
- `{{footerText}}` - Footer text
- `{{supportUrl}}` - Support URL
- `{{logoUrl}}` - Logo URL

---

## Domain Verification

### Step 1: Request Verification

```typescript
const response = await fetch('https://otp-auth-service.workers.dev/admin/domains/verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    domain: 'yourdomain.com'
  })
});

const { dnsRecord } = await response.json();
console.log('Add DNS record:', dnsRecord);
```

### Step 2: Add DNS Record

Add a TXT record:
- Name: `_otpauth-verify.yourdomain.com`
- Value: `{verification_token}`

### Step 3: Verify

```typescript
await fetch('https://otp-auth-service.workers.dev/admin/domains/yourdomain.com/verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
});
```

---

## Rate Limiting & Quotas

### Checking Quota Status

Quota information is included in rate limit responses:

```json
{
  "error": "Quota exceeded",
  "reason": "daily_quota_exceeded",
  "quota": {
    "otpRequestsPerDay": 5000,
    "otpRequestsPerMonth": 100000
  },
  "usage": {
    "daily": 5000,
    "monthly": 45000,
    "remainingDaily": 0,
    "remainingMonthly": 55000
  }
}
```

### Headers

Rate limit and quota information is also in response headers:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `X-Quota-Limit`
- `X-Quota-Remaining`

---

## Error Handling

### Common Errors

```typescript
try {
  await client.requestOTP('user@example.com');
} catch (error) {
  if (error.message.includes('Rate limit')) {
    // Handle rate limit
  } else if (error.message.includes('Quota exceeded')) {
    // Handle quota exceeded
  } else if (error.message.includes('Invalid email')) {
    // Handle validation error
  } else {
    // Handle other errors
  }
}
```

### Error Categories

- `validation` - Invalid input
- `authentication` - Auth failures
- `rate_limit` - Rate limit exceeded
- `quota` - Quota exceeded
- `email_delivery` - Email sending failed
- `internal` - Server errors

---

## Security Best Practices

1. **Store API keys securely** - Never commit to git
2. **Use HTTPS** - Always use HTTPS in production
3. **Verify webhook signatures** - Always verify webhook signatures
4. **Rotate API keys regularly** - Use the rotation endpoint
5. **Monitor usage** - Check analytics regularly
6. **Set IP allowlists** - Restrict API access by IP
7. **Use CORS properly** - Configure allowed origins

---

## Testing

### Test Mode

Use test API keys (prefixed with `otp_test_sk_`) for development.

### Health Check

```typescript
const health = await client.health();
console.log('Service status:', health.status);
```

---

## Support

- **Documentation**: See `docs/OTP_AUTH_API_DOCUMENTATION.md`
- **SDK**: See `sdk/README.md`
- **Examples**: See `examples/` directory

---

**Happy integrating!** [EMOJI]

