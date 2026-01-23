/**
 * Hash Router - Core Module
 * 
 * Lightweight hash-based router for SPA navigation.
 * Uses window.location.hash for URL-based routing that works
 * perfectly with static hosting (GitHub Pages, OBS dock).
 * 
 * @module router
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';

// ============================================================================
// Types
// ============================================================================

/**
 * Navigation options for route changes
 */
export interface NavigateOptions {
  /** Query parameters to append to the URL */
  query?: Record<string, string>;
  /** Replace current history entry instead of pushing */
  replace?: boolean;
}

/**
 * Parsed route information
 */
export interface ParsedRoute {
  /** The path portion of the hash (e.g., '/dashboard') */
  path: string;
  /** Query parameters from the hash */
  query: Record<string, string>;
  /** The full hash string */
  hash: string;
}

/**
 * Route guard function signature
 * Returns true to allow navigation, or a redirect path string to redirect
 */
export type RouteGuard = (to: ParsedRoute, from: ParsedRoute | null) => boolean | string | Promise<boolean | string>;

/**
 * Route definition
 */
export interface RouteDefinition {
  /** Route path pattern (e.g., '/dashboard', '/user/:id') */
  path: string;
  /** Route guards to run before rendering */
  guards?: RouteGuard[];
  /** Route metadata */
  meta?: Record<string, unknown>;
}

// ============================================================================
// Stores
// ============================================================================

/**
 * Store for the current parsed route
 */
export const currentRoute: Writable<ParsedRoute> = writable({
  path: '/login',
  query: {},
  hash: ''
});

/**
 * Store for the current path only (convenience)
 */
export const currentPath: Readable<string> = derived(
  currentRoute,
  ($route) => $route.path
);

/**
 * Store tracking if router is initialized
 */
export const routerReady: Writable<boolean> = writable(false);

/**
 * Store for navigation loading state (during guard checks)
 */
export const isNavigating: Writable<boolean> = writable(false);

// ============================================================================
// Internal State
// ============================================================================

let registeredRoutes: RouteDefinition[] = [];
let previousRoute: ParsedRoute | null = null;
let isInitialized = false;

// ============================================================================
// Hash Parsing
// ============================================================================

/**
 * Parse a hash string into route components
 * 
 * @example
 * parseHash('#/dashboard?redirect=/url-shortener')
 * // Returns: { path: '/dashboard', query: { redirect: '/url-shortener' }, hash: '#/dashboard?redirect=/url-shortener' }
 */
export function parseHash(hash: string): ParsedRoute {
  // Remove leading # if present
  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
  
  // Split path and query string
  const [pathPart, queryPart] = cleanHash.split('?');
  
  // Normalize path - ensure it starts with /
  let path = pathPart || '/login';
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  // Parse query string
  const query: Record<string, string> = {};
  if (queryPart) {
    const params = new URLSearchParams(queryPart);
    params.forEach((value, key) => {
      query[key] = value;
    });
  }
  
  return {
    path,
    query,
    hash: hash || '#/login'
  };
}

/**
 * Build a hash string from path and query params
 */
export function buildHash(path: string, query?: Record<string, string>): string {
  let hash = '#' + (path.startsWith('/') ? path : '/' + path);
  
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.set(key, value);
      }
    });
    const queryString = params.toString();
    if (queryString) {
      hash += '?' + queryString;
    }
  }
  
  return hash;
}

// ============================================================================
// Navigation Functions
// ============================================================================

/**
 * Navigate to a new route
 * 
 * @param path - The path to navigate to (e.g., '/dashboard')
 * @param options - Navigation options (query params, replace mode)
 * 
 * @example
 * // Simple navigation
 * navigate('/dashboard');
 * 
 * // With query params
 * navigate('/login', { query: { redirect: '/url-shortener' } });
 * 
 * // Replace current history entry
 * navigate('/dashboard', { replace: true });
 */
export function navigate(path: string, options: NavigateOptions = {}): void {
  const hash = buildHash(path, options.query);
  
  if (options.replace) {
    // Replace current history entry
    window.location.replace(window.location.pathname + window.location.search + hash);
  } else {
    // Push new history entry
    window.location.hash = hash;
  }
}

/**
 * Replace current route without adding history entry
 * Convenience wrapper for navigate with replace: true
 */
export function replace(path: string, query?: Record<string, string>): void {
  navigate(path, { query, replace: true });
}

/**
 * Navigate back in history
 */
export function goBack(): void {
  window.history.back();
}

/**
 * Navigate forward in history
 */
export function goForward(): void {
  window.history.forward();
}

// ============================================================================
// Query Parameter Helpers
// ============================================================================

/**
 * Get a query parameter from the current route
 */
export function getQueryParam(key: string): string | null {
  const route = get(currentRoute);
  return route.query[key] ?? null;
}

/**
 * Get the redirect URL from query params (common pattern)
 */
export function getRedirectUrl(): string | null {
  return getQueryParam('redirect');
}

/**
 * Update query parameters on current route
 */
export function setQueryParams(params: Record<string, string | null>): void {
  const route = get(currentRoute);
  const newQuery = { ...route.query };
  
  Object.entries(params).forEach(([key, value]) => {
    if (value === null) {
      delete newQuery[key];
    } else {
      newQuery[key] = value;
    }
  });
  
  navigate(route.path, { query: newQuery, replace: true });
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register routes with the router
 */
export function registerRoutes(routes: RouteDefinition[]): void {
  registeredRoutes = routes;
}

/**
 * Find a matching route definition for a path
 */
export function findRoute(path: string): RouteDefinition | undefined {
  return registeredRoutes.find(route => {
    // Exact match for now (can add pattern matching later)
    return route.path === path;
  });
}

// ============================================================================
// Guard Execution
// ============================================================================

/**
 * Run all guards for a route
 * Returns the final destination (original path if allowed, or redirect path)
 */
export async function runGuards(
  to: ParsedRoute,
  from: ParsedRoute | null
): Promise<{ allowed: boolean; redirect?: string }> {
  const routeDef = findRoute(to.path);
  
  if (!routeDef || !routeDef.guards || routeDef.guards.length === 0) {
    return { allowed: true };
  }
  
  for (const guard of routeDef.guards) {
    try {
      const result = await guard(to, from);
      
      if (result === false) {
        // Guard rejected, redirect to login by default
        return { allowed: false, redirect: '/login' };
      }
      
      if (typeof result === 'string') {
        // Guard returned redirect path
        return { allowed: false, redirect: result };
      }
      
      // Guard passed (result === true), continue to next guard
    } catch (error) {
      console.error('[Router] Guard error:', error);
      return { allowed: false, redirect: '/login' };
    }
  }
  
  return { allowed: true };
}

// ============================================================================
// Hash Change Handler
// ============================================================================

/**
 * Handle hash change events
 */
async function handleHashChange(): Promise<void> {
  const newRoute = parseHash(window.location.hash);
  const oldRoute = get(currentRoute);
  
  // Skip if same route
  if (newRoute.path === oldRoute.path && 
      JSON.stringify(newRoute.query) === JSON.stringify(oldRoute.query)) {
    return;
  }
  
  isNavigating.set(true);
  
  try {
    // Run guards
    const guardResult = await runGuards(newRoute, previousRoute);
    
    if (!guardResult.allowed && guardResult.redirect) {
      // Guard rejected, redirect
      // Use replace to avoid infinite loops in history
      previousRoute = oldRoute;
      
      // Build redirect URL preserving intended destination if going to login
      if (guardResult.redirect === '/login' && newRoute.path !== '/login') {
        // Preserve the full path WITH query params
        const fullPath = newRoute.query && Object.keys(newRoute.query).length > 0
          ? `${newRoute.path}?${new URLSearchParams(newRoute.query).toString()}`
          : newRoute.path;
        replace('/login', { redirect: fullPath });
      } else {
        replace(guardResult.redirect);
      }
      return;
    }
    
    // Update stores
    previousRoute = oldRoute;
    currentRoute.set(newRoute);
  } finally {
    isNavigating.set(false);
  }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the router
 * Should be called once on app startup
 */
export function initRouter(): void {
  if (isInitialized) {
    console.warn('[Router] Already initialized');
    return;
  }
  
  // Listen for hash changes
  window.addEventListener('hashchange', handleHashChange);
  
  // Handle initial route
  const initialHash = window.location.hash;
  if (!initialHash || initialHash === '#' || initialHash === '#/') {
    // No hash or empty hash - redirect to login
    replace('/login');
  } else {
    // Parse and set initial route (guards will run)
    handleHashChange();
  }
  
  isInitialized = true;
  routerReady.set(true);
  
  console.log('[Router] Initialized with hash:', window.location.hash);
}

/**
 * Destroy the router (cleanup)
 */
export function destroyRouter(): void {
  window.removeEventListener('hashchange', handleHashChange);
  isInitialized = false;
  routerReady.set(false);
  registeredRoutes = [];
  previousRoute = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a path matches the current route
 */
export function isActive(path: string): boolean {
  const route = get(currentRoute);
  return route.path === path;
}

/**
 * Get current route reactively (for components)
 */
export function getCurrentRoute(): ParsedRoute {
  return get(currentRoute);
}

/**
 * Programmatically trigger route check (useful after auth changes)
 */
export function recheckCurrentRoute(): void {
  handleHashChange();
}
