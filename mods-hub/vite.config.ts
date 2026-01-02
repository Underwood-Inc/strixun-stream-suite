import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Ensure proper module resolution to avoid circular dependencies
    dedupe: ['@strixun/api-framework'],
  },
  optimizeDeps: {
    // Force pre-bundling of api-framework to resolve circular dependencies
    include: ['@strixun/api-framework', '@strixun/api-framework/client'],
    // Exclude from optimization to ensure proper module resolution
    exclude: [],
  },
  // Base path for production deployment (root for Cloudflare Pages)
  base: '/',
  server: {
    port: 3001,
    open: true,
    // HMR (Hot Module Replacement) WebSocket configuration
    // CRITICAL: Must be configured to avoid conflicts with proxy
    hmr: {
      port: 3001,
      host: 'localhost',
      protocol: 'ws',
    },
    // Proxy API requests to avoid CORS issues in development
    // In dev mode, proxy to local wrangler dev server
    // In production, the frontend will call the API directly via subdomain
    // IMPORTANT: Proxy only matches specific paths - Vite's HMR WebSocket and assets use root path
    proxy: {
      // CRITICAL: Order matters - more specific paths first
      // Only proxy paths that start with /auth-api or /mods-api
      // Vite's internal paths (/, /@vite/, /node_modules/, etc.) are NOT proxied
      '/auth-api': {
        target: 'http://localhost:8787', // OTP Auth Service runs on port 8787
        changeOrigin: true,
        // Remove /auth-api prefix - auth service handles /auth/* routes
        // /auth-api/auth/restore-session -> /auth/restore-session
        rewrite: (path) => path.replace(/^\/auth-api/, ''),
        secure: false, // Local dev server doesn't use HTTPS
        ws: true, // Enable WebSocket proxying for API WebSockets (not Vite HMR)
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('[Vite Proxy] Auth proxy error:', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Skip logging for WebSocket upgrade requests to reduce noise
            if (!req.headers.upgrade || req.headers.upgrade !== 'websocket') {
              console.log('[Vite Proxy] Auth', req.method, req.url, '->', proxyReq.path, '(target: localhost:8787)');
            }
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            if (!req.headers.upgrade || req.headers.upgrade !== 'websocket') {
              console.log('[Vite Proxy] Auth Response:', req.method, req.url, '->', proxyRes.statusCode);
            }
          });
        },
      },
      // Mods API proxy
      '/mods-api': {
        target: 'http://localhost:8788', // Mods API runs on port 8788
        changeOrigin: true,
        // Remove /mods-api prefix and send to worker
        // Worker supports both /mods/* and root-level paths for subdomain routing
        // /mods-api/mods -> /mods
        rewrite: (path) => path.replace(/^\/mods-api/, ''),
        secure: false, // Local dev server doesn't use HTTPS
        ws: true, // Enable WebSocket proxying for API WebSockets (not Vite HMR)
        timeout: 30000, // 30 second timeout for proxy requests
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.error('[Vite Proxy] Mods API proxy error:', err.message);
            // If connection refused, the backend isn't running
            if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
              if (res && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  error: 'Service Unavailable',
                  message: 'Mods API server is not running. Please start it with: pnpm --filter strixun-mods-api dev',
                  code: 'BACKEND_NOT_RUNNING'
                }));
              }
            }
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Skip logging for WebSocket upgrade requests to reduce noise
            if (!req.headers.upgrade || req.headers.upgrade !== 'websocket') {
              console.log('[Vite Proxy] Mods API', req.method, req.url, '->', proxyReq.path, '(target: localhost:8788)');
            }
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            if (!req.headers.upgrade || req.headers.upgrade !== 'websocket') {
              console.log('[Vite Proxy] Mods API Response:', req.method, req.url, '->', proxyRes.statusCode);
            }
          });
        },
      },
    },
  },
  build: {
    outDir: '../dist/mods-hub',
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

