/**
 * Tooltip Component - React
 * 
 * Full-featured tooltip with portal rendering, auto-positioning, and visual level indicators.
 * Combines all features from Svelte tooltips with React-specific enhancements.
 * 
 * Features:
 * - Portal rendering (prevents clipping)
 * - Auto-positioning with viewport detection
 * - Interactive mode (hoverable tooltip)
 * - Truncation detection (auto-show only when text is truncated)
 * - Level/flair system (log/info/warning/error)
 * - Mouse-tracking notch (arrow follows cursor)
 * - Scrollable content (when maxHeight set)
 * - Rich content support (ReactNode)
 * - Flicker prevention (opacity-based rendering)
 * - Custom dimensions (width/height/maxWidth/maxHeight)
 * 
 * @example
 * <Tooltip text="Simple tooltip">
 *   <button>Hover me</button>
 * </Tooltip>
 * 
 * @example
 * <Tooltip content={<div>Rich content</div>} position="bottom" interactive>
 *   <span>Hover target</span>
 * </Tooltip>
 * 
 * @example
 * <Tooltip text="Connection required" level="warning">
 *   <button disabled>Disabled button</button>
 * </Tooltip>
 */

import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styled, { css } from 'styled-components';

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
type TooltipLevel = 'log' | 'info' | 'warning' | 'error';

export interface TooltipTheme {
  colors: {
    bg: string;
    card: string;
    bgTertiary: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    accent: string;
    info: string;
    warning: string;
    danger: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
  };
}

export interface TooltipProps {
  text?: string;
  content?: ReactNode;
  position?: TooltipPosition;
  delay?: number;
  disabled?: boolean;
  maxWidth?: string | null;
  maxHeight?: string | null;
  width?: string | null;
  height?: string | null;
  interactive?: boolean;
  level?: TooltipLevel;
  detectTruncation?: boolean;
  theme?: TooltipTheme;
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
  $maxHeight?: string;
  $width?: string;
  $height?: string;
  $interactive?: boolean;
  $level: TooltipLevel;
  $theme: TooltipTheme;
}>`
  position: fixed;
  z-index: 100002;
  padding: ${props => props.$level === 'log' ? '6px 10px' : '16px 20px'};
  background: ${props => props.$theme.colors.card};
  border: 1px solid ${props => props.$theme.colors.border};
  color: ${props => props.$theme.colors.text};
  font-size: ${props => props.$level === 'log' ? '0.85em' : '0.875rem'};
  line-height: ${props => props.$level === 'log' ? '1.4' : '1.6'};
  pointer-events: ${props => props.$interactive ? 'auto' : 'none'};
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
  border-radius: ${props => props.$level === 'log' ? '4px' : '8px'};
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
  text-align: ${props => props.$level === 'log' ? 'center' : 'left'};
  display: inline-block;
  width: ${props => props.$width || 'auto'};
  height: ${props => props.$height || 'auto'};
  min-width: ${props => props.$level === 'log' ? '200px' : '280px'};
  max-width: ${props => props.$maxWidth || (props.$level === 'log' ? '300px' : '500px')};
  max-height: ${props => props.$maxHeight || 'none'};
  transition: opacity 0.2s ease;
  display: flex;
  flex-direction: column;
  overflow: ${props => props.$maxHeight ? 'hidden' : 'visible'};
  
  /* Level-based styling */
  ${props => props.$level === 'info' && css`
    border-color: ${props.$theme.colors.info};
    border-width: 2px;
    background-image: repeating-linear-gradient(
      45deg,
      ${props.$theme.colors.card},
      ${props.$theme.colors.card} 10px,
      rgba(100, 149, 237, 0.03) 10px,
      rgba(100, 149, 237, 0.03) 20px
    );
  `}
  
  ${props => props.$level === 'warning' && css`
    border-color: #ff8c00;
    border-width: 2px;
    background: ${props.$theme.colors.card};
    background-image: repeating-linear-gradient(
      135deg,
      rgba(255, 140, 0, 0.1),
      rgba(255, 140, 0, 0.1) 4px,
      rgba(255, 140, 0, 0.15) 4px,
      rgba(255, 140, 0, 0.15) 8px
    );
  `}
  
  ${props => props.$level === 'error' && css`
    border-color: ${props.$theme.colors.danger};
    border-width: 2px;
    background: ${props.$theme.colors.card};
    background-image: repeating-linear-gradient(
      -45deg,
      rgba(234, 43, 31, 0.1),
      rgba(234, 43, 31, 0.1) 6px,
      rgba(234, 43, 31, 0.15) 6px,
      rgba(234, 43, 31, 0.15) 12px
    );
  `}
  
  /* Arrow styles - positioned by CSS variable --notch-offset */
  &::after {
    content: '';
    position: absolute;
    width: 0;
    height: 0;
    border-style: solid;
    z-index: 2;
  }
  
  &::before {
    content: '';
    position: absolute;
    width: 0;
    height: 0;
    border-style: solid;
    z-index: 1;
  }
  
  /* Top position - arrow points down */
  ${props => props.$position === 'top' && css`
    &::after {
      top: 100%;
      left: var(--notch-offset, 50%);
      transform: translateX(-50%);
      border-width: 5px 5px 0 5px;
      border-color: ${props.$theme.colors.card} transparent transparent transparent;
    }
    
    &::before {
      top: 100%;
      left: var(--notch-offset, 50%);
      transform: translateX(-50%);
      border-width: 6px 6px 0 6px;
      border-color: ${
        props.$level === 'info' ? props.$theme.colors.info :
        props.$level === 'warning' ? '#ff8c00' :
        props.$level === 'error' ? props.$theme.colors.danger :
        props.$theme.colors.border
      } transparent transparent transparent;
      margin-top: -1px;
    }
  `}
  
  /* Bottom position - arrow points up */
  ${props => props.$position === 'bottom' && css`
    &::after {
      bottom: 100%;
      left: var(--notch-offset, 50%);
      transform: translateX(-50%);
      border-width: 0 5px 5px 5px;
      border-color: transparent transparent ${props.$theme.colors.card} transparent;
    }
    
    &::before {
      bottom: 100%;
      left: var(--notch-offset, 50%);
      transform: translateX(-50%);
      border-width: 0 6px 6px 6px;
      border-color: transparent transparent ${
        props.$level === 'info' ? props.$theme.colors.info :
        props.$level === 'warning' ? '#ff8c00' :
        props.$level === 'error' ? props.$theme.colors.danger :
        props.$theme.colors.border
      } transparent;
      margin-bottom: -1px;
    }
  `}
  
  /* Left position - arrow points right */
  ${props => props.$position === 'left' && css`
    &::after {
      left: 100%;
      top: var(--notch-offset, 50%);
      transform: translateY(-50%);
      border-width: 5px 0 5px 5px;
      border-color: transparent transparent transparent ${props.$theme.colors.card};
    }
    
    &::before {
      left: 100%;
      top: var(--notch-offset, 50%);
      transform: translateY(-50%);
      border-width: 6px 0 6px 6px;
      border-color: transparent transparent transparent ${
        props.$level === 'info' ? props.$theme.colors.info :
        props.$level === 'warning' ? '#ff8c00' :
        props.$level === 'error' ? props.$theme.colors.danger :
        props.$theme.colors.border
      };
      margin-left: -1px;
    }
  `}
  
  /* Right position - arrow points left */
  ${props => props.$position === 'right' && css`
    &::after {
      right: 100%;
      top: var(--notch-offset, 50%);
      transform: translateY(-50%);
      border-width: 5px 5px 5px 0;
      border-color: transparent ${props.$theme.colors.card} transparent transparent;
    }
    
    &::before {
      right: 100%;
      top: var(--notch-offset, 50%);
      transform: translateY(-50%);
      border-width: 6px 6px 6px 0;
      border-color: transparent ${
        props.$level === 'info' ? props.$theme.colors.info :
        props.$level === 'warning' ? '#ff8c00' :
        props.$level === 'error' ? props.$theme.colors.danger :
        props.$theme.colors.border
      } transparent transparent;
      margin-right: -1px;
    }
  `}
`;

const TooltipContent = styled.div<{ $scrollable: boolean; $theme: TooltipTheme }>`
  position: relative;
  z-index: 1;
  ${props => props.$scrollable && css`
    overflow-y: auto;
    overflow-x: hidden;
    flex: 1;
    min-height: 0;
    padding-right: 4px;
    margin-right: -4px;
    
    /* Custom scrollbar */
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
    
    &::-webkit-scrollbar {
      width: 8px;
    }
    
    &::-webkit-scrollbar-track {
      background: transparent;
      border-radius: 4px;
      margin: 4px 0;
    }
    
    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      border: 2px solid transparent;
      background-clip: padding-box;
    }
    
    &::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
      background-clip: padding-box;
    }
  `}
`;

// Default theme
const defaultTheme: TooltipTheme = {
  colors: {
    bg: '#1a1a1a',
    card: '#2a2a2a',
    bgTertiary: '#333333',
    text: '#f9f9f9',
    textSecondary: '#b0b0b0',
    textMuted: '#808080',
    border: 'rgba(255, 255, 255, 0.2)',
    accent: '#6495ed',
    info: '#6495ed',
    warning: '#ff8c00',
    danger: '#ea2b1f',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
  },
};

/**
 * Find the first text-containing element in the container
 */
function findTextElement(container: HTMLElement): HTMLElement | null {
  const containerStyle = window.getComputedStyle(container);
  const hasContainerTruncation = 
    (containerStyle.overflow === 'hidden' || containerStyle.overflowX === 'hidden') &&
    (containerStyle.textOverflow === 'ellipsis' || containerStyle.textOverflow === 'clip');
  
  if (hasContainerTruncation && container.textContent && container.textContent.trim()) {
    return container;
  }
  
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT,
    null
  );
  
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const style = window.getComputedStyle(element);
      const hasTruncation = 
        (style.overflow === 'hidden' || style.overflowX === 'hidden') &&
        (style.textOverflow === 'ellipsis' || style.textOverflow === 'clip');
      
      if (hasTruncation && element.textContent && element.textContent.trim()) {
        return element;
      }
    }
  }
  
  if (container.textContent && container.textContent.trim()) {
    return container;
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
  
  return isHorizontallyTruncated || isVerticallyTruncated;
}

export function Tooltip({ 
  text,
  content,
  position = 'auto', 
  delay = 0, 
  disabled = false,
  maxWidth = null,
  maxHeight = null,
  width = null,
  height = null,
  interactive = false,
  level = 'log',
  detectTruncation = false,
  theme = defaultTheme,
  children 
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const [actualPosition, setActualPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const [isTruncated, setIsTruncated] = useState(false);
  const [truncatedText, setTruncatedText] = useState<string>('');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
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
    if (typeof window === 'undefined') return level === 'log' ? '300px' : '500px';
    const viewportWidth = window.innerWidth;
    const calculated = Math.max(level === 'log' ? 200 : 250, Math.min(level === 'log' ? 300 : 500, Math.floor(viewportWidth * 0.4)));
    return `${calculated}px`;
  }, [maxWidth, level]);

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

  // Update tooltip position and notch
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

    // Update notch position based on mouse
    const minOffsetPercent = 5;
    let notchOffset = '50%';
    
    if (actualPosition === 'top' || actualPosition === 'bottom') {
      const mouseRelativeX = mousePos.x - left;
      const mousePercentX = (mouseRelativeX / tooltipRect.width) * 100;
      const clampedPercent = Math.max(minOffsetPercent, Math.min(100 - minOffsetPercent, mousePercentX));
      notchOffset = `${clampedPercent}%`;
    } else if (actualPosition === 'left' || actualPosition === 'right') {
      const mouseRelativeY = mousePos.y - top;
      const mousePercentY = (mouseRelativeY / tooltipRect.height) * 100;
      const clampedPercent = Math.max(minOffsetPercent, Math.min(100 - minOffsetPercent, mousePercentY));
      notchOffset = `${clampedPercent}%`;
    }

    setTooltipStyle({
      top: `${top}px`,
      left: `${left}px`,
      maxWidth: calculateMaxWidth(),
      opacity: 1,
      ['--notch-offset' as any]: notchOffset,
    });
  }, [actualPosition, calculateMaxWidth, mousePos]);

  // Handle resize and scroll events
  const handleResize = useCallback(() => {
    if (show && tooltipRef.current) {
      const newPosition = calculatePosition();
      setActualPosition(newPosition);
      updateTooltipPosition();
    }
  }, [show, calculatePosition, updateTooltipPosition]);

  // Track mouse position for notch
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (show && tooltipRef.current) {
      updateTooltipPosition();
    }
  }, [show, updateTooltipPosition]);

  // Show tooltip
  const handleMouseEnter = useCallback(() => {
    if (disabled || (!text && !content)) return;

    // If detectTruncation is enabled, check truncation synchronously on hover
    if (detectTruncation) {
      if (wrapperRef.current) {
        const textElement = findTextElement(wrapperRef.current);
        if (textElement) {
          const isCurrentlyTruncated = detectTextTruncation(textElement);
          if (!isCurrentlyTruncated) {
            return;
          }
          setIsTruncated(true);
          const fullText = textElement.textContent || textElement.innerText || '';
          if (fullText.trim()) {
            setTruncatedText(fullText);
          }
        } else {
          return;
        }
      } else {
        return;
      }
    }

    if (delay > 0) {
      hoverTimeoutRef.current = setTimeout(() => {
        setShow(true);
        hoverTimeoutRef.current = null;
      }, delay);
    } else {
      setShow(true);
    }
  }, [disabled, text, content, delay, detectTruncation]);

  // Hide tooltip
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    if (!isInteractive) {
      setShow(false);
      setTooltipStyle({ opacity: 0 });
      return;
    }
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      if (!isHoveringTooltipRef.current) {
        setShow(false);
        setTooltipStyle({ opacity: 0 });
      }
      hideTimeoutRef.current = null;
    }, 500);
  }, [isInteractive]);
  
  // Handle tooltip mouse enter (for interactive tooltips)
  const handleTooltipMouseEnter = useCallback(() => {
    if (isInteractive) {
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
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        if (!isHoveringTooltipRef.current) {
          setShow(false);
          setTooltipStyle({ opacity: 0 });
        }
        hideTimeoutRef.current = null;
      }, 100);
    }
  }, [isInteractive]);

  // Ensure portal root exists on mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      try {
        const root = getPortalRoot();
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
      requestAnimationFrame(() => {
        if (!tooltipRef.current || !wrapperRef.current) return;
        
        const newPosition = calculatePosition();
        setActualPosition(newPosition);
        updateTooltipPosition();

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
  
  // Update position when content changes
  useEffect(() => {
    if (show && tooltipRef.current && wrapperRef.current) {
      requestAnimationFrame(() => {
        if (!tooltipRef.current || !wrapperRef.current) return;
        updateTooltipPosition();
      });
    }
  }, [content, show, updateTooltipPosition]);
  
  // Keep tooltip visible when content changes
  useEffect(() => {
    if (show && isInteractive && content) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      isHoveringTooltipRef.current = true;
    }
  }, [content, show, isInteractive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
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

  const portalRootElement = typeof document !== 'undefined' && typeof window !== 'undefined' 
    ? getPortalRoot() 
    : null;
  
  const shouldShowTooltip = show && (!detectTruncation || isTruncated || content);
  const tooltipPortal = shouldShowTooltip && portalRootElement 
    ? createPortal(
        <TooltipElement
          ref={tooltipRef}
          $position={actualPosition}
          $maxWidth={maxWidth || calculateMaxWidth()}
          $maxHeight={maxHeight || undefined}
          $width={width || undefined}
          $height={height || undefined}
          $interactive={isInteractive}
          $level={level}
          $theme={theme}
          style={tooltipStyle}
          role="tooltip"
          aria-live="polite"
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          <TooltipContent $scrollable={!!maxHeight || !!height} $theme={theme}>
            {content || (detectTruncation && isTruncated ? truncatedText : text)}
          </TooltipContent>
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
        onMouseMove={handleMouseMove}
      >
        {children}
      </TooltipWrapper>
      {tooltipPortal}
    </>
  );
}
