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

