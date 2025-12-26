/**
 * Navigation Store
 * 
 * Manages current page state
 */

import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { storage } from '../modules/storage';
import { connected } from './connection';
import { domInterferenceDetected } from './dom-interference';

// Pages that require OBS connection
const PAGES_REQUIRING_CONNECTION = ['sources', 'text', 'swaps', 'layouts'];

// Pages that are restricted when DOM interference is detected
const RESTRICTED_PAGES_ON_INTERFERENCE = ['sources', 'text', 'swaps', 'layouts', 'chat', 'url-shortener'];

export const currentPage: Writable<string> = writable('dashboard');

/**
 * Navigate to a page
 */
export function navigateTo(page: string, save: boolean = true): void {
  // Check for DOM interference - redirect restricted pages to dashboard
  const interferenceDetected = get(domInterferenceDetected);
  if (interferenceDetected && RESTRICTED_PAGES_ON_INTERFERENCE.includes(page)) {
    currentPage.set('dashboard');
    if (save) {
      storage.setRaw('active_tab', 'dashboard');
    }
    return;
  }
  
  currentPage.set(page);
  
  if (save) {
    storage.setRaw('active_tab', page);
  }
}

/**
 * Restore saved page
 * Only restores pages that don't require connection, or pages that require connection only if connected
 */
export function restorePage(): void {
  const saved = storage.getRaw('active_tab');
  if (saved && typeof saved === 'string') {
    const isConnected = get(connected);
    const requiresConnection = PAGES_REQUIRING_CONNECTION.includes(saved);
    
    // Only restore if: page doesn't require connection, OR page requires connection and we're connected
    if (!requiresConnection || (requiresConnection && isConnected)) {
      currentPage.set(saved);
    } else {
      // Redirect to setup if trying to restore a page that requires connection but we're not connected
      currentPage.set('setup');
    }
  }
}

