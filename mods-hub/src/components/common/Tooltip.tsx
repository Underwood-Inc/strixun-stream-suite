/**
 * Tooltip Component
 * 
 * Portal-enabled tooltip component that prevents content shift and ensures
 * tooltip stays within viewport bounds. Matches main app's smart tooltip behavior.
 * 
 * @example
 * <Tooltip text="Click to copy">
 *   <button>Copy</button>
 * </Tooltip>
 */

import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styled, { css } from 'styled-components';
import { colors, spacing } from '../../theme';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'auto';

interface TooltipProps {
  text: string;
  position?: TooltipPosition;
  delay?: number;
  disabled?: boolean;
  maxWidth?: string | null;
  children: ReactNode;
}

const TooltipWrapper = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const TooltipElement = styled.div<{ 
  $position: 'top' | 'bottom' | 'left' | 'right';
  $maxWidth?: string;
}>`
  position: fixed;
  z-index: 100002; /* Highest - above modals and toasts */
  padding: 6px 10px;
  background: var(--card, ${colors.bgSecondary});
  border: 1px solid var(--border, ${colors.border});
  color: var(--text, ${colors.text});
  font-size: 0.85em;
  line-height: 1.4;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
  text-align: center;
  display: inline-block;
  max-width: ${props => props.$maxWidth || '300px'};
  min-width: 200px;
  
  /* Arrow styles */
  &::after {
    content: '';
    position: absolute;
    width: 0;
    height: 0;
    border-style: solid;
  }
  
  &::before {
    content: '';
    position: absolute;
    width: 0;
    height: 0;
    border-style: solid;
    z-index: -1;
  }
  
  /* Top position - arrow points down */
  ${props => props.$position === 'top' && css`
    &::after {
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-width: 5px 5px 0 5px;
      border-color: var(--card, ${colors.bgSecondary}) transparent transparent transparent;
    }
    
    &::before {
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-width: 6px 6px 0 6px;
      border-color: var(--border, ${colors.border}) transparent transparent transparent;
      margin-top: -1px;
    }
  `}
  
  /* Bottom position - arrow points up */
  ${props => props.$position === 'bottom' && css`
    &::after {
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-width: 0 5px 5px 5px;
      border-color: transparent transparent var(--card, ${colors.bgSecondary}) transparent;
    }
    
    &::before {
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-width: 0 6px 6px 6px;
      border-color: transparent transparent var(--border, ${colors.border}) transparent;
      margin-bottom: -1px;
    }
  `}
  
  /* Left position - arrow points right */
  ${props => props.$position === 'left' && css`
    &::after {
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      border-width: 5px 0 5px 5px;
      border-color: transparent transparent transparent var(--card, ${colors.bgSecondary});
    }
    
    &::before {
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      border-width: 6px 0 6px 6px;
      border-color: transparent transparent transparent var(--border, ${colors.border});
      margin-left: -1px;
    }
  `}
  
  /* Right position - arrow points left */
  ${props => props.$position === 'right' && css`
    &::after {
      right: 100%;
      top: 50%;
      transform: translateY(-50%);
      border-width: 5px 5px 5px 0;
      border-color: transparent var(--card, ${colors.bgSecondary}) transparent transparent;
    }
    
    &::before {
      right: 100%;
      top: 50%;
      transform: translateY(-50%);
      border-width: 6px 6px 6px 0;
      border-color: transparent var(--border, ${colors.border}) transparent transparent;
      margin-right: -1px;
    }
  `}
`;

export function Tooltip({ 
  text, 
  position = 'auto', 
  delay = 0, 
  disabled = false,
  maxWidth = null,
  children 
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const [actualPosition, setActualPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenersActiveRef = useRef(false);

  // Calculate max width based on viewport
  const calculateMaxWidth = useCallback((): string => {
    if (maxWidth !== null) {
      return maxWidth;
    }
    if (typeof window === 'undefined') return '300px';
    const viewportWidth = window.innerWidth;
    const calculated = Math.max(200, Math.min(500, Math.floor(viewportWidth * 0.4)));
    return `${calculated}px`;
  }, [maxWidth]);

  // Calculate best position based on available space
  const calculatePosition = useCallback((): 'top' | 'bottom' | 'left' | 'right' => {
    if (position !== 'auto') {
      return position;
    }

    if (!wrapperRef.current || !tooltipRef.current) {
      return 'top';
    }

    const triggerRect = wrapperRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check available space in each direction
    const spaceTop = triggerRect.top;
    const spaceBottom = viewportHeight - triggerRect.bottom;
    const spaceLeft = triggerRect.left;
    const spaceRight = viewportWidth - triggerRect.right;

    // Determine best position
    if (spaceBottom >= tooltipRect.height + 10) {
      return 'bottom';
    } else if (spaceTop >= tooltipRect.height + 10) {
      return 'top';
    } else if (spaceRight >= tooltipRect.width + 10) {
      return 'right';
    } else if (spaceLeft >= tooltipRect.width + 10) {
      return 'left';
    } else {
      return 'bottom'; // Default fallback
    }
  }, [position]);

  // Update tooltip position using fixed positioning
  const updateTooltipPosition = useCallback(() => {
    if (!wrapperRef.current || !tooltipRef.current) return;

    const triggerRect = wrapperRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;
    const padding = 8;

    switch (actualPosition) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - padding;
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = triggerRect.bottom + padding;
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        left = triggerRect.left - tooltipRect.width - padding;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        left = triggerRect.right + padding;
        break;
    }

    // Keep tooltip within viewport bounds
    if (left < padding) left = padding;
    if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > viewportHeight - padding) {
      top = viewportHeight - tooltipRect.height - padding;
    }

    setTooltipStyle({
      top: `${top}px`,
      left: `${left}px`,
      maxWidth: calculateMaxWidth(),
    });
  }, [actualPosition, calculateMaxWidth]);

  // Handle resize and scroll events
  const handleResize = useCallback(() => {
    if (show && tooltipRef.current) {
      const newPosition = calculatePosition();
      setActualPosition(newPosition);
      updateTooltipPosition();
    }
  }, [show, calculatePosition, updateTooltipPosition]);

  // Show tooltip
  const handleMouseEnter = useCallback(() => {
    if (disabled || !text) return;

    if (delay > 0) {
      hoverTimeoutRef.current = setTimeout(() => {
        setShow(true);
        hoverTimeoutRef.current = null;
      }, delay);
    } else {
      setShow(true);
    }
  }, [disabled, text, delay]);

  // Hide tooltip
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShow(false);
  }, []);

  // Create portal container on mount
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const portalContainer = document.createElement('div');
    portalContainer.id = `tooltip-portal-${Math.random().toString(36).substr(2, 9)}`;
    portalContainer.style.position = 'fixed';
    portalContainer.style.top = '0';
    portalContainer.style.left = '0';
    portalContainer.style.width = '0';
    portalContainer.style.height = '0';
    portalContainer.style.pointerEvents = 'none';
    portalContainer.style.zIndex = '100002';
    document.body.appendChild(portalContainer);
    portalContainerRef.current = portalContainer;

    return () => {
      if (portalContainerRef.current && portalContainerRef.current.parentNode) {
        portalContainerRef.current.parentNode.removeChild(portalContainerRef.current);
      }
    };
  }, []);

  // Update position when tooltip becomes visible
  useEffect(() => {
    if (show && tooltipRef.current && wrapperRef.current) {
      // Wait for tooltip to render, then calculate position
      requestAnimationFrame(() => {
        if (!tooltipRef.current || !wrapperRef.current) return;
        
        const newPosition = calculatePosition();
        setActualPosition(newPosition);
        updateTooltipPosition();

        // Add event listeners if not already active
        if (!listenersActiveRef.current) {
          window.addEventListener('resize', handleResize);
          window.addEventListener('scroll', handleResize, true);
          listenersActiveRef.current = true;
        }
      });
    }

    return () => {
      if (!show && listenersActiveRef.current) {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize, true);
        listenersActiveRef.current = false;
      }
    };
  }, [show, calculatePosition, updateTooltipPosition, handleResize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (listenersActiveRef.current) {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize, true);
      }
    };
  }, [handleResize]);

  if (!text || disabled) {
    return <>{children}</>;
  }

  return (
    <>
      <TooltipWrapper
        ref={wrapperRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </TooltipWrapper>
      {show && portalContainerRef.current && createPortal(
        <TooltipElement
          ref={tooltipRef}
          $position={actualPosition}
          $maxWidth={calculateMaxWidth()}
          style={tooltipStyle}
          role="tooltip"
        >
          {text}
        </TooltipElement>,
        portalContainerRef.current
      )}
    </>
  );
}
