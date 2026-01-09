import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte({
    compilerOptions: {
      css: 'injected',
    },
    onwarn: (warning, handler) => {
      // Suppress CSS selector warnings - check code, message, and toString
      const warningStr = String(warning);
      const warningMessage = warning.message || warning.toString();
      const isCssUnusedSelector = 
        warning.code === 'css-unused-selector' || 
        warning.code === 'css_unused_selector' ||
        warningMessage.includes('Unused CSS selector') ||
        warningMessage.includes('css_unused_selector') ||
        warningStr.includes('Unused CSS selector');
      
      if (isCssUnusedSelector) {
        return; // Suppress this warning
      }
      
      // Suppress accessibility warnings during build (can be fixed later)
      if (warning.code?.startsWith('a11y-')) {
        return;
      }
      
      // Call default handler for other warnings
      handler(warning);
    },
  })],
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
      '$lib': path.resolve(__dirname, './src/lib'),
      '$components': path.resolve(__dirname, './src/components'),
      '$dashboard': path.resolve(__dirname, './src/dashboard'),
      '@shared-styles': path.resolve(__dirname, '../../shared-styles'),
      '@shared-components': path.resolve(__dirname, '../../shared-components'),
      '@shared-config': path.resolve(__dirname, '../../shared-config')
    }
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
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
      '/customer': {
        target: 'http://localhost:8790',
        changeOrigin: true
      },
      '/openapi.json': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
});

