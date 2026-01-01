import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
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
      '@shared-styles': path.resolve(__dirname, '../../../shared-styles'),
      '@shared-components': path.resolve(__dirname, '../../../shared-components'),
      '@mods-hub/components': path.resolve(__dirname, '../../../mods-hub/src/components')
    }
  },
  build: {
    outDir: path.resolve(__dirname, '../../../dist/url-shortener-app'),
    emptyOutDir: true,
    base: '/',
    cssCodeSplit: false, // Bundle all CSS into a single file to avoid missing styles
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
    hmr: {
      port: 5176,
    },
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

