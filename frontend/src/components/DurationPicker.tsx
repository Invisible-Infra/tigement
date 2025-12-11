import { useState, useEffect, useRef } from 'react'

interface DurationPickerProps {
  value: number // minutes
  onChange: (minutes: number) => void
  onClose: () => void
  presets?: number[]
}

export function DurationPicker({ value, onChange, onClose, presets }: DurationPickerProps) {
  const [hours, setHours] = useState(Math.floor(value / 60))
  const [minutes, setMinutes] = useState(value % 60)
  const onChangeRef = useRef(onChange)
  
  // Keep onChange ref up to date
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    // Update parent on every change, but only if value actually changed
    const newValue = hours * 60 + minutes
    if (newValue !== value) {
      onChangeRef.current(newValue)
    }
  }, [hours, minutes, value]) // value is used for comparison, not onChange

  const incrementHours = () => setHours(prev => Math.min(prev + 1, 23))
  const decrementHours = () => setHours(prev => Math.max(prev - 1, 0))
  const incrementMinutes = () => setMinutes(prev => prev >= 59 ? 0 : prev + 1)
  const decrementMinutes = () => setMinutes(prev => prev <= 0 ? 59 : prev - 1)
  const add15Minutes = () => {
    const totalMinutes = hours * 60 + minutes + 15
    setHours(Math.min(Math.floor(totalMinutes / 60), 23))
    setMinutes(totalMinutes % 60)
  }
  const subtract15Minutes = () => {
    const totalMinutes = Math.max(hours * 60 + minutes - 15, 0)
    setHours(Math.floor(totalMinutes / 60))
    setMinutes(totalMinutes % 60)
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-white rounded-lg shadow-xl p-6 max-w-xs w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Select Duration</h3>
        
        <div className="flex items-center justify-center gap-4 mb-6">
          {/* Hours picker */}
          <div className="flex flex-col items-center">
            <button
              onClick={incrementHours}
              className="w-12 h-12 flex items-center justify-center bg-[#4fc3f7] text-white rounded-lg hover:bg-[#0288d1] active:bg-[#0277bd] text-2xl font-bold"
            >
              ▲
            </button>
            <input
              type="text"
              value={hours.toString().padStart(2, '0')}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                if (!isNaN(val) && val >= 0 && val <= 23) setHours(val)
              }}
              onWheel={(e) => {
                e.preventDefault()
                if (e.deltaY < 0) incrementHours()
                else decrementHours()
              }}
              className="my-3 text-4xl font-bold text-gray-800 w-[60px] text-center bg-transparent border-none outline-none focus:bg-gray-100 rounded"
            />
            <button
              onClick={decrementHours}
              className="w-12 h-12 flex items-center justify-center bg-[#4fc3f7] text-white rounded-lg hover:bg-[#0288d1] active:bg-[#0277bd] text-2xl font-bold"
            >
              ▼
            </button>
            <span className="text-sm text-gray-500 mt-2">hours</span>
          </div>

          <div className="text-4xl font-bold text-gray-400 mb-8">:</div>

          {/* Minutes picker */}
          <div className="flex flex-col items-center">
            <button
              onClick={incrementMinutes}
              className="w-12 h-12 flex items-center justify-center bg-[#4fc3f7] text-white rounded-lg hover:bg-[#0288d1] active:bg-[#0277bd] text-2xl font-bold"
            >
              ▲
            </button>
            <input
              type="text"
              value={minutes.toString().padStart(2, '0')}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                if (!isNaN(val) && val >= 0 && val <= 59) setMinutes(val)
              }}
              onWheel={(e) => {
                e.preventDefault()
                if (e.deltaY < 0) incrementMinutes()
                else decrementMinutes()
              }}
              className="my-3 text-4xl font-bold text-gray-800 w-[60px] text-center bg-transparent border-none outline-none focus:bg-gray-100 rounded"
            />
            <button
              onClick={decrementMinutes}
              className="w-12 h-12 flex items-center justify-center bg-[#4fc3f7] text-white rounded-lg hover:bg-[#0277bd] active:bg-[#0277bd] text-2xl font-bold"
            >
              ▼
            </button>
            <span className="text-sm text-gray-500 mt-2">minutes</span>
          </div>
        </div>

        {/* Quick adjust buttons */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={subtract15Minutes}
            className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-sm"
          >
            -15 min
          </button>
          <button
            onClick={add15Minutes}
            className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium text-sm"
          >
            +15 min
          </button>
        </div>

        {/* Quick select buttons (presets) */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {(presets && presets.length ? presets : [15,30,60,120]).map((m) => (
            <button
              key={`preset-${m}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                // Update the duration immediately
                onChange(m)
                // Update local state for consistency
                const h = Math.floor(m / 60)
                const min = m % 60
                setHours(h)
                setMinutes(min)
                // Close after ensuring the update propagates
                // Use a small delay to let React process the state update
                setTimeout(() => {
                  onClose()
                }, 50)
              }}
              className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700"
            >
              {m < 60 ? `${m}m` : (m % 60 === 0 ? `${m/60}h` : `${Math.floor(m/60)}h ${(m%60)}m`)}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-[#4fc3f7] text-white rounded-lg hover:bg-[#0288d1] font-medium"
        >
          Done
        </button>
      </div>
    </div>
  )
}

