import type { Task } from '@/types'
import Papa from 'papaparse'

function escapeCSVField(field: string): string {
  if (!field) return ''
  // First escape any quotes by doubling them
  return field.replace(/"/g, '""')
}

export function tasksToCSV(tasks: Task[]): string {
  // Prepare data in PapaParse format with pre-escaped fields
  const data = {
    fields: ['Start Time', 'End Time', 'Task Name', 'Duration'],
    data: tasks.map(task => [
      task.startTime,
      task.endTime,
      escapeCSVField(task.name),  // Pre-escape the task name
      task.duration
    ])
  }

  // Use PapaParse's unparse with proper config
  return Papa.unparse(data, {
    quotes: true,      // Quote all fields
    quoteChar: '"',    // Use double quotes
    delimiter: ',',    // Use comma as delimiter
    header: true,      // Include header row
    newline: '\n'      // Use \n for newlines
  })
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  // Create download link
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

interface TableExport {
  name: string;
  tasks: Task[];
}

export function tablesToCSV(tables: TableExport[]): string {
  const csvParts: string[] = [];
  
  tables.forEach((table, index) => {
    // Add table name as a header
    csvParts.push(`Table: ${escapeCSVField(table.name)}`);
    
    // Add tasks
    const tasksCsv = tasksToCSV(table.tasks);
    csvParts.push(tasksCsv);
    
    // Add separator between tables (except for last table)
    if (index < tables.length - 1) {
      csvParts.push('\n---\n');
    }
  });
  
  return csvParts.join('\n');
}

export function parseCSV(csv: string): Task[] {
  try {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must contain a header row and at least one task');
    }

    const tasks: Task[] = [];
    const headerRow = lines[0].toLowerCase();
    if (!headerRow.includes('start time') || !headerRow.includes('end time') || 
        !headerRow.includes('task name') || !headerRow.includes('duration')) {
      throw new Error('CSV header must contain Start Time, End Time, Task Name, and Duration columns');
    }

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      // Split by comma but handle quoted fields properly
      const fields = line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)
        ?.map(field => field.replace(/^,?"?|"?$/g, '').replace(/""/g, '"')) || [];

      if (fields.length < 4) {
        throw new Error(`Invalid number of fields at line ${i + 1}`);
      }

      const [startTime, endTime, name, duration] = fields;

      // Validate time formats
      if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || 
          !/^\d{2}:\d{2}$/.test(duration)) {
        throw new Error(`Invalid time format at line ${i + 1}`);
      }

      tasks.push({
        id: crypto.randomUUID(),
        name,
        startTime,
        endTime,
        duration
      });
    }

    return tasks;
  } catch (error) {
    console.error('Task Parse Error:', error);
    throw error;
  }
}

export function parseCSVToTables(csv: string): TableExport[] {
  const tables: TableExport[] = [];
  
  try {
    // Split by table separator and handle empty sections
    const sections = csv.split('\n---\n').filter(section => section.trim());
    
    if (sections.length === 0) {
      throw new Error('No valid table data found in CSV');
    }

    sections.forEach((section, index) => {
      const lines = section.trim().split('\n');
      
      if (lines.length === 0) {
        throw new Error(`Empty section found at table ${index + 1}`);
      }

      // Parse table name
      const tableNameLine = lines[0].trim();
      if (!tableNameLine.startsWith('Table:')) {
        console.error('Invalid line:', tableNameLine);
        throw new Error(`Invalid table header format at table ${index + 1}`);
      }

      const tableName = tableNameLine.substring(6).trim();
      
      // Get tasks CSV content (include the header row)
      const tasksCSV = lines.slice(1).join('\n');
      if (!tasksCSV.trim()) {
        throw new Error(`No task data found for table "${tableName}"`);
      }

      try {
        const tasks = parseCSV(tasksCSV);
        tables.push({
          name: tableName,
          tasks
        });
      } catch (err) {
        const error = err as Error
        throw new Error(`Error parsing tasks for table "${tableName}": ${error.message}`);
      }
    });

    return tables;

  } catch (error) {
    console.error('CSV Parse Error:', error);
    console.error('CSV Content:', csv);
    throw error;
  }
} 