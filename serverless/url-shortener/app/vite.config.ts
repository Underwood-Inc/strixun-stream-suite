import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [
    svelte({
      onwarn: (warning, handler) => {
        // Suppress unused CSS selector warnings
        if (warning.code === 'css-unused-selector' || warning.code === 'css_unused_selector') {
          return;
        }
        // Suppress accessibility warnings
        if (warning.code?.startsWith('a11y-')) {
          return;
        }
        handler(warning);
      }
    })
  ],
  css: {
    preprocessorOptions: {
      scss: {
        includePaths: [path.resolve(__dirname, '../../../shared-styles')]
      }
    }
  },
  resolve: {
    alias: {
      '$lib': path.resolve(__dirname, './src/lib'),
      '$components': path.resolve(__dirname, './src/components'),
      '@shared-styles': path.resolve(__dirname, '../../../shared-styles'),
      '@shared-components': path.resolve(__dirname, '../../../shared-components')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    base: '/',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    port: 5176,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      },
      '/decrypt.js': {
        target: 'http://localhost:8787',
        changeOrigin: true
      },
      '/otp-core.js': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
});

