/**
 * React hook for tracking mouse position relative to an element
 * Used for 3D card tilt effects based on cursor position
 * Includes debounced mouse leave to prevent jerky animations on rapid hover
 */

import { useCallback, useRef, useState } from 'react';

export interface MousePosition {
  x: number; // -1 to 1 (left to right)
  y: number; // -1 to 1 (top to bottom)
}

export function useMousePosition(debounceDelay: number = 250) {
  const elementRef = useRef<HTMLElement | null>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 });

  const resetToDefault = useCallback((element: HTMLElement) => {
    setMousePosition({ x: 0, y: 0 });
    element.style.setProperty('--mouse-x', '0');
    element.style.setProperty('--mouse-y', '0');
    element.style.setProperty('--rotate-x', '0deg');
    element.style.setProperty('--rotate-y', '0deg');
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const element = e.currentTarget;
    
    // Cancel any pending leave timeout - mouse is back!
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    
    const rect = element.getBoundingClientRect();
    
    // Calculate mouse position relative to element center
    // Returns values from -1 to 1
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    
    setMousePosition({ x, y });
    
    // Update CSS custom properties for the element
    // Store both raw values and calculated rotations with units
    element.style.setProperty('--mouse-x', `${x}`);
    element.style.setProperty('--mouse-y', `${y}`);
    
    // Calculate rotations directly (max 28deg by default, can be overridden via CSS)
    const maxRot = 28; // This should match the maxRotation in the styles
    element.style.setProperty('--rotate-x', `${y * maxRot * -1}deg`);
    element.style.setProperty('--rotate-y', `${x * maxRot}deg`);
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const element = e.currentTarget;
    
    // Clear any existing timeout
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
    }
    
    // Debounce the reset - wait before reverting to default state
    // This prevents jerky animations when rapidly moving mouse in and out
    leaveTimeoutRef.current = setTimeout(() => {
      resetToDefault(element);
      leaveTimeoutRef.current = null;
    }, debounceDelay);
  }, [debounceDelay, resetToDefault]);

  return {
    ref: elementRef,
    mousePosition,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
  };
}
