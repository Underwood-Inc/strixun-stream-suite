# OTP Login E2E Testing Guide

## Overview

This directory contains comprehensive end-to-end tests for the OTP authentication library using Playwright. These tests verify the complete authentication flow from email input to successful login.

## Test Files

### `authentication-flow.e2e.spec.ts`

Comprehensive test suite covering:

- **Email Form Tests**: Input validation, UI display, loading states
- **OTP Request Flow**: Successful OTP requests, form transitions, countdown timers
- **OTP Verification Flow**: OTP input validation, verification process, error handling
- **Error Handling**: Invalid inputs, network failures, rate limiting
- **UI State Management**: Loading states, input enabling/disabling
- **Accessibility**: Labels, keyboard navigation, Enter key submission

## Prerequisites

### 1. OTP Auth Service Deployment

The OTP Auth Service worker must be deployed to the development environment:

```bash
# Deploy all workers to development
pnpm deploy:dev:all
```

### 2. Environment Variables

Set the following environment variables:

```bash
# Test email (must be a real email that can receive OTP codes)
E2E_TEST_EMAIL=test@example.com

# OTP Auth Service URL (defaults to dev URL if not set)
E2E_OTP_AUTH_URL=https://otp-auth-service-dev.strixuns-script-suite.workers.dev

# Frontend URL (defaults to localhost:5173)
E2E_FRONTEND_URL=http://localhost:5173
```

### 3. Test Email Service (Optional but Recommended)

For full end-to-end testing, integrate with a test email service:

- **MailSlurp**: https://www.mailslurp.com/
- **Mailtrap**: https://mailtrap.io/
- **Ethereal Email**: https://ethereal.email/

See `packages/e2e-helpers/helpers.ts` for integration examples.

## Running Tests

### Run All E2E Tests

```bash
# From project root
pnpm test:e2e
```

### Run Only OTP Authentication Tests

```bash
# From project root
npx playwright test packages/otp-login/authentication-flow.e2e.spec.ts
```

### Run in UI Mode

```bash
npx playwright test packages/otp-login/authentication-flow.e2e.spec.ts --ui
```

### Run in Debug Mode

```bash
npx playwright test packages/otp-login/authentication-flow.e2e.spec.ts --debug
```

## Test Structure

### Test Suites

1. **Email Form**: Tests email input field, validation, and submission
2. **OTP Request Flow**: Tests OTP code request and form transitions
3. **OTP Verification Flow**: Tests OTP input, validation, and verification
4. **Error Handling**: Tests error scenarios and user feedback
5. **UI State Management**: Tests loading states and input enabling/disabling
6. **Accessibility**: Tests keyboard navigation and ARIA labels

### Helper Functions

The test suite uses helper functions from `@strixun/e2e-helpers`:

- `requestOTPCode()`: Request OTP for an email
- `verifyOTPCode()`: Verify an OTP code
- `waitForOTPForm()`: Wait for OTP form to appear
- `goBackToEmailForm()`: Navigate back to email form
- `extractOTPFromResponse()`: Extract OTP from API response (dev mode)

## Test Scenarios

### Happy Path

1. User enters valid email
2. User clicks "Send OTP Code"
3. OTP form appears with countdown timer
4. User enters OTP code
5. User clicks "Verify & Login"
6. Authentication succeeds

### Error Scenarios

1. **Invalid Email**: HTML5 validation prevents submission
2. **Network Failure**: Error message displayed
3. **Invalid OTP**: Error message displayed, user can retry
4. **Rate Limiting**: Rate limit error displayed with reset time

### Edge Cases

1. **Loading States**: Inputs disabled during API calls
2. **Form Transitions**: Smooth transition between email and OTP forms
3. **Back Navigation**: User can return to email form
4. **Keyboard Navigation**: Tab and Enter key support

## Integration with Test Email Service

To integrate with a test email service (e.g., MailSlurp):

1. Install the service SDK:
```bash
npm install mailslurp-client
```

2. Update `packages/e2e-helpers/helpers.ts`:
```typescript
import { MailSlurp } from 'mailslurp-client';

const mailslurp = new MailSlurp({ apiKey: process.env.MAILSLURP_API_KEY });

export async function waitForOTP(page: Page, email: string): Promise<string> {
  const inbox = await mailslurp.getInbox(process.env.MAILSLURP_INBOX_ID);
  const email = await mailslurp.waitForLatestEmail(inbox.id, { timeout: 30000 });
  
  // Extract OTP from email body
  const otpMatch = email.body?.match(/\b\d{9}\b/);
  if (!otpMatch) {
    throw new Error('OTP not found in email');
  }
  
  return otpMatch[0];
}
```

## Troubleshooting

### Tests Fail with "Worker Unhealthy"

Ensure all workers are deployed to development:
```bash
pnpm deploy:dev:all
```

### Tests Fail with "Timeout Waiting for OTP"

- Use a test email service to automatically extract OTP codes
- Or manually provide OTP codes in test configuration
- Check that email service is properly configured

### Tests Fail with "Encryption Failed"

Ensure encryption key is configured:
```bash
export VITE_SERVICE_ENCRYPTION_KEY=your-32-character-encryption-key
```

### UI Elements Not Found

- Ensure frontend is running: `pnpm dev`
- Check that OTP login component is mounted on `/auth` route
- Verify selectors match component implementation

## Best Practices

1. **Use Test Email Service**: Automate OTP extraction for reliable tests
2. **Isolate Tests**: Each test should be independent and not rely on previous tests
3. **Clean Up**: Clear test data between test runs if needed
4. **Mock External Services**: Use route interception for network failures
5. **Wait for Elements**: Always wait for elements to be visible before interacting

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run E2E Tests
  run: |
    pnpm deploy:dev:all
    pnpm test:e2e
  env:
    E2E_TEST_EMAIL: ${{ secrets.E2E_TEST_EMAIL }}
    E2E_OTP_AUTH_URL: ${{ secrets.E2E_OTP_AUTH_URL }}
    VITE_SERVICE_ENCRYPTION_KEY: ${{ secrets.VITE_SERVICE_ENCRYPTION_KEY }}
```

## See Also

- [E2E Testing Guide](../../E2E_TESTING_GUIDE.md) - General E2E testing guide
- [OTP Auth API Documentation](../../docs/api/otp-auth-api.md) - API reference
- [Playwright Documentation](https://playwright.dev/) - Playwright testing framework

