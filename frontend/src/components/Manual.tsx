import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import './Notebook.css'

type ManualLang = 'en' | 'cs'

const DEFAULT_REPO = import.meta.env.VITE_MANUAL_REPO || 'sodomak/tigement'
const DEFAULT_BRANCH = import.meta.env.VITE_MANUAL_BRANCH || 'recode-cleanup'

function getRawUrl(lang: ManualLang): string {
  return `https://raw.githubusercontent.com/${DEFAULT_REPO}/${DEFAULT_BRANCH}/docs/manual.${lang}.md`
}

async function fetchWithLastModified(url: string) {
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  const lastModified = res.headers.get('Last-Modified') || undefined
  return { text, lastModified }
}

export function Manual({ onClose }: { onClose: () => void }) {
  const [lang, setLang] = useState<ManualLang>(() => (localStorage.getItem('manualLang') as ManualLang) || 'en')
  const [content, setContent] = useState<string>('')
  const [lastUpdated, setLastUpdated] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const processedContent = useMemo(() => {
    // Remove HTML anchor tags and add IDs to headings
    const lines = content.split('\n')
    const processed: string[] = []
    let pendingId: string | null = null
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Check if this line is an anchor tag
      const anchorMatch = line.match(/^<a id="([^"]+)"[^>]*><\/a>\s*$/)
      if (anchorMatch) {
        pendingId = anchorMatch[1]
        continue // Skip this line
      }
      
      // Check if this is a heading and we have a pending ID
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headingMatch && pendingId) {
        const [, headingMark, headingText] = headingMatch
        processed.push(`${headingMark} ${headingText}<!-- id:${pendingId} -->`)
        pendingId = null
      } else {
        processed.push(line)
        pendingId = null // Reset if we didn't find a heading after anchor
      }
    }
    
    let result = processed.join('\n')
    
    if (!query.trim()) return result
    
    // simple case-insensitive filter (keep sections containing query)
    const filteredLines = result.split('\n')
    const q = query.toLowerCase()
    const keep: string[] = []
    let include = false
    for (const line of filteredLines) {
      if (line.startsWith('#')) include = line.toLowerCase().includes(q)
      if (include || line.toLowerCase().includes(q)) keep.push(line)
    }
    return keep.join('\n') || result
  }, [content, query])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1) Load bundled offline copy immediately for fast display
      const localRes = await fetch(`/manual.${lang}.md`)
      if (!localRes.ok) throw new Error('offline copy missing')
      const localText = await localRes.text()
      setContent(localText)
      setLastUpdated(undefined)
      setLoading(false)

      // 2) Try to refresh from GitHub in background; if it succeeds, replace content
      try {
        const { text, lastModified } = await fetchWithLastModified(getRawUrl(lang))
        if (text && text.trim().length > 0) {
          setContent(text)
          setLastUpdated(lastModified)
        }
      } catch {
        // ignore, offline copy already shown
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load manual')
      setLoading(false)
    }
  }

  useEffect(() => {
    localStorage.setItem('manualLang', lang)
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        <div className="bg-[#4a6c7a] text-white px-6 py-3 rounded-t-lg flex items-center gap-3">
          <h2 className="text-lg font-bold flex-1">User Manual</h2>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as ManualLang)}
            className="text-black px-2 py-1 rounded"
            aria-label="Language"
          >
            <option value="en">English</option>
            <option value="cs">Čeština</option>
          </select>
          <input
            type="search"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="text-black px-2 py-1 rounded border border-white"
          />
          <button onClick={onClose} className="text-2xl hover:text-gray-300">×</button>
        </div>

        <div className="px-4 py-2 text-xs text-gray-600">
          {loading ? 'Loading…' : error ? (
            <span className="text-red-600">{error} <button className="underline" onClick={load}>Retry</button></span>
          ) : (
            <>
              {lastUpdated ? `Last updated: ${new Date(lastUpdated).toLocaleString()}` : 'Offline copy'}
            </>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4 notebook-preview">
          {!loading && !error && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>{children}</code>
                  )
                },
                h2({ children, ...props }: any) {
                  const text = String(children)
                  // Check if there's an ID comment in the raw markdown (we'll parse it from the node)
                  const idMatch = text.match(/<!-- id:([^>]+) -->/)
                  const id = idMatch ? idMatch[1] : text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                  const cleanText = text.replace(/<!-- id:[^>]+ -->/g, '')
                  return <h2 id={id} {...props}>{cleanText}</h2>
                },
                h3({ children, ...props }: any) {
                  const text = String(children)
                  const idMatch = text.match(/<!-- id:([^>]+) -->/)
                  const id = idMatch ? idMatch[1] : text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                  const cleanText = text.replace(/<!-- id:[^>]+ -->/g, '')
                  return <h3 id={id} {...props}>{cleanText}</h3>
                }
              }}
            >
              {processedContent}
            </ReactMarkdown>
          )}
        </div>
        <div className="px-6 py-3 bg-gray-50 rounded-b-lg flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded transition">Close</button>
        </div>
      </div>
    </div>
  )
}


