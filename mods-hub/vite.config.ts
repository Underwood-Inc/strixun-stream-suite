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
    // In dev mode, proxy to local wrangler dev server (localhost:8787)
    // In production, the frontend will call the API directly via subdomain
    // IMPORTANT: Proxy must be defined before Vite's SPA fallback
    proxy: {
      '/mods-api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        // Remove /mods-api prefix and send to worker
        // Worker supports both /mods/* and root-level paths for subdomain routing
        // /mods-api/mods -> /mods
        rewrite: (path) => path.replace(/^\/mods-api/, ''),
        secure: false, // Local dev server doesn't use HTTPS
        ws: true, // Enable WebSocket proxying
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('[Vite Proxy] Proxy error:', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[Vite Proxy]', req.method, req.url, '->', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[Vite Proxy] Response:', req.method, req.url, '->', proxyRes.statusCode);
          });
        },
      },
      '/auth-api': {
        target: 'http://localhost:8788', // Auth service runs on port 8788
        changeOrigin: true,
        // Remove /auth-api prefix - auth service handles /auth/* routes
        // /auth-api/auth/restore-session -> /auth/restore-session
        rewrite: (path) => path.replace(/^\/auth-api/, ''),
        secure: false, // Local dev server doesn't use HTTPS
        ws: true, // Enable WebSocket proxying
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('[Vite Proxy] Auth proxy error:', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[Vite Proxy] Auth', req.method, req.url, '->', proxyReq.path);
          });
        },
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
    cssCodeSplit: false, // Bundle all CSS into a single file to avoid missing styles
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

