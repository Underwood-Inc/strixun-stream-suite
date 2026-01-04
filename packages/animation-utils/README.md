# @strixun/animation-utils

Framework-agnostic animation utilities for 3D transforms and easing functions.

## Features

- Pure functions with no dependencies
- TypeScript with strong typing
- Works in any JavaScript/TypeScript environment
- RequestAnimationFrame-based animations
- Multiple easing functions included

## Installation

```bash
pnpm add @strixun/animation-utils
```

## Usage

### Easing Functions

```typescript
import { easeInOutCubic, easeOutCubic, easeInCubic, linear } from '@strixun/animation-utils';

// Use in your animations
const progress = 0.5;
const eased = easeInOutCubic(progress); // 0.5
```

### Flip Animation

```typescript
import { animateFlip } from '@strixun/animation-utils';

const cancel = animateFlip(
  cardElement,
  {
    startRotateY: 0,
    targetRotateY: 180,
    startRotateX: 0,
    targetRotateX: 0,
    duration: 600
  },
  (progress, currentRotateY, currentRotateX) => {
    console.log(`Progress: ${progress}`);
  },
  () => {
    console.log('Animation complete!');
  }
);

// Cancel if needed
cancel();
```

### Hover Reset Animation

```typescript
import { animateHoverReset } from '@strixun/animation-utils';

const cancel = animateHoverReset(
  {
    startHoverX: 15,
    startHoverY: -10,
    duration: 400
  },
  (hoverX, hoverY) => {
    element.style.transform = `rotateX(${hoverX}deg) rotateY(${hoverY}deg)`;
  }
);
```

## API

See TypeScript definitions for full API documentation.
