# GitHub Copilot Instructions - Strixun Stream Suite

## CRITICAL: Svelte SCSS Rules - MUST FOLLOW

### NEVER Use Nested BEM Selectors in Svelte Components
- **ABSOLUTE PROHIBITION**: Never use nested BEM selectors with `&__` or `&--` in Svelte `<style lang="scss">` blocks
- **Why**: Svelte's scoped styles don't compile nested BEM selectors correctly, causing styles to not apply
- **This is a compile-time error** - the code will NOT build if you use nested BEM in Svelte components
- **Solution**: Always use explicit descendant selectors

### ❌ WRONG - Nested BEM (DO NOT USE - WILL NOT COMPILE):
```scss
<style lang="scss">
.component {
  &__child {
    color: red;
  }
  &--modifier {
    background: blue;
  }
}

.info-item {
  &__label {
    font-weight: bold;
  }
  &__value {
    &--active {
      color: green;
    }
  }
}
</style>
```

### ✅ CORRECT - Explicit Selectors (ALWAYS USE):
```scss
<style lang="scss">
.component {
  // Base styles only
}

.component .component__child {
  color: red;
}

.component .component--modifier {
  background: blue;
}

.info-item {
  // Base styles only
}

.info-item .info-item__label {
  font-weight: bold;
}

.info-item .info-item__value {
  // Value styles
}

.info-item .info-item__value--active {
  color: green;
}
</style>
```

### Import Requirements for SCSS Mixins
- **ALWAYS** import mixins/animations at the top of `<style lang="scss">` block
- Use: `@use '../styles/animations' as *;` or `@use '@styles/animations' as *;`
- Required before using mixins like `@include gpu-accelerated;`, `@include fade-in;`, etc.
- Example:
```scss
<style lang="scss">
  @use '../styles/animations' as *;
  
  .my-component {
    @include gpu-accelerated;
  }
</style>
```

# GitHub Copilot Instructions - Strixun Stream Suite

## CSS/SCSS Rules - CRITICAL

### NEVER Use !important
- **ABSOLUTE PROHIBITION**: Never use `!important` in CSS, SCSS, SASS, or any CSS preprocessor
- **Exception**: Only utility classes (`.hidden`, `.visible`) may use `!important` for override purposes
- **Solution**: Use correct CSS specificity selectors instead
- **Why**: `!important` breaks the cascade and makes styles unmaintainable

### NEVER Use Nested BEM Selectors in Svelte Components
- **ABSOLUTE PROHIBITION**: Never use nested BEM selectors with `&__` or `&--` in Svelte `<style lang="scss">` blocks
- **Why**: Svelte's scoped styles don't compile nested BEM selectors correctly, causing styles to not apply
- **Solution**: Always use explicit descendant selectors
- **CRITICAL**: This is a compile-time error - the code will NOT build if you use nested BEM in Svelte components

### ❌ WRONG - Nested BEM (DO NOT USE - WILL NOT COMPILE):
```scss
<style lang="scss">
.component {
  &__child {
    color: red;
  }
  &--modifier {
    background: blue;
  }
}

.info-item {
  &__label {
    font-weight: bold;
  }
  &__value {
    &--active {
      color: green;
    }
  }
}
</style>
```

### ✅ CORRECT - Explicit Selectors (ALWAYS USE):
```scss
<style lang="scss">
.component {
  // Base styles only
}

.component .component__child {
  color: red;
}

.component .component--modifier {
  background: blue;
}

.info-item {
  // Base styles only
}

.info-item .info-item__label {
  font-weight: bold;
}

.info-item .info-item__value {
  // Value styles
}

.info-item .info-item__value--active {
  color: green;
}
</style>
```

### Import Requirements for SCSS Mixins
- **ALWAYS** import mixins/animations at the top of `<style lang="scss">` block
- Use: `@use '../styles/animations' as *;` or `@use '@styles/animations' as *;`
- Required before using mixins like `@include gpu-accelerated;`, `@include fade-in;`, etc.
- Example:
```scss
<style lang="scss">
  @use '../styles/animations' as *;
  
  .my-component {
    @include gpu-accelerated;
  }
</style>
```

### CSS Specificity Rules
- Always use proper selector specificity
- Prefer class selectors over ID selectors
- Use BEM naming conventions for class names: `.block__element--modifier`
- Write explicit descendant selectors: `.parent .parent__child` not `.parent { &__child {} }`
- Use CSS custom properties (variables) for theming: `var(--color-name)`

### CSS Variable Usage
- **ALWAYS** use CSS variables from `_variables.scss` for colors, spacing, etc.
- **NEVER** hardcode color values like `#ff0000` or `rgb(255, 0, 0)`
- Use: `color: var(--text);` not `color: #f9f9f9;`
- Use: `background: var(--card);` not `background: #252017;`

### Positioning and Layout
- Use `position: fixed` for tooltips, modals, and overlays that need to escape parent containers
- Use `position: absolute` for positioned elements within a relative parent
- Use `position: relative` for creating positioning context
- Use `position: sticky` for scroll-sticking elements
- **NEVER** use `position: fixed` inside a `position: relative` container without portal rendering

### Z-Index Management
- Tooltips and overlays: `z-index: 99999` (highest)
- Modals and dialogs: `z-index: 10000`
- Dropdowns and popovers: `z-index: 1000`
- Sticky headers: `z-index: 100`
- Regular content: `z-index: 1` or auto
- **NEVER** use arbitrary z-index values without documentation

### Transitions and Animations
- Always use CSS custom properties for transition durations: `transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);`
- Use `requestAnimationFrame` for JavaScript-driven animations
- Disable transitions during drag/resize operations: `.resizing { transition: none; }`
- Use GPU-accelerated properties: `transform`, `opacity` (not `width`, `height`, `top`, `left`)

### Smooth Width Transitions for Side Panels/Overlays
- **CRITICAL**: Transitions must be applied to the element that changes, not parent selectors
- **NEVER** use `:has()` selector for width transitions - CSS transitions don't work on selector matching changes
- **Problem**: When using `:has()` on a parent, the transition is scoped incorrectly and won't animate
  ```scss
  // ❌ WRONG - transition won't work because selector matching doesn't trigger transitions
  .parent:has(.child.expanded) .content {
    transition: margin-right 0.3s ease;
    margin-right: 280px;
  }
  ```
- **Solution**: Use CSS variables on the element that needs to transition
  ```scss
  // ✅ CORRECT - transition is on the element that changes
  .content {
    transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    margin-right: var(--filter-aside-width, 0px);
  }
  ```
  ```typescript
  // Set CSS variable on document root, not on parent element
  $: document.documentElement.style.setProperty('--filter-aside-width', expanded ? `${width}px` : '0px');
  ```
- **Why**: CSS transitions only work on property value changes, not selector matching changes
- **Scoping**: The transition must be on the same element that has the property being animated
- This ensures smooth transitions when side panels expand/collapse
- Works for any dynamic width adjustment that needs to animate

### Responsive Design
- Use CSS custom properties for breakpoints
- Mobile-first approach: start with mobile styles, add desktop with `@media (min-width: ...)`
- Use `clamp()` for fluid typography: `font-size: clamp(14px, 2vw, 18px);`
- Use `min()`, `max()`, and `clamp()` for responsive spacing

### Performance
- Use `will-change` sparingly and only for elements that will animate
- Use `transform: translateZ(0)` or `transform: translate3d(0,0,0)` for GPU acceleration
- Avoid animating `width`, `height`, `top`, `left` - use `transform` instead
- Use `contain` property for isolated components: `contain: layout style paint;`

### Portal Rendering
- Tooltips, modals, and overlays MUST be rendered at body level using portals
- Use Svelte actions or manual DOM manipulation to append to `document.body`
- Set portal container: `position: fixed; z-index: 99999; pointer-events: none;`
- Clean up portal containers in `onDestroy`

### Scrollbar Styling
- Use `::-webkit-scrollbar` for WebKit browsers
- Use `scrollbar-width` and `scrollbar-color` for Firefox
- Always provide both WebKit and Firefox fallbacks
- Use CSS variables for scrollbar colors

### Content Adjustment (Layout Shift Prevention)
- When scrollbars appear/disappear, use negative margin + padding to prevent layout shift
- Apply adjustment only when scrollbar is present
- Use CSS variables for dynamic width: `margin-right: var(--scrollbar-width, 0px);`
- Remove adjustment when scrollbar disappears

## Component Architecture Rules

### Component Composition
- Components MUST be reusable, composable, and unopinionated
- NO business logic in UI components
- Use slots for composition
- Props should be generic and UI-focused
- Use CSS variables for theming, not hardcoded values

### File Organization
- Keep component files under 300 lines
- Split large files into smaller, composable modules
- One component per file
- Co-locate styles with components (Svelte `<style>` blocks)

## TypeScript Rules

### Type Safety
- Always use TypeScript types, never `any`
- Use interfaces for object shapes
- Use type unions for limited value sets: `'top' | 'bottom' | 'left' | 'right'`
- Export types from component files

### Import Organization
- Group imports: Svelte → stores → modules → types → utils
- Use absolute imports with path aliases: `@/components`, `@/stores`
- Never import business logic into UI components

## General Code Quality

### Naming Conventions
- Use descriptive, semantic names
- Use camelCase for variables and functions
- Use PascalCase for components and classes
- Use kebab-case for CSS classes and file names
- Use SCREAMING_SNAKE_CASE for constants

### Documentation
- Document complex logic with inline comments
- Use JSDoc for function documentation
- Include usage examples in component documentation
- Document CSS custom properties and their purpose

### Error Handling
- Always handle edge cases
- Provide fallbacks for missing data
- Use optional chaining: `obj?.prop?.nested`
- Validate inputs in components

## HTML/Anchor Tag Rules - CRITICAL

### NEVER Add href to Non-Anchor Elements
- **ABSOLUTE PROHIBITION**: Never add `href` attribute to any element other than `<a>` (anchor tag)
- **Why**: `href` is only valid on anchor tags. Using it on other elements (div, button, span, etc.) is invalid HTML and breaks accessibility
- **Solution**: Use proper semantic HTML - if you need a link, use an `<a>` tag
- **Exception**: None. This rule has no exceptions.

### ❌ WRONG - href on non-anchor elements (DO NOT USE):
```svelte
<!-- WRONG: href on a div -->
<div href="https://example.com">Link</div>

<!-- WRONG: href on a button -->
<button href="https://example.com">Link</button>

<!-- WRONG: href on a span -->
<span href="https://example.com">Link</span>

<!-- WRONG: href on a Card component -->
<Card href="https://example.com">Link</Card>
```

### ✅ CORRECT - Use anchor tags for links (ALWAYS USE):
```svelte
<!-- CORRECT: href on an anchor tag -->
<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>

<!-- CORRECT: Anchor tag styled as a card -->
<a href="https://example.com" class="card-link" target="_blank" rel="noopener noreferrer">
  <div class="card-content">Link Content</div>
</a>

<!-- CORRECT: Anchor tag with proper styling -->
<a href="https://example.com" class="button-link" target="_blank" rel="noopener noreferrer">
  Click Me
</a>
```

### External Link Best Practices
- Always use `target="_blank"` for external links
- Always include `rel="noopener noreferrer"` for security when using `target="_blank"`
- Use semantic HTML: `<a>` for links, `<button>` for actions, `<div>` for containers
- Style anchor tags with CSS to look like buttons/cards if needed, but keep the semantic HTML