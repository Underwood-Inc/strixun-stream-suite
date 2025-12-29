import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    css: 'injected',
  },
  onwarn: (warning, handler) => {
    // Ignore a11y warnings
    if (warning.code?.startsWith('a11y-')) return;
    // Suppress CSS unused selector warnings
    if (warning.code === 'css-unused-selector') return;
    handler(warning);
  }
};
