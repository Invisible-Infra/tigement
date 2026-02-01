import { useState, useEffect } from 'react'

interface OfflineBannerProps {
  isPremium?: boolean
  onSync?: () => Promise<void>
}

export function OfflineBanner({ isPremium, onSync }: OfflineBannerProps) {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [syncing, setSyncing] = useState(false)
  const [justSynced, setJustSynced] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true)
      if (isPremium && onSync) {
        setSyncing(true)
        onSync()
          .then(() => {
            setJustSynced(true)
            setTimeout(() => setJustSynced(false), 3000)
          })
          .catch(() => {})
          .finally(() => setSyncing(false))
      }
    }
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [isPremium, onSync])

  if (online && !syncing && !justSynced) return null

  if (!online) {
    return (
      <div className="flex-shrink-0 bg-amber-600 text-white text-center py-1.5 px-2 text-sm" role="status">
        Offline – changes saved locally and will sync when back online.
      </div>
    )
  }

  if (syncing) {
    return (
      <div className="flex-shrink-0 bg-blue-600 text-white text-center py-1.5 px-2 text-sm" role="status">
        Syncing…
      </div>
    )
  }

  if (justSynced) {
    return (
      <div className="flex-shrink-0 bg-green-600 text-white text-center py-1.5 px-2 text-sm" role="status">
        Synced.
      </div>
    )
  }

  return null
}
