import { useState, useEffect, useRef } from 'react'
import { normalizeDate, formatDateWithSettings } from '../utils/dateFormat'

interface DateInputProps {
  value: string // YYYY-MM-DD format
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  id?: string
  showCalendarButton?: boolean
}

export function DateInput({ value, onChange, className = '', placeholder, id, showCalendarButton = true }: DateInputProps) {
  const [displayValue, setDisplayValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const nativeInputRef = useRef<HTMLInputElement>(null)

  // Update display value when prop changes (but not while user is typing)
  useEffect(() => {
    if (!isFocused && value) {
      const formatted = formatDateWithSettings(value)
      setDisplayValue(formatted)
    }
  }, [value, isFocused])

  // Initialize display value
  useEffect(() => {
    if (value) {
      const formatted = formatDateWithSettings(value)
      setDisplayValue(formatted)
    } else {
      setDisplayValue('')
    }
  }, [])

  const handleFocus = () => {
    setIsFocused(true)
    // Show native date picker on mobile
    if (window.innerWidth < 768 && nativeInputRef.current) {
      nativeInputRef.current.showPicker?.()
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    // Validate and normalize the input
    if (displayValue.trim()) {
      const normalized = normalizeDate(displayValue)
      if (normalized) {
        setDisplayValue(formatDateWithSettings(normalized))
        if (normalized !== value) {
          onChange(normalized)
        }
      } else {
        // Invalid date, revert to current value
        if (value) {
          setDisplayValue(formatDateWithSettings(value))
        } else {
          setDisplayValue('')
        }
      }
    } else {
      // Empty input - clear the date
      if (value) {
        onChange('')
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setDisplayValue(inputValue)
    
    // Try to parse as user types
    const normalized = normalizeDate(inputValue)
    if (normalized && normalized !== value) {
      onChange(normalized)
    }
  }

  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nativeValue = e.target.value // YYYY-MM-DD from native picker
    if (nativeValue && nativeValue !== value) {
      onChange(nativeValue)
    }
  }

  const handleCalendarClick = () => {
    // On desktop, show native date picker
    if (nativeInputRef.current) {
      nativeInputRef.current.showPicker?.()
    }
  }

  return (
    <div className="relative flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder || formatDateWithSettings(new Date().toISOString().split('T')[0])}
        className={className}
        id={id}
      />
      {/* Hidden native date input for mobile/calendar picker */}
      <input
        ref={nativeInputRef}
        type="date"
        value={value || ''}
        onChange={handleNativeDateChange}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        aria-hidden="true"
      />
      {showCalendarButton && (
        <button
          type="button"
          onClick={handleCalendarClick}
          className="text-gray-500 hover:text-gray-700 cursor-pointer"
          title="Open date picker"
        >
          📅
        </button>
      )}
    </div>
  )
}

