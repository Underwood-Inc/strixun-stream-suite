import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  css: {
    preprocessorOptions: {
      scss: {
        includePaths: [
          path.resolve(__dirname, '../../shared-styles'),
          path.resolve(__dirname, '../../shared-components')
        ]
      }
    }
  },
  resolve: {
    alias: {
      '$lib': path.resolve(__dirname, './src/dashboard/lib'),
      '$components': path.resolve(__dirname, './src/dashboard/components'),
      '@shared-styles': path.resolve(__dirname, '../../shared-styles'),
      '@shared-components': path.resolve(__dirname, '../../shared-components')
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

