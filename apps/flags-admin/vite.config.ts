import react from '@vitejs/plugin-react';
import fs from 'fs';
import { defineConfig } from 'vite';
import { resolve } from 'path';

function copyDirRecursive(src: string, dest: string, baseSrc: string = src): void {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = resolve(src, entry.name);
    const destPath = resolve(dest, entry.name);
    const relativePath = srcPath.slice(baseSrc.length + 1);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirRecursive(srcPath, destPath, baseSrc);
    } else if (entry.isFile()) {
      if (!entry.name.endsWith('.ts') || entry.name.includes('.test.') || entry.name.includes('.spec.')) {
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
      console.log(`  Copied functions/${relativePath}`);
    }
  }
}

function copyFunctionsPlugin() {
  return {
    name: 'copy-functions',
    closeBundle: () => {
      const functionsSource = resolve(__dirname, 'functions');
      const functionsTarget = resolve(__dirname, '../../dist/flags-admin/functions');
      if (!fs.existsSync(functionsSource)) {
        return;
      }
      console.log('Copying Cloudflare Pages Functions to build output...');
      fs.mkdirSync(functionsTarget, { recursive: true });
      copyDirRecursive(functionsSource, functionsTarget, functionsSource);
    },
  };
}

export default defineConfig({
  plugins: [react(), copyFunctionsPlugin()],
  optimizeDeps: {
    include: ['@strixun/auth-store', '@strixun/otp-login'],
  },
  server: {
    port: 5179,
    strictPort: true,
    proxy: {
      '/auth-api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/auth-api/, ''),
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
      },
      '/flags-api': {
        target: 'http://localhost:8797',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/flags-api/, ''),
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
      },
    },
  },
  build: {
    outDir: resolve(__dirname, '../../dist/flags-admin'),
    emptyOutDir: true,
  },
});