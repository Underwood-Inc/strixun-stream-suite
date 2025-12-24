import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '$lib': path.resolve(__dirname, './src/lib'),
      '$components': path.resolve(__dirname, './src/components')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    base: '/',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      }
    },
    commonjsOptions: {
      include: [/swagger-ui-dist/, /node_modules/]
    }
  },
  optimizeDeps: {
    include: ['mermaid', 'prismjs'],
    exclude: ['swagger-ui-dist'] // Exclude from pre-bundling, will be loaded dynamically
  },
  server: {
    port: 5175,
    open: false
  }
});

