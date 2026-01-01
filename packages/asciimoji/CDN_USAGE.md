# ASCIImoji - CDN Usage Guide

This library can be used directly from a CDN without any build step. Simply include the script tag and start using it.

## Quick Start

### 1. Include the Library

**GitHub Pages CDN:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ASCIImoji Example</title>
  <!-- Replace {username} and {repo} with your actual repository values -->
  <script src="https://{username}.github.io/{repo}/packages/asciimoji/dist/js/index.min.js"></script>
</head>
```

**jsDelivr CDN (Alternative):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ASCIImoji Example</title>
  <!-- Replace {owner} and {repo} with your actual repository values -->
  <script src="https://cdn.jsdelivr.net/gh/{owner}/{repo}@main/packages/asciimoji/dist/js/index.min.js"></script>
</head>
```
<body>
  <p>Hello (bear)! How are you? (shrug)</p>
  <p>I'm feeling (happy) today!</p>
  
  <script>
    // Initialize the transformer
    AsciimojiTransformer.init({
      selector: 'body',
      observe: true,
      transformOnInit: true
    });
  </script>
</body>
</html>
```

### 2. Auto-initialize with HTML Attribute

You can also auto-initialize by adding a data attribute:

```html
<body data-asciimoji-auto>
  <p>Hello (bear)! How are you? (shrug)</p>
</body>
```

With custom options:

```html
<body 
  data-asciimoji-auto
  data-asciimoji-selector=".content"
  data-asciimoji-observe="true"
  data-asciimoji-transform-on-init="true">
  <div class="content">
    <p>Hello (bear)!</p>
  </div>
</body>
```

## API Reference

### `AsciimojiTransformer.init(options)`

Initialize the ASCIImoji transformer.

#### Parameters

- `selector` (string, optional) - CSS selector for elements to transform (default: `'body'`)
- `observe` (boolean, optional) - Watch for new content (default: `true`)
- `transformOnInit` (boolean, optional) - Transform existing content on init (default: `true`)
- `excludeSelectors` (array, optional) - Elements to exclude (default: `['script', 'style', 'noscript']`)
- `transformAttributes` (boolean, optional) - Transform attributes like title, alt (default: `false`)
- `onTransform` (function, optional) - Callback after transformation

#### Returns

Returns the transformer instance.

### `transformAsciimojiText(text)`

Transform a text string without DOM manipulation.

```javascript
const text = 'Hello (bear)!';
const transformed = transformAsciimojiText(text);
console.log(transformed); // "Hello ʕ·͡ᴥ·ʔ!"
```

## Examples

### Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.example.com/asciimoji.min.js"></script>
</head>
<body>
  <h1>Welcome (bear)!</h1>
  <p>I'm feeling (happy) today! (shrug)</p>
  
  <script>
    AsciimojiTransformer.init();
  </script>
</body>
</html>
```

### Transform Specific Elements

```html
<body>
  <div class="content">
    <p>This will be transformed: (bear)</p>
  </div>
  <div class="sidebar">
    <p>This won't: (bear)</p>
  </div>
  
  <script>
    AsciimojiTransformer.init({
      selector: '.content'
    });
  </script>
</body>
```

### Exclude Code Blocks

```html
<body>
  <p>This will be transformed: (bear)</p>
  <pre>
    // This won't: (bear)
    const code = '(bear)';
  </pre>
  
  <script>
    AsciimojiTransformer.init({
      excludeSelectors: ['script', 'style', 'code', 'pre']
    });
  </script>
</body>
```

### Transform Attributes

```html
<body>
  <img 
    src="image.jpg" 
    alt="A (bear) in the wild"
    title="Look at this (bear)!">
  
  <script>
    AsciimojiTransformer.init({
      transformAttributes: true
    });
  </script>
</body>
```

### Dynamic Content

```html
<body>
  <div id="content">
    <p>Initial content: (bear)</p>
  </div>
  
  <button onclick="addContent()">Add Content</button>
  
  <script>
    const transformer = AsciimojiTransformer.init({
      selector: '#content',
      observe: true
    });
    
    function addContent() {
      const div = document.getElementById('content');
      const p = document.createElement('p');
      p.textContent = 'New content: (shrug)';
      div.appendChild(p);
      // Automatically transformed!
    }
  </script>
</body>
```

### Manual Transformation

```html
<body>
  <div id="content">
    <p>Hello (bear)!</p>
  </div>
  
  <button onclick="transform()">Transform Now</button>
  
  <script>
    const transformer = AsciimojiTransformer.init({
      selector: '#content',
      observe: false, // Don't watch for changes
      transformOnInit: false // Don't transform on init
    });
    
    function transform() {
      transformer.transform(); // Manually trigger
    }
  </script>
</body>
```

### Cleanup

```html
<script>
  const transformer = AsciimojiTransformer.init();
  
  // Later, when you want to stop watching:
  transformer.stopObserving();
  
  // Or destroy completely:
  transformer.destroy();
</script>
```

## Available Patterns

Common patterns include:

- `(bear)` → `ʕ·͡ᴥ·ʔ`
- `(shrug)` → `¯\_(ツ)_/¯`
- `(tableflip)` → `(╯°□°）╯︵ ┻━┻`
- `(unflip)` → `┬─┬ ノ( ゜-゜ノ)`
- `(happy)` → `ヽ(◕◡◕)ﾉ`
- `(sad)` → `(╥_╥)`
- `(cool)` → `(⌐■_■)`
- `(lenny)` → `( ͡° ͜ʖ ͡°)`

And many more! See the patterns list for all available patterns.

## Browser Support

- Modern browsers with ES2020 support
- MutationObserver support (for automatic DOM watching)
- TreeWalker API support

## Versioning

The library follows semantic versioning. Include a version in your CDN URL:

```
https://cdn.example.com/asciimoji@1.0.0.min.js
```

## Troubleshooting

### Patterns Not Transforming

1. Check that the script loaded successfully
2. Verify the selector matches your elements
3. Check browser console for errors
4. Ensure patterns are in parentheses: `(bear)` not `bear`

### Performance Issues

1. Use a more specific selector instead of `'body'`
2. Exclude elements that don't need transformation
3. Disable `observe` if you don't need dynamic transformation
4. Use `transformOnInit: false` and call `transform()` manually

### Conflicts with Other Libraries

If you have conflicts, you can namespace the transformer:

```javascript
const myTransformer = AsciimojiTransformer.init({
  selector: '.my-content'
});
```

## Security Notes

1. **XSS Protection**: The transformer only replaces text patterns, but be cautious with user-generated content
2. **HTTPS Only**: Always serve the library over HTTPS in production
3. **Content Security Policy**: Ensure your CSP allows inline scripts if using auto-initialization
