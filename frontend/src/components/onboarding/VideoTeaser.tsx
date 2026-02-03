import { useState, useRef } from 'react'

interface VideoTeaserProps {
  videoUrl: string
  label: string
}

/** Extract YouTube video ID from various URL formats */
function getYouTubeEmbedUrl(url: string): string | null {
  try {
    // youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (watchMatch) {
      return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=1`
    }
    // Already embed format
    if (url.includes('youtube.com/embed/')) {
      const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
      if (embedMatch) {
        return url.includes('?') ? `${url}&autoplay=1` : `${url}?autoplay=1`
      }
    }
    return null
  } catch {
    return null
  }
}

export function VideoTeaser({ videoUrl, label }: VideoTeaserProps) {
  const [showPlayer, setShowPlayer] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const youtubeEmbedUrl = getYouTubeEmbedUrl(videoUrl)
  const isYouTube = !!youtubeEmbedUrl

  const handleClick = () => {
    setShowPlayer(true)
    // Lazy-load: set src only on first click (for direct video URLs)
    if (!isYouTube) {
      setTimeout(() => {
        if (videoRef.current && !videoRef.current.src) {
          videoRef.current.src = videoUrl
        }
      }, 0)
    }
  }

  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.src = ''
    }
    setShowPlayer(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#4fc3f7] hover:bg-gray-50 transition text-left w-full"
      >
        <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl text-gray-600">▶</span>
        </div>
        <span className="font-medium text-gray-800">{label}</span>
      </button>

      {showPlayer && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[300] p-4"
          onClick={(e) => {
            // Click outside does NOT close per spec
            e.stopPropagation()
          }}
        >
          <div
            className="relative bg-black rounded-lg overflow-hidden max-w-2xl w-full aspect-video"
            onClick={(e) => e.stopPropagation()}
          >
            {isYouTube ? (
              <iframe
                src={youtubeEmbedUrl!}
                title="Onboarding video"
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                ref={videoRef}
                controls
                playsInline
                className="w-full"
                onEnded={() => {}}
              />
            )}
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-2 right-2 w-10 h-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full flex items-center justify-center text-xl transition z-10"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}
