# @strixun/use-cursor-tracking

React hook for smooth cursor position tracking with interpolation.

## Features

- Tracks mouse position relative to an element
- Smoothly interpolates rotation values
- Supports watching external elements via ref
- Automatic reset animation on mouse leave
- Configurable rotation limits and interpolation speed

## Installation

```bash
pnpm add @strixun/use-cursor-tracking
```

## Usage

```tsx
import { useCursorTracking } from '@strixun/use-cursor-tracking';

function MyCard() {
  const { elementRef, rotation, handleMouseMove, handleMouseLeave } = useCursorTracking({
    maxRotation: 28,
    lerpFactor: 0.15
  });

  return (
    <div
      ref={elementRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transform: `rotateX(${rotation.rotateX}deg) rotateY(${rotation.rotateY}deg)` }}
    >
      Card
    </div>
  );
}
```

## API

See TypeScript definitions for full API documentation.
