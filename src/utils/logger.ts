/**
 * Unified Logging Utility
 * 
 * Replaces all console.log/error/warn/debug calls with store-based logging
 * Falls back to console if store is not available (shouldn't happen after bootstrap)
 */

import type { LogType } from '../stores/activity-log';

/**
 * Get the addLogEntry function, importing it if needed
 */
async function getAddLogEntry(): Promise<((message: string, type?: LogType, flair?: string, icon?: string) => void) | null> {
  // Check if already available on window
  if (typeof window !== 'undefined' && (window as any).addLogEntry) {
    return (window as any).addLogEntry;
  }
  
  // Try to import it directly
  try {
    const { addLogEntry } = await import('../stores/activity-log');
    return addLogEntry;
  } catch (error) {
    return null;
  }
}

/**
 * Log a message to the activity log store
 */
export async function log(message: string, type: LogType = 'info', flair?: string, icon?: string): Promise<void> {
  const addLogEntry = await getAddLogEntry();
  if (addLogEntry) {
    addLogEntry(message, type, flair, icon);
  } else {
    // Fallback to console only if store is completely unavailable
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

/**
 * Log an info message
 */
export function logInfo(message: string, flair?: string, icon?: string): void {
  log(message, 'info', flair, icon).catch(() => {
    console.log(`[INFO] ${message}`);
  });
}

/**
 * Log a success message
 */
export function logSuccess(message: string, flair?: string, icon?: string): void {
  log(message, 'success', flair, icon).catch(() => {
    console.log(`[SUCCESS] ${message}`);
  });
}

/**
 * Log an error message
 */
export function logError(message: string, flair?: string, icon?: string): void {
  log(message, 'error', flair, icon).catch(() => {
    console.error(`[ERROR] ${message}`);
  });
}

/**
 * Log a warning message
 */
export function logWarning(message: string, flair?: string, icon?: string): void {
  log(message, 'warning', flair, icon).catch(() => {
    console.warn(`[WARNING] ${message}`);
  });
}

/**
 * Log a debug message
 */
export function logDebug(message: string, flair?: string, icon?: string): void {
  log(message, 'debug', flair, icon).catch(() => {
    console.debug(`[DEBUG] ${message}`);
  });
}

/**
 * Synchronous version for immediate logging (uses window.addLogEntry if available)
 */
export function logSync(message: string, type: LogType = 'info', flair?: string, icon?: string): void {
  // Try to use window.addLogEntry if available (set up by bootstrap)
  if (typeof window !== 'undefined' && (window as any).addLogEntry && typeof (window as any).addLogEntry === 'function') {
    try {
      (window as any).addLogEntry(message, type, flair, icon);
      return;
    } catch (err) {
      // If window.addLogEntry fails, fall through to console
      console.warn('[logSync] window.addLogEntry failed:', err);
    }
  }
  
  // Fallback to console if window.addLogEntry not available or failed
  const consoleMethod = type === 'error' ? console.error : 
                        type === 'warning' ? console.warn :
                        type === 'debug' ? console.debug : console.log;
  consoleMethod(`[${type.toUpperCase()}] ${message}`);
}

/**
 * Replace console methods with store-based logging
 * Call this early in bootstrap to intercept all console calls
 */
export function interceptConsole(): void {
  if (typeof window === 'undefined') return;
  
  const originalLog = console.log.bind(console);
  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalDebug = console.debug.bind(console);
  
  console.log = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logSync(message, 'info');
    originalLog(...args); // Also log to console for debugging
  };
  
  console.error = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logSync(message, 'error', 'ERROR');
    originalError(...args);
  };
  
  console.warn = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logSync(message, 'warning', 'WARNING');
    originalWarn(...args);
  };
  
  console.debug = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logSync(message, 'debug');
    originalDebug(...args);
  };
}

