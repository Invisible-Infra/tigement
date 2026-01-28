import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface Space {
  id: string
  name: string
  color?: string
  icon?: string
}

interface SpaceTabsProps {
  spaces: Space[]
  activeSpaceId: string
  onSpaceChange: (spaceId: string) => void
  onAddSpace: () => void
  onEditSpace: (spaceId: string) => void
  onDeleteSpace: (spaceId: string) => void
  iconMap: Record<string, any>
}

export function SpaceTabs({
  spaces,
  activeSpaceId,
  onSpaceChange,
  onAddSpace,
  onEditSpace,
  onDeleteSpace,
  iconMap
}: SpaceTabsProps) {
  console.log('📑 SpaceTabs rendering:', { spacesCount: spaces.length, spaces, activeSpaceId })
  
  if (!spaces || spaces.length === 0) {
    console.warn('⚠️ SpaceTabs: No spaces provided!')
    return null
  }
  
  return (
    <div className="relative z-10 flex items-center gap-3 bg-gray-100 p-4 border-b overflow-x-auto overflow-y-visible">
      {spaces.map((space) => (
        <div key={space.id} className="relative group z-10">
          <div
            role="tab"
            tabIndex={0}
            onClick={() => onSpaceChange(space.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSpaceChange(space.id)
              }
            }}
            className={`relative z-10 px-8 py-4 rounded-t-lg flex items-center gap-3 transition text-base font-medium cursor-pointer ${
              activeSpaceId === space.id
                ? 'bg-white shadow-md'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
            style={
              activeSpaceId === space.id && space.color
                ? { borderTop: `3px solid ${space.color}` }
                : undefined
            }
          >
            {space.icon && iconMap[space.icon] ? (
              <FontAwesomeIcon 
                icon={iconMap[space.icon]} 
                size="1x"
                className={activeSpaceId === space.id ? 'text-gray-700' : 'text-gray-600'}
              />
            ) : space.icon ? (
              <span className="text-sm">{space.icon}</span>
            ) : null}
            <span className={activeSpaceId === space.id ? 'text-gray-900' : 'text-gray-700'}>{space.name}</span>
            {activeSpaceId === space.id && (
              <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onEditSpace(space.id)}
                  className="text-sm px-2 py-1 bg-white hover:bg-gray-100 rounded border border-gray-300 transition"
                  title="Edit space"
                >
                  ✏️
                </button>
                {spaces.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteSpace(space.id)}
                    className="text-sm px-2 py-1 bg-white hover:bg-red-100 rounded border border-gray-300 transition"
                    title="Delete space"
                  >
                    🗑️
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
      
      <button
        onClick={onAddSpace}
        className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-lg text-base font-medium transition flex items-center gap-3"
        title="Add new space"
      >
        <span className="text-lg font-bold">+</span>
        <span>Space</span>
      </button>
    </div>
  )
}

