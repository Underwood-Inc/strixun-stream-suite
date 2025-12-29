import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    css: 'injected',
    // Explicitly set DOM generation mode to avoid issues with empty blocks
    generate: 'dom',
    hydratable: false,
    // Disable dev mode warnings that might cause issues in CI
    dev: false,
  },
  onwarn: (warning, handler) => {
    // Ignore a11y warnings
    if (warning.code?.startsWith('a11y-')) return;
    // Suppress CSS unused selector warnings
    if (warning.code === 'css-unused-selector') return;
    handler(warning);
  }
};
