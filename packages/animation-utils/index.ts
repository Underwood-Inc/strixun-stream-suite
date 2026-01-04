/**
 * @strixun/animation-utils
 * Framework-agnostic animation utilities for 3D transforms and easing functions
 * Pure functions with no dependencies - can be used in any JavaScript/TypeScript environment
 */

/**
 * Easing function types
 */
export type EasingFunction = (t: number) => number;

/**
 * Animation configuration for flip animations
 */
export interface FlipAnimationConfig {
  /** Starting rotation on Y axis (degrees) */
  startRotateY: number;
  /** Target rotation on Y axis (degrees) */
  targetRotateY: number;
  /** Starting rotation on X axis (degrees) */
  startRotateX: number;
  /** Target rotation on X axis (degrees) */
  targetRotateX: number;
  /** Animation duration in milliseconds */
  duration: number;
  /** Optional easing function (defaults to easeInOutCubic) */
  easing?: EasingFunction;
}

/**
 * Animation configuration for hover reset animations
 */
export interface HoverResetAnimationConfig {
  /** Starting hover rotation on X axis (degrees) */
  startHoverX: number;
  /** Starting hover rotation on Y axis (degrees) */
  startHoverY: number;
  /** Animation duration in milliseconds */
  duration: number;
  /** Optional easing function (defaults to easeOutCubic) */
  easing?: EasingFunction;
}

/**
 * Callback function for animation updates
 */
export type AnimationUpdateCallback = (progress: number, currentValue: number) => void;

/**
 * Callback function for hover reset updates
 */
export type HoverResetUpdateCallback = (hoverX: number, hoverY: number) => void;

/**
 * Animation cancel function returned by animation functions
 */
export type AnimationCancel = () => void;

/**
 * Cubic ease-in-out function
 * Starts slow, accelerates, then decelerates
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Cubic ease-out function
 * Starts fast, then decelerates smoothly
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Cubic ease-in function
 * Starts slow, then accelerates
 */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/**
 * Linear interpolation (no easing)
 */
export function linear(t: number): number {
  return t;
}

/**
 * Animate a 3D flip transformation using requestAnimationFrame
 * 
 * @param element - The HTML element to animate
 * @param config - Animation configuration
 * @param onUpdate - Optional callback called on each frame with progress and current rotateY value
 * @param onComplete - Optional callback called when animation completes
 * @returns Cancel function to stop the animation
 * 
 * @example
 * ```ts
 * const cancel = animateFlip(
 *   cardElement,
 *   {
 *     startRotateY: 0,
 *     targetRotateY: 180,
 *     startRotateX: 0,
 *     targetRotateX: 0,
 *     duration: 600
 *   },
 *   (progress, currentRotateY) => {
 *     console.log(`Progress: ${progress}, RotateY: ${currentRotateY}`);
 *   },
 *   () => {
 *     console.log('Animation complete!');
 *   }
 * );
 * 
 * // Cancel animation if needed
 * cancel();
 * ```
 */
export function animateFlip(
  element: HTMLElement,
  config: FlipAnimationConfig,
  onUpdate?: (progress: number, currentRotateY: number, currentRotateX: number) => void,
  onComplete?: () => void
): AnimationCancel {
  const {
    startRotateY,
    targetRotateY,
    startRotateX,
    targetRotateX,
    duration,
    easing = easeInOutCubic
  } = config;

  const startTime = performance.now();
  let animationFrameId: number | null = null;
  let isCancelled = false;

  const animate = (currentTime: number) => {
    if (isCancelled || !element) {
      return;
    }

    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easing(progress);

    const currentRotateY = startRotateY + (targetRotateY - startRotateY) * eased;
    const currentRotateX = startRotateX + (targetRotateX - startRotateX) * eased;

    element.style.transform = `rotateY(${currentRotateY}deg) rotateX(${currentRotateX}deg)`;

    if (onUpdate) {
      onUpdate(progress, currentRotateY, currentRotateX);
    }

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      if (onComplete) {
        onComplete();
      }
    }
  };

  animationFrameId = requestAnimationFrame(animate);

  return () => {
    isCancelled = true;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
  };
}

/**
 * Animate hover rotation values smoothly back to zero
 * 
 * @param config - Animation configuration
 * @param onUpdate - Callback called on each frame with current hoverX and hoverY values
 * @param onComplete - Optional callback called when animation completes
 * @returns Cancel function to stop the animation
 * 
 * @example
 * ```ts
 * const cancel = animateHoverReset(
 *   {
 *     startHoverX: 15,
 *     startHoverY: -10,
 *     duration: 400
 *   },
 *   (hoverX, hoverY) => {
 *     // Update your transform with these values
 *     element.style.transform = `rotateX(${hoverX}deg) rotateY(${hoverY}deg)`;
 *   },
 *   () => {
 *     console.log('Reset complete!');
 *   }
 * );
 * ```
 */
export function animateHoverReset(
  config: HoverResetAnimationConfig,
  onUpdate: HoverResetUpdateCallback,
  onComplete?: () => void
): AnimationCancel {
  const {
    startHoverX,
    startHoverY,
    duration,
    easing = easeOutCubic
  } = config;

  const startTime = performance.now();
  let animationFrameId: number | null = null;
  let isCancelled = false;

  const animate = (currentTime: number) => {
    if (isCancelled) {
      return;
    }

    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easing(progress);

    const currentHoverX = startHoverX * (1 - eased);
    const currentHoverY = startHoverY * (1 - eased);

    onUpdate(currentHoverX, currentHoverY);

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      if (onComplete) {
        onComplete();
      }
    }
  };

  animationFrameId = requestAnimationFrame(animate);

  return () => {
    isCancelled = true;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
  };
}

/**
 * Linear interpolation between two values
 * 
 * @param start - Starting value
 * @param end - Ending value
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Clamp a value between min and max
 * 
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
