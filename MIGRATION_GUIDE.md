# Migration Guide: Svelte + TypeScript + Sass + Vite

**Ahoy there, ye brave developer!** [EMOJI]‍[EMOJI][EMOJI][EMOJI] This here be the migration guide for transformin' yer codebase from vanilla JavaScript to a modern stack with Svelte, TypeScript, Sass, and Vite.

## [CLIPBOARD] Overview

We're migratin' from:
- [ERROR] Vanilla JavaScript in HTML files
- [ERROR] Inline CSS and monolithic CSS files
- [ERROR] Manual module loading

To:
- [SUCCESS] **Svelte** - Lightweight, reactive UI framework
- [SUCCESS] **TypeScript** - Type-safe JavaScript
- [SUCCESS] **Sass** - Powerful CSS preprocessor
- [SUCCESS] **Vite** - Blazing fast build tool

## [EMOJI][EMOJI] Project Structure

```
├── src/
│   ├── components/          # Reusable Svelte components
│   │   ├── Header.svelte
│   │   ├── Navigation.svelte
│   │   └── ActivityLog.svelte
│   ├── pages/              # Page components
│   │   ├── Dashboard.svelte
│   │   ├── Sources.svelte
│   │   ├── TextCycler.svelte
│   │   └── ...
│   ├── stores/             # Svelte stores (state management)
│   │   ├── navigation.ts
│   │   └── connection.ts
│   ├── modules/            # Business logic modules
│   │   └── bootstrap.ts
│   ├── styles/             # SCSS files
│   │   ├── _variables.scss
│   │   ├── _mixins.scss
│   │   ├── _base.scss
│   │   ├── main.scss
│   │   └── components/
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts
│   ├── App.svelte          # Root component
│   └── main.ts             # Entry point
├── assets/js/              # Legacy JS (being migrated)
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
├── svelte.config.js        # Svelte configuration
└── package.json            # Dependencies
```

## [DEPLOY] Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

This will install:
- `svelte` - The UI framework
- `typescript` - Type safety
- `sass` - CSS preprocessor
- `vite` - Build tool
- `@sveltejs/vite-plugin-svelte` - Vite plugin for Svelte

### 2. Development Server

```bash
pnpm dev
```

This starts the Vite dev server on `http://localhost:5173` with hot module replacement (HMR).

### 3. Build for Production

```bash
pnpm build
```

This creates an optimized build in the `dist/` directory.

## [NOTE] Migration Steps

### Phase 1: Setup [SUCCESS] (COMPLETE)

- [x] Create configuration files
- [x] Set up project structure
- [x] Create SCSS architecture
- [x] Create TypeScript types
- [x] Create basic Svelte components
- [x] Set up Svelte stores

### Phase 2: Component Migration (IN PROGRESS)

**Priority Order:**

1. **Storage Module** (`assets/js/storage.js` [EMOJI] `src/modules/storage.ts`)
   - Core dependency for everything
   - Convert to TypeScript
   - Create proper interfaces

2. **WebSocket Module** (`assets/js/websocket.js` [EMOJI] `src/modules/websocket.ts`)
   - Connection management
   - Update stores when connection changes
   - Type-safe message handling

3. **Text Cycler** (`assets/js/text-cycler.js` [EMOJI] `src/modules/text-cycler.ts`)
   - Already partially modular
   - Convert to TypeScript
   - Create Svelte component wrapper

4. **Source Swaps** (`assets/js/source-swaps.js` [EMOJI] `src/modules/source-swaps.ts`)
   - Convert to TypeScript
   - Create Svelte component

5. **Layouts** (`assets/js/modules/layouts.js` [EMOJI] `src/modules/layouts.ts`)
   - Convert to TypeScript
   - Create Svelte component

6. **UI Utils** (`assets/js/ui-utils.js` [EMOJI] `src/utils/ui.ts`)
   - Convert to TypeScript
   - Make utilities available to components

### Phase 3: Page Implementation

Each page needs to be fully implemented:

- [ ] **Dashboard** - System status, quick actions
- [ ] **Sources** - Source management UI
- [ ] **Text Cycler** - Text cycler configuration
- [ ] **Swaps** - Source swap management
- [ ] **Layouts** - Layout preset management
- [ ] **Scripts** - Script manager UI
- [ ] **Install** - Installer UI
- [ ] **Setup** - Connection setup UI

### Phase 4: Integration

- [ ] Remove legacy HTML files
- [ ] Update build output paths
- [ ] Test all functionality
- [ ] Update documentation

## [CONFIG] Key Concepts

### Svelte Stores

Stores are reactive state containers. We use them for:

- **Navigation** - Current page state
- **Connection** - OBS WebSocket connection state
- **Sources** - Available sources list
- **UI State** - UI preferences and settings

Example:
```typescript
// stores/connection.ts
import { writable } from 'svelte/store';

export const connected = writable(false);
export const currentScene = writable('');
```

Usage in components:
```svelte
<script lang="ts">
  import { connected } from '../stores/connection';
</script>

{#if $connected}
  <p>Connected to OBS</p>
{/if}
```

### TypeScript Types

All types are defined in `src/types/index.ts`. This ensures type safety across modules.

Example:
```typescript
export interface SwapConfig {
  name: string;
  sourceA: string;
  sourceB: string;
  style?: string;
  duration?: number;
}
```

### SCSS Architecture

- `_variables.scss` - Color palette and design tokens
- `_mixins.scss` - Reusable style patterns
- `_base.scss` - Reset and base element styles
- `main.scss` - Main stylesheet entry point
- `components/` - Component-specific styles

### Component Pattern

Each component follows this structure:

```svelte
<script lang="ts">
  // Imports
  // Props
  // State
  // Functions
</script>

<!-- HTML Template -->

<style lang="scss">
  // Component styles
</style>
```

## [BUG] Common Issues

### Module Not Found

If you see "Module not found" errors:
1. Check that the file exists in the correct location
2. Verify import paths (use `@/` aliases)
3. Ensure TypeScript types are defined

### Store Not Reactive

If stores aren't updating:
1. Use `$` prefix to subscribe: `$storeName`
2. Ensure you're importing from the correct store file
3. Check that store updates are using `.set()` or `.update()`

### Styles Not Loading

If styles aren't applying:
1. Check that SCSS files are imported in `main.scss`
2. Verify `@use` statements in SCSS files
3. Ensure Vite is processing SCSS correctly

## [DOCS] Resources

- [Svelte Documentation](https://svelte.dev/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Sass Documentation](https://sass-lang.com/documentation)
- [Vite Guide](https://vitejs.dev/guide/)

## [TARGET] Next Steps

1. **Migrate Storage Module** - Start with the core dependency
2. **Migrate WebSocket Module** - Get connection working
3. **Implement Dashboard** - Full dashboard functionality
4. **Migrate Remaining Modules** - One by one, test as you go

## [WARNING] Important Notes

- **Legacy Code**: Old JavaScript files remain in `assets/js/` during migration
- **Global Variables**: Some globals are still used for compatibility (`window.SourceSwaps`, etc.)
- **Gradual Migration**: We're migrating incrementally, not all at once
- **Testing**: Test each migrated component thoroughly before moving on

---

**Fair winds and smooth sailin'!** [EMOJI] May yer code be bug-free and yer builds be fast! [EMOJI]‍[EMOJI][EMOJI][FEATURE]

