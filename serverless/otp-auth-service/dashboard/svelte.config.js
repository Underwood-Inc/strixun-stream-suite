import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  preprocess: vitePreprocess({
    scss: {
      includePaths: [path.resolve(__dirname, '../../shared-styles')]
    }
  })
};

