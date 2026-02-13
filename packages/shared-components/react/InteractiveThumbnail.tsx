/**
 * Interactive 3D Thumbnail Card Component
 * 
 * Agnostic, reusable 3D card with click-to-flip and drag-to-rotate functionality.
 * JavaScript-driven animations for smooth performance.
 * 
 * Features:
 * - Click to flip between front and back faces
 * - Drag to rotate when flipped (3D rotation)
 * - Hover tilt effect on front face (follows mouse)
 * - Shimmer effect on front face
 * - Smooth animations using requestAnimationFrame
 * - External element tracking (watch element for hover)
 * - Fully customizable content for both faces
 * 
 * @example
 * <InteractiveThumbnail
 *   frontContent={<img src="thumbnail.jpg" alt="Thumbnail" />}
 *   backContent={<div><h3>Title</h3><p>Description</p></div>}
 *   onFlip={(isFlipped) => console.log('Flipped:', isFlipped)}
 * />
 * 
 * @example
 * // With external hover tracking
 * const watchRef = useRef<HTMLDivElement>(null);
 * <div ref={watchRef}>
 *   <InteractiveThumbnail
 *     frontContent={<img src="thumbnail.jpg" />}
 *     backContent={<div>Details</div>}
 *     watchElementRef={watchRef}
 *   />
 * </div>
 */

import React, { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import styled from 'styled-components';

export interface InteractiveThumbnailTheme {
  colors: {
    bgSecondary: string;
    bgTertiary: string;
    border: string;
    textMuted: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
  };
}

export interface InteractiveThumbnailProps {
  /** Content to display on the front face (typically an image) */
  frontContent: ReactNode;
  /** Content to display on the back face (details, description, etc.) */
  backContent: ReactNode;
  /** Optional thumbnail URL for shimmer effect positioning */
  thumbnailUrl?: string;
  /** Optional ref to an element that should be watched for cursor tracking */
  watchElementRef?: React.RefObject<HTMLDivElement | null>;
  /** Callback when card flips */
  onFlip?: (isFlipped: boolean) => void;
  /** Optional theme overrides */
  theme?: InteractiveThumbnailTheme;
  /** Enable/disable shimmer effect on front face */
  enableShimmer?: boolean;
}

const CardContainer = styled.div`
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  perspective: 1200px;
  position: relative;
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  overflow: visible;
  flex-shrink: 0;
  flex-grow: 0;
`;

const CardInner = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  contain: layout size;
  will-change: transform;
`;

const CardFace = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'isBack',
})<{ isBack?: boolean }>`
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 4px;
  overflow: visible;
  transform-style: preserve-3d;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  ${props => props.isBack ? 'transform: rotateY(180deg) translateZ(0);' : 'transform: translateZ(0);'}
`;

const FrontWrapper = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  overflow: visible;
  border-radius: 4px;
  cursor: pointer;
`;

const ShimmerContainer = styled.div<{ $enabled: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 4px;
  pointer-events: none;
  z-index: 1;
  
  &::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      45deg,
      transparent 25%,
      rgba(255, 255, 255, 0.6) 40%,
      rgba(255, 255, 255, 1) 50%,
      rgba(255, 255, 255, 0.6) 60%,
      transparent 75%
    );
    opacity: ${props => props.$enabled ? '0' : '0'};
    pointer-events: none;
    border-radius: inherit;
    animation: shimmer-sweep 2.5s ease-in-out infinite;
    mix-blend-mode: overlay;
    will-change: transform, opacity;
  }
  
  @keyframes shimmer-sweep {
    0% {
      transform: translateX(-100%) translateY(-100%) rotate(45deg);
    }
    100% {
      transform: translateX(200%) translateY(200%) rotate(45deg);
    }
  }
`;

const FrontContent = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    -webkit-user-drag: none;
  }
`;

const BackWrapper = styled.div<{ $theme: InteractiveThumbnailTheme }>`
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, ${props => props.$theme.colors.bgSecondary}, ${props => props.$theme.colors.bgTertiary});
  border: 1px solid ${props => props.$theme.colors.border};
  border-radius: 4px;
  padding: ${props => props.$theme.spacing.md};
  padding-bottom: ${props => props.$theme.spacing.lg};
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        rgba(255, 255, 255, 0.02) 10px,
        rgba(255, 255, 255, 0.02) 20px
      );
    pointer-events: none;
    z-index: 0;
  }
`;

const BackContent = styled.div<{ $theme: InteractiveThumbnailTheme }>`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: ${props => props.$theme.spacing.sm};
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: ${props => props.$theme.spacing.xs};
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${props => props.$theme.colors.border};
    border-radius: 3px;
    
    &:hover {
      background: ${props => props.$theme.colors.textMuted};
    }
  }
  
  scrollbar-width: thin;
  scrollbar-color: ${props => props.$theme.colors.border} transparent;
`;

const FlipHint = styled.div<{ $theme: InteractiveThumbnailTheme }>`
  position: absolute;
  bottom: ${props => props.$theme.spacing.sm};
  right: ${props => props.$theme.spacing.sm};
  font-size: 0.625rem;
  color: ${props => props.$theme.colors.textMuted};
  opacity: 0.8;
  pointer-events: none;
  z-index: 10;
  text-align: right;
  line-height: 1.4;
  background: rgba(0, 0, 0, 0.5);
  padding: 4px 8px;
  border-radius: 3px;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
`;

// Default theme
const defaultTheme: InteractiveThumbnailTheme = {
  colors: {
    bgSecondary: '#2a2a2a',
    bgTertiary: '#333333',
    border: 'rgba(255, 255, 255, 0.2)',
    textMuted: '#808080',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
  },
};

// JavaScript animation using requestAnimationFrame
function animateFlip(
  element: HTMLElement,
  startRotateY: number,
  targetRotateY: number,
  startRotateX: number,
  targetRotateX: number,
  duration: number,
  onComplete?: () => void
) {
  const startTime = performance.now();
  let animationFrameId: number;

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease-in-out cubic
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    
    const currentRotateY = startRotateY + (targetRotateY - startRotateY) * eased;
    const currentRotateX = startRotateX + (targetRotateX - startRotateX) * eased;
    
    element.style.transform = `rotateY(${currentRotateY}deg) rotateX(${currentRotateX}deg)`;
    
    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      if (onComplete) onComplete();
    }
  };
  
  animationFrameId = requestAnimationFrame(animate);
  
  return () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  };
}

// JavaScript animation for smoothly returning hover tilt to resting position
function animateHoverReset(
  cardRef: React.RefObject<HTMLDivElement | null>,
  startHoverX: number,
  startHoverY: number,
  duration: number,
  onUpdate: (hoverX: number, hoverY: number) => void,
  onComplete?: () => void
) {
  const startTime = performance.now();
  let animationFrameId: number;

  const animate = (currentTime: number) => {
    if (!cardRef.current) {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      return;
    }

    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease-out for smooth deceleration (cubic ease-out)
    const eased = 1 - Math.pow(1 - progress, 3);
    
    const currentHoverX = startHoverX * (1 - eased);
    const currentHoverY = startHoverY * (1 - eased);
    
    onUpdate(currentHoverX, currentHoverY);
    
    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      if (onComplete) onComplete();
    }
  };
  
  animationFrameId = requestAnimationFrame(animate);
  
  return () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  };
}

export function InteractiveThumbnail({ 
  frontContent,
  backContent,
  watchElementRef,
  onFlip,
  theme = defaultTheme,
  enableShimmer = true,
}: InteractiveThumbnailProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const rotateXRef = useRef(0);
  const rotateYRef = useRef(0);
  const hoverRotateXRef = useRef(0);
  const hoverRotateYRef = useRef(0);
  const isFlippedRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; rotateX: number; rotateY: number } | null>(null);
  const animationCancelRef = useRef<(() => void) | null>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hoverResetCancelRef = useRef<(() => void) | null>(null);
  const hoverTrackingCancelRef = useRef<(() => void) | null>(null);
  const targetHoverXRef = useRef(0);
  const targetHoverYRef = useRef(0);
  const clickStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef(false);
  
  // Use the watched element ref if provided, otherwise fall back to wrapperRef
  const getWatchedElement = useCallback((): HTMLElement | null => {
    return watchElementRef?.current || wrapperRef.current;
  }, [watchElementRef]);

  // Keep refs in sync with state
  useEffect(() => {
    isFlippedRef.current = isFlipped;
  }, [isFlipped]);

  useEffect(() => {
    isAnimatingRef.current = isAnimating;
  }, [isAnimating]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Update transform directly via JavaScript
  const updateTransform = useCallback((rotateX: number, rotateY: number, flipY: number = 0, hoverX: number = 0, hoverY: number = 0) => {
    if (!cardRef.current) return;
    
    if (animationCancelRef.current) return;
    
    rotateXRef.current = rotateX;
    rotateYRef.current = rotateY;
    hoverRotateXRef.current = hoverX;
    hoverRotateYRef.current = hoverY;
    
    const currentlyFlipped = isFlippedRef.current;
    const finalRotateX = currentlyFlipped ? rotateX : rotateX + hoverX;
    const finalRotateY = currentlyFlipped ? rotateY : rotateY + hoverY;
    
    cardRef.current.style.transform = `rotateY(${flipY + finalRotateY}deg) rotateX(${finalRotateX}deg)`;
  }, []);

  const handleMouseDownForClick = useCallback((e: React.MouseEvent) => {
    clickStartRef.current = { x: e.clientX, y: e.clientY };
    hasMovedRef.current = false;
  }, []);

  const handleMouseMoveForClick = useCallback((e: React.MouseEvent) => {
    if (clickStartRef.current) {
      const deltaX = Math.abs(e.clientX - clickStartRef.current.x);
      const deltaY = Math.abs(e.clientY - clickStartRef.current.y);
      if (deltaX > 5 || deltaY > 5) {
        hasMovedRef.current = true;
      }
    }
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isDragging || isAnimating || hasMovedRef.current) {
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
    
    // Cancel any ongoing hover tracking or reset animations
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    if (hoverTrackingCancelRef.current) {
      hoverTrackingCancelRef.current();
      hoverTrackingCancelRef.current = null;
    }
    if (hoverResetCancelRef.current) {
      hoverResetCancelRef.current();
      hoverResetCancelRef.current = null;
    }
    
    hoverRotateXRef.current = 0;
    hoverRotateYRef.current = 0;
    targetHoverXRef.current = 0;
    targetHoverYRef.current = 0;
    
    setIsAnimating(true);
    const newFlipped = !isFlipped;
    const targetRotateY = newFlipped ? 180 : 0;
    
    if (animationCancelRef.current) {
      animationCancelRef.current();
    }
    
    if (cardRef.current) {
      const startRotateY = isFlipped ? 180 : 0;
      const startRotateX = rotateXRef.current;
      
      animationCancelRef.current = animateFlip(
        cardRef.current,
        startRotateY,
        targetRotateY,
        startRotateX,
        0,
        600,
        () => {
          isFlippedRef.current = newFlipped;
          setIsFlipped(newFlipped);
          setIsAnimating(false);
          rotateXRef.current = 0;
          rotateYRef.current = 0;
          hoverRotateXRef.current = 0;
          hoverRotateYRef.current = 0;
          animationCancelRef.current = null;
          updateTransform(0, 0, newFlipped ? 180 : 0, 0, 0);
          if (onFlip) onFlip(newFlipped);
        }
      );
    }
    
    clickStartRef.current = null;
    hasMovedRef.current = false;
  }, [isDragging, isAnimating, isFlipped, updateTransform, onFlip]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isFlipped || isAnimating) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      rotateX: rotateXRef.current,
      rotateY: rotateYRef.current,
    };
  }, [isFlipped, isAnimating]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current || !isFlipped || !cardRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    const newRotateY = dragStartRef.current.rotateY + deltaX * 0.5;
    const newRotateX = dragStartRef.current.rotateX - deltaY * 0.5;
    
    const clampedRotateY = Math.max(-45, Math.min(45, newRotateY));
    const clampedRotateX = Math.max(-45, Math.min(45, newRotateX));
    
    updateTransform(clampedRotateX, clampedRotateY, 180, 0, 0);
  }, [isDragging, isFlipped, updateTransform]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Global mouse listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleDragMove, handleMouseUp]);

  // Initialize transform on mount
  useEffect(() => {
    if (cardRef.current) {
      updateTransform(0, 0, 0, 0, 0);
    }
  }, [updateTransform]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
      }
    };
  }, []);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationCancelRef.current) {
        animationCancelRef.current();
      }
      if (hoverResetCancelRef.current) {
        hoverResetCancelRef.current();
      }
      if (hoverTrackingCancelRef.current) {
        hoverTrackingCancelRef.current();
      }
    };
  }, []);

  // Smooth hover tracking animation loop
  const startHoverTracking = useCallback(() => {
    if (hoverTrackingCancelRef.current) {
      hoverTrackingCancelRef.current();
      hoverTrackingCancelRef.current = null;
    }

    let isRunning = true;
    let animationFrameId: number;
    const lerpFactor = 0.15;

    const animate = () => {
      if (!isRunning || isFlippedRef.current || isAnimatingRef.current || isDraggingRef.current || !cardRef.current) {
        hoverTrackingCancelRef.current = null;
        return;
      }

      const diffX = targetHoverXRef.current - hoverRotateXRef.current;
      const diffY = targetHoverYRef.current - hoverRotateYRef.current;

      if (Math.abs(diffX) < 0.1 && Math.abs(diffY) < 0.1) {
        hoverRotateXRef.current = targetHoverXRef.current;
        hoverRotateYRef.current = targetHoverYRef.current;
        updateTransform(rotateXRef.current, rotateYRef.current, 0, targetHoverXRef.current, targetHoverYRef.current);
        hoverTrackingCancelRef.current = null;
        return;
      }

      hoverRotateXRef.current += diffX * lerpFactor;
      hoverRotateYRef.current += diffY * lerpFactor;
      
      updateTransform(rotateXRef.current, rotateYRef.current, 0, hoverRotateXRef.current, hoverRotateYRef.current);
      
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    hoverTrackingCancelRef.current = () => {
      isRunning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [updateTransform]);

  const handleThumbnailMouseMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    const watchedElement = getWatchedElement();
    if (isFlippedRef.current || isAnimating || isDragging || !watchedElement) return;
    
    if (animationCancelRef.current) return;
    
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    
    if (hoverResetCancelRef.current) {
      hoverResetCancelRef.current();
      hoverResetCancelRef.current = null;
    }
    
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    const rect = watchedElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((clientY - rect.top) / rect.height) * 2 - 1;
    
    const maxRot = 28;
    const targetHoverX = y * maxRot * -1;
    const targetHoverY = x * maxRot;
    
    targetHoverXRef.current = targetHoverX;
    targetHoverYRef.current = targetHoverY;
    
    if (!hoverTrackingCancelRef.current) {
      startHoverTracking();
    }
  }, [isAnimating, isDragging, getWatchedElement, startHoverTracking]);

  const handleThumbnailMouseLeave = useCallback(() => {
    if (isFlippedRef.current) return;
    
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    
    leaveTimeoutRef.current = setTimeout(() => {
      if (hoverResetCancelRef.current) {
        hoverResetCancelRef.current();
        hoverResetCancelRef.current = null;
      }
      
      if (hoverTrackingCancelRef.current) {
        hoverTrackingCancelRef.current();
        hoverTrackingCancelRef.current = null;
      }
      
      targetHoverXRef.current = 0;
      targetHoverYRef.current = 0;
      
      const startHoverX = hoverRotateXRef.current;
      const startHoverY = hoverRotateYRef.current;
      
      if (Math.abs(startHoverX) < 0.1 && Math.abs(startHoverY) < 0.1) {
        hoverRotateXRef.current = 0;
        hoverRotateYRef.current = 0;
        updateTransform(rotateXRef.current, rotateYRef.current, 0, 0, 0);
        leaveTimeoutRef.current = null;
        return;
      }
      
      hoverResetCancelRef.current = animateHoverReset(
        cardRef,
        startHoverX,
        startHoverY,
        400,
        (currentHoverX, currentHoverY) => {
          hoverRotateXRef.current = currentHoverX;
          hoverRotateYRef.current = currentHoverY;
          updateTransform(rotateXRef.current, rotateYRef.current, 0, currentHoverX, currentHoverY);
        },
        () => {
          hoverRotateXRef.current = 0;
          hoverRotateYRef.current = 0;
          targetHoverXRef.current = 0;
          targetHoverYRef.current = 0;
          updateTransform(rotateXRef.current, rotateYRef.current, 0, 0, 0);
          hoverResetCancelRef.current = null;
        }
      );
      
      leaveTimeoutRef.current = null;
    }, 100);
  }, [updateTransform]);
  
  // Attach mouse event listeners to the watched element if provided
  useEffect(() => {
    const watchedElement = watchElementRef?.current;
    if (!watchedElement) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      handleThumbnailMouseMove(e);
    };
    
    const handleMouseLeave = () => {
      handleThumbnailMouseLeave();
    };
    
    watchedElement.addEventListener('mousemove', handleMouseMove);
    watchedElement.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      watchedElement.removeEventListener('mousemove', handleMouseMove);
      watchedElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [watchElementRef, handleThumbnailMouseMove, handleThumbnailMouseLeave]);

  return (
    <CardContainer>
      <CardInner
        ref={cardRef}
        onClick={handleClick}
        onMouseDown={(e) => {
          handleMouseDownForClick(e);
          handleMouseDown(e);
        }}
        onMouseMove={handleMouseMoveForClick}
        style={{
          cursor: isFlipped ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
        }}
      >
        <CardFace>
          <FrontWrapper
            ref={wrapperRef}
            onMouseMove={watchElementRef ? undefined : handleThumbnailMouseMove}
            onMouseLeave={watchElementRef ? undefined : handleThumbnailMouseLeave}
          >
            {enableShimmer && !isFlipped && <ShimmerContainer $enabled={enableShimmer} />}
            <FrontContent>
              {frontContent}
            </FrontContent>
          </FrontWrapper>
        </CardFace>
        
        <CardFace isBack>
          <BackWrapper $theme={theme}>
            <BackContent $theme={theme}>
              {backContent}
            </BackContent>
            {isFlipped && (
              <FlipHint $theme={theme}>
                Drag to rotate<br />
                Click to flip back
              </FlipHint>
            )}
          </BackWrapper>
        </CardFace>
      </CardInner>
    </CardContainer>
  );
}
