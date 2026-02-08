import { useState, useEffect } from 'react'

interface Task {
  id: string
  title: string
  duration: number
  selected: boolean
  group?: string
  notebook?: string
}

interface Table {
  id: string
  type: 'day' | 'list'
  title: string
  date?: string
  startTime?: string
  tasks: Task[]
  position: { x: number; y: number }
  size?: { width: number; height: number }
  spaceId?: string | null
}

interface ArchivedTable {
  id: string | number
  table_data?: Table
  table_type: 'day' | 'list'
  table_date?: string | null
  table_title: string
  task_count: number
  archived_at: string
}

interface TaskGroup {
  id: string
  name: string
  icon: string
  color?: string
}

interface FilteredExportDialogProps {
  open: boolean
  onClose: () => void
  onExport: (selectedGroups: string[], dateFrom: string | null, dateTo: string | null) => void
  taskGroups: TaskGroup[]
  tables: Table[]
  archivedTables: ArchivedTable[]
}

export function FilteredExportDialog({
  open,
  onClose,
  onExport,
  taskGroups,
  tables,
  archivedTables
}: FilteredExportDialogProps) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [datePreset, setDatePreset] = useState<string>('all')
  const [customDateFrom, setCustomDateFrom] = useState<string>('')
  const [customDateTo, setCustomDateTo] = useState<string>('')
  const [previewStats, setPreviewStats] = useState({ tasks: 0, tables: 0, archivedWithoutData: 0 })

  // Calculate preview stats when filters change
  useEffect(() => {
    if (!open) return

    const { dateFrom, dateTo } = getDateRange()
    const filteredData = filterData(tables, archivedTables, selectedGroups, dateFrom, dateTo)
    
    setPreviewStats({
      tasks: filteredData.totalTasks,
      tables: filteredData.totalTables,
      archivedWithoutData: filteredData.archivedWithoutData
    })
  }, [selectedGroups, datePreset, customDateFrom, customDateTo, tables, archivedTables, open])

  const getDateRange = (): { dateFrom: string | null; dateTo: string | null } => {
    if (datePreset === 'all') {
      return { dateFrom: null, dateTo: null }
    }

    if (datePreset === 'custom') {
      return {
        dateFrom: customDateFrom || null,
        dateTo: customDateTo || null
      }
    }

    const today = new Date()
    const dateFrom = new Date()

    switch (datePreset) {
      case 'last7':
        dateFrom.setDate(today.getDate() - 7)
        break
      case 'last30':
        dateFrom.setDate(today.getDate() - 30)
        break
      case 'thisMonth':
        dateFrom.setDate(1)
        break
      case 'lastMonth':
        dateFrom.setMonth(today.getMonth() - 1)
        dateFrom.setDate(1)
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        return {
          dateFrom: formatDate(dateFrom),
          dateTo: formatDate(lastMonthEnd)
        }
    }

    return {
      dateFrom: formatDate(dateFrom),
      dateTo: formatDate(today)
    }
  }

  const formatDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const filterData = (
    activeTables: Table[],
    archived: ArchivedTable[],
    groups: string[],
    dateFrom: string | null,
    dateTo: string | null
  ) => {
    let totalTasks = 0
    let totalTables = 0
    let archivedWithoutData = 0

    // Filter active tables
    activeTables.forEach(table => {
      // Apply date filter
      if (dateFrom || dateTo) {
        if (!table.date) return
        if (dateFrom && table.date < dateFrom) return
        if (dateTo && table.date > dateTo) return
      }

      // Count filtered tasks
      const filteredTasks = table.tasks?.filter(task => {
        if (groups.length === 0) return true
        const taskGroup = task.group || 'general'
        return groups.includes(taskGroup)
      }) || []

      if (filteredTasks.length > 0) {
        totalTasks += filteredTasks.length
        totalTables++
      }
    })

    // Filter archived tables
    archived.forEach(archivedTable => {
      // Apply date filter
      if (dateFrom || dateTo) {
        const tableDate = archivedTable.table_date
        if (!tableDate) return
        if (dateFrom && tableDate < dateFrom) return
        if (dateTo && tableDate > dateTo) return
      }

      // Count filtered tasks if table_data is available
      if (archivedTable.table_data && archivedTable.table_data.tasks) {
        const filteredTasks = archivedTable.table_data.tasks.filter(task => {
          if (groups.length === 0) return true
          const taskGroup = task.group || 'general'
          return groups.includes(taskGroup)
        })

        if (filteredTasks.length > 0) {
          totalTasks += filteredTasks.length
          totalTables++
        }
      } else if (archivedTable.task_count > 0) {
        // Archived table without full data
        archivedWithoutData++
      }
    })

    return { totalTasks, totalTables, archivedWithoutData }
  }

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  const handleToggleAll = () => {
    if (selectedGroups.length === taskGroups.length) {
      setSelectedGroups([])
    } else {
      setSelectedGroups(taskGroups.map(g => g.id))
    }
  }

  const handleExport = () => {
    const { dateFrom, dateTo } = getDateRange()
    onExport(selectedGroups, dateFrom, dateTo)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#4a6c7a] text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold">📤 Export Filtered Data</h2>
          <button onClick={onClose} className="text-2xl hover:text-gray-300">&times;</button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Task Groups Filter */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Task Groups</h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    id="all-groups"
                    checked={selectedGroups.length === taskGroups.length}
                    onChange={handleToggleAll}
                    className="mr-2 h-4 w-4"
                  />
                  <label htmlFor="all-groups" className="font-medium text-gray-700 cursor-pointer">
                    All Groups
                  </label>
                </div>
                {taskGroups.map(group => (
                  <div key={group.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`group-${group.id}`}
                      checked={selectedGroups.includes(group.id)}
                      onChange={() => handleToggleGroup(group.id)}
                      className="mr-2 h-4 w-4"
                    />
                    <label
                      htmlFor={`group-${group.id}`}
                      className="text-gray-700 cursor-pointer"
                    >
                      {group.name}
                    </label>
                  </div>
                ))}
                {selectedGroups.length === 0 && (
                  <div className="text-xs text-gray-500 mt-2">
                    No groups selected = all groups will be exported
                  </div>
                )}
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Date Range</h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                {/* Presets */}
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="datePreset"
                      value="all"
                      checked={datePreset === 'all'}
                      onChange={(e) => setDatePreset(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">All Time</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="datePreset"
                      value="last7"
                      checked={datePreset === 'last7'}
                      onChange={(e) => setDatePreset(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">Last 7 Days</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="datePreset"
                      value="last30"
                      checked={datePreset === 'last30'}
                      onChange={(e) => setDatePreset(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">Last 30 Days</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="datePreset"
                      value="thisMonth"
                      checked={datePreset === 'thisMonth'}
                      onChange={(e) => setDatePreset(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">This Month</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="datePreset"
                      value="lastMonth"
                      checked={datePreset === 'lastMonth'}
                      onChange={(e) => setDatePreset(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">Last Month</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="datePreset"
                      value="custom"
                      checked={datePreset === 'custom'}
                      onChange={(e) => setDatePreset(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">Custom Range</span>
                  </label>
                </div>

                {/* Custom Date Pickers */}
                {datePreset === 'custom' && (
                  <div className="mt-3 pl-6 space-y-2">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">From:</label>
                      <input
                        type="date"
                        value={customDateFrom}
                        onChange={(e) => setCustomDateFrom(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">To:</label>
                      <input
                        type="date"
                        value={customDateTo}
                        onChange={(e) => setCustomDateTo(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 w-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Preview */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Export Preview</h3>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="text-lg font-semibold text-blue-800">
                  {previewStats.tasks} task{previewStats.tasks !== 1 ? 's' : ''} from {previewStats.tables} table{previewStats.tables !== 1 ? 's' : ''} will be exported
                </div>
                {previewStats.tasks === 0 && (
                  <div className="text-sm text-gray-600 mt-2">
                    No data matches your current filters
                  </div>
                )}
                {previewStats.archivedWithoutData > 0 && (
                  <div className="text-sm text-orange-700 mt-2 bg-orange-100 p-2 rounded border border-orange-300">
                    ⚠️ Warning: {previewStats.archivedWithoutData} archived table{previewStats.archivedWithoutData !== 1 ? 's' : ''} {previewStats.archivedWithoutData !== 1 ? 'are' : 'is'} missing full data and cannot be exported.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={previewStats.tasks === 0}
            className={`px-4 py-2 rounded transition ${
              previewStats.tasks === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#4a6c7a] text-white hover:bg-[#3a5c6a]'
            }`}
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  )
}
