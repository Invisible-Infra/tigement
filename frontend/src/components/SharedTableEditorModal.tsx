/**
 * View/edit modal for shared tables (recipient live edit)
 * Uses TableComponent for same design as original table
 */

import { useState } from 'react'
import { api } from '../utils/api'
import { encryptTableWithDEK, unwrapDEKFromOwner } from '../utils/sharingCrypto'
import { TableComponent } from './TableComponent'
import type { SharedTableContext } from './SharedWithMeSection'

const SHARING_PRIVATE_KEY = 'tigement_sharing_private_key'

function normalizeTable(table: any): any {
  const t = table || {}
  const title = t.title ?? t.name ?? 'Untitled'
  const type = t.type || (t.date ? 'day' : 'todo')
  return {
    id: t.id || 'shared-1',
    type,
    title,
    name: title,
    date: t.date,
    startTime: t.startTime || '08:00',
    tasks: (t.tasks || []).map((task: any) => ({
      ...task,
      title: task.title ?? task.name ?? '',
      duration: task.duration ?? 30,
      selected: task.selected ?? false,
    })),
    position: t.position || { x: 0, y: 0 },
    size: t.size || { width: 680, height: 400 },
    spaceId: t.spaceId ?? null,
    collapsed: t.collapsed ?? false,
  }
}

interface SharedTableEditorModalProps {
  shareId: number
  version: number
  encryptedDek: string
  ownerPublicKey: string
  table: any
  canEdit: boolean
  ownerEmail: string
  formatDate: (d: string) => string
  tableContext?: SharedTableContext
  onClose: () => void
  onSaved?: () => void
}

const noop = (..._args: any[]) => {}

export function SharedTableEditorModal({
  shareId,
  version,
  encryptedDek,
  ownerPublicKey,
  table,
  canEdit,
  ownerEmail,
  formatDate,
  tableContext,
  onClose,
  onSaved,
}: SharedTableEditorModalProps) {
  const [editedTable, setEditedTable] = useState<any>(() => normalizeTable(table))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayTable = normalizeTable(editedTable)

  const handleSave = async () => {
    if (!canEdit) return
    setSaving(true)
    setError(null)
    try {
      const privKey = localStorage.getItem(SHARING_PRIVATE_KEY)
      if (!privKey) throw new Error('Sharing key not found')
      const dek = await unwrapDEKFromOwner(encryptedDek, ownerPublicKey, privKey)
      const encrypted = await encryptTableWithDEK(editedTable, dek)
      await api.updateShareData(shareId, encrypted, version + 1)
      onSaved?.()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const tables = [displayTable]
  const times = tableContext ? tableContext.calculateTimes(displayTable) : []

  const setTablesForShared = (updater: any) => {
    setEditedTable((prev: any) => {
      const current = [prev]
      const next = typeof updater === 'function' ? updater(current) : updater
      return Array.isArray(next) && next[0] ? next[0] : prev
    })
  }

  if (!tableContext) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[300]" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[#4a6c7a] text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
            <h2 className="text-xl font-bold">{displayTable.title}</h2>
            <button onClick={onClose} className="text-2xl hover:text-gray-300">&times;</button>
          </div>
          <div className="p-6 text-gray-600">Loading table view...</div>
        </div>
      </div>
    )
  }

  const ctx = tableContext
  const isViewOnly = !canEdit

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[300]" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#4a6c7a] text-white px-6 py-4 rounded-t-lg flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold">{displayTable.title}</h2>
            <p className="text-sm text-white/80">From {ownerEmail}</p>
            {displayTable.date && (
              <p className="text-xs text-white/70 mt-1">{formatDate(displayTable.date)}</p>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 bg-white/20 text-white border border-white/30 rounded text-sm hover:bg-white/30 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
            <button onClick={onClose} className="text-2xl hover:text-gray-300">&times;</button>
          </div>
        </div>
        {error && (
          <div className="mx-6 mt-2 p-2 bg-red-100 text-red-700 rounded text-sm">
            {error}
          </div>
        )}
        <div className="flex-1 overflow-auto p-4">
          <TableComponent
            table={displayTable}
            times={displayTable.type === 'day' ? times : []}
            isDraggingTable={false}
            tableZIndex={1}
            isMobile={false}
            zoom={1}
            settings={ctx.settings}
            showEmoji={false}
            iconMap={ctx.iconMap}
            timePickerTable={null}
            setTimePickerTable={noop}
            durationPickerTask={null}
            setDurationPickerTask={noop}
            groupSelectorTask={null}
            setGroupSelectorTask={noop}
            bulkActionsOpen={null}
            setBulkActionsOpen={noop}
            bulkGroupSelectorTable={null}
            setBulkGroupSelectorTable={noop}
            hoveredTask={null}
            setHoveredTask={noop}
            highlightedTask={null}
            draggedTask={null}
            dropTarget={null}
            draggedTable={null}
            touchDragStart={null}
            handleTableDragStart={noop}
            handleTableResizeStart={noop}
            updateTableDate={noop}
            setTables={isViewOnly ? noop : setTablesForShared}
            archiveTable={noop}
            duplicateTable={noop}
            deleteTable={noop}
            toggleTableCollapsed={noop}
            toggleSelectAll={noop}
            updateTableStartTime={noop}
            handleDragOver={noop}
            handleDragLeave={noop}
            handleDrop={noop}
            toggleSelect={noop}
            moveTaskUp={noop}
            moveTaskDown={noop}
            handleHandleTouchStart={noop}
            handleHandleTouchEnd={noop}
            handleDragStart={noop}
            handleDragEnd={noop}
            handleTouchMove={noop}
            handleTouchEnd={noop}
            updateTask={isViewOnly ? noop : (tableId, taskId, field, value) => {
              setEditedTable((prev: any) => ({
                ...prev,
                tasks: prev.tasks.map((t: any) =>
                  t.id === taskId ? { ...t, [field === 'title' || field === 'name' ? 'title' : field]: value } : t
                ),
              }))
            }}
            startMoveLongPress={noop}
            cancelMoveLongPress={noop}
            openTaskNotebook={noop}
            addTask={isViewOnly ? noop : (tableId, index) => {
              setEditedTable((prev: any) => {
                const newTask = { id: `task-${Date.now()}`, title: '', duration: ctx.settings?.defaultDuration ?? 30, selected: false }
                const tasks = [...prev.tasks]
                if (index !== undefined) {
                  tasks.splice(index + 1, 0, newTask)
                } else {
                  tasks.push(newTask)
                }
                return { ...prev, tasks }
              })
            }}
            duplicateTask={noop}
            deleteTask={isViewOnly ? noop : (tableId, taskId) => {
              setEditedTable((prev: any) => ({
                ...prev,
                tasks: prev.tasks.filter((t: any) => t.id !== taskId),
              }))
            }}
            deleteSelected={noop}
            exportTableToMarkdown={noop}
            formatDate={ctx.formatDate}
            formatTime={ctx.formatTime}
            parseTime={ctx.parseTime}
            formatDuration={ctx.formatDuration}
            parseDuration={ctx.parseDuration}
            getTotalDuration={ctx.getTotalDuration}
            isTaskInPast={ctx.isTaskInPast}
            isTaskCurrent={ctx.isTaskCurrent}
            getTaskTimeMatchStatus={ctx.getTaskTimeMatchStatus}
            getTaskGroup={ctx.getTaskGroup}
            getContrastColor={ctx.getContrastColor}
            getEffectiveBackgroundHex={ctx.getEffectiveBackgroundHex}
            getThemeColor={ctx.getThemeColor}
            tables={tables}
            readOnly={isViewOnly}
            ownerEmail={isViewOnly ? ownerEmail : undefined}
          />
        </div>
      </div>
    </div>
  )
}
