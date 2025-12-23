import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Base path for GitHub Pages deployment
  // Set via VITE_BASE_PATH env var, defaults to '/' for local development
  base: process.env.VITE_BASE_PATH || '/',
  
  plugins: [
    svelte(),
    // @ts-expect-error - Type mismatch due to multiple Vite versions in node_modules, but build works correctly
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
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
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
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
          {
            urlPattern: /^https:\/\/.*\.twitch\.tv\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'twitch-api',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              networkTimeoutSeconds: 10
            }
          }
        ]
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ],
  
  css: {
    preprocessorOptions: {
      scss: {
        // Automatically import variables and mixins in all SCSS files
        additionalData: `@use "sass:map"; @use "./src/styles/_variables.scss" as *;`
      }
    }
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@modules': resolve(__dirname, './src/modules'),
      '@stores': resolve(__dirname, './src/stores'),
      '@styles': resolve(__dirname, './src/styles')
    }
  },
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'text-cycler-display': resolve(__dirname, 'text_cycler_display.html')
      },
      output: {
        // Preserve original file structure for OBS compatibility
        entryFileNames: 'assets/js/[name].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
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
    open: false,
    cors: true
  },
  
  // Optimize for OBS dock environment
  optimizeDeps: {
    include: ['svelte']
  },
  
  // Explicitly set root to prevent PostCSS from searching in serverless/
  root: resolve(__dirname)
});

