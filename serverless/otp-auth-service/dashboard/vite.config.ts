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
      '@shared-config': path.resolve(__dirname, '../../../shared-config'),
      '@styles': path.resolve(__dirname, '../../../src/styles')
    },
    // Ensure proper module resolution to avoid circular dependencies
    dedupe: ['@strixun/api-framework', '@strixun/otp-login', '@strixun/tooltip', '@strixun/status-flair', '@strixun/ad-carousel']
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    base: '/dashboard/',
    cssCodeSplit: false, // Bundle all CSS into a single file to avoid missing styles
    // Prevent chunking issues that cause circular dependency errors
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      },
      // Preserve entry signatures to ensure proper initialization order
      preserveEntrySignatures: 'strict',
      output: {
        // CRITICAL: Disable ALL code splitting to prevent circular dependency initialization errors
        // This ensures all @strixun packages are in the same bundle with proper initialization order
        // Note: This will create a larger bundle but prevents "Cannot access X before initialization" errors
        inlineDynamicImports: true, // Inline all dynamic imports to prevent chunk loading order issues
      }
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  optimizeDeps: {
    // Force pre-bundling of @strixun packages to resolve circular dependencies
    include: [
      '@observablehq/plot',
      '@strixun/api-framework',
      '@strixun/api-framework/client',
      '@strixun/otp-login',
      '@strixun/tooltip',
      '@strixun/status-flair',
      '@strixun/ad-carousel'
    ],
    force: true
  },
  server: {
    port: 5174,
    open: false,
    fs: {
      allow: ['..']
    },
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

