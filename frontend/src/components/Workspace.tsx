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
import { BottomNav } from './BottomNav'
import { AIPanel } from './AIPanel'
import { exportToCSV, downloadCSV, importFromCSV } from '../utils/csvUtils'
import { saveTables, loadTables, saveSettings, loadSettings, saveTaskGroups, loadTaskGroups, saveNotebooks, loadNotebooks, saveArchivedTables, loadArchivedTables, saveDiaryEntries, loadDiaryEntries } from '../utils/storage'
import { normalizeDate } from '../utils/dateFormat'
import { useAuth } from '../contexts/AuthContext'
import { syncManager } from '../utils/syncManager'
import { downloadICS } from '../utils/icsExport'
import { useTheme } from '../contexts/ThemeContext'
import { api } from '../utils/api'
import { flashFavicon } from '../utils/faviconNotification'
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

function areSpacesEqual(a: Space[] | undefined, b: Space[] | undefined): boolean {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  return a.every((s, i) => s.id === b[i].id && s.name === b[i].name)
}

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
  onShowOnboarding?: () => void
  onStartTutorial?: () => void
  onResetOnboarding?: () => void
  onEnableOnboardingAgain?: () => void
  onShowProfile?: () => void
}

export function Workspace({ onShowPremium, onShowOnboarding, onStartTutorial, onResetOnboarding, onEnableOnboardingAgain, onShowProfile }: WorkspaceProps) {
  const { user, syncNow, loading, decryptionFailure, authError, clearAuthError } = useAuth()
  const { theme } = useTheme()
  const [syncing, setSyncing] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState(false)
  const [hasLoadedUser, setHasLoadedUser] = useState(false)
  const [lastSyncInfo, setLastSyncInfo] = useState<{ time: Date | null; direction: 'uploaded' | 'downloaded' | null }>({ time: null, direction: null })
  
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

  const [tables, setTables] = useState<Table[]>([])

  const [draggedTask, setDraggedTask] = useState<{ tableId: string; taskId: string; index: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ tableId: string; index: number } | null>(null)
  const [draggedTable, setDraggedTable] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [touchDragStart, setTouchDragStart] = useState<{ y: number; taskId: string; tableId: string; index: number } | null>(null)
  const [draggedPinnedItem, setDraggedPinnedItem] = useState<{ itemId: string; index: number } | null>(null)
  const [pinnedDropTarget, setPinnedDropTarget] = useState<number | null>(null)
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number; taskName: string } | null>(null)
  
  // Global sound notification state
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [lastNotifiedTaskId, setLastNotifiedTaskId] = useState<string | null>(null)
  const [soundNotificationsEnabled, setSoundNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('tigement_sound_notifications_enabled')
    return saved !== null ? JSON.parse(saved) : true // Default: enabled
  })
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [touchDragCurrent, setTouchDragCurrent] = useState<number | null>(null)
  const [hoveredTask, setHoveredTask] = useState<string | null>(null)
  const handleLongPressTimer = useRef<number | null>(null)
  const dragHandleTimer = useRef<number | null>(null)
  const addTableRef = useRef<(type: 'day' | 'todo') => void>(() => {})
  const isApplyingSyncUpdate = useRef(false)
  const hasLoadedTables = useRef(false)
  const prevTablesHash = useRef<string>('')
  const spacesUpdateFromSettingsRef = useRef(false)
  const icalEnabledCache = useRef<boolean | null>(null) // null = unknown, true = enabled, false = disabled
  const lastIcalSyncTime = useRef<number>(0) // Timestamp of last sync to prevent concurrent syncs
  const icalSyncInFlight = useRef<boolean>(false) // Prevents overlapping sync requests
  const [showSettings, setShowSettings] = useState(false)
  const [showTimer, setShowTimer] = useState(true)
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
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [aiChatPosition, setAiChatPosition] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('tigement_ai_chat_position')
      if (saved) {
        const p = JSON.parse(saved)
        if (typeof p?.x === 'number' && typeof p?.y === 'number') return p
      }
    } catch {}
    if (typeof window !== 'undefined') {
      const w = 896
      const h = 600
      return {
        x: Math.max(20, (window.innerWidth - w) / 2),
        y: Math.max(20, (window.innerHeight - h) / 2)
      }
    }
    return { x: 100, y: 100 }
  })
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
  const [isMobile, setIsMobile] = useState(() => {
    // Initialize with actual window width to prevent FOUC
    return typeof window !== 'undefined' && window.innerWidth < 768
  })
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

  const togglePin = (itemId: string) => {
    setPinnedItems(prev => 
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
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
  const [showSpaceEditor, setShowSpaceEditor] = useState(false)
  const [editingSpace, setEditingSpace] = useState<Space | null>(null)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [newSpaceIcon, setNewSpaceIcon] = useState('briefcase')
  const [newSpaceColor, setNewSpaceColor] = useState('#3b82f6')
  const [bulkActionsOpen, setBulkActionsOpen] = useState<string | null>(null)
  const [bulkGroupSelectorTable, setBulkGroupSelectorTable] = useState<string | null>(null)
  const [archivedTables, setArchivedTables] = useState<ArchivedTable[]>([])
  const [showArchivedMenu, setShowArchivedMenu] = useState(false)
  const [archivedSortOrder, setArchivedSortOrder] = useState<'newest' | 'oldest'>(() => {
    const saved = localStorage.getItem('tigement_archived_sort_order')
    return (saved === 'oldest' || saved === 'newest') ? saved : 'newest'
  })
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
  const [highlightedTask, setHighlightedTask] = useState<string | null>(null)
  const [diaryListPosition, setDiaryListPosition] = useState({ x: 100, y: 100 })
  const [notebookAnimation, setNotebookAnimation] = useState<{ from: { x: number; y: number }; to: { x: number; y: number }; taskId: string } | null>(null)
  const [pinnedItems, setPinnedItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('tigement_pinned_items')
    const items = saved ? JSON.parse(saved) : ['sync-now', 'settings', 'undo', 'redo']
    return items.filter((id: string) => id !== 'ai-history')
  })
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

  // Sync pinnedItems to localStorage
  useEffect(() => {
    localStorage.setItem('tigement_pinned_items', JSON.stringify(pinnedItems))
  }, [pinnedItems])

  // Persist AI chat position
  useEffect(() => {
    try {
      localStorage.setItem('tigement_ai_chat_position', JSON.stringify(aiChatPosition))
    } catch (e) {
      console.warn('Failed to save AI chat position', e)
    }
  }, [aiChatPosition])

  // Track mouse movement during drag to update ghost position
  useEffect(() => {
    if (!dragGhost) return
    
    const handleDragOver = (e: DragEvent) => {
      // dragover fires continuously during drag, unlike drag event
      if (e.clientX !== 0 && e.clientY !== 0) {
        setDragGhost(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
      }
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      // Fallback for when dragover doesn't fire (e.g., over certain elements)
      if (e.clientX !== 0 && e.clientY !== 0) {
        setDragGhost(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
      }
    }
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cancel drag on Escape key
      if (e.key === 'Escape') {
        console.log('Escape pressed, clearing drag ghost')
        setDragGhost(null)
        setDraggedTask(null)
        setDropTarget(null)
      }
    }
    
    // Use both dragover and mousemove for smooth tracking everywhere
    document.addEventListener('dragover', handleDragOver, true) // Use capture phase
    document.addEventListener('mousemove', handleMouseMove, true)
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('dragover', handleDragOver, true)
      document.removeEventListener('mousemove', handleMouseMove, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [dragGhost])

  // Initialize AudioContext on first user interaction
  useEffect(() => {
    const initAudioContext = () => {
      if (!audioContext && soundNotificationsEnabled) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContextClass) {
          const ctx = new AudioContextClass()
          setAudioContext(ctx)
          console.log('✅ Global AudioContext initialized')
        }
      }
    }
    
    // Initialize on first click
    const handleFirstClick = () => {
      initAudioContext()
      document.removeEventListener('click', handleFirstClick)
    }
    
    document.addEventListener('click', handleFirstClick)
    return () => document.removeEventListener('click', handleFirstClick)
  }, [audioContext, soundNotificationsEnabled])

  // Request browser notification permission on user interaction
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
      
      // If permission not decided, request on first click
      if (Notification.permission === 'default' && soundNotificationsEnabled) {
        const requestOnClick = () => {
          Notification.requestPermission().then(permission => {
            setNotificationPermission(permission)
            console.log('📬 Notification permission:', permission)
            
            if (permission === 'granted') {
              console.log('✅ Browser notifications enabled - you will get notified even when tab is in background')
            }
          })
          document.removeEventListener('click', requestOnClick)
        }
        
        document.addEventListener('click', requestOnClick, { once: true })
        
        return () => document.removeEventListener('click', requestOnClick)
      }
    }
  }, [soundNotificationsEnabled])

  // Global sound notifications for task endings
  useEffect(() => {
    // Skip global notifications if Timer is open (Timer handles its own)
    if (!soundNotificationsEnabled || showTimer) return
    
    // Find all day tables and check for tasks ending now
    const dayTables = tables.filter(t => t.type === 'day')
    const now = currentTime
    
    for (const table of dayTables) {
      const tableTimes = calculateTimes(table)
      table.tasks.forEach((task, index) => {
        const taskTimes = tableTimes[index]
        if (!taskTimes) return
        
        // Parse end time
        const [endHours, endMinutes] = taskTimes.end.split(':').map(Number)
        const taskEndDate = new Date(normalizeDate(table.date))
        taskEndDate.setHours(endHours, endMinutes, 0, 0)
        
        // Check if task just ended (within last second)
        const timeDiff = now.getTime() - taskEndDate.getTime()
        if (timeDiff >= 0 && timeDiff < 1000 && lastNotifiedTaskId !== task.id) {
          console.log('⏰ Task ended globally:', task.title)
          setLastNotifiedTaskId(task.id)
          
          // Show browser notification (works in background)
          if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification('Task Completed', {
              body: task.title,
              icon: '/favicon.svg',
              tag: 'task-' + task.id,
              requireInteraction: false,
              silent: false
            })
            
            // Auto-close after 10 seconds
            setTimeout(() => notification.close(), 10000)
          }
          
          // Play sound (bonus when tab is active)
          playNotificationSound()
          
          // Flash favicon
          flashFavicon(5)
          
          // Reset after 5 seconds to allow re-notification if page was just loaded
          setTimeout(() => setLastNotifiedTaskId(null), 5000)
        }
      })
    }
  }, [tables, currentTime, soundNotificationsEnabled, lastNotifiedTaskId, showTimer])

  const playNotificationSound = async () => {
    try {
      if (!audioContext) {
        console.warn('⚠️ AudioContext not initialized')
        return
      }

      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      
      // Play three beeps
      const beep = (delay: number) => {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = 800
        oscillator.type = 'sine'

        const startTime = audioContext.currentTime + delay
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01)
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2)

        oscillator.start(startTime)
        oscillator.stop(startTime + 0.2)
      }

      beep(0)
      beep(0.25)
      beep(0.5)
      
      console.log('🔔 Sound played globally')
    } catch (error) {
      console.error('❌ Failed to play sound:', error)
    }
  }

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
        showTimerOnStartup: true,
        sessionDuration: 7,
        useTimePickers: true
      })
      setHistory([])
      setHistoryIndex(-1)
    }
  }, [user, hasLoadedUser, loading])

  // Initialize tables for anonymous users on first load.
  // If there is existing anonymous data in localStorage, load it (including diary/notebook for offline).
  // Otherwise, create the default day + TODO tables.
  useEffect(() => {
    if (!hasLoadedUser || loading || user || wasAuthenticatedRef.current) return

    const savedTables = loadTables()
    if (savedTables && savedTables.length > 0) {
      console.log(`📦 Loading anonymous tables from localStorage: ${savedTables.length} tables`)
      setTables(savedTables)
      hasLoadedTables.current = true
      console.log(`✅ Loaded ${savedTables.length} anonymous tables into React state`)
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
      return
    }

    if (!hasLoadedTables.current && tables.length === 0) {
      console.log('🆕 No existing tables for anonymous user, creating default day + TODO tables')
      const defaults = getDefaultTables()
      setTables(defaults)
      hasLoadedTables.current = true
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
  }, [hasLoadedUser, loading, user, tables.length])

  // Reload data from localStorage when user logs in
  useEffect(() => {
    if (user && hasLoadedUser && !loading) {
      console.log('🔄 User logged in, reloading data from localStorage')
      
      // Check if backup was just restored - if so, wait for restore-complete event instead
      const backupRestored = sessionStorage.getItem('tigement_backup_restored')
      if (backupRestored) {
        console.log('📦 Backup restore detected - will load tables via restore-complete event')
        // Don't load tables here, let the restore-complete handler do it
        // But still load other data
      } else {
        // Prevent marking as modified during initial data load
        isApplyingSyncUpdate.current = true
        
        const savedTables = loadTables()
        console.log(`📦 Loading tables from localStorage: ${savedTables?.length || 0} tables`)
        if (savedTables && savedTables.length > 0) {
          setTables(savedTables)
          hasLoadedTables.current = true
          console.log(`✅ Loaded ${savedTables.length} tables into React state`)
        } else {
          console.warn('⚠️ No tables found in localStorage after login, creating default day + TODO tables')
          const defaults = getDefaultTables()
          setTables(defaults)
          hasLoadedTables.current = true
        }
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
      
      // Reset flag after state updates complete
      setTimeout(() => {
        isApplyingSyncUpdate.current = false
        console.log('🏁 Login data reload complete')
      }, 200)
    }
  }, [user, hasLoadedUser, loading])

  // Listen for restore completion event to reload tables
  useEffect(() => {
    const handleRestoreComplete = () => {
      console.log('📦 Restore complete event received, reloading tables from localStorage')
      const savedTables = loadTables()
      console.log(`📦 Reloading: ${savedTables?.length || 0} tables found`)
      if (savedTables && savedTables.length > 0) {
        setTables(savedTables)
        hasLoadedTables.current = true
        console.log(`✅ Reloaded ${savedTables.length} tables after restore`)
      } else {
        console.error('❌ ERROR: No tables found in localStorage after restore event!')
        // Try to check what's actually in localStorage
        const rawData = localStorage.getItem('tigement_tables')
        console.error('❌ Raw localStorage data:', rawData ? `${rawData.length} chars` : 'NULL')
        if (rawData) {
          try {
            const parsed = JSON.parse(rawData)
            console.error('❌ Parsed data:', Array.isArray(parsed) ? `${parsed.length} items` : typeof parsed)
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.error('❌ First item:', parsed[0])
            }
          } catch (e) {
            console.error('❌ Failed to parse localStorage data:', e)
          }
        }
      }
    }
    
    window.addEventListener('tigement-restore-complete', handleRestoreComplete)

    const handleRequestAddDayTable = () => {
      addTableRef.current('day')
    }
    const handleRequestOpenTimer = () => {
      setShowTimer(true)
    }
    window.addEventListener('tigement-request-add-day-table', handleRequestAddDayTable)
    window.addEventListener('tigement-request-open-timer', handleRequestOpenTimer)
    
    // Also check immediately if restore flag is set (in case event already fired or fires synchronously)
    const checkRestoreFlag = () => {
      const backupRestored = sessionStorage.getItem('tigement_backup_restored')
      if (backupRestored) {
        console.log('📦 Backup restore flag found, checking tables immediately')
        const savedTables = loadTables()
        console.log(`📦 Immediate check: ${savedTables?.length || 0} tables found`)
      if (savedTables && savedTables.length > 0) {
        setTables(savedTables)
        hasLoadedTables.current = true
        console.log(`✅ Loaded ${savedTables.length} tables from restore flag check`)
      } else {
        console.error('❌ No tables found even with restore flag set!')
        const rawData = localStorage.getItem('tigement_tables')
        console.error('❌ Raw localStorage:', rawData ? `${rawData.length} chars` : 'NULL')
        if (rawData && rawData.length > 2) { // More than just "[]"
          try {
            const parsed = JSON.parse(rawData)
            console.error('❌ Parsed data:', Array.isArray(parsed) ? `${parsed.length} items` : typeof parsed)
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.error('❌ First item:', parsed[0])
              // Try to load it anyway if it exists
              setTables(parsed)
              hasLoadedTables.current = true
              console.log(`✅ Loaded ${parsed.length} tables from parsed data`)
            }
          } catch (e) {
            console.error('❌ Failed to parse localStorage data:', e)
          }
        }
      }
      }
    }
    
    // Check immediately
    checkRestoreFlag()
    
    // Also check after a short delay in case tables are saved asynchronously
    setTimeout(checkRestoreFlag, 100)
    setTimeout(checkRestoreFlag, 500)
    
    return () => {
      window.removeEventListener('tigement-restore-complete', handleRestoreComplete)
      window.removeEventListener('tigement-request-add-day-table', handleRequestAddDayTable)
      window.removeEventListener('tigement-request-open-timer', handleRequestOpenTimer)
    }
  }, [])

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
      // Update settings (visibleSpaceIds is client-only: prefer local over remote)
      if (data.settings) {
        setSettings(prev => ({ ...data.settings, visibleSpaceIds: prev.visibleSpaceIds ?? data.settings.visibleSpaceIds }))
      }
      // Update task groups only if server has them (don't clear local groups if server doesn't have any)
      if (data.taskGroups && data.taskGroups.length > 0) {
        setTaskGroups(data.taskGroups)
      }
    })
  }, [])

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth
      const mobile = width < 768
      setIsMobile(mobile)
    }
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

  // Listen for sync start/complete from automatic or manual sync
  useEffect(() => {
    const handleSyncStart = () => {
      setSyncing(true)
      setSyncSuccess(false)
    }
    const handleSyncComplete = (event: CustomEvent<{ success: boolean }>) => {
      setSyncing(false)
      if (event.detail?.success) {
        setSyncSuccess(true)
        setLastSyncInfo(syncManager.getLastSyncInfo())
        setTimeout(() => setSyncSuccess(false), 2000)
      }
    }
    window.addEventListener('tigement:sync-start', handleSyncStart)
    window.addEventListener('tigement:sync-complete', handleSyncComplete as EventListener)
    return () => {
      window.removeEventListener('tigement:sync-start', handleSyncStart)
      window.removeEventListener('tigement:sync-complete', handleSyncComplete as EventListener)
    }
  }, [])

  // Listen for sync updates from background sync
  useEffect(() => {
    const handleSyncUpdate = (event: CustomEvent) => {
      const { 
        tables: newTables, 
        settings: newSettings, 
        taskGroups: newTaskGroups,
        notebooks: newNotebooks,
        diaries: newDiaries,
        archivedTables: newArchivedTables
      } = event.detail
      
      // Mark that we're applying a sync update to prevent marking as modified
      isApplyingSyncUpdate.current = true
      console.log('✅ Applying sync update to workspace')
      
      // Merge notebooks into tables BEFORE setting state (single update instead of two)
      let finalTables = newTables || []
      if (newNotebooks?.tasks && Object.keys(newNotebooks.tasks).length > 0) {
        finalTables = finalTables.map(table => ({
          ...table,
          tasks: table.tasks.map(task => ({
            ...task,
            notebook: newNotebooks.tasks[task.id] || task.notebook
          }))
        }))
      }
      
      // Single setTables call with merged data
      setTables(finalTables)
      // visibleSpaceIds is client-only: never overwrite with remote (remote may have [] which would hide spaces)
      setSettings(prev => ({ ...newSettings, visibleSpaceIds: prev.visibleSpaceIds ?? newSettings.visibleSpaceIds }))
      setTaskGroups(newTaskGroups || defaultTaskGroups)
      
      // Update notebook state separately
      if (newNotebooks) {
        setWorkspaceNotebook(newNotebooks.workspace || '')
        console.log('📓 Synced workspace notebook and', Object.keys(newNotebooks.tasks || {}).length, 'task notebooks')
      }
      
      // Update diaries
      if (newDiaries) {
        setDiaryEntries(newDiaries)
        setDiaryEntriesList(Object.keys(newDiaries).map(date => ({
          date,
          preview: newDiaries[date].substring(0, 50)
        })))
        console.log('📔 Synced', Object.keys(newDiaries).length, 'diary entries')
      }
      
      // Update archived tables
      if (newArchivedTables) {
        setArchivedTables(newArchivedTables)
        console.log('🗄️ Synced', newArchivedTables.length, 'archived tables')
      }
      
      // Reset flag after ALL state updates complete (including cascading effects)
      setTimeout(() => {
        isApplyingSyncUpdate.current = false
        console.log('🏁 Sync update application complete')
      }, 200)
    }
    
    window.addEventListener('tigement:sync-update', handleSyncUpdate as any)
    return () => window.removeEventListener('tigement:sync-update', handleSyncUpdate as any)
  }, [])

  // Keep currentTableIndex in bounds when tables change (only adjust if out of bounds)
  useEffect(() => {
    if (isAdjustingIndex.current) return // Skip if already adjusting
    if (isApplyingSyncUpdate.current) return // Skip during sync updates
    if (!hasLoadedTables.current) return // Skip until tables loaded from storage
    
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
        showTimerOnStartup: saved.showTimerOnStartup ?? true,
        sessionDuration: saved.sessionDuration ?? 7,
        useTimePickers: saved.useTimePickers ?? true,
        durationPresets: saved.durationPresets ?? [15, 30, 60, 120],
        viewMode: (saved.viewMode as 'all-in-one' | 'spaces') ?? 'all-in-one',
        spaces: saved.spaces ?? defaultSpaces,
        spacesSplitPosition: saved.spacesSplitPosition ?? 40,
        activeSpaceId: saved.activeSpaceId ?? defaultSpaces[0].id,
        visibleSpaceIds: saved.visibleSpaceIds,
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
      showTimerOnStartup: true,
      sessionDuration: 7,
      useTimePickers: true,
      durationPresets: [15, 30, 60, 120],
      viewMode: 'all-in-one' as 'all-in-one' | 'spaces',
      spaces: defaultSpaces,
      spacesSplitPosition: 40,
      activeSpaceId: defaultSpaces[0].id,
      visibleSpaceIds: undefined
    }
  })
  
  // Flush current state to localStorage before sync reads (prevents task edits loss)
  useEffect(() => {
    const handleSyncWillStart = () => {
      saveTables(tables)
      saveSettings(settings)
      saveTaskGroups(taskGroups)
      const taskNotebooks: Record<string, string> = {}
      for (const table of tables) {
        for (const task of table.tasks || []) {
          if (task.notebook) {
            taskNotebooks[task.id] = task.notebook
          }
        }
      }
      saveNotebooks({ workspace: workspaceNotebook, tasks: taskNotebooks })
      saveDiaryEntries(diaryEntries)
      saveArchivedTables(archivedTables)
    }
    window.addEventListener('tigement:sync-will-start', handleSyncWillStart)
    return () => window.removeEventListener('tigement:sync-will-start', handleSyncWillStart)
  }, [tables, settings, taskGroups, workspaceNotebook, diaryEntries, archivedTables])
  
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
    // Ensure we always have at least defaultSpaces - empty array is truthy but we want to use defaults
    const initialSpaces = (settings.spaces && Array.isArray(settings.spaces) && settings.spaces.length > 0) 
      ? settings.spaces 
      : defaultSpaces
    console.log('🏠 Initializing spaces:', initialSpaces.length, 'spaces', initialSpaces)
    return initialSpaces
  })
  const [activeSpaceId, setActiveSpaceId] = useState<string>(() => {
    const spacesToUse = (settings.spaces && Array.isArray(settings.spaces) && settings.spaces.length > 0) 
      ? settings.spaces 
      : defaultSpaces
    return settings.activeSpaceId || (spacesToUse[0]?.id || defaultSpaces[0].id)
  })
  const [viewMode, setViewMode] = useState<'all-in-one' | 'spaces'>(() => {
    return settings.viewMode || 'all-in-one'
  })
  const [spacesSplitPosition, setSpacesSplitPosition] = useState<number>(() => {
    return settings.spacesSplitPosition || 40 // 40% for left side
  })

  // Spaces visibility filter (for all-in-one view). Persisted in settings.visibleSpaceIds.
  const [visibleSpaces, setVisibleSpaces] = useState<Set<string>>(() => {
    const ids = settings.visibleSpaceIds
    if (ids && Array.isArray(ids) && ids.length > 0) {
      return new Set(ids)
    }
    return new Set(spaces.map(s => s.id))
  })

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

  // Sync spaces state when settings.spaces changes (e.g., after sync from server).
  // Only update state when values actually differ to avoid feedback loop with the effect that writes state → settings.
  // When we do update state, set a ref so the state→settings effect skips one tick and does not echo back.
  // Skip one run when the change came from local space add/edit/delete (ref set in saveSpace/handleDeleteSpace).
  useEffect(() => {
    if (spacesUpdateFromSettingsRef.current) {
      spacesUpdateFromSettingsRef.current = false
      return
    }
    let didUpdate = false
    if (settings.spaces && Array.isArray(settings.spaces) && settings.spaces.length > 0) {
      if (!areSpacesEqual(settings.spaces, spaces)) {
        setSpaces(settings.spaces)
        didUpdate = true
      }
      const currentSpaceExists = settings.spaces.some(s => s.id === activeSpaceId)
      if (!currentSpaceExists && settings.activeSpaceId && settings.activeSpaceId !== activeSpaceId) {
        setActiveSpaceId(settings.activeSpaceId)
        didUpdate = true
      }
    } else if (!settings.spaces || (Array.isArray(settings.spaces) && settings.spaces.length === 0)) {
      if (!areSpacesEqual(defaultSpaces, spaces)) {
        setSpaces(defaultSpaces)
        didUpdate = true
      }
      if (!activeSpaceId || !defaultSpaces.some(s => s.id === activeSpaceId)) {
        setActiveSpaceId(defaultSpaces[0].id)
        didUpdate = true
      }
    }
    if (settings.viewMode && settings.viewMode !== viewMode) {
      setViewMode(settings.viewMode)
      didUpdate = true
    }
    if (settings.spacesSplitPosition !== undefined && settings.spacesSplitPosition !== spacesSplitPosition) {
      setSpacesSplitPosition(settings.spacesSplitPosition)
      didUpdate = true
    }
    if (settings.visibleSpaceIds && Array.isArray(settings.visibleSpaceIds)) {
      setVisibleSpaces(prev => {
        const next = new Set(settings.visibleSpaceIds)
        if (prev.size === next.size && [...prev].every(id => next.has(id))) return prev
        return next
      })
      didUpdate = true
    }
    if (didUpdate) spacesUpdateFromSettingsRef.current = true
  }, [settings.spaces, settings.activeSpaceId, settings.viewMode, settings.spacesSplitPosition, settings.visibleSpaceIds, activeSpaceId, spacesSplitPosition])

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

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Unknown Date'
    
    try {
      // Handle ISO timestamps by extracting just the date part
      const dateOnly = dateStr.split('T')[0]
      
      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
        return 'Invalid Date'
      }
      
      const date = new Date(dateOnly + 'T00:00:00')
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid Date'
      }
      
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
    } catch (error) {
      console.error('Date formatting error:', error, 'Input:', dateStr)
      return 'Invalid Date'
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
    // CRITICAL: Don't auto-save empty tables during initial load, especially after restore
    // This prevents overwriting restored tables with empty array
    if (tables.length === 0 && !hasLoadedTables.current) {
      console.log('⏭️ Skipping auto-save: tables empty and not yet loaded')
      return
    }
    
    // Also skip if restore flag is set and we haven't loaded tables yet
    const backupRestored = sessionStorage.getItem('tigement_backup_restored')
    if (backupRestored && tables.length === 0) {
      console.log('⏭️ Skipping auto-save: restore in progress, tables not loaded yet')
      return
    }
    
    console.log('💾 Auto-saving tables to localStorage:', tables.length, 'tables')
    saveTables(tables)
    
    // Only mark as modified if data actually changed (not just reference)
    if (!isApplyingSyncUpdate.current) {
      const currentHash = JSON.stringify(tables)
      if (currentHash !== prevTablesHash.current) {
        prevTablesHash.current = currentHash
        syncManager.markLocalModified()
      } else {
        console.log('⏭️ Tables unchanged, skipping sync scheduling')
      }
    } else {
      // Update hash during sync to prevent false positives after sync completes
      prevTablesHash.current = JSON.stringify(tables)
    }
  }, [tables])

  // Sync calendar to iCal feed for premium users (if enabled)
  useEffect(() => {
    // Only sync for authenticated premium users
    if (!user || user.plan !== 'premium' || user.subscription_status !== 'active') {
      return
    }

    // Check if iCal was just enabled (reset cache)
    const justEnabled = localStorage.getItem('tigement_ical_just_enabled')
    if (justEnabled === 'true') {
      localStorage.removeItem('tigement_ical_just_enabled')
      icalEnabledCache.current = null // Reset cache to allow retry
      console.log('🔄 iCal was just enabled, resetting sync cache')
    }

    // Load last sync time from localStorage (shared across components)
    const storedLastSync = localStorage.getItem('tigement_last_ical_sync')
    if (storedLastSync && lastIcalSyncTime.current === 0) {
      lastIcalSyncTime.current = parseInt(storedLastSync, 10)
    }

    // Skip if we know iCal is disabled
    if (icalEnabledCache.current === false) {
      return
    }

    // Skip if tables are empty or still loading
    if (tables.length === 0 && !hasLoadedTables.current) {
      return
    }

    // Skip during sync updates to avoid loops
    if (isApplyingSyncUpdate.current) {
      return
    }

    // Debounce: only sync after user stops editing for 3 seconds
    const timeoutId = setTimeout(async () => {
      // Re-read localStorage to pick up syncs from ProfileMenu or other tabs
      const storedLastSync = localStorage.getItem('tigement_last_ical_sync')
      if (storedLastSync) {
        const stored = parseInt(storedLastSync, 10)
        if (stored > lastIcalSyncTime.current) {
          lastIcalSyncTime.current = stored
        }
      }

      // Prevent syncs within 10 seconds of each other (avoid race conditions)
      const now = Date.now()
      const timeSinceLastSync = now - lastIcalSyncTime.current
      if (timeSinceLastSync < 10000) {
        console.log(`⏭️ Skipping iCal sync (last sync was ${Math.round(timeSinceLastSync / 1000)}s ago)`)
        return
      }

      // Skip if another sync is already in progress
      if (icalSyncInFlight.current) {
        console.log('⏭️ Skipping iCal sync (already in progress)')
        return
      }

      try {
        const dayTables = tables.filter(t => t.type === 'day')
        if (dayTables.length > 0) {
          console.log('📅 Syncing calendar events to iCal feed...')
          const syncTime = Date.now()
          lastIcalSyncTime.current = syncTime
          localStorage.setItem('tigement_last_ical_sync', syncTime.toString())
          icalSyncInFlight.current = true
          try {
            await api.syncCalendar(dayTables)
            console.log('✅ Calendar events synced')
            // Mark as enabled on successful sync
            if (icalEnabledCache.current === null) {
              icalEnabledCache.current = true
            }
          } finally {
            icalSyncInFlight.current = false
          }
        }
      } catch (error: any) {
        // Check if error indicates iCal is not enabled
        const errorMsg = error.message || error.error || ''
        if (errorMsg.includes('not enabled') || errorMsg.includes('Enable it in Profile')) {
          console.log('ℹ️ iCal export not enabled, skipping future syncs')
          icalEnabledCache.current = false
          return
        }
        // Silently fail for other errors (don't disrupt workflow)
        if (!errorMsg.includes('403') && !errorMsg.includes('iCal')) {
          console.error('⚠️ Calendar sync failed:', error)
        }
      }
    }, 3000)

    return () => clearTimeout(timeoutId)
  }, [tables, user])

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

  // Update settings when spaces state or visibility changes. Only write when something actually changed to avoid loop with the effect that syncs settings → state.
  // Skip one tick when the change came from settings→spaces (ref) so we don't echo back and cause max update depth.
  useEffect(() => {
    if (spacesUpdateFromSettingsRef.current) {
      spacesUpdateFromSettingsRef.current = false
      return
    }
    const visibleIds = Array.from(visibleSpaces).sort()
    const savedVisibleIds = (settings.visibleSpaceIds && Array.isArray(settings.visibleSpaceIds))
      ? [...settings.visibleSpaceIds].sort()
      : []
    const visibleSame = visibleIds.length === savedVisibleIds.length && visibleIds.every((id, i) => id === savedVisibleIds[i])
    const same =
      settings.viewMode === viewMode &&
      settings.activeSpaceId === activeSpaceId &&
      (settings.spacesSplitPosition ?? 40) === spacesSplitPosition &&
      areSpacesEqual(settings.spaces, spaces) &&
      visibleSame
    if (same) return
    setSettings({
      ...settings,
      viewMode,
      spaces,
      spacesSplitPosition,
      activeSpaceId,
      visibleSpaceIds: visibleIds
    })
  }, [viewMode, spaces, spacesSplitPosition, activeSpaceId, visibleSpaces])

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
    
    // On mobile, switch to the new table immediately
    if (isMobile) {
      const newIndex = tables.length // Index of the newly added table
      setCurrentTableIndex(newIndex)
      console.log(`📱 Switched to new table at index ${newIndex}`)
    }
  }

  addTableRef.current = addTable

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

  const deleteTaskNotebook = (taskId: string) => {
    try {
      const notebooks = loadNotebooks()
      if (notebooks && notebooks.tasks && notebooks.tasks[taskId]) {
        delete notebooks.tasks[taskId]
        saveNotebooks(notebooks)
        console.log('📓 Deleted notebook for task:', taskId)
      }
    } catch (error) {
      console.error('Failed to delete task notebook:', error)
    }
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
    
    // Delete associated task notebook
    deleteTaskNotebook(taskId)
    
    focusTable(tableId) // Focus table when task is deleted
  }

  const deleteSelected = (tableId: string) => {
    // First, collect task IDs that will be deleted
    const deletedTaskIds: string[] = []
    
    setTables(tables.map(table => {
      if (table.id === tableId) {
        // Collect IDs of selected tasks
        table.tasks.forEach(task => {
          if (task.selected) deletedTaskIds.push(task.id)
        })
        
        return {
          ...table,
          tasks: table.tasks.filter(task => !task.selected)
        }
      }
      return table
    }))
    
    // Delete associated task notebooks
    deletedTaskIds.forEach(taskId => deleteTaskNotebook(taskId))
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

  const handleDragStart = (tableId: string, taskId: string, index: number, event?: React.DragEvent) => {
    setDraggedTask({ tableId, taskId, index })
    
    // Find the task to get its name for the ghost preview
    const table = tables.find(t => t.id === tableId)
    const task = table?.tasks.find(t => t.id === taskId)
    if (task && event) {
      setDragGhost({ x: event.clientX, y: event.clientY, taskName: task.title || 'Unnamed task' })
      
      // Hide default drag image
      if (event.dataTransfer) {
        const img = new Image()
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        event.dataTransfer.setDragImage(img, 0, 0)
      }
      
      // Safety timeout: clear ghost after 10 seconds if drag end doesn't fire
      setTimeout(() => {
        if (dragGhost) {
          console.log('Safety timeout: clearing stuck drag ghost')
          setDragGhost(null)
        }
      }, 10000)
    }
  }

  const handleDragEnd = () => {
    // Always reset drag state when drag ends (successful drop or cancelled)
    console.log('Drag ended, clearing ghost')
    setDraggedTask(null)
    setDropTarget(null)
    setDragGhost(null)
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
        const draggedTaskObj = sourceTable.tasks[draggedTask.index]
        if (!draggedTaskObj) return prevTables

        // If dragged task is selected, move all selected tasks; otherwise move just the one
        const tasksToMove = draggedTaskObj.selected
          ? sourceTable.tasks.filter(t => t.selected)
          : [draggedTaskObj]
        const idsToMove = new Set(tasksToMove.map(t => t.id))

        // Calculate insert index before modifying (for same-table move)
        let insertIndex = targetIndex
        if (draggedTask.tableId === targetTableId) {
          const countMovedBeforeTarget = tasksToMove.filter(t => {
            const i = sourceTable.tasks.findIndex(x => x.id === t.id)
            return i < targetIndex
          }).length
          insertIndex = Math.max(0, targetIndex - countMovedBeforeTarget)
        }

        // Remove from source
        sourceTable.tasks = sourceTable.tasks.filter(t => !idsToMove.has(t.id))
        
        // Insert at target
        targetTable.tasks.splice(insertIndex, 0, ...tasksToMove)
        
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

  // Move task to another table (append at end). If the task is selected, move all selected tasks.
  const moveTaskToTable = (sourceTableId: string, taskIndex: number, targetTableId: string) => {
    if (sourceTableId === targetTableId) return
    setTables(prev => {
      const newTables = prev.map(t => ({ ...t, tasks: [...t.tasks] }))
      const sIdx = newTables.findIndex(t => t.id === sourceTableId)
      const tIdx = newTables.findIndex(t => t.id === targetTableId)
      if (sIdx === -1 || tIdx === -1) return prev
      const sourceTable = newTables[sIdx]
      const taskAt = sourceTable.tasks[taskIndex]
      if (!taskAt) return prev
      const tasksToMove = taskAt.selected
        ? sourceTable.tasks.filter(t => t.selected)
        : [taskAt]
      if (tasksToMove.length === 0) return prev
      const idsToMove = new Set(tasksToMove.map(t => t.id))
      newTables[sIdx].tasks = newTables[sIdx].tasks.filter(t => !idsToMove.has(t.id))
      newTables[tIdx].tasks.push(...tasksToMove)
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
    // Prevent archive during active sync to avoid mid-sync state changes
    if (syncManager.syncInProgress) {
      console.log('⏸️ Archive blocked - sync in progress, will retry after sync')
      setTimeout(() => archiveTable(tableId), 500)
      return
    }
    
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
    
    // Note: Sync is automatically triggered by setTables() above via useEffect monitoring
    console.log('🗄️ Table archived - will sync via encrypted workspace')
  }

  const restoreTable = async (archivedTable: ArchivedTable) => {
    // Prevent restore during active sync to avoid mid-sync state changes
    if (syncManager.syncInProgress) {
      console.log('⏸️ Restore blocked - sync in progress, will retry after sync')
      setTimeout(() => restoreTable(archivedTable), 500)
      return
    }
    
    // All archived tables now have table_data locally (stored in encrypted workspace blob)
    if (!archivedTable.table_data) {
      console.error('Cannot restore: no table data available')
      return
    }
    
    const tableData: Table = archivedTable.table_data
    
    // Remove from archived
    const archives = archivedTables.filter(a => a.id !== archivedTable.id)
    saveArchivedTables(archives)
    syncManager.markLocalModified()
    setArchivedTables(archives)
    
    // Add to workspace
    setTables([...tables, tableData])
    focusTable(tableData.id) // Focus restored table
    
    // Note: Sync is automatically triggered by setTables() above via useEffect monitoring
    console.log('🗄️ Table restored - will sync via encrypted workspace')
  }

  const deleteArchivedTable = (archivedId: string) => {
    if (!confirm('Permanently delete this archived table? This cannot be undone.')) return
    const archives = archivedTables.filter(a => a.id !== archivedId)
    saveArchivedTables(archives)
    setArchivedTables(archives)
    syncManager.markLocalModified()
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

  const openTaskNotebook = (tableId: string, taskId: string, buttonElement?: HTMLElement) => {
    // Check if already open
    if (openNotebooks.some(nb => nb.taskId === taskId)) return
    
    const position = { x: 150 + openNotebooks.length * 50, y: 150 + openNotebooks.length * 50 }
    
    // Create fly-from-button animation if button element provided
    if (buttonElement) {
      const rect = buttonElement.getBoundingClientRect()
      setNotebookAnimation({
        from: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        to: position,
        taskId
      })
      // Clear animation after it completes
      setTimeout(() => setNotebookAnimation(null), 500)
    }
    
    setOpenNotebooks([...openNotebooks, {
      id: `task-${taskId}`,
      type: 'task',
      taskId,
      tableId,
      position
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
    
    // Trigger workspace sync (diaries now included in encrypted workspace blob)
    if (user) {
      syncManager.markLocalModified()
      console.log('📔 Diary entry saved - will sync via encrypted workspace')
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
      
      // Trigger workspace sync (diaries now included in encrypted workspace blob)
      if (user) {
        syncManager.markLocalModified()
        console.log('📔 Diary entry date changed - will sync via encrypted workspace')
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
    
    // Trigger workspace sync (diaries now included in encrypted workspace blob)
    if (user) {
      syncManager.markLocalModified()
      console.log('📔 Diary entry deleted - will sync via encrypted workspace')
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
    
    // Trigger workspace sync (notebooks now included in encrypted workspace blob)
    if (user) {
      syncManager.markLocalModified()
      console.log('📓 Workspace notebook saved - will sync via encrypted workspace')
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
    
    // Trigger workspace sync (notebooks now included in encrypted workspace blob)
    if (user) {
      syncManager.markLocalModified()
      console.log('📓 Task notebook saved - will sync via encrypted workspace')
    }
  }

  // Load notebooks from localStorage on mount
  useEffect(() => {
    const notebooks = loadNotebooks()
    if (notebooks) {
      setWorkspaceNotebook(notebooks.workspace || '')
      
      // Update tasks with notebook content (ensure tasks property exists)
      if (notebooks.tasks) {
        setTables(tables.map(table => ({
          ...table,
          tasks: table.tasks.map(task => ({
            ...task,
            notebook: notebooks.tasks[task.id] || task.notebook
          }))
        })))
      }
    }
  }, [])

  // Load notebooks and diaries when user logs in
  useEffect(() => {
    if (user) {
      // For premium users: notebooks, diaries, and archived tables are synced via encrypted workspace
      // The syncManager will restore them to localStorage and trigger state updates via the sync-update event
      // For free users: still fetch from backend (they don't have encrypted workspace)
      
      if (user.plan === 'premium') {
        // Load notebooks from localStorage (encrypted workspace)
        const notebooks = loadNotebooks()
        if (notebooks) {
          setWorkspaceNotebook(notebooks.workspace || '')
          // Also update task notebooks in tables
          if (notebooks.tasks && Object.keys(notebooks.tasks).length > 0) {
            setTables(prevTables => prevTables.map(table => ({
              ...table,
              tasks: table.tasks.map(task => ({
                ...task,
                notebook: notebooks.tasks[task.id] || task.notebook
              }))
            })))
          }
          console.log('📓 Loaded workspace notebook and', Object.keys(notebooks.tasks || {}).length, 'task notebooks from encrypted workspace')
        }
        
        // Load diary entries from localStorage (encrypted workspace)
        const localEntries = loadDiaryEntries() || {}
        setDiaryEntries(localEntries)
        // Build entries list for UI
        const entriesList = Object.keys(localEntries).map(date => ({
          date,
          preview: localEntries[date].substring(0, 50)
        }))
        setDiaryEntriesList(entriesList)
        saveDiaryEntries(localEntries)
        console.log('📔 Loaded', Object.keys(localEntries).length, 'diary entries from encrypted workspace')
      } else {
        // Free users: load notebooks from backend
        api.getWorkspaceNotebook().then(({ content }) => {
          if (content) {
            setWorkspaceNotebook(content)
            const notebooks = loadNotebooks() || { workspace: '', tasks: {} }
            notebooks.workspace = content
            saveNotebooks(notebooks)
            console.log('📓 Loaded workspace notebook from backend')
          }
        }).catch(err => console.error('Failed to load workspace notebook:', err))
        
        // Free users: load diaries from backend
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
      }
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
    
    // For premium users: After migration, archived tables are synced via encrypted workspace
    // No need to load from backend API (which would overwrite restored data)
    // For free users: archived tables were never stored on backend anyway
    // So we just use localStorage for all users now
    console.log('🗄️ Loaded', localArchives?.length || 0, 'archived tables from localStorage')
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
      setDragGhost(null)
      return
    }

    setTables(prevTables => {
      const newTables = prevTables.map(t => ({ ...t, tasks: [...t.tasks] }))
      const sourceTableIdx = newTables.findIndex(t => t.id === draggedTask.tableId)
      const targetTableIdx = newTables.findIndex(t => t.id === targetTableId)
      
      if (sourceTableIdx === -1 || targetTableIdx === -1) return prevTables

      const sourceTable = newTables[sourceTableIdx]
      const targetTable = newTables[targetTableIdx]
      const draggedTaskObj = sourceTable.tasks[draggedTask.index]
      if (!draggedTaskObj) return prevTables

      // If dragged task is selected, move all selected tasks; otherwise move just the one
      const tasksToMove = draggedTaskObj.selected
        ? sourceTable.tasks.filter(t => t.selected)
        : [draggedTaskObj]
      const idsToMove = new Set(tasksToMove.map(t => t.id))

      // Calculate insert index before modifying (for same-table move)
      let insertIndex = targetIndex
      if (draggedTask.tableId === targetTableId) {
        const countMovedBeforeTarget = tasksToMove.filter(t => {
          const i = sourceTable.tasks.findIndex(x => x.id === t.id)
          return i < targetIndex
        }).length
        insertIndex = Math.max(0, targetIndex - countMovedBeforeTarget)
      }

      // Remove from source
      sourceTable.tasks = sourceTable.tasks.filter(t => !idsToMove.has(t.id))
      
      // Insert at target
      targetTable.tasks.splice(insertIndex, 0, ...tasksToMove)
      
      return newTables
    })

    // Clear all drag state immediately on drop
    setDraggedTask(null)
    setDropTarget(null)
    setDragGhost(null)
  }

  // Pinned items drag handlers
  const handlePinnedItemDragStart = (itemId: string, index: number) => {
    setDraggedPinnedItem({ itemId, index })
  }

  const handlePinnedItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    setPinnedDropTarget(index)
  }

  const handlePinnedItemDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    // Clear drop target immediately to remove visual indicator
    setPinnedDropTarget(null)

    if (!draggedPinnedItem) {
      setDraggedPinnedItem(null)
      return
    }

    // Prevent dropping in the same position
    if (draggedPinnedItem.index === targetIndex) {
      setDraggedPinnedItem(null)
      return
    }

    setPinnedItems(prevItems => {
      const newItems = [...prevItems]
      const [movedItem] = newItems.splice(draggedPinnedItem.index, 1)
      
      // Calculate correct insert index
      let insertIndex = targetIndex
      if (draggedPinnedItem.index < targetIndex) {
        insertIndex = targetIndex - 1
      }
      
      newItems.splice(insertIndex, 0, movedItem)
      return newItems
    })

    setDraggedPinnedItem(null)
  }

  const handlePinnedItemDragEnd = () => {
    // Clear all drag states when drag ends
    setDraggedPinnedItem(null)
    setPinnedDropTarget(null)
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
    setSyncSuccess(false)
    
    // Save current state to localStorage FIRST
    // This ensures sync compares against actual current state, even if user is typing
    saveTables(tables)
    saveArchivedTables(archivedTables)
    saveSettings(settings)
    saveTaskGroups(taskGroups)
    saveNotebooks({ workspace: workspaceNotebook, tasks: {} })
    saveDiaryEntries(diaryEntries)
    
    try {
      await syncNow()
      // Update last sync info
      const syncInfo = syncManager.getLastSyncInfo()
      setLastSyncInfo(syncInfo)
      // Show success state
      setSyncSuccess(true)
      // Clear success state after 2 seconds
      setTimeout(() => setSyncSuccess(false), 2000)
    } catch (error: any) {
      console.error('Sync failed:', error)
      alert(`Sync failed: ${error.message || 'Unknown error'}`)
    } finally {
      setSyncing(false)
    }
  }

  // Format sync time with relative time, actual time, and direction
  const formatSyncTime = (syncInfo: { time: Date | null; direction: 'uploaded' | 'downloaded' | null }): string => {
    if (!syncInfo.time) return ''
    
    const now = new Date()
    const diffMs = now.getTime() - syncInfo.time.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    
    const timeStr = syncInfo.time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const direction = syncInfo.direction ? `(${syncInfo.direction})` : ''
    
    if (diffSecs < 60) return `just now at ${timeStr} ${direction}`
    if (diffMins < 60) return `${diffMins} min ago at ${timeStr} ${direction}`
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago at ${timeStr} ${direction}`
  }

  // Update last sync time display periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const syncInfo = syncManager.getLastSyncInfo()
      setLastSyncInfo(syncInfo)
    }, 30000) // Update every 30 seconds
    
    // Initial load
    const syncInfo = syncManager.getLastSyncInfo()
    setLastSyncInfo(syncInfo)
    
    return () => clearInterval(interval)
  }, [])

  // Space management functions
  const handleAddSpace = () => {
    setEditingSpace(null)
    setNewSpaceName('')
    setNewSpaceIcon('briefcase')
    setNewSpaceColor('#3b82f6')
    setShowSpaceEditor(true)
  }

  const handleEditSpace = (spaceId: string) => {
    const space = spaces.find((s) => s.id === spaceId)
    if (!space) return
    
    setEditingSpace(space)
    setNewSpaceName(space.name)
    setNewSpaceIcon(space.icon || 'briefcase')
    setNewSpaceColor(space.color || '#3b82f6')
    setShowSpaceEditor(true)
  }
  
  const saveSpace = () => {
    if (!newSpaceName.trim()) {
      alert('Please enter a space name')
      return
    }
    
    if (editingSpace) {
      // Update existing space
      spacesUpdateFromSettingsRef.current = true
      setSpaces(spaces.map((s) => 
        s.id === editingSpace.id 
          ? { ...s, name: newSpaceName.trim(), icon: newSpaceIcon, color: newSpaceColor } 
          : s
      ))
    } else {
      // Create new space
      const newSpace: Space = {
        id: `space-${Date.now()}`,
        name: newSpaceName.trim(),
        icon: newSpaceIcon,
        color: newSpaceColor,
      }
      spacesUpdateFromSettingsRef.current = true
      setSpaces([...spaces, newSpace])
      setActiveSpaceId(newSpace.id)
    }
    syncManager.markLocalModified()
    setShowSpaceEditor(false)
    setEditingSpace(null)
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
    spacesUpdateFromSettingsRef.current = true
    setSpaces(newSpaces)
    
    // Clear spaceId from tables assigned to this space
    setTables(tables.map((t) => 
      t.spaceId === spaceId ? { ...t, spaceId: null } : t
    ))
    
    // Switch to first space if deleting active
    if (activeSpaceId === spaceId) {
      setActiveSpaceId(newSpaces[0].id)
    }
    syncManager.markLocalModified()
  }

  const handleAssignTableToSpace = (tableId: string, spaceId: string | null) => {
    setTables(tables.map((t) => 
      t.id === tableId ? { ...t, spaceId } : t
    ))
  }

  return (
    <>
    <div className="workspace h-full overflow-hidden bg-gray-100 flex">
      {/* Auth Error Warning Banner */}
      {authError && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white p-4 shadow-lg">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="font-bold">Session Expired</div>
                <div className="text-sm">Your changes are saved locally but not synced. Please log in to continue.</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-white text-red-600 rounded font-bold hover:bg-gray-100"
              >
                Log In
              </button>
              <button 
                onClick={clearAuthError}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 rounded"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vertical Menu Sidebar - Desktop or Mobile Overlay */}
      {(!isMobile || showMenu) && (
        <>
          {isMobile && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-[110]"
              onClick={() => setShowMenu(false)}
            />
          )}
          <div className={`${
            isMobile 
              ? 'fixed top-0 right-0 h-full w-64 bg-white shadow-2xl z-[120] overflow-y-auto' 
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
              
              {/* Primary Actions */}
              <button
                onClick={() => { addTable('day'); isMobile && setShowMenu(false); }}
                className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm text-left"
              >
                Add Day
              </button>
              <button
                onClick={() => { addTable('todo'); isMobile && setShowMenu(false); }}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm text-left"
              >
                Add TODO
              </button>
              <button
                onClick={() => { setShowTimer(prev => !prev); isMobile && setShowMenu(false); }}
                className={`w-full px-3 py-2 rounded transition text-sm text-left ${
                  showTimer
                    ? 'bg-[#4fc3f7] text-white hover:bg-[#3ba3d7]'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {showEmoji ? '⏱️ ' : ''}Timer
              </button>
              
              <div className="border-t border-gray-300 my-2"></div>
              
              {/* Pinned Items Section */}
              {pinnedItems.length > 0 && (
                <>
                  <div className="mb-2">
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Pinned
                    </div>
                    <div className="space-y-1 mt-1">
                      {pinnedItems.map((itemId, index) => {
                        const isDragging = draggedPinnedItem?.index === index
                        const isDropTarget = pinnedDropTarget === index
                        
                        // Handle space items (format: space-{id})
                        if (itemId.startsWith('space-')) {
                          const spaceId = itemId.substring(6)
                          const space = spaces.find(s => s.id === spaceId)
                          if (!space) return null
                          
                          return (
                            <div key={itemId} className="relative">
                              {/* Drop gap - appears between items */}
                              {isDropTarget && (
                                <div
                                  className="min-h-[2rem] flex items-center justify-center my-1 rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/50"
                                  onDragOver={(e) => { e.preventDefault(); handlePinnedItemDragOver(e, index) }}
                                  onDrop={(e) => handlePinnedItemDrop(e, index)}
                                />
                              )}
                              <div 
                                draggable
                                onDragStart={() => handlePinnedItemDragStart(itemId, index)}
                                onDragOver={(e) => handlePinnedItemDragOver(e, index)}
                                onDrop={(e) => handlePinnedItemDrop(e, index)}
                                onDragEnd={handlePinnedItemDragEnd}
                                className={`flex items-center gap-1 ${isDragging ? 'opacity-50' : ''}`}
                              >
                                <button
                                  onClick={() => {
                                    handleEditSpace(space.id);
                                    isMobile && setShowMenu(false);
                                  }}
                                  className="flex-1 px-2 py-1 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300 flex items-center gap-1 cursor-move"
                                >
                                  {space.icon && iconMap[space.icon] && (
                                    <FontAwesomeIcon icon={iconMap[space.icon]} size="sm" />
                                  )}
                                  <span className="truncate">{space.name}</span>
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePin(itemId);
                                  }}
                                  className="px-1 py-1 rounded transition text-sm text-yellow-500 hover:text-yellow-600 font-bold"
                                  title="Unpin"
                                >
                                  📍
                                </button>
                              </div>
                            </div>
                          )
                        }
                        
                        // Map item IDs to their actions and labels
                        const itemConfig: Record<string, { label: string; onClick: () => void; className: string }> = {
                          'timer': { label: showEmoji ? '⏱️ Timer' : 'Timer', onClick: () => { setShowTimer(true); isMobile && setShowMenu(false); }, className: 'bg-[#4fc3f7] text-white hover:bg-[#3ba3d7]' },
                          'notebook': { label: showEmoji ? '📓 Notebook' : 'Notebook', onClick: () => { openWorkspaceNotebook(); isMobile && setShowMenu(false); }, className: 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300' },
                          'diary': { label: showEmoji ? '📔 Diary' : 'Diary', onClick: () => { setShowDiaryList(true); isMobile && setShowMenu(false); }, className: 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300' },
                          'statistics': { label: showEmoji ? '📈 Statistics' : 'Statistics', onClick: () => { setShowStatistics(true); isMobile && setShowMenu(false); }, className: 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300' },
                          'ai-chat': { label: showEmoji ? '🤖 AI Assistant' : 'AI Assistant', onClick: () => { setShowAIPanel(true); isMobile && setShowMenu(false); }, className: 'bg-purple-600 text-white hover:bg-purple-700' },
                          'archived': { label: showEmoji ? '📦 Archived' : 'Archived', onClick: () => { setShowArchivedMenu(true); isMobile && setShowMenu(false); }, className: 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300' },
                          'add-tab-group': { label: showEmoji ? '➕ New space' : 'New space', onClick: () => { handleAddSpace(); isMobile && setShowMenu(false); }, className: 'bg-green-600 text-white hover:bg-green-700' },
                          'settings': { label: showEmoji ? '⚙️ Settings' : 'Settings', onClick: () => { setShowSettings(true); isMobile && setShowMenu(false); }, className: 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300' },
                          'edit-groups': { label: showEmoji ? '🏷️ Task groups' : 'Task groups', onClick: () => { setShowGroupsEditor(true); isMobile && setShowMenu(false); }, className: 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300' },
                          'manual': { label: showEmoji ? '📖 Manual' : 'Manual', onClick: () => { setShowManual(true); isMobile && setShowMenu(false); }, className: 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300' },
                          'export-csv': { label: showEmoji ? '📤 Export CSV' : 'Export CSV', onClick: () => { handleExportCSV(); isMobile && setShowMenu(false); }, className: 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300' },
                          'import-csv': { label: showEmoji ? '📥 Import CSV' : 'Import CSV', onClick: () => { fileInputRef.current?.click(); isMobile && setShowMenu(false); }, className: 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300' },
                          'export-ics': { 
                            label: showEmoji ? '📅 Export Calendar (.ics)' : 'Export Calendar (.ics)', 
                            onClick: () => { 
                              const dayTables = tables.filter(t => t.type === 'day')
                              if (dayTables.length === 0) {
                                alert('No day tables to export. Create some day tables first!')
                                return
                              }
                              downloadICS(dayTables)
                              isMobile && setShowMenu(false)
                            }, 
                            className: 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300' 
                          },
                          'sync-now': { 
                            label: syncing 
                              ? (showEmoji ? '🔄 Syncing...' : 'Syncing...') 
                              : syncSuccess 
                                ? (showEmoji ? '✅ Synced!' : 'Synced!') 
                                : (showEmoji ? '☁️ Sync now' : 'Sync now'), 
                            onClick: () => { handleSyncNow(); isMobile && setShowMenu(false); }, 
                            className: syncSuccess 
                              ? 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-300' 
                              : 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300' 
                          },
                          'undo': { label: showEmoji ? '↶ Undo' : 'Undo', onClick: undo, className: 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300' },
                          'redo': { label: showEmoji ? '↷ Redo' : 'Redo', onClick: redo, className: 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300' },
                          'report-bug': { label: showEmoji ? '🐛 Report bug' : 'Report bug', onClick: () => { setShowBugReport(true); isMobile && setShowMenu(false); }, className: 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300' },
                          'feature-request': { label: showEmoji ? '✨ Feature request' : 'Feature request', onClick: () => { setShowFeatureRequest(true); isMobile && setShowMenu(false); }, className: 'bg-white text-gray-800 hover:bg-gray-100 border border-gray-300' },
                        }
                        
                        const config = itemConfig[itemId]
                        if (!config) return null
                        
                        return (
                          <div key={itemId} className="relative">
                            {/* Drop gap - appears between items */}
                            {isDropTarget && (
                              <div
                                className="min-h-[2rem] flex items-center justify-center my-1 rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/50"
                                onDragOver={(e) => { e.preventDefault(); handlePinnedItemDragOver(e, index) }}
                                onDrop={(e) => handlePinnedItemDrop(e, index)}
                              />
                            )}
                            <div 
                              draggable
                              onDragStart={() => handlePinnedItemDragStart(itemId, index)}
                              onDragOver={(e) => handlePinnedItemDragOver(e, index)}
                              onDrop={(e) => handlePinnedItemDrop(e, index)}
                              onDragEnd={handlePinnedItemDragEnd}
                              className={`flex items-center gap-1 ${isDragging ? 'opacity-50' : ''}`}
                            >
                              <button
                                onClick={config.onClick}
                                disabled={itemId === 'undo' && historyIndex <= 0 || itemId === 'redo' && historyIndex >= history.length - 1 || itemId === 'sync-now' && syncing}
                                className={`flex-1 px-3 py-2 rounded transition text-sm text-left cursor-move flex items-center gap-2 ${config.className} disabled:opacity-30 disabled:cursor-not-allowed`}
                              >
                                {config.label}
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePin(itemId);
                                }}
                                className="px-2 py-2 rounded transition text-sm text-yellow-500 hover:text-yellow-600 font-bold"
                                title="Unpin"
                              >
                                📍
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="border-t border-gray-300 my-2"></div>
                </>
              )}
              
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
                        <label className="text-xs text-gray-600 mb-1 block">Visible spaces</label>
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
              
              {/* Collapsible Menu Sections */}
              
              {/* Go to Section (destinations) */}
              <div className="border-b border-gray-200 pb-2 mb-2">
                <button
                  onClick={() => toggleMenu('workspace')}
                  className="w-full px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-100 rounded flex items-center justify-between"
                >
                  <span>{showEmoji && '🎯 '}Go to</span>
                  <span>{expandedMenus.has('workspace') ? '▼' : '▶'}</span>
                </button>
                {expandedMenus.has('workspace') && (
                  <div className="ml-2 space-y-1 mt-1">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setShowTimer(true); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-[#4fc3f7] text-white rounded hover:bg-[#3ba3d7] transition text-sm text-left">
                        {showEmoji && '⏱️ '}Timer
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin('timer');
                        }}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('timer') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('timer') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('timer') ? '📍' : '📌'}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { openWorkspaceNotebook(); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                        {showEmoji && '📓 '}Notebook
                      </button>
                      <button 
                        onClick={() => togglePin('notebook')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('notebook') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('notebook') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('notebook') ? '📍' : '📌'}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setShowDiaryList(true); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                        {showEmoji && '📔 '}Diary
                      </button>
                      <button 
                        onClick={() => togglePin('diary')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('diary') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('diary') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('diary') ? '📍' : '📌'}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setShowStatistics(true); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                        {showEmoji && '📈 '}Statistics
                      </button>
                      <button 
                        onClick={() => togglePin('statistics')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('statistics') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('statistics') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('statistics') ? '📍' : '📌'}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setShowAIPanel(true); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition text-sm text-left">
                        {showEmoji && '🤖 '}AI Assistant
                      </button>
                      <button 
                        onClick={() => togglePin('ai-chat')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('ai-chat') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('ai-chat') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('ai-chat') ? '📍' : '📌'}
                      </button>
                    </div>
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
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setShowArchivedMenu(true); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                        {showEmoji && '📦 '}Archived
                      </button>
                      <button 
                        onClick={() => togglePin('archived')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('archived') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('archived') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('archived') ? '📍' : '📌'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Organize Section: Spaces + Task groups */}
              <div className="border-b border-gray-200 pb-2 mb-2">
                <button
                  onClick={() => toggleMenu('organize')}
                  className="w-full px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-100 rounded flex items-center justify-between"
                >
                  <span>{showEmoji && '🗂️ '}Organize</span>
                  <span>{expandedMenus.has('organize') ? '▼' : '▶'}</span>
                </button>
                {expandedMenus.has('organize') && (
                  <div className="ml-2 space-y-1 mt-1">
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Spaces</div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { handleAddSpace(); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm text-left">
                        {showEmoji && '➕ '}New space
                      </button>
                      <button 
                        onClick={() => togglePin('add-tab-group')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('add-tab-group') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('add-tab-group') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('add-tab-group') ? '📍' : '📌'}
                      </button>
                    </div>
                    {spaces.map(space => (
                      <div key={space.id} className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            handleEditSpace(space.id);
                            isMobile && setShowMenu(false);
                          }}
                          className="flex-1 px-2 py-1 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-xs text-left border border-gray-300 flex items-center gap-1"
                        >
                          {space.icon && iconMap[space.icon] && (
                            <FontAwesomeIcon icon={iconMap[space.icon]} size="sm" />
                          )}
                          <span className="truncate">{space.name}</span>
                        </button>
                        <button 
                          onClick={() => togglePin(`space-${space.id}`)}
                          className={`px-1 py-1 rounded transition text-xs ${pinnedItems.includes(`space-${space.id}`) ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                          title={pinnedItems.includes(`space-${space.id}`) ? 'Unpin' : 'Pin'}
                        >
                          {pinnedItems.includes(`space-${space.id}`) ? '📍' : '📌'}
                        </button>
                        <button
                          onClick={() => handleDeleteSpace(space.id)}
                          className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-xs"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2">Task groups</div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setShowGroupsEditor(true); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                        {showEmoji && '🏷️ '}Task groups
                      </button>
                      <button 
                        onClick={() => togglePin('edit-groups')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('edit-groups') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('edit-groups') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('edit-groups') ? '📍' : '📌'}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setShowSettings(true); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                        {showEmoji && '⚙️ '}Settings
                      </button>
                      <button 
                        onClick={() => togglePin('settings')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('settings') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('settings') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('settings') ? '📍' : '📌'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Edit Section */}
              <div className="border-b border-gray-200 pb-2 mb-2">
                <button
                  onClick={() => toggleMenu('edit')}
                  className="w-full px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-100 rounded flex items-center justify-between"
                >
                  <span>{showEmoji && '✏️ '}Edit</span>
                  <span>{expandedMenus.has('edit') ? '▼' : '▶'}</span>
                </button>
                {expandedMenus.has('edit') && (
                  <div className="ml-2 space-y-1 mt-1">
                    <div className="flex items-center gap-1">
                      <button onClick={undo} disabled={historyIndex <= 0} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm disabled:opacity-30 disabled:cursor-not-allowed text-left border border-gray-300" title="Undo (Ctrl+Z)">
                        {showEmoji && '↶ '}Undo
                      </button>
                      <button 
                        onClick={() => togglePin('undo')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('undo') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('undo') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('undo') ? '📍' : '📌'}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={redo} disabled={historyIndex >= history.length - 1} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm disabled:opacity-30 disabled:cursor-not-allowed text-left border border-gray-300" title="Redo (Ctrl+Shift+Z / Ctrl+Y)">
                        {showEmoji && '↷ '}Redo
                      </button>
                      <button 
                        onClick={() => togglePin('redo')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('redo') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('redo') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('redo') ? '📍' : '📌'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Data & Sync Section */}
              <div className="border-b border-gray-200 pb-2 mb-2">
                <button
                  onClick={() => toggleMenu('data')}
                  className="w-full px-3 py-2 text-left font-semibold text-gray-700 hover:bg-gray-100 rounded flex items-center justify-between"
                >
                  <span>{showEmoji && '💾 '}Data & Sync</span>
                  <span>{expandedMenus.has('data') ? '▼' : '▶'}</span>
                </button>
                {expandedMenus.has('data') && (
                  <div className="ml-2 space-y-1 mt-1">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { handleExportCSV(); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                        {showEmoji && '📤 '}Export CSV
                      </button>
                      <button 
                        onClick={() => togglePin('export-csv')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('export-csv') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('export-csv') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('export-csv') ? '📍' : '📌'}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { fileInputRef.current?.click(); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                        {showEmoji && '📥 '}Import CSV
                      </button>
                      <button 
                        onClick={() => togglePin('import-csv')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('import-csv') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('import-csv') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('import-csv') ? '📍' : '📌'}
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleImportCSV}
                      className="hidden"
                    />
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => { 
                          const dayTables = tables.filter(t => t.type === 'day')
                          if (dayTables.length === 0) {
                            alert('No day tables to export. Create some day tables first!')
                            return
                          }
                          downloadICS(dayTables)
                          isMobile && setShowMenu(false)
                        }} 
                        className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300"
                      >
                        {showEmoji && '📅 '}Export Calendar (.ics)
                      </button>
                      <button 
                        onClick={() => togglePin('export-ics')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('export-ics') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('export-ics') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('export-ics') ? '📍' : '📌'}
                      </button>
                    </div>
                    {user && onShowProfile && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { onShowProfile(); isMobile && setShowMenu(false); }}
                          className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300"
                        >
                          {showEmoji && '💾 '}Backup & restore...
                        </button>
                      </div>
                    )}
                    {user?.plan === 'premium' && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => { handleSyncNow(); isMobile && setShowMenu(false); }} 
                            disabled={syncing} 
                            className={`flex-1 px-3 py-2 rounded transition text-sm disabled:opacity-50 text-left border flex items-center gap-2 ${
                              syncSuccess 
                                ? 'bg-green-100 text-green-800 hover:bg-green-200 border-green-300' 
                                : 'bg-white text-gray-800 hover:bg-gray-100 border-gray-300'
                            }`}
                            title="Sync workspace to cloud"
                          >
                            {syncing 
                              ? (showEmoji ? 'Syncing...' : 'Syncing...') 
                              : syncSuccess 
                                ? (showEmoji ? 'Synced!' : 'Synced!') 
                                : (showEmoji ? '☁️ Sync now' : 'Sync now')
                            }
                          </button>
                          <button 
                            onClick={() => togglePin('sync-now')}
                            className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('sync-now') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                            title={pinnedItems.includes('sync-now') ? 'Unpin' : 'Pin'}
                          >
                            {pinnedItems.includes('sync-now') ? '📍' : '📌'}
                          </button>
                        </div>
                      </div>
                    )}
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
                    {onShowOnboarding && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { onShowOnboarding(); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                          {showEmoji && '🎓 '}Tutorial / Onboarding
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setShowManual(true); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                        {showEmoji && '📖 '}Manual
                      </button>
                      <button 
                        onClick={() => togglePin('manual')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('manual') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('manual') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('manual') ? '📍' : '📌'}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setShowBugReport(true); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                        {showEmoji && '🐛 '}Report bug
                      </button>
                      <button 
                        onClick={() => togglePin('report-bug')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('report-bug') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('report-bug') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('report-bug') ? '📍' : '📌'}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setShowFeatureRequest(true); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                        {showEmoji && '✨ '}Feature request
                      </button>
                      <button 
                        onClick={() => togglePin('feature-request')}
                        className={`px-2 py-2 rounded transition text-sm ${pinnedItems.includes('feature-request') ? 'text-yellow-500 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                        title={pinnedItems.includes('feature-request') ? 'Unpin' : 'Pin'}
                      >
                        {pinnedItems.includes('feature-request') ? '📍' : '📌'}
                      </button>
                    </div>
                    {(onResetOnboarding || onEnableOnboardingAgain) && (
                      <>
                        <button
                          onClick={() => toggleMenu('help-advanced')}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded flex items-center justify-between mt-2"
                        >
                          Advanced
                          <span>{expandedMenus.has('help-advanced') ? '▼' : '▶'}</span>
                        </button>
                        {expandedMenus.has('help-advanced') && (
                          <div className="ml-2 space-y-1 mt-1">
                            {onResetOnboarding && (
                              <div className="flex items-center gap-1">
                                <button onClick={() => { onResetOnboarding(); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                                  {showEmoji && '🔄 '}Reset onboarding
                                </button>
                              </div>
                            )}
                            {onEnableOnboardingAgain && (
                              <div className="flex items-center gap-1">
                                <button onClick={() => { onEnableOnboardingAgain(); isMobile && setShowMenu(false); }} className="flex-1 px-3 py-2 bg-white text-gray-800 rounded hover:bg-gray-100 transition text-sm text-left border border-gray-300">
                                  {showEmoji && '🎓 '}Enable onboarding again
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              
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
              
              {/* Last Synced Info - At Bottom */}
              {user?.plan === 'premium' && lastSyncInfo.time && (
                <>
                  <div className="border-t border-gray-300 my-2"></div>
                  <div className="px-3 py-2 text-xs text-gray-500 text-center">
                    Last synced: {formatSyncTime(lastSyncInfo)}
                  </div>
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
                        highlightedTask={highlightedTask}
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
                  className={`flex-1 overflow-auto bg-gray-100 relative ${isMobile ? 'pb-32' : 'px-4 pb-8'}`}
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
                          highlightedTask={highlightedTask}
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
            }
            initialSplitPosition={spacesSplitPosition}
            onSplitChange={setSpacesSplitPosition}
          />
        </div>
      ) : (
        // ALL-IN-ONE VIEW: Current freeform canvas
        <div 
          ref={scrollContainerRef}
          className={`flex-1 overflow-auto ${isMobile ? 'pb-32' : 'px-8 pb-8'}`}
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
              // In all-in-one view on DESKTOP only, filter TODO tables by visible spaces
              if (!isMobile && viewMode === 'all-in-one' && table.type === 'todo') {
                return !table.spaceId || visibleSpaces.has(table.spaceId)
              }
              return true
            })
            .map(table => {
          // Safety check: ensure table has required fields before rendering
          if (!table.position || typeof table.position !== 'object' || table.position === null) {
            console.error('❌ Workspace: Table missing position during render', {
              tableId: table.id,
              tableType: table.type,
              tableTitle: table.title,
              position: table.position
            });
            // Skip rendering this table to prevent crash
            return null;
          }
          
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
                highlightedTask={highlightedTask}
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
        })
        .filter(Boolean)}
        </div>
        </div>
      )}

      {/* Mobile Pagination */}
      {isMobile && tables.length > 1 && (
        <div className="fixed bottom-16 left-0 right-0 flex justify-between items-center gap-2 p-3 bg-gray-100 border-t-2 border-gray-300 shadow-lg z-50">
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const next = archivedSortOrder === 'newest' ? 'oldest' : 'newest'
                    setArchivedSortOrder(next)
                    localStorage.setItem('tigement_archived_sort_order', next)
                  }}
                  className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                  title={archivedSortOrder === 'newest' ? 'Show oldest first' : 'Show newest first'}
                >
                  {archivedSortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
                </button>
                <button 
                  onClick={() => setShowArchivedMenu(false)}
                  className="text-2xl text-gray-500 hover:text-gray-800"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-4">
              {archivedTables.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No archived tables</p>
              ) : (
                <div className="space-y-2">
                  {[...archivedTables]
                    .sort((a, b) => {
                      const at = a.archived_at || a.table_date || a.id
                      const bt = b.archived_at || b.table_date || b.id
                      const cmp = at.localeCompare(bt)
                      return archivedSortOrder === 'newest' ? -cmp : cmp
                    })
                    .map(archived => (
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { restoreTable(archived); setShowArchivedMenu(false); }}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => { deleteArchivedTable(archived.id); setShowArchivedMenu(false); }}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                          title="Permanently delete from archive"
                        >
                          Delete
                        </button>
                      </div>
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

      {/* AI Panel (Chat + History) */}
      {showAIPanel && (
        <AIPanel 
          workspace={{ tables, taskGroups, settings }}
          position={aiChatPosition}
          onPositionChange={setAiChatPosition}
          onWorkspaceUpdate={(updatedWorkspace) => {
            console.log('🔄 Workspace: onWorkspaceUpdate called from AI', {
              hasTables: !!updatedWorkspace.tables,
              tablesCount: updatedWorkspace.tables?.length || 0,
              currentTablesCount: tables.length,
              updatedWorkspace: {
                tables: updatedWorkspace.tables?.map((t: any) => ({
                  id: t.id,
                  type: t.type,
                  title: t.title,
                  hasPosition: !!t.position,
                  positionType: typeof t.position,
                  positionIsNull: t.position === null,
                  positionIsUndefined: t.position === undefined,
                  positionValue: t.position,
                  positionX: t.position?.x,
                  positionY: t.position?.y,
                  hasTasks: !!t.tasks,
                  tasksIsArray: Array.isArray(t.tasks),
                  tasksIsNull: t.tasks === null,
                  tasksIsUndefined: t.tasks === undefined,
                  tasksLength: t.tasks?.length || 0
                }))
              }
            });
            
            if (updatedWorkspace.tables) {
              // Validate all tables have required fields before setting
              const invalidTables = updatedWorkspace.tables.filter((t: any) => {
                const missingPosition = !t.position || typeof t.position !== 'object' || t.position === null;
                const missingTasks = !t.tasks || !Array.isArray(t.tasks);
                return missingPosition || missingTasks;
              });
              
              if (invalidTables.length > 0) {
                console.error('❌ Workspace: Invalid tables detected before setTables', {
                  invalidTables: invalidTables.map((t: any) => ({
                    id: t.id,
                    type: t.type,
                    title: t.title,
                    hasPosition: !!t.position,
                    positionType: typeof t.position,
                    positionValue: t.position,
                    hasTasks: !!t.tasks,
                    tasksType: typeof t.tasks,
                    tasksIsArray: Array.isArray(t.tasks)
                  }))
                });
              } else {
                console.log('✅ Workspace: All tables validated, setting tables');
              }
              
              console.log('🔄 Workspace: Calling setTables', {
                tablesCount: updatedWorkspace.tables.length,
                firstTable: updatedWorkspace.tables[0] ? {
                  id: updatedWorkspace.tables[0].id,
                  position: updatedWorkspace.tables[0].position,
                  tasksLength: updatedWorkspace.tables[0].tasks?.length || 0
                } : null,
                lastTable: updatedWorkspace.tables[updatedWorkspace.tables.length - 1] ? {
                  id: updatedWorkspace.tables[updatedWorkspace.tables.length - 1].id,
                  position: updatedWorkspace.tables[updatedWorkspace.tables.length - 1].position,
                  tasksLength: updatedWorkspace.tables[updatedWorkspace.tables.length - 1].tasks?.length || 0
                } : null
              });
              
              setTables(updatedWorkspace.tables);
              
              console.log('✅ Workspace: setTables called successfully');
            }
            if (updatedWorkspace.taskGroups) {
              setTaskGroups(updatedWorkspace.taskGroups)
            }
            if (updatedWorkspace.settings) {
              saveSettings(updatedWorkspace.settings)
            }
          }}
          onClose={() => setShowAIPanel(false)}
        />
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
                    <div className="grid grid-cols-6 gap-2 p-2 border border-gray-300 rounded max-h-48 overflow-y-auto">
                      {Object.keys(iconMap).map(iconName => (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => setNewGroupIcon(iconName)}
                          className={`p-3 rounded border-2 transition hover:bg-gray-100 flex items-center justify-center ${
                            newGroupIcon === iconName 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-200'
                          }`}
                          title={iconName.replace(/([A-Z])/g, ' $1').trim()}
                        >
                          <FontAwesomeIcon 
                            icon={iconMap[iconName]} 
                            className="text-gray-700"
                            size="lg"
                          />
                        </button>
                      ))}
                    </div>
                    {newGroupIcon && (
                      <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
                        <FontAwesomeIcon icon={iconMap[newGroupIcon]} />
                        <span>Selected: {newGroupIcon.replace(/([A-Z])/g, ' $1').trim()}</span>
                      </div>
                    )}
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

      {/* Space Editor Dialog */}
      {showSpaceEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">
                {editingSpace ? 'Edit Space' : 'Create New Space'}
              </h3>
              <button 
                onClick={() => { setShowSpaceEditor(false); setEditingSpace(null); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {/* Space Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Space Name</label>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="e.g., Work, Personal, Projects"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              {/* Icon Selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
                <div className="grid grid-cols-6 gap-2 p-3 border border-gray-300 rounded max-h-48 overflow-y-auto bg-gray-50">
                  {Object.keys(iconMap).map(iconName => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setNewSpaceIcon(iconName)}
                      className={`p-3 rounded border-2 transition hover:bg-white flex items-center justify-center ${
                        newSpaceIcon === iconName 
                          ? 'border-blue-500 bg-white shadow-md' 
                          : 'border-gray-200 bg-white'
                      }`}
                      title={iconName.replace(/-/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
                    >
                      <FontAwesomeIcon 
                        icon={iconMap[iconName]} 
                        className={newSpaceIcon === iconName ? 'text-blue-600' : 'text-gray-600'}
                        size="lg"
                      />
                    </button>
                  ))}
                </div>
                {newSpaceIcon && (
                  <div className="mt-2 text-sm text-gray-600 flex items-center gap-2 p-2 bg-blue-50 rounded">
                    <FontAwesomeIcon icon={iconMap[newSpaceIcon]} className="text-blue-600" />
                    <span className="font-medium">Selected: {newSpaceIcon.replace(/-/g, ' ').replace(/([A-Z])/g, ' $1').trim()}</span>
                  </div>
                )}
              </div>

              {/* Color Picker */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <input
                  type="color"
                  value={newSpaceColor}
                  onChange={(e) => setNewSpaceColor(e.target.value)}
                  className="w-full h-12 border border-gray-300 rounded cursor-pointer"
                />
                <div className="mt-2 text-sm text-gray-600">
                  Selected color: <span className="font-mono font-medium">{newSpaceColor}</span>
                </div>
              </div>

              {/* Preview */}
              <div className="mb-6 p-4 border-2 border-gray-200 rounded bg-gray-50">
                <label className="block text-xs font-medium text-gray-500 mb-2 uppercase">Preview</label>
                <div 
                  className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-white"
                  style={{ backgroundColor: newSpaceColor }}
                >
                  {newSpaceIcon && iconMap[newSpaceIcon] && (
                    <FontAwesomeIcon icon={iconMap[newSpaceIcon]} size="lg" />
                  )}
                  <span>{newSpaceName || 'Space Name'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={saveSpace}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  {editingSpace ? 'Update Space' : 'Create Space'}
                </button>
                <button
                  onClick={() => { setShowSpaceEditor(false); setEditingSpace(null); }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notebook opening animation */}
      {notebookAnimation && (
        <>
          {/* Connecting line */}
          <svg className="fixed inset-0 pointer-events-none z-[9999]" style={{ width: '100%', height: '100%' }}>
            <line
              x1={notebookAnimation.from.x}
              y1={notebookAnimation.from.y}
              x2={notebookAnimation.to.x}
              y2={notebookAnimation.to.y}
              stroke="#4fc3f7"
              strokeWidth="2"
              strokeDasharray="5,5"
              className="animate-pulse"
            />
          </svg>
          {/* Flying notebook icon */}
          <div
            className="fixed pointer-events-none z-[9999] text-4xl transition-all duration-500 ease-out"
            style={{
              left: notebookAnimation.to.x,
              top: notebookAnimation.to.y,
              transform: `translate(-50%, -50%)`
            }}
          >
            📓
          </div>
        </>
      )}

      {/* Drag Ghost Preview */}
      {dragGhost && (
        <div 
          className="fixed pointer-events-none z-[9999] px-3 py-2 bg-white bg-opacity-60 border-2 border-dashed border-[#4fc3f7] rounded shadow-lg text-sm whitespace-nowrap"
          style={{
            left: dragGhost.x + 10,
            top: dragGhost.y + 10,
          }}
        >
          {dragGhost.taskName}
        </div>
      )}
    </div>

    {/* Mobile Bottom Navigation */}
    {isMobile && (
      <BottomNav
        onAddTodo={() => addTable('todo')}
        onAddDay={() => addTable('day')}
        onOpenNotebook={openWorkspaceNotebook}
        onOpenTimer={() => setShowTimer(true)}
        onOpenMenu={() => setShowMenu(true)}
        showEmoji={showEmoji}
      />
    )}
    </>
  )
}
