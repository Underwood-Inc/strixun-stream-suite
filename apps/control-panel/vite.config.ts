import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  clearScreen: false, // Prevent console clearing in turbo dev mode
  plugins: [
    react(),
    // Bundle everything into a single HTML file for OBS dock compatibility
    viteSingleFile(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@services': resolve(__dirname, 'src/services'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@theme': resolve(__dirname, 'src/theme'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@types': resolve(__dirname, 'src/types'),
    },
  },
  build: {
    // Output to root dist directory
    outDir: resolve(__dirname, '../../dist/control-panel'),
    emptyOutDir: true,
    // Inline all assets
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // Single bundle
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 5175,
    strictPort: true,
    open: false,
    // CRITICAL: Proxy API requests for HttpOnly cookie SSO
    proxy: {
      '/auth-api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/auth-api/, ''),
        secure: false,
        // CRITICAL: Forward cookies for HttpOnly cookie SSO
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
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
    },
  },
});

