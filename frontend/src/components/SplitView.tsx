import { useState, useRef, useEffect } from 'react'

interface SplitViewProps {
  leftContent: React.ReactNode
  rightContent: React.ReactNode
  initialSplitPosition: number // percentage (0-100)
  onSplitChange: (position: number) => void
  minLeftWidth?: number // pixels
  minRightWidth?: number // pixels
}

export function SplitView({
  leftContent,
  rightContent,
  initialSplitPosition,
  onSplitChange,
  minLeftWidth = 200,
  minRightWidth = 300
}: SplitViewProps) {
  const [splitPosition, setSplitPosition] = useState(initialSplitPosition)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      
      const containerRect = containerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width
      const mouseX = e.clientX - containerRect.left
      
      // Calculate percentage
      let newPosition = (mouseX / containerWidth) * 100
      
      // Apply constraints
      const minLeftPercent = (minLeftWidth / containerWidth) * 100
      const minRightPercent = (minRightWidth / containerWidth) * 100
      
      newPosition = Math.max(minLeftPercent, Math.min(100 - minRightPercent, newPosition))
      
      setSplitPosition(newPosition)
      onSplitChange(newPosition)
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
  }, [isDragging, onSplitChange, minLeftWidth, minRightWidth])

  return (
    <div ref={containerRef} className="flex h-full w-full">
      {/* Left Panel */}
      <div style={{ width: `${splitPosition}%` }} className="overflow-auto">
        {leftContent}
      </div>

      {/* Draggable Divider */}
      <div
        onMouseDown={handleMouseDown}
        className={`w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition ${
          isDragging ? 'bg-blue-500' : ''
        }`}
        style={{ minWidth: '4px' }}
      />

      {/* Right Panel */}
      <div style={{ width: `${100 - splitPosition}%` }} className="overflow-auto">
        {rightContent}
      </div>
    </div>
  )
}

