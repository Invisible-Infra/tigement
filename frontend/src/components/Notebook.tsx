import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { MarkdownToolbar } from './MarkdownToolbar'
import './Notebook.css'

interface NotebookProps {
  id: string
  title: string
  content: string
  position: { x: number; y: number }
  onSave: (content: string) => void
  onClose: () => void
  onPositionChange: (position: { x: number; y: number }) => void
  zoom?: number
}

export function Notebook({ id, title, content, position, onSave, onClose, onPositionChange, zoom = 1 }: NotebookProps) {
  const [editContent, setEditContent] = useState(content)
  const [showPreview, setShowPreview] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const notebookRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-save on content change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editContent !== content) {
        onSave(editContent)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [editContent])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (notebookRef.current && e.target === e.currentTarget) {
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

  // Calculate responsive dimensions
  const notebookWidth = isMobile ? '95vw' : '600px'
  const notebookHeight = isMobile ? '90vh' : '500px'
  const notebookLeft = isMobile ? '2.5vw' : `${position.x}px`
  const notebookTop = isMobile ? '5vh' : `${position.y}px`
  const notebookPosition = isMobile ? 'fixed' : 'absolute'

  return (
    <div
      ref={notebookRef}
      className="bg-white rounded-lg shadow-2xl border-2 border-gray-300"
      style={{
        position: notebookPosition as any,
        left: notebookLeft,
        top: notebookTop,
        width: notebookWidth,
        height: notebookHeight,
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
        <h3 className="text-sm font-bold truncate flex-1">{title}</h3>
        <div className="flex items-center gap-2">
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
              placeholder="Write your notes in Markdown...

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

