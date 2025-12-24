# OTP Login Component

Framework-agnostic email OTP authentication component for the Strixun Stream Suite OTP Auth API.

## Features

- ✅ **Framework Agnostic** - Core logic works with any framework
- ✅ **TypeScript** - Fully typed for better DX
- ✅ **Reusable** - Use in multiple projects
- ✅ **Consistent UX** - Same login experience everywhere
- ✅ **Easy Integration** - Simple API, works out of the box

## Installation

The component is located in `shared-components/otp-login/`. No npm package needed - just import directly.

## Usage

### Svelte

```svelte
<script>
  import OtpLogin from '../../../shared-components/otp-login/svelte/OtpLogin.svelte';
  import type { LoginSuccessData } from '../../../shared-components/otp-login/core';

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
  apiUrl="https://otp-auth-service.strixuns-script-suite.workers.dev"
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
    apiUrl="https://otp-auth-service.strixuns-script-suite.workers.dev"
    onSuccess={handleLoginSuccess}
    onError={handleLoginError}
    showAsModal={true}
    onClose={handleClose}
  />
{/if}
```

### Vanilla JavaScript/TypeScript

```typescript
import { OtpLoginCore } from './shared-components/otp-login/core';

const login = new OtpLoginCore({
  apiUrl: 'https://otp-auth-service.strixuns-script-suite.workers.dev',
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

login.setOtp('123456');
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
- `setOtp(otp: string)` - Set OTP code (auto-filters to 6 digits)
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

## Examples

See:
- `src/lib/components/auth/LoginModal.svelte` - Main app usage
- `serverless/otp-auth-service/dashboard/src/components/Login.svelte` - Dashboard usage

