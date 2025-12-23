/**
 * Advanced Toast Queue Store
 * 
 * Manages a queue of toast notifications with support for:
 * - Auto-dismissing toasts
 * - Manual-dismiss toasts (persistent)
 * - Queue management with max visible limit
 * - Overflow handling for excess toasts
 */

import { writable, derived, get } from 'svelte/store';
import { getToastConfig } from '../config/toast.config';

// ============ Types ============

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  handler: () => void;
}

export interface ToastOptions {
  /**
   * The message to display
   */
  message: string;
  
  /**
   * Toast type (affects styling and icon)
   */
  type?: ToastType;
  
  /**
   * Duration in milliseconds. Set to 0 or negative for manual dismiss only
   * If undefined, uses default from config
   */
  duration?: number;
  
  /**
   * Whether this toast requires manual dismissal
   * If true, duration is ignored
   */
  persistent?: boolean;
  
  /**
   * Optional action button
   */
  action?: ToastAction;
  
  /**
   * Optional title/heading for the toast
   */
  title?: string;
  
  /**
   * Optional icon override (emoji or text)
   */
  icon?: string;
}

export interface Toast extends ToastOptions {
  /**
   * Unique identifier for this toast
   */
  id: string;
  
  /**
   * Timestamp when toast was created
   */
  createdAt: number;
  
  /**
   * Whether the toast is currently visible
   */
  visible: boolean;
  
  /**
   * Whether the toast is in the overflow deck
   */
  inOverflow: boolean;
  
  /**
   * Index in the overflow deck (for 3D positioning)
   */
  overflowIndex: number;
  
  /**
   * Count of duplicate consecutive messages (like activity log)
   */
  count?: number;
}

// ============ Store ============

const toastQueue = writable<Toast[]>([]);
let toastIdCounter = 0;

// ============ Derived Stores ============

/**
 * Get visible toasts (up to maxVisible)
 */
export const visibleToasts = derived(toastQueue, ($queue) => {
  const config = getToastConfig();
  return $queue
    .filter(t => t.visible && !t.inOverflow)
    .slice(0, config.maxVisible);
});

/**
 * Get overflow toasts (beyond maxVisible)
 */
export const overflowToasts = derived(toastQueue, ($queue) => {
  const config = getToastConfig();
  const visible = $queue.filter(t => t.visible && !t.inOverflow).slice(0, config.maxVisible);
  const overflow = $queue.filter(t => t.visible && t.inOverflow);
  
  // Update overflow indices for 3D positioning
  return overflow.map((toast, index) => ({
    ...toast,
    overflowIndex: index,
  }));
});

/**
 * Get all active toasts (visible + overflow)
 */
export const allToasts = derived(toastQueue, ($queue) => $queue.filter(t => t.visible));

/**
 * Get all toasts ever created in this session (including dismissed ones)
 * Used for alerts history/dropdown
 * CRITICAL: Returns a stable reference when queue hasn't changed
 */
export const allToastsHistory = derived(toastQueue, ($queue) => {
  // Return all toasts sorted by creation time (newest first)
  // Create a new array only when queue actually changes
  if (!$queue || $queue.length === 0) {
    return [];
  }
  return [...$queue].sort((a, b) => b.createdAt - a.createdAt);
});

// ============ Functions ============

/**
 * Generate a unique toast ID
 */
function generateToastId(): string {
  return `toast-${Date.now()}-${toastIdCounter++}`;
}

/**
 * Update toast positions (visible vs overflow)
 * CRITICAL: Returns a new array to ensure Svelte reactivity works correctly
 */
function updateToastPositions(): void {
  const config = getToastConfig();
  toastQueue.update((queue) => {
    // Create a new array to ensure reactivity
    let newQueue = queue.map(toast => ({ ...toast }));
    
    const visible = newQueue.filter(t => t.visible && !t.inOverflow);
    const overflow = newQueue.filter(t => t.visible && t.inOverflow);
    
    // If we have more visible toasts than maxVisible, move extras to overflow
    if (visible.length > config.maxVisible) {
      const toMove = visible.slice(config.maxVisible);
      toMove.forEach((toast, index) => {
        const queueIndex = newQueue.findIndex(t => t.id === toast.id);
        if (queueIndex >= 0) {
          newQueue[queueIndex] = {
            ...newQueue[queueIndex],
            inOverflow: true,
            overflowIndex: overflow.length + index
          };
        }
      });
    }
    
    // If we have space, promote overflow toasts to visible
    if (visible.length < config.maxVisible && overflow.length > 0) {
      const toPromote = overflow.slice(0, config.maxVisible - visible.length);
      toPromote.forEach((toast) => {
        const queueIndex = newQueue.findIndex(t => t.id === toast.id);
        if (queueIndex >= 0) {
          newQueue[queueIndex] = {
            ...newQueue[queueIndex],
            inOverflow: false,
            overflowIndex: 0
          };
        }
      });
    }
    
    // Update overflow indices for remaining overflow toasts
    const remainingOverflow = newQueue.filter(t => t.visible && t.inOverflow);
    remainingOverflow.forEach((toast, index) => {
      const queueIndex = newQueue.findIndex(t => t.id === toast.id);
      if (queueIndex >= 0) {
        newQueue[queueIndex] = {
          ...newQueue[queueIndex],
          overflowIndex: index
        };
      }
    });
    
    return newQueue;
  });
}

/**
 * Check if two toasts are duplicates (same message, type, title, action)
 */
function isDuplicateToast(a: Toast, b: ToastOptions): boolean {
  return (
    a.message === b.message &&
    a.type === (b.type || 'info') &&
    a.title === b.title &&
    a.action?.label === b.action?.label &&
    a.persistent === (b.persistent ?? false)
  );
}

/**
 * Show a new toast notification
 * Merges duplicate consecutive toasts (like activity log)
 */
export function showToast(options: ToastOptions): string {
  const config = getToastConfig();
  let mergedId: string | null = null;
  
  // Check for duplicates in visible toasts first
  toastQueue.update((queue) => {
    // Find the first visible toast that matches
    const visibleToasts = queue.filter(t => t.visible);
    const duplicateIndex = visibleToasts.findIndex(t => isDuplicateToast(t, options));
    
    if (duplicateIndex >= 0) {
      // Merge with existing toast - increment count and update timestamp
      const duplicate = visibleToasts[duplicateIndex];
      const queueIndex = queue.findIndex(t => t.id === duplicate.id);
      
      if (queueIndex >= 0) {
        mergedId = duplicate.id;
        const updatedToast: Toast = {
          ...duplicate,
          createdAt: Date.now(), // Update to most recent timestamp
          count: (duplicate.count || 1) + 1
        };
        
        // Replace the duplicate in queue
        const newQueue = [...queue];
        newQueue[queueIndex] = updatedToast;
        return newQueue;
      }
    }
    
    // No duplicate found - create new toast
    const id = generateToastId();
    const toast: Toast = {
      id,
      message: options.message,
      type: options.type || 'info',
      duration: options.persistent ? 0 : (options.duration ?? config.defaultDuration),
      persistent: options.persistent ?? false,
      action: options.action,
      title: options.title,
      icon: options.icon,
      createdAt: Date.now(),
      visible: true,
      inOverflow: false,
      overflowIndex: 0,
      count: 1
    };
    
    mergedId = id;
    return [...queue, toast];
  });
  
  // Update positions
  updateToastPositions();
  
  // Note: Auto-dismiss is disabled by default
  // To enable auto-dismiss, set duration > 0 and persistent: false
  // Most toasts should be manually dismissed to preserve history in alerts menu
  
  return mergedId || '';
}

/**
 * Dismiss a toast by ID
 * Note: Toasts are kept in history for alerts dropdown, just marked as not visible
 * CRITICAL: Returns a new array to ensure Svelte reactivity works correctly
 */
export function dismissToast(id: string): void {
  toastQueue.update((queue) => {
    const toastIndex = queue.findIndex(t => t.id === id);
    if (toastIndex >= 0) {
      // Create a new array with the updated toast to ensure reactivity
      const newQueue = [...queue];
      newQueue[toastIndex] = {
        ...newQueue[toastIndex],
        visible: false
      };
      return newQueue;
    }
    return queue;
  });
  
  // Update positions after dismissal
  setTimeout(() => {
    updateToastPositions();
  }, 350);
}

/**
 * Dismiss all toasts
 * Note: Toasts are kept in history for alerts dropdown, just marked as not visible
 * CRITICAL: Returns a new array to ensure Svelte reactivity works correctly
 * @param clearHistory - If true, removes all toasts from history. Default: false
 */
export function dismissAllToasts(clearHistory: boolean = false): void {
  toastQueue.update((queue) => {
    // Create new array with all toasts marked as not visible
    const newQueue = queue.map(toast => ({
      ...toast,
      visible: false
    }));
    return newQueue;
  });
  
  // Only clear history if explicitly requested
  if (clearHistory) {
    setTimeout(() => {
      toastQueue.set([]);
    }, 300);
  }
}

/**
 * Convenience functions for common toast types
 */
export function showSuccess(message: string, options?: Omit<ToastOptions, 'message' | 'type'>): string {
  return showToast({ ...options, message, type: 'success' });
}

export function showError(message: string, options?: Omit<ToastOptions, 'message' | 'type'>): string {
  return showToast({ ...options, message, type: 'error', persistent: options?.persistent ?? false });
}

export function showInfo(message: string, options?: Omit<ToastOptions, 'message' | 'type'>): string {
  return showToast({ ...options, message, type: 'info' });
}

export function showWarning(message: string, options?: Omit<ToastOptions, 'message' | 'type'>): string {
  return showToast({ ...options, message, type: 'warning' });
}

// Export the queue store for direct access if needed
export { toastQueue };

