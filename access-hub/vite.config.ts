import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  clearScreen: false, // Prevent console clearing in turbo dev mode
  plugins: [react()],
  server: {
    port: 5178,
    strictPort: true,
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
      '/access': {
        target: 'http://localhost:8795', // Access Service port
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path, // Keep the /access path
        // CRITICAL: Forward cookies for HttpOnly cookie authentication
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, req) => {
            if (req.headers.cookie) {
              console.log('[Vite Proxy] /access - Cookies sent:', req.headers.cookie);
            }
          });
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              console.log('[Vite Proxy] /access - Set-Cookie received:', setCookie);
            }
          });
        },
      },
    },
  },
  build: {
    outDir: '../dist/access-hub',
    emptyOutDir: true,
  },
})
