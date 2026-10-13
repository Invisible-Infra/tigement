import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
  },
  // esbuild 0.27.7+ treats Safari 14 as lacking destructuring and then errors,
  // because it cannot lower that syntax. Vite 6's default target still includes Safari 14.
  esbuild: {
    supported: {
      destructuring: true,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      supported: {
        destructuring: true,
      },
    },
  },
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
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/Dockerfile',
        '**/docker-compose*.yml',
        '**/.git/**',
        '**/package-lock.json',
        '**/nginx.conf'
      ]
    },
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://tigement-backend:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_PROXY_TARGET || 'http://tigement-backend:3000',
        changeOrigin: true,
      }
    }
  }
})

