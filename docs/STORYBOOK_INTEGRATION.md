# Storybook Integration Guide

This document explains how Storybook is integrated into the main application, allowing users to view component documentation directly within the OBS dock.

## Overview

The Storybook integration provides:
- **Inline Documentation Access**: Small 📚 buttons on components that open Storybook
- **Dock-Friendly Viewing**: Storybook opens in an iframe overlay (stays in OBS dock)
- **Optional New Tab**: Users can choose to open Storybook in a new tab if needed
- **Automatic URL Construction**: Storybook URL is automatically configured from GitHub Pages

## Architecture

### Components

1. **`StorybookViewer.svelte`**
   - Full-screen iframe overlay that displays Storybook
   - Default: Opens in iframe (stays in dock)
   - Option: "Open in Tab" button for new tab
   - Portal rendering at body level
   - Keyboard support (Esc to close)

2. **`ComponentDocsButton.svelte`**
   - Small 📚 icon button that can be added to any component
   - Configurable position (top-right, top-left, etc.)
   - Configurable size (small, medium)
   - Opens StorybookViewer on click

### Configuration

Storybook URL is automatically constructed from:
1. `STRIXUN_CONFIG.STORYBOOK_URL` (if set in config.js)
2. `STRIXUN_CONFIG.GITHUB_PAGES_URL` + `/storybook/` (fallback)
3. Current location + `/storybook/` (development fallback)

The URL is injected during deployment via GitHub Actions.

## Usage

### Adding Docs Button to a Component

```svelte
<script lang="ts">
  import ComponentDocsButton from './ComponentDocsButton.svelte';
</script>

<div class="your-component-wrapper" style="position: relative;">
  <ComponentDocsButton componentName="YourComponentName" position="top-right" size="small" />
  <!-- Your component content -->
</div>
```

### Component Name Mapping

The component name should match the Storybook story title:
- Component: `SearchBox` ❓ Storybook: `Components/SearchBox` ❓ URL: `/story/components-searchbox--default`

### Opening Storybook Programmatically

```svelte
<script lang="ts">
  import StorybookViewer from './StorybookViewer.svelte';
  
  let showStorybook = false;
</script>

<button on:click={() => showStorybook = true}>View Docs</button>

<StorybookViewer 
  componentName="SearchBox"
  open={showStorybook}
  onClose={() => showStorybook = false}
/>
```

## Deployment

### GitHub Pages Setup

Storybook is deployed to a `/storybook/` subdirectory alongside the main app:

- Main App: `https://username.github.io/repo-name/`
- Storybook: `https://username.github.io/repo-name/storybook/`

### Workflow Files

1. **`.github/workflows/deploy-storybook.yml`**
   - Builds Storybook with base path configuration
   - Deploys to `/storybook/` subdirectory
   - Merges with existing pages (doesn't overwrite main app)

2. **`.github/workflows/deploy-pages.yml`**
   - Injects `STORYBOOK_URL` into `config.js`
   - Constructs URL from `GITHUB_PAGES_URL`

### Storybook Configuration

The `.storybook/main.ts` file is configured to:
- Set base path from `STORYBOOK_BASE_PATH` environment variable
- Use path aliases matching the main app
- Support all component stories in `src/lib/**/*.stories.*`

## Components with Docs Buttons

The following components have docs buttons enabled:
- ✅ SearchBox
- ✅ ProgressRing
- ✅ SimpleTextEditor
- ✅ LoadingSkeleton
- ✅ TruncatedText
- ✅ SourceSelect

## Customization

### Changing Button Position

```svelte
<ComponentDocsButton 
  componentName="YourComponent" 
  position="top-left"  <!-- top-right | top-left | bottom-right | bottom-left -->
  size="medium"        <!-- small | medium -->
/>
```

### Custom Storybook URL

If you need to override the Storybook URL, set it in `config.js`:

```javascript
window.STRIXUN_CONFIG.STORYBOOK_URL = 'https://your-custom-storybook-url.com/';
```

## Troubleshooting

### Storybook Not Loading

1. Check that Storybook is deployed: Visit `https://your-pages-url/storybook/`
2. Verify `STORYBOOK_URL` in config.js is set correctly
3. Check browser console for iframe errors (CORS, etc.)

### Wrong Component Story

1. Verify component name matches Storybook story title
2. Check Storybook URL format: `/story/components-{componentname}--default`
3. Component names are case-insensitive in URL construction

### Button Not Showing

1. Ensure parent element has `position: relative`
2. Check that ComponentDocsButton is imported
3. Verify component name prop is correct

## Future Enhancements

Potential improvements:
- [ ] Hover preview of component docs
- [ ] Search functionality within Storybook viewer
- [ ] Component prop documentation inline
- [ ] Usage examples in tooltip
- [ ] Keyboard shortcuts for navigation






















