import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8001',
      '/api': 'http://localhost:8001',
      '/projects': 'http://localhost:8001',
      '/anchors': 'http://localhost:8001',
      '/candidates': 'http://localhost:8001',
      '/candidate-images': 'http://localhost:8001',
      '/snapshots': 'http://localhost:8001',
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
