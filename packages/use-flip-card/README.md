# @strixun/use-flip-card

React hook combining 3D transforms, cursor tracking, and flip animations for interactive cards.

## Features

- Click-to-flip animation
- Drag-to-rotate when flipped
- Smooth cursor tracking with hover tilt
- Click vs drag detection
- Complete state management

## Installation

```bash
pnpm add @strixun/use-flip-card
```

## Usage

```tsx
import { useFlipCard } from '@strixun/use-flip-card';

function MyCard() {
  const {
    cardRef,
    isFlipped,
    transformString,
    handleClick,
    handleMouseDown,
    handleMouseMove,
    cursorHandlers
  } = useFlipCard({
    maxRotation: 28,
    flipDuration: 600
  });

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      {...cursorHandlers}
      style={{ transform: transformString }}
    >
      {isFlipped ? 'Back' : 'Front'}
    </div>
  );
}
```

## API

See TypeScript definitions for full API documentation.
