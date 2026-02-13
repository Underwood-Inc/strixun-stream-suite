import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { defineConfig } from 'vite';

// SCSS config - Vite 7.x types changed but includePaths still works at runtime
const scssConfig: Record<string, unknown> = {
  includePaths: [
    path.resolve(__dirname, '../../packages/shared-styles'),
    path.resolve(__dirname, '../../packages/shared-components')
  ]
};

export default defineConfig({
  clearScreen: false, // Prevent console clearing in turbo dev mode
  plugins: [svelte({
    compilerOptions: {
      css: 'injected',
    },
    onwarn: (warning, handler) => {
      // Suppress CSS selector warnings - check code, message, and toString
      const warningStr = String(warning);
      const warningMessage = warning.message || warning.toString();
      const isCssUnusedSelector = 
        warning.code === 'css-unused-selector' || 
        warning.code === 'css_unused_selector' ||
        warningMessage.includes('Unused CSS selector') ||
        warningMessage.includes('css_unused_selector') ||
        warningStr.includes('Unused CSS selector');
      
      if (isCssUnusedSelector) {
        return; // Suppress this warning
      }
      
      // Suppress accessibility warnings during build (can be fixed later)
      if (warning.code?.startsWith('a11y-')) {
        return;
      }
      
      // Call default handler for other warnings
      handler(warning);
    },
  })],
  css: {
    preprocessorOptions: {
      scss: scssConfig
    }
  },
  resolve: {
    alias: {
      '$lib': path.resolve(__dirname, './src/lib'),
      '$components': path.resolve(__dirname, './src/components'),
      '$dashboard': path.resolve(__dirname, './src/dashboard'),
      '@shared-styles': path.resolve(__dirname, '../../packages/shared-styles'),
      '@shared-components': path.resolve(__dirname, '../../packages/shared-components'),
      '@shared-config': path.resolve(__dirname, '../../packages/shared-config')
    }
  },
  build: {
    outDir: path.resolve(__dirname, '../../dist/otp-auth-service-dashboard'),
    emptyOutDir: true,
    base: '/',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      },
      output: {
        // Ensure consistent chunking for better caching
        manualChunks: undefined,
        // Use consistent naming for assets
        assetFileNames: 'assets/[name].[ext]',
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js'
      }
    },
    commonjsOptions: {
      include: [/swagger-ui-dist/, /node_modules/],
      transformMixedEsModules: true
    },
    // Use esbuild for faster builds (default)
    minify: 'esbuild',
    // Ensure source maps for debugging (can be disabled in production)
    sourcemap: false
  },
  optimizeDeps: {
    include: ['mermaid', 'prismjs'],
    exclude: ['swagger-ui-dist'] // Exclude from pre-bundling, will be loaded dynamically
  },
  server: {
    port: 5174,
    strictPort: true,
    open: false,
    proxy: {
      '/auth': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
        // CRITICAL: Forward cookies for HttpOnly cookie authentication
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              console.log('[Vite Proxy] /auth - Cookies sent:', req.headers.cookie);
            }
          });
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              console.log('[Vite Proxy] /auth - Set-Cookie received:', setCookie);
            }
          });
        },
      },
      '/signup': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
      '/signup/verify': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
      '/admin': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
        // CRITICAL: Forward cookies for HttpOnly cookie authentication
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              console.log('[Vite Proxy] /admin - Cookies sent:', req.headers.cookie);
            }
          });
        },
      },
      '/customer': {
        target: 'http://localhost:8790',
        changeOrigin: true,
        secure: false,
        // CRITICAL: Forward cookies for HttpOnly cookie authentication
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              console.log('[Vite Proxy] /customer - Cookies sent:', req.headers.cookie);
            }
          });
        },
      },
      '/access': {
        target: 'http://localhost:8795',  // Access Service
        changeOrigin: true,
        secure: false,
        // CRITICAL: Forward cookies for HttpOnly cookie authentication
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              console.log('[Vite Proxy] /access - Cookies sent:', req.headers.cookie);
            }
          });
        },
      },
      '/openapi.json': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
      // API Key verification/test endpoints
      '/api-key': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
        // CRITICAL: Forward cookies for HttpOnly cookie authentication
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              console.log('[Vite Proxy] /api-key - Cookies sent:', req.headers.cookie);
            }
          });
        },
      }
    }
  }
});

