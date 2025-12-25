/**
 * OTP Login Utility Functions
 * 
 * Shared utility functions for OTP login components
 */

/**
 * Generate unique portal container ID
 */
export function generatePortalId(): string {
  const prefix = 'otp-login-modal-portal';
  const unique = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  return `${prefix}-${unique}`;
}

/**
 * Portal action to render modal at body level
 */
export function portal(node: HTMLElement, target: HTMLElement) {
  target.appendChild(node);
  return {
    update(newTarget: HTMLElement) {
      if (newTarget !== target) {
        newTarget.appendChild(node);
        target = newTarget;
      }
    },
    destroy() {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
  };
}

