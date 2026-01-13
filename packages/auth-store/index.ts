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
 * export const useAuthStore = createAuthStore({
 *   authApiUrl: 'https://auth.idling.app',
 * });
 * 
 * // In your app:
 * const { checkAuth, login, logout } = useAuthStore();
 * 
 * // On mount: check auth from HttpOnly cookie
 * useEffect(() => {
 *   checkAuth();
 * }, []);
 * 
 * // After OTP login: token is in HttpOnly cookie, just update local state
 * function handleLoginSuccess(data: LoginSuccessData) {
 *   login(data.token);
 * }
 * ```
 * 
 * For Svelte:
 * ```ts
 * import { createAuthStore } from '@strixun/auth-store/svelte';
 * 
 * export const authStore = createAuthStore({
 *   authApiUrl: 'https://auth.idling.app',
 * });
 * 
 * // In your component:
 * onMount(async () => {
 *   await authStore.checkAuth();
 * });
 * ```
 * 
 * Core functionality (framework-agnostic):
 * ```ts
 * import { fetchCustomerInfo, decodeJWTPayload } from '@strixun/auth-store/core/api';
 * import { getCookie, deleteCookie } from '@strixun/auth-store/core/utils';
 * ```
 */

export * from './core/index.js';
