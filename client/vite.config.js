import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('monaco-editor') || id.includes('@monaco-editor/react')) {
            return 'monaco';
          }
          if (id.includes('/three/') || id.includes('@react-three/')) {
            return 'three';
          }
          if (
            id.includes('/react-dom/') ||
            id.includes('/react/') ||
            id.includes('/react-router')
          ) {
            return 'vendor';
          }
          if (id.includes('@supabase/')) {
            return 'supabase';
          }
        },
      },
    },
  },
  server: {
    port: 4033,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4034',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
})
