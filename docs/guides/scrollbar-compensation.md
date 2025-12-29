# Scrollbar Compensation Utility

A standalone, agnostic utility that prevents horizontal layout shift when scrollbars appear/disappear on any element.

## Features

- ✅ Works on any element (not just body/html)
- ✅ Automatic scrollbar detection
- ✅ CSS variable-based compensation
- ✅ Zero dependencies
- ✅ Can be used globally or per-element
- ✅ Works with any CSS framework
- ✅ Available via CDN or as a local module

## CDN Usage

### Basic Usage

Add this script tag to your HTML:

```html
<script src="https://strixun-twitch-api.strixuns-script-suite.workers.dev/cdn/scrollbar-compensation.js"></script>
```

The utility will auto-initialize and be available globally as `scrollbarCompensation`.

### Manual Element Attachment

```javascript
// Attach to a specific element
const myElement = document.querySelector('.my-scrollable-container');
scrollbarCompensation.attach(myElement);
```

### Automatic Attachment via Selector

```javascript
// Configure to automatically attach to all elements matching a selector
scrollbarCompensation.config.selector = '.scrollable';
scrollbarCompensation.init();
```

### Custom Configuration

```javascript
// Create a new instance with custom config
const customComp = new ScrollbarCompensation({
  cssVariable: '--my-scrollbar-width',
  transitionDuration: '0.3s',
  transitionEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  selector: '.my-scrollable'
});

customComp.init();
```

## Local Usage (Svelte/TypeScript)

### Import and Use

```typescript
import { getScrollbarCompensation } from '$lib/utils/scrollbar-compensation';

// Get global instance
const scrollbarComp = getScrollbarCompensation({
  cssVariable: '--my-scrollbar-width'
});

// In your component
let container: HTMLDivElement;

onMount(() => {
  if (container) {
    scrollbarComp.attach(container);
  }
});

onDestroy(() => {
  if (container) {
    scrollbarComp.detach(container);
  }
});
```

### Reactive Updates

```svelte
<script>
  import { getScrollbarCompensation } from '$lib/utils/scrollbar-compensation';
  
  let container: HTMLDivElement;
  const scrollbarComp = getScrollbarCompensation();
  
  $: if (items.length && container) {
    // Update compensation when content changes
    requestAnimationFrame(() => {
      scrollbarComp.update(container);
    });
  }
</script>

<div bind:this={container} class="scrollable">
  {#each items as item}
    <div>{item}</div>
  {/each}
</div>
```

## API Reference

### Methods

#### `attach(element: HTMLElement)`
Attach compensation to an element. The utility will automatically detect scrollbar presence and apply compensation.

#### `detach(element: HTMLElement)`
Remove compensation from an element and clean up observers.

#### `update(element: HTMLElement)`
Manually trigger an update check for an element. Useful when content changes programmatically.

#### `attachAll(selector: string): number`
Attach compensation to all elements matching a CSS selector. Returns the number of elements attached.

#### `detachAll()`
Remove compensation from all attached elements.

#### `init()`
Initialize the compensation system. If a selector is configured, it will automatically attach to matching elements.

#### `destroy()`
Destroy the compensation system and clean up all observers and event listeners.

### Configuration Options

```typescript
interface ScrollbarCompensationConfig {
  /** CSS variable name for scrollbar width (default: '--scrollbar-width') */
  cssVariable?: string;
  
  /** Transition duration for smooth compensation (default: '0.2s') */
  transitionDuration?: string;
  
  /** Transition easing function (default: 'ease') */
  transitionEasing?: string;
  
  /** Auto-initialize on DOM ready (default: true) */
  autoInit?: boolean;
  
  /** Selector for elements to watch (null = manual attach) */
  selector?: string | null;
  
  /** Namespace for CSS classes (default: 'scrollbar-compensation') */
  namespace?: string;
}
```

## How It Works

1. **Scrollbar Detection**: The utility measures the actual scrollbar width by creating a temporary scrollable element.

2. **State Monitoring**: Uses `ResizeObserver` and scroll events to detect when scrollbars appear/disappear.

3. **CSS Variable**: Sets a CSS variable (e.g., `--scrollbar-width`) on the element with the current scrollbar width.

4. **Compensation**: Applies negative margin and positive padding to compensate for the scrollbar space:
   - `margin-right: calc(var(--scrollbar-width) * -1)`
   - `padding-right: var(--scrollbar-width, 0px)`

5. **Smooth Transitions**: Adds CSS transitions for smooth compensation when scrollbars appear/disappear.

## Examples

### Example 1: Toast Container

```svelte
<script>
  import { getScrollbarCompensation } from '$lib/utils/scrollbar-compensation';
  
  let container: HTMLDivElement;
  const scrollbarComp = getScrollbarCompensation({
    cssVariable: '--toast-scrollbar-width'
  });
  
  onMount(() => {
    if (container) {
      scrollbarComp.attach(container);
    }
  });
  
  onDestroy(() => {
    if (container) {
      scrollbarComp.detach(container);
    }
  });
</script>

<div bind:this={container} class="toast-container">
  <!-- Content -->
</div>
```

### Example 2: Multiple Scrollable Areas

```javascript
// Attach to multiple elements
scrollbarCompensation.attachAll('.scrollable-area');

// Or manually
document.querySelectorAll('.scrollable-area').forEach(el => {
  scrollbarCompensation.attach(el);
});
```

### Example 3: Dynamic Content

```javascript
const container = document.querySelector('.dynamic-content');

// Attach once
scrollbarCompensation.attach(container);

// When content changes, the utility automatically detects and updates
// Or manually trigger update:
function addContent() {
  container.innerHTML += '<div>New content</div>';
  scrollbarCompensation.update(container);
}
```

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers
- ⚠️ Internet Explorer 11 (limited - ResizeObserver polyfill recommended)

## Performance

- Uses `ResizeObserver` for efficient change detection
- Batches updates with `requestAnimationFrame`
- Minimal overhead - only observes attached elements
- Automatic cleanup on detach

## CDN Endpoint

```
GET https://strixun-twitch-api.strixuns-script-suite.workers.dev/cdn/scrollbar-compensation.js
```

**Headers:**
- `Content-Type: application/javascript; charset=utf-8`
- `Cache-Control: public, max-age=31536000, immutable`

## License

Part of the Strixun Stream Suite project. Free to use on any website.

