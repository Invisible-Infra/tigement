// Utilities for merging anonymous local data into an authenticated workspace
// High-level API:
// - detectNonEmptyLocalData(localTables, notebooks)
// - planMerge(local, server)
// - applyMerge(server, plan)
//
// Rules agreed with user:
// - If a local table matches server by title+date (day) or title (todo), DO NOT merge into it; create a duplicate copy with a new id
// - For same-table task title conflicts, keep both; suffix the local one with " (local)"
// - Notebooks concatenate with a separator containing a timestamp; server text is never overwritten

export type TableType = 'day' | 'todo'

export interface MergeTask {
  id: string
  title: string
  duration: number
  startTime?: string
  selected?: boolean
  group?: string
  notebook?: string
}

export interface MergeTable {
  id: string
  type: TableType
  title: string
  date?: string
  startTime?: string
  tasks: MergeTask[]
  position: { x: number; y: number }
  size?: { width: number; height: number }
}

export interface MergeWorkspace {
  tables: MergeTable[]
  notebooks?: {
    workspace?: string
    tasks?: Record<string, string>
  }
}

export interface DetectedLocalData {
  nonEmptyTables: MergeTable[]
  nonEmptyNotebooks: {
    workspace?: string
    tasks: Record<string, string>
  }
}

export const isTaskNonEmpty = (t: MergeTask): boolean => {
  // A task is non-empty only if it has a title (user actually created content)
  // Duration alone doesn't indicate user-created content (default tasks have duration but no title)
  const hasTitle = (t.title || '').trim().length > 0
  return hasTitle
}

export const isTableNonEmpty = (tbl: MergeTable): boolean => {
  return Array.isArray(tbl.tasks) && tbl.tasks.some(isTaskNonEmpty)
}

export function detectNonEmptyLocalData(localTables: MergeTable[] | null | undefined, notebooks: { workspace?: string; tasks?: Record<string, string> } | null | undefined): DetectedLocalData {
  const tables = (localTables || []).filter(isTableNonEmpty)
  const nonEmptyNotebooksTasks: Record<string, string> = {}
  if (notebooks?.tasks) {
    for (const [taskId, content] of Object.entries(notebooks.tasks)) {
      if ((content || '').trim().length > 0) {
        nonEmptyNotebooksTasks[taskId] = content
      }
    }
  }
  const workspaceNotebook = (notebooks?.workspace || '').trim()
  return {
    nonEmptyTables: tables,
    nonEmptyNotebooks: {
      workspace: workspaceNotebook.length > 0 ? workspaceNotebook : undefined,
      tasks: nonEmptyNotebooksTasks
    }
  }
}

// Create a stable key to detect "matching" tables in server
const tableKey = (t: MergeTable): string => {
  if (t.type === 'day') {
    return `day|${(t.date || '').trim()}|${(t.title || '').trim().toLowerCase()}`
  }
  return `todo|${(t.title || '').trim().toLowerCase()}`
}

export interface MergePlan {
  toDuplicate: MergeTable[] // local tables duplicated into server regardless of matches
  notebookWorkspace?: string
  notebookTasks: Record<string, string>
}

export function planMerge(local: DetectedLocalData, server: MergeWorkspace): MergePlan {
  // As per rules, always duplicate qualifying local tables (non-empty)
  // We clamp positions later in applyMerge
  const toDuplicate = [...local.nonEmptyTables]
  return {
    toDuplicate,
    notebookWorkspace: local.nonEmptyNotebooks.workspace,
    notebookTasks: local.nonEmptyNotebooks.tasks || {}
  }
}

function generateId(prefix: string = 'tbl'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function clampPosition(pos: { x: number; y: number }): { x: number; y: number } {
  // Keep inside a reasonable desktop canvas
  return {
    x: clamp(pos.x ?? 0, 0, 3000),
    y: clamp(pos.y ?? 0, 0, 2000)
  }
}

function dedupeWithinTable(existing: MergeTask[], incoming: MergeTask[]): MergeTask[] {
  const existingKey = (t: MergeTask) => `${(t.title || '').trim().toLowerCase()}|${t.duration || 0}|${t.startTime || ''}`
  const set = new Set(existing.map(existingKey))
  return incoming.map(t => {
    const key = existingKey(t)
    if (set.has(key)) {
      // identical; keep as-is (still duplicating whole table, but avoid suffix)
      return t
    }
    // same title conflict? we suffix " (local)"; we consider title-only conflict
    const titleLower = (t.title || '').trim().toLowerCase()
    const titleExists = existing.some(et => (et.title || '').trim().toLowerCase() === titleLower)
    if (titleExists) {
      return { ...t, title: `${t.title} (local)` }
    }
    return t
  })
}

export interface ApplyResult {
  merged: MergeWorkspace
  addedTableIds: string[]
}

export function applyMerge(server: MergeWorkspace, plan: MergePlan): ApplyResult {
  const merged: MergeWorkspace = {
    tables: server.tables ? [...server.tables] : [],
    notebooks: {
      workspace: server.notebooks?.workspace || '',
      tasks: { ...(server.notebooks?.tasks || {}) }
    }
  }
  const addedTableIds: string[] = []

  // Duplicate local tables with new ids and clamped positions
  for (const localTable of plan.toDuplicate) {
    const newId = generateId('tbl')
    const existingTasks = [] as MergeTask[]
    const incomingTasks = (localTable.tasks || []).map(t => ({ ...t }))
    const tasks = dedupeWithinTable(existingTasks, incomingTasks)
    merged.tables.push({
      id: newId,
      type: localTable.type,
      title: localTable.title,
      date: localTable.date,
      startTime: localTable.startTime,
      tasks,
      position: clampPosition(localTable.position || { x: 40, y: 40 }),
      size: localTable.size
    })
    addedTableIds.push(newId)
  }

  // Notebooks: workspace concat; tasks notebooks concat or set if empty
  const sep = `\n\n--- merged from local at ${new Date().toISOString()} ---\n\n`
  if (plan.notebookWorkspace && plan.notebookWorkspace.trim().length > 0) {
    const current = merged.notebooks!.workspace || ''
    merged.notebooks!.workspace = current ? current + sep + plan.notebookWorkspace : plan.notebookWorkspace
  }
  for (const [taskId, text] of Object.entries(plan.notebookTasks || {})) {
    if (!text || !text.trim()) continue
    const current = merged.notebooks!.tasks![taskId] || ''
    merged.notebooks!.tasks![taskId] = current ? current + sep + text : text
  }

  return { merged, addedTableIds }
}

// Helper to count items for dialog
export function summarize(local: DetectedLocalData) {
  const tableCount = local.nonEmptyTables.length
  const taskCount = local.nonEmptyTables.reduce((acc, t) => acc + t.tasks.filter(isTaskNonEmpty).length, 0)
  const notebookCount = (local.nonEmptyNotebooks.workspace ? 1 : 0) + Object.keys(local.nonEmptyNotebooks.tasks || {}).length
  return { tableCount, taskCount, notebookCount }
}


