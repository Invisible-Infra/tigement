import { useState } from 'react'
import { useTheme, ThemeName } from '../contexts/ThemeContext'
import type { ConditionalDefaultRule, Condition, TaskTemplate } from '../utils/conditionalDefaultTasks'

interface Space {
  id: string
  name: string
  color?: string
}

interface SettingsData {
  defaultDuration: number
  defaultStartTime: string
  defaultTasksCount: number
  timeFormat: 12 | 24
  dateFormat: string
  showTimerOnStartup: boolean
  sessionDuration: number
  useTimePickers: boolean
  durationPresets?: number[]
  snapToGrid?: boolean
  gridSize?: number
  conditionalDefaultRules?: ConditionalDefaultRule[]
  spaces?: Space[]
}

interface TaskGroup {
  id: string
  name: string
  icon?: string
  color?: string
}

interface SettingsProps {
  onClose: () => void
  settings: SettingsData
  onSettingsChange: (settings: SettingsData) => void
  isPremium?: boolean
  taskGroups?: TaskGroup[]
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const DAY_FIELDS = [
  { value: 'dayweek', label: 'Day of week' },
  { value: 'dayOfMonth', label: 'Day of month (1–31)' },
  { value: 'weekOfMonth', label: 'Week of month (1–5)' },
  { value: 'month', label: 'Month' },
  { value: 'date', label: 'Exact date' },
  { value: 'isWeekend', label: 'Is weekend' }
] as const

type ConditionFormItem = { kind: 'preset'; field: string; operator: 'eq' | 'in'; value: string | string[] } | { kind: 'expression'; expression: string }

function RuleForm({
  rule,
  defaultDuration,
  defaultStartTime,
  spaces = [],
  taskGroups = [],
  onSave,
  onCancel
}: {
  rule: ConditionalDefaultRule | null
  defaultDuration: number
  defaultStartTime: string
  spaces?: Space[]
  taskGroups?: { id: string; name: string }[]
  onSave: (r: ConditionalDefaultRule) => void
  onCancel: () => void
}) {
  const [tableType, setTableType] = useState<'day' | 'list'>(rule?.tableType ?? 'day')
  const [conditions, setConditions] = useState<ConditionFormItem[]>(() => {
    if (!rule?.conditions?.length) return []
    return rule.conditions.map(c => {
      if (c.kind === 'expression') return { kind: 'expression' as const, expression: c.expression ?? '' }
      const p = c.preset!
      const val = p.operator === 'in' && Array.isArray(p.value) ? p.value : p.operator === 'in' ? [String(p.value)] : String(p.value ?? '')
      return { kind: 'preset' as const, field: p.field, operator: p.operator, value: val }
    })
  })
  const [tasks, setTasks] = useState<TaskTemplate[]>(() =>
    rule?.tasks?.length ? rule.tasks : [{ title: '', duration: defaultDuration, startTime: undefined, group: undefined, notebook: undefined, selected: false }]
  )

  const addCondition = (kind: 'preset' | 'expression') => {
    if (kind === 'preset') {
      setConditions([...conditions, { kind: 'preset', field: 'dayweek', operator: 'eq', value: '' }])
    } else {
      setConditions([...conditions, { kind: 'expression', expression: '' }])
    }
  }

  const updateCondition = (i: number, upd: Partial<ConditionFormItem>) => {
    const next = [...conditions]
    next[i] = { ...next[i], ...upd } as ConditionFormItem
    setConditions(next)
  }

  const removeCondition = (i: number) => setConditions(conditions.filter((_, j) => j !== i))

  const handleSave = () => {
    const builtConditions: Condition[] = conditions
      .filter(c => (c.kind === 'preset' && c.value !== '' && (Array.isArray(c.value) ? c.value.length > 0 : true)) || (c.kind === 'expression' && c.expression.trim()))
      .map(c => {
        if (c.kind === 'expression') return { kind: 'expression' as const, expression: c.expression.trim() }
        const val = Array.isArray(c.value) ? (c.value.length === 1 ? c.value[0] : c.value) : c.value
        return { kind: 'preset' as const, preset: { field: c.field, operator: c.operator, value: val } }
      })
    const validTasks = tasks.filter(t => t.title?.trim())
    if (validTasks.length === 0) return
    const taskTemplates: TaskTemplate[] = validTasks.map((t, i) => {
      const out: TaskTemplate = {
        title: t.title.trim(),
        duration: t.duration ?? defaultDuration,
        startTime: tableType === 'day' && i === 0 ? (t.startTime ?? defaultStartTime) : undefined
      }
      if (t.group != null && t.group !== '') out.group = t.group
      if (t.notebook != null && t.notebook.trim() !== '') out.notebook = t.notebook.trim()
      if (t.selected === true) out.selected = true
      return out
    })
    onSave({
      id: rule?.id ?? crypto.randomUUID(),
      tableType,
      conditions: builtConditions,
      tasks: taskTemplates
    })
  }

  const renderValueInput = (c: ConditionFormItem, i: number) => {
    if (c.kind === 'expression') {
      return (
        <input
          type="text"
          value={c.expression}
          onChange={(e) => updateCondition(i, { expression: e.target.value })}
          placeholder="dayweek === 'Monday' && month <= 3"
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono text-xs"
        />
      )
    }
    const { field, operator, value } = c
    const val = Array.isArray(value) ? value.join(', ') : String(value ?? '')
    if (field === 'dayweek') {
      if (operator === 'in') {
        return (
          <input
            type="text"
            value={val}
            onChange={(e) => updateCondition(i, { value: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            placeholder="Monday, Friday"
            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[120px]"
          />
        )
      }
      return (
        <select
          value={val}
          onChange={(e) => updateCondition(i, { value: e.target.value })}
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[120px]"
        >
          <option value="">—</option>
          {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      )
    }
    if (field === 'dayOfMonth') {
      if (operator === 'in') {
        return (
          <input
            type="text"
            value={val}
            onChange={(e) => updateCondition(i, { value: e.target.value.split(/[,\s]+/).filter(Boolean) })}
            placeholder="1, 15, 30"
            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm w-28"
          />
        )
      }
      return (
        <input
          type="number"
          min={1}
          max={31}
          value={val}
          onChange={(e) => updateCondition(i, { value: e.target.value })}
          placeholder="1–31"
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm w-20"
        />
      )
    }
    if (field === 'weekOfMonth') {
      if (operator === 'in') {
        return (
          <input
            type="text"
            value={val}
            onChange={(e) => updateCondition(i, { value: e.target.value.split(/[,\s]+/).filter(Boolean) })}
            placeholder="1, 3"
            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm w-20"
          />
        )
      }
      return (
        <select
          value={val}
          onChange={(e) => updateCondition(i, { value: e.target.value })}
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm w-20"
        >
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map(n => <option key={n} value={String(n)}>{n}</option>)}
        </select>
      )
    }
    if (field === 'month') {
      if (operator === 'in') {
        return (
          <input
            type="text"
            value={val}
            onChange={(e) => updateCondition(i, { value: e.target.value.split(/[,\s]+/).filter(Boolean) })}
            placeholder="1, 6, 12"
            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[100px]"
          />
        )
      }
      return (
        <select
          value={val}
          onChange={(e) => updateCondition(i, { value: e.target.value })}
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[100px]"
        >
          <option value="">—</option>
          {MONTHS.map((m, idx) => <option key={m} value={String(idx + 1)}>{m}</option>)}
        </select>
      )
    }
    if (field === 'date') {
      return (
        <input
          type="date"
          value={val}
          onChange={(e) => updateCondition(i, { value: e.target.value })}
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm w-36"
        />
      )
    }
    if (field === 'isWeekend') {
      return (
        <select
          value={val}
          onChange={(e) => updateCondition(i, { value: e.target.value })}
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm w-24"
        >
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      )
    }
    if (field === 'spaceId') {
      return (
        <select
          value={val}
          onChange={(e) => updateCondition(i, { value: e.target.value })}
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[100px]"
        >
          <option value="">—</option>
          {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )
    }
    return null
  }

  return (
    <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Table type</label>
        <select
          value={tableType}
          onChange={(e) => setTableType(e.target.value as 'day' | 'list')}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
        >
          <option value="day">Day</option>
          <option value="list">List</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Conditions (all must match)</label>
        {conditions.map((c, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 mb-2">
            {c.kind === 'preset' ? (
              <>
                <select
                  value={c.field}
                  onChange={(e) => updateCondition(i, { field: e.target.value })}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                >
                  {(tableType === 'day' ? DAY_FIELDS : [{ value: 'spaceId', label: 'Space' }]).map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <select
                  value={c.operator}
                  onChange={(e) => updateCondition(i, { operator: e.target.value as 'eq' | 'in' })}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm w-14"
                >
                  <option value="eq">is</option>
                  <option value="in">in</option>
                </select>
                {renderValueInput(c, i)}
              </>
            ) : (
              <>
                <span className="text-xs text-gray-500">Expression:</span>
                {renderValueInput(c, i)}
              </>
            )}
            <button type="button" onClick={() => removeCondition(i)} className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm">×</button>
          </div>
        ))}
        <button type="button" onClick={() => addCondition('preset')} className="text-sm text-[#4fc3f7] hover:underline mr-2">+ Preset</button>
        <button type="button" onClick={() => addCondition('expression')} className="text-sm text-[#4fc3f7] hover:underline">+ Expression</button>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Tasks to add</label>
        {tasks.map((t, i) => (
          <div key={i} className="flex flex-wrap gap-2 mb-2 p-2 bg-white rounded border border-gray-200">
            <input
              type="text"
              value={t.title}
              onChange={(e) => { const next = [...tasks]; next[i] = { ...next[i], title: e.target.value }; setTasks(next) }}
              placeholder="Task title"
              className="flex-1 min-w-[120px] px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
            <input
              type="number"
              value={t.duration ?? defaultDuration}
              onChange={(e) => { const next = [...tasks]; next[i] = { ...next[i], duration: Number(e.target.value) || defaultDuration }; setTasks(next) }}
              min={1}
              className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm"
              title="Duration (min)"
            />
            {tableType === 'day' && i === 0 && (
              <input
                type="text"
                value={t.startTime ?? defaultStartTime}
                onChange={(e) => { const next = [...tasks]; next[i] = { ...next[i], startTime: e.target.value || defaultStartTime }; setTasks(next) }}
                placeholder="HH:MM"
                className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm"
                title="Start time (first task only)"
              />
            )}
            <select
              value={t.group ?? ''}
              onChange={(e) => { const next = [...tasks]; next[i] = { ...next[i], group: e.target.value || undefined }; setTasks(next) }}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[100px]"
              title="Task group"
            >
              <option value="">— Group</option>
              {taskGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={t.notebook ?? ''}
              onChange={(e) => { const next = [...tasks]; next[i] = { ...next[i], notebook: e.target.value || undefined }; setTasks(next) }}
              placeholder="Note..."
              className="flex-1 min-w-[80px] px-2 py-1.5 border border-gray-300 rounded text-sm"
              title="Task note"
            />
            <label className="flex items-center gap-1 px-2 py-1.5 text-sm cursor-pointer" title="Pre-select task">
              <input
                type="checkbox"
                checked={t.selected ?? false}
                onChange={(e) => { const next = [...tasks]; next[i] = { ...next[i], selected: e.target.checked }; setTasks(next) }}
                className="rounded"
              />
              <span className="text-gray-600">Sel.</span>
            </label>
            <button type="button" onClick={() => setTasks(tasks.filter((_, j) => j !== i))} className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm">×</button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setTasks([...tasks, { title: '', duration: defaultDuration, startTime: undefined, group: undefined, notebook: undefined, selected: false }])}
          className="text-sm text-[#4fc3f7] hover:underline"
        >
          + Add task
        </button>
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={handleSave} className="px-3 py-1.5 bg-[#4fc3f7] text-white rounded text-sm hover:bg-[#3ba3d7]">Save rule</button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded text-sm">Cancel</button>
      </div>
    </div>
  )
}

function ruleSummary(rule: ConditionalDefaultRule): string {
  const parts = rule.conditions.map(c => {
    if (c.kind === 'expression' && c.expression?.trim()) return `expr: ${c.expression.slice(0, 30)}${c.expression.length > 30 ? '…' : ''}`
    if (c.kind === 'preset' && c.preset) {
      const p = c.preset
      const v = Array.isArray(p.value) ? p.value.join(', ') : String(p.value)
      return `${p.field}=${v}`
    }
    return ''
  }).filter(Boolean)
  return parts.length ? parts.join(' AND ') : 'always'
}

export function Settings({ onClose, settings, onSettingsChange, isPremium, taskGroups = [] }: SettingsProps) {
  const { theme, setTheme } = useTheme()
  const [localSettings, setLocalSettings] = useState(settings)
  const [presetsInput, setPresetsInput] = useState(() => {
    const presets = settings.durationPresets || [15,30,60,120]
    return presets.join(', ')
  })
  const [editingRule, setEditingRule] = useState<ConditionalDefaultRule | null>(null)
  const [addingRule, setAddingRule] = useState(false)

  const handleSave = () => {
    onSettingsChange(localSettings)
    onClose()
  }

  // Format time based on time format preference
  const formatTime = (time24: string): string => {
    if (!time24 || localSettings.timeFormat === 24) return time24
    
    const [hours, minutes] = time24.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    return `${hours12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  // Parse time from display format to 24h format
  const parseTime = (timeStr: string): string => {
    if (!timeStr) return '08:00'
    
    // If already in 24h format
    if (!timeStr.includes('AM') && !timeStr.includes('PM')) {
      return timeStr
    }
    
    // Parse 12h format
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
    if (!match) return '08:00'
    
    let hours = parseInt(match[1])
    const minutes = match[2]
    const period = match[3].toUpperCase()
    
    if (period === 'PM' && hours !== 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] overflow-y-auto">
        <div className="bg-[#4a6c7a] text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-xl font-bold">Settings</h2>
          <button onClick={onClose} className="text-2xl hover:text-gray-300">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Theme Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Theme
            </label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemeName)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
            >
              <option value="light">Light (Modern)</option>
              <option value="classic">Classic (Retro)</option>
              <option value="dark">Dark</option>
              <option value="terminal">Terminal (Hacker)</option>
              <option value="spectrum">ZX Spectrum</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Change the app's visual appearance</p>
          </div>

          {/* Time Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Format
            </label>
            <select
              value={localSettings.timeFormat}
              onChange={(e) => setLocalSettings({ ...localSettings, timeFormat: Number(e.target.value) as 12 | 24 })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
            >
              <option value={24}>24-hour</option>
              <option value={12}>12-hour (AM/PM)</option>
            </select>
          </div>

          {/* Date Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Format
            </label>
            <select
              value={localSettings.dateFormat}
              onChange={(e) => setLocalSettings({ ...localSettings, dateFormat: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
            >
              <option value="DD. MM. YYYY">DD. MM. YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>

          {/* Session Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stay Logged In (days)
            </label>
            <select
              value={localSettings.sessionDuration}
              onChange={(e) => setLocalSettings({ ...localSettings, sessionDuration: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
            >
              <option value={1}>1 day (High security)</option>
              <option value={7}>7 days (Balanced)</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days (Convenient)</option>
              <option value={90}>90 days (Long-term)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">How long before automatic logout</p>
          </div>

          {/* Default Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Duration (minutes)
            </label>
            <input
              type="number"
              value={localSettings.defaultDuration}
              onChange={(e) => setLocalSettings({ ...localSettings, defaultDuration: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
              min="1"
            />
            <p className="text-xs text-gray-500 mt-1">Applied to new tasks</p>
          </div>

          {/* Default Start Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Start Time
            </label>
            <input
              type="text"
              defaultValue={formatTime(localSettings.defaultStartTime)}
              key={`start-time-${localSettings.timeFormat}-${localSettings.defaultStartTime}`}
              onBlur={(e) => {
                const time24 = parseTime(e.target.value)
                setLocalSettings({ ...localSettings, defaultStartTime: time24 })
                e.target.value = formatTime(time24)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
              placeholder={localSettings.timeFormat === 12 ? '08:00 AM' : '08:00'}
            />
            <p className="text-xs text-gray-500 mt-1">Applied to new Day tables</p>
          </div>

          {/* Default Tasks Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Number of Tasks
            </label>
            <input
              type="number"
              value={localSettings.defaultTasksCount}
              onChange={(e) => setLocalSettings({ ...localSettings, defaultTasksCount: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
              min="1"
              max="20"
            />
            <p className="text-xs text-gray-500 mt-1">Number of tasks in new tables</p>
          </div>

          {/* Timer Settings Section */}
          <div className="col-span-2 border-t pt-4 mt-2">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Timer</h3>
            
            {/* Show Timer on Startup */}
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Show Timer on Startup
                </label>
                <p className="text-xs text-gray-500">Automatically open timer window when app loads</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.showTimerOnStartup}
                  onChange={(e) => setLocalSettings({ ...localSettings, showTimerOnStartup: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#4fc3f7]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4fc3f7]"></div>
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-2">Note: Notification settings (sound/visual) are configured in the timer window itself</p>
          </div>

          {/* Time Pickers Setting */}
          <div className="col-span-2 border-t pt-4 mt-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  ⏰ Use Time Pickers
                </label>
                <p className="text-xs text-gray-500">Use time picker for start time and number inputs (h/m) for duration</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.useTimePickers}
                  onChange={(e) => setLocalSettings({ ...localSettings, useTimePickers: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#4fc3f7]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4fc3f7]"></div>
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-2">When disabled, times can be entered as text (e.g., "8:30" for time, "1h 30m" or "90m" for duration)</p>
          </div>

          {/* Snap to Grid */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  🔲 Snap to Grid
                </label>
                <p className="text-xs text-gray-500">Align tables to grid when dragging or resizing</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.snapToGrid || false}
                  onChange={(e) => setLocalSettings({ ...localSettings, snapToGrid: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#4fc3f7]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4fc3f7]"></div>
              </label>
            </div>
            {localSettings.snapToGrid && (
              <div className="mt-2">
                <label className="block text-xs text-gray-600 mb-1">Grid Size (pixels)</label>
                <input
                  type="number"
                  min="8"
                  max="50"
                  step="1"
                  value={localSettings.gridSize || 16}
                  onChange={(e) => setLocalSettings({ ...localSettings, gridSize: parseInt(e.target.value) || 16 })}
                  className="w-24 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                />
                <span className="text-xs text-gray-500 ml-2">(Default: 16px ≈ 1em)</span>
              </div>
            )}
          </div>

          {/* Conditional Default Tasks (Premium) */}
          {isPremium && (
            <div className="col-span-2 border-t pt-4 mt-2">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Conditional Default Tasks</h3>
              <p className="text-xs text-gray-500 mb-3">Add tasks automatically when creating new tables (e.g. &quot;8:00 Review&quot; on Mondays)</p>
              <div className="space-y-2">
                {(localSettings.conditionalDefaultRules || []).map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded border border-gray-200">
                    <div className="text-sm">
                      <span className="font-medium">{rule.tableType}</span>
                      {rule.conditions.length > 0 && (
                        <span className="text-gray-600 ml-2">if {ruleSummary(rule)}</span>
                      )}
                      <span className="text-gray-500 ml-2">→ {rule.tasks.length} task(s)</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => { setEditingRule(rule); setAddingRule(false) }}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const rules = (localSettings.conditionalDefaultRules || []).filter(r => r.id !== rule.id)
                          setLocalSettings({ ...localSettings, conditionalDefaultRules: rules.length ? rules : undefined })
                        }}
                        className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {addingRule || editingRule ? (
                  <RuleForm
                    rule={editingRule}
                    defaultDuration={localSettings.defaultDuration}
                    defaultStartTime={localSettings.defaultStartTime}
                    spaces={localSettings.spaces ?? []}
                    taskGroups={taskGroups}
                    onSave={(rule) => {
                      const rules = localSettings.conditionalDefaultRules || []
                      if (editingRule) {
                        setLocalSettings({
                          ...localSettings,
                          conditionalDefaultRules: rules.map(r => r.id === rule.id ? rule : r)
                        })
                      } else {
                        setLocalSettings({
                          ...localSettings,
                          conditionalDefaultRules: [...rules, rule]
                        })
                      }
                      setAddingRule(false)
                      setEditingRule(null)
                    }}
                    onCancel={() => { setAddingRule(false); setEditingRule(null) }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingRule(true)}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded text-gray-600 hover:border-[#4fc3f7] hover:text-[#4fc3f7] text-sm"
                  >
                    + Add rule
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Duration Presets */}
        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Duration Presets (minutes, comma-separated)
          </label>
          <input
            type="text"
            value={presetsInput}
            onChange={(e) => {
              setPresetsInput(e.target.value)
              // Parse and update settings as user types
              const inputValue = e.target.value
              const parts = inputValue.split(',')
              const nums = parts
                .map(p => p.trim())
                .filter(p => p.length > 0)
                .map(p => parseInt(p, 10))
                .filter(n => !isNaN(n) && n >= 0 && n <= 24*60)
              const uniqueSorted = Array.from(new Set(nums)).sort((a,b)=>a-b)
              setLocalSettings({ ...localSettings, durationPresets: uniqueSorted.length > 0 ? uniqueSorted : undefined })
            }}
            onBlur={() => {
              // Sync input with parsed values on blur
              const presets = localSettings.durationPresets || [15,30,60,120]
              setPresetsInput(presets.join(', '))
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
            placeholder="15, 30, 60, 120"
          />
          <p className="text-xs text-gray-500 mt-1">Shown as quick-select buttons in the duration picker</p>
        </div>

        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[#4fc3f7] text-white hover:bg-[#3ba3d7] rounded transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
