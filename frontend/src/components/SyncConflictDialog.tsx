import { useState } from 'react'

interface Table {
  id: string
  type: 'day' | 'list'
  title: string
  date?: string
  startTime?: string
  tasks: any[]
  position: { x: number; y: number }
}

interface ConflictData {
  local: {
    tables: Table[]
    settings: any
    archivedTables?: any[]
  }
  remote: {
    tables: Table[]
    settings: any
    archivedTables?: any[]
  }
}

interface SyncConflictDialogProps {
  conflictData: ConflictData
  onResolve: (resolution: 'local' | 'remote' | 'merge', selectedTables?: Table[]) => void
  onCancel: () => void
}

export function SyncConflictDialog({ conflictData, onResolve, onCancel }: SyncConflictDialogProps) {
  const [resolution, setResolution] = useState<'local' | 'remote' | 'merge' | null>(null)
  const [selectedTables, setSelectedTables] = useState<{ [key: string]: 'local' | 'remote' }>({})
  const [expandedTable, setExpandedTable] = useState<string | null>(null)

  const handleConfirm = () => {
    if (!resolution) return

    if (resolution === 'merge') {
      // Build merged table list based on user selections
      const merged: Table[] = []
      const allTableIds = new Set([
        ...conflictData.local.tables.map(t => t.id),
        ...conflictData.remote.tables.map(t => t.id)
      ])

      allTableIds.forEach(id => {
        const source = selectedTables[id] || 'local' // Default to local
        const table = source === 'local'
          ? conflictData.local.tables.find(t => t.id === id)
          : conflictData.remote.tables.find(t => t.id === id)
        
        if (table) merged.push(table)
      })

      onResolve('merge', merged)
    } else {
      onResolve(resolution)
    }
  }

  const getTotalTasks = (tables: Table[]) => {
    return tables.reduce((sum, table) => sum + table.tasks.length, 0)
  }

  // Find differences between local and remote tables
  const getTableDiff = (tableId: string) => {
    const localTable = conflictData.local.tables.find(t => t.id === tableId)
    const remoteTable = conflictData.remote.tables.find(t => t.id === tableId)
    
    if (!localTable || !remoteTable) {
      return { added: [], removed: [], modified: [] }
    }

    const localTaskMap = new Map(localTable.tasks.map((t: any) => [t.id, t]))
    const remoteTaskMap = new Map(remoteTable.tasks.map((t: any) => [t.id, t]))

    const added: any[] = []
    const removed: any[] = []
    const modified: any[] = []

    // Check for added and modified tasks
    remoteTable.tasks.forEach((remoteTask: any) => {
      const localTask = localTaskMap.get(remoteTask.id)
      if (!localTask) {
        added.push(remoteTask)
      } else {
        // Compare relevant fields
        const localStr = JSON.stringify({ title: localTask.title, duration: localTask.duration })
        const remoteStr = JSON.stringify({ title: remoteTask.title, duration: remoteTask.duration })
        if (localStr !== remoteStr) {
          modified.push({ local: localTask, remote: remoteTask })
        }
      }
    })

    // Check for removed tasks
    localTable.tasks.forEach((localTask: any) => {
      if (!remoteTaskMap.has(localTask.id)) {
        removed.push(localTask)
      }
    })

    return { added, removed, modified }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-red-500 text-white px-6 py-4 rounded-t-lg">
          <h2 className="text-2xl font-bold">⚠️ Sync Conflict Detected</h2>
          <p className="text-sm mt-1">Both your device and the server have changes. Choose which data to keep:</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {!resolution ? (
            /* Step 1: Choose resolution strategy */
            <div className="space-y-4">
              {/* Show detailed diff summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">📋 Changes Detected:</h3>
                <div className="space-y-2 text-sm">
                  {Array.from(new Set([
                    ...conflictData.local.tables.map(t => t.id),
                    ...conflictData.remote.tables.map(t => t.id)
                  ])).map(tableId => {
                    const localTable = conflictData.local.tables.find(t => t.id === tableId)
                    const remoteTable = conflictData.remote.tables.find(t => t.id === tableId)
                    const diff = getTableDiff(tableId)
                    const hasDiff = diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0
                    
                    if (!hasDiff && localTable && remoteTable) return null
                    
                    return (
                      <div key={tableId} className="border-l-4 border-orange-400 pl-3 py-1">
                        <div className="font-medium text-gray-700">
                          {localTable?.title || remoteTable?.title || tableId}
                        </div>
                        {!localTable && remoteTable && (
                          <div className="text-green-600 text-xs mt-1">+ Only on server ({remoteTable.tasks.length} tasks)</div>
                        )}
                        {localTable && !remoteTable && (
                          <div className="text-red-600 text-xs mt-1">- Only on local device ({localTable.tasks.length} tasks)</div>
                        )}
                        {diff.added.length > 0 && (
                          <div className="text-green-600 text-xs mt-1">
                            <strong>+ Server has:</strong> {diff.added.map(t => t.title || '(empty)').join(', ')}
                          </div>
                        )}
                        {diff.removed.length > 0 && (
                          <div className="text-red-600 text-xs mt-1">
                            <strong>- Local has:</strong> {diff.removed.map(t => t.title || '(empty)').join(', ')}
                          </div>
                        )}
                        {diff.modified.length > 0 && (
                          <div className="text-orange-600 text-xs mt-1">
                            <strong>~ Modified:</strong> {diff.modified.map((m: any) => `"${m.local.title}" → "${m.remote.title}"`).join(', ')}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={() => setResolution('local')}
                className="w-full p-6 border-2 border-gray-300 rounded-lg hover:border-[#4fc3f7] hover:bg-blue-50 transition text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">💻</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800">Keep My Local Changes</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Use the data from this device. Server data will be overwritten.
                    </p>
                    <div className="mt-2 text-sm text-gray-500">
                      {conflictData.local.tables.length} tables{conflictData.local.archivedTables ? `, ${conflictData.local.archivedTables.length} archived` : ''}, {getTotalTasks(conflictData.local.tables)} tasks
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setResolution('remote')}
                className="w-full p-6 border-2 border-gray-300 rounded-lg hover:border-[#4fc3f7] hover:bg-blue-50 transition text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">☁️</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800">Use Server Data</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Download data from the server. Your local changes will be lost.
                    </p>
                    <div className="mt-2 text-sm text-gray-500">
                      {conflictData.remote.tables.length} tables{conflictData.remote.archivedTables ? `, ${conflictData.remote.archivedTables.length} archived` : ''}, {getTotalTasks(conflictData.remote.tables)} tasks
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setResolution('merge')}
                className="w-full p-6 border-2 border-gray-300 rounded-lg hover:border-[#4fc3f7] hover:bg-blue-50 transition text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">🔀</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800">Merge Both (Manual Review)</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Choose which tables to keep from each source.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          ) : resolution === 'merge' ? (
            /* Step 2: Manual merge selection */
            <div>
              <button
                onClick={() => setResolution(null)}
                className="text-[#4fc3f7] hover:underline mb-4 text-sm"
              >
                ← Back to options
              </button>

              <h3 className="text-lg font-bold text-gray-800 mb-4">Select which version to keep for each table:</h3>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {Array.from(new Set([
                  ...conflictData.local.tables.map(t => t.id),
                  ...conflictData.remote.tables.map(t => t.id)
                ])).map(tableId => {
                  const localTable = conflictData.local.tables.find(t => t.id === tableId)
                  const remoteTable = conflictData.remote.tables.find(t => t.id === tableId)
                  const selected = selectedTables[tableId] || 'local'
                  const diff = getTableDiff(tableId)
                  const hasDiff = diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0
                  const isExpanded = expandedTable === tableId

                  return (
                    <div key={tableId} className="border border-gray-300 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-semibold text-gray-700">
                          {localTable?.title || remoteTable?.title || tableId}
                        </div>
                        {hasDiff && localTable && remoteTable && (
                          <button
                            onClick={() => setExpandedTable(isExpanded ? null : tableId)}
                            className="text-xs text-[#4fc3f7] hover:underline"
                          >
                            {isExpanded ? '▼ Hide diff' : '▶ Show diff'}
                          </button>
                        )}
                      </div>

                      {/* Show differences if expanded */}
                      {isExpanded && (
                        <div className="mb-3 p-2 bg-gray-50 rounded text-xs space-y-1">
                          {diff.added.length > 0 && (
                            <div className="text-green-600">
                              + {diff.added.length} task(s) on server: {diff.added.map(t => t.title || '(empty)').join(', ')}
                            </div>
                          )}
                          {diff.removed.length > 0 && (
                            <div className="text-red-600">
                              - {diff.removed.length} task(s) only local: {diff.removed.map(t => t.title || '(empty)').join(', ')}
                            </div>
                          )}
                          {diff.modified.length > 0 && (
                            <div className="text-orange-600">
                              ~ {diff.modified.length} task(s) modified: {diff.modified.map((m: any) => `"${m.local.title}" → "${m.remote.title}"`).join(', ')}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        {/* Local version */}
                        <button
                          onClick={() => setSelectedTables({ ...selectedTables, [tableId]: 'local' })}
                          className={`p-3 border-2 rounded transition ${
                            selected === 'local'
                              ? 'border-[#4fc3f7] bg-blue-50'
                              : 'border-gray-200 hover:border-gray-400'
                          }`}
                          disabled={!localTable}
                        >
                          <div className="text-sm font-medium text-gray-700">💻 Local</div>
                          {localTable ? (
                            <div className="text-xs text-gray-500 mt-1">
                              {localTable.tasks.length} tasks
                            </div>
                          ) : (
                            <div className="text-xs text-red-500 mt-1">Not present</div>
                          )}
                        </button>

                        {/* Remote version */}
                        <button
                          onClick={() => setSelectedTables({ ...selectedTables, [tableId]: 'remote' })}
                          className={`p-3 border-2 rounded transition ${
                            selected === 'remote'
                              ? 'border-[#4fc3f7] bg-blue-50'
                              : 'border-gray-200 hover:border-gray-400'
                          }`}
                          disabled={!remoteTable}
                        >
                          <div className="text-sm font-medium text-gray-700">☁️ Server</div>
                          {remoteTable ? (
                            <div className="text-xs text-gray-500 mt-1">
                              {remoteTable.tasks.length} tasks
                            </div>
                          ) : (
                            <div className="text-xs text-red-500 mt-1">Not present</div>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Confirmation */
            <div className="text-center py-8">
              <div className="text-6xl mb-4">
                {resolution === 'local' ? '💻' : '☁️'}
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                {resolution === 'local' ? 'Keep Local Changes?' : 'Use Server Data?'}
              </h3>
              <p className="text-gray-600">
                {resolution === 'local'
                  ? 'Your local data will be uploaded and overwrite the server data.'
                  : 'Server data will be downloaded and your local changes will be lost.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded transition"
          >
            Cancel
          </button>
          {resolution && (
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-[#4fc3f7] text-white hover:bg-[#3ba3d7] rounded transition font-medium"
            >
              {resolution === 'merge' ? 'Merge Selected Tables' : 'Confirm'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

