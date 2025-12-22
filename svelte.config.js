import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  // Enable TypeScript in Svelte files
  preprocess: vitePreprocess(),
  
  // Disable warnings for now during migration
  onwarn: (warning, handler) => {
    // Ignore a11y warnings during migration
    if (warning.code.startsWith('a11y-')) return;
    handler(warning);
  }
};

