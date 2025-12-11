import { useState, useEffect, useRef } from 'react'
import { Settings } from './Settings'
import { Timer } from './Timer'
import { SyncConflictDialog } from './SyncConflictDialog'
import { DurationPicker } from './DurationPicker'
import { TimePicker } from './TimePicker'
import { Notebook } from './Notebook'
import { DiaryList } from './DiaryList'
import { DiaryEntry } from './DiaryEntry'
import { Manual } from './Manual'
import { Statistics } from './Statistics'
import { BugReportDialog } from './BugReportDialog'
import { FeatureRequestDialog } from './FeatureRequestDialog'
import { SplitView } from './SplitView'
import { SpaceTabs } from './SpaceTabs'
import { TableComponent } from './TableComponent'
import { exportToCSV, downloadCSV, importFromCSV } from '../utils/csvUtils'
import { saveTables, loadTables, saveSettings, loadSettings, saveTaskGroups, loadTaskGroups, saveNotebooks, loadNotebooks, saveArchivedTables, loadArchivedTables, saveDiaryEntries, loadDiaryEntries } from '../utils/storage'
import { normalizeDate } from '../utils/dateFormat'
import { useAuth } from '../contexts/AuthContext'
import { syncManager } from '../utils/syncManager'
import { useTheme } from '../contexts/ThemeContext'
import { api } from '../utils/api'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faBriefcase, 
  faUser, 
  faCartShopping, 
  faCartPlus,
  faHeart, 
  faBook,
  faBookOpen,
  faHome,
  faCoffee,
  faBicycle,
  faMusic,
  faGamepad,
  faUtensils,
  faPlane,
  faCar,
  faDumbbell,
  faPalette,
  faCode,
  faCodeBranch,
  faBug,
  faLightbulb,
  faBrain,
  faGraduationCap,
  faCircleInfo,
  faEnvelope,
  faComments,
  faPhone,
  faCalendar,
  faCalendarCheck,
  faClock,
  faStopwatch,
  faStar,
  faFlag,
  faTag,
  faFolder,
  faFolderOpen,
  faFile,
  faPaperclip,
  faPen,
  faCamera,
  faImage,
  faFilm,
  faVideo,
  faWallet,
  faMoneyBill,
  faCreditCard,
  faBuilding,
  faToolbox,
  faUsers,
  faPeopleGroup,
  faClipboard,
  faListCheck,
  faCheckCircle,
  faThumbtack,
  faRocket,
  faTrain,
  faTruck,
  faTrophy,
  faScaleBalanced,
  faScissors,
  faShield,
  faHammer,
  faKey,
  faGlobe,
  faMap,
  faMedal,
  faMicrochip,
  faMobileScreen,
  faHeadphones,
  faFire,
  faBolt,
  faSun,
  faMoon,
  faGift,
  faBeer,
  faWineGlass,
  faWineBottle,
  faUmbrella,
  faLeaf,
  faTree,
  faMountain
} from '@fortawesome/free-solid-svg-icons'

interface Task {
  id: string
  title: string
  duration: number // minutes
  selected: boolean
  group?: string // task group identifier (default: "general")
  notebook?: string // notebook content for this task
}

interface Table {
  id: string
  type: 'day' | 'todo'
  title: string
  date?: string
  startTime?: string // HH:MM for first task (only for day tables)
  tasks: Task[]
  position: { x: number; y: number }
  size?: { width: number; height: number }
  spaceId?: string | null // null or undefined = "All Spaces"
}

interface TaskGroup {
  id: string
  name: string
  icon: string // Font Awesome icon name (e.g., "briefcase", "user")
  color?: string // Hex color for background (undefined = default theme)
}

interface Space {
  id: string
  name: string
  color?: string // Hex color for the tab
  icon?: string // Optional icon name
}

interface ArchivedTable {
  id: string | number // number for backend IDs, string for temporary local IDs
  table_data?: Table // Optional - backend archives fetch on restore
  table_type: 'day' | 'todo'
  table_date?: string | null
  table_title: string
  task_count: number
  archived_at: string
}

const defaultTaskGroups: TaskGroup[] = [
  { id: 'general', name: 'General', icon: '', color: undefined }, // No icon, default background
  { id: 'work', name: 'Work', icon: 'briefcase', color: '#dbeafe' }, // Light blue
  { id: 'personal', name: 'Personal', icon: 'user', color: '#dcfce7' }, // Light green
  { id: 'shopping', name: 'Shopping', icon: 'cart-shopping', color: '#fed7aa' }, // Light orange
  { id: 'health', name: 'Health', icon: 'heart', color: '#fecaca' }, // Light red
  { id: 'study', name: 'Study', icon: 'book', color: '#e9d5ff' }, // Light purple
]

const defaultSpaces: Space[] = [
  { id: 'work', name: 'Work', color: '#3b82f6', icon: 'briefcase' },
  { id: 'personal', name: 'Personal', color: '#10b981', icon: 'user' },
  { id: 'home', name: 'Home', color: '#f59e0b', icon: 'home' },
]

// Icon mapping for Font Awesome
const iconMap: Record<string, any> = {
  'briefcase': faBriefcase,
  'user': faUser,
  'cart-shopping': faCartShopping,
  'cart-plus': faCartPlus,
  'heart': faHeart,
  'book': faBook,
  'book-open': faBookOpen,
  'home': faHome,
  'coffee': faCoffee,
  'bicycle': faBicycle,
  'music': faMusic,
  'gamepad': faGamepad,
  'utensils': faUtensils,
  'plane': faPlane,
  'car': faCar,
  'dumbbell': faDumbbell,
  'palette': faPalette,
  'code': faCode,
  'code-branch': faCodeBranch,
  'bug': faBug,
  'lightbulb': faLightbulb,
  'brain': faBrain,
  'graduation-cap': faGraduationCap,
  'circle-info': faCircleInfo,
  'envelope': faEnvelope,
  'comments': faComments,
  'phone': faPhone,
  'calendar': faCalendar,
  'calendar-check': faCalendarCheck,
  'clock': faClock,
  'stopwatch': faStopwatch,
  'star': faStar,
  'flag': faFlag,
  'tag': faTag,
  'folder': faFolder,
  'folder-open': faFolderOpen,
  'file': faFile,
  'paperclip': faPaperclip,
  'pen': faPen,
  'camera': faCamera,
  'image': faImage,
  'film': faFilm,
  'video': faVideo,
  'wallet': faWallet,
  'money-bill': faMoneyBill,
  'credit-card': faCreditCard,
  'building': faBuilding,
  'toolbox': faToolbox,
  'users': faUsers,
  'people-group': faPeopleGroup,
  'clipboard': faClipboard,
  'list-check': faListCheck,
  'check-circle': faCheckCircle,
  'thumbtack': faThumbtack,
  'rocket': faRocket,
  'train': faTrain,
  'truck': faTruck,
  'trophy': faTrophy,
  'scale-balanced': faScaleBalanced,
  'scissors': faScissors,
  'shield': faShield,
  'hammer': faHammer,
  'key': faKey,
  'globe': faGlobe,
  'map': faMap,
  'medal': faMedal,
  'microchip': faMicrochip,
  'mobile-screen': faMobileScreen,
  'headphones': faHeadphones,
  'fire': faFire,
  'bolt': faBolt,
  'sun': faSun,
  'moon': faMoon,
  'gift': faGift,
  'beer': faBeer,
  'wine-glass': faWineGlass,
  'wine-bottle': faWineBottle,
  'umbrella': faUmbrella,
  'leaf': faLeaf,
  'tree': faTree,
  'mountain': faMountain
}

// Available icons for custom groups
const availableIcons = [
  'briefcase','user','cart-shopping','cart-plus','heart','book','book-open','home','coffee','bicycle','music','gamepad',
  'utensils','plane','car','dumbbell','palette','code','code-branch','bug','lightbulb','brain','graduation-cap','circle-info',
  'envelope','comments','phone','calendar','calendar-check','clock','stopwatch','star','flag','tag','folder','folder-open',
  'file','paperclip','pen','camera','image','film','video','wallet','money-bill','credit-card','building','toolbox','users',
  'people-group','clipboard','list-check','check-circle','thumbtack','rocket','train','truck','trophy','scale-balanced',
  'scissors','shield','hammer','key','globe','map','medal','microchip','mobile-screen','headphones','fire','bolt','sun',
  'moon','gift','beer','wine-glass','wine-bottle','umbrella','leaf','tree','mountain'
]

// Calculate contrasting text color for given background color
const getContrastColor = (hexColor?: string): string => {
  if (!hexColor) return '#000000' // Default to black
  
  // Remove # if present
  const hex = hexColor.replace('#', '')
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  // Calculate relative luminance (ITU-R BT.709)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  // Return pure black for light backgrounds, pure white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

// Get theme-aware color from CSS variables
const getThemeColor = (varName: string): string => {
  if (typeof window === 'undefined') return '#000000'
  const computed = getComputedStyle(document.documentElement)
  const value = computed.getPropertyValue(varName).trim()
  return value || '#000000'
}

// Utilities for computed style → hex
const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
const cssColorToHex = (css: string): string => {
  // css like rgb(a) or hex already
  if (!css) return '#ffffff'
  if (css.startsWith('#')) return css
  const m = css.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d\\.]+))?\\)/)
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
    if (bg && !/rgba\\(\\s*0\\s*,\\s*0\\s*,\\s*0\\s*,\\s*0\\s*\\)/.test(bg) && bg !== 'transparent') {
      return cssColorToHex(bg)
    }
    node = node.parentElement
  }
  return '#ffffff'
}

const getDefaultTables = (): Table[] => {
  // Get today's date in YYYY-MM-DD format
  const today = new Date()
  const dateStr = today.toISOString().split('T')[0]
  const day = today.getDate().toString().padStart(2, '0')
  const month = (today.getMonth() + 1).toString().padStart(2, '0')
  const year = today.getFullYear()
  
  return [
    {
      id: 'day-1',
      type: 'day',
      title: `${day}.${month}. ${year}`,
      date: dateStr,
      startTime: '08:00',
      tasks: [
        { id: 'task-1', title: '', duration: 30, selected: false },
        { id: 'task-2', title: '', duration: 30, selected: false },
        { id: 'task-3', title: '', duration: 30, selected: false },
        { id: 'task-4', title: '', duration: 30, selected: false }
      ],
      position: { x: 20, y: 20 }
    },
    {
      id: 'todo-1',
      type: 'todo',
      title: 'TODO',
      tasks: [
        { id: 'task-5', title: '', duration: 30, selected: false },
        { id: 'task-6', title: '', duration: 30, selected: false },
        { id: 'task-7', title: '', duration: 30, selected: false },
        { id: 'task-8', title: '', duration: 30, selected: false }
      ],
      position: { x: 450, y: 20 }
    }
  ]
}

interface WorkspaceProps {
  onShowPremium?: () => void
}

export function Workspace({ onShowPremium }: WorkspaceProps) {
  const { user, syncNow, loading, decryptionFailure } = useAuth()
  const { theme } = useTheme()
  const [syncing, setSyncing] = useState(false)
  const [hasLoadedUser, setHasLoadedUser] = useState(false)
  
  // Get text color based on theme for time fields
  const getTimeTextColor = (timeMatchStatus?: 'match' | 'mismatch' | null) => {
    // If there's a time match status, use contrasting colors
    if (timeMatchStatus === 'match') return 'rgb(20, 83, 45)' // green-900
    if (timeMatchStatus === 'mismatch') return 'rgb(127, 29, 29)' // red-900
    
    // Otherwise use theme-based colors
    if (theme === 'dark') return 'rgb(209, 213, 219)' // gray-300
    if (theme === 'terminal') return 'rgb(34, 197, 94)' // green-500
    return 'rgb(55, 65, 81)' // gray-700 for light/classic
  }

  // Extract time from task name if it starts with a time pattern (e.g., "9:20 Task" or "09:20 Task")
  const extractTimeFromTaskName = (taskName: string): string | null => {
    const timeMatch = taskName.match(/^(\d{1,2}):(\d{2})\s/)
    if (timeMatch) {
      const hours = timeMatch[1].padStart(2, '0')
      const minutes = timeMatch[2]
      return `${hours}:${minutes}`
    }
    return null
  }

  // Check if task has a time in its name and if it matches the actual start time
  const getTaskTimeMatchStatus = (taskName: string, actualStartTime: string): 'match' | 'mismatch' | null => {
    const expectedTime = extractTimeFromTaskName(taskName)
    if (!expectedTime) return null
    
    return expectedTime === actualStartTime ? 'match' : 'mismatch'
  }
  
  // Helper to conditionally show emoji (hide in terminal theme)
  const showEmoji = theme !== 'terminal'

  const [tables, setTables] = useState<Table[]>(() => {
    const saved = loadTables()
    return saved || getDefaultTables()
  })

  const [draggedTask, setDraggedTask] = useState<{ tableId: string; taskId: string; index: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ tableId: string; index: number } | null>(null)
  const [draggedTable, setDraggedTable] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [touchDragStart, setTouchDragStart] = useState<{ y: number; taskId: string; tableId: string; index: number } | null>(null)
  const [touchDragCurrent, setTouchDragCurrent] = useState<number | null>(null)
  const [hoveredTask, setHoveredTask] = useState<string | null>(null)
  const handleLongPressTimer = useRef<number | null>(null)
  const dragHandleTimer = useRef<number | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [timerPosition, setTimerPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('tigement_timer_position')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load timer position:', error)
    }
    return { x: typeof window !== 'undefined' ? window.innerWidth - 350 : 100, y: 20 }
  })
  const [showStatistics, setShowStatistics] = useState(false)
  const [showBugReport, setShowBugReport] = useState(false)
  const [showFeatureRequest, setShowFeatureRequest] = useState(false)
  const [showGroupsEditor, setShowGroupsEditor] = useState(false)
  const [showConflict, setShowConflict] = useState(false)
  const [conflictData, setConflictData] = useState<any>(null)
  const [conflictResolver, setConflictResolver] = useState<any>(null)
  const [showEmptyDataConfirm, setShowEmptyDataConfirm] = useState(false)
  const [emptyDataResolver, setEmptyDataResolver] = useState<any>(null)
  const [currentTableIndex, setCurrentTableIndex] = useState(() => {
    // Load saved page index from localStorage (mobile pagination)
    try {
      const saved = localStorage.getItem('tigement_current_page_index')
      return saved ? parseInt(saved) : 0
    } catch {
      return 0
    }
  })
  const [isMobile, setIsMobile] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => new Set(['workspace']))
  
  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => {
      const next = new Set(prev)
      if (next.has(menuId)) {
        next.delete(menuId)
      } else {
        next.add(menuId)
      }
      return next
    })
  }
  
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>(() => {
    const saved = loadTaskGroups()
    return (saved && saved.length > 0) ? saved : defaultTaskGroups
  })
  const [groupSelectorTask, setGroupSelectorTask] = useState<{ tableId: string; taskId: string } | null>(null)
  const [showCustomGroupForm, setShowCustomGroupForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<TaskGroup | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupIcon, setNewGroupIcon] = useState('briefcase')
  const [newGroupColor, setNewGroupColor] = useState('#dbeafe')
  const [bulkActionsOpen, setBulkActionsOpen] = useState<string | null>(null)
  const [bulkGroupSelectorTable, setBulkGroupSelectorTable] = useState<string | null>(null)
  const [archivedTables, setArchivedTables] = useState<ArchivedTable[]>([])
  const [showArchivedMenu, setShowArchivedMenu] = useState(false)
  const [tableActionMenu, setTableActionMenu] = useState<string | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [openNotebooks, setOpenNotebooks] = useState<Array<{ 
    id: string; 
    type: 'workspace' | 'task'; 
    taskId?: string; 
    tableId?: string;
    position: { x: number; y: number } 
  }>>([])
  const [workspaceNotebook, setWorkspaceNotebook] = useState('')
  const [diaryEntries, setDiaryEntries] = useState<Record<string, string>>({})
  const [diaryEntriesList, setDiaryEntriesList] = useState<Array<{ date: string; preview: string }>>([])
  const [showDiaryList, setShowDiaryList] = useState(false)
  const [diaryListPosition, setDiaryListPosition] = useState({ x: 100, y: 100 })
  const [openDiaryEntry, setOpenDiaryEntry] = useState<{ date: string; position: { x: number; y: number } } | null>(null)
  const [durationPickerTask, setDurationPickerTask] = useState<{ tableId: string; taskId: string } | null>(null)
  const [timePickerTable, setTimePickerTable] = useState<string | null>(null)
  const [tableZIndexes, setTableZIndexes] = useState<Record<string, number>>({})
  const zIndexCounter = useRef(1)
  const isAdjustingIndex = useRef(false)
  const [history, setHistory] = useState<Table[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isUndoRedoing, setIsUndoRedoing] = useState(false)
  const [zoom, setZoom] = useState(1) // 1 = 100%
  const [currentTime, setCurrentTime] = useState(new Date())
  const [resizingTable, setResizingTable] = useState<{ id: string; startX: number; startY: number; startW: number; startH: number } | null>(null)

  // Update current time every second to refresh task states (bold/greyed)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000) // Update every second for immediate task highlighting

    return () => clearInterval(timer)
  }, [])

  // Track when user data has been loaded initially
  useEffect(() => {
    if (!loading) {
      setHasLoadedUser(true)
    }
  }, [loading])

  // Track if app was ever authenticated in this session
  const wasAuthenticatedRef = useRef(false)
  useEffect(() => {
    if (user) wasAuthenticatedRef.current = true
  }, [user])

  // Reset workspace UI when user logs out after having been authenticated before.
  // localStorage data is preserved (not cleared) so it can be reloaded on next login.
  // Do NOT wipe anonymous/local data on first load when user is null.
  useEffect(() => {
    if (hasLoadedUser && !user && !loading && wasAuthenticatedRef.current) {
      console.log('🔄 User logged out, clearing UI (localStorage preserved)')
      setTables(getDefaultTables())
      setSettings({
        defaultDuration: 30,
        defaultStartTime: '08:00',
        defaultTasksCount: 4,
        timeFormat: 24,
        dateFormat: 'DD. MM. YYYY',
        showTimerOnStartup: false,
        sessionDuration: 7,
        useTimePickers: true
      })
      setHistory([])
      setHistoryIndex(-1)
    }
  }, [user, hasLoadedUser, loading])

  // Reload data from localStorage when user logs in
  useEffect(() => {
    if (user && hasLoadedUser && !loading) {
      console.log('🔄 User logged in, reloading data from localStorage')
      const savedTables = loadTables()
      if (savedTables && savedTables.length > 0) {
        setTables(savedTables)
      }
      const savedSettings = loadSettings()
      if (savedSettings) {
        setSettings(savedSettings)
      }
      const savedTaskGroups = loadTaskGroups()
      if (savedTaskGroups && savedTaskGroups.length > 0) {
        setTaskGroups(savedTaskGroups)
      }
      const savedNotebooks = loadNotebooks()
      if (savedNotebooks) {
        setWorkspaceNotebook(savedNotebooks.workspace || '')
      }
      const savedDiaryEntries = loadDiaryEntries()
      if (savedDiaryEntries && Object.keys(savedDiaryEntries).length > 0) {
        setDiaryEntries(savedDiaryEntries)
        setDiaryEntriesList(Object.keys(savedDiaryEntries).map(date => ({
          date,
          preview: savedDiaryEntries[date].substring(0, 50)
        })))
      }
    }
  }, [user, hasLoadedUser, loading])

  // Save task groups to localStorage whenever they change
  useEffect(() => {
    saveTaskGroups(taskGroups)
  }, [taskGroups])

  // Set up conflict resolution handler
  useEffect(() => {
    syncManager.setConflictHandler(async (conflict) => {
      return new Promise((resolve) => {
        setConflictData(conflict)
        setShowConflict(true)
        setConflictResolver(() => resolve) // Store resolve function
      })
    })
  }, [])

  // Set up empty data confirmation handler
  useEffect(() => {
    syncManager.setEmptyDataConfirmHandler(async () => {
      return new Promise((resolve) => {
        setShowEmptyDataConfirm(true)
        setEmptyDataResolver(() => resolve) // Store resolve function
      })
    })
  }, [])

  // Set up user editing detection
  useEffect(() => {
    syncManager.setIsUserEditing(() => {
      const activeElement = document.activeElement
      if (!activeElement) return false
      
      // Check if user is editing any input field
      const tagName = activeElement.tagName.toLowerCase()
      const isInput = tagName === 'input' || tagName === 'textarea'
      const isContentEditable = activeElement.getAttribute('contenteditable') === 'true'
      
      return isInput || isContentEditable
    })
  }, [])

  // Set up state update handler (replaces page reloads)
  useEffect(() => {
    syncManager.setOnStateUpdate((data) => {
      console.log('🔄 Updating workspace state from sync...')
      // Update tables
      if (data.tables) {
        setTables(data.tables)
      }
      // Update settings
      if (data.settings) {
        setSettings(data.settings)
      }
      // Update task groups only if server has them (don't clear local groups if server doesn't have any)
      if (data.taskGroups && data.taskGroups.length > 0) {
        setTaskGroups(data.taskGroups)
      }
    })
  }, [])

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Save current page index to localStorage (for mobile pagination persistence)
  useEffect(() => {
    if (isMobile) {
      try {
        localStorage.setItem('tigement_current_page_index', currentTableIndex.toString())
        console.log(`📱 Saved current page index: ${currentTableIndex}`)
      } catch (error) {
        console.error('Failed to save page index:', error)
      }
    }
  }, [currentTableIndex, isMobile])

  // Keep currentTableIndex in bounds when tables change (only adjust if out of bounds)
  useEffect(() => {
    if (isAdjustingIndex.current) return // Skip if already adjusting
    
    if (tables.length > 0 && currentTableIndex >= tables.length) {
      // Index out of bounds, adjust to last valid index
      console.log(`📱 Adjusting index from ${currentTableIndex} to ${tables.length - 1}`)
      isAdjustingIndex.current = true
      setCurrentTableIndex(tables.length - 1)
      setTimeout(() => { isAdjustingIndex.current = false }, 100)
    } else if (tables.length === 0 && currentTableIndex !== 0) {
      // No tables, reset to 0
      console.log(`📱 Resetting index to 0 (no tables)`)
      isAdjustingIndex.current = true
      setCurrentTableIndex(0)
      setTimeout(() => { isAdjustingIndex.current = false }, 100)
    }
    // Don't adjust if index is valid (prevents unnecessary resets)
  }, [tables.length])

  // Save to history on table changes (but not during undo/redo)
  useEffect(() => {
    if (isUndoRedoing) return
    
    // Deep clone to avoid reference issues
    const snapshot = JSON.parse(JSON.stringify(tables))
    
    // Update both history and index together
    setHistory(prev => {
      // Remove any future history after current index
      const newHistory = prev.slice(0, historyIndex + 1)
      // Add new snapshot
      newHistory.push(snapshot)
      // Keep max 50 steps
      return newHistory.slice(-50)
    })
    
    // Increment index to point to the new snapshot
    setHistoryIndex(prev => Math.min(prev + 1, 49))
  }, [tables])

  // Undo/Redo keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        if (historyIndex > 0) {
          setIsUndoRedoing(true)
          setHistoryIndex(historyIndex - 1)
          setTables(JSON.parse(JSON.stringify(history[historyIndex - 1])))
          setTimeout(() => setIsUndoRedoing(false), 0)
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault()
        if (historyIndex < history.length - 1) {
          setIsUndoRedoing(true)
          setHistoryIndex(historyIndex + 1)
          setTables(JSON.parse(JSON.stringify(history[historyIndex + 1])))
          setTimeout(() => setIsUndoRedoing(false), 0)
        }
      }
    }

    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [historyIndex, history])

  const undo = () => {
    if (historyIndex > 0) {
      setIsUndoRedoing(true)
      setHistoryIndex(historyIndex - 1)
      setTables(JSON.parse(JSON.stringify(history[historyIndex - 1])))
      setTimeout(() => setIsUndoRedoing(false), 0)
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setIsUndoRedoing(true)
      setHistoryIndex(historyIndex + 1)
      setTables(JSON.parse(JSON.stringify(history[historyIndex + 1])))
      setTimeout(() => setIsUndoRedoing(false), 0)
    }
  }

  const zoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2)) // Max 200%
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5)) // Min 50%
  const zoomReset = () => setZoom(1)

  const [settings, setSettings] = useState(() => {
    // Load from localStorage IMMEDIATELY during component initialization
    const saved = loadSettings()
    if (saved && typeof saved === 'object') {
      console.log('✅ Settings loaded from localStorage on init:', saved)
      // Merge saved settings with defaults to ensure all fields exist
      return {
        defaultDuration: saved.defaultDuration ?? 30,
        defaultStartTime: saved.defaultStartTime ?? '08:00',
        defaultTasksCount: saved.defaultTasksCount ?? 4,
        timeFormat: saved.timeFormat ?? 24,
        dateFormat: saved.dateFormat ?? 'DD. MM. YYYY',
        showTimerOnStartup: saved.showTimerOnStartup ?? false,
        sessionDuration: saved.sessionDuration ?? 7,
        useTimePickers: saved.useTimePickers ?? true,
        durationPresets: saved.durationPresets ?? [15, 30, 60, 120],
        viewMode: (saved.viewMode as 'all-in-one' | 'spaces') ?? 'all-in-one',
        spaces: saved.spaces ?? defaultSpaces,
        spacesSplitPosition: saved.spacesSplitPosition ?? 40,
        activeSpaceId: saved.activeSpaceId ?? defaultSpaces[0].id,
        snapToGrid: saved.snapToGrid,
        gridSize: saved.gridSize
      }
    }
    
    // Default settings if nothing saved
    console.log('⚠️ Using default settings (nothing in localStorage)')
    return {
      defaultDuration: 30,
      defaultStartTime: '08:00',
      defaultTasksCount: 4,
      timeFormat: 24,
      dateFormat: 'DD. MM. YYYY',
      showTimerOnStartup: false,
      sessionDuration: 7,
      useTimePickers: true,
      durationPresets: [15, 30, 60, 120],
      viewMode: 'all-in-one' as 'all-in-one' | 'spaces',
      spaces: defaultSpaces,
      spacesSplitPosition: 40,
      activeSpaceId: defaultSpaces[0].id
    }
  })
  
  // Auto-show timer on startup if enabled in settings (but not on mobile)
  // MUST be after settings state declaration to avoid "before initialization" error
  useEffect(() => {
    const checkMobileForTimer = () => window.innerWidth < 768
    if (settings.showTimerOnStartup && !checkMobileForTimer()) {
      setShowTimer(true)
    } else if (!settings.showTimerOnStartup) {
      setShowTimer(false)
    }
  }, [settings.showTimerOnStartup]) // Re-run when setting changes
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // State for spaces view mode
  const [spaces, setSpaces] = useState<Space[]>(() => {
    return settings.spaces || defaultSpaces
  })
  const [activeSpaceId, setActiveSpaceId] = useState<string>(() => {
    return settings.activeSpaceId || (settings.spaces?.[0]?.id || defaultSpaces[0].id)
  })
  const [viewMode, setViewMode] = useState<'all-in-one' | 'spaces'>(() => {
    return settings.viewMode || 'all-in-one'
  })
  const [spacesSplitPosition, setSpacesSplitPosition] = useState<number>(() => {
    return settings.spacesSplitPosition || 40 // 40% for left side
  })

  // Spaces visibility filter (for all-in-one view)
  const [visibleSpaces, setVisibleSpaces] = useState<Set<string>>(() => 
    new Set(spaces.map(s => s.id))
  )

  const toggleSpaceVisibility = (spaceId: string) => {
    setVisibleSpaces(prev => {
      const next = new Set(prev)
      if (next.has(spaceId)) {
        next.delete(spaceId)
      } else {
        next.add(spaceId)
      }
      return next
    })
  }

  // Helper functions for duration formatting
  const formatDuration = (minutes: number): string => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  const parseDuration = (timeStr: string): number => {
    if (!timeStr) return 0
    
    // If input doesn't contain colon, treat it as minutes
    if (!timeStr.includes(':')) {
      const minutes = parseInt(timeStr)
      return isNaN(minutes) ? 0 : minutes
    }
    
    // Parse HH:MM format
    const [h, m] = timeStr.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  // Format time based on user's time format preference
  const formatTime = (time24: string): string => {
    if (!time24 || settings.timeFormat === 24) return time24
    
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

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00')
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    
    switch (settings.dateFormat) {
      case 'DD. MM. YYYY':
        return `${day}. ${month}. ${year}`
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`
      default:
        return `${day}. ${month}. ${year}`
    }
  }

  // --- Helpers for Markdown export ---
  const formatYYMMDD = (d: Date): string => {
    const yy = (d.getFullYear() % 100).toString().padStart(2, '0')
    const mm = (d.getMonth() + 1).toString().padStart(2, '0')
    const dd = d.getDate().toString().padStart(2, '0')
    return `${yy}${mm}${dd}`
  }

  const sanitizeTitleForFile = (title: string): string => {
    // Replace spaces with underscores and strip characters invalid for filenames
    return title
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[\\/:*?"<>|]/g, '')
  }

  const buildMarkdownForTable = (table: Table): { filename: string; content: string } => {
    // Determine date for filename
    let dateForName: Date
    if (table.type === 'day' && table.date) {
      dateForName = new Date(table.date + 'T00:00:00')
    } else {
      dateForName = new Date()
    }

    const yymmdd = formatYYMMDD(dateForName)
    const titleForFile = sanitizeTitleForFile(table.title || (table.type === 'day' && table.date ? formatDate(table.date) : 'Untitled'))
    const filename = `${yymmdd}-${titleForFile}.md`

    // Header
    const lines: string[] = [`# ${table.title || 'Untitled'}`, '']

    // Build bullet list
    let totalMinutes = 0
    let times: { start: string; end: string }[] = []
    if (table.type === 'day') {
      times = calculateTimes(table)
    }

    if (table.tasks.length === 0) {
      lines.push('_No tasks_')
    } else {
      table.tasks.forEach((task, idx) => {
        let bullet = '- '
        if (table.type === 'day' && times[idx]) {
          bullet += `${times[idx].start}–${times[idx].end} — `
        }
        bullet += task.title || '(untitled)'
        if (typeof task.duration === 'number' && task.duration > 0) {
          bullet += ` (${formatDuration(task.duration)})`
          totalMinutes += task.duration
        }
        lines.push(bullet)
      })
    }

    // Append total if there are durations
    if (totalMinutes > 0) {
      lines.push('', `Total: ${formatDuration(totalMinutes)}`)
    }

    return { filename, content: lines.join('\n') }
  }

  const downloadMarkdown = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportTableToMarkdown = (table: Table) => {
    const { filename, content } = buildMarkdownForTable(table)
    downloadMarkdown(filename, content)
  }

  // --- Move Menu UI ---
  const renderMoveMenu = () => {
    if (!moveMenu) return null
    const { tableId, taskIndex } = moveMenu
    const table = tables.find(t => t.id === tableId)
    const task = table?.tasks[taskIndex]
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-30 flex items-end md:items-center justify-center z-50" onClick={() => setMoveMenu(null)}>
        <div className="bg-white w-full md:w-[420px] rounded-t-lg md:rounded-lg p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-800">Move to the table</h3>
            <button className="text-gray-500 hover:text-gray-800" onClick={() => setMoveMenu(null)}>✕</button>
          </div>
          <div className="max-h-[50vh] overflow-auto divide-y">
            {tables.map((t) => (
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
  }

  // Auto-save tables to localStorage
  useEffect(() => {
    console.log('💾 Auto-saving tables to localStorage:', tables.length, 'tables')
    saveTables(tables)
    // Mark as modified for conflict detection
    syncManager.markLocalModified()
  }, [tables])

  // Sync calendar for premium users (debounced, separate effect)
  useEffect(() => {
    if (user?.plan === 'premium') {
      const dayTables = tables.filter(t => t.type === 'day')
      if (dayTables.length > 0) {
        // Debounce calendar sync to avoid duplicates
        const timer = setTimeout(() => {
          console.log('📅 Syncing calendar events...')
          api.syncCalendar(dayTables).catch(err => {
            console.error('Calendar sync failed:', err)
          })
        }, 1000) // Wait 1 second after last change
        
        return () => clearTimeout(timer)
      }
    }
  }, [tables, user?.plan])

  // Auto-save settings to localStorage
  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // Save timer position
  useEffect(() => {
    try {
      localStorage.setItem('tigement_timer_position', JSON.stringify(timerPosition))
    } catch (error) {
      console.error('Failed to save timer position:', error)
    }
  }, [timerPosition])

  // Update settings when spaces state changes
  useEffect(() => {
    const updatedSettings = {
      ...settings,
      viewMode,
      spaces,
      spacesSplitPosition,
      activeSpaceId
    }
    setSettings(updatedSettings)
  }, [viewMode, spaces, spacesSplitPosition, activeSpaceId])

  const addMinutes = (time: string, minutes: number): string => {
    const [h, m] = time.split(':').map(Number)
    const totalMinutes = h * 60 + m + minutes
    const hours = Math.floor(totalMinutes / 60) % 24
    const mins = totalMinutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  const calculateTimes = (table: Table): { start: string; end: string }[] => {
    const times: { start: string; end: string }[] = []
    let currentTime = table.startTime || settings.defaultStartTime

    table.tasks.forEach(task => {
      const start = currentTime
      const end = addMinutes(start, task.duration)
      times.push({ start, end })
      currentTime = end
    })

    return times
  }

  const getTotalDuration = (table: Table): string => {
    const total = table.tasks.reduce((sum, task) => sum + task.duration, 0)
    return formatDuration(total)
  }

  // Check if a task is in the past
  const isTaskInPast = (table: Table, endTime: string): boolean => {
    if (table.type !== 'day' || !table.date) return false
    
    const now = new Date()
    const taskDate = new Date(table.date)
    const [hours, minutes] = endTime.split(':').map(Number)
    
    taskDate.setHours(hours, minutes, 0, 0)
    
    return taskDate < now
  }

  // Check if a task is current (happening right now)
  const isTaskCurrent = (table: Table, startTime: string, endTime: string): boolean => {
    if (table.type !== 'day' || !table.date) return false
    
    const now = new Date()
    const taskDate = new Date(table.date)
    
    // Create start and end date objects
    const [startHours, startMinutes] = startTime.split(':').map(Number)
    const [endHours, endMinutes] = endTime.split(':').map(Number)
    
    const startDate = new Date(taskDate)
    startDate.setHours(startHours, startMinutes, 0, 0)
    
    const endDate = new Date(taskDate)
    endDate.setHours(endHours, endMinutes, 0, 0)
    
    return now >= startDate && now < endDate
  }

  const addTask = (tableId: string, afterIndex?: number) => {
    setTables(tables.map(table => {
      if (table.id === tableId) {
        const newTask: Task = {
          id: `task-${Date.now()}`,
          title: '',
          duration: settings.defaultDuration || 30, // Fallback to 30 if undefined/null/0
          selected: false
        }
        
        const newTasks = [...table.tasks]
        if (afterIndex !== undefined) {
          newTasks.splice(afterIndex + 1, 0, newTask)
        } else {
          newTasks.push(newTask)
        }
        
        return { ...table, tasks: newTasks }
      }
      return table
    }))
    focusTable(tableId) // Focus table when task is added
  }

  const duplicateTask = (tableId: string, taskId: string, index: number) => {
    setTables(tables.map(table => {
      if (table.id === tableId) {
        const taskToDuplicate = table.tasks[index]
        const newTask: Task = {
          ...taskToDuplicate,
          id: `task-${Date.now()}`,
          selected: false
        }
        const newTasks = [...table.tasks]
        newTasks.splice(index + 1, 0, newTask)
        return { ...table, tasks: newTasks }
      }
      return table
    }))
    focusTable(tableId)
  }

  const addTable = (type: 'day' | 'todo') => {
    // Smart date selection for Day tables
    let newDate: Date
    if (type === 'day') {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      
      // Check if today already exists in workspace
      const hasToday = tables.some(t => t.type === 'day' && t.date === todayStr)
      
      if (!hasToday) {
        // Use today if it doesn't exist yet
        newDate = today
      } else {
        // Today exists, find the last date and add 1 day
        const dayTables = tables.filter(t => t.type === 'day' && t.date)
        if (dayTables.length > 0) {
          // Find max date and add 1 day
          const maxDate = dayTables
            .map(t => new Date(t.date!))
            .reduce((max, date) => date > max ? date : max)
          newDate = new Date(maxDate)
          newDate.setDate(newDate.getDate() + 1)
        } else {
          // Fallback to today (shouldn't happen, but just in case)
          newDate = today
        }
      }
    }
    
    const dateStr = type === 'day' ? newDate!.toISOString().split('T')[0] : undefined
    
    const baseTable = {
      id: `${type}-${Date.now()}`,
      type,
      title: type === 'day' ? formatDate(dateStr!) : 'TODO',
      tasks: Array(settings.defaultTasksCount).fill(null).map((_, i) => ({
        id: `task-${Date.now()}-${i}`,
        title: '',
        duration: settings.defaultDuration,
        selected: false
      })),
      position: { x: 20 + tables.length * 100, y: 20 + tables.length * 50 }
    }
    
    const newTable: Table = type === 'day' 
      ? { 
          ...baseTable, 
          date: dateStr!,
          startTime: settings.defaultStartTime 
        }
      : baseTable as Table
    
    setTables([...tables, newTable])
    focusTable(newTable.id) // Focus newly created table
  }

  const deleteTable = (tableId: string) => {
    if (tables.length === 1) {
      alert('Cannot delete the last table!')
      return
    }
    if (confirm('Are you sure you want to delete this table and all its tasks?')) {
      setTables(tables.filter(t => t.id !== tableId))
    }
  }

  const updateTableDate = (tableId: string, date: string) => {
    setTables(tables.map(table => {
      if (table.id === tableId) {
        return { ...table, date, title: formatDate(date) }
      }
      return table
    }))
    focusTable(tableId) // Focus table when date is changed
  }

  const deleteTask = (tableId: string, taskId: string) => {
    setTables(tables.map(table => {
      if (table.id === tableId) {
        return {
          ...table,
          tasks: table.tasks.filter(task => task.id !== taskId)
        }
      }
      return table
    }))
    focusTable(tableId) // Focus table when task is deleted
  }

  const deleteSelected = (tableId: string) => {
    setTables(tables.map(table => {
      if (table.id === tableId) {
        return {
          ...table,
          tasks: table.tasks.filter(task => !task.selected)
        }
      }
      return table
    }))
  }

  const toggleSelect = (tableId: string, taskId: string) => {
    setTables(tables.map(table => {
      if (table.id === tableId) {
        return {
          ...table,
          tasks: table.tasks.map(task =>
            task.id === taskId ? { ...task, selected: !task.selected } : task
          )
        }
      }
      return table
    }))
  }

  const toggleSelectAll = (tableId: string) => {
    setTables(tables.map(table => {
      if (table.id === tableId) {
        const allSelected = table.tasks.every(task => task.selected)
        return {
          ...table,
          tasks: table.tasks.map(task => ({ ...task, selected: !allSelected }))
        }
      }
      return table
    }))
  }

  const updateTask = (tableId: string, taskId: string, field: keyof Task, value: any) => {
    setTables(prevTables => prevTables.map(table => {
      if (table.id === tableId) {
        return {
          ...table,
          tasks: table.tasks.map(task =>
            task.id === taskId ? { ...task, [field]: value } : task
          )
        }
      }
      return table
    }))
    focusTable(tableId) // Focus table when task is edited
  }

  const updateTableStartTime = (tableId: string, startTime: string) => {
    setTables(tables.map(table =>
      table.id === tableId ? { ...table, startTime } : table
    ))
    focusTable(tableId) // Focus table when start time is changed
  }

  // Bring table to front (highest z-index)
  const focusTable = (tableId: string) => {
    zIndexCounter.current += 1
    setTableZIndexes(prev => ({
      ...prev,
      [tableId]: zIndexCounter.current
    }))
  }

  const updateTablePosition = (tableId: string, x: number, y: number) => {
    setTables(tables.map(table =>
      table.id === tableId ? { ...table, position: { x, y } } : table
    ))
    focusTable(tableId) // Focus table when moved
  }

  const handleTableDragStart = (e: React.MouseEvent, tableId: string) => {
    if (isMobile) return // No drag on mobile
    
    const table = tables.find(t => t.id === tableId)
    if (!table) return
    
    const offsetX = e.clientX - table.position.x
    const offsetY = e.clientY - table.position.y
    
    setDraggedTable({ id: tableId, offsetX, offsetY })
    focusTable(tableId) // Focus table when drag starts
  }

  const handleTableDragMove = (e: React.MouseEvent) => {
    // Handle table dragging
    if (draggedTable && !isMobile) {
      let x = Math.max(0, e.clientX - draggedTable.offsetX)
      let y = Math.max(0, e.clientY - draggedTable.offsetY)
      
      // Apply snap to grid if enabled
      if (settings.snapToGrid && settings.gridSize) {
        x = Math.round(x / settings.gridSize) * settings.gridSize
        y = Math.round(y / settings.gridSize) * settings.gridSize
      }
      
      updateTablePosition(draggedTable.id, x, y)
    }
    // Handle table resizing
    if (resizingTable && !isMobile) {
      const deltaX = e.clientX - resizingTable.startX
      const deltaY = e.clientY - resizingTable.startY
      let newW = Math.max(480, Math.round(resizingTable.startW + deltaX))
      let newH = Math.max(200, Math.round(resizingTable.startH + deltaY))
      
      // Apply snap to grid if enabled
      if (settings.snapToGrid && settings.gridSize) {
        newW = Math.round(newW / settings.gridSize) * settings.gridSize
        newH = Math.round(newH / settings.gridSize) * settings.gridSize
      }
      
      setTables(tables.map(t => t.id === resizingTable.id ? { ...t, size: { width: Math.max(480, newW), height: Math.max(200, newH) } } : t))
      focusTable(resizingTable.id)
    }
  }

  const handleTableDragEnd = () => {
    setDraggedTable(null)
    setResizingTable(null)
  }

  const handleTableResizeStart = (e: React.MouseEvent, tableId: string) => {
    if (isMobile) return
    e.preventDefault()
    e.stopPropagation()
    const table = tables.find(t => t.id === tableId)
    if (!table) return
    const startW = table.size?.width ?? 680
    // Measure current height if not stored
    const containerEl = document.getElementById(`table-${tableId}`)
    const measuredH = containerEl ? containerEl.clientHeight : 300
    const startH = table.size?.height ?? measuredH
    setResizingTable({ id: tableId, startX: e.clientX, startY: e.clientY, startW, startH })
    focusTable(tableId)
  }

  const moveTaskUp = (tableId: string, index: number) => {
    if (index === 0) return
    setTables(tables.map(table => {
      if (table.id === tableId) {
        const newTasks = [...table.tasks]
        ;[newTasks[index - 1], newTasks[index]] = [newTasks[index], newTasks[index - 1]]
        return { ...table, tasks: newTasks }
      }
      return table
    }))
    focusTable(tableId) // Focus table when task is moved
  }

  const moveTaskDown = (tableId: string, index: number) => {
    setTables(tables.map(table => {
      if (table.id === tableId && index < table.tasks.length - 1) {
        const newTasks = [...table.tasks]
        ;[newTasks[index], newTasks[index + 1]] = [newTasks[index + 1], newTasks[index]]
        return { ...table, tasks: newTasks }
      }
      return table
    }))
    focusTable(tableId) // Focus table when task is moved
  }

  const handleDragStart = (tableId: string, taskId: string, index: number) => {
    setDraggedTask({ tableId, taskId, index })
  }

  const handleDragEnd = () => {
    // Always reset drag state when drag ends (successful drop or cancelled)
    setDraggedTask(null)
    setDropTarget(null)
  }

  // Begin drag only from handle (icons) - mobile
  const beginMobileDrag = (touch: Touch, tableId: string, taskId: string, index: number) => {
    setTouchDragStart({ y: touch.clientY, taskId, tableId, index })
    setDraggedTask({ tableId, taskId, index })
    // Lock page and container scroll while dragging
    try {
      document.body.style.overflow = 'hidden'
      if (scrollContainerRef.current) scrollContainerRef.current.style.overflow = 'hidden'
    } catch {}
  }

  // Start long-press on handle to initiate drag
  const handleHandleTouchStart = (e: React.TouchEvent, tableId: string, taskId: string, index: number) => {
    if (!isMobile) return
    const touch = e.touches[0]
    if (dragHandleTimer.current) window.clearTimeout(dragHandleTimer.current)
    dragHandleTimer.current = window.setTimeout(() => {
      beginMobileDrag(touch, tableId, taskId, index)
    }, 250) // short hold to begin drag
  }

  const handleHandleTouchEnd = () => {
    if (dragHandleTimer.current) {
      window.clearTimeout(dragHandleTimer.current)
      dragHandleTimer.current = null
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDragStart) return
    
    // Only prevent default if we're actually dragging
    if (e.cancelable) {
      e.preventDefault() // Prevent scrolling while dragging
    }
    
    const touch = e.touches[0]
    setTouchDragCurrent(touch.clientY)
    
    // Find which task element is under the touch point
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY)
    const taskElement = elements.find(el => el.getAttribute('data-task-index') !== null)
    
    if (taskElement) {
      const targetTableId = taskElement.getAttribute('data-table-id')
      const targetIndex = parseInt(taskElement.getAttribute('data-task-index') || '0')
      
      if (targetTableId) {
        setDropTarget({ tableId: targetTableId, index: targetIndex })
      }
    }
  }

  const handleTouchEnd = () => {
    if (touchDragStart && dropTarget && draggedTask) {
      // Perform the drop using same logic as handleDrop
      const targetTableId = dropTarget.tableId
      const targetIndex = dropTarget.index
      
      // Prevent self-drop
      if (draggedTask.tableId === targetTableId && draggedTask.index === targetIndex) {
        setTouchDragStart(null)
        setTouchDragCurrent(null)
        setDraggedTask(null)
        setDropTarget(null)
        return
      }

      setTables(prevTables => {
        const newTables = prevTables.map(t => ({ ...t, tasks: [...t.tasks] }))
        const sourceTableIdx = newTables.findIndex(t => t.id === draggedTask.tableId)
        const targetTableIdx = newTables.findIndex(t => t.id === targetTableId)
        
        if (sourceTableIdx === -1 || targetTableIdx === -1) return prevTables

        const sourceTable = newTables[sourceTableIdx]
        const targetTable = newTables[targetTableIdx]
        
        // Remove from source
        const [movedTask] = sourceTable.tasks.splice(draggedTask.index, 1)
        
        // Calculate correct target index
        let insertIndex = targetIndex
        if (draggedTask.tableId === targetTableId && draggedTask.index < targetIndex) {
          // Same table: adjust index since we removed one item
          insertIndex = targetIndex - 1
        }
        
        // Insert at target
        targetTable.tasks.splice(insertIndex, 0, movedTask)
        
        return newTables
      })
    }
    
    // Reset touch drag state
    setTouchDragStart(null)
    setTouchDragCurrent(null)
    setDraggedTask(null)
    setDropTarget(null)
    // Restore scroll
    try {
      document.body.style.overflow = ''
      if (scrollContainerRef.current) scrollContainerRef.current.style.overflow = ''
    } catch {}
  }

  // Move task to another table (append at end)
  const moveTaskToTable = (sourceTableId: string, taskIndex: number, targetTableId: string) => {
    if (sourceTableId === targetTableId) return
    setTables(prev => {
      const newTables = prev.map(t => ({ ...t, tasks: [...t.tasks] }))
      const sIdx = newTables.findIndex(t => t.id === sourceTableId)
      const tIdx = newTables.findIndex(t => t.id === targetTableId)
      if (sIdx === -1 || tIdx === -1) return prev
      const [moved] = newTables[sIdx].tasks.splice(taskIndex, 1)
      newTables[tIdx].tasks.push(moved)
      return newTables
    })
    focusTable(targetTableId) // Focus target table when task is moved
  }

  // Get task group info
  const getTaskGroup = (groupId?: string): TaskGroup | undefined => {
    const id = groupId || 'general'
    return taskGroups.find(g => g.id === id) || taskGroups[0]
  }

  // Change task group
  const changeTaskGroup = (tableId: string, taskId: string, groupId: string) => {
    setTables(tables.map(table => {
      if (table.id === tableId) {
        return {
          ...table,
          tasks: table.tasks.map(task =>
            task.id === taskId ? { ...task, group: groupId } : task
          )
        }
      }
      return table
    }))
    focusTable(tableId) // Focus table when task group is changed
  }

  // Create custom group
  const createCustomGroup = () => {
    if (!newGroupName.trim()) return
    
    const newGroup: TaskGroup = {
      id: `custom-${Date.now()}`,
      name: newGroupName.trim(),
      icon: newGroupIcon,
      color: newGroupColor
    }
    
    setTaskGroups([...taskGroups, newGroup])
    setNewGroupName('')
    setNewGroupIcon('briefcase')
    setNewGroupColor('#dbeafe')
    setShowCustomGroupForm(false)
    setEditingGroup(null)
  }

  // Update custom group
  const updateCustomGroup = () => {
    if (!editingGroup || !newGroupName.trim()) return
    
    const updatedGroup: TaskGroup = {
      ...editingGroup,
      name: newGroupName.trim(),
      icon: newGroupIcon,
      color: newGroupColor
    }
    
    setTaskGroups(taskGroups.map(g => g.id === editingGroup.id ? updatedGroup : g))
    setNewGroupName('')
    setNewGroupIcon('briefcase')
    setNewGroupColor('#dbeafe')
    setShowCustomGroupForm(false)
    setEditingGroup(null)
  }

  // Start editing a group
  const startEditingGroup = (group: TaskGroup) => {
    if (!group.id.startsWith('custom-')) return
    setEditingGroup(group)
    setNewGroupName(group.name)
    setNewGroupIcon(group.icon || 'briefcase')
    setNewGroupColor(group.color || '#dbeafe')
    setShowCustomGroupForm(true)
  }

  // Delete custom group
  const deleteCustomGroup = (groupId: string) => {
    // Don't allow deleting default groups
    if (!groupId.startsWith('custom-')) return
    
    // Remove group from list
    setTaskGroups(taskGroups.filter(g => g.id !== groupId))
    
    // Reset all tasks using this group to 'general'
    setTables(tables.map(table => ({
      ...table,
      tasks: table.tasks.map(task =>
        task.group === groupId ? { ...task, group: 'general' } : task
      )
    })))
  }

  // Bulk add selected tasks to group
  const bulkAddToGroup = (tableId: string, groupId: string) => {
    setTables(tables.map(table => {
      if (table.id === tableId) {
        return {
          ...table,
          tasks: table.tasks.map(task =>
            task.selected ? { ...task, group: groupId } : task
          )
        }
      }
      return table
    }))
    setBulkActionsOpen(null)
    focusTable(tableId) // Focus table when bulk group is changed
  }

  // Close bulk actions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setBulkActionsOpen(null)
    if (bulkActionsOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [bulkActionsOpen])

  // Close table action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setTableActionMenu(null)
    if (tableActionMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [tableActionMenu])

  // Archive handlers
  const archiveTable = async (tableId: string) => {
    const table = tables.find(t => t.id === tableId)
    if (!table) return
    
    // Remove from workspace
    setTables(tables.filter(t => t.id !== tableId))
    
    // Add to archived list
    const archivedTable: ArchivedTable = {
      id: Date.now().toString(), // temporary ID for local storage
      table_data: table,
      table_type: table.type,
      table_date: table.date || null,
      table_title: table.title,
      task_count: table.tasks.length,
      archived_at: new Date().toISOString()
    }
    
    // Save locally
    const archives = loadArchivedTables() || []
    archives.push(archivedTable)
    saveArchivedTables(archives)
    setArchivedTables(archives)
    
    // Sync to backend if logged in
    if (user) {
      try {
        const result = await api.archiveTable(table)
        // Update local archive with backend ID
        const updatedArchives = archives.map(a => 
          a.id === archivedTable.id ? { ...a, id: result.id } : a
        )
        saveArchivedTables(updatedArchives)
        setArchivedTables(updatedArchives)
      } catch (error) {
        console.error('Failed to sync archived table:', error)
      }
    }
  }

  const restoreTable = async (archivedTable: ArchivedTable) => {
    let tableData: Table
    
    // If we have table_data locally, use it
    if (archivedTable.table_data) {
      tableData = archivedTable.table_data
    } 
    // If it's a backend archive without table_data, fetch it
    else if (user && typeof archivedTable.id === 'number') {
      try {
        tableData = await api.restoreArchivedTable(archivedTable.id)
      } catch (error) {
        console.error('Failed to restore archived table from backend:', error)
        return
      }
    } else {
      console.error('Cannot restore: no table data available')
      return
    }
    
    // Remove from archived
    const archives = archivedTables.filter(a => a.id !== archivedTable.id)
    saveArchivedTables(archives)
    setArchivedTables(archives)
    
    // Add to workspace
    setTables([...tables, tableData])
    focusTable(tableData.id) // Focus restored table
    
    // Delete from backend if logged in and has numeric ID
    if (user && typeof archivedTable.id === 'number') {
      try {
        await api.deleteArchivedTable(archivedTable.id)
      } catch (error) {
        console.error('Failed to delete archived table from backend:', error)
      }
    }
  }

  // Notebook handlers
  const openWorkspaceNotebook = () => {
    // Check if already open
    if (openNotebooks.some(nb => nb.type === 'workspace')) return
    
    setOpenNotebooks([...openNotebooks, {
      id: 'workspace',
      type: 'workspace',
      position: { x: 100, y: 100 }
    }])
  }

  const openTaskNotebook = (tableId: string, taskId: string) => {
    // Check if already open
    if (openNotebooks.some(nb => nb.taskId === taskId)) return
    
    setOpenNotebooks([...openNotebooks, {
      id: `task-${taskId}`,
      type: 'task',
      taskId,
      tableId,
      position: { x: 150 + openNotebooks.length * 50, y: 150 + openNotebooks.length * 50 }
    }])
  }

  const closeNotebook = (id: string) => {
    setOpenNotebooks(openNotebooks.filter(nb => nb.id !== id))
  }

  const updateNotebookPosition = (id: string, position: { x: number; y: number }) => {
    setOpenNotebooks(openNotebooks.map(nb =>
      nb.id === id ? { ...nb, position } : nb
    ))
  }

  // Diary handlers
  const handleDiaryEntrySelect = async (date: string) => {
    // Load entry content if not already loaded
    if (!diaryEntries[date]) {
      if (user) {
        try {
          const { content } = await api.getDiaryEntry(date)
          const updated = { ...diaryEntries, [date]: content }
          setDiaryEntries(updated)
          saveDiaryEntries(updated)
        } catch (err) {
          console.error(`Failed to load diary entry ${date}:`, err)
          // Create empty entry
          const updated = { ...diaryEntries, [date]: '' }
          setDiaryEntries(updated)
          saveDiaryEntries(updated)
        }
      } else {
        // Create empty entry for anonymous users
        const updated = { ...diaryEntries, [date]: '' }
        setDiaryEntries(updated)
        saveDiaryEntries(updated)
      }
    }
    
    setOpenDiaryEntry({ date, position: { x: 200, y: 150 } })
    setShowDiaryList(false)
  }

  const handleDiaryEntryCreate = (date: string) => {
    handleDiaryEntrySelect(date)
  }

  const handleDiaryEntrySave = async (date: string, content: string) => {
    // Update local state
    const updated = { ...diaryEntries, [date]: content }
    setDiaryEntries(updated)
    saveDiaryEntries(updated)
    
    // Update preview in list
    const preview = content.substring(0, 50)
    setDiaryEntriesList(prev => {
      const existing = prev.find(e => e.date === date)
      if (existing) {
        return prev.map(e => e.date === date ? { ...e, preview } : e)
      } else {
        return [...prev, { date, preview }].sort((a, b) => b.date.localeCompare(a.date))
      }
    })
    
    // Sync to backend if logged in
    if (user) {
      try {
        await api.saveDiaryEntry(date, content)
      } catch (error) {
        console.error('Failed to sync diary entry:', error)
      }
    }
  }

  const handleDiaryEntryDateChange = async (oldDate: string, newDate: string) => {
    const content = diaryEntries[oldDate] || ''
    
    // Save to new date
    await handleDiaryEntrySave(newDate, content)
    
    // Remove old date if different
    if (oldDate !== newDate) {
      const updated = { ...diaryEntries }
      delete updated[oldDate]
      setDiaryEntries(updated)
      saveDiaryEntries(updated)
      
      // Update list
      setDiaryEntriesList(prev => prev.filter(e => e.date !== oldDate))
      
      // Delete from backend if logged in
      if (user) {
        try {
          await api.deleteDiaryEntry(oldDate)
        } catch (error) {
          console.error('Failed to delete old diary entry:', error)
        }
      }
      
      // Update open entry
      setOpenDiaryEntry({ date: newDate, position: openDiaryEntry?.position || { x: 200, y: 150 } })
    }
  }

  const handleDiaryEntryClose = () => {
    setOpenDiaryEntry(null)
    setShowDiaryList(true)
  }

  const handleDiaryEntryDelete = async (date: string) => {
    // Remove from local state
    const updated = { ...diaryEntries }
    delete updated[date]
    setDiaryEntries(updated)
    saveDiaryEntries(updated)
    
    // Update list
    setDiaryEntriesList(prev => prev.filter(e => e.date !== date))
    
    // Delete from backend if logged in
    if (user) {
      try {
        await api.deleteDiaryEntry(date)
      } catch (error) {
        console.error('Failed to delete diary entry:', error)
      }
    }
    
    // Close entry and return to list
    setOpenDiaryEntry(null)
    setShowDiaryList(true)
  }

  const handleSaveWorkspaceNotebook = async (content: string) => {
    setWorkspaceNotebook(content)
    
    // Save to localStorage
    const notebooks = loadNotebooks() || { workspace: '', tasks: {} }
    notebooks.workspace = content
    saveNotebooks(notebooks)
    
    // Sync to backend if logged in
    if (user) {
      try {
        await api.saveWorkspaceNotebook(content)
      } catch (error) {
        console.error('Failed to sync workspace notebook:', error)
      }
    }
  }

  const handleSaveTaskNotebook = async (taskId: string, content: string) => {
    // Update task in tables
    setTables(tables.map(table => ({
      ...table,
      tasks: table.tasks.map(task =>
        task.id === taskId ? { ...task, notebook: content } : task
      )
    })))
    
    // Save to localStorage
    const notebooks = loadNotebooks() || { workspace: '', tasks: {} }
    notebooks.tasks[taskId] = content
    saveNotebooks(notebooks)
    
    // Sync to backend if logged in
    if (user) {
      try {
        await api.saveTaskNotebook(taskId, content)
      } catch (error) {
        console.error('Failed to sync task notebook:', error)
      }
    }
  }

  // Load notebooks from localStorage on mount
  useEffect(() => {
    const notebooks = loadNotebooks()
    if (notebooks) {
      setWorkspaceNotebook(notebooks.workspace || '')
      
      // Update tasks with notebook content
      setTables(tables.map(table => ({
        ...table,
        tasks: table.tasks.map(task => ({
          ...task,
          notebook: notebooks.tasks[task.id] || task.notebook
        }))
      })))
    }
  }, [])

  // Load notebooks from backend when user logs in
  useEffect(() => {
    if (user) {
      // Load workspace notebook
      api.getWorkspaceNotebook().then(({ content }) => {
        if (content) {
          setWorkspaceNotebook(content)
          const notebooks = loadNotebooks() || { workspace: '', tasks: {} }
          notebooks.workspace = content
          saveNotebooks(notebooks)
        }
      }).catch(err => console.error('Failed to load workspace notebook:', err))

      // Load diary entries
      api.getDiaryEntries().then(backendEntries => {
        const localEntries = loadDiaryEntries() || {}
        // Merge: backend takes precedence, but keep local entries not on backend
        const merged: Record<string, string> = { ...localEntries }
        const entriesList: Array<{ date: string; preview: string }> = []
        
        // Load full content for each backend entry
        Promise.all(backendEntries.map(async (entry) => {
          try {
            // Normalize the date to ensure it's in YYYY-MM-DD format
            const normalizedDate = normalizeDate(entry.date)
            if (!normalizedDate) {
              console.warn('Invalid date format from backend:', entry.date)
              return
            }
            
            const { content } = await api.getDiaryEntry(normalizedDate)
            merged[normalizedDate] = content
            entriesList.push({ date: normalizedDate, preview: entry.preview })
          } catch (err) {
            console.error(`Failed to load diary entry ${entry.date}:`, err)
            const normalizedDate = normalizeDate(entry.date)
            if (normalizedDate) {
              entriesList.push({ date: normalizedDate, preview: entry.preview })
            }
          }
        })).then(() => {
          setDiaryEntries(merged)
          setDiaryEntriesList(entriesList)
          saveDiaryEntries(merged)
        })
      }).catch(err => {
        console.error('Failed to load diary entries:', err)
        // Fallback to local storage
        const localEntries = loadDiaryEntries() || {}
        // Normalize dates from local storage too
        const normalizedEntries: Record<string, string> = {}
        Object.keys(localEntries).forEach(date => {
          const normalized = normalizeDate(date)
          if (normalized) {
            normalizedEntries[normalized] = localEntries[date]
          }
        })
        setDiaryEntries(normalizedEntries)
        setDiaryEntriesList(Object.keys(normalizedEntries).map(date => ({
          date,
          preview: normalizedEntries[date].substring(0, 50)
        })))
      })
    } else {
      // Load from local storage when not logged in
      const localEntries = loadDiaryEntries() || {}
      // Normalize dates from local storage
      const normalizedEntries: Record<string, string> = {}
      Object.keys(localEntries).forEach(date => {
        const normalized = normalizeDate(date)
        if (normalized) {
          normalizedEntries[normalized] = localEntries[date]
        }
      })
      setDiaryEntries(normalizedEntries)
      setDiaryEntriesList(Object.keys(normalizedEntries).map(date => ({
        date,
        preview: normalizedEntries[date].substring(0, 50)
      })))
    }
  }, [user])

  // Load archived tables from localStorage and backend
  useEffect(() => {
    // Load from localStorage
    const localArchives = loadArchivedTables()
    if (localArchives) {
      setArchivedTables(localArchives)
    }
    
    // Load from backend if logged in
    if (user) {
      api.listArchivedTables().then(backendArchives => {
        // Merge backend archives (which don't have table_data in list)
        // with local archives, prioritizing backend IDs
        const mergedArchives: ArchivedTable[] = []
        
        // Add backend archives (metadata only, table_data fetched on restore)
        backendArchives.forEach(backendArchive => {
          mergedArchives.push({
            id: backendArchive.id,
            table_type: backendArchive.table_type,
            table_date: backendArchive.table_date,
            table_title: backendArchive.table_title,
            task_count: backendArchive.task_count,
            archived_at: backendArchive.archived_at
            // table_data will be fetched on restore
          })
        })
        
        // Add local archives that don't exist in backend (by checking if ID is string)
        const backendIds = new Set(backendArchives.map(a => a.id))
        if (localArchives) {
          localArchives.forEach(localArchive => {
            if (typeof localArchive.id === 'string' || !backendIds.has(localArchive.id)) {
              mergedArchives.push(localArchive)
            }
          })
        }
        
        setArchivedTables(mergedArchives)
        saveArchivedTables(mergedArchives)
      }).catch(err => console.error('Failed to load archived tables:', err))
    }
  }, [user])

  // Render group selector
  const renderGroupSelector = () => {
    if (!groupSelectorTask) return null
    const { tableId, taskId } = groupSelectorTask
    const task = tables.find(t => t.id === tableId)?.tasks.find(tk => tk.id === taskId)
    if (!task) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4" onClick={() => { setGroupSelectorTask(null); setShowCustomGroupForm(false); }}>
        <div className="bg-white w-full max-w-md rounded-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Select Group</h3>
            <button className="text-gray-500 hover:text-gray-800 text-2xl" onClick={() => { setGroupSelectorTask(null); setShowCustomGroupForm(false); }}>✕</button>
          </div>

          <div className="p-4">
            {/* Existing Groups */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {taskGroups.map((group) => (
                <div key={group.id} className="relative">
                  <button
                    onClick={() => { changeTaskGroup(tableId, taskId, group.id); setGroupSelectorTask(null); setShowCustomGroupForm(false); setEditingGroup(null); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded border-2 transition ${
                      task.group === group.id || (!task.group && group.id === 'general')
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ 
                      backgroundColor: group.color,
                      color: getContrastColor(group.color)
                    }}
                  >
                    {group.icon && iconMap[group.icon] && (
                      <FontAwesomeIcon icon={iconMap[group.icon]} style={{ color: getContrastColor(group.color) }} />
                    )}
                    <span className="text-sm font-medium flex-1 text-left">{group.name}</span>
                  </button>
                  {/* Delete and Edit buttons for custom groups */}
                  {group.id.startsWith('custom-') && (
                    <div className="absolute top-0 right-0 -mt-1 -mr-1 flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditingGroup(group); }}
                        className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-blue-600"
                        title="Edit custom group"
                      >
                        ✎
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCustomGroup(group.id); }}
                        className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                        title="Delete custom group"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Create Custom Group Button */}
            {!showCustomGroupForm && (
              <button
                onClick={() => setShowCustomGroupForm(true)}
                className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition font-medium"
              >
                + Create Custom Group
              </button>
            )}

            {/* Custom Group Form */}
            {showCustomGroupForm && (
              <div className="border-t border-gray-200 pt-3 mt-3">
                <h4 className="text-md font-semibold text-gray-800 mb-3">
                  {editingGroup ? 'Edit Custom Group' : 'Create Custom Group'}
                </h4>
                
                {/* Group Name */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g., Exercise, Cooking, Projects"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Icon Selection */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                  <input
                    type="text"
                    placeholder="Search icons..."
                    onChange={(e) => setNewGroupIcon(prev => prev)} // keep selected
                    className="w-full mb-2 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-icon-search="1"
                  />
                  <div className="grid grid-cols-6 gap-2 max-h-80 overflow-y-auto border border-gray-300 rounded p-2">
                    {availableIcons
                      .filter(icon => {
                        const box = (document.querySelector('[data-icon-search=\"1\"]') as HTMLInputElement | null)
                        const q = box?.value?.toLowerCase() || ''
                        return !q || icon.toLowerCase().includes(q)
                      })
                      .map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setNewGroupIcon(icon)}
                        className={`p-2 rounded hover:bg-gray-100 transition ${
                          newGroupIcon === icon ? 'bg-blue-100 border-2 border-blue-500' : 'border border-gray-200'
                        }`}
                      >
                        <FontAwesomeIcon icon={iconMap[icon]} className={newGroupIcon === icon ? 'text-blue-700' : 'text-gray-900'} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Picker */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input
                    type="color"
                    value={newGroupColor}
                    onChange={(e) => setNewGroupColor(e.target.value)}
                    className="w-full h-10 border border-gray-300 rounded cursor-pointer"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={editingGroup ? updateCustomGroup : createCustomGroup}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
                  >
                    {editingGroup ? 'Update' : 'Create'}
                  </button>
                  <button
                    onClick={() => { 
                      setShowCustomGroupForm(false); 
                      setEditingGroup(null);
                      setNewGroupName(''); 
                    }}
                    className="flex-1 px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Long-press move menu state
  const [moveMenu, setMoveMenu] = useState<{ tableId: string; taskIndex: number } | null>(null)

  const startMoveLongPress = (e: React.TouchEvent, tableId: string, taskIndex: number) => {
    if (!isMobile) return
    if (handleLongPressTimer.current) window.clearTimeout(handleLongPressTimer.current)
    const touch = e.touches[0]
    handleLongPressTimer.current = window.setTimeout(() => {
      navigator.vibrate?.(10)
      setMoveMenu({ tableId, taskIndex })
    }, 500)
  }

  const cancelMoveLongPress = () => {
    if (handleLongPressTimer.current) {
      window.clearTimeout(handleLongPressTimer.current)
      handleLongPressTimer.current = null
    }
  }

  const handleDragOver = (e: React.DragEvent, tableId: string, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDropTarget({ tableId, index })
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    // Only clear if we're leaving the entire workspace
    if (e.currentTarget === e.target) {
      setDropTarget(null)
    }
  }

  const handleDrop = (e: React.DragEvent, targetTableId: string, targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!draggedTask) return

    // Prevent double-execution
    if (draggedTask.tableId === targetTableId && draggedTask.index === targetIndex) {
      setDraggedTask(null)
      setDropTarget(null)
      return
    }

    setTables(prevTables => {
      const newTables = prevTables.map(t => ({ ...t, tasks: [...t.tasks] }))
      const sourceTableIdx = newTables.findIndex(t => t.id === draggedTask.tableId)
      const targetTableIdx = newTables.findIndex(t => t.id === targetTableId)
      
      if (sourceTableIdx === -1 || targetTableIdx === -1) return prevTables

      const sourceTable = newTables[sourceTableIdx]
      const targetTable = newTables[targetTableIdx]
      
      // Remove from source
      const [movedTask] = sourceTable.tasks.splice(draggedTask.index, 1)
      
      // Calculate correct target index
      let insertIndex = targetIndex
      if (draggedTask.tableId === targetTableId && draggedTask.index < targetIndex) {
        // Same table: adjust index since we removed one item
        insertIndex = targetIndex - 1
      }
      
      // Insert at target
      targetTable.tasks.splice(insertIndex, 0, movedTask)
      
      return newTables
    })

    setDraggedTask(null)
    setDropTarget(null)
  }

  const handleExportCSV = () => {
    const csv = exportToCSV(tables)
    const date = new Date().toISOString().split('T')[0]
    downloadCSV(csv, `tigement-${date}.csv`)
  }

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const csv = e.target?.result as string
      const imported = importFromCSV(csv)
      if (imported.length > 0) {
        setTables(imported)
      }
    }
    reader.readAsText(file)
  }

  const handleConflictResolve = (resolution: 'local' | 'remote' | 'merge', selectedTables?: any[]) => {
    if (conflictResolver) {
      conflictResolver({ resolution, mergedTables: selectedTables })
      setShowConflict(false)
      setConflictData(null)
      setConflictResolver(null)
    }
  }

  const handleConflictCancel = () => {
    if (conflictResolver) {
      // Default to remote (safe option) on cancel
      conflictResolver({ resolution: 'remote' })
      setShowConflict(false)
      setConflictData(null)
      setConflictResolver(null)
    }
  }

  const handleEmptyDataConfirm = () => {
    if (emptyDataResolver) {
      emptyDataResolver(true)
      setShowEmptyDataConfirm(false)
      setEmptyDataResolver(null)
    }
  }

  const handleEmptyDataCancel = () => {
    if (emptyDataResolver) {
      emptyDataResolver(false)
      setShowEmptyDataConfirm(false)
      setEmptyDataResolver(null)
    }
  }

  const handleSyncNow = async () => {
    if (!user || user.plan !== 'premium') {
      alert('Sync is only available for Premium users')
      return
    }

    setSyncing(true)
    try {
      await syncNow()
      alert('Sync completed successfully!')
    } catch (error: any) {
      console.error('Sync failed:', error)
      alert(`Sync failed: ${error.message || 'Unknown error'}`)
    } finally {
      setSyncing(false)
    }
  }

  // Space management functions
  const handleAddSpace = () => {
    const name = prompt('Enter space name:')
    if (!name || !name.trim()) return
    
    const newSpace: Space = {
      id: `space-${Date.now()}`,
      name: name.trim(),
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
    }
    
    setSpaces([...spaces, newSpace])
    setActiveSpaceId(newSpace.id)
  }

  const handleEditSpace = (spaceId: string) => {
    const space = spaces.find((s) => s.id === spaceId)
    if (!space) return
    
    const newName = prompt('Edit space name:', space.name)
    if (!newName || !newName.trim()) return
    
    setSpaces(spaces.map((s) => 
      s.id === spaceId ? { ...s, name: newName.trim() } : s
    ))
  }

  const handleDeleteSpace = (spaceId: string) => {
    if (spaces.length <= 1) {
      alert('Cannot delete the last space')
      return
    }
    
    if (!confirm('Delete this space? TODO tables will remain but become visible in all spaces.')) {
      return
    }
    
    // Remove space
    const newSpaces = spaces.filter((s) => s.id !== spaceId)
    setSpaces(newSpaces)
    
    // Clear spaceId from tables assigned to this space
    setTables(tables.map((t) => 
      t.spaceId === spaceId ? { ...t, spaceId: null } : t
    ))
    
    // Switch to first space if deleting active
    if (activeSpaceId === spaceId) {
      setActiveSpaceId(newSpaces[0].id)
    }
  }

  const handleAssignTableToSpace = (tableId: string, spaceId: string | null) => {
    setTables(tables.map((t) => 
      t.id === tableId ? { ...t, spaceId } : t
    ))
  }

  return (
    <div className="workspace h-full overflow-hidden bg-gray-100 flex">
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="fixed top-4 right-4 z-50 px-3 py-2 bg-[#4a6c7a] text-white rounded hover:bg-[#3a5c6a] transition shadow-lg"
        >
          <div className="flex flex-col gap-1 w-5">
            <div className="h-0.5 bg-white"></div>
            <div className="h-0.5 bg-white"></div>
            <div className="h-0.5 bg-white"></div>
          </div>
        </button>
      )}

      {/* Vertical Menu Sidebar - Desktop or Mobile Overlay */}
      {(!isMobile || showMenu) && (
        <>
          {isMobile && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setShowMenu(false)}
            />
          )}
          <div className={`${
            isMobile 
              ? 'fixed top-0 right-0 h-full w-64 bg-white shadow-2xl z-50 overflow-y-auto' 
              : 'flex-shrink-0 w-48 bg-white border-l border-gray-200 overflow-y-auto order-last'
          }`}>
            <div className="p-4 flex flex-col gap-2">
              {isMobile && (
                <button
                  onClick={() => setShowMenu(false)}
                  className="self-end text-2xl text-gray-600 hover:text-gray-900 mb-2"
                >
                  ×
                </button>
              )}
              
              {/* Primary Actions: Create Tables */}
              <button
                onClick={() => { addTable('todo'); isMobile && setShowMenu(false); }}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm text-left"
              >
                Add TODO
              </button>
              <button
                onClick={() => { addTable('day'); isMobile && setShowMenu(false); }}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm text-left"
              >
                Add Day
              </button>
              
              {/* View Mode Toggle - Desktop Only */}
              {!isMobile && (
                <>
                  <div className="border-t border-gray-300 my-2"></div>
                  <div className="px-1">
                    <label className="text-xs text-gray-600 mb-1 block">View Mode</label>
                    <div className="flex gap-1 bg-gray-100 p-1 rounded">
                      <button
                        onClick={() => setViewMode('all-in-one')}
                        className={`flex-1 px-2 py-1 rounded text-xs transition ${
                          viewMode === 'all-in-one'
                            ? 'bg-white shadow text-gray-900 font-medium'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                        title="All-in-one view: freeform canvas"
                      >
                        🎯 All-in-one
                      </button>
                      <button
                        onClick={() => setViewMode('spaces')}
                        className={`flex-1 px-2 py-1 rounded text-xs transition ${
                          viewMode === 'spaces'
                            ? 'bg-white shadow text-gray-900 font-medium'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                        title="Spaces view: days left, TODO spaces right"
                      >
                        📐 Spaces
                      </button>
                    </div>
                  </div>
                  
                  {/* Spaces Filter (All-in-one view only) */}
                  {viewMode === 'all-in-one' && (
                    <>
                      <div className="border-t border-gray-300 my-2"></div>
                      <div className="px-1">
                        <label className="text-xs text-gray-600 mb-1 block">TODO Spaces Filter</label>
                        <div className="space-y-1">
                          {spaces.map(space => (
                            <button
                              key={space.id}
                              onClick={() => toggleSpaceVisibility(space.id)}
                              className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition ${
                                visibleSpaces.has(space.id)
                                  ? 'bg-white shadow text-gray-900'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {space.icon && iconMap[space.icon] && (
                                <FontAwesomeIcon icon={iconMap[space.icon]} size="sm" />
                              )}
                              <span className="flex-1 text-left">{space.name}</span>
                              {visibleSpaces.has(space.id) ? '👁️' : ''}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
              
              <div className="border-t border-gray-300 my-2"></div>
              
              {/* Collapsible Menu Sections */}
              
              {/* Workspace Section */}
              <div className="border-b border-gray-200 pb-2 mb-2">
                <button
                  onClick={() => toggleMenu('workspace')}
                  className="w-full px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-100 rounded flex items-center justify-between"
                >
                  <span>{showEmoji && '📊 '}Workspace</span>
                  <span>{expandedMenus.has('workspace') ? '▼' : '▶'}</span>
                </button>
                {expandedMenus.has('workspace') && (
                  <div className="ml-2 space-y-1 mt-1">
                    <button onClick={() => { setShowTimer(true); isMobile && setShowMenu(false); }} className="w-full px-3 py-2 bg-[#4fc3f7] text-white rounded hover:bg-[#3ba3d7] transition text-sm text-left">
                      {showEmoji && '⏱️ '}Timer
                    </button>
                    <button onClick={() => { openWorkspaceNotebook(); isMobile && setShowMenu(false); }} className="w-full px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                      {showEmoji && '📓 '}Notebook
                    </button>
                    <button onClick={() => { setShowDiaryList(true); isMobile && setShowMenu(false); }} className="w-full px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                      {showEmoji && '📔 '}Diary
                    </button>
                    <button onClick={() => { setShowStatistics(true); isMobile && setShowMenu(false); }} className="w-full px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                      {showEmoji && '📈 '}Statistics
                    </button>
                  </div>
                )}
              </div>

              {/* Tables Section */}
              <div className="border-b border-gray-200 pb-2 mb-2">
                <button
                  onClick={() => toggleMenu('tables')}
                  className="w-full px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-100 rounded flex items-center justify-between"
                >
                  <span>{showEmoji && '📋 '}Tables</span>
                  <span>{expandedMenus.has('tables') ? '▼' : '▶'}</span>
                </button>
                {expandedMenus.has('tables') && (
                  <div className="ml-2 space-y-1 mt-1">
                    <button onClick={() => { setShowArchivedMenu(true); isMobile && setShowMenu(false); }} className="w-full px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                      {showEmoji && '📦 '}Archived
                    </button>
                  </div>
                )}
              </div>

              {/* Settings Section */}
              <div className="border-b border-gray-200 pb-2 mb-2">
                <button
                  onClick={() => toggleMenu('settings')}
                  className="w-full px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-100 rounded flex items-center justify-between"
                >
                  <span>{showEmoji && '⚙️ '}Settings</span>
                  <span>{expandedMenus.has('settings') ? '▼' : '▶'}</span>
                </button>
                {expandedMenus.has('settings') && (
                  <div className="ml-2 space-y-1 mt-1">
                    <button onClick={() => { setShowSettings(true); isMobile && setShowMenu(false); }} className="w-full px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                      {showEmoji && '⚙️ '}Settings
                    </button>
                    <button onClick={() => { setShowGroupsEditor(true); isMobile && setShowMenu(false); }} className="w-full px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                      {showEmoji && '🏷️ '}Edit Groups
                    </button>
                    <button onClick={() => { setShowManual(true); isMobile && setShowMenu(false); }} className="w-full px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                      {showEmoji && '📖 '}Manual
                    </button>
                  </div>
                )}
              </div>

              {/* Data Section */}
              <div className="border-b border-gray-200 pb-2 mb-2">
                <button
                  onClick={() => toggleMenu('data')}
                  className="w-full px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-100 rounded flex items-center justify-between"
                >
                  <span>{showEmoji && '💾 '}Data</span>
                  <span>{expandedMenus.has('data') ? '▼' : '▶'}</span>
                </button>
                {expandedMenus.has('data') && (
                  <div className="ml-2 space-y-1 mt-1">
                    <button onClick={() => { handleExportCSV(); isMobile && setShowMenu(false); }} className="w-full px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                      {showEmoji && '📤 '}Export CSV
                    </button>
                    <button onClick={() => { fileInputRef.current?.click(); isMobile && setShowMenu(false); }} className="w-full px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                      {showEmoji && '📥 '}Import CSV
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleImportCSV}
                      className="hidden"
                    />
                    {user?.plan === 'premium' && (
                      <button onClick={() => { handleSyncNow(); isMobile && setShowMenu(false); }} disabled={syncing} className="w-full px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm disabled:opacity-50 text-left border border-gray-300" title="Sync workspace to cloud">
                        {syncing ? (showEmoji ? '🔄 Syncing...' : 'Syncing...') : (showEmoji ? '☁️ Sync Now' : 'Sync Now')}
                      </button>
                    )}
                    <button onClick={undo} disabled={historyIndex <= 0} className="w-full px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm disabled:opacity-30 disabled:cursor-not-allowed text-left border border-gray-300" title="Undo (Ctrl+Z)">
                      {showEmoji && '↶ '}Undo
                    </button>
                    <button onClick={redo} disabled={historyIndex >= history.length - 1} className="w-full px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm disabled:opacity-30 disabled:cursor-not-allowed text-left border border-gray-300" title="Redo (Ctrl+Shift+Z / Ctrl+Y)">
                      {showEmoji && '↷ '}Redo
                    </button>
                  </div>
                )}
              </div>

              {/* Help Section */}
              <div className="mb-2">
                <button
                  onClick={() => toggleMenu('help')}
                  className="w-full px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-100 rounded flex items-center justify-between"
                >
                  <span>{showEmoji && '💬 '}Help</span>
                  <span>{expandedMenus.has('help') ? '▼' : '▶'}</span>
                </button>
                {expandedMenus.has('help') && (
                  <div className="ml-2 space-y-1 mt-1">
                    <button onClick={() => { setShowBugReport(true); isMobile && setShowMenu(false); }} className="w-full px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                      {showEmoji && '🐛 '}Report Bug
                    </button>
                    <button onClick={() => { setShowFeatureRequest(true); isMobile && setShowMenu(false); }} className="w-full px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                      {showEmoji && '✨ '}Feature Request
                    </button>
                  </div>
                )}
              </div>
              
              <div className="border-t border-gray-300 my-2"></div>
              
              {/* Special Actions */}
              <button
                onClick={() => { window.dispatchEvent(new Event('tigement:request-merge')); isMobile && setShowMenu(false); }}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm text-left"
              >
                {showEmoji && '🔗 '}Merge local data…
              </button>
              {/* Premium Button - Mobile Only */}
              {isMobile && onShowPremium && (
                <>
                  <div className="border-t border-gray-300 my-2"></div>
                  {user?.plan === 'premium' ? (
                    <button
                      onClick={() => { onShowPremium(); isMobile && setShowMenu(false); }}
                      className="w-full px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-sm text-center font-medium transition"
                      title="Tap to extend subscription"
                    >
                      ✨ Premium - Tap to Extend
                    </button>
                  ) : (
                    <button
                      onClick={() => { onShowPremium(); isMobile && setShowMenu(false); }}
                      className="w-full px-3 py-2 bg-yellow-500 hover:bg-yellow-600 rounded text-sm transition font-medium text-left"
                    >
                      ✨ Upgrade to Premium
                    </button>
                  )}
                </>
              )}
              
              {!isMobile && (
                <>
                  <div className="border-t border-gray-300 my-2"></div>
                  <button
                    onClick={zoomOut}
                    disabled={zoom <= 0.5}
                    className="w-full px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition text-sm disabled:opacity-30 disabled:cursor-not-allowed text-left"
                    title="Zoom Out"
                  >
                    {showEmoji ? '🔍−' : 'Zoom −'}
                  </button>
                  <div className="px-3 py-2 text-sm font-medium text-gray-700 text-center bg-gray-100 rounded">
                    {Math.round(zoom * 100)}%
                  </div>
                  <button
                    onClick={zoomIn}
                    disabled={zoom >= 2}
                    className="w-full px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition text-sm disabled:opacity-30 disabled:cursor-not-allowed text-left"
                    title="Zoom In"
                  >
                    {showEmoji ? '🔍+' : 'Zoom +'}
                  </button>
                  <button
                    onClick={zoomReset}
                    className="w-full px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition text-sm text-left"
                    title="Reset Zoom"
                  >
                    {showEmoji ? '100%' : 'Reset'}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
      
      {/* Main Workspace Area */}
      {!isMobile && viewMode === 'spaces' ? (
        // SPACES VIEW: Split layout with days left, TODO spaces right
        <div className="flex-1 overflow-hidden">
          <SplitView
            leftContent={
              <div 
                className="h-full overflow-auto px-4 pb-8 bg-gray-100 relative"
                style={{ 
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  width: `${100 / zoom}%`,
                  minHeight: `${100 / zoom}%`
                }}
                onMouseMove={handleTableDragMove}
                onMouseUp={handleTableDragEnd}
                onMouseLeave={handleTableDragEnd}
              >
                {/* Render Day tables in left panel */}
                {tables.filter(t => t.type === 'day').map(table => {
                  const times = table.type === 'day' ? calculateTimes(table) : []
                  const isDraggingTable = draggedTable?.id === table.id
                  const tableZIndex = tableZIndexes[table.id] || 1
                  
                  
                  return (
                    <div
                      key={table.id}
                      onClick={() => focusTable(table.id)}
                      style={{ 
                        position: 'absolute',
                        left: `${table.position.x}px`,
                        top: `${table.position.y}px`,
                        width: `${table.size?.width ?? 680}px`,
                        minHeight: table.size?.height ? table.size.height : 400,
                        height: table.size?.height ? table.size.height : 'auto',
                      }}
                    >
                      <TableComponent
                        table={table}
                        times={times}
                        isDraggingTable={isDraggingTable}
                        tableZIndex={tableZIndex}
                        isMobile={false}
                        zoom={zoom}
                        settings={settings}
                        showEmoji={showEmoji}
                        iconMap={iconMap}
                        viewMode="spaces"
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
                        draggedTask={draggedTask}
                        dropTarget={dropTarget}
                        draggedTable={draggedTable}
                        touchDragStart={touchDragStart}
                        handleTableDragStart={handleTableDragStart}
                        handleTableResizeStart={handleTableResizeStart}
                        updateTableDate={updateTableDate}
                        setTables={setTables}
                        archiveTable={archiveTable}
                        deleteTable={deleteTable}
                        toggleSelectAll={toggleSelectAll}
                        updateTableStartTime={updateTableStartTime}
                        handleDragOver={handleDragOver}
                        handleDragLeave={handleDragLeave}
                        handleDrop={handleDrop}
                        toggleSelect={toggleSelect}
                        moveTaskUp={moveTaskUp}
                        moveTaskDown={moveTaskDown}
                        handleHandleTouchStart={handleHandleTouchStart}
                        handleHandleTouchEnd={handleHandleTouchEnd}
                        handleDragStart={handleDragStart}
                        handleDragEnd={handleDragEnd}
                        handleTouchMove={handleTouchMove}
                        handleTouchEnd={handleTouchEnd}
                        updateTask={updateTask}
                        startMoveLongPress={startMoveLongPress}
                        cancelMoveLongPress={cancelMoveLongPress}
                        openTaskNotebook={openTaskNotebook}
                        addTask={addTask}
                        deleteTask={deleteTask}
                        deleteSelected={deleteSelected}
                        exportTableToMarkdown={exportTableToMarkdown}
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
                        tables={tables}
                      />
                    </div>
                  )
                })}
              </div>
            }
            rightContent={
              <div className="h-full flex flex-col overflow-visible">
                <div className="relative z-10">
                  <SpaceTabs
                    spaces={spaces}
                    activeSpaceId={activeSpaceId}
                    onSpaceChange={setActiveSpaceId}
                    onAddSpace={handleAddSpace}
                    onEditSpace={handleEditSpace}
                    onDeleteSpace={handleDeleteSpace}
                    iconMap={iconMap}
                  />
                </div>
                <div 
                  className="flex-1 overflow-auto px-4 pb-8 bg-gray-100 relative"
                  style={{ 
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    width: `${100 / zoom}%`,
                    minHeight: `${100 / zoom}%`
                  }}
                  onMouseMove={handleTableDragMove}
                  onMouseUp={handleTableDragEnd}
                  onMouseLeave={handleTableDragEnd}
                >
                  {/* Render TODO tables in right panel (filtered by space) */}
                  {tables.filter(t => 
                    t.type === 'todo' &&
                    (t.spaceId === activeSpaceId || !t.spaceId)
                  ).map(table => {
                    const isDraggingTable = draggedTable?.id === table.id
                    const tableZIndex = tableZIndexes[table.id] || 1
                    
                    
                    return (
                      <div
                        key={table.id}
                        onClick={() => focusTable(table.id)}
                        style={{ 
                          position: 'absolute',
                          left: `${table.position.x}px`,
                          top: `${table.position.y}px`,
                          width: `${table.size?.width ?? 680}px`,
                          minHeight: table.size?.height ? table.size.height : 400,
                          height: table.size?.height ? table.size.height : 'auto',
                        }}
                      >
                        <TableComponent
                          table={table}
                          times={[]}
                          isDraggingTable={isDraggingTable}
                          tableZIndex={tableZIndex}
                          isMobile={false}
                          zoom={zoom}
                          settings={settings}
                          showEmoji={showEmoji}
                          iconMap={iconMap}
                          viewMode="spaces"
                          spaces={spaces}
                          handleAssignTableToSpace={handleAssignTableToSpace}
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
                          draggedTask={draggedTask}
                          dropTarget={dropTarget}
                          draggedTable={draggedTable}
                          touchDragStart={touchDragStart}
                          handleTableDragStart={handleTableDragStart}
                          handleTableResizeStart={handleTableResizeStart}
                          updateTableDate={updateTableDate}
                          setTables={setTables}
                          archiveTable={archiveTable}
                          deleteTable={deleteTable}
                          toggleSelectAll={toggleSelectAll}
                          updateTableStartTime={updateTableStartTime}
                          handleDragOver={handleDragOver}
                          handleDragLeave={handleDragLeave}
                          handleDrop={handleDrop}
                          toggleSelect={toggleSelect}
                          moveTaskUp={moveTaskUp}
                          moveTaskDown={moveTaskDown}
                          handleHandleTouchStart={handleHandleTouchStart}
                          handleHandleTouchEnd={handleHandleTouchEnd}
                          handleDragStart={handleDragStart}
                          handleDragEnd={handleDragEnd}
                          handleTouchMove={handleTouchMove}
                          handleTouchEnd={handleTouchEnd}
                          updateTask={updateTask}
                          startMoveLongPress={startMoveLongPress}
                          cancelMoveLongPress={cancelMoveLongPress}
                          openTaskNotebook={openTaskNotebook}
                          addTask={addTask}
                          deleteTask={deleteTask}
                          deleteSelected={deleteSelected}
                          exportTableToMarkdown={exportTableToMarkdown}
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
                          tables={tables}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            }
            initialSplitPosition={spacesSplitPosition}
            onSplitChange={setSpacesSplitPosition}
          />
        </div>
      ) : (
        // ALL-IN-ONE VIEW: Current freeform canvas
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-auto px-8 pb-8"
        >
          <div 
            className={isMobile ? "w-full" : "relative min-h-full"}
            style={!isMobile ? { 
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              width: `${100 / zoom}%`,
              minHeight: `${100 / zoom}%`
            } : undefined}
            onMouseMove={!isMobile ? handleTableDragMove : undefined}
            onMouseUp={!isMobile ? handleTableDragEnd : undefined}
            onMouseLeave={!isMobile ? handleTableDragEnd : undefined}
          >
          {(isMobile ? [tables[currentTableIndex]].filter(Boolean) : tables)
            .filter(table => {
              // In all-in-one view, filter TODO tables by visible spaces
              if (viewMode === 'all-in-one' && table.type === 'todo') {
                return !table.spaceId || visibleSpaces.has(table.spaceId)
              }
              return true
            })
            .map(table => {
          const times = table.type === 'day' ? calculateTimes(table) : []
          const isDraggingTable = draggedTable?.id === table.id
          const tableZIndex = tableZIndexes[table.id] || 1
          
          return (
            <div
              key={table.id}
              onClick={!isMobile ? () => focusTable(table.id) : undefined}
              style={isMobile ? { width: '100%', marginBottom: '100px', overflowX: 'auto' } : {
                position: 'absolute',
                left: `${table.position.x}px`,
                top: `${table.position.y}px`,
                width: `${table.size?.width ?? 600}px`,
                minHeight: table.size?.height ? table.size.height : 400,
                height: table.size?.height ? table.size.height : 'auto',
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                zIndex: isDraggingTable ? 1000 : tableZIndex,
                opacity: isDraggingTable ? 0.7 : 1,
                cursor: isDraggingTable ? 'grabbing' : 'default',
              }}
            >
              <TableComponent
                table={table}
                times={times}
                isDraggingTable={isDraggingTable}
                tableZIndex={tableZIndex}
                isMobile={isMobile}
                zoom={zoom}
                settings={settings}
                showEmoji={showEmoji}
                iconMap={iconMap}
                viewMode="all-in-one"
                spaces={spaces}
                handleAssignTableToSpace={handleAssignTableToSpace}
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
                draggedTask={draggedTask}
                dropTarget={dropTarget}
                draggedTable={draggedTable}
                touchDragStart={touchDragStart}
                handleTableDragStart={handleTableDragStart}
                handleTableResizeStart={handleTableResizeStart}
                updateTableDate={updateTableDate}
                setTables={setTables}
                archiveTable={archiveTable}
                deleteTable={deleteTable}
                toggleSelectAll={toggleSelectAll}
                updateTableStartTime={updateTableStartTime}
                handleDragOver={handleDragOver}
                handleDragLeave={handleDragLeave}
                handleDrop={handleDrop}
                toggleSelect={toggleSelect}
                moveTaskUp={moveTaskUp}
                moveTaskDown={moveTaskDown}
                handleHandleTouchStart={handleHandleTouchStart}
                handleHandleTouchEnd={handleHandleTouchEnd}
                handleDragStart={handleDragStart}
                handleDragEnd={handleDragEnd}
                handleTouchMove={handleTouchMove}
                handleTouchEnd={handleTouchEnd}
                updateTask={updateTask}
                startMoveLongPress={startMoveLongPress}
                cancelMoveLongPress={cancelMoveLongPress}
                openTaskNotebook={openTaskNotebook}
                addTask={addTask}
                duplicateTask={duplicateTask}
                deleteTask={deleteTask}
                deleteSelected={deleteSelected}
                exportTableToMarkdown={exportTableToMarkdown}
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
                tables={tables}
              />
            </div>
          )
        })}
        </div>
        </div>
      )}

      {/* Mobile Pagination */}
      {isMobile && tables.length > 1 && (
        <div className="fixed bottom-0 left-0 right-0 flex justify-between items-center gap-2 p-3 bg-gray-100 border-t-2 border-gray-300 shadow-lg z-50">
          <button
            onClick={() => setCurrentTableIndex(Math.max(0, currentTableIndex - 1))}
            disabled={currentTableIndex === 0}
            className="px-3 py-2 bg-[#4a6c7a] text-white rounded disabled:opacity-30 hover:bg-[#3a5c6a] transition text-sm whitespace-nowrap"
          >
            ← Previous
          </button>
          <select
            value={currentTableIndex}
            onChange={(e) => setCurrentTableIndex(Number(e.target.value))}
            className="flex-1 px-2 py-2 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
          >
            {tables.map((table, index) => (
              <option key={table.id} value={index}>
                {table.type === 'day' && table.date ? formatDate(table.date) : table.title}
              </option>
            ))}
          </select>
          <button
            onClick={() => setCurrentTableIndex(Math.min(tables.length - 1, currentTableIndex + 1))}
            disabled={currentTableIndex === tables.length - 1}
            className="px-3 py-2 bg-[#4a6c7a] text-white rounded disabled:opacity-30 hover:bg-[#3a5c6a] transition text-sm whitespace-nowrap"
          >
            Next →
          </button>
        </div>
      )}

      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          settings={settings}
          onSettingsChange={setSettings}
        />
      )}

      {showTimer && (
        <Timer
          onClose={() => setShowTimer(false)}
          tables={tables}
          position={timerPosition}
          onPositionChange={setTimerPosition}
        />
      )}

      {showConflict && conflictData && (
        <SyncConflictDialog
          conflictData={conflictData}
          onResolve={handleConflictResolve}
          onCancel={handleConflictCancel}
        />
      )}

      {/* Empty Data Confirmation Dialog */}
      {showEmptyDataConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="text-4xl mr-4">⚠️</div>
                <h3 className="text-xl font-bold text-gray-800">Empty Data Warning</h3>
              </div>
              
              <div className="mb-6 text-gray-700">
                <p className="mb-3">
                  Your local workspace is empty (no tables or no meaningful content).
                </p>
                <p className="mb-3">
                  If you sync now, this will <strong className="text-red-600">permanently delete</strong> all your data on the server.
                </p>
                <p className="text-sm text-gray-600">
                  Are you sure you want to proceed? This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleEmptyDataCancel}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEmptyDataConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Yes, Delete Server Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {durationPickerTask && (() => {
        const table = tables.find(t => t.id === durationPickerTask.tableId)
        const task = table?.tasks.find(t => t.id === durationPickerTask.taskId)
        if (!task) return null
        
        return (
          <DurationPicker
            value={task.duration}
            presets={settings.durationPresets}
            onChange={(minutes) => updateTask(durationPickerTask.tableId, durationPickerTask.taskId, 'duration', minutes)}
            onClose={() => setDurationPickerTask(null)}
          />
        )
      })()}

      {timePickerTable && (() => {
        const table = tables.find(t => t.id === timePickerTable)
        if (!table) return null
        
        return (
          <TimePicker
            value={table.startTime || '08:00'}
            onChange={(time) => updateTableStartTime(timePickerTable, time)}
            onClose={() => setTimePickerTable(null)}
            timeFormat={settings.timeFormat}
          />
        )
      })()}

      {renderMoveMenu()}

      {renderGroupSelector()}

      {/* Bulk Group Selector */}
      {bulkGroupSelectorTable && (() => {
        const table = tables.find(t => t.id === bulkGroupSelectorTable)
        if (!table) return null
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4" 
               onClick={() => setBulkGroupSelectorTable(null)}>
            <div className="bg-white w-full max-w-md rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 rounded-t-lg flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Assign Group to Selected Tasks</h3>
                <button 
                  onClick={() => setBulkGroupSelectorTable(null)}
                  className="text-2xl text-gray-500 hover:text-gray-800"
                >
                  ×
                </button>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-2">
                  {taskGroups.map((group) => (
                    <div key={group.id} className="relative">
                      <button
                        onClick={() => { bulkAddToGroup(bulkGroupSelectorTable, group.id); setBulkGroupSelectorTable(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded border-2 border-gray-200 hover:border-gray-400 transition"
                        style={{ 
                          backgroundColor: group.color,
                          color: getContrastColor(group.color)
                        }}
                      >
                        {group.icon && iconMap[group.icon] && (
                          <FontAwesomeIcon icon={iconMap[group.icon]} style={{ color: getContrastColor(group.color) }} />
                        )}
                        <span className="text-sm font-medium flex-1 text-left">{group.name}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Archived Tables Menu */}
      {showArchivedMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 rounded-t-lg flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Archived Tables</h3>
              <button 
                onClick={() => setShowArchivedMenu(false)}
                className="text-2xl text-gray-500 hover:text-gray-800"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              {archivedTables.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No archived tables</p>
              ) : (
                <div className="space-y-2">
                  {archivedTables.map(archived => (
                    <div key={archived.id} className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50">
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">
                          {archived.table_date ? formatDate(archived.table_date) : archived.table_title}
                        </div>
                        {archived.table_date && (
                          <div className="text-sm text-gray-600">{archived.table_title}</div>
                        )}
                        <div className="text-xs text-gray-500">{archived.task_count} tasks</div>
                      </div>
                      <button
                        onClick={() => { restoreTable(archived); setShowArchivedMenu(false); }}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Render open notebooks as draggable windows */}
      {openNotebooks.map(notebook => {
        if (notebook.type === 'workspace') {
          return (
            <Notebook
              key={notebook.id}
              id={notebook.id}
              title="Workspace Notebook"
              content={workspaceNotebook}
              position={notebook.position}
              onSave={handleSaveWorkspaceNotebook}
              onClose={() => closeNotebook(notebook.id)}
              onPositionChange={(pos) => updateNotebookPosition(notebook.id, pos)}
              zoom={zoom}
            />
          )
        } else if (notebook.type === 'task' && notebook.taskId) {
          const task = tables.flatMap(t => t.tasks).find(tk => tk.id === notebook.taskId)
          if (!task) return null
          
          return (
            <Notebook
              key={notebook.id}
              id={notebook.id}
              title={`Notes: ${task.title || 'Untitled Task'}`}
              content={task.notebook || ''}
              position={notebook.position}
              onSave={(content) => handleSaveTaskNotebook(notebook.taskId!, content)}
              onClose={() => closeNotebook(notebook.id)}
              onPositionChange={(pos) => updateNotebookPosition(notebook.id, pos)}
              zoom={zoom}
            />
          )
        }
        return null
      })}

      {showManual && (
        <Manual onClose={() => setShowManual(false)} />
      )}

      {showStatistics && (
        <Statistics onClose={() => setShowStatistics(false)} />
      )}

      {/* Render diary list */}
      {showDiaryList && (
        <DiaryList
          entries={diaryEntriesList}
          position={diaryListPosition}
          onSelectEntry={handleDiaryEntrySelect}
          onCreateEntry={handleDiaryEntryCreate}
          onClose={() => setShowDiaryList(false)}
          onPositionChange={setDiaryListPosition}
          zoom={zoom}
        />
      )}

      {/* Render open diary entry */}
      {openDiaryEntry && (
        <DiaryEntry
          date={openDiaryEntry.date}
          content={diaryEntries[openDiaryEntry.date] || ''}
          position={openDiaryEntry.position}
          onSave={handleDiaryEntrySave}
          onDateChange={handleDiaryEntryDateChange}
          onDelete={handleDiaryEntryDelete}
          onClose={handleDiaryEntryClose}
          onPositionChange={(pos) => setOpenDiaryEntry({ ...openDiaryEntry, position: pos })}
          zoom={zoom}
        />
      )}

      {/* Bug Report and Feature Request Dialogs */}
      {showBugReport && (
        <BugReportDialog onClose={() => setShowBugReport(false)} />
      )}
      {showFeatureRequest && (
        <FeatureRequestDialog onClose={() => setShowFeatureRequest(false)} />
      )}

      {/* Groups Editor Dialog */}
      {showGroupsEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">🏷️ Manage Task Groups</h3>
              <button 
                onClick={() => { setShowGroupsEditor(false); setShowCustomGroupForm(false); setEditingGroup(null); }}
                className="text-2xl text-gray-500 hover:text-gray-800"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              {/* Existing Groups */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {taskGroups.map((group) => (
                  <div key={group.id} className="relative">
                    <div
                      className="w-full flex items-center gap-2 px-3 py-2 rounded border-2 border-gray-200"
                      style={{ 
                        backgroundColor: group.color,
                        color: getContrastColor(group.color)
                      }}
                    >
                      {group.icon && iconMap[group.icon] && (
                        <FontAwesomeIcon icon={iconMap[group.icon]} style={{ color: getContrastColor(group.color) }} />
                      )}
                      <span className="text-sm font-medium flex-1">{group.name}</span>
                    </div>
                    {/* Delete and Edit buttons for custom groups */}
                    {group.id.startsWith('custom-') && (
                      <div className="absolute top-0 right-0 flex gap-1 p-1">
                        <button 
                          onClick={() => { setEditingGroup(group); setNewGroupName(group.name); setNewGroupIcon(group.icon); setNewGroupColor(group.color || '#3b82f6'); setShowCustomGroupForm(true); }}
                          className="text-xs px-1.5 py-0.5 bg-white rounded border border-gray-300 hover:bg-gray-100"
                          title="Edit group"
                        >✏️</button>
                        <button 
                          onClick={() => deleteCustomGroup(group.id)}
                          className="text-xs px-1.5 py-0.5 bg-white rounded border border-gray-300 hover:bg-red-100"
                          title="Delete group"
                        >🗑️</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Custom Group Button */}
              {!showCustomGroupForm && (
                <button
                  onClick={() => { setShowCustomGroupForm(true); setEditingGroup(null); setNewGroupName(''); setNewGroupIcon('faBriefcase'); setNewGroupColor('#3b82f6'); }}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded text-gray-600 hover:border-blue-500 hover:text-blue-600 transition font-medium"
                >
                  + Add Custom Group
                </button>
              )}

              {/* Custom Group Form */}
              {showCustomGroupForm && (
                <div className="p-4 border-2 border-blue-500 rounded bg-blue-50">
                  <h4 className="text-sm font-semibold mb-3 text-gray-800">{editingGroup ? 'Edit Group' : 'Create Custom Group'}</h4>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g., Urgent, Personal"
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                    <select
                      value={newGroupIcon}
                      onChange={(e) => setNewGroupIcon(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    >
                      {Object.keys(iconMap).map(iconName => (
                        <option key={iconName} value={iconName}>{iconName.replace('fa', '')}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                    <input
                      type="color"
                      value={newGroupColor}
                      onChange={(e) => setNewGroupColor(e.target.value)}
                      className="w-full h-10 border border-gray-300 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={editingGroup ? updateCustomGroup : createCustomGroup}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
                    >
                      {editingGroup ? 'Update' : 'Create'}
                    </button>
                    <button
                      onClick={() => { setShowCustomGroupForm(false); setEditingGroup(null); setNewGroupName(''); }}
                      className="flex-1 px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
