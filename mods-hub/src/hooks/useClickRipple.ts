/**
 * React hook for cursor-position click ripple effect
 * Sets CSS variables to position the ripple at the click location
 */

import { useCallback, useRef } from 'react';

export function useClickRipple() {
  const elementRef = useRef<HTMLElement | null>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const element = e.currentTarget;
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Set CSS variables for ripple position
    element.style.setProperty('--ripple-x', `${x}px`);
    element.style.setProperty('--ripple-y', `${y}px`);

    // Trigger the ripple animation by toggling a class or forcing a reflow
    // The CSS :active pseudo-class will handle the animation
  }, []);

  return {
    ref: elementRef,
    onClick: handleClick,
  };
}
