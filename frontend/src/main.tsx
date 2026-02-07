import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './themes.css'
import { ThemeProvider } from './contexts/ThemeContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { logCapture } from './utils/logCapture'
import { debugLogger } from './utils/debugLogger'

// Initialize debug logger first (captures all console logs and errors)
debugLogger

// Initialize log capture for bug reports
logCapture

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration)
        
        // Check for updates every hour
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          const existingWorker = registration.active  // Check if there's already an active worker
          
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              // Only show update prompt if replacing an existing worker
              if (existingWorker) {
                console.log('Service Worker update available')
                if (confirm('A new version is available. Reload to update?')) {
                  window.location.reload()
                }
              } else {
                console.log('Service Worker installed (first time)')
              }
            }
          })
        })
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error)
      })
  })
}

const root = ReactDOM.createRoot(document.getElementById('root')!)

if (import.meta.env.DEV) {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </ErrorBoundary>
    </React.StrictMode>
  )
} else {
  root.render(
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  )
}

