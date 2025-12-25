import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  // Enable TypeScript in Svelte files
  preprocess: vitePreprocess(),
  
  // Disable warnings for now during migration
  onwarn: (warning, handler) => {
    // Ignore a11y warnings during migration
    if (warning.code?.startsWith('a11y-')) return;
    // Suppress CSS unused selector warnings (classes may be used dynamically or in imported SCSS)
    if (warning.code === 'css-unused-selector') return;
    handler(warning);
  }
};

