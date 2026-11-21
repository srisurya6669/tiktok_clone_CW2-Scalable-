import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    // Tests always call a known API address, whatever is in .env.
    env: { VITE_API_URL: 'http://api.test' },
  },
})
