import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { iconMap, getContrastColor } from '../utils/groupIcons'

export interface GroupPickerGroup {
  id: string
  name: string
  icon?: string
  color?: string
}

interface GroupPickerModalProps {
  groups: GroupPickerGroup[]
  selectedId?: string
  onSelect: (groupId: string | undefined) => void
  onClose: () => void
}

export function GroupPickerModal({ groups, selectedId, onSelect, onClose }: GroupPickerModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-lg shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Select Group</h3>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-800 text-2xl leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 gap-2 mb-3">
            {groups.map((group) => {
              const isSelected = selectedId === group.id || (!selectedId && group.id === 'general')
              const textColor = getContrastColor(group.color)
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    onSelect(group.id)
                    onClose()
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded border-2 transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                  style={{
                    backgroundColor: group.color,
                    color: textColor
                  }}
                >
                  {group.icon && iconMap[group.icon] ? (
                    <FontAwesomeIcon icon={iconMap[group.icon]} style={{ color: textColor }} />
                  ) : (
                    <span className="w-4 text-center opacity-60">●</span>
                  )}
                  <span className="text-sm font-medium flex-1 text-left">{group.name}</span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              onSelect(undefined)
              onClose()
            }}
            className={`w-full px-3 py-2 rounded border-2 text-sm font-medium transition ${
              !selectedId
                ? 'border-blue-500 bg-blue-50 text-blue-800'
                : 'border-gray-200 text-gray-700 hover:border-gray-400'
            }`}
          >
            No group
          </button>
        </div>
      </div>
    </div>
  )
}
