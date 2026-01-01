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
import { colors } from '../../theme';

// Shared portal root - created once and reused by all tooltips
let portalRoot: HTMLElement | null = null;

function getPortalRoot(): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('Document is not available');
  }

  // Return existing root if valid
  if (portalRoot && document.body.contains(portalRoot)) {
    return portalRoot;
  }

  // Create portal root element
  portalRoot = document.createElement('div');
  portalRoot.id = 'react-tooltip-portal-root';
  
  // CRITICAL: Portal root must not affect layout
  portalRoot.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    pointer-events: none;
    z-index: 100002;
    overflow: visible;
    margin: 0;
    padding: 0;
    border: none;
  `;
  
  // Append to body - this is the portal target
  document.body.appendChild(portalRoot);
  
  return portalRoot;
}

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'auto';

interface TooltipProps {
  text?: string;
  content?: ReactNode;
  position?: TooltipPosition;
  delay?: number;
  disabled?: boolean;
  maxWidth?: string | null;
  interactive?: boolean;
  noBackground?: boolean; // If true, tooltip has no background/padding - content is the tooltip
  detectTruncation?: boolean; // If true, only show tooltip when text is actually truncated
  children: ReactNode;
}

const TooltipWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const TooltipElement = styled.div<{ 
  $position: 'top' | 'bottom' | 'left' | 'right';
  $maxWidth?: string;
  $interactive?: boolean;
  $noBackground?: boolean;
}>`
  position: fixed;
  z-index: 100002; /* Highest - above modals and toasts */
  padding: ${props => props.$noBackground ? '0' : '6px 10px'};
  background: ${props => props.$noBackground ? 'transparent' : 'var(--card, ' + colors.bgSecondary + ')'};
  border: ${props => props.$noBackground ? 'none' : '1px solid var(--border, ' + colors.border + ')'};
  color: var(--text, ${colors.text});
  font-size: 0.85em;
  line-height: 1.4;
  pointer-events: ${props => props.$interactive ? 'auto' : 'none'};
  box-shadow: ${props => props.$noBackground ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.3)'};
  border-radius: ${props => props.$noBackground ? '0' : '4px'};
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
  text-align: center;
  display: inline-block;
  max-width: ${props => props.$maxWidth || '300px'};
  min-width: ${props => props.$noBackground ? 'auto' : '200px'};
  width: ${props => props.$noBackground ? 'auto' : 'auto'};
  transition: opacity 0.15s ease, transform 0.15s ease;
  
  /* When noBackground, ensure content determines width consistently */
  ${props => props.$noBackground && css`
    width: fit-content;
    min-width: fit-content;
  `}
  
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

/**
 * Find the first text-containing element in the container
 */
function findTextElement(container: HTMLElement): HTMLElement | null {
  if (container.textContent && container.textContent.trim()) {
    return container;
  }
  
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    null
  );
  
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.textContent && element.textContent.trim()) {
        return element;
      }
    }
  }
  
  return null;
}

/**
 * Detect if text is truncated by comparing scrollWidth to clientWidth
 */
function detectTextTruncation(element: HTMLElement): boolean {
  const computedStyle = window.getComputedStyle(element);
  const overflow = computedStyle.overflow;
  const overflowX = computedStyle.overflowX;
  const textOverflow = computedStyle.textOverflow;
  const maxWidth = computedStyle.maxWidth;
  const width = computedStyle.width;
  
  const hasTruncationStyles = 
    (overflow === 'hidden' || overflowX === 'hidden') &&
    (textOverflow === 'ellipsis' || textOverflow === 'clip');
  
  if (!hasTruncationStyles && maxWidth === 'none' && !width.includes('px')) {
    return false;
  }
  
  const scrollWidth = element.scrollWidth;
  const clientWidth = element.clientWidth;
  const threshold = 1;
  const isHorizontallyTruncated = scrollWidth > clientWidth + threshold;
  
  const scrollHeight = element.scrollHeight;
  const clientHeight = element.clientHeight;
  const isVerticallyTruncated = scrollHeight > clientHeight + threshold;
  
  let isTruncatedByMeasurement = false;
  
  try {
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: ${computedStyle.whiteSpace};
      font: ${computedStyle.font};
      width: auto;
      max-width: none;
      overflow: visible;
    `;
    
    document.body.appendChild(clone);
    const cloneWidth = clone.offsetWidth;
    const originalWidth = element.offsetWidth;
    document.body.removeChild(clone);
    
    isTruncatedByMeasurement = cloneWidth > originalWidth + threshold;
  } catch (e) {
    // Fall back to scrollWidth method
  }
  
  return isHorizontallyTruncated || isVerticallyTruncated || isTruncatedByMeasurement;
}

export function Tooltip({ 
  text,
  content,
  position = 'auto', 
  delay = 0, 
  disabled = false,
  maxWidth = null,
  interactive = false,
  noBackground = false,
  detectTruncation = false,
  children 
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const [actualPosition, setActualPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [isTruncated, setIsTruncated] = useState(false);
  const [truncatedText, setTruncatedText] = useState<string>('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringTooltipRef = useRef(false);
  const listenersActiveRef = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Auto-enable interactive mode if content is provided (likely has interactive elements)
  const isInteractive = interactive || !!content;
  
  // Check truncation when detectTruncation is enabled
  const checkTruncation = useCallback(() => {
    if (!detectTruncation || !wrapperRef.current) {
      setIsTruncated(false);
      setTruncatedText('');
      return;
    }
    
    const textElement = findTextElement(wrapperRef.current);
    if (!textElement) {
      setIsTruncated(false);
      setTruncatedText('');
      return;
    }
    
    const fullText = textElement.textContent || textElement.innerText || '';
    
    if (!fullText.trim()) {
      setIsTruncated(false);
      setTruncatedText('');
      return;
    }
    
    const isTruncatedResult = detectTextTruncation(textElement);
    setIsTruncated(isTruncatedResult);
    
    if (isTruncatedResult) {
      setTruncatedText(fullText);
    } else {
      setTruncatedText('');
    }
  }, [detectTruncation]);
  
  // Set up truncation detection observer
  useEffect(() => {
    if (!detectTruncation) return;
    
    requestAnimationFrame(() => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
      checkTimeoutRef.current = setTimeout(() => {
        checkTruncation();
      }, 50);
      
      resizeObserverRef.current = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          checkTruncation();
        });
      });
      
      if (wrapperRef.current) {
        resizeObserverRef.current.observe(wrapperRef.current);
        const textElement = findTextElement(wrapperRef.current);
        if (textElement && textElement !== wrapperRef.current) {
          resizeObserverRef.current.observe(textElement);
        }
      }
    });
    
    const handleResize = () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
      checkTimeoutRef.current = setTimeout(() => {
        checkTruncation();
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      window.removeEventListener('resize', handleResize);
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
        checkTimeoutRef.current = null;
      }
    };
  }, [detectTruncation, checkTruncation]);
  
  // Re-check when children change
  useEffect(() => {
    if (detectTruncation) {
      requestAnimationFrame(() => {
        checkTruncation();
      });
    }
  }, [children, detectTruncation, checkTruncation]);

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
    if (disabled || (!text && !content)) return;

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
    
    if (!isInteractive) {
      // Non-interactive: hide immediately
      setShow(false);
      return;
    }
    
    // Interactive: delay hiding to allow moving to tooltip
    // Use much longer delay to prevent flicker during content changes
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      if (!isHoveringTooltipRef.current) {
        setShow(false);
      }
      hideTimeoutRef.current = null;
    }, 500); // Much longer delay to allow content changes without hiding
  }, [isInteractive]);
  
  // Handle tooltip mouse enter (for interactive tooltips)
  const handleTooltipMouseEnter = useCallback(() => {
    if (isInteractive) {
      // Cancel any pending hide
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      isHoveringTooltipRef.current = true;
    }
  }, [isInteractive]);
  
  // Handle tooltip mouse leave (for interactive tooltips)
  const handleTooltipMouseLeave = useCallback(() => {
    if (isInteractive) {
      isHoveringTooltipRef.current = false;
      // Small delay to allow moving mouse from tooltip back to trigger
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        if (!isHoveringTooltipRef.current) {
          setShow(false);
        }
        hideTimeoutRef.current = null;
      }, 100);
    }
  }, [isInteractive]);

  // Ensure portal root exists on mount - MUST be ready before any render
  useEffect(() => {
    if (typeof document !== 'undefined') {
      try {
        const root = getPortalRoot();
        // Verify it's actually in the DOM
        if (!document.body.contains(root)) {
          console.error('Portal root not in DOM!');
        }
      } catch (e) {
        console.error('Failed to create portal root:', e);
      }
    }
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
  
  // Update position when content changes (but keep tooltip visible)
  useEffect(() => {
    if (show && tooltipRef.current && wrapperRef.current) {
      // Recalculate position when content changes to prevent flicker
      requestAnimationFrame(() => {
        if (!tooltipRef.current || !wrapperRef.current) return;
        updateTooltipPosition();
      });
    }
  }, [content, show, updateTooltipPosition]);
  
  // Keep tooltip visible when content changes - cancel any pending hide
  useEffect(() => {
    if (show && isInteractive && content) {
      // When content changes, cancel any pending hide to keep tooltip visible
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      // Keep tooltip visible during content transitions
      isHoveringTooltipRef.current = true;
    }
  }, [content, show, isInteractive]);

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

  if ((!text && !content) || disabled) {
    return <>{children}</>;
  }

  // Get portal root element - MUST exist in DOM before using createPortal
  const portalRootElement = typeof document !== 'undefined' && typeof window !== 'undefined' 
    ? getPortalRoot() 
    : null;
  
  // Render tooltip ONLY via React createPortal when show is true
  // This ensures tooltip is NEVER in the component tree
  const tooltipPortal = show && portalRootElement 
    ? createPortal(
        <TooltipElement
          ref={tooltipRef}
          $position={actualPosition}
          $maxWidth={calculateMaxWidth()}
          $interactive={isInteractive}
          $noBackground={noBackground}
          style={tooltipStyle}
          role="tooltip"
          aria-live="polite"
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          {content || (detectTruncation && isTruncated ? truncatedText : text)}
        </TooltipElement>,
        portalRootElement
      )
    : null;
  
  return (
    <>
      <TooltipWrapper
        ref={wrapperRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </TooltipWrapper>
      {/* CRITICAL: Tooltip renders ONLY via React createPortal to body - NEVER in this tree */}
      {tooltipPortal}
    </>
  );
}
