# ResizableZone Component System

A professional, composable, reusable component system for creating resizable zones that supports infinite nesting and both vertical and horizontal resizing.

## Features

- [OK] **Infinite Nesting** - Nest resizable zones within each other without limitation
- [OK] **Bidirectional** - Supports both vertical and horizontal resizing
- [OK] **Configurable** - Min/max sizes, default sizes, storage persistence
- [OK] **Touch Support** - Works on mobile devices
- [OK] **Smooth Animations** - RequestAnimationFrame for 60fps performance
- [OK] **Storage Persistence** - Automatically saves/restores sizes via localStorage
- [OK] **TypeScript** - Fully typed for better DX
- [OK] **Framework Agnostic** - Core logic is framework-independent

## Architecture

The system consists of two parts:

1. **ResizableZoneController** (`ResizableZone.ts`) - Core logic, framework-agnostic
2. **ResizableZone Component** (`ResizableZone.svelte`) - Svelte wrapper component

### ResizableZoneController

The controller handles all resize logic without UI concerns. It can be used in any framework or vanilla JavaScript.

```typescript
import { ResizableZoneController } from './ResizableZone';

const controller = new ResizableZoneController({
  direction: 'vertical',
  minSize: 100,
  maxSize: 600,
  defaultSize: 200,
  handlePosition: 'end',
  storageKey: 'my-zone-size',
  onResize: (size) => console.log('New size:', size)
});

controller.attach(element);
```

### ResizableZone Component

The Svelte component provides a declarative API:

```svelte
<ResizableZone 
  direction="vertical" 
  minSize={100} 
  maxSize={600}
  defaultSize={200}
  storageKey="my-zone"
>
  <div slot="content">
    Your resizable content here
  </div>
</ResizableZone>
```

## Usage Examples

### Basic Vertical Resize

```svelte
<ResizableZone direction="vertical" minSize={100} maxSize={600}>
  <div slot="content">
    <p>This area can be resized vertically</p>
  </div>
</ResizableZone>
```

### Basic Horizontal Resize

```svelte
<ResizableZone direction="horizontal" minSize={200} maxSize={800}>
  <div slot="content">
    <p>This area can be resized horizontally</p>
  </div>
</ResizableZone>
```

### Nested Resizable Zones

```svelte
<ResizableZone direction="vertical" minSize={200} maxSize={800}>
  <div slot="content">
    <ResizableZone direction="horizontal" minSize={150} maxSize={600}>
      <div slot="content">
        <p>Nested resizable zone!</p>
      </div>
    </ResizableZone>
  </div>
</ResizableZone>
```

### With Storage Persistence

```svelte
<ResizableZone 
  direction="vertical" 
  storageKey="ui_my-panel-height"
  defaultSize={300}
>
  <div slot="content">
    <p>Size will be saved and restored automatically</p>
  </div>
</ResizableZone>
```

**CRITICAL**: When using `storageKey` for resizable zones:
- Use the `ui_` prefix (e.g., `ui_my-panel-height`) to enable automatic OBS sync
- The component automatically uses the storage system (IndexedDB + localStorage)
- Sizes are automatically synced to OBS client when changed
- This ensures resizable zone sizes persist across sessions and sync to remote clients

### Programmatic Control

```svelte
<script>
  import { ResizableZoneController } from './primitives/ResizableZone';
  
  let controller;
  let element;
  
  function resetSize() {
    controller?.setSize(200);
  }
</script>

<div bind:this={element}>
  <button on:click={resetSize}>Reset Size</button>
</div>
```

## API Reference

### ResizableZoneController

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `direction` | `'vertical' \| 'horizontal'` | Required | Resize direction |
| `minSize` | `number` | `50` | Minimum size in pixels |
| `maxSize` | `number` | `Infinity` | Maximum size in pixels |
| `defaultSize` | `number` | `200` | Default size in pixels |
| `handlePosition` | `'start' \| 'end'` | `'end'` | Where the resize handle appears |
| `storageKey` | `string` | `undefined` | localStorage key for persistence |
| `onResize` | `(size: number) => void` | `undefined` | Callback when size changes |
| `disabled` | `boolean` | `false` | Disable resizing |

#### Methods

- `attach(element: HTMLElement)` - Attach to DOM element
- `detach()` - Detach from DOM element
- `getSize()` - Get current size
- `setSize(size: number, save?: boolean)` - Set size programmatically
- `startResize(event: MouseEvent \| TouchEvent)` - Start resize operation
- `updateConfig(updates: Partial<ResizableZoneConfig>)` - Update configuration
- `isResizing()` - Check if currently resizing
- `destroy()` - Clean up and destroy

### ResizableZone Component Props

All controller options are available as props, plus:

- `class?: string` - Additional CSS classes

## Implementation Details

### Performance

- Uses `requestAnimationFrame` for smooth 60fps updates
- Debounces resize operations to prevent excessive updates
- Disables transitions during active resize for immediate feedback

### Accessibility

- Resize handle has proper ARIA attributes
- Keyboard support (tab to focus, arrow keys to resize)
- Screen reader friendly labels

### Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Touch event support for mobile devices

## Migration from Legacy Code

If you have existing resize code, you can migrate to ResizableZone:

**Before:**
```typescript
let isResizing = false;
let startY = 0;
let startHeight = 0;

function handleResizeStart(e: MouseEvent) {
  isResizing = true;
  startY = e.clientY;
  startHeight = element.offsetHeight;
  // ... more code
}
```

**After:**
```svelte
<ResizableZone 
  direction="vertical" 
  storageKey="my-zone"
>
  <div slot="content">
    <!-- Your content -->
  </div>
</ResizableZone>
```

## Best Practices

1. **Always provide min/max sizes** to prevent UI breaking
2. **Use storage keys** for user preferences
3. **Nest carefully** - Deep nesting can impact performance
4. **Test on mobile** - Touch events work differently than mouse
5. **Clean up** - Components handle cleanup automatically, but controllers need manual cleanup

## License

Part of the Strixun Stream Suite project.

