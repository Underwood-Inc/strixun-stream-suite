# @strixun/use-3d-transform

React hook for managing 3D transform state and calculations.

## Features

- Manages rotation values (X, Y axes)
- Handles flip state (0° or 180° on Y axis)
- Supports hover tilt calculations
- Provides clean API for transform updates
- Generates CSS transform strings

## Installation

```bash
pnpm add @strixun/use-3d-transform
```

## Usage

```tsx
import { use3DTransform } from '@strixun/use-3d-transform';

function MyCard() {
  const { elementRef, updateTransform, getTransformString, setFlipped } = use3DTransform({
    initialFlipped: false,
    enableHoverTilt: true
  });

  // Update hover tilt
  const handleMouseMove = () => {
    updateTransform({ hoverX: 10, hoverY: -5 });
  };

  // Flip the card
  const handleClick = () => {
    setFlipped(true);
  };

  return (
    <div ref={elementRef} style={{ transform: getTransformString() }}>
      Card content
    </div>
  );
}
```

## API

See TypeScript definitions for full API documentation.
