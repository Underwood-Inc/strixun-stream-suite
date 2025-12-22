import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte()],
  
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
  }
});

