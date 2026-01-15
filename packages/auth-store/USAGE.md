# @strixun/auth-store - Usage Guide

## Overview

`@strixun/auth-store` is a **self-contained, framework-agnostic** authentication store that works with HttpOnly cookies for secure SSO across all Strixun projects.

## Key Features

- ✅ **Zero dependencies on other Strixun packages** (except `@strixun/api-framework`)
- ✅ **Automatic URL resolution** - Works in dev and prod without configuration
- ✅ **Framework adapters** - Zustand (React) and Svelte support
- ✅ **HttpOnly cookie-based** - XSS-proof authentication
- ✅ **SSO support** - Works across all `.idling.app` subdomains

## Installation

This package is part of the monorepo workspace. No installation needed - just import it.

## Usage

### React/Zustand Projects

**Step 1: Create the store**

```typescript
// mods-hub/src/stores/auth.ts (or similar)
import { createAuthStore } from '@strixun/auth-store/zustand';

// URLs are automatically resolved:
// - Dev: '/auth-api' (Vite proxy) or 'http://localhost:8787'
// - Prod: 'https://auth.idling.app' (or VITE_AUTH_API_URL if set)
export const useAuthStore = createAuthStore({
  // Optional: override URLs if needed
  // authApiUrl: 'https://custom-auth.example.com',
  // customerApiUrl: 'https://custom-customer.example.com',
});

// Re-export types for convenience
export type { AuthenticatedCustomer, AuthState } from '@strixun/auth-store/core/types';
```

**Step 2: Use in components**

```typescript
import { useAuthStore } from './stores/auth';

function MyComponent() {
  const { customer, isAuthenticated, checkAuth, logout } = useAuthStore();
  
  useEffect(() => {
    // Check auth on mount (reads HttpOnly cookie)
    checkAuth();
  }, [checkAuth]);
  
  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }
  
  return (
    <div>
      <p>Welcome, {customer?.displayName || customer?.email}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

**Step 3: Handle OTP login**

```typescript
import { OtpLogin } from '@strixun/otp-login/dist/react';
import { useAuthStore } from './stores/auth';

function LoginComponent() {
  const { checkAuth } = useAuthStore();
  
  async function handleLoginSuccess() {
    // Cookie is set by server, just refresh state
    await checkAuth();
  }
  
  return (
    <OtpLogin
      apiUrl="/auth-api" // Use Vite proxy in dev
      onSuccess={handleLoginSuccess}
    />
  );
}
```

### Svelte Projects

**Step 1: Create the store**

```typescript
// src/stores/auth.ts
import { createAuthStore } from '@strixun/auth-store/svelte';

// URLs are automatically resolved
export const authStore = createAuthStore({
  // Optional: override URLs if needed
});

// Re-export types
export type { AuthenticatedCustomer } from '@strixun/auth-store/core/types';
```

**Step 2: Use in components**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from './stores/auth';
  
  onMount(async () => {
    // Check auth on mount (reads HttpOnly cookie)
    await authStore.checkAuth();
  });
  
  // Access state reactively
  $: customer = $authStore.customer;
  $: isAuthenticated = $authStore.isAuthenticated;
</script>

{#if isAuthenticated}
  <p>Welcome, {customer?.displayName || customer?.email}!</p>
  <button on:click={authStore.logout}>Logout</button>
{:else}
  <p>Please log in</p>
{/if}
```

## URL Resolution

The auth store automatically resolves URLs based on environment:

### Development
- **Auth API**: `/auth-api` (Vite proxy) or `http://localhost:8787`
- **Customer API**: `/customer-api` (Vite proxy) or `http://localhost:8790`

### Production
- **Auth API**: `https://auth.idling.app` (or `VITE_AUTH_API_URL` if set)
- **Customer API**: `https://customer-api.idling.app` (or `VITE_CUSTOMER_API_URL` if set)

### Override Priority

1. **Config override** (highest priority)
   ```typescript
   createAuthStore({ authApiUrl: 'https://custom.com' })
   ```

2. **Environment variables**
   - `VITE_AUTH_API_URL`
   - `VITE_CUSTOMER_API_URL`

3. **Window globals** (for E2E tests)
   - `window.VITE_AUTH_API_URL`
   - `window.VITE_CUSTOMER_API_URL`

4. **Auto-detection** (dev vs prod)

## Configuration

```typescript
interface AuthStoreConfig {
  /** Override auth API URL (highest priority) */
  authApiUrl?: string;
  
  /** Override customer API URL (highest priority) */
  customerApiUrl?: string;
}
```

## API Reference

### Zustand Store Methods

```typescript
const {
  // State
  customer,           // AuthenticatedCustomer | null
  isAuthenticated,    // boolean
  isSuperAdmin,      // boolean
  
  // Methods
  checkAuth,          // () => Promise<boolean>
  logout,             // () => Promise<void>
  fetchCustomerInfo,  // () => Promise<void>
} = useAuthStore();
```

### Svelte Store

```typescript
// Reactive stores
$authStore.customer          // Writable<AuthenticatedCustomer | null>
$authStore.isAuthenticated    // Readable<boolean>
$authStore.isSuperAdmin       // Readable<boolean>

// Methods
authStore.checkAuth()         // Promise<boolean>
authStore.logout()            // Promise<void>
authStore.fetchCustomerInfo() // Promise<void>
```

## Examples

### Real-world Example: Mods Hub

```typescript
// mods-hub/src/stores/auth.ts
import { createAuthStore } from '@strixun/auth-store/zustand';

export const useAuthStore = createAuthStore({
  // Uses auto-detection - no config needed!
});

// mods-hub/src/components/Header.tsx
import { useAuthStore } from '../stores/auth';

export function Header() {
  const { customer, logout } = useAuthStore();
  
  return (
    <header>
      <span>Welcome, {customer?.displayName || 'Customer'}</span>
      <button onClick={logout}>Logout</button>
    </header>
  );
}
```

## Notes

- **No dependency on `@strixun/otp-auth-service`** - auth-store is completely self-contained
- **HttpOnly cookies** - Tokens are never accessible to JavaScript (XSS-proof)
- **Automatic SSO** - Cookies are shared across `.idling.app` subdomains
- **Fail-fast error handling** - Network errors throw immediately for better debugging
