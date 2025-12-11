import { useEffect, useState } from 'react'
import { loadTables, loadTaskGroups, loadArchivedTables } from '../utils/storage'
import { api } from '../utils/api'

interface StatisticsProps {
  onClose: () => void
}

export function Statistics({ onClose }: StatisticsProps) {
  const [stats, setStats] = useState({
    totalTables: 0,
    totalTasks: 0,
    totalDuration: 0,
    archivedTables: 0,
    taskGroups: 0,
    tasksByGroup: {} as Record<string, number>,
    durationsByGroup: {} as Record<string, number>,
    localStorageSize: 0,
    serverStorageSize: 0,
    serverStorageAvailable: false
  })

  useEffect(() => {
    calculateStats()
  }, [])

  const calculateStats = async () => {
    const tables = loadTables() || []
    const taskGroups = loadTaskGroups() || []
    const archivedTables = loadArchivedTables() || []

    // Calculate total tasks and duration
    let totalTasks = 0
    let totalDuration = 0
    const tasksByGroup: Record<string, number> = {}
    const durationsByGroup: Record<string, number> = {}

    tables.forEach(table => {
      table.tasks?.forEach(task => {
        totalTasks++
        const taskDuration = task.duration || 0
        totalDuration += taskDuration
        
        const groupId = task.group || 'general'
        tasksByGroup[groupId] = (tasksByGroup[groupId] || 0) + 1
        durationsByGroup[groupId] = (durationsByGroup[groupId] || 0) + taskDuration
      })
    })

    // Calculate localStorage size
    let localStorageSize = 0
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('tigement_')) {
          const value = localStorage.getItem(key)
          if (value) {
            localStorageSize += new Blob([value]).size
          }
        }
      }
    } catch (e) {
      console.error('Error calculating localStorage size:', e)
    }

    // Try to get server storage size (if available)
    let serverStorageSize = 0
    let serverStorageAvailable = false
    try {
      const workspace = await api.getWorkspace()
      if (workspace.data) {
        serverStorageSize = new Blob([workspace.data]).size
        serverStorageAvailable = true
      }
    } catch (e) {
      // Server storage not available or error
      console.log('Server storage info not available')
    }

    setStats({
      totalTables: tables.length,
      totalTasks,
      totalDuration,
      archivedTables: archivedTables.length,
      taskGroups: taskGroups.length,
      tasksByGroup,
      durationsByGroup,
      localStorageSize,
      serverStorageSize,
      serverStorageAvailable
    })
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const getTaskGroupName = (groupId: string, taskGroups: any[]): string => {
    const group = taskGroups.find(g => g.id === groupId)
    return group?.name || 'General'
  }

  const taskGroups = loadTaskGroups() || []

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#4a6c7a] text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold">📊 Statistics</h2>
          <button onClick={onClose} className="text-2xl hover:text-gray-300">&times;</button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Overview */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Overview</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{stats.totalTables}</div>
                  <div className="text-sm text-gray-600">Total Tables</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{stats.totalTasks}</div>
                  <div className="text-sm text-gray-600">Total Tasks</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{formatDuration(stats.totalDuration)}</div>
                  <div className="text-sm text-gray-600">Total Duration</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{stats.archivedTables}</div>
                  <div className="text-sm text-gray-600">Archived Tables</div>
                </div>
              </div>
            </div>

            {/* Task Groups */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Task Groups</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-gray-700">{stats.taskGroups}</div>
                <div className="text-sm text-gray-600 mb-3">Total Groups</div>
                {Object.keys(stats.tasksByGroup).length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-sm font-medium text-gray-700 mb-2">Tasks by Group:</div>
                    {Object.entries(stats.tasksByGroup)
                      .sort((a, b) => b[1] - a[1])
                      .map(([groupId, count]) => (
                        <div key={groupId} className="flex justify-between items-center text-sm border-b border-gray-200 pb-2">
                          <span className="text-gray-600">{getTaskGroupName(groupId, taskGroups)}:</span>
                          <div className="flex gap-4 items-center">
                            <span className="text-gray-500">{count} tasks</span>
                            <span className="font-semibold text-gray-800">{formatDuration(stats.durationsByGroup[groupId] || 0)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Storage */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Storage</h3>
              <div className="space-y-3">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-gray-700">Browser Storage</div>
                      <div className="text-sm text-gray-600">localStorage (tigement data)</div>
                    </div>
                    <div className="text-lg font-bold text-gray-800">
                      {formatBytes(stats.localStorageSize)}
                    </div>
                  </div>
                </div>
                {stats.serverStorageAvailable ? (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-gray-700">Server Storage</div>
                        <div className="text-sm text-gray-600">Encrypted workspace data</div>
                      </div>
                      <div className="text-lg font-bold text-gray-800">
                        {formatBytes(stats.serverStorageSize)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg opacity-60">
                    <div className="text-sm text-gray-600">
                      Server storage information not available (not logged in or no synced data)
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#4a6c7a] text-white rounded hover:bg-[#3a5c6a] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

