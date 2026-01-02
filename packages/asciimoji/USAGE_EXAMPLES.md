# ASCIImoji Usage Examples

## Basic Examples

### Example 1: Simple Text Transformation

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

**Result:**
- `(bear)` → `ʕ·͡ᴥ·ʔ`
- `(happy)` → `ヽ(◕◡◕)ﾉ`
- `(shrug)` → `¯\_(ツ)_/¯`

### Example 2: React Component

```tsx
import { useEffect } from 'react';
import { AsciimojiTransformer } from '@strixun/asciimoji';

function MyComponent() {
  useEffect(() => {
    const transformer = new AsciimojiTransformer({
      selector: '#my-content',
      observe: true
    });
    
    return () => transformer.destroy();
  }, []);
  
  return (
    <div id="my-content">
      <p>Hello (bear)! How are you? (shrug)</p>
    </div>
  );
}
```

### Example 3: Svelte Component

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { AsciimojiTransformer } from '@strixun/asciimoji';
  
  let transformer;
  
  onMount(() => {
    transformer = new AsciimojiTransformer({
      selector: '.content',
      observe: true
    });
  });
  
  onDestroy(() => {
    transformer?.destroy();
  });
</script>

<div class="content">
  <p>Hello (bear)!</p>
</div>
```

### Example 4: Vue Component

```vue
<template>
  <div ref="contentRef">
    <p>Hello (bear)!</p>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { AsciimojiTransformer } from '@strixun/asciimoji';

const contentRef = ref(null);
let transformer = null;

onMounted(() => {
  transformer = new AsciimojiTransformer({
    selector: ref => contentRef.value,
    observe: true
  });
});

onUnmounted(() => {
  transformer?.destroy();
});
</script>
```

### Example 5: Vanilla JavaScript with Dynamic Content

```javascript
import { AsciimojiTransformer } from '@strixun/asciimoji';

// Initialize transformer
const transformer = new AsciimojiTransformer({
  selector: '#chat-messages',
  observe: true,
  transformOnInit: true
});

// Add new message dynamically
function addMessage(text) {
  const container = document.getElementById('chat-messages');
  const message = document.createElement('div');
  message.className = 'message';
  message.textContent = text;
  container.appendChild(message);
  // Automatically transformed by MutationObserver!
}

// Usage
addMessage('Hello (bear)! How are you? (shrug)');
```

### Example 6: Transform Text Only (No DOM)

```typescript
import { transformText } from '@strixun/asciimoji';

// Transform text strings
const greeting = transformText('Hello (bear)!');
console.log(greeting); // "Hello ʕ·͡ᴥ·ʔ!"

// Use in template literals
const message = `Welcome ${transformText('(bear)')}!`;
```

### Example 7: Exclude Code Blocks

```html
<body>
  <article>
    <p>This will be transformed: (bear)</p>
    <pre>
      // This won't: (bear)
      const code = '(bear)';
    </pre>
    <code>const x = "(bear)";</code>
  </article>
  
  <script>
    AsciimojiTransformer.init({
      excludeSelectors: ['script', 'style', 'code', 'pre']
    });
  </script>
</body>
```

### Example 8: Transform Attributes

```html
<body>
  <img 
    src="bear.jpg" 
    alt="A (bear) in the wild"
    title="Look at this (bear)!"
    data-tooltip="This is a (bear)">
  
  <script>
    AsciimojiTransformer.init({
      transformAttributes: true
    });
  </script>
</body>
```

### Example 9: Custom Callback

```typescript
import { AsciimojiTransformer } from '@strixun/asciimoji';

const transformer = new AsciimojiTransformer({
  selector: 'body',
  onTransform: (element, original, transformed) => {
    console.log('Transformed:', {
      element,
      original,
      transformed,
      patterns: (original.match(/\([^)]+\)/g) || []).length
    });
    
    // Track analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', 'asciimoji_transform', {
        pattern_count: (original.match(/\([^)]+\)/g) || []).length
      });
    }
  }
});
```

### Example 10: Custom Pattern Regex

```typescript
import { AsciimojiTransformer } from '@strixun/asciimoji';

// Use brackets instead of parentheses
const transformer = new AsciimojiTransformer({
  selector: 'body',
  patternRegex: /\[([a-zA-Z0-9_-]+)\]/g
});

// Now [bear] will work instead of (bear)
```

### Example 11: Multiple Transformers

```typescript
import { AsciimojiTransformer } from '@strixun/asciimoji';

// Transform different sections independently
const articleTransformer = new AsciimojiTransformer({
  selector: 'article',
  observe: true
});

const commentsTransformer = new AsciimojiTransformer({
  selector: '.comments',
  observe: true
});

// Later, destroy specific transformers
function cleanup() {
  articleTransformer.destroy();
  commentsTransformer.destroy();
}
```

### Example 12: Server-Side Rendering (SSR)

```typescript
import { transformText } from '@strixun/asciimoji';

// Transform text on server
function renderPost(content: string) {
  const transformed = transformText(content);
  return `<article>${transformed}</article>`;
}

// Then hydrate on client if needed
if (typeof window !== 'undefined') {
  const transformer = new AsciimojiTransformer({
    selector: 'article',
    observe: true,
    transformOnInit: false // Already transformed on server
  });
}
```

## Common Patterns Reference

| Pattern | Result |
|---------|--------|
| `(bear)` | `ʕ·͡ᴥ·ʔ` |
| `(shrug)` | `¯\_(ツ)_/¯` |
| `(tableflip)` | `(╯°□°）╯︵ ┻━┻` |
| `(unflip)` | `┬─┬ ノ( ゜-゜ノ)` |
| `(happy)` | `ヽ(◕◡◕)ﾉ` |
| `(sad)` | `(╥_╥)` |
| `(cool)` | `(⌐■_■)` |
| `(lenny)` | `( ͡° ͜ʖ ͡°)` |
| `(love)` | `(♥_♥)` |
| `(kiss)` | `(づ￣ ³￣)づ` |
| `(hug)` | `(づ｡◕‿‿◕｡)づ` |
| `(wave)` | `( ﾟ◡ﾟ)/` |
| `(excited)` | `(ﾉ◕ヮ◕)ﾉ*:・ﾟ✧` |
| `(dance)` | `ヾ(-_- )ゞ` |
| `(magic)` | `╰(•̀ 3 •́)━☆ﾟ.` |

## Tips & Best Practices

1. **Performance**: Use specific selectors instead of `'body'` for better performance
2. **Exclusions**: Always exclude code blocks, scripts, and styles
3. **Observation**: Disable `observe` if you don't need dynamic transformation
4. **Cleanup**: Always call `destroy()` when unmounting components
5. **Attributes**: Only enable `transformAttributes` if you need it (adds overhead)
