import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8081,
    host: 'localhost',
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
})
