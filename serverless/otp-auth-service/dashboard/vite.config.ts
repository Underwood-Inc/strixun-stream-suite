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
        // Use function-based manualChunks to handle circular dependencies properly
        // Keep all @strixun packages together to avoid initialization order issues
        manualChunks(id) {
          // CRITICAL: Put ALL @strixun packages in the main bundle (return undefined)
          // This prevents chunk loading order issues that cause circular dependency errors
          // The packages will be bundled with the app code to ensure proper initialization order
          if (id.includes('@strixun/') || id.includes('node_modules/@strixun/')) {
            // Return undefined to include in main bundle instead of separate chunk
            return undefined;
          }
          // Vendor chunks for other node_modules
          if (id.includes('node_modules')) {
            if (id.includes('svelte')) {
              return 'svelte-vendor';
            }
            if (id.includes('@observablehq')) {
              return 'observable-vendor';
            }
            // Other node_modules go into vendor chunk
            return 'vendor';
          }
        }
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

