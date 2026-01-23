/**
 * Route Configuration
 * 
 * Centralized route definitions with guards and metadata.
 * This is the single source of truth for all application routes.
 * 
 * @module router/routes
 */

import type { RouteGuard, RouteDefinition } from './index';
import {
  requireAuth,
  requireAuthStrict,
  requireConnection,
  requireNoInterference,
  requireFullProtection,
  redirectIfAuthenticated
} from './guards';

// ============================================================================
// Route Types
// ============================================================================

/**
 * Extended route definition with component info
 */
export interface AppRoute extends RouteDefinition {
  /** Route path */
  path: string;
  /** Display label for navigation */
  label: string;
  /** Roman numeral for navigation display */
  numeral?: string;
  /** Route guards */
  guards: RouteGuard[];
  /** Whether this route requires OBS connection */
  requiresConnection: boolean;
  /** Whether this route is a work-in-progress */
  isWip: boolean;
  /** Whether this route is in testing phase */
  inTesting: boolean;
  /** Reason shown when route is disabled */
  disabledReason?: string;
  /** Whether to show in main navigation */
  showInNav: boolean;
  /** Route metadata */
  meta: {
    /** Page title */
    title?: string;
    /** Page description */
    description?: string;
  };
}

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * All application routes
 */
export const routes: AppRoute[] = [
  // ========== Public Routes ==========
  {
    path: '/login',
    label: 'Login',
    guards: [redirectIfAuthenticated],
    requiresConnection: false,
    isWip: false,
    inTesting: false,
    showInNav: false,
    meta: {
      title: 'Sign In',
      description: 'Authenticate to access the Stream Suite'
    }
  },
  
  // ========== Display Routes (no chrome, for OBS browser sources) ==========
  {
    path: '/text-cycler-display',
    label: 'Text Cycler Display',
    guards: [requireAuthStrict],
    requiresConnection: false,
    isWip: false,
    inTesting: false,
    showInNav: false,
    meta: {
      title: 'Text Cycler Display',
      description: 'OBS browser source display for text cycler'
    }
  },
  
  // ========== Main App Routes ==========
  {
    path: '/dashboard',
    label: 'Dashboard',
    numeral: 'I',
    guards: [requireAuth],
    requiresConnection: false,
    isWip: false,
    inTesting: false,
    showInNav: true,
    meta: {
      title: 'Dashboard',
      description: 'Stream Suite overview and status'
    }
  },
  {
    path: '/sources',
    label: 'Sources',
    numeral: 'II',
    guards: [requireFullProtection],
    requiresConnection: true,
    isWip: false,
    inTesting: false,
    disabledReason: 'Connect to OBS first to use this feature',
    showInNav: true,
    meta: {
      title: 'Sources',
      description: 'Manage OBS sources and their properties'
    }
  },
  {
    path: '/text-cycler',
    label: 'Text Cycler',
    numeral: 'III',
    guards: [requireFullProtection],
    requiresConnection: true,
    isWip: false,
    inTesting: true,
    disabledReason: 'Connect to OBS first to use this feature',
    showInNav: true,
    meta: {
      title: 'Text Cycler',
      description: 'Cycle through text content with animations'
    }
  },
  {
    path: '/swaps',
    label: 'Swaps',
    numeral: 'IV',
    guards: [requireFullProtection],
    requiresConnection: true,
    isWip: false,
    inTesting: false,
    disabledReason: 'Connect to OBS first to use this feature',
    showInNav: true,
    meta: {
      title: 'Swaps',
      description: 'Configure source swap presets'
    }
  },
  {
    path: '/layouts',
    label: 'Layouts',
    numeral: 'V',
    guards: [requireFullProtection],
    requiresConnection: true,
    isWip: false,
    inTesting: false,
    disabledReason: 'Connect to OBS first to use this feature',
    showInNav: true,
    meta: {
      title: 'Layouts',
      description: 'Manage scene layouts and presets'
    }
  },
  {
    path: '/notes',
    label: 'Notes',
    numeral: 'VI',
    guards: [requireAuth],
    requiresConnection: false,
    isWip: true,
    inTesting: false,
    showInNav: true,
    meta: {
      title: 'Notes',
      description: 'Stream notes and quick references'
    }
  },
  {
    path: '/chat',
    label: 'Chat',
    numeral: 'VII',
    guards: [requireAuth, requireNoInterference],
    requiresConnection: false,
    isWip: true,
    inTesting: false,
    showInNav: true,
    meta: {
      title: 'Chat',
      description: 'Integrated chat client'
    }
  },
  {
    path: '/scripts',
    label: 'Scripts',
    numeral: 'VIII',
    guards: [requireAuth],
    requiresConnection: false,
    isWip: false,
    inTesting: false,
    showInNav: true,
    meta: {
      title: 'Scripts',
      description: 'Manage Lua scripts for OBS'
    }
  },
  {
    path: '/url-shortener',
    label: 'URL Shortener',
    numeral: 'IX',
    guards: [requireAuthStrict, requireNoInterference],
    requiresConnection: false,
    isWip: false,
    inTesting: true,
    showInNav: true,
    meta: {
      title: 'URL Shortener',
      description: 'Create and manage short URLs'
    }
  },
  {
    path: '/setup',
    label: 'Setup',
    numeral: 'X',
    guards: [requireAuth],
    requiresConnection: false,
    isWip: false,
    inTesting: false,
    showInNav: true,
    meta: {
      title: 'Setup',
      description: 'Configure OBS connection and settings'
    }
  }
];

// ============================================================================
// Route Helpers
// ============================================================================

/**
 * Get routes visible in navigation
 */
export function getNavRoutes(): AppRoute[] {
  return routes.filter(route => route.showInNav);
}

/**
 * Find a route by path
 */
export function findRouteByPath(path: string): AppRoute | undefined {
  return routes.find(route => route.path === path);
}

/**
 * Get route definitions for router registration
 */
export function getRouteDefinitions(): RouteDefinition[] {
  return routes.map(route => ({
    path: route.path,
    guards: route.guards,
    meta: route.meta
  }));
}

/**
 * Map of old page IDs to new route paths
 * Used for migration from currentPage store
 */
export const legacyPageMap: Record<string, string> = {
  'dashboard': '/dashboard',
  'sources': '/sources',
  'text': '/text-cycler',
  'swaps': '/swaps',
  'layouts': '/layouts',
  'notes': '/notes',
  'chat': '/chat',
  'scripts': '/scripts',
  'url-shortener': '/url-shortener',
  'setup': '/setup'
};

/**
 * Convert legacy page ID to route path
 */
export function legacyPageToPath(pageId: string): string {
  return legacyPageMap[pageId] || '/dashboard';
}

/**
 * Convert route path to legacy page ID
 * Used for backward compatibility with existing code
 */
export function pathToLegacyPage(path: string): string {
  const entry = Object.entries(legacyPageMap).find(([, p]) => p === path);
  return entry ? entry[0] : 'dashboard';
}

/**
 * Default route when no route matches or user is authenticated
 */
export const DEFAULT_AUTHENTICATED_ROUTE = '/dashboard';

/**
 * Login route path
 */
export const LOGIN_ROUTE = '/login';

/**
 * Display routes that render without app chrome
 * These are meant for OBS browser sources
 */
export const DISPLAY_ROUTES = ['/text-cycler-display'];

/**
 * Check if a path is a display route (no chrome)
 */
export function isDisplayRoute(path: string): boolean {
  return DISPLAY_ROUTES.includes(path);
}
