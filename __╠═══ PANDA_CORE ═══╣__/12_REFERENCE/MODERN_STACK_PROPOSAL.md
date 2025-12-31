# Modern Stack Proposal - 2025

## [EMOJI] Goals
1. **Lightweight UI Framework** - Component-based, reactive, small bundle
2. **TypeScript Migration** - Type safety, better tooling, maintainability
3. **CSS Pre-processor** - Variables, nesting, mixins, better organization

##  Recommended Stack (2025)

### Option 1: **Svelte**  RECOMMENDED
**Why Svelte:**
- **Zero runtime** - Compiles to vanilla JS (smallest bundle)
- **TypeScript-first** - Excellent TS support
- **Reactive by design** - No virtual DOM overhead
- **Perfect for OBS docks** - Minimal resource usage
- **Bundle size**: ~0KB runtime (compiles away)
- **Learning curve**: Gentle, similar to Vue

**Best for**: Performance-critical apps, OBS docks, small bundle requirements

### Option 2: **Preact** 
**Why Preact:**
- **3KB** - Tiny React alternative
- **React-compatible API** - Easy migration if you know React
- **TypeScript support** - Full TS support
- **Bundle size**: ~3KB gzipped
- **Learning curve**: Same as React

**Best for**: If you want React-like patterns with minimal bundle

### Option 3: **SolidJS**
**Why SolidJS:**
- **Fine-grained reactivity** - Very fast
- **TypeScript-first** - Built with TS
- **Small bundle** - ~7KB
- **Modern patterns** - Signals, stores

**Best for**: Complex reactive apps, modern patterns

## [EMOJI] Recommended Setup

### **Svelte + TypeScript + Sass + Vite**

**Why this combo:**
- **Svelte**: Compiles away, zero runtime overhead
- **TypeScript**: Type safety, better DX
- **Sass/SCSS**: Mature, powerful, widely supported
- **Vite**: Lightning-fast builds, HMR, perfect for development

## [EMOJI] Implementation Plan

### Phase 1: Project Setup

#### 1.1 Install Dependencies

```bash
# Initialize package.json
npm init -y

# Install Svelte + TypeScript + Vite
npm install -D svelte @sveltejs/vite-plugin-svelte typescript @types/node
npm install -D vite svelte-check

# Install Sass
npm install -D sass

# Install TypeScript types
npm install -D @types/dom @types/web
```

#### 1.2 Project Structure

```
project-root/
├── src/
│   ├── components/          # Svelte components
│   │   ├── Header.svelte
│   │   ├── Navigation.svelte
│   │   ├── Dashboard.svelte
│   │   ├── Sources.svelte
│   │   ├── TextCycler.svelte
│   │   └── ...
│   ├── modules/            # TypeScript modules
│   │   ├── storage.ts
│   │   ├── websocket.ts
│   │   ├── backup.ts
│   │   └── ...
│   ├── stores/             # Svelte stores (state management)
│   │   ├── connection.ts
│   │   ├── sources.ts
│   │   └── ...
│   ├── styles/
│   │   ├── main.scss       # Main stylesheet
│   │   ├── _variables.scss # CSS variables
│   │   ├── _mixins.scss    # Reusable mixins
│   │   └── components/     # Component styles
│   ├── App.svelte          # Root component
│   └── main.ts             # Entry point
├── public/
│   └── config.js           # Deployment config
├── index.html              # Entry HTML
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript config
├── svelte.config.js        # Svelte config
└── package.json
```

### Phase 2: TypeScript Configuration

#### 2.1 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["vite/client", "svelte"]
  },
  "include": ["src/**/*.ts", "src/**/*.svelte"],
  "exclude": ["node_modules"]
}
```

#### 2.2 `svelte.config.js`

```javascript
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    // Enable TypeScript in Svelte files
  }
};
```

### Phase 3: Vite Configuration

#### 3.1 `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "./src/styles/_variables.scss";`
      }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 5173,
    open: true
  }
});
```

### Phase 4: CSS Pre-processor Setup

#### 4.1 Convert CSS to SCSS

**Current**: `assets/css/control-panel.css` (1,282 lines)

**New Structure**:

```
src/styles/
├── main.scss              # Main entry
├── _variables.scss        # CSS variables, colors
├── _mixins.scss           # Reusable mixins
├── _base.scss             # Reset, base styles
├── _layout.scss           # Layout components
├── _components.scss        # Component styles
└── _utilities.scss        # Utility classes
```

#### 4.2 Example SCSS Structure

```scss
// _variables.scss
$colors: (
  bg: #1a1611,
  bg-dark: #0f0e0b,
  card: #252017,
  accent: #edae49,
  success: #28a745,
  warning: #ffc107,
  danger: #ea2b1f
);

// _mixins.scss
@mixin glass-effect($opacity: 0.95) {
  background: rgba(37, 32, 23, $opacity);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(61, 54, 39, 0.8);
}

@mixin card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
}

// main.scss
@import 'variables';
@import 'mixins';
@import 'base';
@import 'layout';
@import 'components';
@import 'utilities';
```

### Phase 5: Migration Strategy

#### 5.1 Incremental TypeScript Migration

**Step 1**: Add TypeScript, keep JS files
- Rename `.js`  `.ts` gradually
- Add type annotations incrementally
- Use `// @ts-check` for gradual typing

**Step 2**: Convert modules one by one
- Start with utility modules (storage, logger)
- Then business logic (websocket, backup)
- Finally UI modules

**Step 3**: Add strict types
- Enable `strict: true` gradually
- Add interfaces for all data structures
- Type all function parameters/returns

#### 5.2 Svelte Component Migration

**Current HTML structure**  **Svelte components**:

```svelte
<!-- Before: control_panel.html -->
<div class="card">
  <h3>Dashboard</h3>
  <div id="currentScene">...</div>
</div>

<!-- After: src/components/Dashboard.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { connectionStore } from '../stores/connection';
  
  let currentScene = $connectionStore.currentScene;
</script>

<div class="card">
  <h3>Dashboard</h3>
  <div>{currentScene || 'Not connected'}</div>
</div>

<style lang="scss">
  @import '../styles/mixins';
  
  .card {
    @include card;
  }
</style>
```

#### 5.3 State Management with Svelte Stores

```typescript
// src/stores/connection.ts
import { writable, derived } from 'svelte/store';

export const connected = writable<boolean>(false);
export const currentScene = writable<string>('');
export const sources = writable<Source[]>([]);

export const isReady = derived(
  [connected, currentScene],
  ([$connected, $scene]) => $connected && $scene !== ''
);
```

## [EMOJI] Migration Timeline

### Week 1: Setup & Foundation
- [ ] Set up Vite + Svelte + TypeScript
- [ ] Configure Sass
- [ ] Convert CSS to SCSS structure
- [ ] Set up build pipeline

### Week 2: TypeScript Migration
- [ ] Convert utility modules to TS
- [ ] Add type definitions
- [ ] Convert storage, websocket modules

### Week 3: Component Migration
- [ ] Convert HTML to Svelte components
- [ ] Set up stores for state
- [ ] Migrate page components

### Week 4: Integration & Testing
- [ ] Integrate all components
- [ ] Test in OBS dock
- [ ] Performance optimization
- [ ] Documentation

## [EMOJI] Benefits

### Bundle Size Comparison

| Framework | Runtime Size | Total Bundle (approx) |
|-----------|-------------|----------------------|
| **Svelte** | 0KB | ~15-20KB (compiled) |
| **Preact** | 3KB | ~25-30KB |
| **React** | 45KB | ~130KB+ |
| **Vue** | 34KB | ~60KB+ |

### Development Experience

1. **TypeScript**: 
   - Autocomplete, type checking
   - Catch errors at compile time
   - Better refactoring

2. **Svelte**:
   - No virtual DOM overhead
   - Reactive by default
   - Scoped styles built-in

3. **Sass**:
   - Variables, nesting, mixins
   - Better organization
   - Easier maintenance

4. **Vite**:
   - Instant HMR
   - Fast builds
   - Optimized production bundles

## [EMOJI] Build Output

**Development**:
- Fast HMR
- Source maps
- Type checking

**Production**:
- Minified bundle
- Tree-shaking
- Code splitting (if needed)
- Optimized CSS

## [EMOJI] Example: Converting a Module

### Before (JavaScript)

```javascript
// assets/js/app.js
function updateStorageStatus() {
    const idbEl = document.getElementById('idbStatus');
    const lsEl = document.getElementById('lsStatus');
    // ... 50 lines
}
```

### After (TypeScript + Svelte)

```typescript
// src/modules/backup.ts
export interface StorageStatus {
    idb: boolean;
    localStorage: boolean;
    swapCount: number;
    layoutCount: number;
    textCyclerCount: number;
}

export function updateStorageStatus(): StorageStatus {
    const idbEl = document.getElementById('idbStatus');
    const lsEl = document.getElementById('lsStatus');
    // ... typed implementation
    return {
        idb: idbReady,
        localStorage: lsWorks,
        // ...
    };
}
```

```svelte
<!-- src/components/StorageStatus.svelte -->
<script lang="ts">
  import { updateStorageStatus, type StorageStatus } from '../modules/backup';
  import { onMount } from 'svelte';
  
  let status: StorageStatus;
  
  onMount(() => {
    status = updateStorageStatus();
  });
</script>

<div class="storage-status">
  <span class:ready={status.idb}>
    {status.idb ? '[OK]' : '[ERROR]'} IndexedDB
  </span>
</div>

<style lang="scss">
  .storage-status {
    @include card;
  }
  
  .ready {
    color: var(--success);
  }
</style>
```

## [EMOJI] Quick Start Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Type checking
npm run check

# Linting
npm run lint
```

## [EMOJI] Recommendation

**Go with Svelte + TypeScript + Sass + Vite**

**Why:**
1. **Smallest bundle** - Perfect for OBS docks
2. **Zero runtime** - Svelte compiles away
3. **Type safety** - TypeScript catches errors early
4. **Better CSS** - Sass for maintainable styles
5. **Fast dev** - Vite for instant feedback
6. **Modern stack** - Industry standard 2025

This gives you a modern, maintainable codebase that's perfect for an OBS control panel!

