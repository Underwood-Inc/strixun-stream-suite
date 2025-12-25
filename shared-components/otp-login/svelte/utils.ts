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
export function portal(node: HTMLElement, target: HTMLElement | null | undefined) {
  if (!target) {
    console.warn('[portal] Target is null or undefined, cannot portal node');
    return {
      update() {},
      destroy() {}
    };
  }
  
  try {
    target.appendChild(node);
  } catch (error) {
    console.error('[portal] Failed to append node to target:', error);
    return {
      update() {},
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }
  
  return {
    update(newTarget: HTMLElement | null | undefined) {
      if (!newTarget) {
        console.warn('[portal] New target is null or undefined');
        return;
      }
      if (newTarget !== target) {
        try {
          newTarget.appendChild(node);
          target = newTarget;
        } catch (error) {
          console.error('[portal] Failed to update portal target:', error);
        }
      }
    },
    destroy() {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
  };
}

