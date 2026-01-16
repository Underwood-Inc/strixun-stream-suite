import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  clearScreen: false, // Prevent console clearing in turbo dev mode
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
    dedupe: [
      '@strixun/auth-store',
      '@strixun/chat',
      '@strixun/otp-login',
    ],
  },
  optimizeDeps: {
    include: [
      '@strixun/auth-store',
      '@strixun/chat',
      '@strixun/otp-login',
    ],
  },
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      // Auth API proxy for login
      '/auth-api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/auth-api/, ''),
        secure: false,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, req) => {
            if (req.headers.cookie) {
              console.log('[Vite Proxy] /auth-api - Cookies sent:', req.headers.cookie);
            }
          });
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              console.log('[Vite Proxy] /auth-api - Set-Cookie received:', setCookie);
            }
          });
        },
      },
      // Chat signaling API proxy
      '/chat-api': {
        target: 'http://localhost:8792', // Chat signaling worker port
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/chat-api/, ''),
        secure: false,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, req) => {
            if (req.headers.cookie) {
              console.log('[Vite Proxy] /chat-api - Cookies sent:', req.headers.cookie);
            }
          });
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              console.log('[Vite Proxy] /chat-api - Set-Cookie received:', setCookie);
            }
          });
        },
      },
      // Customer API proxy (for displayName)
      '/customer-api': {
        target: 'http://localhost:8790', // Customer API worker port
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/customer-api/, ''),
        secure: false,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, req) => {
            if (req.headers.cookie) {
              console.log('[Vite Proxy] /customer-api - Cookies sent:', req.headers.cookie);
            }
          });
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              console.log('[Vite Proxy] /customer-api - Set-Cookie received:', setCookie);
            }
          });
        },
      },
    },
  },
  build: {
    outDir: '../dist/chat-hub',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
