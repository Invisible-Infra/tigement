import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { flashFavicon } from '../utils/faviconNotification'

interface Task {
  id: string
  title: string
  duration: number
  selected: boolean
}

interface Table {
  id: string
  type: 'day' | 'list'
  title: string
  date?: string
  startTime?: string
  tasks: Task[]
  position: { x: number; y: number }
}

interface TimerProps {
  onClose: () => void
  tables: Table[]
  position?: { x: number; y: number }
  onPositionChange?: (pos: { x: number; y: number }) => void
}

export function Timer({ onClose, tables, position = { x: window.innerWidth - 350, y: Math.max(20, window.innerHeight - 420) }, onPositionChange }: TimerProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [visualEnabled, setVisualEnabled] = useState(true)
  const [lastNotifiedTask, setLastNotifiedTask] = useState<string | null>(null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const timerRef = useRef<HTMLDivElement | null>(null)
  const [modalSize, setModalSize] = useState<{ width: number; height: number }>({ width: 320, height: 400 })

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Measure actual rendered size (settings section makes this taller than the old estimate).
  useLayoutEffect(() => {
    const el = timerRef.current
    if (!el) return
    const next = { width: el.offsetWidth || 320, height: el.offsetHeight || 400 }
    setModalSize(prev => (prev.width === next.width && prev.height === next.height ? prev : next))
  }, [soundEnabled, visualEnabled])

  // Helper function to constrain position within viewport bounds
  const constrainPosition = useCallback((x: number, y: number): { x: number; y: number } => {
    const padding = 20 // Keep some padding from edges

    const vv = window.visualViewport
    const viewportWidth = vv?.width ?? window.innerWidth
    const viewportHeight = vv?.height ?? window.innerHeight

    const safeX = Number.isFinite(x) ? x : viewportWidth - 350
    const safeY = Number.isFinite(y) ? y : Math.max(padding, viewportHeight - 420)

    // Mobile has a fixed bottom nav + (sometimes) a pagination bar above it.
    // Reserve extra space so the timer doesn't get clamped under those fixed UI bars.
    const bottomReserved = viewportWidth < 768 ? 220 : padding
    const maxX = viewportWidth - modalSize.width - padding
    const maxY = viewportHeight - modalSize.height - bottomReserved

    return {
      x: Math.max(padding, Math.min(safeX, maxX)),
      y: Math.max(padding, Math.min(safeY, maxY))
    }
  }, [modalSize.height, modalSize.width])

  // Clamp saved position into the current viewport on mount (resize alone misses first paint on a new viewport size, e.g. mobile after desktop).
  useLayoutEffect(() => {
    if (!onPositionChange) return
    const constrained = constrainPosition(position.x, position.y)
    if (constrained.x !== position.x || constrained.y !== position.y) {
      onPositionChange(constrained)
    }
  }, [position.x, position.y, onPositionChange, constrainPosition])

  // Drag handling
  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }
  
  useEffect(() => {
    if (!isDragging) return
    
    const handleMouseMove = (e: MouseEvent) => {
      const newPos = constrainPosition(
        e.clientX - dragOffset.x,
        e.clientY - dragOffset.y
      )
      onPositionChange?.(newPos)
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, onPositionChange, constrainPosition])

  // Constrain position on window resize and device rotation
  useEffect(() => {
    const handleViewportChange = () => {
      const constrained = constrainPosition(position.x, position.y)
      if (constrained.x !== position.x || constrained.y !== position.y) {
        onPositionChange?.(constrained)
      }
    }

    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('orientationchange', handleViewportChange)
    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('orientationchange', handleViewportChange)
    }
  }, [position.x, position.y, onPositionChange, constrainPosition])

  // Initialize AudioContext when Timer mounts
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (AudioContextClass) {
      const ctx = new AudioContextClass()
      setAudioContext(ctx)
      console.log('✅ Timer AudioContext initialized')
      
      return () => {
        ctx.close()
        console.log('🔇 Timer AudioContext closed')
      }
    }
  }, [])

  const addMinutes = (time: string, minutes: number): Date => {
    const [h, m] = time.split(':').map(Number)
    const date = new Date()
    date.setHours(h, m, 0, 0)
    date.setMinutes(date.getMinutes() + minutes)
    return date
  }

  const findCurrentTask = () => {
    const now = currentTime
    const todayDate = now.toISOString().split('T')[0]

    // Look through all day tables
    for (const table of tables) {
      if (table.type !== 'day' || !table.startTime) continue
      
      // Check if this table is for today (or has today's date)
      const isToday = !table.date || table.date === todayDate

      if (isToday && table.tasks.length > 0) {
        let currentTaskTime = table.startTime
        
        for (const task of table.tasks) {
          const taskStart = new Date()
          const [startH, startM] = currentTaskTime.split(':').map(Number)
          taskStart.setHours(startH, startM, 0, 0)
          
          const taskEnd = addMinutes(currentTaskTime, task.duration)
          
          // Check if current time is within this task's time range
          if (now >= taskStart && now < taskEnd) {
            const remainingMs = taskEnd.getTime() - now.getTime()
            const remainingSeconds = remainingMs / 1000
            
            return {
              task,
              table,
              remainingSeconds,
              taskStart,
              taskEnd
            }
          }
          
          // Move to next task's start time
          currentTaskTime = `${taskEnd.getHours().toString().padStart(2, '0')}:${taskEnd.getMinutes().toString().padStart(2, '0')}`
        }
      }
    }
    
    return null
  }

  const findNextTask = () => {
    const now = currentTime
    const todayDate = now.toISOString().split('T')[0]
    
    const dayTables = tables.filter(t => t.type === 'day')
    
    for (const table of dayTables) {
      if (!table.startTime) continue
      const isToday = !table.date || table.date === todayDate
      if (!isToday) continue
      
      let accumulatedMinutes = 0
      
      for (const task of table.tasks) {
        const taskStart = addMinutes(table.startTime, accumulatedMinutes)
        const taskEnd = addMinutes(table.startTime, accumulatedMinutes + task.duration)
        
        if (taskStart > now) {
          return {
            task,
            table,
            taskStart,
            taskEnd
          }
        }
        
        accumulatedMinutes += task.duration
      }
    }
    
    return null
  }

  const currentTaskInfo = findCurrentTask()
  const nextTaskInfo = findNextTask()

  // Play notification sound when task ends
  useEffect(() => {
    if (currentTaskInfo) {
      // Calculate remaining time in seconds for more precise detection
      const now = currentTime
      const remainingMs = currentTaskInfo.taskEnd.getTime() - now.getTime()
      const remainingSeconds = Math.floor(remainingMs / 1000)
      
      // Trigger notification when task ends (0 or negative seconds remaining)
      // OR when we're in the last few seconds (to catch it before jumping to next task)
      if (remainingSeconds <= 0 && lastNotifiedTask !== currentTaskInfo.task.id) {
        console.log('⏰ Task ended! Remaining seconds:', remainingSeconds)
        
        // Show browser notification (works in background)
        if ('Notification' in window && Notification.permission === 'granted') {
          const notification = new Notification('Task Completed', {
            body: currentTaskInfo.task.title,
            icon: '/favicon.svg',
            tag: 'task-notification',
            requireInteraction: false,
            silent: false
          })
          
          // Auto-close after 10 seconds
          setTimeout(() => notification.close(), 10000)
        }
        
        // Task time is up!
        if (soundEnabled) {
          console.log('🔔 Playing notification sound for task:', currentTaskInfo.task.title)
          playNotificationSound()
        }
        if (visualEnabled) {
          console.log('👁️ Showing visual notification for task:', currentTaskInfo.task.title)
          // Flash favicon to notify user
          flashFavicon(5)
        }
        setLastNotifiedTask(currentTaskInfo.task.id)
      }
    }
  }, [currentTaskInfo, soundEnabled, visualEnabled, lastNotifiedTask, currentTime])

  // Initialize AudioContext on first user interaction
  const initAudioContext = () => {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContextClass) {
        const ctx = new AudioContextClass()
        setAudioContext(ctx)
        console.log('✅ AudioContext initialized')
        return ctx
      }
    }
    return audioContext
  }

  const playNotificationSound = async () => {
    try {
      // Check if AudioContext is initialized (requires user interaction first)
      if (!audioContext) {
        console.warn('⚠️ AudioContext not initialized. User must interact with the page first.')
        return
      }

      console.log('🔊 AudioContext state:', audioContext.state)
      
      // Resume audio context if suspended (required by some browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
        console.log('✅ AudioContext resumed')
      }
      
      // Play three beeps
      const beep = (delay: number) => {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = 800
        oscillator.type = 'sine'

        const startTime = audioContext.currentTime + delay
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01)
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2)

        oscillator.start(startTime)
        oscillator.stop(startTime + 0.2)
      }

      // Three beeps with 0.25s intervals
      beep(0)
      beep(0.25)
      beep(0.5)
      
      console.log('🎵 Sound played successfully')
    } catch (error) {
      console.error('❌ Failed to play notification sound:', error)
    }
  }

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = Math.floor(totalSeconds % 60)
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatClockTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  return (
    <div 
      ref={timerRef}
      className="fixed bg-white rounded-lg shadow-2xl w-80 z-50 border-2 border-gray-200"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      <div 
        className="bg-[#4a6c7a] text-white px-4 py-3 rounded-t-lg flex justify-between items-center cursor-move"
        onMouseDown={handleDragStart}
      >
        <h3 className="font-bold">⏱️ Current Task Timer</h3>
        <button onClick={onClose} className="text-xl hover:text-gray-300 cursor-pointer" onMouseDown={(e) => e.stopPropagation()}>&times;</button>
      </div>

      <div className="p-6">
        {currentTaskInfo ? (
          <>
            {/* Current Task Info */}
            <div className="mb-4">
              <div className="text-sm text-gray-500 mb-1">Current Task:</div>
              <div className="font-semibold text-gray-800 text-lg">{currentTaskInfo.task.title || '(Unnamed task)'}</div>
              <div className="text-sm text-gray-500 mt-1">
                {formatClockTime(currentTaskInfo.taskStart)} - {formatClockTime(currentTaskInfo.taskEnd)}
              </div>
            </div>

            {/* Time Remaining */}
            <div className={`text-5xl font-mono text-center mb-4 ${currentTaskInfo.remainingSeconds <= 300 && visualEnabled ? 'text-red-500 animate-pulse' : 'text-[#4fc3f7]'}`}>
              {formatTime(currentTaskInfo.remainingSeconds)}
            </div>

            <div className="text-center text-sm text-gray-500">
              remaining
            </div>

            {/* Next Task Preview */}
            {nextTaskInfo && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs text-gray-400 mb-1">Next:</div>
                <div className="text-sm text-gray-600">
                  {nextTaskInfo.task.title || '(Unnamed task)'}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatClockTime(nextTaskInfo.taskStart)} - {formatClockTime(nextTaskInfo.taskEnd)}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-8 text-center">
            <div className="text-4xl mb-4">🌟</div>
            <div className="text-gray-600 text-lg">No active task right now</div>
            <div className="text-gray-400 text-sm mt-2">Enjoy your free time!</div>
          </div>
        )}

        {/* Settings */}
        <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
              className="w-4 h-4 text-[#4fc3f7] rounded focus:ring-2 focus:ring-[#4fc3f7]"
            />
            <span className="text-sm text-gray-700">🔔 Sound notification</span>
            {soundEnabled && !audioContext && (
              <span className="text-xs text-orange-600" title="Click 'Test Sound' to enable">⚠️</span>
            )}
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={visualEnabled}
              onChange={(e) => setVisualEnabled(e.target.checked)}
              className="w-4 h-4 text-[#4fc3f7] rounded focus:ring-2 focus:ring-[#4fc3f7]"
            />
            <span className="text-sm text-gray-700">👁️ Visual notification</span>
          </label>
          
          {/* Test Sound Button */}
          <button
            onClick={() => {
              console.log('🧪 Testing notification sound...')
              // Initialize audio context on user click (required by browsers)
              initAudioContext()
              playNotificationSound()
            }}
            className="w-full mt-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded transition"
          >
            🔊 Test Sound
          </button>
        </div>

        {/* Current Time */}
        <div className="mt-4 text-center text-xs text-gray-400">
          Current time: {formatClockTime(currentTime)}
        </div>
      </div>
    </div>
  )
}
