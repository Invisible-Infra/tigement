import { useState } from 'react'
import { useTheme, ThemeName } from '../contexts/ThemeContext'

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
}

interface SettingsProps {
  onClose: () => void
  settings: SettingsData
  onSettingsChange: (settings: SettingsData) => void
}

export function Settings({ onClose, settings, onSettingsChange }: SettingsProps) {
  const { theme, setTheme } = useTheme()
  const [localSettings, setLocalSettings] = useState(settings)
  const [presetsInput, setPresetsInput] = useState(() => {
    const presets = settings.durationPresets || [15,30,60,120]
    return presets.join(', ')
  })

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
