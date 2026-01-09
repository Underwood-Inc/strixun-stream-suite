/**
 * @strixun/use-flip-card
 * React hook combining 3D transforms, cursor tracking, and flip animations
 * Provides complete interactive card functionality with flip, drag, and hover effects
 */

import { useState, useRef, useCallback, useEffect, RefObject } from 'react';
import { use3DTransform, type Use3DTransformConfig } from '@strixun/use-3d-transform';
import { useCursorTracking, type UseCursorTrackingConfig } from '@strixun/use-cursor-tracking';
import { animateFlip, type FlipAnimationConfig } from '@strixun/animation-utils';

/**
 * Configuration for flip card hook
 */
export interface UseFlipCardConfig extends Use3DTransformConfig, UseCursorTrackingConfig {
  /** Flip animation duration in milliseconds (default: 600) */
  flipDuration?: number;
  /** Drag sensitivity multiplier (default: 0.5) */
  dragSensitivity?: number;
  /** Maximum drag rotation in degrees (default: 45) */
  maxDragRotation?: number;
  /** Click movement threshold in pixels to distinguish click from drag (default: 5) */
  clickThreshold?: number;
  /** Optional ref to element to watch for cursor tracking */
  watchElementRef?: RefObject<HTMLElement>;
}

/**
 * Drag state
 */
export interface DragState {
  /** Whether currently dragging */
  isDragging: boolean;
  /** Starting drag position */
  startPosition: { x: number; y: number } | null;
}

/**
 * Return value from useFlipCard hook
 */
export interface UseFlipCardReturn {
  /** Reference to the card element that receives transforms */
  cardRef: RefObject<HTMLElement>;
  /** Reference to element being watched for cursor (if watchElementRef not provided) */
  watchElementRef: RefObject<HTMLElement>;
  /** Whether card is flipped */
  isFlipped: boolean;
  /** Whether flip animation is in progress */
  isAnimating: boolean;
  /** Current drag state */
  dragState: DragState;
  /** Current cursor position */
  cursorPosition: { x: number; y: number };
  /** Current rotation values */
  rotation: { rotateX: number; rotateY: number };
  /** CSS transform string to apply */
  transformString: string;
  /** Flip the card */
  flip: () => void;
  /** Handle mouse down (for click detection and drag) */
  handleMouseDown: (e: React.MouseEvent) => void;
  /** Handle mouse move (for click detection) */
  handleMouseMove: (e: React.MouseEvent) => void;
  /** Handle click (triggers flip) */
  handleClick: (e: React.MouseEvent) => void;
  /** Handle drag move (when flipped) */
  handleDragMove: (e: MouseEvent) => void;
  /** Handle mouse up (ends drag) */
  handleMouseUp: () => void;
  /** Cursor tracking handlers (for hover tilt) */
  cursorHandlers: {
    onMouseMove: (e: MouseEvent | React.MouseEvent) => void;
    onMouseLeave: () => void;
  };
  /** Reset all state */
  reset: () => void;
}

/**
 * React hook for interactive flip card with 3D transforms, cursor tracking, and drag
 * 
 * Combines 3D transform management, cursor tracking, and flip animations
 * into a single cohesive hook. Handles click-to-flip and drag-to-rotate when flipped.
 * 
 * @param config - Configuration options
 * @returns Complete flip card state and handlers
 * 
 * @example
 * ```tsx
 * const {
 *   cardRef,
 *   isFlipped,
 *   transformString,
 *   handleClick,
 *   handleMouseDown,
 *   handleMouseMove,
 *   cursorHandlers
 * } = useFlipCard({
 *   maxRotation: 28,
 *   flipDuration: 600
 * });
 * 
 * <div
 *   ref={cardRef}
 *   onClick={handleClick}
 *   onMouseDown={handleMouseDown}
 *   onMouseMove={handleMouseMove}
 *   {...cursorHandlers}
 *   style={{ transform: transformString }}
 * >
 *   Card content
 * </div>
 * ```
 */
export function useFlipCard(
  config: UseFlipCardConfig = {}
): UseFlipCardReturn {
  const {
    flipDuration = 600,
    dragSensitivity = 0.5,
    maxDragRotation = 45,
    clickThreshold = 5,
    watchElementRef: externalWatchRef,
    ...restConfig
  } = config;

  const [isFlipped, setIsFlipped] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startPosition: null
  });

  const cardRef = useRef<HTMLElement>(null);
  const clickStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef(false);
  const isFlippedRef = useRef(false);
  const animationCancelRef = useRef<(() => void) | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; rotateX: number; rotateY: number } | null>(null);

  // Keep refs in sync
  useEffect(() => {
    isFlippedRef.current = isFlipped;
  }, [isFlipped]);

  // 3D transform hook
  const transform = use3DTransform({
    initialFlipped: false,
    enableHoverTilt: !isFlipped,
    ...restConfig
  });

  // Cursor tracking hook
  const cursorTracking = useCursorTracking({
    watchElementRef: externalWatchRef,
    enabled: !isFlipped && !isAnimating,
    ...restConfig
  });

  // Update transform with cursor tracking values
  useEffect(() => {
    if (!isFlipped && !isAnimating) {
      transform.updateTransform({
        hoverX: cursorTracking.rotation.rotateX,
        hoverY: cursorTracking.rotation.rotateY
      });
    }
  }, [cursorTracking.rotation, isFlipped, isAnimating, transform]);

  /**
   * Handle mouse down for click detection and drag
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    clickStartRef.current = { x: e.clientX, y: e.clientY };
    hasMovedRef.current = false;

    // If flipped, start drag
    if (isFlipped && !isAnimating) {
      e.preventDefault();
      e.stopPropagation();
      setDragState({
        isDragging: true,
        startPosition: { x: e.clientX, y: e.clientY }
      });
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        rotateX: transform.transform.rotateX,
        rotateY: transform.transform.rotateY
      };
    }
  }, [isFlipped, isAnimating, transform]);

  /**
   * Handle mouse move for click detection
   */
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (clickStartRef.current) {
      const deltaX = Math.abs(e.clientX - clickStartRef.current.x);
      const deltaY = Math.abs(e.clientY - clickStartRef.current.y);
      if (deltaX > clickThreshold || deltaY > clickThreshold) {
        hasMovedRef.current = true;
      }
    }
  }, [clickThreshold]);

  /**
   * Handle drag move (when flipped)
   */
  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || !dragStartRef.current || !isFlipped || !cardRef.current) {
      return;
    }

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    const newRotateY = dragStartRef.current.rotateY + deltaX * dragSensitivity;
    const newRotateX = dragStartRef.current.rotateX - deltaY * dragSensitivity;

    const clampedRotateY = Math.max(-maxDragRotation, Math.min(maxDragRotation, newRotateY));
    const clampedRotateX = Math.max(-maxDragRotation, Math.min(maxDragRotation, newRotateX));

    transform.updateTransform({
      rotateX: clampedRotateX,
      rotateY: clampedRotateY
    });
  }, [dragState.isDragging, isFlipped, dragSensitivity, maxDragRotation, transform]);

  /**
   * Handle mouse up (end drag)
   */
  const handleMouseUp = useCallback(() => {
    setDragState({
      isDragging: false,
      startPosition: null
    });
    dragStartRef.current = null;
  }, []);

  // Global mouse listeners for dragging
  useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isDragging, handleDragMove, handleMouseUp]);

  /**
   * Flip the card
   */
  const flip = useCallback(() => {
    if (isAnimating) return;

    // Cancel any existing animation
    if (animationCancelRef.current) {
      animationCancelRef.current();
    }

    // Clear hover values
    cursorTracking.reset();
    transform.updateTransform({ hoverX: 0, hoverY: 0 });

    setIsAnimating(true);
    const newFlipped = !isFlipped;
    const targetRotateY = newFlipped ? 180 : 0;

    if (cardRef.current) {
      const startRotateY = isFlipped ? 180 : 0;
      const startRotateX = transform.transform.rotateX;

      const flipConfig: FlipAnimationConfig = {
        startRotateY,
        targetRotateY,
        startRotateX,
        targetRotateX: 0,
        duration: flipDuration
      };

      animationCancelRef.current = animateFlip(
        cardRef.current,
        flipConfig,
        undefined,
        () => {
          isFlippedRef.current = newFlipped;
          setIsFlipped(newFlipped);
          setIsAnimating(false);
          transform.updateTransform({
            rotateX: 0,
            rotateY: 0,
            flipY: newFlipped ? 180 : 0,
            hoverX: 0,
            hoverY: 0
          });
          animationCancelRef.current = null;
        }
      );
    }
  }, [isFlipped, isAnimating, flipDuration, transform, cursorTracking]);

  /**
   * Handle click (triggers flip)
   */
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Don't flip if dragging, animating, or if mouse moved (was a drag)
    if (dragState.isDragging || isAnimating || hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      clickStartRef.current = null;
      hasMovedRef.current = false;
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }

    flip();

    clickStartRef.current = null;
    hasMovedRef.current = false;
  }, [dragState.isDragging, isAnimating, flip]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    // Cancel animations
    if (animationCancelRef.current) {
      animationCancelRef.current();
      animationCancelRef.current = null;
    }

    // Reset state
    setIsFlipped(false);
    setIsAnimating(false);
    setDragState({ isDragging: false, startPosition: null });
    clickStartRef.current = null;
    hasMovedRef.current = false;
    dragStartRef.current = null;
    isFlippedRef.current = false;

    // Reset hooks
    transform.reset();
    cursorTracking.reset();
  }, [transform, cursorTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationCancelRef.current) {
        animationCancelRef.current();
      }
    };
  }, []);

  return {
    cardRef,
    watchElementRef: cursorTracking.elementRef,
    isFlipped,
    isAnimating,
    dragState,
    cursorPosition: cursorTracking.cursorPosition,
    rotation: {
      rotateX: transform.transform.rotateX + (isFlipped ? 0 : cursorTracking.rotation.rotateX),
      rotateY: transform.transform.rotateY + (isFlipped ? 0 : cursorTracking.rotation.rotateY)
    },
    transformString: transform.getTransformString(),
    flip,
    handleMouseDown,
    handleMouseMove,
    handleClick,
    handleDragMove,
    handleMouseUp,
    cursorHandlers: {
      onMouseMove: cursorTracking.handleMouseMove,
      onMouseLeave: cursorTracking.handleMouseLeave
    },
    reset
  };
}
