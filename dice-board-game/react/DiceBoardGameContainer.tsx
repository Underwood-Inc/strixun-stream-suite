/**
 * Dice Board Game Container
 * Wrapper component that handles DOM element attachment
 */

import React, { useRef, useEffect } from 'react';
import { DiceBoardGame } from './DiceBoardGame.jsx';
import type { DiceBoardGameContainerProps } from './types.js';

export function DiceBoardGameContainer({
  containerRef: externalRef,
  width = '100%',
  height = '100%',
  className,
  ...gameProps
}: DiceBoardGameContainerProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = externalRef || internalRef;

  useEffect(() => {
    if (containerRef && 'current' in containerRef && containerRef.current) {
      // Ensure container has proper styling for border-like attachment
      const element = containerRef.current;
      element.style.position = 'relative';
      element.style.width = typeof width === 'number' ? `${width}px` : width;
      element.style.height = typeof height === 'number' ? `${height}px` : height;
      element.style.overflow = 'hidden';
    }
  }, [containerRef, width, height]);

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={className}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <DiceBoardGame {...gameProps} containerRef={containerRef as React.RefObject<HTMLElement>} />
    </div>
  );
}
