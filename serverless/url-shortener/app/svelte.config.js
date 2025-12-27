import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    css: 'injected',
  },
  onwarn: (warning, handler) => {
    if (warning.code?.startsWith('a11y-')) return;
    if (warning.code === 'css-unused-selector') return;
    handler(warning);
  }
};

