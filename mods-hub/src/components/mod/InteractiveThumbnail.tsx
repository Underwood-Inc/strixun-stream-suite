/**
 * Interactive 3D Thumbnail Card Component
 * JavaScript-driven 3D card with click-to-flip and drag-to-rotate
 * Shows thumbnail on front, mod details on back
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModMetadata } from '../../types/mod';

const CardContainer = styled.div`
  width: 100%;
  aspect-ratio: 1;
  perspective: 1200px;
  position: relative;
  pointer-events: auto;
`;

const CardInner = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  /* Transform controlled entirely by JavaScript */
`;

const CardFace = styled.div<{ isBack?: boolean }>`
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 4px;
  overflow: hidden;
  transform-style: preserve-3d;
  ${props => props.isBack ? 'transform: rotateY(180deg) translateZ(0);' : 'transform: translateZ(0);'}
`;

const ThumbnailImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: none;
`;

const ThumbnailWrapper = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  /* No CSS transforms or transitions - JavaScript handles all animations */
  cursor: pointer;
  
  /* Shimmer effect only when not flipped */
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
    opacity: 0;
    pointer-events: none;
    border-radius: inherit;
    z-index: 1;
    animation: shimmer-sweep 2.5s ease-in-out infinite;
    mix-blend-mode: overlay;
    will-change: transform, opacity;
  }
  
  &:hover::after {
    opacity: 0.9;
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

const CardBack = styled.div`
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, ${colors.bgSecondary}, ${colors.bgTertiary});
  border: 1px solid ${colors.border};
  border-radius: 4px;
  padding: ${spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
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
  }
`;

const BackContent = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 60px; /* Reserve space for bottom buttons */
  
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: 2px;
  }
`;

const BackTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
  line-height: 1.3;
`;

const BackDescription = styled.p`
  font-size: 0.75rem;
  color: ${colors.textSecondary};
  line-height: 1.5;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  margin: 0;
  min-height: 0;
  
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: 2px;
  }
`;

const BackMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
  font-size: 0.7rem;
  color: ${colors.textMuted};
  flex-shrink: 0; /* Don't shrink, but don't push with margin-top: auto */
  padding-top: ${spacing.xs};
  border-top: 1px solid ${colors.border};
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
`;

const MetaLabel = styled.span`
  font-weight: 500;
  color: ${colors.textSecondary};
`;

const FlipHint = styled.div`
  position: absolute;
  bottom: ${spacing.xs};
  right: ${spacing.xs};
  font-size: 0.625rem;
  color: ${colors.textMuted};
  opacity: 0.7;
  pointer-events: none;
  z-index: 2;
  text-align: right;
  line-height: 1.4;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px 8px;
  border-radius: 4px;
`;

const NavigateButton = styled.button`
  position: absolute;
  bottom: ${spacing.xs};
  left: ${spacing.xs};
  padding: ${spacing.xs} ${spacing.sm};
  background: ${colors.accent}20;
  border: 1px solid ${colors.accent};
  border-radius: 4px;
  color: ${colors.accent};
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 2;
  
  &:hover {
    background: ${colors.accent};
    color: #000;
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const ZoomButton = styled.button`
  position: absolute;
  top: ${spacing.xs};
  right: ${spacing.xs};
  padding: ${spacing.xs} ${spacing.sm};
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
  
  &:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const ZoomModal = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 10000;
  display: ${props => props.isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  padding: ${spacing.xl};
  cursor: pointer;
`;

const ZoomContent = styled.div`
  max-width: 90vw;
  max-height: 90vh;
  width: auto;
  height: auto;
  position: relative;
  cursor: default;
  
  img {
    max-width: 100%;
    max-height: 90vh;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: -${spacing.lg};
  right: 0;
  padding: ${spacing.sm};
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

interface InteractiveThumbnailProps {
  mod: ModMetadata;
  onError?: () => void;
  onNavigate?: () => void;
}

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

export function InteractiveThumbnail({ mod, onError, onNavigate }: InteractiveThumbnailProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const rotateXRef = useRef(0);
  const rotateYRef = useRef(0);
  const hoverRotateXRef = useRef(0);
  const hoverRotateYRef = useRef(0);
  const isFlippedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; rotateX: number; rotateY: number } | null>(null);
  const animationCancelRef = useRef<(() => void) | null>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    isFlippedRef.current = isFlipped;
  }, [isFlipped]);

  // Update transform directly via JavaScript
  const updateTransform = useCallback((rotateX: number, rotateY: number, flipY: number = 0, hoverX: number = 0, hoverY: number = 0) => {
    if (!cardRef.current) return;
    rotateXRef.current = rotateX;
    rotateYRef.current = rotateY;
    hoverRotateXRef.current = hoverX;
    hoverRotateYRef.current = hoverY;
    
    // When not flipped, add hover tilt. When flipped, use drag rotation
    // Use ref to get current value, not stale closure value
    const currentlyFlipped = isFlippedRef.current;
    const finalRotateX = currentlyFlipped ? rotateX : rotateX + hoverX;
    const finalRotateY = currentlyFlipped ? rotateY : rotateY + hoverY;
    
    cardRef.current.style.transform = `rotateY(${flipY + finalRotateY}deg) rotateX(${finalRotateX}deg)`;
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Don't flip if dragging or animating
    if (isDragging || isAnimating) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    // Clear any hover animations immediately
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    hoverRotateXRef.current = 0;
    hoverRotateYRef.current = 0;
    
    setIsAnimating(true);
    const newFlipped = !isFlipped;
    const targetRotateY = newFlipped ? 180 : 0;
    
    // Cancel any existing animation
    if (animationCancelRef.current) {
      animationCancelRef.current();
    }
    
    // Animate flip with JavaScript
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
          // Update ref immediately so updateTransform uses correct value
          isFlippedRef.current = newFlipped;
          setIsFlipped(newFlipped);
          setIsAnimating(false);
          rotateXRef.current = 0;
          rotateYRef.current = 0;
          hoverRotateXRef.current = 0;
          hoverRotateYRef.current = 0;
          animationCancelRef.current = null;
          // Update final transform - ref is now updated
          updateTransform(0, 0, newFlipped ? 180 : 0, 0, 0);
        }
      );
    }
  }, [isDragging, isAnimating, isFlipped, updateTransform]);

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
    
    // Calculate rotation based on drag distance
    const newRotateY = dragStartRef.current.rotateY + deltaX * 0.5;
    const newRotateX = dragStartRef.current.rotateX - deltaY * 0.5;
    
    // Clamp rotation
    const clampedRotateY = Math.max(-45, Math.min(45, newRotateY));
    const clampedRotateX = Math.max(-45, Math.min(45, newRotateX));
    
    // Update transform directly via JavaScript (no CSS transition)
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
    };
  }, []);

  // Handle ESC key to close zoom
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZoomed) {
        setIsZoomed(false);
      }
    };
    
    if (isZoomed) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when zoomed
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isZoomed]);

  const handleThumbnailMouseMove = useCallback((e: React.MouseEvent) => {
    // Only apply hover tilt when NOT flipped, NOT animating, and NOT zoomed
    // Use ref to check current state
    if (isFlippedRef.current || isAnimating || isDragging || isZoomed || !wrapperRef.current) return;
    
    // Cancel any pending leave timeout
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    
    const rect = wrapperRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1; // -1 to 1
    
    const maxRot = 28;
    const hoverX = y * maxRot * -1;
    const hoverY = x * maxRot;
    
    updateTransform(rotateXRef.current, rotateYRef.current, 0, hoverX, hoverY);
  }, [isAnimating, isDragging, isZoomed, updateTransform]);

  const handleThumbnailMouseLeave = useCallback(() => {
    // Only reset hover tilt when NOT flipped
    // Use ref to check current state
    if (isFlippedRef.current) return;
    
    // Clear any existing timeout
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
    }
    
    // Debounce the reset - wait before reverting to default state
    leaveTimeoutRef.current = setTimeout(() => {
      hoverRotateXRef.current = 0;
      hoverRotateYRef.current = 0;
      updateTransform(rotateXRef.current, rotateYRef.current, 0, 0, 0);
      leaveTimeoutRef.current = null;
    }, 250);
  }, [updateTransform]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleZoom = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsZoomed(true);
  }, []);

  const handleCloseZoom = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target === e.currentTarget) {
      setIsZoomed(false);
    }
  }, []);

  return (
    <>
      <CardContainer>
        <CardInner
          ref={cardRef}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          style={{
            cursor: isFlipped ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
          }}
        >
          <CardFace>
            <ThumbnailWrapper
              ref={wrapperRef}
              onMouseMove={handleThumbnailMouseMove}
              onMouseLeave={handleThumbnailMouseLeave}
            >
              {mod.thumbnailUrl ? (
                <>
                  <ThumbnailImage
                    src={mod.thumbnailUrl}
                    alt={mod.title}
                    onError={onError}
                  />
                  {!isFlipped && (
                    <ZoomButton
                      onClick={handleZoom}
                      title="Zoom/Expand thumbnail"
                    >
                      🔍 Zoom
                    </ZoomButton>
                  )}
                </>
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: colors.bgTertiary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.textMuted,
                  fontSize: '0.75rem'
                }}>
                  No thumbnail
                </div>
              )}
            </ThumbnailWrapper>
          </CardFace>
          
          <CardFace isBack>
            <CardBack>
              <BackContent>
                <BackTitle>{mod.title}</BackTitle>
                <BackDescription>
                  {mod.description || 'No description available'}
                </BackDescription>
                <BackMeta>
                  <MetaRow>
                    <MetaLabel>Uploader:</MetaLabel>
                    <span>{mod.authorDisplayName || 'Unknown'}</span>
                  </MetaRow>
                  <MetaRow>
                    <MetaLabel>Uploaded:</MetaLabel>
                    <span>{formatDate(mod.createdAt)}</span>
                  </MetaRow>
                  <MetaRow>
                    <MetaLabel>Updated:</MetaLabel>
                    <span>{formatDate(mod.updatedAt)}</span>
                  </MetaRow>
                  <MetaRow>
                    <MetaLabel>Downloads:</MetaLabel>
                    <span>{mod.downloadCount.toLocaleString()}</span>
                  </MetaRow>
                </BackMeta>
              </BackContent>
              {isFlipped && (
                <>
                  <FlipHint>
                    Drag to rotate<br />
                    Click to flip back
                  </FlipHint>
                  {onNavigate && (
                    <NavigateButton
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate();
                      }}
                    >
                      View Mod →
                    </NavigateButton>
                  )}
                </>
              )}
            </CardBack>
          </CardFace>
        </CardInner>
      </CardContainer>
      
      {mod.thumbnailUrl && (
        <ZoomModal isOpen={isZoomed} onClick={handleCloseZoom}>
          <ZoomContent onClick={(e) => e.stopPropagation()}>
            <CloseButton onClick={handleCloseZoom}>✕</CloseButton>
            <img src={mod.thumbnailUrl} alt={mod.title} />
          </ZoomContent>
        </ZoomModal>
      )}
    </>
  );
}
