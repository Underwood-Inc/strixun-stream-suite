# Animation System Architecture

## Overview

A comprehensive, decoupled, unopinionated animation system that supports:
- All Lua source animations (fade, slide, zoom, pop)
- Text cycler transitions (obfuscate, typewriter, glitch, scramble, wave)
- Source swap animations (slide, arc, scale, bounce, elastic, crossfade)
- User-configurable preferences
- Respects `prefers-reduced-motion`

## Architecture

### Core Components

1. **Types** (`types.ts`) - TypeScript definitions for all animation configs
2. **Presets** (`presets.ts`) - Predefined animation presets matching Lua animations
3. **Store** (`store.ts`) - User preferences and settings management
4. **Actions** (`actions.ts`) - Svelte actions for easy component integration

### Usage

#### Basic Usage

```svelte
<script>
  import { animate } from '$core/animations';
</script>

<div use:animate={{ preset: 'fadeIn', duration: 300 }}>
  Content
</div>
```

#### With Stagger

```svelte
<div use:stagger={{ preset: 'slideUp', stagger: 50 }}>
  {#each items as item}
    <div>{item}</div>
  {/each}
</div>
```

#### Programmatic Control

```svelte
<script>
  import { animate } from '$core/animations';
  
  let element: HTMLElement;
  let animControl;
  
  $: if (element) {
    animControl = element.__animation;
  }
  
  function play() {
    animControl?.play();
  }
</script>

<div bind:this={element} use:animate={{ preset: 'bounceIn' }}>
  Content
</div>
<button on:click={play}>Play</button>
```

## Supported Animations

### Lua Source Animations
- `fade` - Opacity transition
- `slide` - Directional slide (left/right/up/down)
- `zoom` - Scale animation
- `pop` - Bouncy scale animation

### Text Cycler Transitions
- `obfuscate` - Minecraft enchant scramble
- `typewriter` - Character-by-character reveal
- `glitch` - Random glitch characters
- `scramble` - Full random then snap
- `wave` - Wave pattern reveal

### Advanced Animations
- `fadeIn` / `fadeOut`
- `slideUp` / `slideDown` / `slideLeft` / `slideRight`
- `scaleIn` / `scaleOut`
- `bounceIn` / `bounceOut`
- `rotateIn` / `rotateOut`
- `flipX` / `flipY`
- `shake`, `pulse`, `float`, `glow`
- `stagger` - For multiple elements

## User Preferences

Users can:
- Enable/disable animations globally
- Adjust animation speed (0.5x to 2x)
- Override specific animations
- Disable individual animations by ID

Preferences are stored in `ui_animation_preferences` and respect `prefers-reduced-motion`.

## Easing Functions

All Lua easing functions are supported:
- `linear`, `easeIn`, `easeOut`, `easeInOut`
- `easeInCubic`, `easeOutCubic`, `easeInOutCubic`
- `bounce`, `elastic`, `back`

## Performance

- GPU-accelerated transforms
- Respects user motion preferences
- Efficient animation batching
- No business logic coupling

