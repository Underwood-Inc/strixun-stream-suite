/**
 * Toast Notification System Configuration
 * 
 * Centralized configuration for the toast notification system.
 * This file controls the behavior and appearance of toasts.
 */

export interface ToastConfig {
  /**
   * Maximum number of toasts to display in the main stack
   * Toasts beyond this count will be shown in the 3D card deck view
   */
  maxVisible: number;
  
  /**
   * Default duration for auto-dismissing toasts (in milliseconds)
   * Set to 0 or negative to disable auto-dismiss
   */
  defaultDuration: number;
  
  /**
   * Position of the toast container
   */
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  
  /**
   * Spacing between stacked toasts (in pixels)
   */
  stackSpacing: number;
  
  /**
   * Angle for the 3D card deck view (in degrees)
   */
  cardDeckAngle: number;
  
  /**
   * Offset for each card in the deck (in pixels)
   */
  cardDeckOffset: number;
  
  /**
   * Z-index for the toast container
   */
  zIndex: number;
}

/**
 * Default toast configuration
 * Note: defaultDuration is set to 0 to disable auto-dismiss by default
 * Toasts should be manually dismissed to preserve history in alerts menu
 */
export const defaultToastConfig: ToastConfig = {
  maxVisible: 4,
  defaultDuration: 0, // Disabled by default - toasts require manual dismissal
  position: 'top-right',
  stackSpacing: 12,
  cardDeckAngle: 35,
  cardDeckOffset: 8,
  zIndex: 99999,
};

/**
 * Get the current toast configuration
 * Can be extended to load from user preferences or environment variables
 */
export function getToastConfig(): ToastConfig {
  // In the future, this could load from localStorage or user preferences
  return { ...defaultToastConfig };
}

