import { useState } from 'react'
import { api } from '../utils/api'
import { logCapture } from '../utils/logCapture'

interface BugReportDialogProps {
  onClose: () => void
}

export function BugReportDialog({ onClose }: BugReportDialogProps) {
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<'Normal' | 'Severe' | 'Critical'>('Normal')
  const [githubHandle, setGithubHandle] = useState('')
  const [postAnonymously, setPostAnonymously] = useState(false)
  const [includeLogs, setIncludeLogs] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [githubIssueUrl, setGithubIssueUrl] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (description.length < 10) {
      setMessage({ type: 'error', text: 'Description must be at least 10 characters' })
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const logs = includeLogs ? logCapture.getAnonymizedLogs() : undefined
      const result = await api.reportBug(description, severity, githubHandle || undefined, postAnonymously, logs)
      setMessage({ type: 'success', text: result.message || 'Bug report submitted successfully!' })
      if (result.githubIssueUrl) {
        setGithubIssueUrl(result.githubIssueUrl)
      }
      // Clear form
      setDescription('')
      setSeverity('Normal')
      setGithubHandle('')
      setPostAnonymously(false)
      setIncludeLogs(true)
      // Close after 3 seconds
      setTimeout(() => {
        onClose()
      }, 3000)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to submit bug report' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-red-600 text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-2xl font-bold">🐛 Report Bug</h2>
          <button onClick={onClose} className="text-3xl hover:text-red-300 leading-none">&times;</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the bug in detail..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={6}
                required
                minLength={10}
              />
              <p className="text-xs text-gray-500 mt-1">
                {description.length}/10 minimum characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Severity *
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as 'Normal' | 'Severe' | 'Critical')}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="Normal">Normal (default)</option>
                <option value="Severe">Severe</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GitHub Handle (optional)
              </label>
              <input
                type="text"
                value={githubHandle}
                onChange={(e) => setGithubHandle(e.target.value)}
                placeholder="@username"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Your GitHub username if you want to be mentioned in the issue
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="postAnonymously"
                checked={postAnonymously}
                onChange={(e) => setPostAnonymously(e.target.checked)}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <label htmlFor="postAnonymously" className="ml-2 text-sm text-gray-700">
                Post anonymously
              </label>
              <p className="ml-2 text-xs text-gray-500">
                (Your email will not appear in the GitHub issue)
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeLogs"
                checked={includeLogs}
                onChange={(e) => setIncludeLogs(e.target.checked)}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <label htmlFor="includeLogs" className="ml-2 text-sm text-gray-700">
                Include console logs (anonymized)
              </label>
              <p className="ml-2 text-xs text-gray-500">
                (Helps developers diagnose issues)
              </p>
            </div>

            {message && (
              <div className={`p-3 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message.text}
                {githubIssueUrl && (
                  <div className="mt-2">
                    <a
                      href={githubIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View issue on GitHub →
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={submitting || description.length < 10}
                className="flex-1 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Bug Report'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-800 hover:bg-gray-400 rounded transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

