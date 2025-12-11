import { useMemo } from 'react'
import { summarize, type DetectedLocalData } from '../utils/mergeLocalData'

interface MergeLocalDataDialogProps {
  open: boolean
  local: DetectedLocalData | null
  onMerge: () => void
  onSkip: () => void
}

export function MergeLocalDataDialog({ open, local, onMerge, onSkip }: MergeLocalDataDialogProps) {
  const counts = useMemo(() => local ? summarize(local) : { tableCount: 0, taskCount: 0, notebookCount: 0 }, [local])
  if (!open || !local) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-200 rounded-t-lg flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Merge local data into your workspace?</h3>
          <button onClick={onSkip} className="text-2xl text-gray-500 hover:text-gray-800">×</button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-700">
            We found data you created before logging in. You can merge non-empty tables and notebooks into your account.
          </p>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded border border-gray-200">
              <div className="text-xs text-gray-500">Tables</div>
              <div className="text-2xl font-bold text-gray-800">{counts.tableCount}</div>
            </div>
            <div className="p-3 rounded border border-gray-200">
              <div className="text-xs text-gray-500">Tasks</div>
              <div className="text-2xl font-bold text-gray-800">{counts.taskCount}</div>
            </div>
            <div className="p-3 rounded border border-gray-200">
              <div className="text-xs text-gray-500">Notebooks</div>
              <div className="text-2xl font-bold text-gray-800">{counts.notebookCount}</div>
            </div>
          </div>

          <div className="max-h-60 overflow-auto border border-gray-200 rounded">
            <div className="p-3 text-sm text-gray-600">
              {local.nonEmptyTables.length === 0 && Object.keys(local.nonEmptyNotebooks.tasks || {}).length === 0 && !local.nonEmptyNotebooks.workspace ? (
                <div>No non-empty items detected.</div>
              ) : (
                <>
                  {local.nonEmptyTables.length > 0 && (
                    <>
                      <div className="font-semibold text-gray-800 mb-1">Tables to duplicate:</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {local.nonEmptyTables.map(t => (
                          <li key={t.id}>
                            <span className="font-medium">{t.type === 'day' ? `[${t.date}] ` : ''}{t.title}</span>
                            <span className="text-gray-500"> — {t.tasks.filter(tt => (tt.title?.trim() || '').length > 0 || (tt.duration || 0) > 0).length} tasks</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {(local.nonEmptyNotebooks.workspace || Object.keys(local.nonEmptyNotebooks.tasks || {}).length > 0) && (
                    <>
                      <div className="font-semibold text-gray-800 mt-3 mb-1">Notebooks to merge:</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {local.nonEmptyNotebooks.workspace && <li>Workspace notebook</li>}
                        {Object.keys(local.nonEmptyNotebooks.tasks || {}).map(tid => <li key={tid}>Task notebook: {tid}</li>)}
                      </ul>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 rounded-b-lg flex items-center justify-end gap-2">
          <button onClick={onSkip} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-800">Skip</button>
          <button onClick={onMerge} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold">Merge</button>
        </div>
      </div>
    </div>
  )
}


