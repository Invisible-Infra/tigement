import { useState } from 'react'

interface MigrationDialogProps {
  open: boolean
  onDownloadBackup: () => Promise<void>
  onSkipBackup: () => void
  onComplete: () => void
}

export function MigrationDialog({
  open,
  onDownloadBackup,
  onSkipBackup,
  onComplete
}: MigrationDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [backupComplete, setBackupComplete] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleDownloadAndUpdate = async () => {
    try {
      setIsDownloading(true)
      setError(null)
      
      // Download backup
      await onDownloadBackup()
      
      setIsDownloading(false)
      setBackupComplete(true)
      
      // Wait a moment to show success message, then run migration
      await new Promise(resolve => setTimeout(resolve, 1500))
      setIsMigrating(true)
      
      // Run migration and WAIT for it to complete
      await onComplete()
    } catch (err) {
      setIsDownloading(false)
      setError('Failed to download backup. Please try again.')
      console.error('Backup download error:', err)
    }
  }

  const handleSkipBackup = () => {
    if (confirm('Are you sure you want to skip the backup? This is not recommended.')) {
      setIsMigrating(true)
      onSkipBackup()
      onComplete()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white w-full max-w-md rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            🔄 Database Update Available
          </h3>
        </div>

        <div className="p-6 space-y-4">
          {!backupComplete && !isMigrating && (
            <>
              <p className="text-gray-700">
                We're upgrading your workspace to our new database format for improved reliability and performance.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-medium mb-2">
                  📦 We recommend creating a backup first
                </p>
                <p className="text-sm text-blue-700">
                  This will only take a few seconds and ensures your data is safe.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleDownloadAndUpdate}
                  disabled={isDownloading}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDownloading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⏳</span>
                      Downloading Backup...
                    </span>
                  ) : (
                    '✅ Download Backup & Update'
                  )}
                </button>

                <button
                  onClick={handleSkipBackup}
                  disabled={isDownloading || isMigrating}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Skip Backup (Not Recommended)
                </button>
              </div>
            </>
          )}

          {backupComplete && !isMigrating && (
            <div className="text-center py-4">
              <div className="text-green-600 text-5xl mb-3">✓</div>
              <p className="text-lg font-medium text-gray-800 mb-2">
                Backup Saved!
              </p>
              <p className="text-sm text-gray-600">
                Now updating database...
              </p>
            </div>
          )}

          {isMigrating && (
            <div className="text-center py-4">
              <div className="animate-spin text-4xl mb-3">🔄</div>
              <p className="text-lg font-medium text-gray-800 mb-2">
                Updating database format...
              </p>
              <p className="text-sm text-gray-600">
                This is a one-time process, please wait
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

