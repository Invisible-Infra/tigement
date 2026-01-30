/**
 * Admin Announcement Display Component
 * Polls for active announcements and displays them at the top of the app
 * Updates every 60 seconds without page reload
 * User can dismiss; dismissal is persisted until a new announcement is enabled
 */

import { useEffect, useState } from 'react'
import { api } from '../utils/api'

const DISMISSED_ANNOUNCEMENT_KEY = 'tigement_dismissed_announcement_id'

function getDismissedId(): number | null {
  try {
    const s = localStorage.getItem(DISMISSED_ANNOUNCEMENT_KEY)
    if (s == null) return null
    const n = parseInt(s, 10)
    return Number.isNaN(n) ? null : n
  } catch {
    return null
  }
}

function setDismissedId(id: number | null) {
  try {
    if (id == null) localStorage.removeItem(DISMISSED_ANNOUNCEMENT_KEY)
    else localStorage.setItem(DISMISSED_ANNOUNCEMENT_KEY, String(id))
  } catch {
    // ignore
  }
}

interface AnnouncementData {
  id: number
  message: string
  text_color: string
  background_color: string
  enabled: boolean
}

interface AdminAnnouncementProps {
  isMobile: boolean
}

export function AdminAnnouncement({ isMobile }: AdminAnnouncementProps) {
  const [announcement, setAnnouncement] = useState<AnnouncementData | null>(null)
  const [dismissedId, setDismissedIdState] = useState<number | null>(getDismissedId)

  const fetchAnnouncement = async () => {
    try {
      const data = await api.getAnnouncement()
      if (data.enabled && data.message && data.id != null) {
        const id = Number(data.id)
        if (id !== getDismissedId()) {
          setDismissedIdState(null)
          setDismissedId(null)
        }
        setAnnouncement({ ...data, id })
      } else {
        setAnnouncement(null)
      }
    } catch (error) {
      console.error('Failed to fetch announcement:', error)
      // Don't show error to user - just fail silently
    }
  }

  useEffect(() => {
    fetchAnnouncement()
    const interval = setInterval(fetchAnnouncement, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleDismiss = () => {
    if (!announcement?.id) return
    setDismissedId(announcement.id)
    setDismissedIdState(announcement.id)
  }

  if (!announcement || !announcement.message) return null
  if (announcement.id === dismissedId) return null

  return (
    <div 
      className="px-4 py-3 text-sm text-center font-medium border-b flex items-center justify-center gap-2 relative"
      style={{
        paddingTop: isMobile ? '0.25rem' : '0.75rem',
        paddingBottom: isMobile ? '0.25rem' : '0.75rem',
        color: announcement.text_color,
        backgroundColor: announcement.background_color
      }}
    >
      <span className="flex-1">{announcement.message}</span>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 p-1 rounded hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-1"
        style={{ color: announcement.text_color }}
        aria-label="Dismiss announcement"
      >
        X
      </button>
    </div>
  )
}

