# @strixun/auth-store

Shared, framework-agnostic authentication store for all Strixun projects.

## Features

- ✓ Framework-agnostic core implementation
- ✓ Zustand adapter for React projects
- ✓ Svelte adapter for Svelte projects
- ✓ Session restoration from backend (IP-based)
- ✓ Token validation with backend (detects blacklisted tokens)
- ✓ Automatic user info fetching (displayName, customerId, isSuperAdmin)
- ✓ JWT payload decoding (CSRF token extraction)
- ✓ Persistent storage with configurable storage key
- ✓ TypeScript support

## Installation

This package is part of the monorepo workspace. No installation needed - just import it.

## Usage

### React/Zustand

```typescript
import { createAuthStore } from '@strixun/auth-store/zustand';

// Create the store
export const useAuthStore = createAuthStore({
    authApiUrl: import.meta.env.VITE_AUTH_API_URL || 'https://auth.idling.app',
    storageKey: 'auth-storage',
    enableSessionRestore: true,
    enableTokenValidation: true,
});

// Use in components
function MyComponent() {
    const { user, isAuthenticated, logout, fetchUserInfo } = useAuthStore();
    
    if (!isAuthenticated) {
        return <div>Please log in</div>;
    }
    
    return (
        <div>
            <p>Welcome, {user?.displayName || user?.email}!</p>
            <button onClick={logout}>Logout</button>
        </div>
    );
}
```

### Svelte

```typescript
import { createAuthStore } from '@strixun/auth-store/svelte';

// Create the store
export const authStore = createAuthStore({
    authApiUrl: 'https://auth.idling.app',
    storageKey: 'auth_user',
    enableSessionRestore: true,
    enableTokenValidation: true,
});

// Use in components
<script>
    import { authStore } from './stores/auth';
    
    $: user = $authStore.user;
    $: isAuthenticated = $authStore.isAuthenticated;
</script>

{#if isAuthenticated}
    <p>Welcome, {user?.displayName || user?.email}!</p>
    <button on:click={authStore.logout}>Logout</button>
{/if}
```

### Core API (Framework-agnostic)

```typescript
import { 
    restoreSessionFromBackend, 
    fetchUserInfo, 
    validateTokenWithBackend 
} from '@strixun/auth-store/core';

// Restore session from backend
const customer = await restoreSessionFromBackend({
    authApiUrl: 'https://auth.idling.app',
});

// Fetch user info
const userInfo = await fetchUserInfo(token, {
    authApiUrl: 'https://auth.idling.app',
});

// Validate token
const isValid = await validateTokenWithBackend(token, {
    authApiUrl: 'https://auth.idling.app',
});
```

## Configuration

```typescript
interface AuthStoreConfig {
    /**
     * Auth API base URL
     * Defaults to 'https://auth.idling.app' in production
     */
    authApiUrl?: string;
    
    /**
     * Storage key for persisting auth state
     * Defaults to 'auth-storage' (Zustand) or 'auth_user' (Svelte)
     */
    storageKey?: string;
    
    /**
     * Storage implementation (localStorage, sessionStorage, or custom)
     * Defaults to localStorage
     */
    storage?: Storage;
    
    /**
     * Enable session restoration from backend
     * Defaults to true
     */
    enableSessionRestore?: boolean;
    
    /**
     * Enable token validation with backend
     * Defaults to true
     */
    enableTokenValidation?: boolean;
    
    /**
     * Timeout for session restoration (ms)
     * Defaults to 10000 (10 seconds)
     */
    sessionRestoreTimeout?: number;
    
    /**
     * Timeout for token validation (ms)
     * Defaults to 5000 (5 seconds)
     */
    tokenValidationTimeout?: number;
}
```

## User Interface

```typescript
interface User {
    userId: string;
    email: string;
    displayName?: string | null;
    customerId?: string | null; // Customer ID for data scoping (REQUIRED for mod operations)
    token: string;
    expiresAt: string;
    isSuperAdmin?: boolean;
    // Optional extensions for specific projects
    twitchAccount?: {
        twitchUserId: string;
        twitchUsername: string;
        displayName?: string;
        attachedAt: string;
    };
    [key: string]: unknown; // Allow additional properties
}
```

## Migration Guide

### From mods-hub/src/stores/auth.ts (Zustand)

**Before:**
```typescript
import { useAuthStore } from '../stores/auth';
```

**After:**
```typescript
import { createAuthStore } from '@strixun/auth-store/zustand';
export const useAuthStore = createAuthStore();
```

### From src/stores/auth.ts (Svelte)

**Before:**
```typescript
import { user, isAuthenticated, logout } from '../stores/auth';
```

**After:**
```typescript
import { createAuthStore } from '@strixun/auth-store/svelte';
export const authStore = createAuthStore();

// Then use: $authStore.user, $authStore.isAuthenticated, authStore.logout()
```

## Notes

- The store automatically validates tokens on hydration to detect blacklisted tokens from logout on other domains
- Session restoration is IP-based and enables cross-application session sharing
- User info (displayName, customerId, isSuperAdmin) is automatically fetched from `/auth/me` endpoint
- All API calls use `@strixun/api-framework/client` for consistent error handling and encryption support
