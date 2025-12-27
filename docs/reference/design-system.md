# Design System Documentation

**Strixun Stream Suite - Complete Design System Reference**

This document provides a comprehensive reference for all design tokens, color palettes, typography, spacing, and styling constants used throughout the Strixun Stream Suite application.

## Table of Contents

1. [Color Palette](#color-palette)
2. [Typography](#typography)
3. [Spacing](#spacing)
4. [Layout & Components](#layout--components)
5. [Animations](#animations)
6. [Z-Index Layers](#z-index-layers)
7. [Usage Guidelines](#usage-guidelines)

---

## Color Palette

The Strixun Stream Suite uses a warm, retro arcade aesthetic with a dark brown/black base and golden yellow accents.

### Background Colors

| Variable | Hex Value | Usage |
|----------|-----------|-------|
| `--bg` | `#1a1611` | Main application background |
| `--bg-dark` | `#0f0e0b` | Darker background for nested elements |
| `--card` | `#252017` | Card and panel backgrounds |
| `--border` | `#3d3627` | Default border color |
| `--border-light` | `#4a4336` | Lighter border for hover states |

### Brand Colors

| Variable | Hex Value | Usage |
|----------|-----------|-------|
| `--accent` | `#edae49` | Primary accent color (golden yellow) |
| `--accent-light` | `#f9df74` | Lighter accent for hover states |
| `--accent-dark` | `#c68214` | Darker accent for borders and shadows |
| `--accent2` | `#6495ed` | Secondary accent (cornflower blue) |

### Status Colors

| Variable | Hex Value | Usage |
|----------|-----------|-------|
| `--success` | `#28a745` | Success states, positive feedback |
| `--warning` | `#ffc107` | Warning states, caution messages |
| `--danger` | `#ea2b1f` | Error states, destructive actions |
| `--info` | `#6495ed` | Informational messages, links |

### Text Colors

| Variable | Hex Value | Usage |
|----------|-----------|-------|
| `--text` | `#f9f9f9` | Primary text color |
| `--text-secondary` | `#b8b8b8` | Secondary text, labels |
| `--muted` | `#888` | Muted text, placeholders |

### Glass Effects

| Variable | RGBA Value | Usage |
|----------|------------|-------|
| `--glass-bg` | `rgba(37, 32, 23, 0.95)` | Glass effect backgrounds |
| `--glass-bg-dark` | `rgba(26, 22, 17, 0.98)` | Darker glass backgrounds |
| `--glass-border` | `rgba(61, 54, 39, 0.8)` | Glass effect borders |

### Color Usage Guidelines

- **Always use CSS variables** (`var(--color-name)`) instead of hardcoded hex values
- **Never hardcode colors** in components - use the design system
- **Status colors** should only be used for their semantic purpose (success/warning/danger/info)
- **Accent colors** are for primary actions and highlights
- **Text colors** should maintain sufficient contrast (WCAG AA minimum)

---

## Typography

### Font Family

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

System font stack for optimal performance and native feel.

### Font Sizes

| Size | Value | Usage |
|------|-------|-------|
| `xs` | `0.75em` (12px) | Small labels, badges |
| `sm` | `0.85em` (~13.6px) | Secondary text, captions |
| `base` | `0.9em` (~14.4px) | Body text, default |
| `md` | `1em` (16px) | Standard text |
| `lg` | `1.25em` (20px) | Subheadings |
| `xl` | `1.5em` (24px) | Section headings |
| `2xl` | `1.75em` (28px) | Page headings |
| `3xl` | `2em` (32px) | Main titles |

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| `normal` | `400` | Body text |
| `medium` | `500` | Labels, emphasis |
| `semibold` | `600` | Headings |
| `bold` | `700` | Strong emphasis, buttons |

### Typography Hierarchy

```scss
h1 { font-size: 2em; font-weight: 600; }
h2 { font-size: 1.75em; font-weight: 600; }
h3 { font-size: 1.5em; font-weight: 600; }
h4 { font-size: 1.25em; font-weight: 600; }
```

---

## Spacing

The design system uses an **8px grid** for consistent spacing.

| Size | Value | Usage |
|------|-------|-------|
| `xs` | `4px` | Tight spacing, icons |
| `sm` | `8px` | Small gaps, padding |
| `md` | `12px` | Standard gaps |
| `lg` | `16px` | Card padding, larger gaps |
| `xl` | `20px` | Section padding |
| `2xl` | `24px` | Button padding |
| `3xl` | `32px` | Large sections |
| `4xl` | `48px` | Page margins |

### Spacing Guidelines

- Use consistent spacing multiples of 4px or 8px
- Maintain visual rhythm with the grid
- Use larger spacing for separation, smaller for grouping

---

## Layout & Components

### Border Radius

| Size | Value | Usage |
|------|-------|-------|
| `none` | `0` | Arcade buttons (blocky style) |
| `sm` | `4px` | Small elements, badges |
| `md` | `6px` | Inputs, cards |
| `lg` | `8px` | Panels, modals |
| `full` | `50%` | Circular elements (avatars, icons) |

### Shadows

| Size | Value | Usage |
|------|-------|-------|
| `sm` | `0 2px 4px rgba(0, 0, 0, 0.1)` | Subtle elevation |
| `md` | `0 2px 8px rgba(0, 0, 0, 0.2)` | Cards, panels |
| `lg` | `0 4px 12px rgba(0, 0, 0, 0.3)` | Modals, dropdowns |
| `glow` | `0 0 8px var(--accent)` | Accent highlights |

### Buttons

Arcade-style buttons with:
- **No border radius** (blocky, retro aesthetic)
- **3px border** with darker color for depth
- **Box shadow** for 3D effect (`0 4px 0 border-color`)
- **Transform on hover** (lift up 2px)
- **Press animation** on active state

```scss
@include arcade-button(var(--accent), var(--accent-dark));
```

### Inputs

Standard input styling:
- Dark background (`--bg-dark`)
- Border with accent focus state
- Rounded corners (`6px`)
- Focus ring with accent color

### Cards

Card components use:
- `--card` background
- `1px solid var(--border)` border
- `8px` border radius
- `16px` padding
- Medium shadow for depth

---

## Animations

### Durations

| Duration | Value | Usage |
|----------|-------|-------|
| `fast` | `0.1s` | Button interactions |
| `normal` | `0.2s` | Hover states |
| `slow` | `0.3s` | Page transitions |
| `slower` | `0.5s` | Complex animations |

### Easing Functions

| Function | Value | Usage |
|----------|-------|-------|
| `easeOut` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard transitions |
| `easeIn` | `cubic-bezier(0.4, 0, 1, 1)` | Entering animations |
| `easeInOut` | `cubic-bezier(0.4, 0, 0.2, 1)` | Smooth transitions |
| `bounce` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Playful animations |

### Animation Presets

- **fadeIn**: Opacity transition
- **slideUp**: Slide from bottom with fade
- **slideDown**: Slide from top with fade
- **bounceIn**: Scale bounce effect
- **pressDown**: Button press animation
- **glowPulse**: Pulsing glow effect
- **float**: Gentle vertical float
- **ripple**: Click ripple effect

### GPU Acceleration

All animations use GPU acceleration for smooth performance:

```scss
@include gpu-accelerated;
// Applies: transform: translateZ(0); will-change: transform;
```

---

## Z-Index Layers

Proper layering system for stacking context:

| Level | Value | Usage |
|-------|-------|-------|
| `base` | `1` | Default content |
| `sticky` | `100` | Sticky headers |
| `dropdown` | `1000` | Dropdowns, popovers |
| `modal` | `10000` | Modals, dialogs |
| `toast` | `99999` | Toast notifications |
| `alert` | `100001` | Alert overlays |
| `tooltip` | `100002` | Tooltips (highest) |

### Z-Index Guidelines

- **Never use arbitrary z-index values**
- **Use the defined scale** for consistency
- **Tooltips are always on top** (100002)
- **Modals should be above dropdowns** but below tooltips

---

## Breakpoints

Mobile-first responsive design:

| Breakpoint | Value | Usage |
|------------|-------|-------|
| `sm` | `480px` | Small mobile devices |
| `md` | `768px` | Tablets |
| `lg` | `1024px` | Desktop |
| `xl` | `1280px` | Large desktop |

### Responsive Guidelines

- Start with mobile styles (default)
- Use `@media (min-width: ...)` for larger screens
- Use `clamp()` for fluid typography
- Test on actual devices when possible

---

## Usage Guidelines

### In SCSS/SASS

```scss
@use '../styles/variables' as *;

.my-component {
  background: var(--card);
  color: var(--text);
  padding: var(--spacing-lg);
  border-radius: var(--border-radius-md);
}
```

### In TypeScript/JavaScript

```typescript
import { COLORS, SPACING, THEME } from '@/lib/design-system/constants';

const cardStyle = {
  backgroundColor: COLORS.card,
  padding: SPACING.lg,
};
```

### In Svelte Components

```svelte
<style lang="scss">
  @use '@styles/variables' as *;
  
  .component {
    background: var(--card);
    color: var(--text);
  }
</style>
```

### CSS Custom Properties

Always prefer CSS variables for runtime theming:

```css
/* ✅ Good */
color: var(--text);
background: var(--card);

/* ❌ Bad */
color: #f9f9f9;
background: #252017;
```

---

## Design Principles

1. **Consistency**: Use design tokens, never hardcode values
2. **Accessibility**: Maintain WCAG AA contrast ratios
3. **Performance**: GPU-accelerate animations, minimize repaints
4. **Retro Aesthetic**: Blocky buttons, warm colors, arcade feel
5. **Responsive**: Mobile-first, progressive enhancement

---

## Additional Resources

- **SCSS Variables**: `src/styles/_variables.scss`
- **TypeScript Constants**: `src/lib/design-system/constants.ts`
- **Mixins**: `src/styles/_mixins.scss`
- **Animations**: `src/styles/_animations.scss`

---

*Last updated: 2024-12-23*

