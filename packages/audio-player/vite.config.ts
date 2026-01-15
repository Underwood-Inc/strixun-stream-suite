import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    svelte(),
    react(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'core.ts'),
      name: 'AudioPlayer',
      fileName: 'audio-player',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'svelte'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
