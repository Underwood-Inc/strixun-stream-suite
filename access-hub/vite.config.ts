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
        target: 'http://localhost:8795',
        changeOrigin: true,
        rewrite: (path) => path, // Keep the /access path
      },
    },
  },
  build: {
    outDir: '../dist/access-hub',
    emptyOutDir: true,
  },
})
