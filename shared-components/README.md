# Shared Components - Component Library

Shared component library with Storybook documentation for reusable UI components.

## Overview

This directory contains shared UI components that can be used across multiple applications in the monorepo. Components are documented with Storybook for easy discovery and usage.

## Features

- ✓ **Storybook** - Interactive component documentation
- ✓ **Reusable Components** - Shared across applications
- ✓ **TypeScript** - Fully typed components
- ✓ **Svelte** - Native Svelte components

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

```svelte
<script>
  import SomeComponent from '@shared-components/SomeComponent.svelte';
</script>
```

## License

Private - Part of Strixun Stream Suite
