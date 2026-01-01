import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte()],
  build: {
    lib: {
      entry: resolve(__dirname, 'svelte/OtpLogin.svelte'),
      name: 'OtpLogin',
      fileName: 'otp-login',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
    outDir: '../../dist/otp-login',
  },
  resolve: {
    alias: {
      '@shared-components': resolve(__dirname, '..'),
    },
  },
});

