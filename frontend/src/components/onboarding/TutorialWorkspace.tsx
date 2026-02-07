import { useState, useCallback, useEffect, useRef } from 'react'
import { TableComponent } from '../TableComponent'
import { TutorialOverlay } from './TutorialOverlay'
import { TimePicker } from '../TimePicker'
import { DurationPicker } from '../DurationPicker'
import { getDemoTables, type DemoTable } from '../../utils/onboardingDemoData'
import { tutorialSteps, tutorialButtons } from '../../utils/onboardingStrings'
import { loadSettings } from '../../utils/storage'
import { formatDateWithWeekday } from '../../utils/dateFormat'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBriefcase, faUser, faHome } from '@fortawesome/free-solid-svg-icons'

// Minimal iconMap for tutorial (groups use default)
const iconMap: Record<string, any> = {
  briefcase: faBriefcase,
  user: faUser,
  home: faHome,
}

// Helpers (duplicated from Workspace for tutorial isolation)
const getContrastColor = (hexColor?: string): string => {
  if (!hexColor) return '#000000'
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

const getThemeColor = (varName: string): string => {
  if (typeof window === 'undefined') return '#000000'
  const computed = getComputedStyle(document.documentElement)
  return computed.getPropertyValue(varName).trim() || '#000000'
}

const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const cssColorToHex = (css: string): string => {
  if (!css) return '#ffffff'
  if (css.startsWith('#')) return css
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (m) {
    const r = parseInt(m[1], 10)
    const g = parseInt(m[2], 10)
    const b = parseInt(m[3], 10)
    const a = m[4] !== undefined ? parseFloat(m[4]) : 1
    if (a === 0) return '#ffffff'
    return rgbToHex(r, g, b)
  }
  return '#ffffff'
}

const getEffectiveBackgroundHex = (el: HTMLElement | null): string => {
  let node: HTMLElement | null = el
  while (node) {
    const bg = window.getComputedStyle(node).backgroundColor
    if (bg && !/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(bg) && bg !== 'transparent') {
      return cssColorToHex(bg)
    }
    node = node.parentElement
  }
  return '#ffffff'
}

interface TutorialWorkspaceProps {
  step: number
  onStepChange: (step: number) => void
  onFinish: () => void
  isMobile?: boolean
}

export function TutorialWorkspace({
  step,
  onStepChange,
  onFinish,
  isMobile = false,
}: TutorialWorkspaceProps) {
  const [demoTables, setDemoTables] = useState<DemoTable[]>(() => getDemoTables())
  const [draggedTask, setDraggedTask] = useState<{ tableId: string; taskId: string; index: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ tableId: string; index: number } | null>(null)
  const [tableActionMenu, setTableActionMenu] = useState<string | null>(null)
  const [timePickerTable, setTimePickerTable] = useState<string | null>(null)
  const [durationPickerTask, setDurationPickerTask] = useState<{ tableId: string; taskId: string } | null>(null)
  const [groupSelectorTask, setGroupSelectorTask] = useState<{ tableId: string; taskId: string } | null>(null)
  const [bulkActionsOpen, setBulkActionsOpen] = useState<string | null>(null)
  const [bulkGroupSelectorTable, setBulkGroupSelectorTable] = useState<string | null>(null)
  const [hoveredTask, setHoveredTask] = useState<string | null>(null)
  const [moveMenu, setMoveMenu] = useState<{ tableId: string; taskIndex: number } | null>(null)
  const moveLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [currentTableIndex, setCurrentTableIndex] = useState(0)

  const savedSettings = loadSettings()
  const settings = {
    defaultDuration: savedSettings?.defaultDuration ?? 30,
    defaultStartTime: savedSettings?.defaultStartTime ?? '08:00',
    timeFormat: savedSettings?.timeFormat ?? 24,
    dateFormat: savedSettings?.dateFormat ?? 'DD. MM. YYYY',
    useTimePickers: savedSettings?.useTimePickers ?? true,
  }

  const addMinutes = (time: string, minutes: number): string => {
    const [h, m] = time.split(':').map(Number)
    const totalMinutes = h * 60 + m + minutes
    const hours = Math.floor(totalMinutes / 60) % 24
    const mins = totalMinutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  const calculateTimes = useCallback((table: DemoTable): { start: string; end: string }[] => {
    const times: { start: string; end: string }[] = []
    let currentTime = table.startTime || settings.defaultStartTime
    table.tasks.forEach((task) => {
      const start = currentTime
      const end = addMinutes(start, task.duration)
      times.push({ start, end })
      currentTime = end
    })
    return times
  }, [settings.defaultStartTime])

  const formatDuration = (minutes: number): string => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  const parseDuration = (timeStr: string): number => {
    if (!timeStr) return 0
    if (!timeStr.includes(':')) {
      const minutes = parseInt(timeStr, 10)
      return isNaN(minutes) ? 0 : minutes
    }
    const [h, m] = timeStr.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  const formatTime = (time24: string): string => {
    if (!time24 || settings.timeFormat === 24) return time24
    const [hours, minutes] = time24.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    return `${hours12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const parseTime = (timeStr: string): string => {
    if (!timeStr) return '08:00'
    if (!timeStr.includes('AM') && !timeStr.includes('PM')) return timeStr
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (!match) return '08:00'
    let hours = parseInt(match[1], 10)
    const minutes = match[2]
    const period = match[3].toUpperCase()
    if (period === 'PM' && hours !== 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0
    return `${hours.toString().padStart(2, '0')}:${minutes}`
  }

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'Unknown Date'
    return formatDateWithWeekday(dateStr, settings.dateFormat)
  }

  const getTotalDuration = (table: DemoTable): string => {
    const total = table.tasks.reduce((sum, task) => sum + task.duration, 0)
    return formatDuration(total)
  }

  const isTaskInPast = (): boolean => false
  const isTaskCurrent = (): boolean => false
  const getTaskTimeMatchStatus = (): 'match' | 'mismatch' | null => null
  const getTaskGroup = () => ({ id: 'general', name: 'General', icon: '', color: undefined })

  const resetDemo = () => {
    setDemoTables(getDemoTables())
    setCurrentTableIndex(0)
  }

  // Step completion detection
  const canProceed = (() => {
    const s = tutorialSteps[step]
    if (s?.isInfoStep) return true
    switch (step) {
      case 0:
        return true // Welcome - Next enabled
      case 1:
        return true // User must change start time - we detect via updateTableStartTime
      case 2:
        return true // User must edit task name - we detect via updateTask
      case 3:
        return true // User must set duration
      case 4:
        return true // User must fine-tune duration
      case 5:
        return true // Info step
      case 6:
        return true // User must reorder - we detect via moveTaskUp/Down or handleDrop
      case 7:
        return true // User must move TODO→Day
      case 8:
        return true // User must move Day→TODO
      case 9:
        return true // Final - any button
      default:
        return true
    }
  })()

  const updateTableStartTime = (tableId: string, time: string) => {
    setDemoTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, startTime: time } : t))
    )
    // No auto-advance: user clicks Next to proceed
  }

  const updateTask = (tableId: string, taskId: string, field: string, value: any) => {
    setDemoTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t
        return {
          ...t,
          tasks: t.tasks.map((task) =>
            task.id === taskId ? { ...task, [field]: value } : task
          ),
        }
      })
    )
    // No auto-advance on title or duration: user clicks Next to proceed
  }

  const moveTaskUp = (tableId: string, index: number) => {
    if (index === 0) return
    setDemoTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t
        const newTasks = [...t.tasks]
        ;[newTasks[index - 1], newTasks[index]] = [newTasks[index], newTasks[index - 1]]
        return { ...t, tasks: newTasks }
      })
    )
    if (step === 6) onStepChange(step + 1)
  }

  const moveTaskDown = (tableId: string, index: number) => {
    setDemoTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId || index >= t.tasks.length - 1) return t
        const newTasks = [...t.tasks]
        ;[newTasks[index], newTasks[index + 1]] = [newTasks[index + 1], newTasks[index]]
        return { ...t, tasks: newTasks }
      })
    )
    if (step === 6) onStepChange(step + 1)
  }

  const handleDragStart = (tableId: string, taskId: string, index: number) => {
    setDraggedTask({ tableId, taskId, index })
  }

  const handleDragEnd = () => {
    setDraggedTask(null)
    setDropTarget(null)
  }

  const handleDragOver = (e: React.DragEvent, tableId: string, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDropTarget({ tableId, index })
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.currentTarget === e.target) setDropTarget(null)
  }

  const handleDrop = (e: React.DragEvent, targetTableId: string, targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedTask) return
    if (draggedTask.tableId === targetTableId && draggedTask.index === targetIndex) {
      setDraggedTask(null)
      setDropTarget(null)
      return
    }

    const sourceTable = demoTables.find((t) => t.id === draggedTask.tableId)
    const targetTable = demoTables.find((t) => t.id === targetTableId)
    if (!sourceTable || !targetTable) return

    setDemoTables((prev) => {
      const newTables = prev.map((t) => ({ ...t, tasks: [...t.tasks] }))
      const sIdx = newTables.findIndex((t) => t.id === draggedTask.tableId)
      const tIdx = newTables.findIndex((t) => t.id === targetTableId)
      if (sIdx === -1 || tIdx === -1) return prev
      const [movedTask] = newTables[sIdx].tasks.splice(draggedTask.index, 1)
      let insertIndex = targetIndex
      if (draggedTask.tableId === targetTableId && draggedTask.index < targetIndex) {
        insertIndex = targetIndex - 1
      }
      newTables[tIdx].tasks.splice(insertIndex, 0, movedTask)
      return newTables
    })

    if (step === 8 && draggedTask.tableId === 'demo-todo' && targetTableId === 'demo-day') {
      onStepChange(step + 1)
    }
    if (step === 9 && draggedTask.tableId === 'demo-day' && targetTableId === 'demo-todo') {
      onStepChange(step + 1)
    }

    setDraggedTask(null)
    setDropTarget(null)
  }

  const startMoveLongPress = (e: React.TouchEvent, tableId: string, taskIndex: number) => {
    if (!isMobile) return
    if (moveLongPressTimer.current) window.clearTimeout(moveLongPressTimer.current)
    moveLongPressTimer.current = window.setTimeout(() => {
      navigator.vibrate?.(10)
      setMoveMenu({ tableId, taskIndex })
    }, 500)
  }

  const cancelMoveLongPress = () => {
    if (moveLongPressTimer.current) {
      window.clearTimeout(moveLongPressTimer.current)
      moveLongPressTimer.current = null
    }
  }

  const moveTaskToTable = (sourceTableId: string, taskIndex: number, targetTableId: string) => {
    if (sourceTableId === targetTableId) return
    setDemoTables((prev) => {
      const newTables = prev.map((t) => ({ ...t, tasks: [...t.tasks] }))
      const sIdx = newTables.findIndex((t) => t.id === sourceTableId)
      const tIdx = newTables.findIndex((t) => t.id === targetTableId)
      if (sIdx === -1 || tIdx === -1) return prev
      const [moved] = newTables[sIdx].tasks.splice(taskIndex, 1)
      newTables[tIdx].tasks.push(moved)
      return newTables
    })
    setMoveMenu(null)
    if (step === 8 && sourceTableId === 'demo-todo' && targetTableId === 'demo-day') {
      onStepChange(step + 1)
    }
    if (step === 9 && sourceTableId === 'demo-day' && targetTableId === 'demo-todo') {
      onStepChange(step + 1)
    }
  }

  const duplicateTask = (tableId: string, taskId: string, taskIndex: number) => {
    const table = demoTables.find((t) => t.id === tableId)
    const task = table?.tasks.find((t) => t.id === taskId)
    if (!task) return
    const newTask = { ...task, id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}` }
    setDemoTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t
        const newTasks = [...t.tasks]
        newTasks.splice(taskIndex + 1, 0, newTask)
        return { ...t, tasks: newTasks }
      })
    )
    setMoveMenu(null)
  }

  const handleNext = () => {
    if (step === tutorialSteps.length - 1) {
      onFinish()
    } else {
      let next = step + 1
      if (isMobile && next === 4) next = 5
      if (!isMobile && next === 7) next = 8
      onStepChange(next)
    }
  }

  const handleBack = () => {
    if (step <= 0) return
    let prev = step - 1
    if (isMobile && prev === 4) prev = 3
    if (!isMobile && prev === 7) prev = 6
    onStepChange(prev)
  }

  const handleSkip = () => onFinish()

  // Tutorial targets for each step
  const tutorialTargets = (() => {
    const dayStart = step === 1 ? 'day-start' : undefined
    const taskTargets: Record<string, { name?: string; duration?: string; dragHandle?: string; row?: string }> = {}
    if (step === 2) taskTargets['demo-breakfast'] = { name: 'task-breakfast-name' }
    if (step === 3 || step === 4) taskTargets['demo-plan'] = { duration: 'task-plan-duration' }
    if (step === 6) taskTargets['demo-exercise'] = {
      dragHandle: 'task-exercise-drag',
      row: 'task-exercise-row', // mobile: Up/Down buttons live in row
    }
    if (step === 8 || step === 9) taskTargets['demo-email-triage'] = { name: 'task-email-triage-name' }
    return { dayStart, taskTargets }
  })()

  const stepData = tutorialSteps[step]
  const targetSelector = (isMobile && stepData?.targetMobile) ? stepData.targetMobile : stepData?.target
  const isInfoStep = stepData?.isInfoStep ?? false

  // Escape key closes tutorial (escape hatch if overlay is not visible)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onFinish])

  // On mobile, auto-switch table for steps 8 (TODO) and 9 (Day)
  useEffect(() => {
    if (!isMobile) return
    if (step === 8) setCurrentTableIndex(Math.max(0, demoTables.findIndex((t) => t.id === 'demo-todo')))
    else if (step === 9) setCurrentTableIndex(Math.max(0, demoTables.findIndex((t) => t.id === 'demo-day')))
  }, [isMobile, step, demoTables])

  // Keep currentTableIndex in bounds
  useEffect(() => {
    if (demoTables.length > 0 && currentTableIndex >= demoTables.length) {
      setCurrentTableIndex(demoTables.length - 1)
    }
  }, [demoTables.length, currentTableIndex])

  // Skip step 4 (Fine-tune fast) on mobile - no mouse wheel
  useEffect(() => {
    if (!isMobile || step !== 4) return
    onStepChange(5)
  }, [isMobile, step, onStepChange])

  // Skip step 7 (Switch tables) on desktop - no dropdown
  useEffect(() => {
    if (isMobile || step !== 7) return
    onStepChange(8)
  }, [isMobile, step, onStepChange])

  const safeTableIndex = Math.min(currentTableIndex, Math.max(0, demoTables.length - 1))
  const tablesToShow = isMobile
    ? [demoTables[safeTableIndex]].filter(Boolean)
    : demoTables

  const totalStepsDisplay = isMobile ? tutorialSteps.length - 1 : tutorialSteps.length - 1
  const stepDisplay = isMobile
    ? (step < 4 ? step + 1 : step)
    : (step <= 6 ? step + 1 : step)

  return (
    <div className="fixed inset-0 z-[170] flex flex-col bg-gray-100">
      {/* Header: Tutorial title, reset */}
      <div className="flex-shrink-0 px-4 py-2 bg-[#4a6c7a] text-white flex justify-between items-center">
        <span className="font-medium">Tutorial</span>
        <button
          type="button"
          onClick={resetDemo}
          className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 rounded transition"
        >
          {tutorialButtons.resetDemo}
        </button>
      </div>

      {/* Demo tables area */}
      <div className="flex-1 overflow-auto p-4">
        <div
          className="relative min-h-full"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {tablesToShow.map((table) => {
            const times = table.type === 'day' ? calculateTimes(table) : []
            const targets = table.id === 'demo-day'
              ? { ...tutorialTargets }
              : { dayStart: undefined, taskTargets: tutorialTargets.taskTargets }
            return (
              <div
                key={table.id}
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 500,
                }}
              >
                <TableComponent
                  table={table as any}
                  times={times}
                  isDraggingTable={false}
                  tableZIndex={1}
                  isMobile={isMobile}
                  zoom={1}
                  settings={settings}
                  showEmoji={true}
                  iconMap={iconMap}
                  viewMode="all-in-one"
                  tableActionMenu={tableActionMenu}
                  setTableActionMenu={setTableActionMenu}
                  timePickerTable={timePickerTable}
                  setTimePickerTable={setTimePickerTable}
                  durationPickerTask={durationPickerTask}
                  setDurationPickerTask={setDurationPickerTask}
                  groupSelectorTask={groupSelectorTask}
                  setGroupSelectorTask={setGroupSelectorTask}
                  bulkActionsOpen={bulkActionsOpen}
                  setBulkActionsOpen={setBulkActionsOpen}
                  bulkGroupSelectorTable={bulkGroupSelectorTable}
                  setBulkGroupSelectorTable={setBulkGroupSelectorTable}
                  hoveredTask={hoveredTask}
                  setHoveredTask={setHoveredTask}
                  highlightedTask={null}
                  draggedTask={draggedTask}
                  dropTarget={dropTarget}
                  draggedTable={null}
                  touchDragStart={null}
                  handleTableDragStart={() => {}}
                  handleTableResizeStart={() => {}}
                  updateTableDate={() => {}}
                  setTables={setDemoTables as any}
                  archiveTable={() => {}}
                  deleteTable={() => {}}
                  toggleSelectAll={() => {}}
                  updateTableStartTime={updateTableStartTime}
                  handleDragOver={handleDragOver}
                  handleDragLeave={handleDragLeave}
                  handleDrop={handleDrop}
                  toggleSelect={() => {}}
                  moveTaskUp={moveTaskUp}
                  moveTaskDown={moveTaskDown}
                  handleHandleTouchStart={() => {}}
                  handleHandleTouchEnd={() => {}}
                  handleDragStart={handleDragStart}
                  handleDragEnd={handleDragEnd}
                  handleTouchMove={() => {}}
                  handleTouchEnd={() => {}}
                  updateTask={updateTask}
                  startMoveLongPress={startMoveLongPress}
                  cancelMoveLongPress={cancelMoveLongPress}
                  openTaskNotebook={() => {}}
                  addTask={() => {}}
                  duplicateTask={() => {}}
                  deleteTask={() => {}}
                  deleteSelected={() => {}}
                  exportTableToMarkdown={() => {}}
                  formatDate={formatDate}
                  formatTime={formatTime}
                  parseTime={parseTime}
                  formatDuration={formatDuration}
                  parseDuration={parseDuration}
                  getTotalDuration={getTotalDuration}
                  isTaskInPast={isTaskInPast}
                  isTaskCurrent={isTaskCurrent}
                  getTaskTimeMatchStatus={getTaskTimeMatchStatus}
                  getTaskGroup={getTaskGroup}
                  getContrastColor={getContrastColor}
                  getEffectiveBackgroundHex={getEffectiveBackgroundHex}
                  getThemeColor={getThemeColor}
                  tables={demoTables as any}
                  tutorialTargets={targets}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile table switcher - same as real app: dropdown at bottom */}
      {isMobile && demoTables.length > 1 && (
        <div className="flex-shrink-0 flex justify-between items-center gap-2 p-3 bg-gray-100 border-t-2 border-gray-300">
          <button
            type="button"
            onClick={() => setCurrentTableIndex(Math.max(0, safeTableIndex - 1))}
            disabled={safeTableIndex === 0}
            className="px-3 py-2 bg-[#4a6c7a] text-white rounded disabled:opacity-30 hover:bg-[#3a5c6a] transition text-sm whitespace-nowrap"
          >
            ← Previous
          </button>
          <select
            value={safeTableIndex}
            onChange={(e) => {
              const idx = Number(e.target.value)
              setCurrentTableIndex(idx)
              if (step === 7) onStepChange(8)
            }}
            data-tutorial-target="tutorial-table-dropdown"
            className="flex-1 px-2 py-2 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
          >
            {demoTables.map((table, index) => (
              <option key={table.id} value={index}>
                {table.type === 'day' && table.date ? formatDate(table.date) : table.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCurrentTableIndex(Math.min(demoTables.length - 1, safeTableIndex + 1))}
            disabled={safeTableIndex === demoTables.length - 1}
            className="px-3 py-2 bg-[#4a6c7a] text-white rounded disabled:opacity-30 hover:bg-[#3a5c6a] transition text-sm whitespace-nowrap"
          >
            Next →
          </button>
        </div>
      )}

      <TutorialOverlay
        step={step}
        totalSteps={tutorialSteps.length}
        totalStepsDisplay={totalStepsDisplay}
        onBack={handleBack}
        onNext={handleNext}
        onSkip={handleSkip}
        canProceed={canProceed}
        targetSelector={targetSelector}
        isInfoStep={isInfoStep}
        isMobile={isMobile}
        stepDisplay={stepDisplay}
        finalStepButtons={(
          <button
            type="button"
            onClick={onFinish}
            className="w-full px-4 py-2 bg-[#4fc3f7] hover:bg-[#3ba3d7] text-white font-medium rounded transition text-sm"
          >
            {tutorialButtons.finish}
          </button>
        )}
      />

      {timePickerTable && (() => {
        const table = demoTables.find((t) => t.id === timePickerTable)
        if (!table || table.type !== 'day') return null
        return (
          <TimePicker
            value={table.startTime || '08:00'}
            onChange={(time) => updateTableStartTime(timePickerTable, time)}
            onClose={() => setTimePickerTable(null)}
            timeFormat={settings.timeFormat as 12 | 24}
          />
        )
      })()}

      {durationPickerTask && (() => {
        const table = demoTables.find((t) => t.id === durationPickerTask.tableId)
        const task = table?.tasks.find((t) => t.id === durationPickerTask.taskId)
        if (!task) return null
        return (
          <DurationPicker
            value={task.duration}
            presets={[15, 30, 45, 60, 90, 120]}
            onChange={(minutes) => updateTask(durationPickerTask.tableId, durationPickerTask.taskId, 'duration', minutes)}
            onClose={() => setDurationPickerTask(null)}
          />
        )
      })()}

      {moveMenu && (() => {
        const { tableId, taskIndex } = moveMenu
        const table = demoTables.find((t) => t.id === tableId)
        const task = table?.tasks[taskIndex]
        return (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-end md:items-center justify-center z-[200]" onClick={() => setMoveMenu(null)}>
            <div className="bg-white w-full md:w-[420px] rounded-t-lg md:rounded-lg p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">Move to the table</h3>
                <button className="text-gray-500 hover:text-gray-800" onClick={() => setMoveMenu(null)}>✕</button>
              </div>
              <div className="max-h-[50vh] overflow-auto divide-y">
                {demoTables.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { moveTaskToTable(tableId, taskIndex, t.id); setMoveMenu(null) }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100"
                  >
                    {t.type === 'day' && t.date ? formatDate(t.date) : t.title}
                  </button>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                {task && (
                  <button
                    onClick={() => { duplicateTask(tableId, task.id, taskIndex); setMoveMenu(null) }}
                    className="w-full px-3 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium"
                  >
                    📋 Duplicate Task
                  </button>
                )}
                <button onClick={() => setMoveMenu(null)} className="w-full px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
