# Shared Components - Component Library

Shared component library with Storybook documentation for reusable UI components.

## Overview

This directory contains shared UI components that can be used across multiple applications in the monorepo. Components are documented with Storybook for easy discovery and usage.

## Features

- ✓ **Storybook** - Interactive component documentation
- ✓ **Reusable Components** - Shared across applications
- ✓ **TypeScript** - Fully typed components
- ✓ **Svelte & React** - Identical components for both frameworks
- ✓ **Syntax Highlighting** - CodeBlock with Prism.js support
- ✓ **Multi-File Viewer** - IDE-like file browsing interface

## Development

### View Storybook

```bash
pnpm storybook
```

### Build Storybook

```bash
pnpm build-storybook
```

## Usage

Components can be imported from this directory:

### Svelte

```svelte
<script lang="ts">
  import CodeBlock from '@shared-components/svelte/CodeBlock.svelte';
  import MultiFileViewer from '@shared-components/svelte/MultiFileViewer.svelte';
  import type { FileViewerFile } from '@shared-components/svelte/MultiFileViewer.svelte';
</script>
```

### React

```typescript
import { CodeBlock, MultiFileViewer } from '@shared-components/react';
import type { FileViewerFile } from '@shared-components/react';
```

## Components

### CodeBlock

Syntax-highlighted code block with copy-to-clipboard functionality.

**Supported Languages:**
- TypeScript/JavaScript (tsx, ts, jsx, js)
- HTML/Svelte (html, svelte)
- CSS/SCSS (css, scss)
- JSON, Bash, Python, HTTP

**Example:**

```typescript
<CodeBlock 
  code="const hello = 'world';" 
  language="typescript" 
/>
```

### MultiFileViewer

IDE-like file browser with tabbed interface for displaying multiple code files.

**Features:**
- File sidebar with icons
- Syntax highlighting for all files
- File descriptions with HTML support
- Responsive mobile layout

**Example:**

```typescript
const files: FileViewerFile[] = [
  {
    name: 'App.tsx',
    path: 'src/App.tsx',
    language: 'tsx',
    content: 'export function App() { ... }',
    description: '<strong>Main Component:</strong> Entry point'
  }
];

<MultiFileViewer files={files} />
```

## License

Private - Part of Strixun Stream Suite
