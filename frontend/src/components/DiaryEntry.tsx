import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { exportDiaryToMarkdown } from '../utils/exportUtils'
import { formatDateDisplay, isValidDateFormat } from '../utils/dateFormat'
import { MarkdownToolbar } from './MarkdownToolbar'
import './Notebook.css'

interface DiaryEntryProps {
  date: string // YYYY-MM-DD format
  content: string
  position: { x: number; y: number }
  onSave: (date: string, content: string) => void
  onDateChange: (oldDate: string, newDate: string) => void
  onDelete?: (date: string) => void
  onClose: () => void
  onPositionChange: (position: { x: number; y: number }) => void
  zoom?: number
}

export function DiaryEntry({ 
  date, 
  content, 
  position, 
  onSave, 
  onDateChange,
  onDelete,
  onClose, 
  onPositionChange, 
  zoom = 1 
}: DiaryEntryProps) {
  const [editContent, setEditContent] = useState(content)
  const [currentDate, setCurrentDate] = useState(date)
  const [showPreview, setShowPreview] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const diaryRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 1024
      console.log('DiaryEntry mobile check:', mobile, 'width:', window.innerWidth)
      setIsMobile(mobile)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Update content when prop changes
  useEffect(() => {
    setEditContent(content)
  }, [content])

  // Update date when prop changes
  useEffect(() => {
    setCurrentDate(date)
  }, [date])

  // Auto-save on content change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editContent !== content) {
        onSave(currentDate, editContent)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [editContent, currentDate])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (diaryRef.current && e.target === e.currentTarget) {
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

  const handleDateChange = (newDate: string) => {
    if (newDate !== currentDate) {
      // Save current content before changing date
      if (editContent !== content) {
        onSave(currentDate, editContent)
      }
      onDateChange(currentDate, newDate)
      setCurrentDate(newDate)
    }
  }

  const handleExport = () => {
    exportDiaryToMarkdown(currentDate, editContent)
  }

  const handleInsert = (before: string, after: string, placeholder: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return
    
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentValue = editContent
    
    // Get selected text or use placeholder
    const selectedText = currentValue.substring(start, end)
    const textToWrap = selectedText || placeholder
    
    // Build the new text with markdown around it
    const newText = before + textToWrap + after
    
    // Replace selection with formatted text
    const newValue = currentValue.substring(0, start) + newText + currentValue.substring(end)
    
    // Update value
    setEditContent(newValue)
    
    // Set cursor position
    setTimeout(() => {
      if (selectedText) {
        // If text was selected, place cursor after the inserted markdown
        const newPos = start + newText.length
        textarea.setSelectionRange(newPos, newPos)
      } else {
        // If no selection, select the placeholder text so user can type over it
        const placeholderStart = start + before.length
        const placeholderEnd = placeholderStart + textToWrap.length
        textarea.setSelectionRange(placeholderStart, placeholderEnd)
      }
      textarea.focus()
    }, 0)
  }

  const formatDateDisplayLocal = (dateStr: string): string => {
    // Validate date format first to prevent "Invalid Date"
    if (!isValidDateFormat(dateStr)) {
      console.warn('Invalid date format in DiaryEntry:', dateStr)
      return 'Invalid Date'
    }
    return formatDateDisplay(dateStr)
  }

  // Calculate responsive dimensions
  const diaryWidth = isMobile ? '95vw' : '600px'
  const diaryHeight = isMobile ? '90vh' : '500px'
  const diaryLeft = isMobile ? '2.5vw' : `${position.x}px`
  const diaryTop = isMobile ? '5vh' : `${position.y}px`
  const diaryPosition = isMobile ? 'fixed' : 'absolute'
  
  console.log('DiaryEntry render:', { isMobile, diaryWidth, diaryHeight, diaryLeft, diaryTop })

  return (
    <div
      ref={diaryRef}
      className="bg-white rounded-lg shadow-2xl border-2 border-gray-300"
      style={{
        position: diaryPosition as any,
        left: diaryLeft,
        top: diaryTop,
        width: diaryWidth,
        height: diaryHeight,
        maxWidth: isMobile ? '95vw' : '600px',
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
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h3 className="text-sm font-bold truncate">{formatDateDisplayLocal(currentDate)}</h3>
          <button
            type="button"
            onClick={() => document.getElementById(`diary-date-picker-${date}`)?.showPicker?.()}
            className="bg-white/20 hover:bg-white/30 rounded px-2 py-1 text-xs transition flex-shrink-0"
            title="Change date"
          >
            📅
          </button>
          <input
            type="date"
            value={currentDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="hidden"
            id={`diary-date-picker-${date}`}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs transition"
            title="Export to markdown"
          >
            Export
          </button>
          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this diary entry?')) {
                  onDelete(currentDate)
                }
              }}
              className="px-2 py-1 bg-red-500/80 hover:bg-red-600/90 rounded text-xs transition"
              title="Delete entry"
            >
              Delete
            </button>
          )}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs transition"
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
          <button
            onClick={onClose}
            className="text-xl hover:text-gray-300 px-1"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col" style={{ height: 'calc(100% - 40px)' }}>
        {/* Editor */}
        {!showPreview && (
          <div className="flex flex-col flex-1">
            <div className="p-2 border-b border-gray-200">
              <MarkdownToolbar onInsert={handleInsert} />
            </div>
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              const ta = e.currentTarget
              const selectionStart = ta.selectionStart
              const selectionEnd = ta.selectionEnd
              // If Shift+Enter, allow plain newline without continuation
              if (e.shiftKey) return
              // Find start of current line
              const before = editContent.slice(0, selectionStart)
              const lineStart = before.lastIndexOf('\n') + 1
              const currentLine = editContent.slice(lineStart, selectionStart)
              const indentMatch = currentLine.match(/^(\s*)/)
              const indent = indentMatch ? indentMatch[1] : ''
              // Patterns
              const checklistRe = /^(\s*)- \[(?: |x|X)\] /
              const unorderedRe = /^(\s*)(?:-|\*) /
              const orderedRe = /^(\s*)(\d+)\. /
              let continuation = ''
              if (checklistRe.test(currentLine)) {
                continuation = `${indent}- [ ] `
              } else if (unorderedRe.test(currentLine)) {
                // Preserve whether '-' or '*'
                const sym = currentLine.trimStart().startsWith('*') ? '*' : '-'
                continuation = `${indent}${sym} `
              } else {
                const m = currentLine.match(orderedRe)
                if (m) {
                  const baseIndent = m[1]
                  const num = parseInt(m[2], 10)
                  continuation = `${baseIndent}${num + 1}. `
                }
              }
              if (continuation) {
                e.preventDefault()
                const newText =
                  editContent.slice(0, selectionStart) +
                  '\n' +
                  continuation +
                  editContent.slice(selectionEnd)
                const newCaret = selectionStart + 1 + continuation.length
                setEditContent(newText)
                // Defer caret move until state applied
                requestAnimationFrame(() => {
                  ta.selectionStart = ta.selectionEnd = newCaret
                })
              }
            }}
              className="flex-1 p-3 font-mono text-xs resize-none focus:outline-none border-none"
              placeholder="Write your diary entry in Markdown...

# Heading 1
## Heading 2

**bold** *italic* ~~strikethrough~~

- List item
1. Numbered list

[Link](https://example.com)

```javascript
const hello = 'world';
```

| Table | Header |
|-------|--------|
| Cell  | Cell   |
"
            />
          </div>
        )}

        {/* Preview */}
        {showPreview && (
          <div className="flex-1 p-3 overflow-auto notebook-preview text-xs">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{ fontSize: '0.75rem' }}
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                }
              }}
            >
              {editContent || '*No content yet. Click "Edit" to add notes.*'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

