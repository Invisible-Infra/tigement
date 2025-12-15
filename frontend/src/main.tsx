import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './themes.css'
import { ThemeProvider } from './contexts/ThemeContext'
import { logCapture } from './utils/logCapture'

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
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              // Notify user or auto-reload
              if (confirm('A new version is available. Reload to update?')) {
                window.location.reload()
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)

