/**
 * Shared style utilities for styled-components
 * Provides CSS-in-JS styles matching the shared-styles SCSS mixins
 * Ensures consistent styling across all apps
 */

import { css, keyframes } from 'styled-components';

// ============ Card Styles ============

export type CardVariant = 'default' | 'hover';

export function getCardStyles(variant: CardVariant = 'default') {
  const baseStyles = css`
    background: var(--card, var(--bg-secondary, #252525));
    border: 1px solid var(--border, #3a3a3a);
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: all 0.2s ease;
  `;

  if (variant === 'hover') {
    return css`
      ${baseStyles}
      
      &:hover {
        border-color: var(--accent, #edae49);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }
    `;
  }

  return baseStyles;
}

// ============ Status Badge/Flair Styles ============

export type BadgeType = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'default';

export function getBadgeStyles(type: BadgeType = 'default') {
  const baseStyles = css`
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    text-transform: capitalize;
  `;

  switch (type) {
    case 'success':
      return css`
        ${baseStyles}
        background: var(--success, #4caf50)20;
        color: var(--success, #4caf50);
      `;
    case 'warning':
      return css`
        ${baseStyles}
        background: var(--warning, #ff9800)20;
        color: var(--warning, #ff9800);
      `;
    case 'danger':
      return css`
        ${baseStyles}
        background: var(--danger, #f44336)20;
        color: var(--danger, #f44336);
      `;
    case 'info':
      return css`
        ${baseStyles}
        background: var(--info, #2196f3)20;
        color: var(--info, #2196f3);
      `;
    case 'accent':
      return css`
        ${baseStyles}
        background: var(--accent, #edae49)20;
        color: var(--accent, #edae49);
      `;
    default:
      return css`
        ${baseStyles}
        background: var(--bg-tertiary, #2d2d2d);
        color: var(--text-secondary, #b0b0b0);
      `;
  }
}

export function getVerifiedBadgeStyles() {
  return css`
    ${getBadgeStyles('success')}
    
    &::before {
      content: '✓';
      font-weight: 700;
    }
  `;
}

export function getStrixunBadgeStyles() {
  return css`
    ${getBadgeStyles('default')}
    background: var(--bg-tertiary, #2d2d2d);
    color: var(--text-secondary, #b0b0b0);
  `;
}

// ============ Tooltip Styles ============

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export function getTooltipStyles(position: TooltipPosition = 'top') {
  const baseStyles = css`
    position: absolute;
    z-index: 1000;
    padding: 8px 12px;
    background: var(--bg-dark, rgba(15, 14, 11, 0.95));
    color: var(--text, #f9f9f9);
    border: 1px solid var(--border, #3a3a3a);
    border-radius: 4px;
    font-size: 0.875rem;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    pointer-events: none;
    white-space: nowrap;
    max-width: 300px;
    
    &::before {
      content: '';
      position: absolute;
      width: 0;
      height: 0;
      border-style: solid;
    }
  `;

  const arrowStyles = {
    top: css`
      &::before {
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        border-width: 6px 6px 0 6px;
        border-color: var(--border, #3a3a3a) transparent transparent transparent;
      }
    `,
    bottom: css`
      &::before {
        top: -6px;
        left: 50%;
        transform: translateX(-50%);
        border-width: 0 6px 6px 6px;
        border-color: transparent transparent var(--border, #3a3a3a) transparent;
      }
    `,
    left: css`
      &::before {
        right: -6px;
        top: 50%;
        transform: translateY(-50%);
        border-width: 6px 0 6px 6px;
        border-color: transparent transparent transparent var(--border, #3a3a3a);
      }
    `,
    right: css`
      &::before {
        left: -6px;
        top: 50%;
        transform: translateY(-50%);
        border-width: 6px 6px 6px 0;
        border-color: transparent var(--border, #3a3a3a) transparent transparent;
      }
    `,
  };

  return css`
    ${baseStyles}
    ${arrowStyles[position]}
  `;
}

// ============ Copy Button Styles ============

export function getCopyButtonStyles() {
  return css`
    padding: 4px 8px;
    background: var(--bg-secondary, #252525);
    border: 1px solid var(--border, #3a3a3a);
    border-radius: 4px;
    color: var(--text, #f9f9f9);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      background: var(--bg-tertiary, #2d2d2d);
      border-color: var(--accent, #edae49);
    }
    
    &:active {
      transform: scale(0.98);
    }
  `;
}

// ============ Helper to filter non-DOM props ============
// Use this with styled-components to prevent React warnings

export const shouldForwardProp = <T extends Record<string, any>>(
  props: Array<keyof T>,
  prop: string
): boolean => {
  return !props.includes(prop as keyof T);
};

// ============ Click Effect (Ripple) ============
// Cursor-position click ripple effect for interactive elements
// Usage: ${getClickEffectStyles()}
// Optional: ${getClickEffectStyles('rgba(255, 255, 255, 0.3)', '100px')} // color, size
// 
// Use with the useClickRipple hook to position the ripple at cursor:
// const { onClick } = useClickRipple();
// <StyledButton onClick={onClick}>Click me</StyledButton>
export function getClickEffectStyles(color: string = 'rgba(255, 255, 255, 0.3)', size: string = '100px') {
  return css`
    cursor: pointer;
    position: relative;
    overflow: hidden;
    user-select: none;
    
    &::after {
      content: '';
      position: absolute;
      width: ${size};
      height: ${size};
      border-radius: 50%;
      background: ${color};
      transform: scale(0);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      left: var(--ripple-x, 50%);
      top: var(--ripple-y, 50%);
      margin-left: calc(-${size} / 2);
      margin-top: calc(-${size} / 2);
    }
    
    &:active::after {
      transform: scale(4);
      opacity: 1;
      transition: transform 0s, opacity 0s;
    }
    
    /* Prevent text selection during click */
    &:active {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
  `;
}

// ============ Quirky Click Interaction ============
// Smooth wobble-pop effect on click - adds personality to interactive elements
// Usage: ${getQuirkyClickStyles()}
// Optional: ${getQuirkyClickStyles('0.5s', '8deg', 1.1)} // duration, rotation, scale
export function getQuirkyClickStyles(
  duration: string = '0.5s',
  rotation: string = '8deg',
  scale: number = 1.12
) {
  const rotationNum = parseFloat(rotation);
  
  const quirkyWobblePop = keyframes`
    0% {
      transform: scale(1) rotate(0deg);
    }
    20% {
      transform: scale(${scale}) rotate(-${rotationNum * 0.8}deg);
    }
    40% {
      transform: scale(${scale * 0.92}) rotate(${rotationNum * 0.7}deg);
    }
    55% {
      transform: scale(${scale * 0.96}) rotate(-${rotationNum * 0.4}deg);
    }
    70% {
      transform: scale(${scale * 0.94}) rotate(${rotationNum * 0.3}deg);
    }
    82% {
      transform: scale(${scale * 0.98}) rotate(-${rotationNum * 0.15}deg);
    }
    92% {
      transform: scale(${scale * 0.99}) rotate(${rotationNum * 0.08}deg);
    }
    100% {
      transform: scale(1) rotate(0deg);
    }
  `;
  
  return css`
    cursor: pointer;
    transition: transform 0.1s ease-out;
    
    &:active {
      animation: ${quirkyWobblePop} ${duration} cubic-bezier(0.34, 1.56, 0.64, 1);
    }
  `;
}

// ============ Digital Game Card 3D Effect ============
// 3D card effect with mouse-based tilt, perspective, hover lift, and dynamic light sheen
// Mimics a physical game card with depth and interactivity
// Requires useMousePosition hook to track cursor position
// Usage: ${getGameCard3DStyles()}
// Optional: ${getGameCard3DStyles('24px', '28deg', 1.08)} // lift, maxRotation, scale
export function getGameCard3DStyles(
  liftDistance: string = '24px',
  maxRotation: string = '28deg',
  scale: number = 1.08
) {
  const maxRot = parseFloat(maxRotation);
  
  // Animated shimmer sweep keyframes
  const shimmerSweep = keyframes`
    0% {
      transform: translateX(-100%) translateY(-100%) rotate(45deg);
    }
    100% {
      transform: translateX(200%) translateY(200%) rotate(45deg);
    }
  `;
  
  return css`
    position: relative;
    transform-style: preserve-3d;
    perspective: 1000px;
    --mouse-x: 0;
    --mouse-y: 0;
    transition: transform 0.15s cubic-bezier(0.23, 1, 0.32, 1), 
                box-shadow 0.2s cubic-bezier(0.23, 1, 0.32, 1);
    overflow: hidden;
    
    /* Smooth transition out with slight delay to prevent jerky animations */
    &:not(:hover) {
      transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1) 0.1s,
                  box-shadow 0.3s cubic-bezier(0.23, 1, 0.32, 1) 0.1s;
    }
    
    /* Subtle 3D shadow for depth */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15),
                0 1px 3px rgba(0, 0, 0, 0.1);
    
    &:hover {
      transform: translateY(-${liftDistance}) 
                 translateZ(40px)
                 rotateX(var(--rotate-x, 0deg))
                 rotateY(var(--rotate-y, 0deg))
                 scale(${scale});
      /* Enhanced drop shadow for lifted effect - more pronounced and spread out */
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6),
                  0 20px 50px rgba(0, 0, 0, 0.5),
                  0 10px 30px rgba(0, 0, 0, 0.4),
                  0 0 0 1px rgba(255, 255, 255, 0.2) inset;
    }
    
    /* Dynamic intense glare that follows mouse position */
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(
        circle 200px at calc(50% + var(--mouse-x) * 50%) calc(50% + var(--mouse-y) * 50%),
        rgba(255, 255, 255, 0.6) 0%,
        rgba(255, 255, 255, 0.4) 20%,
        rgba(255, 255, 255, 0.2) 40%,
        rgba(255, 255, 255, 0) 60%,
        transparent 100%
      );
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
      border-radius: inherit;
      z-index: 1;
      mix-blend-mode: overlay;
    }
    
    &:hover::before {
      opacity: 1;
    }
    
    /* Animated sweeping shimmer glare - more visible */
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
      animation: ${shimmerSweep} 2.5s ease-in-out infinite;
      mix-blend-mode: overlay;
      will-change: transform, opacity;
    }
    
    &:hover::after {
      opacity: 0.9;
    }
    
    /* Ensure content stays above shine effects */
    > * {
      position: relative;
      z-index: 2;
    }
  `;
}

// Common non-DOM props that should be filtered
export const COMMON_NON_DOM_PROPS = [
  'filled',
  'active',
  'completed',
  'isDragging',
  'hasFile',
  'showImagePreview',
  'isOpen',
  'isPlaceholder',
  'variant',
  'status',
  'type',
  'hasPermission',
] as const;
