import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5178,
    // Allow auto-shift to next available port if 5178 is taken
    proxy: {
      '/access': {
        target: 'http://localhost:8791', // Access Service port
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path, // Keep the /access path
        // CRITICAL: Forward cookies for HttpOnly cookie authentication
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
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
