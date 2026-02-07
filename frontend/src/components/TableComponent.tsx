import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookOpen, faMinus, faXmark } from '@fortawesome/free-solid-svg-icons'
import { isLegacyDayTitle, formatDateWithSettings } from '../utils/dateFormat'

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
  type: 'day' | 'todo'
  title: string
  date?: string
  startTime?: string
  tasks: Task[]
  position: { x: number; y: number }
  size?: { width: number; height: number }
  spaceId?: string | null
  collapsed?: boolean
  _shared?: { shareId: number; canEdit: boolean; [k: string]: unknown }
}

interface TaskGroup {
  id: string
  name: string
  icon: string
  color?: string
}

interface Space {
  id: string
  name: string
  color?: string
  icon?: string
}

interface TableComponentProps {
  table: Table
  times: { start: string; end: string }[]
  isDraggingTable: boolean
  tableZIndex: number
  isMobile: boolean
  zoom: number
  settings: any
  showEmoji: boolean
  iconMap: Record<string, any>
  
  // View mode and spaces (for spaces view)
  viewMode?: 'all-in-one' | 'spaces'
  spaces?: Space[]
  
  // State setters for dialogs/menus
  timePickerTable: string | null
  setTimePickerTable: (id: string | null) => void
  durationPickerTask: { tableId: string; taskId: string } | null
  setDurationPickerTask: (val: { tableId: string; taskId: string } | null) => void
  groupSelectorTask: { tableId: string; taskId: string } | null
  setGroupSelectorTask: (val: { tableId: string; taskId: string } | null) => void
  bulkActionsOpen: string | null
  setBulkActionsOpen: (id: string | null) => void
  bulkGroupSelectorTable: string | null
  setBulkGroupSelectorTable: (id: string | null) => void
  hoveredTask: string | null
  setHoveredTask: (id: string | null) => void
  highlightedTask: string | null
  
  // Drag and drop state
  draggedTask: { tableId: string; taskId: string; index: number } | null
  dropTarget: { tableId: string; index: number } | null
  draggedTable: { id: string; offsetX: number; offsetY: number } | null
  touchDragStart: { taskId: string; tableId: string; startY: number; index: number } | null
  
  // Event handlers
  handleTableDragStart: (e: React.MouseEvent, tableId: string) => void
  handleTableResizeStart: (e: React.MouseEvent, tableId: string) => void
  updateTableDate: (tableId: string, date: string) => void
  setTables: React.Dispatch<React.SetStateAction<Table[]>>
  archiveTable: (tableId: string) => void
  duplicateTable: (tableId: string) => void
  shareTable?: (table: Table) => void
  deleteTable: (tableId: string) => void
  toggleTableCollapsed: (tableId: string) => void
  toggleSelectAll: (tableId: string) => void
  updateTableStartTime: (tableId: string, time: string) => void
  handleDragOver: (e: React.DragEvent, tableId: string, index: number) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent, tableId: string, index: number) => void
  toggleSelect: (tableId: string, taskId: string) => void
  moveTaskUp: (tableId: string, index: number) => void
  moveTaskDown: (tableId: string, index: number) => void
  handleHandleTouchStart: (e: React.TouchEvent, tableId: string, taskId: string, index: number) => void
  handleHandleTouchEnd: () => void
  handleDragStart: (tableId: string, taskId: string, index: number, event?: React.DragEvent) => void
  handleDragEnd: () => void
  handleTouchMove: (e: React.TouchEvent) => void
  handleTouchEnd: (e: React.TouchEvent) => void
  updateTask: (tableId: string, taskId: string, field: string, value: any) => void
  startMoveLongPress: (e: React.TouchEvent, tableId: string, index: number) => void
  cancelMoveLongPress: () => void
  openTaskNotebook: (tableId: string, taskId: string, buttonElement?: HTMLElement) => void
  addTask: (tableId: string, index?: number) => void
  duplicateTask: (tableId: string, taskId: string, index: number) => void
  deleteTask: (tableId: string, taskId: string) => void
  deleteSelected: (tableId: string) => void
  exportTableToMarkdown: (table: Table) => void
  handleAssignTableToSpace?: (tableId: string, spaceId: string | null) => void
  
  // Helper functions
  formatDate: (dateStr: string) => string
  formatTime: (time24: string) => string
  parseTime: (timeStr: string) => string
  formatDuration: (minutes: number) => string
  parseDuration: (timeStr: string) => number
  getTotalDuration: (table: Table) => string
  isTaskInPast: (table: Table, endTime: string) => boolean
  isTaskCurrent: (table: Table, startTime: string, endTime: string) => boolean
  getTaskTimeMatchStatus: (taskName: string, actualStartTime: string) => 'match' | 'mismatch' | null
  getTaskGroup: (groupId?: string) => TaskGroup | undefined
  getContrastColor: (hexColor?: string) => string
  getEffectiveBackgroundHex: (el: HTMLElement | null) => string
  getThemeColor: (varName: string) => string
  
  // For getting all tables (needed for setTables)
  tables: Table[]

  // Tutorial mode: add data-tutorial-target for step highlighting
  tutorialTargets?: {
    dayStart?: string
    taskTargets?: Record<string, { name?: string; duration?: string; dragHandle?: string; row?: string }>
  }

  // Read-only mode (shared table viewer): same layout, no editing
  readOnly?: boolean
  ownerEmail?: string
  // When true, allow table-level operations (move, resize, space assign, collapse) even if readOnly
  allowTableLayout?: boolean
  onPushSharedChanges?: (table: Table) => void
  /** Owner's table that is shared – show Push button even without _shared */
  isSharedByOwner?: boolean
}

export function TableComponent({
  table,
  times,
  isDraggingTable,
  tableZIndex,
  isMobile,
  zoom,
  settings,
  showEmoji,
  iconMap,
  viewMode,
  spaces,
  timePickerTable,
  setTimePickerTable,
  durationPickerTask,
  setDurationPickerTask,
  groupSelectorTask,
  setGroupSelectorTask,
  bulkActionsOpen,
  setBulkActionsOpen,
  bulkGroupSelectorTable,
  setBulkGroupSelectorTable,
  hoveredTask,
  setHoveredTask,
  highlightedTask,
  draggedTask,
  dropTarget,
  draggedTable,
  touchDragStart,
  handleTableDragStart,
  handleTableResizeStart,
  updateTableDate,
  setTables,
  archiveTable,
  duplicateTable,
  shareTable,
  deleteTable,
  toggleTableCollapsed,
  toggleSelectAll,
  updateTableStartTime,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  toggleSelect,
  moveTaskUp,
  moveTaskDown,
  handleHandleTouchStart,
  handleHandleTouchEnd,
  handleDragStart,
  handleDragEnd,
  handleTouchMove,
  handleTouchEnd,
  updateTask,
  startMoveLongPress,
  cancelMoveLongPress,
  openTaskNotebook,
  addTask,
  duplicateTask,
  deleteTask,
  deleteSelected,
  exportTableToMarkdown,
  handleAssignTableToSpace,
  formatDate,
  formatTime,
  parseTime,
  formatDuration,
  parseDuration,
  getTotalDuration,
  isTaskInPast,
  isTaskCurrent,
  getTaskTimeMatchStatus,
  getTaskGroup,
  getContrastColor,
  getEffectiveBackgroundHex,
  getThemeColor,
  tables,
  tutorialTargets,
  readOnly = false,
  ownerEmail,
  allowTableLayout = false,
  onPushSharedChanges,
  isSharedByOwner = false,
}: TableComponentProps) {
  const canMoveTable = !readOnly || allowTableLayout
  const [spaceDropdownOpen, setSpaceDropdownOpen] = useState(false)
  const spaceDropdownTriggerRef = useRef<HTMLButtonElement>(null)
  const [spaceDropdownRect, setSpaceDropdownRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (spaceDropdownOpen && spaceDropdownTriggerRef.current) {
      setSpaceDropdownRect(spaceDropdownTriggerRef.current.getBoundingClientRect())
    } else {
      setSpaceDropdownRect(null)
    }
  }, [spaceDropdownOpen])

  // Prevent page scroll when wheel over duration cell (passive: false so preventDefault works)
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if ((e.target as Element).closest?.('[data-duration-wheel]')) e.preventDefault()
    }
    document.addEventListener('wheel', handler, { capture: true, passive: false })
    return () => document.removeEventListener('wheel', handler, { capture: true })
  }, [])

  return (
    <div
      id={`table-${table.id}`}
      data-tutorial-table-id={table.id}
      style={{
        position: 'relative',
        width: '100%',
        height: 'auto',
        ...(viewMode === 'spaces' ? {
          marginBottom: '1rem',
        } : {}),
      }}
      className="bg-white shadow-lg md:rounded-lg overflow-hidden flex flex-col"
    >
      {/* Table Header */}
      <div 
        className="bg-[#4a6c7a] text-white px-4 py-3 md:rounded-t-lg flex justify-between items-center gap-3"
        onMouseDown={canMoveTable && !isMobile ? (e) => handleTableDragStart(e, table.id) : undefined}
        style={{ cursor: canMoveTable && !isMobile ? 'grab' : 'default' }}
      >
        <div className="flex items-center gap-3 flex-1">
          {table.type === 'day' && table.date ? (
            <>
              <div className="flex items-center gap-1">
                {!isMobile && (
                  <span className="text-white text-sm">
                    {formatDateWithSettings(table.date, settings?.dateFormat)}
                  </span>
                )}
                {!readOnly && (
                  <>
                    <button
                      type="button"
                      onClick={() => document.getElementById(`date-picker-${table.id}`)?.showPicker?.()}
                      className="bg-transparent border border-white/30 rounded p-1 text-white hover:bg-white/10 cursor-pointer transition"
                      title="Change date"
                    >
                      📅
                    </button>
                    <input
                      type="date"
                      value={table.date}
                      onChange={(e) => updateTableDate(table.id, e.target.value)}
                      className="hidden"
                      id={`date-picker-${table.id}`}
                    />
                  </>
                )}
              </div>
              {readOnly ? (
                <span className="text-xl font-bold text-white flex-1">
                  {isLegacyDayTitle(table.title, table.date, settings?.dateFormat)
                    ? formatDate(table.date)
                    : table.title}
                  {ownerEmail && <span className="text-sm font-normal text-white/80 ml-2">From {ownerEmail}</span>}
                </span>
              ) : (
                <input
                  type="text"
                  value={isLegacyDayTitle(table.title, table.date, settings?.dateFormat)
                    ? formatDate(table.date)
                    : table.title}
                  onChange={(e) => setTables(tables.map(t => 
                    t.id === table.id ? { ...t, title: e.target.value } : t
                  ))}
                  className="table-title-input bg-transparent border-none outline-none text-xl font-bold text-white flex-1"
                />
              )}
            </>
          ) : (
            <>
              {readOnly ? (
                <span className="text-xl font-bold text-white flex-1">
                  {table.title}
                </span>
              ) : (
                <input
                  type="text"
                  value={table.title}
                  onChange={(e) => setTables(tables.map(t => 
                    t.id === table.id ? { ...t, title: e.target.value } : t
                  ))}
                  className="table-title-input bg-transparent border-none outline-none text-xl font-bold text-white flex-1"
                />
              )}
              {readOnly && ownerEmail && (
                <span className="text-sm text-white/80">From {ownerEmail}</span>
              )}
            </>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {!isMobile && table.type === 'day' && (
            <div className="text-sm whitespace-nowrap">
              Time sum: {getTotalDuration(table)}
            </div>
          )}
          
          {/* Space assignment dropdown - only in spaces view for TODO tables. Rendered in portal so it is not clipped by overflow. */}
          {(canMoveTable || allowTableLayout) && table.type === 'todo' && spaces && handleAssignTableToSpace && (
            <div className="relative">
              <button
                ref={spaceDropdownTriggerRef}
                onClick={(e) => {
                  e.stopPropagation()
                  setSpaceDropdownOpen(!spaceDropdownOpen)
                }}
                className="bg-white/20 text-white border border-white/30 rounded px-2 py-1 text-sm cursor-pointer hover:bg-white/30 flex items-center gap-1"
                title="Assign to space"
              >
                {(() => {
                  const currentSpace = table.spaceId ? spaces.find(s => s.id === table.spaceId) : null
                  if (currentSpace) {
                    return (
                      <>
                        {currentSpace.icon && iconMap[currentSpace.icon] && (
                          <FontAwesomeIcon icon={iconMap[currentSpace.icon]} className="text-xs" />
                        )}
                        <span>{currentSpace.name}</span>
                      </>
                    )
                  }
                  return <span>All Spaces</span>
                })()}
              </button>
              
              {spaceDropdownOpen && spaceDropdownRect && createPortal(
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSpaceDropdownOpen(false)
                    }}
                  />
                  <div
                    className="fixed z-50 mt-1 bg-white border border-gray-300 rounded shadow-lg min-w-[150px] max-h-[70vh] overflow-y-auto"
                    style={{
                      top: spaceDropdownRect.bottom + 4,
                      left: spaceDropdownRect.left,
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAssignTableToSpace(table.id, null)
                        setSpaceDropdownOpen(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-700"
                    >
                      All Spaces
                    </button>
                    {spaces.map((space) => (
                      <button
                        type="button"
                        key={space.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAssignTableToSpace(table.id, space.id)
                          setSpaceDropdownOpen(false)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-700"
                      >
                        {space.icon && iconMap[space.icon] && (
                          <FontAwesomeIcon icon={iconMap[space.icon]} className="text-xs" />
                        )}
                        <span>{space.name}</span>
                      </button>
                    ))}
                  </div>
                </>,
                document.body
              )}
            </div>
          )}
          
          {(canMoveTable || allowTableLayout) && (
            <div className="flex items-center gap-1">
              {!isMobile && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleTableCollapsed(table.id); }}
                  className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded border border-white/30 bg-white/10 text-white hover:bg-white/20 transition"
                  title="Collapse/expand tasks"
                >
                  <FontAwesomeIcon icon={faMinus} className="text-base" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); deleteTable(table.id); }}
                className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded border border-white/30 bg-white/10 text-white hover:bg-red-500/80 hover:border-red-400 transition"
                title="Delete table"
              >
                <FontAwesomeIcon icon={faXmark} className="text-base" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table Controls Row */}
      <div className={`table-header bg-[#5a7c8a] text-white ${isMobile ? 'px-1 py-1' : 'px-2 py-2'} flex items-center ${isMobile ? 'gap-1' : 'gap-2'} text-xs font-semibold`}>
        {/* Select All Checkbox */}
        {!readOnly && (
          <input
            type="checkbox"
            checked={table.tasks.length > 0 && table.tasks.every(task => task.selected)}
            onChange={() => toggleSelectAll(table.id)}
            className={isMobile ? "w-3 h-3 flex-shrink-0 cursor-pointer" : "w-4 h-4 cursor-pointer"}
            title="Select all tasks"
          />
        )}
        {readOnly && <span className="w-4 flex-shrink-0" />}
        {/* Checkbox column (w-4) + Up/Down column (fixed width) */}
        {!readOnly && !isMobile && <span className="text-center" style={{ width: '44px' }}>Up|Dn</span>}
        {readOnly && !isMobile && <span style={{ width: '44px' }} />}
        {table.type === 'day' && (
          <div className="flex flex-shrink-0" style={{ gap: 0 }}>
            <span className="text-center flex-shrink-0" style={{ width: isMobile ? '2.5rem' : '5rem' }}>Start</span>
            <span className="text-center flex-shrink-0" style={{ width: isMobile ? '2.5rem' : '5rem' }}>Finish</span>
          </div>
        )}
        <span className="text-center w-6 flex-shrink-0">Group</span>
        <span className="flex-1 px-2 min-w-0">Job</span>
        <span className="text-center w-6 flex-shrink-0">Notes</span>
        <span className="text-center" style={{ width: isMobile ? '2.5rem' : '5rem' }}>Duration</span>
        {/* Add/Duplicate/Delete buttons column */}
        {!readOnly && !isMobile && <span className="text-right" style={{ width: '68px' }}>Add|Dup|Del</span>}
        {readOnly && !isMobile && <span style={{ width: '68px' }} />}
      </div>

      {/* Resize handle - desktop only, show in all-in-one and spaces views */}
      {(canMoveTable || allowTableLayout) && !isMobile && (
        <div
          onMouseDown={(e) => handleTableResizeStart(e, table.id)}
          className="absolute bottom-1 right-1 w-3 h-3 cursor-se-resize z-50"
          style={{
            backgroundRepeat: 'no-repeat',
            backgroundSize: '100% 100%',
            backgroundImage: (() => {
              // Read theme color from CSS variable for grip stroke
              const stroke = encodeURIComponent(getThemeColor('--color-text-secondary'))
              // 3 diagonal strokes; transparent background; no square fill
              return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><g stroke='${stroke}' stroke-width='1.3' stroke-linecap='round'><line x1='3' y1='10' x2='10' y2='3'/><line x1='0' y1='10' x2='10' y2='0'/><line x1='0' y1='7' x2='7' y2='0'/></g></svg>")`
            })()
          }}
          title="Resize"
        />
      )}

      {/* Task List - hidden when collapsed; on mobile always show expanded (no collapse control on mobile) */}
      {(!(table.collapsed ?? false) || isMobile) && (
      <div
        onDragOver={!readOnly ? (e) => handleDragOver(e, table.id, table.tasks.length) : undefined}
        onDragLeave={!readOnly ? handleDragLeave : undefined}
        onDrop={!readOnly ? (e) => handleDrop(e, table.id, table.tasks.length) : undefined}
      >
        {table.tasks.map((task, index) => {
          const taskTimes = times[index]
          const isDragging = draggedTask?.taskId === task.id
          const isDropTarget = dropTarget?.tableId === table.id && dropTarget?.index === index
          const isPast = taskTimes && isTaskInPast(table, taskTimes.end)
          const isCurrent = taskTimes && isTaskCurrent(table, taskTimes.start, taskTimes.end)
          const timeMatchStatus = taskTimes && table.type === 'day' ? getTaskTimeMatchStatus(task.title, taskTimes.start) : null
          
          return (
            <div key={task.id} className="relative">
              {/* Drop gap - appears between items */}
              {!readOnly && isDropTarget && (
                <div
                  className="min-h-[2.5rem] flex items-center justify-center mx-2 my-1 rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/50"
                  onDragOver={(e) => { e.preventDefault(); handleDragOver(e, table.id, index) }}
                  onDrop={(e) => handleDrop(e, table.id, index)}
                >
                  <span className="text-blue-500 text-xs">Drop here</span>
                </div>
              )}
              
              <div
                data-tutorial-target={tutorialTargets?.taskTargets?.[task.id]?.row}
                onDragOver={!readOnly && !isMobile ? (e) => {
                  e.preventDefault()
                  const rect = e.currentTarget.getBoundingClientRect()
                  const midY = rect.top + rect.height / 2
                  const insertIndex = e.clientY < midY ? index : index + 1
                  handleDragOver(e, table.id, insertIndex)
                } : undefined}
                onDragLeave={!readOnly && !isMobile ? handleDragLeave : undefined}
                onDrop={!readOnly && !isMobile ? (e) => handleDrop(e, table.id, index) : undefined}
                ref={(el) => {
                  if (!el) return
                  try {
                    const hex = getEffectiveBackgroundHex(el)
                    const color = getContrastColor(hex)
                    // cache per task to avoid extra renders
                    if ((el as any)._iconColorCache !== color) {
                      (el as any)._iconColorCache = color
                    }
                  } catch {}
                }}
                onTouchStart={undefined}
                onTouchMove={isMobile ? handleTouchMove : undefined}
                onTouchEnd={isMobile ? handleTouchEnd : undefined}
                data-table-id={table.id}
                data-task-index={index}
                style={isMobile && touchDragStart?.taskId === task.id ? { touchAction: 'none' } : undefined}
                className={`group flex items-center ${isMobile ? 'gap-0.5 px-1 min-w-0' : 'gap-2 px-2'} py-1 border-b hover:bg-gray-50 transition-all ${task.selected ? 'bg-blue-50' : ''} ${isDragging ? 'opacity-60 border-2 border-dashed !border-[#4fc3f7]' : 'border-gray-200'} ${isPast ? 'bg-gray-100' : timeMatchStatus === 'match' ? 'bg-green-200 text-green-900' : timeMatchStatus === 'mismatch' ? 'bg-red-200 text-red-900' : ''} ${isCurrent ? 'font-bold' : ''} ${highlightedTask === task.id ? 'task-highlight-pulse' : ''}`}
              >
              {/* Checkbox */}
              {readOnly ? (
                <span className={isMobile ? "w-3 h-3 flex-shrink-0" : "w-4 h-4 flex-shrink-0"} />
              ) : (
                <input
                  type="checkbox"
                  checked={task.selected}
                  onChange={() => toggleSelect(table.id, task.id)}
                  className={isMobile ? "w-3 h-3 flex-shrink-0" : "w-4 h-4"}
                />
              )}
              
              {/* Up/Down buttons */}
              {readOnly ? (
                <span className="flex-shrink-0 w-[44px]" />
              ) : isMobile ? (
                /* Mobile: Up button before task name */
                <button
                  onClick={() => moveTaskUp(table.id, index)}
                  onTouchStart={(e) => handleHandleTouchStart(e, table.id, task.id, index)}
                  onTouchEnd={handleHandleTouchEnd}
                  onTouchCancel={handleHandleTouchEnd}
                  disabled={index === 0}
                  className="text-sm text-gray-600 hover:text-gray-900 group-hover:text-gray-900 disabled:opacity-20 px-1 flex-shrink-0"
                >
                  ▲
                </button>
              ) : (
                /* Desktop: Drag handle */
                <div 
                  data-tutorial-target={tutorialTargets?.taskTargets?.[task.id]?.dragHandle}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(table.id, task.id, index, e)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center justify-center px-1 cursor-grab active:cursor-grabbing flex-shrink-0 w-[44px]"
                  title="Drag to reorder"
                >
                  <span className="text-gray-500 hover:text-gray-900 select-none">⋮⋮</span>
                </div>
              )}

              {/* Times (Day tables only) */}
              {table.type === 'day' && taskTimes && (() => {
                // Times are on row background, not task name background
                // Only compute contrast for match/mismatch/selected (which change row background)
                const timeColor = timeMatchStatus === 'match' ? 'rgb(20, 83, 45)'
                  : timeMatchStatus === 'mismatch' ? 'rgb(127, 29, 29)'
                  : task.selected ? getContrastColor('#dbeafe')
                  : 'var(--color-text)' // Use theme color for normal rows
                
                return (
                <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
                  {/* Start time - editable only for first task */}
                  {index === 0 ? (
                    readOnly ? (
                      <span
                        style={{
                          width: isMobile ? '2.5rem' : '5rem',
                          height: '1.5rem',
                          lineHeight: '1.5rem',
                          padding: '0',
                          margin: '0',
                          textAlign: 'center',
                          fontSize: isMobile ? '0.75rem' : '0.875rem',
                          color: timeColor,
                          boxSizing: 'border-box',
                          display: 'block',
                          flexShrink: 0
                        }}>
                        {formatTime(table.startTime || '08:00')}
                      </span>
                    ) : settings.useTimePickers ? (
                      <div
                        data-tutorial-target={tutorialTargets?.dayStart}
                        onClick={() => setTimePickerTable(table.id)}
                        className="cursor-pointer hover:bg-gray-100 active:bg-gray-200"
                        style={{
                          width: isMobile ? '2.5rem' : '5rem',
                          height: '1.5rem',
                          lineHeight: '1.5rem',
                          textAlign: 'center',
                          fontSize: isMobile ? '0.75rem' : '0.875rem',
                          color: timeColor,
                          display: 'block',
                          flexShrink: 0,
                          padding: 0,
                          margin: 0,
                          boxSizing: 'border-box'
                        }}
                      >
                        {formatTime(table.startTime || '08:00')}
                      </div>
                    ) : (
                      <input
                        type="text"
                        data-tutorial-target={tutorialTargets?.dayStart}
                        defaultValue={formatTime(table.startTime || '08:00')}
                        key={`${table.id}-starttime-${table.startTime}-${settings.timeFormat}`}
                        onBlur={(e) => {
                          const time24 = parseTime(e.target.value)
                          updateTableStartTime(table.id, time24)
                          e.target.value = formatTime(time24)
                        }}
                        style={{
                          width: isMobile ? '2.5rem' : '5rem',
                          height: '1.5rem',
                          lineHeight: '1.5rem',
                          padding: '0',
                          margin: '0',
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          textAlign: 'center',
                          fontSize: isMobile ? '0.75rem' : '0.875rem',
                          color: timeColor,
                          boxSizing: 'border-box',
                          display: 'block',
                          flexShrink: 0
                        }}
                        placeholder={settings.timeFormat === 12 ? '08:00 AM' : '08:00'}
                      />
                    )
                  ) : (
                    <span
                      style={{
                        width: isMobile ? '2.5rem' : '5rem',
                        height: '1.5rem',
                        lineHeight: '1.5rem',
                        padding: '0',
                        margin: '0',
                        textAlign: 'center',
                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                        color: timeColor,
                        boxSizing: 'border-box',
                        display: 'block',
                        flexShrink: 0
                      }}>
                      {formatTime(taskTimes.start)}
                    </span>
                  )}
                  
                  {/* End time - always read-only */}
                  <span
                    style={{
                      width: isMobile ? '2.5rem' : '5rem',
                      height: '1.5rem',
                      lineHeight: '1.5rem',
                        padding: '0',
                        margin: '0',
                        textAlign: 'center',
                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                        color: timeColor,
                        boxSizing: 'border-box',
                        display: 'block',
                        flexShrink: 0
                      }}>
                    {formatTime(taskTimes.end)}
                  </span>
                </div>
                )
              })()}

              {/* Group Icon */}
              {(() => {
                const group = getTaskGroup(task.group)
                // Compute row background from known state (priority: match/mismatch > group color > selected > past > white)
                // Group color takes priority over selected/past since it's the most visible background
                let rowBgHex: string
                if (timeMatchStatus === 'match') {
                  rowBgHex = '#bbf7d0' // green-200
                } else if (timeMatchStatus === 'mismatch') {
                  rowBgHex = '#fecaca' // red-200
                } else if (group?.color && !task.selected) {
                  // Group color background (unless selected overrides it)
                  rowBgHex = group.color
                } else if (task.selected) {
                  rowBgHex = '#dbeafe' // blue-50
                } else if (isPast) {
                  rowBgHex = '#f3f4f6' // gray-100
                } else {
                  rowBgHex = '#ffffff' // white
                }
                const iconColor = getContrastColor(rowBgHex)
                // Strong outline using multiple drop-shadows for visibility on any background
                const isDark = iconColor === '#ffffff'
                const outlineColor = isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)'
                const iconOutline = `drop-shadow(0 0 2px ${outlineColor}) drop-shadow(0 0 2px ${outlineColor}) drop-shadow(0 0 1px ${outlineColor})`
                
                return group?.icon && iconMap[group.icon] ? (
                  readOnly ? (
                    <span className="flex-shrink-0 px-1">
                      <FontAwesomeIcon 
                        icon={iconMap[group.icon]} 
                        style={{ 
                          color: iconColor, 
                          filter: iconOutline,
                          WebkitFilter: iconOutline
                        }} 
                        size={isMobile ? 'sm' : '1x'} 
                      />
                    </span>
                  ) : (
                    <button
                      onClick={() => setGroupSelectorTask({ tableId: table.id, taskId: task.id })}
                      className="flex-shrink-0 px-1 hover:opacity-70 transition"
                      title={`Group: ${group.name}`}
                    >
                      <FontAwesomeIcon 
                        icon={iconMap[group.icon]} 
                        style={{ 
                          color: iconColor, 
                          filter: iconOutline,
                          WebkitFilter: iconOutline
                        }} 
                        size={isMobile ? 'sm' : '1x'} 
                      />
                    </button>
                  )
                ) : (
                  readOnly ? (
                    <span className="flex-shrink-0 px-1 text-gray-400">
                      <span className={isMobile ? 'text-xs' : 'text-sm'}>●</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => setGroupSelectorTask({ tableId: table.id, taskId: task.id })}
                      className="flex-shrink-0 px-1 text-gray-400 hover:text-gray-600 transition"
                      title="Set group"
                    >
                      <span className={isMobile ? 'text-xs' : 'text-sm'}>●</span>
                    </button>
                  )
                )
              })()}

              {/* Task Name */}
              <div 
                className={`flex-1 relative min-w-0 ${tutorialTargets ? 'min-w-[8rem]' : ''}`}
                onMouseEnter={!readOnly ? () => setHoveredTask(task.id) : undefined}
                onMouseLeave={!readOnly ? () => setHoveredTask(null) : undefined}
              >
                {readOnly ? (
                  <span
                    className={`w-full ${isMobile ? 'px-1 text-sm' : 'px-2'} py-1 ${isCurrent ? 'font-bold' : ''}`}
                    style={{
                      backgroundColor: task.selected ? 'transparent' : (getTaskGroup(task.group)?.color || 'transparent'),
                      color: (getTaskGroup(task.group)?.color || timeMatchStatus !== null || task.selected)
                        ? (task.selected ? '#1f2937' : getContrastColor(getTaskGroup(task.group)?.color || '#ffffff'))
                        : 'var(--color-text)',
                    }}
                  >
                    {task.title || '\u00A0'}
                  </span>
                ) : (
                <input
                  type="text"
                  data-tutorial-target={tutorialTargets?.taskTargets?.[task.id]?.name}
                  value={task.title}
                  onChange={(e) => updateTask(table.id, task.id, 'title', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      addTask(table.id, index)
                      // Focus the next task input after a brief delay
                      setTimeout(() => {
                        const nextInput = document.querySelector<HTMLInputElement>(`#task-input-${table.id}-${index + 1}`)
                        if (nextInput) nextInput.focus()
                      }, 100)
                    }
                  }}
                  onTouchStart={(e) => startMoveLongPress(e, table.id, index)}
                  onTouchEnd={cancelMoveLongPress}
                  onTouchMove={cancelMoveLongPress}
                  id={`task-input-${table.id}-${index}`}
                  style={tutorialTargets ? {
                    backgroundColor: '#ffffff',
                    color: '#111827',
                    border: '1px solid #d1d5db',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    fontSize: isMobile ? '0.75rem' : undefined,
                    touchAction: 'manipulation',
                  } : {
                    backgroundColor: task.selected ? 'transparent' : (getTaskGroup(task.group)?.color || 'transparent'),
                    color: (getTaskGroup(task.group)?.color || timeMatchStatus !== null || task.selected)
                      ? (task.selected ? '#1f2937' : getContrastColor(getTaskGroup(task.group)?.color || '#ffffff'))
                      : 'var(--color-text)',
                    fontSize: isMobile ? '0.75rem' : undefined,
                    touchAction: 'manipulation',
                  }}
                  className={`w-full ${isMobile ? 'px-1 text-sm' : 'px-2'} py-1 outline-none ${isCurrent ? 'font-bold' : ''} ${task.selected ? '' : 'group-hover:!bg-transparent'} ${tutorialTargets ? 'rounded' : 'border-none'}`}
                  placeholder="Task name..."
                />
                )}
                {!readOnly && hoveredTask === task.id && task.title && (
                  <div 
                    className="absolute left-0 bottom-full mb-1 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none"
                  >
                    {task.title}
                  </div>
                )}
              </div>

              {/* Notebook Icon */}
              {readOnly ? (
                <span className="flex-shrink-0 px-1">
                  {task.notebook && (
                    <FontAwesomeIcon 
                      icon={faBookOpen} 
                      className="text-blue-600"
                      size={isMobile ? 'sm' : '1x'} 
                    />
                  )}
                </span>
              ) : (
                <button
                  onClick={(e) => openTaskNotebook(table.id, task.id, e.currentTarget)}
                  className="flex-shrink-0 px-1 hover:opacity-70 transition"
                  title={task.notebook ? "View notes" : "Add notes"}
                >
                  <FontAwesomeIcon 
                    icon={faBookOpen} 
                    className={task.notebook ? "text-blue-600" : "text-gray-400"}
                    size={isMobile ? 'sm' : '1x'} 
                  />
                </button>
              )}

              {/* Mobile: Down button after task name */}
              {!readOnly && isMobile && (
                <button
                  onClick={() => moveTaskDown(table.id, index)}
                  onTouchStart={(e) => handleHandleTouchStart(e, table.id, task.id, index)}
                  onTouchEnd={handleHandleTouchEnd}
                  onTouchCancel={handleHandleTouchEnd}
                  disabled={index >= table.tasks.length - 1}
                  className="text-sm text-gray-600 hover:text-gray-900 group-hover:text-gray-900 disabled:opacity-20 px-1 flex-shrink-0"
                >
                  ▼
                </button>
              )}

              {/* Duration */}
              {(() => {
                // Duration is on row background, not task name background
                // Only compute contrast for match/mismatch/selected (which change row background)
                const durationColor = timeMatchStatus === 'match' ? 'rgb(20, 83, 45)'
                  : timeMatchStatus === 'mismatch' ? 'rgb(127, 29, 29)'
                  : task.selected ? getContrastColor('#dbeafe')
                  : 'var(--color-text)' // Use theme color for normal rows
                
                return readOnly ? (
                  <span
                    className="py-1 text-sm text-center flex-shrink-0"
                    style={{ 
                      color: durationColor, 
                      width: isMobile ? '2.5rem' : '5rem',
                      padding: '0.25rem 0',
                      boxSizing: 'border-box'
                    }}
                  >
                    {formatDuration(task.duration)}
                  </span>
                ) : settings.useTimePickers ? (
                  <div
                    data-duration-wheel
                    data-tutorial-target={tutorialTargets?.taskTargets?.[task.id]?.duration}
                    onClick={() => setDurationPickerTask({ tableId: table.id, taskId: task.id })}
                    onWheel={!isMobile ? (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const step = e.shiftKey ? 1 : (e.altKey ? 15 : 5)
                      const delta = e.deltaY < 0 ? step : -step
                      const current = task.duration || 0
                      const next = Math.max(0, current + delta)
                      updateTask(table.id, task.id, 'duration', next)
                    } : undefined}
                    className="py-1 border border-gray-300 rounded text-sm text-center flex-shrink-0 cursor-pointer hover:bg-gray-50 active:bg-gray-100"
                    style={{ 
                      color: durationColor, 
                      width: isMobile ? '2.5rem' : '5rem',
                      padding: '0.25rem 0',
                      boxSizing: 'border-box'
                    }}
                  >
                    {formatDuration(task.duration)}
                  </div>
                ) : (
                  <input
                    type="text"
                    data-tutorial-target={tutorialTargets?.taskTargets?.[task.id]?.duration}
                    defaultValue={formatDuration(task.duration)}
                    key={`${table.id}-${task.id}-${task.duration}`}
                    onBlur={(e) => {
                      const minutes = parseDuration(e.target.value)
                      if (minutes >= 0) {
                        updateTask(table.id, task.id, 'duration', minutes)
                      }
                      e.target.value = formatDuration(minutes || task.duration)
                    }}
                    className="py-1 border border-gray-300 rounded text-sm text-center flex-shrink-0"
                    style={{ 
                      color: durationColor, 
                      width: isMobile ? '2.5rem' : '5rem',
                      padding: '0.25rem 0',
                      boxSizing: 'border-box'
                    }}
                    placeholder="00:00"
                  />
                )
              })()}

              {/* Add Below / Duplicate / Delete - desktop only, mobile has ADD TASK button at bottom */}
              {!isMobile && (
                readOnly ? (
                  <span className="w-[68px] flex-shrink-0" />
                ) : (
                <div className="flex gap-1 justify-end w-[68px] flex-shrink-0">
                  <button
                    onClick={() => addTask(table.id, index)}
                    className="text-green-600 hover:text-green-800 text-lg px-1"
                    title="Add task below"
                  >
                    {showEmoji ? '➕' : '+'}
                  </button>
                  <button
                    onClick={() => duplicateTask(table.id, task.id, index)}
                    className="text-blue-600 hover:text-blue-800 text-lg px-1"
                    title="Duplicate task"
                  >
                    {showEmoji ? '🗐' : '⎘'}
                  </button>
                  <button
                    onClick={() => deleteTask(table.id, task.id)}
                    className="text-red-600 hover:text-red-800 text-lg px-1"
                    title="Delete task"
                  >
                    {showEmoji ? '🗑️' : 'X'}
                  </button>
                </div>
                )
              )}
            </div>
            </div>
          )
        })
        
        /* Drop zone at end of list */}
        <div 
          className={`min-h-[40px] flex items-center justify-center text-sm relative ${!readOnly && dropTarget?.tableId === table.id && dropTarget?.index === table.tasks.length ? 'mx-2 my-1 rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/50' : 'text-gray-400'}`}
          onDragOver={!readOnly ? (e) => handleDragOver(e, table.id, table.tasks.length) : undefined}
          onDrop={!readOnly ? (e) => handleDrop(e, table.id, table.tasks.length) : undefined}
          data-table-id={table.id}
          data-task-index={table.tasks.length}
        >
          {table.tasks.length === 0 && !draggedTask && (
            <span>No tasks yet - drag here or click "ADD TASK" below</span>
          )}
        </div>
      </div>
      )}
      {(table.collapsed ?? false) && !isMobile && (
        <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-200">
          {table.tasks.length} task{table.tasks.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Table Footer Controls */}
      {!readOnly && (
      <div className="bg-gray-50 px-4 py-3 rounded-b-lg flex gap-2 flex-wrap items-center">
        {/* Actions Dropdown */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setBulkActionsOpen(bulkActionsOpen === table.id ? null : table.id)
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition text-sm flex items-center gap-2"
          >
            {showEmoji && '⚡ '}Actions
            <span className="text-xs">▼</span>
          </button>
          
          {bulkActionsOpen === table.id && (
            <div className="absolute left-0 bottom-full mb-1 bg-white border border-gray-300 rounded shadow-lg min-w-[180px] z-20">
              <button
                onClick={() => { archiveTable(table.id); setBulkActionsOpen(null); }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition border-b border-gray-200"
                style={{ color: 'var(--color-text)' }}
              >
                Archive Table
              </button>
              <button
                onClick={() => { duplicateTable(table.id); setBulkActionsOpen(null); }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition border-b border-gray-200"
                style={{ color: 'var(--color-text)' }}
              >
                Duplicate Table
              </button>
              {shareTable && (
                <button
                  onClick={() => { shareTable(table); setBulkActionsOpen(null); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition border-b border-gray-200"
                  style={{ color: 'var(--color-text)' }}
                >
                  Share Table
                </button>
              )}
              <button
                onClick={() => { setBulkGroupSelectorTable(table.id); setBulkActionsOpen(null); }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition border-b border-gray-200"
              >
                Add selected to group
              </button>
              <button
                onClick={() => { exportTableToMarkdown(table); setBulkActionsOpen(null); }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition border-b border-gray-200"
                title="Export this table to Markdown review file"
              >
                Export Review
              </button>
              <button
                onClick={() => { deleteSelected(table.id); setBulkActionsOpen(null); }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition"
              >
                Delete selected
              </button>
            </div>
          )}
        </div>
        {onPushSharedChanges && (table._shared?.canEdit || isSharedByOwner) && (
          <button
            onClick={() => onPushSharedChanges(table)}
            className="px-4 py-2 bg-[#4a6c7a] text-white rounded hover:bg-[#3d5d6a] transition text-sm"
          >
            Push changes
          </button>
        )}
        <button
          onClick={() => addTask(table.id)}
          className="ml-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
        >
          ADD TASK
        </button>
      </div>
      )}
    </div>
  )
}

