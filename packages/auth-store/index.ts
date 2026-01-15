/**
 * @strixun/auth-store - HttpOnly Cookie SSO
 * 
 * Shared, framework-agnostic authentication store for all Strixun projects
 * 
 * Features:
 * - ✓ HttpOnly cookie-based SSO across all .idling.app subdomains
 * - ✓ XSS-proof authentication (HttpOnly flag)
 * - ✓ CSRF-proof (SameSite=Lax)
 * - ✓ No localStorage token storage
 * - ✓ Automatic session restoration from cookies
 * 
 * Usage:
 * 
 * For React/Zustand:
 * ```ts
 * import { createAuthStore } from '@strixun/auth-store/zustand';
 * 
 * // Create the store - URLs are auto-detected from environment
 * // In dev: uses '/auth-api' (Vite proxy) or 'http://localhost:8787'
 * // In prod: uses 'https://auth.idling.app' (or VITE_AUTH_API_URL if set)
 * export const useAuthStore = createAuthStore({
 *   // Optional: override URLs if needed
 *   // authApiUrl: 'https://custom-auth.example.com',
 *   // customerApiUrl: 'https://custom-customer.example.com',
 * });
 * 
 * // In your app:
 * const { customer, isAuthenticated, checkAuth, logout } = useAuthStore();
 * 
 * // On mount: check auth from HttpOnly cookie
 * useEffect(() => {
 *   checkAuth();
 * }, []);
 * 
 * // After OTP login: cookie is set by server, just refresh state
 * function handleLoginSuccess() {
 *   checkAuth(); // Refresh auth state
 * }
 * ```
 * 
 * For Svelte:
 * ```ts
 * import { createAuthStore } from '@strixun/auth-store/svelte';
 * 
 * // Create the store - URLs are auto-detected from environment
 * export const authStore = createAuthStore({
 *   // Optional: override URLs if needed
 * });
 * 
 * // In your component:
 * onMount(async () => {
 *   await authStore.checkAuth();
 * });
 * 
 * // Access state reactively:
 * $: customer = $authStore.customer;
 * $: isAuthenticated = $authStore.isAuthenticated;
 * ```
 * 
 * Core functionality (framework-agnostic):
 * ```ts
 * import { fetchCustomerInfo, decodeJWTPayload } from '@strixun/auth-store/core/api';
 * import { getCookie, deleteCookie } from '@strixun/auth-store/core/utils';
 * ```
 */

export * from './core/index';
