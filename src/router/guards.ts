/**
 * Route Guards
 * 
 * Guard functions that run before route navigation to protect routes.
 * Each guard returns true to allow, false to block (redirect to login),
 * or a string path to redirect to a specific route.
 * 
 * @module router/guards
 */

import { get } from 'svelte/store';
import type { ParsedRoute, RouteGuard } from './index';

// ============================================================================
// Auth Guards
// ============================================================================

/**
 * Require authentication guard
 * 
 * Checks if user is authenticated. If not, redirects to login
 * with a redirect query param to return after authentication.
 * 
 * This guard respects the encryptionEnabled setting - if encryption
 * is disabled, auth is not required.
 */
export const requireAuth: RouteGuard = async (to: ParsedRoute, _from: ParsedRoute | null): Promise<boolean | string> => {
  // Dynamically import to avoid circular dependencies
  const { isAuthenticated, encryptionEnabled, authCheckComplete } = await import('../stores/auth');
  
  const authComplete = get(authCheckComplete);
  const encEnabled = get(encryptionEnabled);
  const authenticated = get(isAuthenticated);
  
  // If auth check hasn't completed yet, allow navigation
  // The router will re-check when auth state is determined
  if (!authComplete) {
    console.log('[Guard:requireAuth] Auth check not complete, allowing for now');
    return true;
  }
  
  // If encryption is not enabled, auth is not required
  if (!encEnabled) {
    console.log('[Guard:requireAuth] Encryption disabled, auth not required');
    return true;
  }
  
  // Check authentication
  if (!authenticated) {
    console.log('[Guard:requireAuth] Not authenticated, redirecting to login');
    // Return login path - the router will add redirect param
    return '/login';
  }
  
  console.log('[Guard:requireAuth] Authenticated, allowing access');
  return true;
};

/**
 * Require authentication strictly (regardless of encryption setting)
 * 
 * Use this for routes that ALWAYS require auth, like URL shortener
 * which needs to identify the user for their URLs.
 */
export const requireAuthStrict: RouteGuard = async (_to: ParsedRoute, _from: ParsedRoute | null): Promise<boolean | string> => {
  const { isAuthenticated, authCheckComplete } = await import('../stores/auth');
  
  const authComplete = get(authCheckComplete);
  const authenticated = get(isAuthenticated);
  
  // If auth check hasn't completed yet, allow navigation
  if (!authComplete) {
    console.log('[Guard:requireAuthStrict] Auth check not complete, allowing for now');
    return true;
  }
  
  if (!authenticated) {
    console.log('[Guard:requireAuthStrict] Not authenticated, redirecting to login');
    return '/login';
  }
  
  console.log('[Guard:requireAuthStrict] Authenticated, allowing access');
  return true;
};

// ============================================================================
// Connection Guards
// ============================================================================

/**
 * Require OBS WebSocket connection guard
 * 
 * Redirects to setup page if not connected to OBS.
 * Used for pages that need OBS integration (sources, layouts, etc.)
 */
export const requireConnection: RouteGuard = async (_to: ParsedRoute, _from: ParsedRoute | null): Promise<boolean | string> => {
  const { connected } = await import('../stores/connection');
  
  const isConnected = get(connected);
  
  if (!isConnected) {
    console.log('[Guard:requireConnection] Not connected to OBS, redirecting to setup');
    return '/setup';
  }
  
  console.log('[Guard:requireConnection] Connected to OBS, allowing access');
  return true;
};

// ============================================================================
// DOM Interference Guards
// ============================================================================

/**
 * Require no DOM interference guard
 * 
 * Redirects to dashboard if DOM interference is detected.
 * Some features are restricted when third-party scripts interfere.
 */
export const requireNoInterference: RouteGuard = async (_to: ParsedRoute, _from: ParsedRoute | null): Promise<boolean | string> => {
  const { domInterferenceDetected } = await import('../stores/dom-interference');
  
  const hasInterference = get(domInterferenceDetected);
  
  if (hasInterference) {
    console.log('[Guard:requireNoInterference] DOM interference detected, redirecting to dashboard');
    return '/dashboard';
  }
  
  return true;
};

// ============================================================================
// Composite Guards
// ============================================================================

/**
 * Require both auth and OBS connection
 * Convenience guard for pages that need both.
 */
export const requireAuthAndConnection: RouteGuard = async (to: ParsedRoute, from: ParsedRoute | null): Promise<boolean | string> => {
  // Check auth first
  const authResult = await requireAuth(to, from);
  if (authResult !== true) {
    return authResult;
  }
  
  // Then check connection
  return requireConnection(to, from);
};

/**
 * Full protection: auth + connection + no interference
 * For most sensitive pages like sources, layouts, swaps.
 */
export const requireFullProtection: RouteGuard = async (to: ParsedRoute, from: ParsedRoute | null): Promise<boolean | string> => {
  // Check auth
  const authResult = await requireAuth(to, from);
  if (authResult !== true) {
    return authResult;
  }
  
  // Check connection
  const connResult = await requireConnection(to, from);
  if (connResult !== true) {
    return connResult;
  }
  
  // Check interference
  return requireNoInterference(to, from);
};

// ============================================================================
// Login Page Guard
// ============================================================================

/**
 * Redirect away from login if already authenticated
 * 
 * Used on the login page to redirect to dashboard (or redirect param)
 * if user is already logged in.
 */
export const redirectIfAuthenticated: RouteGuard = async (to: ParsedRoute, _from: ParsedRoute | null): Promise<boolean | string> => {
  const { isAuthenticated, encryptionEnabled, authCheckComplete } = await import('../stores/auth');
  
  const authComplete = get(authCheckComplete);
  const encEnabled = get(encryptionEnabled);
  const authenticated = get(isAuthenticated);
  
  // If auth check hasn't completed, allow staying on login
  if (!authComplete) {
    return true;
  }
  
  // If encryption is disabled, redirect to dashboard
  if (!encEnabled) {
    const redirect = to.query.redirect || '/dashboard';
    console.log('[Guard:redirectIfAuthenticated] Encryption disabled, redirecting to:', redirect);
    return redirect;
  }
  
  // If already authenticated, redirect to intended destination or dashboard
  if (authenticated) {
    const redirect = to.query.redirect || '/dashboard';
    console.log('[Guard:redirectIfAuthenticated] Already authenticated, redirecting to:', redirect);
    return redirect;
  }
  
  // Not authenticated, allow login page
  return true;
};

// ============================================================================
// Utility Guards
// ============================================================================

/**
 * Create a guard that logs navigation for debugging
 */
export function createLoggingGuard(name: string): RouteGuard {
  return async (to: ParsedRoute, from: ParsedRoute | null): Promise<boolean> => {
    console.log(`[Guard:${name}] Navigation:`, {
      from: from?.path,
      to: to.path,
      query: to.query
    });
    return true;
  };
}

/**
 * Create a guard that always redirects to a specific path
 */
export function createRedirectGuard(redirectTo: string): RouteGuard {
  return async (): Promise<string> => {
    return redirectTo;
  };
}

/**
 * Combine multiple guards into one
 * Runs guards in order, stops on first failure
 */
export function combineGuards(...guards: RouteGuard[]): RouteGuard {
  return async (to: ParsedRoute, from: ParsedRoute | null): Promise<boolean | string> => {
    for (const guard of guards) {
      const result = await guard(to, from);
      if (result !== true) {
        return result;
      }
    }
    return true;
  };
}
