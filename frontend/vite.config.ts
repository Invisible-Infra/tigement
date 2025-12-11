import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 8081,
    allowedHosts: [
      '.tigement.cz',      // Allows all subdomains of tigement.cz
      '.tigement.com',     // Allows all subdomains of tigement.com
      'tigement.cz',       // Allows root domain
      'tigement.com',      // Allows root domain
      'localhost',         // Allow localhost for development
    ],
    proxy: {
      '/api': {
        target: 'http://tigement-backend:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://tigement-backend:3000',
        changeOrigin: true,
      }
    }
  }
})

