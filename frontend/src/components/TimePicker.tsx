import { useState, useEffect, useRef } from 'react'

interface TimePickerProps {
  value: string // HH:MM in 24h format
  onChange: (time: string) => void
  onClose: () => void
  timeFormat: 12 | 24
}

export function TimePicker({ value, onChange, onClose, timeFormat }: TimePickerProps) {
  const [hours24, minutes] = value.split(':').map(Number)
  const [selectedHours, setSelectedHours] = useState(hours24)
  const [selectedMinutes, setSelectedMinutes] = useState(minutes)
  const prevValues = useRef({ hours: selectedHours, minutes: selectedMinutes })

  useEffect(() => {
    // Only update if values actually changed to prevent infinite loop
    if (prevValues.current.hours !== selectedHours || prevValues.current.minutes !== selectedMinutes) {
    const time24 = `${selectedHours.toString().padStart(2, '0')}:${selectedMinutes.toString().padStart(2, '0')}`
    onChange(time24)
      prevValues.current = { hours: selectedHours, minutes: selectedMinutes }
    }
  }, [selectedHours, selectedMinutes, onChange])

  const incrementHours = () => setSelectedHours(prev => prev >= 23 ? 0 : prev + 1)
  const decrementHours = () => setSelectedHours(prev => prev <= 0 ? 23 : prev - 1)
  const incrementMinutes = () => setSelectedMinutes(prev => prev >= 59 ? 0 : prev + 1)
  const decrementMinutes = () => setSelectedMinutes(prev => prev <= 0 ? 59 : prev - 1)
  const add15Minutes = () => {
    const totalMinutes = selectedHours * 60 + selectedMinutes + 15
    if (totalMinutes >= 24 * 60) {
      setSelectedHours(23)
      setSelectedMinutes(59)
    } else {
      setSelectedHours(Math.floor(totalMinutes / 60))
      setSelectedMinutes(totalMinutes % 60)
    }
  }
  const subtract15Minutes = () => {
    const totalMinutes = Math.max(selectedHours * 60 + selectedMinutes - 15, 0)
    setSelectedHours(Math.floor(totalMinutes / 60))
    setSelectedMinutes(totalMinutes % 60)
  }

  const formatHours = (hours: number): string => {
    if (timeFormat === 24) {
      return hours.toString().padStart(2, '0')
    }
    // 12h format
    const hours12 = hours % 12 || 12
    return hours12.toString().padStart(2, '0')
  }

  const getPeriod = (): string => {
    if (timeFormat === 24) return ''
    return selectedHours >= 12 ? 'PM' : 'AM'
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
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Select Time</h3>
        
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
              value={formatHours(selectedHours)}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                if (timeFormat === 24) {
                  if (!isNaN(val) && val >= 0 && val <= 23) setSelectedHours(val)
                } else {
                  if (!isNaN(val) && val >= 1 && val <= 12) {
                    const isPM = selectedHours >= 12
                    if (val === 12) {
                      setSelectedHours(isPM ? 12 : 0)
                    } else {
                      setSelectedHours(isPM ? val + 12 : val)
                    }
                  }
                }
              }}
              onWheel={(e) => {
                e.preventDefault()
                e.stopPropagation()
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
              value={selectedMinutes.toString().padStart(2, '0')}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                if (!isNaN(val) && val >= 0 && val <= 59) setSelectedMinutes(val)
              }}
              onWheel={(e) => {
                e.preventDefault()
                e.stopPropagation()
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

          {/* AM/PM for 12h format */}
          {timeFormat === 12 && (
            <div className="flex flex-col items-center ml-2">
              <button
                onClick={() => {
                  if (selectedHours < 12) {
                    setSelectedHours(selectedHours + 12)
                  } else {
                    setSelectedHours(selectedHours - 12)
                  }
                }}
                className="px-4 py-2 bg-[#4fc3f7] text-white rounded-lg hover:bg-[#0288d1] active:bg-[#0277bd] font-bold"
              >
                {getPeriod()}
              </button>
              <span className="text-sm text-gray-500 mt-2">period</span>
            </div>
          )}
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

        {/* Quick select buttons */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <button
            onClick={() => { setSelectedHours(6); setSelectedMinutes(0); }}
            className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700"
          >
            6:00
          </button>
          <button
            onClick={() => { setSelectedHours(8); setSelectedMinutes(0); }}
            className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700"
          >
            8:00
          </button>
          <button
            onClick={() => { setSelectedHours(12); setSelectedMinutes(0); }}
            className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700"
          >
            12:00
          </button>
          <button
            onClick={() => { setSelectedHours(18); setSelectedMinutes(0); }}
            className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700"
          >
            18:00
          </button>
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

