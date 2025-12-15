/**
 * Favicon notification utility - Flash the favicon to notify user of events
 */

let currentFlashInterval: number | null = null
let isFlashing = false
let safetyTimeout: number | null = null

// Capture the actual original favicon when module loads
let ORIGINAL_FAVICON: string = '/favicon.ico' // Default fallback

if (typeof document !== 'undefined') {
  const faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement
  if (faviconLink && faviconLink.href) {
    ORIGINAL_FAVICON = faviconLink.href
    console.log(`📌 Original favicon captured: ${ORIGINAL_FAVICON}`)
  }
}

// Function to restore the original favicon
export function restoreFavicon() {
  const faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement
  if (faviconLink) {
    const currentHref = faviconLink.href
    faviconLink.href = ORIGINAL_FAVICON
    console.log(`🔄 Favicon restored: ${currentHref} → ${ORIGINAL_FAVICON}`)
  } else {
    console.warn('⚠️ Favicon link element not found during restore')
  }
}

// Function to clean up and reset all state
function cleanup() {
  if (currentFlashInterval !== null) {
    clearInterval(currentFlashInterval)
    currentFlashInterval = null
  }
  if (safetyTimeout !== null) {
    clearTimeout(safetyTimeout)
    safetyTimeout = null
  }
  isFlashing = false
  restoreFavicon()
}

// Restore favicon when page becomes visible (safety measure)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Clean up any stuck animations and restore
      cleanup()
    }
  })
}

export function flashFavicon(times: number = 5) {
  // If already flashing, don't start another animation
  if (isFlashing) {
    console.log('Favicon already flashing, skipping duplicate call')
    return
  }
  
  // Clear any existing flash animation and restore immediately
  cleanup()
  
  isFlashing = true
  let flashCount = 0
  
  // Safety timeout: force cleanup after maximum expected animation time + buffer
  const maxAnimationTime = times * 2 * 300 + 500 // (times * 2 flashes * 300ms) + 500ms buffer
  safetyTimeout = window.setTimeout(() => {
    console.log('Safety timeout triggered, forcing favicon restoration')
    cleanup()
  }, maxAnimationTime)
  
  // Create data URL for a red notification circle
  const createNotificationIcon = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    
    if (ctx) {
      // Draw red circle
      ctx.fillStyle = '#ef4444' // red-500
      ctx.beginPath()
      ctx.arc(16, 16, 15, 0, 2 * Math.PI)
      ctx.fill()
      
      // Draw white exclamation mark
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 20px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('!', 16, 16)
    }
    
    return canvas.toDataURL()
  }
  
  const notificationIcon = createNotificationIcon()
  const faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement
  
  if (!faviconLink) {
    console.warn('Favicon link element not found')
    isFlashing = false
    return
  }
  
  console.log(`🔔 Starting favicon flash animation (${times} times)`)
  
  currentFlashInterval = window.setInterval(() => {
    flashCount++
    
    // Alternate between notification and original
    if (flashCount % 2 === 1) {
      // Odd counts: show notification icon
      faviconLink.href = notificationIcon
    } else {
      // Even counts: show original
      faviconLink.href = ORIGINAL_FAVICON
    }
    
    // Stop after times * 2 flashes (times on, times off)
    if (flashCount >= times * 2) {
      console.log(`✅ Favicon flash animation complete (${flashCount} flashes)`)
      // Clear the interval
      if (currentFlashInterval !== null) {
        clearInterval(currentFlashInterval)
        currentFlashInterval = null
      }
      // Clear safety timeout
      if (safetyTimeout !== null) {
        clearTimeout(safetyTimeout)
        safetyTimeout = null
      }
      // Mark as no longer flashing
      isFlashing = false
      
      // Force restore to original immediately
      restoreFavicon()
      
      // Also schedule another restore after a short delay as a safety measure
      setTimeout(() => {
        restoreFavicon()
        console.log('🔄 Secondary restoration triggered')
      }, 100)
    }
  }, 300) // Flash every 300ms
}

