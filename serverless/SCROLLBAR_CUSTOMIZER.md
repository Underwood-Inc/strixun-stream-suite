# Scrollbar Customizer Module

A standalone, CDN-deliverable module that injects custom scrollbar styling into any website. This module provides scrollbar customization with content adjustment to prevent layout shift when scrollbars appear/disappear.

## Features

- 🎨 **Custom Scrollbar Styling** - Fully customizable scrollbar appearance (width, colors, border radius)
- 🔄 **Content Adjustment** - Prevents layout shift when scrollbar appears/disappears (enabled by default)
- 🌐 **Cross-Browser Support** - Works with WebKit browsers (Chrome, Safari, Edge) and Firefox
- 📦 **Zero Dependencies** - Standalone module, no external dependencies required
- 🚀 **CDN Ready** - Can be served via Cloudflare Worker or any CDN
- ⚙️ **Configurable** - Easy to customize via configuration object or API

## Default Styling

The module defaults to the Strixun theme:
- **Width**: 6px
- **Track**: Transparent
- **Thumb**: `#3d3627` (dark brown)
- **Thumb Hover**: `#888` (gray)
- **Border Radius**: 3px
- **Content Adjustment**: Enabled by default

## Usage

### Basic Usage (Auto-Initialize)

Simply include the script in your HTML:

```html
<script src="https://your-worker.workers.dev/cdn/scrollbar-customizer.js"></script>
```

The module will automatically initialize with default settings.

### Manual Usage

If you want to customize the configuration:

```html
<script src="https://your-worker.workers.dev/cdn/scrollbar-customizer.js"></script>
<script>
  // Wait for the module to load
  if (window.ScrollbarCustomizer) {
    // Destroy auto-initialized instance
    if (window.ScrollbarCustomizerInstance) {
      window.ScrollbarCustomizerInstance.destroy();
    }
    
    // Create custom instance
    const customizer = new ScrollbarCustomizer({
      width: 8,
      thumbColor: '#ff0000',
      thumbHoverColor: '#cc0000',
      trackColor: 'transparent',
      borderRadius: 5,
      contentAdjustment: true
    });
    
    customizer.init();
  }
</script>
```

### API Methods

#### `init()`
Initialize the scrollbar customizer. Called automatically if script is loaded directly.

```javascript
customizer.init();
```

#### `destroy()`
Remove all customizations and clean up.

```javascript
customizer.destroy();
```

#### `updateConfig(newConfig)`
Update the configuration dynamically.

```javascript
customizer.updateConfig({
  width: 10,
  thumbColor: '#00ff00'
});
```

#### `toggleContentAdjustment(enabled)`
Toggle content adjustment on/off. Pass `true` to enable, `false` to disable, or `null` to toggle.

```javascript
// Toggle
const isEnabled = customizer.toggleContentAdjustment();

// Enable
customizer.toggleContentAdjustment(true);

// Disable
customizer.toggleContentAdjustment(false);
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | `number` | `6` | Scrollbar width in pixels |
| `trackColor` | `string` | `'transparent'` | Scrollbar track background color |
| `thumbColor` | `string` | `'#3d3627'` | Scrollbar thumb color |
| `thumbHoverColor` | `string` | `'#888'` | Scrollbar thumb hover color |
| `borderRadius` | `number` | `3` | Scrollbar thumb border radius in pixels |
| `contentAdjustment` | `boolean` | `true` | Enable content adjustment to prevent layout shift |
| `namespace` | `string` | `'strixun-scrollbar'` | CSS namespace for generated classes |

## Content Adjustment

The content adjustment feature prevents layout shift when scrollbars appear or disappear. It works by:

1. Detecting when a scrollbar is present
2. Measuring the scrollbar width
3. Applying negative margin and padding to the body element to compensate

This ensures that:
- Content doesn't shift when scrollbar appears
- Content doesn't get covered by the scrollbar
- Smooth transitions when scrollbar state changes

The feature can be toggled on/off via the `toggleContentAdjustment()` method or disabled in the initial configuration.

## Browser Support

- ✅ Chrome/Edge (WebKit)
- ✅ Safari (WebKit)
- ✅ Firefox
- ⚠️ Internet Explorer (limited support, scrollbar-width not supported)

## Deployment

### Cloudflare Worker

The module is already integrated into the Cloudflare Worker. It's available at:

```
GET /cdn/scrollbar-customizer.js
```

### Local Development

For local testing, you can serve the file directly:

```html
<script src="./scrollbar-customizer.js"></script>
```

### Custom CDN

You can host the `scrollbar-customizer.js` file on any CDN or static hosting service.

## Example

See `scrollbar-customizer-example.html` for a complete working example with interactive controls.

## License

Part of the Strixun Stream Suite project.

