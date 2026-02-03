import { useEffect, useRef, useState } from 'react'
import { tutorialSteps, tutorialButtons } from '../../utils/onboardingStrings'

interface TutorialOverlayProps {
  step: number
  totalSteps: number
  onBack: () => void
  onNext: () => void
  onSkip: () => void
  canProceed: boolean
  targetSelector?: string
  isInfoStep?: boolean
  isMobile?: boolean
  /** Override step number for display (e.g. when steps are skipped on mobile) */
  stepDisplay?: number
  /** Override total for display (e.g. when steps are skipped on mobile) */
  totalStepsDisplay?: number
  /** Custom buttons for the final step (e.g. Create Day, Open Timer, Finish) */
  finalStepButtons?: React.ReactNode
}

export function TutorialOverlay({
  step,
  totalSteps,
  onBack,
  onNext,
  onSkip,
  canProceed,
  targetSelector,
  isInfoStep = false,
  isMobile = false,
  stepDisplay,
  totalStepsDisplay,
  finalStepButtons,
}: TutorialOverlayProps) {
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)
  const skipRef = useRef<HTMLButtonElement>(null)

  const stepData = tutorialSteps[step]
  const displayTitle = isMobile && stepData.titleMobile ? stepData.titleMobile : stepData.title
  const displayText = isMobile && stepData.textMobile ? stepData.textMobile : stepData.text

  // Update highlight when target or step changes
  useEffect(() => {
    if (!targetSelector) {
      setHighlightRect(null)
      return
    }
    const el = document.querySelector(`[data-tutorial-target="${targetSelector}"]`)
    if (!el) {
      setHighlightRect(null)
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const updateRect = () => {
      const rect = el.getBoundingClientRect()
      setHighlightRect(rect)
    }
    updateRect()
    const ro = new ResizeObserver(updateRect)
    ro.observe(el)
    return () => ro.disconnect()
  }, [targetSelector, step])

  // Info step: no auto-advance - user clicks Next when ready to read

  // Focus Skip by default for quick exit
  useEffect(() => {
    skipRef.current?.focus()
  }, [step])

  return (
    <>
      {/* Semi-transparent backdrop */}
      <div
        className="fixed inset-0 z-[180] pointer-events-none"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      />

      {/* Highlight cutout around target */}
      {highlightRect && (
        <div
          className="fixed z-[181] pointer-events-none border-2 border-[#4fc3f7] rounded-lg shadow-lg"
          style={{
            left: highlightRect.left - 4,
            top: highlightRect.top - 4,
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)',
          }}
        />
      )}

      {/* Content card - on mobile: bottom sheet (always in view); desktop: near target or top-center */}
      <div
        className="fixed z-[182] left-4 right-4 md:max-w-md bg-white rounded-lg shadow-2xl p-4 border border-gray-200 pointer-events-auto overflow-y-auto"
        role="dialog"
        aria-live="polite"
        aria-label={`Tutorial step ${step + 1} of ${totalSteps}`}
        style={
          isMobile && typeof window !== 'undefined'
            ? targetSelector === 'tutorial-table-dropdown'
              ? {
                  left: 16,
                  right: 16,
                  top: 72,
                  bottom: 'auto',
                  maxHeight: 'min(40vh, 280px)',
                }
              : {
                  left: 16,
                  right: 16,
                  bottom: 16,
                  top: 'auto',
                  maxHeight: 'min(50vh, 320px)',
                }
            : highlightRect && typeof window !== 'undefined'
            ? {
                bottom: window.innerHeight - highlightRect.top + 16,
                left: Math.max(16, Math.min(highlightRect.left, window.innerWidth - 420)),
                right: 'auto',
                top: 'auto',
              }
            : {
                top: 72,
                left: '50%',
                right: 'auto',
                bottom: 'auto',
                transform: 'translateX(-50%)',
                maxWidth: '28rem',
                marginLeft: 0,
                marginRight: 0,
              }
        }
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{displayTitle}</h3>
        <p className="text-gray-700 text-sm mb-4">{displayText}</p>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          {step === totalSteps - 1 && finalStepButtons ? (
            finalStepButtons
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  disabled={step === 0}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded transition"
                >
                  {tutorialButtons.back}
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!canProceed && !isInfoStep}
                  className="px-3 py-2 text-sm font-medium text-white bg-[#4fc3f7] hover:bg-[#3ba3d7] disabled:opacity-50 disabled:cursor-not-allowed rounded transition"
                >
                  {step === totalSteps - 1 ? tutorialButtons.finish : tutorialButtons.next}
                </button>
              </div>
              <button
                ref={skipRef}
                type="button"
                onClick={onSkip}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition"
              >
                {tutorialButtons.skip}
              </button>
            </>
          )}
        </div>

        <div className="mt-2 text-xs text-gray-500">
          Step {stepDisplay ?? step + 1} of {totalStepsDisplay ?? totalSteps}
        </div>
      </div>
    </>
  )
}
