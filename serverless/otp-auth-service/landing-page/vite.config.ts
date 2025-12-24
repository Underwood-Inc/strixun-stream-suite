import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

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
    }
  },
  server: {
    port: 5175,
    open: false
  }
});

