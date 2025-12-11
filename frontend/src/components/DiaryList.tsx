import { useState, useRef, useEffect } from 'react'
import { formatDateDisplay, isValidDateFormat } from '../utils/dateFormat'
import { DateInput } from './DateInput'

interface DiaryEntry {
  date: string
  preview: string
}

interface DiaryListProps {
  entries: DiaryEntry[]
  position: { x: number; y: number }
  onSelectEntry: (date: string) => void
  onCreateEntry: (date: string) => void
  onClose: () => void
  onPositionChange: (position: { x: number; y: number }) => void
  zoom?: number
}

export function DiaryList({
  entries,
  position,
  onSelectEntry,
  onCreateEntry,
  onClose,
  onPositionChange,
  zoom = 1
}: DiaryListProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const [newEntryDate, setNewEntryDate] = useState(() => {
    // Default to today's date in YYYY-MM-DD format
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const listRef = useRef<HTMLDivElement>(null)

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (listRef.current && e.target === e.currentTarget) {
      setIsDragging(true)
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      onPositionChange({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  const formatDateDisplayLocal = (dateStr: string): string => {
    // Validate date format first to prevent "Invalid Date"
    if (!isValidDateFormat(dateStr)) {
      console.warn('Invalid date format in DiaryList:', dateStr)
      return 'Invalid Date'
    }
    return formatDateDisplay(dateStr)
  }

  const handleCreateEntry = () => {
    if (newEntryDate) {
      onCreateEntry(newEntryDate)
    }
  }

  // Sort entries by date (newest first)
  const sortedEntries = [...entries].sort((a, b) => {
    return b.date.localeCompare(a.date)
  })

  // Calculate responsive dimensions
  const listWidth = isMobile ? '95vw' : '400px'
  const listHeight = isMobile ? '90vh' : '500px'
  const listLeft = isMobile ? '2.5vw' : `${position.x}px`
  const listTop = isMobile ? '5vh' : `${position.y}px`
  const listPosition = isMobile ? 'fixed' : 'absolute'

  return (
    <div
      ref={listRef}
      className="bg-white rounded-lg shadow-2xl border-2 border-gray-300"
      style={{
        position: listPosition as any,
        left: listLeft,
        top: listTop,
        width: listWidth,
        height: listHeight,
        maxWidth: isMobile ? '95vw' : '400px',
        maxHeight: isMobile ? '90vh' : '500px',
        transform: isMobile ? 'none' : `scale(${zoom})`,
        transformOrigin: 'top left',
        zIndex: 9999
      }}
    >
      {/* Header - draggable */}
      <div
        className="bg-indigo-600 text-white px-4 py-2 rounded-t-lg flex justify-between items-center cursor-move"
        onMouseDown={handleMouseDown}
      >
        <h3 className="text-sm font-bold">Diary Entries</h3>
        <button
          onClick={onClose}
          className="text-xl hover:text-gray-300 px-1"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col" style={{ height: 'calc(100% - 40px)' }}>
        {/* New Entry Section */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <DateInput
              value={newEntryDate}
              onChange={(newDate) => setNewEntryDate(newDate)}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
            />
            <button
              onClick={handleCreateEntry}
              className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition text-sm"
            >
              New Entry
            </button>
          </div>
        </div>

        {/* Entries List */}
        <div className="flex-1 overflow-y-auto">
          {sortedEntries.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No diary entries yet. Create one above!
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {sortedEntries.map((entry) => (
                <button
                  key={entry.date}
                  onClick={() => onSelectEntry(entry.date)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition"
                >
                  <div className="font-semibold text-sm text-gray-900 mb-1">
                    {formatDateDisplayLocal(entry.date)}
                  </div>
                  <div className="text-xs text-gray-600 line-clamp-2">
                    {entry.preview || '(empty)'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

