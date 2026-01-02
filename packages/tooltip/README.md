# Tooltip - Tooltip Component Library

Reusable tooltip component library with Storybook documentation.

## Overview

A flexible tooltip component that can be used across different contexts with customizable positioning and styling.

## Features

- ✓ **Svelte Component** - Native Svelte component
- ✓ **Storybook** - Component documentation and examples
- ✓ **Customizable** - Flexible positioning and styling
- ✓ **TypeScript** - Fully typed

## Usage

```svelte
<script>
  import Tooltip from '@strixun/tooltip/Tooltip.svelte';
</script>

<Tooltip text="Tooltip content">
  <button>Hover me</button>
</Tooltip>
```

## Installation

This package is part of the pnpm workspace and is automatically available to all packages.

## Development

```bash
cd packages/tooltip
pnpm install
pnpm storybook  # View Storybook documentation
```

## License

Private - Part of Strixun Stream Suite
