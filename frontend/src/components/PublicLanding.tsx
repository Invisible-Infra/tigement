import { useState, useEffect } from 'react'
import { welcomeModal, publicLanding } from '../utils/onboardingStrings'
import { VideoTeaser } from './onboarding/VideoTeaser'
import { api } from '../utils/api'

interface PublicLandingProps {
  onStartTutorial: () => void
  onRegister: () => void
  onLogin: () => void
}

export function PublicLanding({
  onStartTutorial,
  onRegister,
  onLogin,
}: PublicLandingProps) {
  const [videoUrl, setVideoUrl] = useState('')

  useEffect(() => {
    api
      .getOnboardingVideoUrl()
      .then(({ url }) => setVideoUrl(url || ''))
      .catch(() => setVideoUrl(import.meta.env.VITE_ONBOARDING_VIDEO_URL || ''))
  }, [])

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-[#4a6c7a] text-white px-6 py-4">
            <h1 className="text-xl font-bold">{welcomeModal.title}</h1>
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
              <VideoTeaser
                videoUrl={videoUrl}
                label={welcomeModal.videoLabel}
              />
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={onStartTutorial}
                className="px-4 py-3 bg-[#4fc3f7] hover:bg-[#3ba3d7] text-white font-medium rounded-lg transition"
              >
                {welcomeModal.buttons.primary}
              </button>
              <button
                type="button"
                onClick={onRegister}
                className="px-4 py-3 bg-[#4a6c7a] hover:bg-[#3a5c6a] text-white font-medium rounded-lg transition"
              >
                {publicLanding.getStarted}
              </button>
              <button
                type="button"
                onClick={onLogin}
                className="px-4 py-3 bg-white text-[#4a6c7a] hover:bg-gray-100 border border-[#4a6c7a] font-medium rounded-lg transition"
              >
                {publicLanding.login}
              </button>
            </div>
            <p className="text-xs text-gray-500 pt-2">{welcomeModal.footnote}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
