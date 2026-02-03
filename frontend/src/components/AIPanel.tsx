import { useState } from 'react'
import { AIChat } from './AIChat'
import { AIHistory } from './AIHistory'

interface AIPanelProps {
  workspace: any
  onWorkspaceUpdate: (workspace: any) => void
  onClose: () => void
  position?: { x: number; y: number }
  onPositionChange?: (pos: { x: number; y: number }) => void
}

export function AIPanel({ workspace, onWorkspaceUpdate, onClose, position, onPositionChange }: AIPanelProps) {
  const [tab, setTab] = useState<'chat' | 'history'>('chat')

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('chat')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                tab === 'chat'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                tab === 'history'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              History
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-hidden min-h-0">
          {tab === 'chat' && (
            <AIChat
              workspace={workspace}
              onWorkspaceUpdate={onWorkspaceUpdate}
              onClose={onClose}
              position={position}
              onPositionChange={onPositionChange}
              embedded
            />
          )}
          {tab === 'history' && (
            <AIHistory
              workspace={workspace}
              onWorkspaceUpdate={onWorkspaceUpdate}
              onClose={onClose}
              embedded
            />
          )}
        </div>
      </div>
    </div>
  )
}
