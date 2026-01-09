/**
 * @strixun/use-cursor-tracking
 * React hook for smooth cursor position tracking with interpolation
 * Tracks mouse position relative to an element and smoothly interpolates to target values
 */

import { useRef, useCallback, useEffect, RefObject } from 'react';
import { animateHoverReset, type HoverResetAnimationConfig } from '@strixun/animation-utils';

/**
 * Cursor position relative to element (-1 to 1)
 */
export interface CursorPosition {
  /** X position: -1 (left) to 1 (right) */
  x: number;
  /** Y position: -1 (top) to 1 (bottom) */
  y: number;
}

/**
 * Rotation values calculated from cursor position
 */
export interface CursorRotation {
  /** Rotation on X axis (degrees) */
  rotateX: number;
  /** Rotation on Y axis (degrees) */
  rotateY: number;
}

/**
 * Configuration for cursor tracking
 */
export interface UseCursorTrackingConfig {
  /** Maximum rotation in degrees (default: 28) */
  maxRotation?: number;
  /** Interpolation factor for smooth following (0-1, default: 0.15) */
  lerpFactor?: number;
  /** Duration for reset animation in milliseconds (default: 400) */
  resetDuration?: number;
  /** Debounce delay before starting reset animation in milliseconds (default: 100) */
  resetDebounce?: number;
  /** Optional ref to element to watch (if not provided, uses internal ref) */
  watchElementRef?: RefObject<HTMLElement>;
  /** Whether tracking is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Return value from useCursorTracking hook
 */
export interface UseCursorTrackingReturn {
  /** Reference to the element being watched (if watchElementRef not provided) */
  elementRef: RefObject<HTMLElement>;
  /** Current cursor position (-1 to 1) */
  cursorPosition: CursorPosition;
  /** Current rotation values */
  rotation: CursorRotation;
  /** Target rotation values (where we're animating to) */
  targetRotation: CursorRotation;
  /** Mouse move handler to attach to element */
  handleMouseMove: (e: MouseEvent | React.MouseEvent) => void;
  /** Mouse leave handler to attach to element */
  handleMouseLeave: () => void;
  /** Manually update target rotation */
  setTargetRotation: (rotation: CursorRotation) => void;
  /** Reset to zero position */
  reset: () => void;
  /** Enable/disable tracking */
  setEnabled: (enabled: boolean) => void;
}

/**
 * React hook for smooth cursor position tracking
 * 
 * Tracks mouse position relative to an element and smoothly interpolates
 * rotation values. Supports watching external elements via ref.
 * 
 * @param config - Configuration options
 * @returns Cursor tracking state and handlers
 * 
 * @example
 * ```tsx
 * const { elementRef, rotation, handleMouseMove, handleMouseLeave } = useCursorTracking({
 *   maxRotation: 28,
 *   lerpFactor: 0.15
 * });
 * 
 * <div
 *   ref={elementRef}
 *   onMouseMove={handleMouseMove}
 *   onMouseLeave={handleMouseLeave}
 *   style={{ transform: `rotateX(${rotation.rotateX}deg) rotateY(${rotation.rotateY}deg)` }}
 * >
 *   Card
 * </div>
 * ```
 * 
 * @example
 * ```tsx
 * // Watch external element
 * const cardRef = useRef<HTMLDivElement>(null);
 * const { rotation } = useCursorTracking({
 *   watchElementRef: cardRef
 * });
 * 
 * <div ref={cardRef}>Card</div>
 * ```
 */
export function useCursorTracking(
  config: UseCursorTrackingConfig = {}
): UseCursorTrackingReturn {
  const {
    maxRotation = 28,
    lerpFactor = 0.15,
    resetDuration = 400,
    resetDebounce = 100,
    watchElementRef,
    enabled = true
  } = config;

  const elementRef = useRef<HTMLElement>(null);
  const cursorPositionRef = useRef<CursorPosition>({ x: 0, y: 0 });
  const rotationRef = useRef<CursorRotation>({ rotateX: 0, rotateY: 0 });
  const targetRotationRef = useRef<CursorRotation>({ rotateX: 0, rotateY: 0 });
  const hoverTrackingCancelRef = useRef<(() => void) | null>(null);
  const hoverResetCancelRef = useRef<(() => void) | null>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const enabledRef = useRef(enabled);

  // Keep enabled ref in sync
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Get the element to watch
  const getWatchedElement = useCallback((): HTMLElement | null => {
    return watchElementRef?.current || elementRef.current;
  }, [watchElementRef]);

  /**
   * Start smooth tracking animation loop
   */
  const startHoverTracking = useCallback(() => {
    if (!enabledRef.current) return;

    // Cancel any existing tracking animation
    if (hoverTrackingCancelRef.current) {
      hoverTrackingCancelRef.current();
      hoverTrackingCancelRef.current = null;
    }

    let isRunning = true;
    let animationFrameId: number;

    const animate = () => {
      if (!isRunning || !enabledRef.current) {
        hoverTrackingCancelRef.current = null;
        return;
      }

      // Calculate difference from current to target
      const diffX = targetRotationRef.current.rotateX - rotationRef.current.rotateX;
      const diffY = targetRotationRef.current.rotateY - rotationRef.current.rotateY;

      // Check if we're close enough to target
      if (Math.abs(diffX) < 0.1 && Math.abs(diffY) < 0.1) {
        // Close enough, snap to target
        rotationRef.current.rotateX = targetRotationRef.current.rotateX;
        rotationRef.current.rotateY = targetRotationRef.current.rotateY;
        hoverTrackingCancelRef.current = null;
        return;
      }

      // Smoothly interpolate towards target
      rotationRef.current.rotateX += diffX * lerpFactor;
      rotationRef.current.rotateY += diffY * lerpFactor;

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    hoverTrackingCancelRef.current = () => {
      isRunning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [lerpFactor]);

  /**
   * Handle mouse move
   */
  const handleMouseMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!enabledRef.current) return;

    const watchedElement = getWatchedElement();
    if (!watchedElement) return;

    // Cancel any pending leave timeout
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }

    // Cancel any ongoing hover reset animation
    if (hoverResetCancelRef.current) {
      hoverResetCancelRef.current();
      hoverResetCancelRef.current = null;
    }

    // Get clientX/clientY
    const clientX = e.clientX;
    const clientY = e.clientY;

    const rect = watchedElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1; // -1 to 1
    const y = ((clientY - rect.top) / rect.height) * 2 - 1; // -1 to 1

    // Update cursor position
    cursorPositionRef.current = { x, y };

    // Calculate target rotation
    const targetRotateX = y * maxRotation * -1;
    const targetRotateY = x * maxRotation;

    // Update target values
    targetRotationRef.current = {
      rotateX: targetRotateX,
      rotateY: targetRotateY
    };

    // Start smooth tracking animation if not already running
    if (!hoverTrackingCancelRef.current) {
      startHoverTracking();
    }
  }, [maxRotation, getWatchedElement, startHoverTracking]);

  /**
   * Handle mouse leave
   */
  const handleMouseLeave = useCallback(() => {
    if (!enabledRef.current) return;

    // Clear any existing timeout
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }

    // Debounce before starting animation
    leaveTimeoutRef.current = setTimeout(() => {
      // Cancel any existing hover reset animation
      if (hoverResetCancelRef.current) {
        hoverResetCancelRef.current();
        hoverResetCancelRef.current = null;
      }

      // CRITICAL: Cancel hover tracking animation
      if (hoverTrackingCancelRef.current) {
        hoverTrackingCancelRef.current();
        hoverTrackingCancelRef.current = null;
      }

      // CRITICAL: Reset target values to 0
      targetRotationRef.current = { rotateX: 0, rotateY: 0 };

      // Get current rotation values to animate from
      const startRotateX = rotationRef.current.rotateX;
      const startRotateY = rotationRef.current.rotateY;

      // If already at rest, no need to animate
      if (Math.abs(startRotateX) < 0.1 && Math.abs(startRotateY) < 0.1) {
        rotationRef.current = { rotateX: 0, rotateY: 0 };
        cursorPositionRef.current = { x: 0, y: 0 };
        leaveTimeoutRef.current = null;
        return;
      }

      // Animate smoothly back to resting position
      const config: HoverResetAnimationConfig = {
        startHoverX: startRotateX,
        startHoverY: startRotateY,
        duration: resetDuration
      };

      hoverResetCancelRef.current = animateHoverReset(
        config,
        (currentRotateX, currentRotateY) => {
          rotationRef.current.rotateX = currentRotateX;
          rotationRef.current.rotateY = currentRotateY;
        },
        () => {
          // CRITICAL: Ensure final state is properly set
          rotationRef.current = { rotateX: 0, rotateY: 0 };
          targetRotationRef.current = { rotateX: 0, rotateY: 0 };
          cursorPositionRef.current = { x: 0, y: 0 };
          hoverResetCancelRef.current = null;
        }
      );

      leaveTimeoutRef.current = null;
    }, resetDebounce);
  }, [resetDuration, resetDebounce]);

  /**
   * Manually set target rotation
   */
  const setTargetRotation = useCallback((rotation: CursorRotation) => {
    targetRotationRef.current = rotation;
    if (!hoverTrackingCancelRef.current && enabledRef.current) {
      startHoverTracking();
    }
  }, [startHoverTracking]);

  /**
   * Reset to zero position
   */
  const reset = useCallback(() => {
    // Cancel all animations
    if (hoverTrackingCancelRef.current) {
      hoverTrackingCancelRef.current();
      hoverTrackingCancelRef.current = null;
    }
    if (hoverResetCancelRef.current) {
      hoverResetCancelRef.current();
      hoverResetCancelRef.current = null;
    }
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }

    // Reset all values
    rotationRef.current = { rotateX: 0, rotateY: 0 };
    targetRotationRef.current = { rotateX: 0, rotateY: 0 };
    cursorPositionRef.current = { x: 0, y: 0 };
  }, []);

  /**
   * Set enabled state
   */
  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
    if (!enabled) {
      reset();
    }
  }, [reset]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTrackingCancelRef.current) {
        hoverTrackingCancelRef.current();
      }
      if (hoverResetCancelRef.current) {
        hoverResetCancelRef.current();
      }
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    elementRef,
    cursorPosition: { ...cursorPositionRef.current },
    rotation: { ...rotationRef.current },
    targetRotation: { ...targetRotationRef.current },
    handleMouseMove,
    handleMouseLeave,
    setTargetRotation,
    reset,
    setEnabled
  };
}
