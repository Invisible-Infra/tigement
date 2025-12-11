import { useState } from 'react'
import { api } from '../utils/api'

interface FeatureRequestDialogProps {
  onClose: () => void
}

export function FeatureRequestDialog({ onClose }: FeatureRequestDialogProps) {
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'Nice to have' | 'Need' | 'Just an idea'>('Nice to have')
  const [name, setName] = useState('')
  const [githubHandle, setGithubHandle] = useState('')
  const [postAnonymously, setPostAnonymously] = useState(false)
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
      const result = await api.requestFeature(description, priority, githubHandle || undefined, name || undefined, postAnonymously)
      setMessage({ type: 'success', text: result.message || 'Feature request submitted successfully!' })
      if (result.githubIssueUrl) {
        setGithubIssueUrl(result.githubIssueUrl)
      }
      // Clear form
      setDescription('')
      setPriority('Nice to have')
      setName('')
      setGithubHandle('')
      setPostAnonymously(false)
      // Close after 3 seconds
      setTimeout(() => {
        onClose()
      }, 3000)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to submit feature request' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-green-600 text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-2xl font-bold">✨ Feature Request</h2>
          <button onClick={onClose} className="text-3xl hover:text-green-300 leading-none">&times;</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Feature Name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Dark Mode, Export to PDF..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the feature you'd like to see..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
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
                Priority *
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'Nice to have' | 'Need' | 'Just an idea')}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="Nice to have">Nice to have (default)</option>
                <option value="Need">Need</option>
                <option value="Just an idea">Just an idea</option>
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
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
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
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <label htmlFor="postAnonymously" className="ml-2 text-sm text-gray-700">
                Post anonymously
              </label>
              <p className="ml-2 text-xs text-gray-500">
                (Your email will not appear in the GitHub issue)
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
                className="flex-1 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Feature Request'}
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

