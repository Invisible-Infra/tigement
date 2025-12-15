import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faCalendar, faBook, faClock, faEllipsisH } from '@fortawesome/free-solid-svg-icons'

interface BottomNavProps {
  onAddTodo: () => void
  onAddDay: () => void
  onOpenNotebook: () => void
  onOpenTimer: () => void
  onOpenMenu: () => void
  showEmoji: boolean
}

export function BottomNav({ 
  onAddTodo, 
  onAddDay, 
  onOpenNotebook, 
  onOpenTimer, 
  onOpenMenu, 
  showEmoji 
}: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-[100] pb-safe"
      style={{ backgroundColor: 'white', borderTop: '1px solid #e5e7eb' }}
    >
      <div className="flex justify-around items-center h-16 px-2">
        {/* Add TODO */}
        <button 
          onClick={onAddTodo} 
          className="flex flex-col items-center justify-center flex-1 py-2 text-blue-600 active:bg-gray-100 rounded transition"
          aria-label="Add TODO"
        >
          <FontAwesomeIcon icon={faPlus} className="text-xl mb-1" />
          <span className="text-xs font-medium">TODO</span>
        </button>
        
        {/* Add Day */}
        <button 
          onClick={onAddDay} 
          className="flex flex-col items-center justify-center flex-1 py-2 text-blue-600 active:bg-gray-100 rounded transition"
          aria-label="Add Day"
        >
          <FontAwesomeIcon icon={faCalendar} className="text-xl mb-1" />
          <span className="text-xs font-medium">Day</span>
        </button>
        
        {/* Notebook */}
        <button 
          onClick={onOpenNotebook} 
          className="flex flex-col items-center justify-center flex-1 py-2 text-gray-700 active:bg-gray-100 rounded transition"
          aria-label="Open Notebook"
        >
          <FontAwesomeIcon icon={faBook} className="text-xl mb-1" />
          <span className="text-xs font-medium">Notebook</span>
        </button>
        
        {/* Timer */}
        <button 
          onClick={onOpenTimer} 
          className="flex flex-col items-center justify-center flex-1 py-2 text-[#4fc3f7] active:bg-gray-100 rounded transition"
          aria-label="Open Timer"
        >
          <FontAwesomeIcon icon={faClock} className="text-xl mb-1" />
          <span className="text-xs font-medium">Timer</span>
        </button>
        
        {/* More Menu */}
        <button 
          onClick={onOpenMenu} 
          className="flex flex-col items-center justify-center flex-1 py-2 text-gray-700 active:bg-gray-100 rounded transition"
          aria-label="More options"
        >
          <FontAwesomeIcon icon={faEllipsisH} className="text-xl mb-1" />
          <span className="text-xs font-medium">More</span>
        </button>
      </div>
    </div>
  )
}

