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
      },
      output: {
        // Ensure consistent chunking for better caching
        manualChunks: undefined,
        // Use consistent naming for assets
        assetFileNames: 'assets/[name].[ext]',
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js'
      }
    },
    commonjsOptions: {
      include: [/swagger-ui-dist/, /node_modules/],
      transformMixedEsModules: true
    },
    // Use esbuild for faster builds (default)
    minify: 'esbuild',
    // Ensure source maps for debugging (can be disabled in production)
    sourcemap: false
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

