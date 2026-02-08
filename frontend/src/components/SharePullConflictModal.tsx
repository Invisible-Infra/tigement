/**
 * Per-task conflict resolution modal (owner only, multiple recipients pushed)
 * Owner picks Owner | R1 | R2 per task, then applies merged result
 */

import { useState } from 'react'

interface PushSource {
  userEmail: string
  userId: number
  table: any
}

interface SharePullConflictModalProps {
  localTable: any
  pushes: PushSource[]
  onConfirm: (mergedTable: any) => void
  onCancel: () => void
}

type SourceKey = 'owner' | number

function collectAllTaskIds(local: any, pushes: PushSource[]): string[] {
  const ids = new Set<string>()
  const order: string[] = []
  ;(local?.tasks ?? []).forEach((t: any) => {
    if (!ids.has(t.id)) { ids.add(t.id); order.push(t.id) }
  })
  pushes.forEach((p) => (p.table?.tasks ?? []).forEach((t: any) => {
    if (!ids.has(t.id)) { ids.add(t.id); order.push(t.id) }
  }))
  return order
}

export function SharePullConflictModal({ localTable, pushes, onConfirm, onCancel }: SharePullConflictModalProps) {
  const taskIds = collectAllTaskIds(localTable, pushes)
  const distinctRecipients = new Set(pushes.map((p) => p.userId)).size
  const [selections, setSelections] = useState<Record<string, SourceKey>>(() => {
    const init: Record<string, SourceKey> = {}
    taskIds.forEach((id) => {
      const ownerTask = (localTable?.tasks ?? []).find((t: any) => t.id === id)
      if (ownerTask) init[id] = 'owner'
      else {
        const firstPush = pushes.find((p) => (p.table?.tasks ?? []).some((t: any) => t.id === id))
        if (firstPush) init[id] = firstPush.userId
      }
    })
    return init
  })

  const buildMergedTable = () => {
    const tasks: any[] = []
    const seen = new Set<string>()
    taskIds.forEach((taskId) => {
      const sel = selections[taskId]
      let task: any = null
      if (sel === 'owner') {
        task = (localTable?.tasks ?? []).find((t: any) => t.id === taskId)
      } else if (typeof sel === 'number') {
        const src = pushes.find((p) => p.userId === sel)
        if (src) task = (src.table?.tasks ?? []).find((t: any) => t.id === taskId)
      }
      if (task && !seen.has(task.id)) {
        seen.add(task.id)
        tasks.push(task)
      }
    })
    return { ...localTable, tasks }
  }

  const handleConfirm = () => {
    onConfirm(buildMergedTable())
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[300]" onClick={onCancel}>
      <div className="rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'var(--color-surface-elevated)', color: 'var(--color-text)' }}>
        <div className="px-6 py-4 rounded-t-lg flex justify-between items-center" style={{ backgroundColor: 'var(--color-primary-dark)' }}>
          <h2 className="text-xl font-bold text-white">Resolve conflicts</h2>
          <button onClick={onCancel} className="text-2xl text-white hover:opacity-80">&times;</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            {distinctRecipients > 1
              ? 'Multiple recipients pushed changes. Choose which version to keep for each task.'
              : 'One recipient pushed changes. Choose which version to keep for each task.'}
          </p>
          <div className="space-y-4">
            {taskIds.map((taskId) => {
              const ownerTask = (localTable?.tasks ?? []).find((t: any) => t.id === taskId)
              const options: Array<{ key: SourceKey; label: string; task: any }> = []
              if (ownerTask) options.push({ key: 'owner', label: 'Owner (local)', task: ownerTask })
              pushes.forEach((p) => {
                const t = (p.table?.tasks ?? []).find((t: any) => t.id === taskId)
                if (t) options.push({ key: p.userId, label: p.userEmail, task: t })
              })
              if (options.length <= 1) return null
              return (
                <div key={taskId} className="border rounded p-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="font-medium mb-2">
                    Task: {options[0]?.task?.title || '(untitled)'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {options.map((opt) => (
                      <label key={String(opt.key)} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`task-${taskId}`}
                          checked={selections[taskId] === opt.key}
                          onChange={() => setSelections((s) => ({ ...s, [taskId]: opt.key }))}
                        />
                        <span>{opt.label}</span>
                        {opt.task.duration != null && (
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>({opt.task.duration} min)</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="px-6 py-4 flex gap-3 justify-end" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded"
            style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-white rounded"
            style={{ backgroundColor: 'var(--color-primary-dark)' }}
          >
            Apply merged result
          </button>
        </div>
      </div>
    </div>
  )
}
