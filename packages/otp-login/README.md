# OTP Login Component

Framework-agnostic email OTP authentication component for the Strixun Stream Suite OTP Auth API.

## Features

- ✅ **Framework Agnostic** - Core logic works with any framework
- ✅ **TypeScript** - Fully typed for better DX
- ✅ **Reusable** - Use in multiple projects
- ✅ **Consistent UX** - Same login experience everywhere
- ✅ **Easy Integration** - Simple API, works out of the box

## Installation

The component is located in `shared-components/otp-login/`. **IMPORTANT**: Always import from `dist/` files, not source files.

## Building the Library

Before using the library, build it:

```bash
cd shared-components/otp-login
pnpm build
```

This creates dist files for React, Svelte, and Vanilla JS.

## Usage

### Svelte

**✅ CORRECT - Import from dist:**
```svelte
<script>
  import OtpLogin from '../../../shared-components/otp-login/dist/svelte';
  import type { LoginSuccessData } from '../../../shared-components/otp-login/dist/svelte';

  function handleLoginSuccess(data: LoginSuccessData) {
    console.log('Logged in!', data);
    // Store token, update auth state, etc.
    localStorage.setItem('auth_token', data.token);
  }

  function handleLoginError(error: string) {
    console.error('Login failed:', error);
  }
</script>

<OtpLogin
  apiUrl="https://auth.idling.app"
  onSuccess={handleLoginSuccess}
  onError={handleLoginError}
  title="Developer Dashboard"
  subtitle="Sign in with your email to access your dashboard"
/>
```

### As Modal

```svelte
<script>
  let showLogin = false;
  
  function handleClose() {
    showLogin = false;
  }
</script>

{#if showLogin}
  <OtpLogin
    apiUrl="https://auth.idling.app"
    onSuccess={handleLoginSuccess}
    onError={handleLoginError}
    showAsModal={true}
    onClose={handleClose}
  />
{/if}
```

### Vanilla JavaScript/TypeScript

**✅ CORRECT - Import from dist:**
```typescript
import { OtpLoginCore } from './shared-components/otp-login/dist/js';

const login = new OtpLoginCore({
  apiUrl: 'https://auth.idling.app',
  onSuccess: (data) => {
    console.log('Logged in!', data);
    localStorage.setItem('auth_token', data.token);
  },
  onError: (error) => {
    console.error('Login failed:', error);
  },
});

// Subscribe to state changes
login.subscribe((state) => {
  console.log('State changed:', state);
  // Update UI based on state
});

// User actions
login.setEmail('user@example.com');
await login.requestOtp();

login.setOtp('123456789');
await login.verifyOtp();
```

## API

### OtpLoginCore

#### Constructor

```typescript
new OtpLoginCore(config: OtpLoginConfig)
```

#### Methods

- `setEmail(email: string)` - Set email address
- `setOtp(otp: string)` - Set OTP code (auto-filters to 9 digits)
- `requestOtp()` - Request OTP code
- `verifyOtp()` - Verify OTP code
- `goBack()` - Go back to email step
- `reset()` - Reset component state
- `getState()` - Get current state
- `subscribe(listener)` - Subscribe to state changes
- `destroy()` - Cleanup

#### State

```typescript
interface OtpLoginState {
  step: 'email' | 'otp';
  email: string;
  otp: string;
  loading: boolean;
  error: string | null;
  countdown: number; // seconds remaining
}
```

## Customization

### Custom API Endpoints

```typescript
const login = new OtpLoginCore({
  apiUrl: 'https://api.example.com',
  endpoints: {
    requestOtp: '/custom/request-otp',
    verifyOtp: '/custom/verify-otp',
  },
  onSuccess: handleSuccess,
});
```

## Styling

The component uses CSS variables from `shared-styles/_variables.scss`. Ensure these are available:

- `--accent`, `--accent-dark`
- `--text`, `--text-secondary`
- `--card`, `--bg-dark`, `--border`
- `--danger`, `--warning`
- `--spacing-*` variables

## CDN Usage

The library can be used directly from a CDN without any build step. See [CDN_USAGE.md](./CDN_USAGE.md) for complete documentation.

### Quick CDN Example

```html
<script src="https://cdn.example.com/otp-login-svelte.min.js"></script>
<script>
  OtpLoginSvelte.mountOtpLogin({
    target: document.getElementById('login-container'),
    apiUrl: 'https://auth.idling.app',
    otpEncryptionKey: 'YOUR_ENCRYPTION_KEY_HERE',
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token);
    },
  });
</script>
```

## Examples

See:
- `src/lib/components/auth/LoginModal.svelte` - Main app usage
- `serverless/otp-auth-service/dashboard/src/components/Login.svelte` - Dashboard usage
- `CDN_USAGE.md` - CDN usage examples and API reference

