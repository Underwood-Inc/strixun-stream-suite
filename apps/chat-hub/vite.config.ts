import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// SCSS config - Vite 7.x types changed but includePaths still works at runtime
const scssConfig: Record<string, unknown> = {
  includePaths: [path.resolve(__dirname, '../../packages/shared-styles')]
};

// https://vite.dev/config/
export default defineConfig({
  clearScreen: false, // Prevent console clearing in turbo dev mode
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Strixun Chat - P2P Encrypted Messaging',
        short_name: 'Strixun Chat',
        description: 'Peer-to-peer encrypted messaging with blockchain-style persistence',
        theme_color: '#d4af37',
        background_color: '#1a1a1a',
        display: 'standalone',
        scope: '/',
        start_url: '/#/chat',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/chat-api\.idling\.app\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'chat-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: scssConfig
    }
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@shared-styles', replacement: path.resolve(__dirname, '../../packages/shared-styles') },
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
    outDir: '../../dist/chat-hub',
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
