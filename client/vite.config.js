import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const basePath = process.env.GITHUB_PAGES_BASE || '/bingo-game/';

export default defineConfig({
  base: basePath,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 4173
  }
});
