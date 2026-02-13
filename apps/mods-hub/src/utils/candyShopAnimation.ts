/**
 * Candy Shop Slanted Bar Animation Utility
 * Reusable animation for styled-components
 */

import { keyframes, css } from 'styled-components';

// Candy shop slanted bar animation keyframes
// Moves diagonal bars horizontally for seamless infinite loop
// Must move by exactly background-size (56.568px) for seamless connection
export const candyShopBarsKeyframes = keyframes`
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 56.568px 0;
  }
`;

/**
 * Candy shop slanted bar animation mixin
 * Apply this to any styled component to get the moving diagonal bars effect
 * 
 * Usage:
 * const MyButton = styled.button`
 *   ${candyShopAnimation}
 * `;
 */
export const candyShopAnimation = css`
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    background-image: repeating-linear-gradient(
      45deg,
      transparent 0px,
      transparent 20px,
      rgba(255, 255, 255, 0.4) 20px,
      rgba(255, 255, 255, 0.4) 40px
    );
    background-size: 56.568px 56.568px;
    background-repeat: repeat;
    background-position: 0 0;
    animation: ${candyShopBarsKeyframes} 2s linear infinite;
    pointer-events: none;
    z-index: 1;
    will-change: background-position;
  }
  
  /* Keep animation running regardless of button state */
  &:hover:not(:disabled)::after,
  &:active:not(:disabled)::after {
    animation-play-state: running;
  }
  
  /* Ensure content stays above animation */
  & > * {
    position: relative;
    z-index: 2;
  }
`;
