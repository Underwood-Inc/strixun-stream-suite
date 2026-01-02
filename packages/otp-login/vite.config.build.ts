import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    svelte({
      configFile: resolve(__dirname, 'svelte.config.js'),
      compilerOptions: {
        generate: 'dom',
        hydratable: false,
        css: 'injected',
        customElement: false,
      },
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'entry.ts'),
      name: 'OtpLoginSvelte',
      fileName: 'otp-login-svelte',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        extend: true,
        globals: {},
      },
    },
    outDir: resolve(__dirname, '../../dist/otp-login'),
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  resolve: {
    alias: {
      '@shared-components': resolve(__dirname, '..'),
    },
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  optimizeDeps: {
    exclude: ['svelte'],
  },
});

