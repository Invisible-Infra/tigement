interface Task {
  id: string
  title: string
  duration: number
  selected: boolean
  group?: string
  notebook?: string
}

interface Table {
  id: string
  type: 'day' | 'list'
  title: string
  date?: string
  startTime?: string
  tasks: Task[]
  position: { x: number; y: number }
  size?: { width: number; height: number }
  spaceId?: string | null
}

interface ArchivedTable {
  id: string | number
  table_data?: Table
  table_type: 'day' | 'list'
  table_date?: string | null
  table_title: string
  task_count: number
  archived_at: string
}

export function exportToCSV(tables: Table[]): string {
  const rows: string[][] = []
  
  // Header
  rows.push(['Table ID', 'Table Title', 'Table Type', 'Date', 'Start Time', 'Task ID', 'Task Title', 'Task Group', 'Duration (min)'])
  
  // Data rows
  tables.forEach(table => {
    if (table.tasks.length === 0) {
      rows.push([
        table.id,
        table.title,
        table.type,
        table.date || '',
        table.startTime || '',
        '',
        '',
        '',
        ''
      ])
    } else {
      table.tasks.forEach(task => {
        rows.push([
          table.id,
          table.title,
          table.type,
          table.date || '',
          table.startTime || '',
          task.id,
          task.title,
          task.group || 'general',
          task.duration.toString()
        ])
      })
    }
  })
  
  // Convert to CSV string
  return rows.map(row => 
    row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma/quote/newline
      const escaped = cell.replace(/"/g, '""')
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
    }).join(',')
  ).join('\n')
}

export function exportFilteredToCSV(
  tables: Table[],
  archivedTables: ArchivedTable[],
  selectedGroups: string[],
  dateFrom: string | null,
  dateTo: string | null
): string {
  const rows: string[][] = []
  
  // Header
  rows.push(['Table ID', 'Table Title', 'Table Type', 'Date', 'Start Time', 'Task ID', 'Task Title', 'Task Group', 'Duration (min)', 'Source'])
  
  // Process active tables
  tables.forEach(table => {
    // Apply date filter
    if (dateFrom || dateTo) {
      if (!table.date) return
      if (dateFrom && table.date < dateFrom) return
      if (dateTo && table.date > dateTo) return
    }

    // Filter tasks by group
    const filteredTasks = table.tasks?.filter(task => {
      if (selectedGroups.length === 0) return true
      const taskGroup = task.group || 'general'
      return selectedGroups.includes(taskGroup)
    }) || []

    if (filteredTasks.length > 0) {
      filteredTasks.forEach(task => {
        rows.push([
          table.id,
          table.title,
          table.type,
          table.date || '',
          table.startTime || '',
          task.id,
          task.title,
          task.group || 'general',
          task.duration.toString(),
          'Active'
        ])
      })
    }
  })

  // Process archived tables
  archivedTables.forEach(archivedTable => {
    // Apply date filter
    if (dateFrom || dateTo) {
      const tableDate = archivedTable.table_date
      if (!tableDate) return
      if (dateFrom && tableDate < dateFrom) return
      if (dateTo && tableDate > dateTo) return
    }

    // Only process if table_data is available
    if (archivedTable.table_data && archivedTable.table_data.tasks) {
      const table = archivedTable.table_data

      // Filter tasks by group
      const filteredTasks = table.tasks.filter(task => {
        if (selectedGroups.length === 0) return true
        const taskGroup = task.group || 'general'
        return selectedGroups.includes(taskGroup)
      })

      if (filteredTasks.length > 0) {
        filteredTasks.forEach(task => {
          rows.push([
            String(archivedTable.id),
            table.title,
            table.type,
            table.date || archivedTable.table_date || '',
            table.startTime || '',
            task.id,
            task.title,
            task.group || 'general',
            task.duration.toString(),
            'Archived'
          ])
        })
      }
    }
  })

  // Convert to CSV string
  return rows.map(row => 
    row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma/quote/newline
      const escaped = cell.replace(/"/g, '""')
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
    }).join(',')
  ).join('\n')
}

export function downloadCSV(csv: string, filename: string = 'tigement-export.csv') {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function importFromCSV(csv: string): Table[] {
  const lines = csv.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []
  
  // Skip header
  const dataLines = lines.slice(1)
  
  const tablesMap = new Map<string, Table>()
  
  dataLines.forEach(line => {
    const cells = parseCSVLine(line)
    if (cells.length < 8) return
    
    const [tableId, tableTitle, tableType, date, startTime, taskId, taskTitle, duration] = cells
    
    if (!tablesMap.has(tableId)) {
      tablesMap.set(tableId, {
        id: tableId,
        type: (tableType === 'day' ? 'day' : 'list') as 'day' | 'list',
        title: tableTitle,
        date: date || undefined,
        startTime: startTime || '08:00',
        tasks: [],
        position: { x: 20, y: 20 }
      })
    }
    
    if (taskId && taskTitle) {
      const table = tablesMap.get(tableId)!
      table.tasks.push({
        id: taskId,
        title: taskTitle,
        duration: duration ? parseInt(duration) : 30,
        selected: false
      })
    }
  })
  
  return Array.from(tablesMap.values())
}

function parseCSVLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]
    
    if (char === '"' && inQuotes && nextChar === '"') {
      // Escaped quote
      current += '"'
      i++ // Skip next quote
    } else if (char === '"') {
      // Toggle quotes
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      // End of cell
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  cells.push(current) // Last cell
  return cells
}
