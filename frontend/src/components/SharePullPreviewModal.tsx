/**
 * Preview modal for single-push pull (owner or recipient)
 * Shows diff between local and remote, Accept/Reject
 */

interface SharePullPreviewModalProps {
  localTable: any
  remoteTable: any
  lastPushedByEmail?: string
  onConfirm: () => void
  onReject: () => void
  onClose: () => void
}

export function computeDiff(local: any, remote: any): { added: any[]; removed: any[]; modified: Array<{ task: any; local: any; remote: any }> } {
  const localTasks = local?.tasks ?? []
  const remoteTasks = remote?.tasks ?? []
  const localMap = new Map(localTasks.map((t: any) => [t.id, t]))
  const remoteMap = new Map(remoteTasks.map((t: any) => [t.id, t]))

  const added: any[] = []
  const removed: any[] = []
  const modified: Array<{ task: any; local: any; remote: any }> = []

  remoteTasks.forEach((r: any) => {
    const loc = localMap.get(r.id)
    if (!loc) added.push(r)
    else {
      const locStr = JSON.stringify({ title: loc.title, duration: loc.duration })
      const remStr = JSON.stringify({ title: r.title, duration: r.duration })
      if (locStr !== remStr) modified.push({ task: r, local: loc, remote: r })
    }
  })
  localTasks.forEach((l: any) => {
    if (!remoteMap.has(l.id)) removed.push(l)
  })

  return { added, removed, modified }
}

export function SharePullPreviewModal({
  localTable,
  remoteTable,
  lastPushedByEmail,
  onConfirm,
  onReject,
  onClose,
}: SharePullPreviewModalProps) {
  const { added, removed, modified } = computeDiff(localTable, remoteTable)
  const hasChanges = added.length > 0 || removed.length > 0 || modified.length > 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[300]" onClick={onClose}>
      <div className="rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'var(--color-surface-elevated)', color: 'var(--color-text)' }}>
        <div className="px-6 py-4 rounded-t-lg flex justify-between items-center" style={{ backgroundColor: 'var(--color-primary-dark)' }}>
          <h2 className="text-xl font-bold text-white">Pull changes{lastPushedByEmail ? ` from ${lastPushedByEmail}` : ''}</h2>
          <button onClick={onClose} className="text-2xl text-white hover:opacity-80">&times;</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {!hasChanges ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>No task changes detected (structural or metadata only).</p>
          ) : (
            <div className="space-y-4">
              {modified.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Modified tasks</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {modified.map(({ task, local, remote }) => (
                      <li key={task.id}>
                        {task.title || '(untitled)'}: {local.title !== remote.title && `"${local.title}" → "${remote.title}" `}
                        {local.duration !== remote.duration && `duration ${local.duration} → ${remote.duration} min`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {added.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Added tasks</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {added.map((t: any) => (
                      <li key={t.id}>{t.title || '(untitled)'} ({t.duration ?? 30} min)</li>
                    ))}
                  </ul>
                </div>
              )}
              {removed.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Removed tasks</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {removed.map((t: any) => (
                      <li key={t.id}>{t.title || '(untitled)'}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-6 py-4 flex gap-3 justify-end" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={onReject}
            className="px-4 py-2 rounded"
            style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
          >
            Reject
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-white rounded"
            style={{ backgroundColor: 'var(--color-primary-dark)' }}
          >
            Accept changes
          </button>
        </div>
      </div>
    </div>
  )
}
