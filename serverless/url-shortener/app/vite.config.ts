import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// SCSS config - Vite 7.x types changed but includePaths still works at runtime
const scssConfig: Record<string, unknown> = {
  includePaths: [path.resolve(__dirname, '../../../packages/shared-styles')]
};

export default defineConfig({
  clearScreen: false, // Prevent console clearing in turbo dev mode
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  css: {
    preprocessorOptions: {
      scss: scssConfig
    }
  },
  resolve: {
    alias: {
      '$lib': path.resolve(__dirname, './src/lib'),
      '@shared-styles': path.resolve(__dirname, '../../../packages/shared-styles'),
      '@shared-components': path.resolve(__dirname, '../../../packages/shared-components'),
      '@mods-hub/components': path.resolve(__dirname, '../../../apps/mods-hub/src/components')
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
    strictPort: true,
    open: false,
    hmr: {
      port: 5176,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8793', // URL shortener worker
        changeOrigin: true,
        secure: false,
        // CRITICAL: Forward cookies for HttpOnly cookie authentication
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              console.log('[Vite Proxy] /api - Cookies sent:', req.headers.cookie);
            }
          });
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              console.log('[Vite Proxy] /api - Set-Cookie received:', setCookie);
            }
          });
        },
      },
      '/auth-api': {
        target: 'http://localhost:8787', // Auth service for login
        changeOrigin: true,
        secure: false,
        // CRITICAL: Forward cookies for HttpOnly cookie authentication
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
      '/customer-api': {
        target: 'http://localhost:8790', // Customer API service
        changeOrigin: true,
        secure: false,
        // CRITICAL: Forward cookies for HttpOnly cookie authentication
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
      '/decrypt.js': {
        target: 'http://localhost:8793',
        changeOrigin: true,
        secure: false,
      },
      '/otp-core.js': {
        target: 'http://localhost:8793',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});

