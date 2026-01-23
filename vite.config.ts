/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// SCSS config - Vite 7.x types changed but includePaths still works at runtime
const scssConfig: Record<string, unknown> = {
  includePaths: [resolve(__dirname, './shared-styles')]
};

export default defineConfig({
  // Base path for GitHub Pages deployment
  // Set via VITE_BASE_PATH env var, defaults to '/' for local development
  base: process.env.VITE_BASE_PATH || '/',
  // Explicitly set public directory to ensure brand images are copied
  publicDir: 'public',
  // Prevent console clearing in watch mode (useful for debugging with turbo)
  clearScreen: false,
  plugins: [svelte({
    onwarn: (warning, handler) => {
      // Suppress CSS unused selector warnings (classes may be used dynamically or in imported SCSS)
      if (warning.code === 'css-unused-selector') return;
      // Suppress a11y warnings during migration
      if (warning.code?.startsWith('a11y-')) return;
      handler(warning);
    },
  }),
  // @ts-expect-error - Type mismatch due to multiple Vite versions in node_modules, but build works correctly
  VitePWA({
    registerType: 'autoUpdate',
    includeAssets: [
      'favicon.ico',
      'apple-touch-icon.png',
      'mask-icon.svg',
      'rituals-brand.png',
      'strixun-pack-a-brand.png',
      'compressy-brand.png'
    ],
    manifest: {
      name: "Strixun's Stream Suite",
      short_name: 'Stream Suite',
      description: 'A comprehensive OBS Studio toolkit for animations, layouts, text cycling, and Twitch integration',
      theme_color: '#1a1a1a',
      background_color: '#1a1a1a',
      display: 'standalone',
      orientation: 'any',
      scope: '/',
      start_url: '/',
      icons: [{
        src: 'pwa-64x64.png',
        sizes: '64x64',
        type: 'image/png'
      }, {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      }, {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      }, {
        src: 'maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      runtimeCaching: [
        // DEFAULT: All API calls - NEVER cache (NetworkOnly = always fetch from network)
        // This ensures all API requests always go to the server, preventing stale data
        {
          urlPattern: /^https:\/\/.*\/(api|auth|admin|mods|customer|user|game|chat|url).*$/i,
          handler: 'NetworkOnly',
          options: {
            // NetworkOnly handler doesn't use cache at all
            // This ensures API requests always go to the server
          }
        },
        // OTP/Auth endpoints - NEVER cache (explicit, more specific pattern)
        {
          urlPattern: /^https:\/\/.*\/auth\/(request-otp|verify-otp|session|logout|refresh|me).*$/i,
          handler: 'NetworkOnly',
          options: {
            // NetworkOnly handler doesn't use cache at all
            // This ensures OTP requests always go to the server
          }
        },
        // Static assets from our domain - Cache first (images, fonts, etc.)
        {
          urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot|otf)$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'static-assets',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year - static assets are immutable
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        // CDN assets - Cache first (external CDNs like jsdelivr)
        {
          urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'jsdelivr-cdn',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        // Profile pictures from R2/CDN - Cache first (immutable, long cache)
        {
          urlPattern: /^https:\/\/.*\.(r2\.cloudflarestorage\.com|pub-[a-z0-9]+\.r2\.dev).*\.(webp|png|jpg|jpeg)$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'profile-pictures',
            expiration: {
              maxEntries: 500,
              maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year - profile pictures are immutable
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        }
        // Note: Twitch API removed - should not be cached (use NetworkOnly default)
      ]
    },
    devOptions: {
      enabled: true, // Enable PWA in dev mode to test install prompt
      type: 'module'
    }
  })],
  css: {
    preprocessorOptions: {
      scss: scssConfig
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/lib/components'),
      '@modules': resolve(__dirname, './src/modules'),
      '@stores': resolve(__dirname, './src/stores'),
      '@styles': resolve(__dirname, './src/styles'),
      '@shared-components': resolve(__dirname, './shared-components'),
      '@shared-styles': resolve(__dirname, './shared-styles')
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist/stream-suite'),
    emptyOutDir: true,
    cssCodeSplit: false, // Bundle all CSS into a single file to avoid missing styles
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
        // text-cycler-display is now a hash route within the main app: /#/text-cycler-display
      },
      output: {
        // Preserve original file structure for OBS compatibility
        entryFileNames: 'assets/js/[name].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: assetInfo => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/css/[name][extname]';
          }
          return 'assets/[name][extname]';
        }
      }
    },
    // Target modern browsers (OBS uses Chromium)
    target: 'es2020',
    minify: 'terser',
    sourcemap: true
  },
  server: {
    port: 5173,
    strictPort: true, // Fail if port is taken instead of silently shifting
    open: false,
    cors: true,
    // CRITICAL: Proxy API requests to local workers with cookie forwarding for HttpOnly SSO
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
              console.log('[Vite Proxy] Auth - Cookies sent:', req.headers.cookie);
            }
          });
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              console.log('[Vite Proxy] Auth - Set-Cookie received:', setCookie);
            }
          });
        },
      },
      '/customer-api': {
        target: 'http://localhost:8790',
        changeOrigin: true,
        secure: false,
        // CRITICAL: Forward cookies for HttpOnly cookie SSO
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
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
  // Optimize for OBS dock environment
  optimizeDeps: {
    include: ['svelte']
  },
  // Explicitly set root to prevent PostCSS from searching in serverless/
  root: resolve(__dirname),
  // Test configuration removed - Storybook is for component library documentation only
  // Tests should be configured separately if needed
});