# @strixun/asciimoji

Framework-agnostic ASCIImoji DOM text transformer that automatically converts ASCIImoji patterns (like `(bear)` or `(shrug)`) into their corresponding ASCII art emoticons in the DOM.

## Features

- **Framework-agnostic**: Works with any framework or vanilla JavaScript
- **CDN-ready**: Can be loaded from CDN or injected into your codebase
- **Auto-transformation**: Automatically transforms text nodes in the DOM
- **MutationObserver**: Watches for new content and transforms it automatically
- **Configurable**: Highly configurable with many options
- **Lightweight**: Small bundle size with no dependencies
- **TypeScript**: Fully typed with TypeScript definitions

## Installation

### As a Package (Same Codebase)

```bash
# In your package.json, add:
{
  "dependencies": {
    "@strixun/asciimoji": "workspace:*"
  }
}
```

### From CDN

**GitHub Pages:**
```html
<script src="https://{username}.github.io/{repo}/packages/asciimoji/dist/js/index.min.js"></script>
```

**jsDelivr:**
```html
<script src="https://cdn.jsdelivr.net/gh/{owner}/{repo}@main/packages/asciimoji/dist/js/index.min.js"></script>
```

> **Note:** Replace `{username}`, `{repo}`, `{owner}` with your actual repository values.

See [CDN_DEPLOYMENT.md](./CDN_DEPLOYMENT.md) for deployment details and [CDN_USAGE.md](./CDN_USAGE.md) for usage examples.

## Quick Start

### Basic Usage

```typescript
import { AsciimojiTransformer } from '@strixun/asciimoji';

// Initialize transformer
const transformer = new AsciimojiTransformer({
  selector: 'body', // Transform all text in body
  observe: true,    // Watch for new content
  transformOnInit: true // Transform existing content
});
```

### CDN Usage

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.example.com/asciimoji.min.js"></script>
</head>
<body>
  <p>Hello (bear)! How are you? (shrug)</p>
  
  <script>
    // Auto-initialize with data attribute
    AsciimojiTransformer.init({
      selector: 'body',
      observe: true
    });
  </script>
</body>
</html>
```

### Auto-initialize with HTML Attribute

```html
<body data-asciimoji-auto>
  <p>Hello (bear)! How are you? (shrug)</p>
</body>
```

## Usage Examples

### Transform Specific Elements

```typescript
import { AsciimojiTransformer } from '@strixun/asciimoji';

// Only transform content in .content elements
const transformer = new AsciimojiTransformer({
  selector: '.content',
  observe: true
});
```

### Transform Text Only (No DOM Observation)

```typescript
import { transformText } from '@strixun/asciimoji';

const text = 'Hello (bear)! How are you? (shrug)';
const transformed = transformText(text);
console.log(transformed);
// Output: Hello ʕ·͡ᴥ·ʔ! How are you? ¯\_(ツ)_/¯
```

### Custom Configuration

```typescript
import { AsciimojiTransformer } from '@strixun/asciimoji';

const transformer = new AsciimojiTransformer({
  selector: 'article',
  observe: true,
  transformOnInit: true,
  excludeSelectors: ['script', 'style', 'code', 'pre'],
  transformAttributes: true, // Also transform title, alt, etc.
  onTransform: (element, original, transformed) => {
    console.log('Transformed:', original, '->', transformed);
  }
});
```

### Exclude Certain Elements

```typescript
const transformer = new AsciimojiTransformer({
  selector: 'body',
  excludeSelectors: ['script', 'style', 'code', 'pre', '.no-asciimoji']
});
```

## API Reference

### `AsciimojiTransformer`

Main class for transforming DOM text.

#### Constructor Options

```typescript
interface AsciimojiConfig {
  // CSS selector for elements to transform (default: 'body')
  selector?: string;
  
  // Whether to observe DOM changes (default: true)
  observe?: boolean;
  
  // Whether to transform existing content on init (default: true)
  transformOnInit?: boolean;
  
  // Custom pattern regex (default: /\(([a-zA-Z0-9_-]+)\)/g)
  patternRegex?: RegExp;
  
  // Elements to exclude (default: ['script', 'style', 'noscript'])
  excludeSelectors?: string[];
  
  // Transform attributes like title, alt, placeholder (default: false)
  transformAttributes?: boolean;
  
  // Callback after transformation
  onTransform?: (element: Node, originalText: string, transformedText: string) => void;
}
```

#### Methods

- `transform()`: Manually trigger transformation of all matching elements
- `stopObserving()`: Stop watching for DOM changes
- `destroy()`: Clean up and stop observing
- `static init(config?)`: Static initialization method for CDN usage

### `transformText(text: string): string`

Transform a text string without DOM manipulation.

```typescript
import { transformText } from '@strixun/asciimoji';

const result = transformText('Hello (bear)!');
// Returns: 'Hello ʕ·͡ᴥ·ʔ!'
```

### Pattern Functions

```typescript
import { getAsciimoji, hasAsciimoji, getAllPatterns } from '@strixun/asciimoji/patterns';

// Get ASCII art for a pattern
const bear = getAsciimoji('bear'); // Returns: 'ʕ·͡ᴥ·ʔ'

// Check if pattern exists
if (hasAsciimoji('shrug')) {
  // Pattern exists
}

// Get all available patterns
const patterns = getAllPatterns(); // Returns: ['bear', 'shrug', ...]
```

## Available Patterns

The library includes a comprehensive set of ASCIImoji patterns. Common examples:

- `(bear)` → `ʕ·͡ᴥ·ʔ`
- `(shrug)` → `¯\_(ツ)_/¯`
- `(tableflip)` → `(╯°□°）╯︵ ┻━┻`
- `(unflip)` → `┬─┬ ノ( ゜-゜ノ)`
- `(happy)` → `ヽ(◕◡◕)ﾉ`
- `(sad)` → `(╥_╥)`
- `(cool)` → `(⌐■_■)`
- `(lenny)` → `( ͡° ͜ʖ ͡°)`

See `patterns.ts` for the complete list of available patterns.

## Browser Support

- Modern browsers with ES2020 support
- MutationObserver support (for automatic DOM watching)
- TreeWalker API support

## Performance

The transformer is optimized for performance:

- Uses `TreeWalker` for efficient DOM traversal
- Debounces transformations to prevent excessive processing
- Only processes text nodes, skipping excluded elements
- Minimal memory footprint

## License

Private package for Strixun Stream Suite.
