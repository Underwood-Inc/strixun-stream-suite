import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte()],
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
      '@shared-components': path.resolve(__dirname, '../../../shared-components'),
      '@shared-config': path.resolve(__dirname, '../../../shared-config')
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
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  optimizeDeps: {
    include: ['@observablehq/plot']
  },
  server: {
    port: 5174,
    open: false,
    proxy: {
      '/auth': {
        target: 'http://localhost:8787',
        changeOrigin: true
      },
      '/admin': {
        target: 'http://localhost:8787',
        changeOrigin: true
      },
      '/openapi.json': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
});

