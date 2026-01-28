/**
 * Admin Announcement Display Component
 * Polls for active announcements and displays them at the top of the app
 * Updates every 60 seconds without page reload
 */

import { useEffect, useState } from 'react'
import { api } from '../utils/api'

interface AnnouncementData {
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

  const fetchAnnouncement = async () => {
    try {
      const data = await api.getAnnouncement()
      if (data.enabled && data.message) {
        setAnnouncement(data)
      } else {
        setAnnouncement(null)
      }
    } catch (error) {
      console.error('Failed to fetch announcement:', error)
      // Don't show error to user - just fail silently
    }
  }

  useEffect(() => {
    // Fetch immediately
    fetchAnnouncement()
    
    // Poll every 60 seconds
    const interval = setInterval(fetchAnnouncement, 60000)
    
    return () => clearInterval(interval)
  }, [])

  if (!announcement || !announcement.message) return null

  return (
    <div 
      className="px-4 text-sm text-center font-medium border-b"
      style={{
        paddingTop: isMobile ? '0.25rem' : '0.75rem',
        paddingBottom: isMobile ? '0.25rem' : '0.75rem',
        color: announcement.text_color,
        backgroundColor: announcement.background_color
      }}
    >
      {announcement.message}
    </div>
  )
}

