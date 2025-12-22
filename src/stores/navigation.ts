/**
 * Navigation Store
 * 
 * Manages current page state
 */

import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { storage } from '../modules/storage';

export const currentPage: Writable<string> = writable('dashboard');

/**
 * Navigate to a page
 */
export function navigateTo(page: string, save: boolean = true): void {
  currentPage.set(page);
  
  if (save) {
    storage.setRaw('active_tab', page);
  }
}

/**
 * Restore saved page
 */
export function restorePage(): void {
  const saved = storage.getRaw('active_tab');
  if (saved && typeof saved === 'string') {
    currentPage.set(saved);
  }
}

