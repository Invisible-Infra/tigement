import { useEffect, useState } from 'react'
import { loadTables, loadTaskGroups, loadArchivedTables } from '../utils/storage'
import { api } from '../utils/api'
import { FilteredExportDialog } from './FilteredExportDialog'
import { exportFilteredToCSV, downloadCSV } from '../utils/csvUtils'

interface StatisticsProps {
  onClose: () => void
}

export function Statistics({ onClose }: StatisticsProps) {
  const [stats, setStats] = useState({
    totalTables: 0,
    totalTasks: 0,
    totalDuration: 0,
    activeTasks: 0,
    archivedTasksCount: 0,
    archivedTasksWithoutData: 0,
    activeDuration: 0,
    archivedDuration: 0,
    archivedTables: 0,
    archivedTablesWithoutData: 0,
    taskGroups: 0,
    tasksByGroup: {} as Record<string, number>,
    durationsByGroup: {} as Record<string, number>,
    localStorageSize: 0,
    serverStorageSize: 0,
    serverStorageAvailable: false
  })
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [tables, setTables] = useState<any[]>([])
  const [archivedTables, setArchivedTables] = useState<any[]>([])
  const [taskGroups, setTaskGroups] = useState<any[]>([])

  useEffect(() => {
    calculateStats()
  }, [])

  const calculateStats = async () => {
    const tablesData = loadTables() || []
    const taskGroupsData = loadTaskGroups() || []
    const archivedTablesData = loadArchivedTables() || []

    // Store data for export dialog
    setTables(tablesData)
    setTaskGroups(taskGroupsData)
    setArchivedTables(archivedTablesData)

    // Calculate active tables tasks and duration
    let activeTasks = 0
    let activeDuration = 0
    const tasksByGroup: Record<string, number> = {}
    const durationsByGroup: Record<string, number> = {}

    tablesData.forEach(table => {
      table.tasks?.forEach(task => {
        activeTasks++
        const taskDuration = task.duration || 0
        activeDuration += taskDuration
        
        const groupId = task.group || 'general'
        tasksByGroup[groupId] = (tasksByGroup[groupId] || 0) + 1
        durationsByGroup[groupId] = (durationsByGroup[groupId] || 0) + taskDuration
      })
    })

    // Calculate archived tables tasks and duration
    let archivedTasksCount = 0
    let archivedDuration = 0
    let archivedTasksWithoutData = 0
    let archivedTablesWithoutData = 0

    archivedTablesData.forEach((archivedTable: any) => {
      // Check if archived table has table_data loaded
      if (archivedTable.table_data && archivedTable.table_data.tasks) {
        archivedTable.table_data.tasks.forEach((task: any) => {
          archivedTasksCount++
          const taskDuration = task.duration || 0
          archivedDuration += taskDuration
          
          const groupId = task.group || 'general'
          tasksByGroup[groupId] = (tasksByGroup[groupId] || 0) + 1
          durationsByGroup[groupId] = (durationsByGroup[groupId] || 0) + taskDuration
        })
      } else {
        // Archived table without full data - use task_count from metadata
        archivedTablesWithoutData++
        archivedTasksWithoutData += archivedTable.task_count || 0
      }
    })

    // Calculate totals (including tasks without detailed data)
    const totalTasks = activeTasks + archivedTasksCount + archivedTasksWithoutData
    const totalDuration = activeDuration + archivedDuration

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
      totalTables: tablesData.length,
      totalTasks,
      totalDuration,
      activeTasks,
      archivedTasksCount,
      archivedTasksWithoutData,
      activeDuration,
      archivedDuration,
      archivedTables: archivedTablesData.length,
      archivedTablesWithoutData,
      taskGroups: taskGroupsData.length,
      tasksByGroup,
      durationsByGroup,
      localStorageSize,
      serverStorageSize,
      serverStorageAvailable
    })
  }

  const handleExport = (selectedGroups: string[], dateFrom: string | null, dateTo: string | null) => {
    const csv = exportFilteredToCSV(tables, archivedTables, selectedGroups, dateFrom, dateTo)
    
    // Generate filename based on filters
    let filename = 'tigement-export'
    if (selectedGroups.length > 0) {
      const groupNames = selectedGroups.map(id => {
        const group = taskGroups.find(g => g.id === id)
        return group ? group.name : id
      }).join('-')
      filename += `-${groupNames}`
    }
    if (dateFrom || dateTo) {
      if (dateFrom) filename += `-from-${dateFrom}`
      if (dateTo) filename += `-to-${dateTo}`
    }
    filename += '.csv'
    
    downloadCSV(csv, filename)
    setShowExportDialog(false)
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

  const getTaskGroupName = (groupId: string, taskGroupsList: any[]): string => {
    const group = taskGroupsList.find(g => g.id === groupId)
    return group?.name || 'General'
  }

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
                  <div className="text-xs text-gray-500 mt-1">
                    {stats.activeTasks} active, {stats.archivedTasksCount + stats.archivedTasksWithoutData} archived
                  </div>
                  {stats.archivedTasksWithoutData > 0 && (
                    <div className="text-xs text-orange-600 mt-1">
                      ⚠️ {stats.archivedTasksWithoutData} archived tasks without full data
                    </div>
                  )}
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{formatDuration(stats.totalDuration)}</div>
                  <div className="text-sm text-gray-600">Total Duration</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDuration(stats.activeDuration)} active, {formatDuration(stats.archivedDuration)} archived
                  </div>
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
                {stats.archivedTasksWithoutData > 0 && (
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded mb-3">
                    <div className="text-sm text-blue-800">
                      ℹ️ <strong>{stats.archivedTasksWithoutData} archived tasks from {stats.archivedTablesWithoutData} tables</strong> don't have detailed data.
                      <div className="mt-1 text-xs">
                        Archived tables only keep basic metadata (count, date, title) to save space. Detailed task-level information isn't preserved after archiving.
                      </div>
                    </div>
                  </div>
                )}
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
        <div className="border-t border-gray-200 px-6 py-4 flex justify-between flex-shrink-0">
          <button
            onClick={() => setShowExportDialog(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            📤 Export Filtered Data
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#4a6c7a] text-white rounded hover:bg-[#3a5c6a] transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* Filtered Export Dialog */}
      <FilteredExportDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExport}
        taskGroups={taskGroups}
        tables={tables}
        archivedTables={archivedTables}
      />
    </div>
  )
}

