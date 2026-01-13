/**
 * Position Detector - Detects if element is already positioned
 * Used to determine if floating player should be used
 */

export interface PositionInfo {
  isPositioned: boolean;
  position: 'absolute' | 'relative' | 'fixed' | 'static' | null;
  parentPositioned: boolean;
}

/**
 * Check if an element or its parent is positioned
 */
export function detectPosition(element: HTMLElement | null): PositionInfo {
  if (!element) {
    return {
      isPositioned: false,
      position: null,
      parentPositioned: false,
    };
  }
  
  const style = window.getComputedStyle(element);
  const position = style.position;
  const isPositioned = position !== 'static';
  
  // Check parent
  let parent = element.parentElement;
  let parentPositioned = false;
  
  while (parent && parent !== document.body) {
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.position !== 'static') {
      parentPositioned = true;
      break;
    }
    parent = parent.parentElement;
  }
  
  return {
    isPositioned,
    position: isPositioned ? (position as any) : null,
    parentPositioned,
  };
}

/**
 * Check if element should use floating player
 */
export function shouldUseFloatingPlayer(element: HTMLElement | null, configFloating?: boolean): boolean {
  // If explicitly set to false, don't use floating
  if (configFloating === false) {
    return false;
  }
  
  // If explicitly set to true, use floating
  if (configFloating === true) {
    return true;
  }
  
  // Auto-detect: use floating if element is not positioned
  const positionInfo = detectPosition(element);
  return !positionInfo.isPositioned && !positionInfo.parentPositioned;
}
