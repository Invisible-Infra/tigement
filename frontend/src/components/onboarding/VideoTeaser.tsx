import { useState, useRef } from 'react'

interface VideoTeaserProps {
  videoUrl: string
  label: string
}

/** Get YouTube thumbnail URL (hqdefault 360p) from various URL formats */
function getYouTubeThumbnailUrl(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null
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
  const [sizePercent, setSizePercent] = useState(80)
  const videoRef = useRef<HTMLVideoElement>(null)

  const youtubeEmbedUrl = getYouTubeEmbedUrl(videoUrl)
  const youtubeThumbnailUrl = getYouTubeThumbnailUrl(videoUrl)
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
        className="flex flex-col p-4 rounded-lg border-2 border-gray-200 hover:border-[#4fc3f7] hover:bg-gray-50 transition text-left w-full"
      >
        <div className="relative w-full aspect-video min-h-[120px] rounded-lg overflow-hidden bg-gray-200">
          {isYouTube && youtubeThumbnailUrl ? (
            <img
              src={youtubeThumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              preload="metadata"
              muted
              playsInline
              src={videoUrl}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
              <span className="text-2xl text-white ml-1">▶</span>
            </div>
          </div>
        </div>
        <span className="font-medium text-gray-800 mt-2">{label}</span>
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
            style={{
              width: `${sizePercent}vw`,
              maxWidth: '100vw',
            }}
            className="relative bg-black rounded-lg overflow-hidden max-h-[90vh] aspect-video"
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
              className="absolute top-2 right-2 w-10 h-10 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full flex items-center justify-center text-xl transition z-10"
              aria-label="Close"
            >
              ×
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 px-4 py-2 flex items-center justify-center gap-4 z-10">
              <button
                type="button"
                onClick={() =>
                  setSizePercent((prev) => {
                    const next = prev - 10
                    return next < 60 ? 60 : next
                  })
                }
                className="px-4 py-2 bg-white text-black rounded-md font-semibold shadow-md hover:bg-gray-100 transition"
                aria-label="Decrease video size"
              >
                Zoom −
              </button>
              <button
                type="button"
                onClick={() =>
                  setSizePercent((prev) => {
                    const next = prev + 10
                    return next > 100 ? 100 : next
                  })
                }
                className="px-4 py-2 bg-white text-black rounded-md font-semibold shadow-md hover:bg-gray-100 transition"
                aria-label="Increase video size"
              >
                Zoom +
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
