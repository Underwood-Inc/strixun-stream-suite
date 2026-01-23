/**
 * Navigation Store
 * 
 * Manages current page state via the hash router.
 * This module provides backward-compatible navigation functions
 * that delegate to the router.
 * 
 * @module stores/navigation
 */

import { derived, get } from 'svelte/store';
import type { Readable } from 'svelte/store';
import { storage } from '../modules/storage';
import { 
  navigate as routerNavigate, 
  currentPath,
  currentRoute
} from '../router';
import { 
  legacyPageToPath, 
  pathToLegacyPage 
} from '../router/routes';

// ============================================================================
// Backward Compatibility
// ============================================================================

/**
 * Current page ID (legacy format like 'dashboard', 'sources', etc.)
 * Derived from the router's current path for backward compatibility.
 * 
 * @deprecated Use currentPath from router instead for new code
 */
export const currentPage: Readable<string> = derived(
  currentPath,
  ($path) => pathToLegacyPage($path)
);

// ============================================================================
// Navigation Functions
// ============================================================================

/**
 * Navigate to a page using legacy page ID
 * 
 * @param page - Legacy page ID (e.g., 'dashboard', 'sources', 'text')
 * @param save - Whether to save the page to storage (default: true)
 * 
 * @example
 * navigateTo('dashboard');
 * navigateTo('url-shortener');
 */
export function navigateTo(page: string, save: boolean = true): void {
  // Convert legacy page ID to route path
  const path = legacyPageToPath(page);
  
  // Navigate via router (guards will handle auth/connection checks)
  routerNavigate(path);
  
  // Save to storage for persistence (legacy behavior)
  if (save) {
    storage.setRaw('active_tab', page);
  }
}

/**
 * Navigate to a route path directly
 * Use this for new code instead of navigateTo
 * 
 * @param path - Route path (e.g., '/dashboard', '/url-shortener')
 * @param options - Navigation options
 */
export function navigateToPath(path: string, options?: { replace?: boolean }): void {
  routerNavigate(path, options);
  
  // Save legacy page ID to storage
  const legacyPage = pathToLegacyPage(path);
  storage.setRaw('active_tab', legacyPage);
}

/**
 * Restore saved page from storage
 * Called on app initialization to restore the last active page.
 * 
 * Note: With the router, this should be called after router initialization.
 * The router will handle guard checks automatically.
 * 
 * IMPORTANT: Does NOT restore if there's a redirect URL pending in the
 * current route - the router's redirect takes priority.
 */
export function restorePage(): void {
  // Check if there's a redirect URL pending - if so, let the router handle it
  const route = get(currentRoute);
  if (route.query.redirect) {
    console.log('[Navigation] Skipping restorePage - redirect URL pending:', route.query.redirect);
    return;
  }
  
  // Don't restore if already on a specific route (not login/root)
  if (route.path !== '/login' && route.path !== '/') {
    console.log('[Navigation] Skipping restorePage - already on specific route:', route.path);
    return;
  }
  
  const saved = storage.getRaw('active_tab');
  if (saved && typeof saved === 'string') {
    // Convert to path and navigate
    const path = legacyPageToPath(saved);
    routerNavigate(path, { replace: true });
  }
}

/**
 * Get the current page ID (legacy format)
 */
export function getCurrentPage(): string {
  return get(currentPage);
}

/**
 * Get the current route path
 */
export function getCurrentPath(): string {
  return get(currentPath);
}

/**
 * Get full current route info including query params
 */
export function getCurrentRoute() {
  return get(currentRoute);
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { currentPath, currentRoute } from '../router';
