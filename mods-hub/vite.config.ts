import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Plugin to copy Cloudflare Pages Functions to build output
 * This ensures the functions directory is included in the deployment
 */
function copyFunctionsPlugin() {
  return {
    name: 'copy-functions',
    closeBundle: () => {
      const functionsSource = path.resolve(__dirname, 'functions');
      const functionsTarget = path.resolve(__dirname, '../dist/mods-hub/functions');
      
      // Check if functions directory exists
      if (!fs.existsSync(functionsSource)) {
        console.log('No functions directory found, skipping copy');
        return;
      }
      
      // Copy functions directory to build output
      console.log('Copying Cloudflare Pages Functions to build output...');
      
      // Create target directory if it doesn't exist
      if (!fs.existsSync(functionsTarget)) {
        fs.mkdirSync(functionsTarget, { recursive: true });
      }
      
      // Copy all files from functions directory
      const files = fs.readdirSync(functionsSource);
      files.forEach((file) => {
        const sourcePath = path.join(functionsSource, file);
        const targetPath = path.join(functionsTarget, file);
        
        // Skip non-TypeScript files (like README.md, test files, etc.)
        if (!file.endsWith('.ts') || file.includes('.test.') || file.includes('.spec.')) {
          console.log(`  Skipping ${file} (not a deployable function)`);
          return;
        }
        
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`  Copied ${file} to ${functionsTarget}`);
      });
      
      console.log('* Cloudflare Pages Functions copied successfully!');
    },
  };
}

export default defineConfig({
  clearScreen: false, // Prevent console clearing in turbo dev mode
  plugins: [react(), copyFunctionsPlugin()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
    // Ensure proper module resolution to avoid circular dependencies
    dedupe: [
      '@strixun/api-framework',
      '@strixun/api-framework/client',
      '@strixun/otp-login',
      '@strixun/auth-store',
      '@strixun/chat',
      '@strixun/search-query-parser',
      '@strixun/virtualized-table',
      '@strixun/dice-board-game',
      '@strixun/e2e-helpers'
    ],
  },
  optimizeDeps: {
    // Force pre-bundling of @strixun packages to resolve circular dependencies
    include: [
      '@strixun/api-framework',
      '@strixun/api-framework/client',
      '@strixun/otp-login',
      '@strixun/auth-store',
      '@strixun/chat',
      '@strixun/search-query-parser',
      '@strixun/virtualized-table',
      '@strixun/dice-board-game'
    ],
    // Exclude from optimization to ensure proper module resolution
    exclude: [],
  },
  // Base path for production deployment (root for Cloudflare Pages)
  base: '/',
  server: {
    port: 3001,
    strictPort: true,
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
        // Example: /auth-api/auth/me -> /auth/me
        rewrite: (path) => path.replace(/^\/auth-api/, ''),
        secure: false, // Local dev server doesn't use HTTPS
        ws: true, // Enable WebSocket proxying for API WebSockets (not Vite HMR)
        // CRITICAL: Forward cookies between frontend and backend for HttpOnly cookie SSO
        cookieDomainRewrite: 'localhost', // Rewrite cookie domain to localhost for dev
        cookiePathRewrite: '/', // Keep cookie path as root
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('[Vite Proxy] Auth proxy error:', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Skip logging for WebSocket upgrade requests to reduce noise
            if (!req.headers.upgrade || req.headers.upgrade !== 'websocket') {
              console.log('[Vite Proxy] Auth', req.method, req.url, '->', proxyReq.path, '(target: localhost:8787)');
              // Log cookies being sent
              if (req.headers.cookie) {
                console.log('[Vite Proxy] Auth - Cookies sent:', req.headers.cookie);
              }
            }
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            if (!req.headers.upgrade || req.headers.upgrade !== 'websocket') {
              console.log('[Vite Proxy] Auth Response:', req.method, req.url, '->', proxyRes.statusCode);
              // Log Set-Cookie headers
              const setCookie = proxyRes.headers['set-cookie'];
              if (setCookie) {
                console.log('[Vite Proxy] Auth - Set-Cookie received:', setCookie);
              }
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
        // CRITICAL: Forward cookies between frontend and backend for HttpOnly cookie SSO
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy, _options) => {
          proxy.on('error', (err: NodeJS.ErrnoException, req, res) => {
            console.error('[Vite Proxy] Mods API proxy error:', err.message);
            // If connection refused, the backend isn't running
            if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
              if (res && typeof res === 'object' && 'writeHead' in res && 'headersSent' in res && !res.headersSent) {
                (res as any).writeHead(503, { 'Content-Type': 'application/json' });
                (res as any).end(JSON.stringify({
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
      // Customer API proxy
      '/customer-api': {
        target: 'http://localhost:8790', // Customer API runs on port 8790
        changeOrigin: true,
        // Remove /customer-api prefix and send to worker
        // /customer-api/admin/customers -> /admin/customers
        rewrite: (path) => path.replace(/^\/customer-api/, ''),
        secure: false, // Local dev server doesn't use HTTPS
        ws: true, // Enable WebSocket proxying for API WebSockets (not Vite HMR)
        timeout: 30000, // 30 second timeout for proxy requests
        // CRITICAL: Forward cookies between frontend and backend for HttpOnly cookie SSO
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy, _options) => {
          proxy.on('error', (err: NodeJS.ErrnoException, req, res) => {
            console.error('[Vite Proxy] Customer API proxy error:', err.message);
            // If connection refused, the backend isn't running
            if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
              if (res && typeof res === 'object' && 'writeHead' in res && 'headersSent' in res && !res.headersSent) {
                (res as any).writeHead(503, { 'Content-Type': 'application/json' });
                (res as any).end(JSON.stringify({
                  error: 'Service Unavailable',
                  message: 'Customer API server is not running. Please start it with: pnpm --filter strixun-customer-api dev',
                  code: 'BACKEND_NOT_RUNNING'
                }));
              }
            }
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Skip logging for WebSocket upgrade requests to reduce noise
            if (!req.headers.upgrade || req.headers.upgrade !== 'websocket') {
              console.log('[Vite Proxy] Customer API', req.method, req.url, '->', proxyReq.path, '(target: localhost:8790)');
            }
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            if (!req.headers.upgrade || req.headers.upgrade !== 'websocket') {
              console.log('[Vite Proxy] Customer API Response:', req.method, req.url, '->', proxyRes.statusCode);
            }
          });
        },
      },
      // Chat API proxy
      '/chat-api': {
        target: 'http://localhost:8792', // Chat Signaling API runs on port 8792
        changeOrigin: true,
        // Remove /chat-api prefix and send to worker
        // /chat-api/signaling/create-room -> /signaling/create-room
        rewrite: (path) => path.replace(/^\/chat-api/, ''),
        secure: false,
        ws: true, // Enable WebSocket proxying for chat signaling
        timeout: 30000,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy, _options) => {
          proxy.on('error', (err: NodeJS.ErrnoException, req, res) => {
            console.error('[Vite Proxy] Chat API proxy error:', err.message);
            if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
              if (res && typeof res === 'object' && 'writeHead' in res && 'headersSent' in res && !res.headersSent) {
                (res as any).writeHead(503, { 'Content-Type': 'application/json' });
                (res as any).end(JSON.stringify({
                  error: 'Service Unavailable',
                  message: 'Chat API server is not running. Please start it with: pnpm --filter strixun-chat-signaling dev',
                  code: 'BACKEND_NOT_RUNNING'
                }));
              }
            }
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            if (!req.headers.upgrade || req.headers.upgrade !== 'websocket') {
              console.log('[Vite Proxy] Chat API', req.method, req.url, '->', proxyReq.path, '(target: localhost:8792)');
            }
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            if (!req.headers.upgrade || req.headers.upgrade !== 'websocket') {
              console.log('[Vite Proxy] Chat API Response:', req.method, req.url, '->', proxyRes.statusCode);
            }
          });
        },
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../dist/mods-hub'),
    emptyOutDir: true,
    sourcemap: false,
    // Optimize for production
    minify: 'esbuild',
    target: 'es2020',
    cssCodeSplit: false, // Bundle all CSS into a single file to avoid missing styles
    // Prevent chunking issues that cause circular dependency errors
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Preserve entry signatures to ensure proper initialization order
      preserveEntrySignatures: 'strict',
      output: {
        // CRITICAL: Disable ALL code splitting to prevent circular dependency initialization errors
        // This ensures all @strixun packages are in the same bundle with proper initialization order
        // Note: This will create a larger bundle but prevents "Cannot access X before initialization" errors
        inlineDynamicImports: true, // Inline all dynamic imports to prevent chunk loading order issues
      },
    },
  },
});

