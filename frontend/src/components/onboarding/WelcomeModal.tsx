import { useState, useEffect, useRef } from 'react'
import { welcomeModal } from '../../utils/onboardingStrings'
import { setOnboardingSeen, setOnboardingNeverShow } from '../../utils/onboardingStorage'
import { VideoTeaser } from './VideoTeaser'
import { api } from '../../utils/api'

interface WelcomeModalProps {
  onClose: () => void
  onStartTutorial: () => void
  skipSetsSeen?: boolean
}

export function WelcomeModal({
  onClose,
  onStartTutorial,
  skipSetsSeen = true,
}: WelcomeModalProps) {
  const [neverShow, setNeverShow] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getOnboardingVideoUrl()
      .then(({ url }) => setVideoUrl(url || ''))
      .catch(() => setVideoUrl(import.meta.env.VITE_ONBOARDING_VIDEO_URL || ''))
  }, [])

  const handleClose = () => {
    if (skipSetsSeen) {
      setOnboardingSeen()
    }
    if (neverShow) {
      setOnboardingNeverShow()
    }
    onClose()
  }

  const handleSkip = () => {
    setOnboardingSeen()
    if (neverShow) {
      setOnboardingNeverShow()
    }
    onClose()
  }

  const handleStartTutorial = () => {
    setOnboardingSeen()
    if (neverShow) {
      setOnboardingNeverShow()
    }
    onClose()
    onStartTutorial()
  }

  // Focus trap
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const focusables = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    first?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
        return
      }
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4"
      onClick={(e) => {
        // Click outside does NOT close
        e.stopPropagation()
      }}
    >
      <div
        ref={contentRef}
        className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
      >
        <div className="bg-[#4a6c7a] text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
          <h2 id="welcome-modal-title" className="text-xl font-bold">
            {welcomeModal.title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-2xl hover:text-gray-300 leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-lg font-semibold text-gray-800">
            {welcomeModal.oneLiner}
          </p>
          <p className="text-gray-700">{welcomeModal.body}</p>

          <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
            {welcomeModal.bullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>

          <p className="font-medium text-[#4a6c7a]">
            {welcomeModal.tutorialLink}
          </p>

          {videoUrl && (
            <VideoTeaser videoUrl={videoUrl} label={welcomeModal.videoLabel} />
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleStartTutorial}
              className="flex-1 px-4 py-3 bg-[#4fc3f7] hover:bg-[#3ba3d7] text-white font-medium rounded-lg transition"
            >
              {welcomeModal.buttons.primary}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-3 text-gray-600 hover:text-gray-800 font-medium transition"
            >
              {welcomeModal.buttons.tertiary}
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
            <input
              type="checkbox"
              checked={neverShow}
              onChange={(e) => setNeverShow(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            {welcomeModal.checkbox}
          </label>

          <p className="text-xs text-gray-500">{welcomeModal.footnote}</p>
        </div>
      </div>
    </div>
  )
}
