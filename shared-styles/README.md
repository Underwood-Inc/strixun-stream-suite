# Strixun Stream Suite - Shared Styles Library

Framework-agnostic SCSS design system for consistent styling across all projects.

## Structure

- `_variables.scss` - Design tokens, colors, spacing, CSS variables
- `_animations.scss` - Keyframes, animation mixins, arcade button styles
- `_mixins.scss` - Reusable style patterns (buttons, inputs, cards, etc.)

## Usage

### In Svelte Projects

```scss
<style lang="scss">
  @use '../../shared-styles/animations' as *;
  @use '../../shared-styles/mixins' as *;
  
  .my-button {
    @include arcade-button;
  }
  
  .my-input {
    @include input;
  }
</style>
```

### In React/TypeScript Projects

Import in your SCSS files:

```scss
@use '../../shared-styles/animations' as *;
@use '../../shared-styles/mixins' as *;

.my-component {
  @include arcade-button;
}
```

### CSS Variables

CSS variables are automatically available via `_variables.scss`. They're defined in `:root` and can be used directly:

```css
.my-element {
  background: var(--card);
  color: var(--text);
  padding: var(--spacing-md);
}
```

## Features

- **Arcade Button Style** - Retro, gamified button with hover/active animations
- **Input Styling** - Consistent form inputs with focus states
- **Animation System** - GPU-accelerated animations (fade, slide, bounce, etc.)
- **Design Tokens** - Centralized colors, spacing, and typography
- **Mixins** - Reusable patterns for cards, buttons, inputs, scrollbars

## Design Philosophy

- **Performance First** - All animations use GPU-accelerated properties
- **Retro Aesthetic** - Blocky, arcade-style interactions
- **Framework Agnostic** - Pure SCSS, works with any framework
- **Consistent** - Single source of truth for design system

