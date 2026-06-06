import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/itunes-api': {
        target: 'https://itunes.apple.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/itunes-api/, ''),
      },
      '/lyrics-api': {
        target: 'https://lrclib.net/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lyrics-api/, ''),
      },
    },
  },
})
