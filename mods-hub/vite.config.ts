import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Base path for production deployment (root for Cloudflare Pages)
  base: '/',
  server: {
    port: 3001,
    open: true,
    // Proxy API requests to avoid CORS issues in development
    // This matches the pattern used in other projects (e.g., otp-auth-service dashboard)
    proxy: {
      '/mods-api': {
        target: 'https://mods-api.idling.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mods-api/, ''),
        secure: true,
      },
      '/auth-api': {
        target: 'https://auth.idling.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/auth-api/, ''),
        secure: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    // Optimize for production
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        // Consistent chunk naming for better caching
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'state-vendor': ['zustand'],
        },
      },
    },
  },
});

