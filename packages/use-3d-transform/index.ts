/**
 * @strixun/use-3d-transform
 * React hook for managing 3D transform state and calculations
 * Handles rotation values, flip state, and hover tilt calculations
 */

import { useRef, useCallback, RefObject } from 'react';

/**
 * 3D transform values
 */
export interface Transform3D {
  /** Rotation on X axis (degrees) */
  rotateX: number;
  /** Rotation on Y axis (degrees) */
  rotateY: number;
  /** Flip rotation on Y axis (0 or 180 degrees) */
  flipY: number;
  /** Hover tilt on X axis (degrees) */
  hoverX: number;
  /** Hover tilt on Y axis (degrees) */
  hoverY: number;
}

/**
 * Configuration for the 3D transform hook
 */
export interface Use3DTransformConfig {
  /** Initial rotation on X axis (default: 0) */
  initialRotateX?: number;
  /** Initial rotation on Y axis (default: 0) */
  initialRotateY?: number;
  /** Initial flip state (default: false) */
  initialFlipped?: boolean;
  /** Whether to apply hover tilt when not flipped (default: true) */
  enableHoverTilt?: boolean;
}

/**
 * Return value from use3DTransform hook
 */
export interface Use3DTransformReturn {
  /** Current transform values */
  transform: Transform3D;
  /** Reference to the element that should receive the transform */
  elementRef: RefObject<HTMLElement>;
  /** Update transform values */
  updateTransform: (values: Partial<Transform3D>) => void;
  /** Get the CSS transform string */
  getTransformString: () => string;
  /** Reset all transform values to initial state */
  reset: () => void;
  /** Set flip state */
  setFlipped: (flipped: boolean) => void;
  /** Get current flip state */
  isFlipped: () => boolean;
}

/**
 * React hook for managing 3D transform state
 * 
 * Manages rotation values, flip state, and hover tilt calculations.
 * Provides a clean API for updating transforms and getting CSS transform strings.
 * 
 * @param config - Configuration options
 * @returns Transform state and control functions
 * 
 * @example
 * ```tsx
 * const { elementRef, updateTransform, getTransformString, setFlipped } = use3DTransform({
 *   initialFlipped: false,
 *   enableHoverTilt: true
 * });
 * 
 * // Update hover tilt
 * updateTransform({ hoverX: 10, hoverY: -5 });
 * 
 * // Flip the card
 * setFlipped(true);
 * 
 * // Apply transform
 * <div ref={elementRef} style={{ transform: getTransformString() }}>
 *   Card content
 * </div>
 * ```
 */
export function use3DTransform(
  config: Use3DTransformConfig = {}
): Use3DTransformReturn {
  const {
    initialRotateX = 0,
    initialRotateY = 0,
    initialFlipped = false,
    enableHoverTilt = true
  } = config;

  const elementRef = useRef<HTMLElement>(null);
  const transformRef = useRef<Transform3D>({
    rotateX: initialRotateX,
    rotateY: initialRotateY,
    flipY: initialFlipped ? 180 : 0,
    hoverX: 0,
    hoverY: 0
  });

  const isFlippedRef = useRef(initialFlipped);

  /**
   * Calculate the final transform string
   */
  const calculateTransform = useCallback((): string => {
    const { rotateX, rotateY, flipY, hoverX, hoverY } = transformRef.current;
    const isFlipped = isFlippedRef.current;

    // When flipped, use drag rotation. When not flipped, add hover tilt
    const finalRotateX = isFlipped ? rotateX : rotateX + (enableHoverTilt ? hoverX : 0);
    const finalRotateY = isFlipped ? rotateY : rotateY + (enableHoverTilt ? hoverY : 0);

    return `rotateY(${flipY + finalRotateY}deg) rotateX(${finalRotateX}deg)`;
  }, [enableHoverTilt]);

  /**
   * Update the element's transform style
   */
  const applyTransform = useCallback(() => {
    if (elementRef.current) {
      elementRef.current.style.transform = calculateTransform();
    }
  }, [calculateTransform]);

  /**
   * Update transform values
   */
  const updateTransform = useCallback((values: Partial<Transform3D>) => {
    transformRef.current = {
      ...transformRef.current,
      ...values
    };
    applyTransform();
  }, [applyTransform]);

  /**
   * Get the CSS transform string
   */
  const getTransformString = useCallback((): string => {
    return calculateTransform();
  }, [calculateTransform]);

  /**
   * Reset all transform values to initial state
   */
  const reset = useCallback(() => {
    transformRef.current = {
      rotateX: initialRotateX,
      rotateY: initialRotateY,
      flipY: initialFlipped ? 180 : 0,
      hoverX: 0,
      hoverY: 0
    };
    isFlippedRef.current = initialFlipped;
    applyTransform();
  }, [initialRotateX, initialRotateY, initialFlipped, applyTransform]);

  /**
   * Set flip state
   */
  const setFlipped = useCallback((flipped: boolean) => {
    isFlippedRef.current = flipped;
    transformRef.current.flipY = flipped ? 180 : 0;
    applyTransform();
  }, [applyTransform]);

  /**
   * Get current flip state
   */
  const isFlipped = useCallback((): boolean => {
    return isFlippedRef.current;
  }, []);

  // Initialize transform on mount
  applyTransform();

  return {
    transform: { ...transformRef.current },
    elementRef,
    updateTransform,
    getTransformString,
    reset,
    setFlipped,
    isFlipped
  };
}
