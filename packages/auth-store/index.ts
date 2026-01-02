/**
 * @strixun/auth-store
 * 
 * Shared, framework-agnostic authentication store for all Strixun projects
 * 
 * Usage:
 * 
 * For React/Zustand:
 * ```ts
 * import { createAuthStore } from '@strixun/auth-store/zustand';
 * export const useAuthStore = createAuthStore();
 * ```
 * 
 * For Svelte:
 * ```ts
 * import { createAuthStore } from '@strixun/auth-store/svelte';
 * export const authStore = createAuthStore();
 * ```
 * 
 * Core functionality (framework-agnostic):
 * ```ts
 * import { restoreSessionFromBackend, fetchUserInfo } from '@strixun/auth-store/core';
 * ```
 */

export * from './core/index.js';
