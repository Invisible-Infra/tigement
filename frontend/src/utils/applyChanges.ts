/**
 * Apply AI changes to workspace
 * Handles all change types defined in AI prompts
 */

import { AIChange } from './aiAssistant';
import { formatDateWithWeekday } from './dateFormat';

export interface ApplyResult {
  success: boolean;
  appliedChanges: number;
  errors: string[];
  updatedWorkspace: any;
}

/**
 * Apply AI changes to workspace data
 */
export function applyAIChanges(workspace: any, changes: AIChange[]): ApplyResult {
  const errors: string[] = [];
  let appliedChanges = 0;
  
  console.log('📋 Apply: Starting applyAIChanges', {
    changesCount: changes.length,
    workspaceTablesCount: workspace.tables?.length || 0,
    changes: changes.map(c => ({ action: c.action, ...(c.action === 'create_table' ? { tableId: c.table?.id, tableType: c.table?.type } : {}) }))
  });
  
  // Clone workspace to avoid mutation
  const updated = JSON.parse(JSON.stringify(workspace));

  for (const change of changes) {
    try {
      if (change.action === 'create_table') {
        console.log('🎯 Table: Processing create_table action', {
          change: JSON.stringify(change, null, 2),
          workspaceTablesBefore: updated.tables?.length || 0
        });
      }
      
      switch (change.action) {
        case 'move_tasks':
          applyMoveTask(updated, change);
          break;
        case 'update_task':
          applyUpdateTask(updated, change);
          break;
        case 'create_task':
          applyCreateTask(updated, change);
          break;
        case 'delete_task':
          applyDeleteTask(updated, change);
          break;
        case 'create_table':
          applyCreateTable(updated, change);
          break;
        case 'update_table':
          applyUpdateTable(updated, change);
          break;
        case 'reorder_tasks':
          applyReorderTasks(updated, change);
          break;
        default:
          throw new Error(`Unknown action: ${change.action}`);
      }
      
      if (change.action === 'create_table') {
        console.log('✅ Table: Successfully applied create_table', {
          workspaceTablesAfter: updated.tables?.length || 0,
          lastTable: updated.tables?.[updated.tables.length - 1]
        });
      }
      
      appliedChanges++;
    } catch (error: any) {
      console.error('❌ Apply: Error applying change', {
        action: change.action,
        error: error.message,
        stack: error.stack,
        change: change.action === 'create_table' ? JSON.stringify(change, null, 2) : change
      });
      errors.push(`Failed to apply ${change.action}: ${error.message}`);
    }
  }

  const result = {
    success: errors.length === 0,
    appliedChanges,
    errors,
    updatedWorkspace: updated
  };
  
  console.log('📋 Apply: Completed applyAIChanges', {
    success: result.success,
    appliedChanges: result.appliedChanges,
    errors: result.errors,
    finalTablesCount: updated.tables?.length || 0
  });

  return result;
}

/**
 * Helper function to find or create a table by date
 * Used when moving tasks to a date that might not have a table yet
 */
function findOrCreateTableByDate(workspace: any, date: string): any {
  // First, try to find existing table by date
  const existingTable = workspace.tables.find((t: any) => 
    t.type === 'day' && t.date === date
  );
  
  if (existingTable) {
    console.log('📅 Move: Found existing table for date', {
      date,
      tableId: existingTable.id,
      tableTitle: existingTable.title
    });
    return existingTable;
  }
  
  // Table doesn't exist, create a new one
  console.log('📅 Move: Creating new table for date', { date });
  
  if (!workspace.tables) workspace.tables = [];
  
  const tablesCount = workspace.tables.length;
  const settings = workspace.settings || {};
  const formattedTitle = formatDateWithWeekday(date, settings.dateFormat);

  const newTable = {
    id: `day-${Date.now()}`,
    type: 'day' as const,
    title: formattedTitle,
    date: date,
    startTime: settings.defaultStartTime || '08:00',
    tasks: [],
    position: {
      x: 20 + tablesCount * 100,
      y: 20 + tablesCount * 50
    },
    spaceId: null
  };
  
  workspace.tables.push(newTable);
  
  console.log('✅ Move: Created new table', {
    tableId: newTable.id,
    date: newTable.date,
    title: newTable.title
  });
  
  return newTable;
}

/**
 * Extract date from table ID if it contains a date pattern
 * Examples: "tbl_axzs9a3i-2026-01-25" -> "2026-01-25"
 */
function extractDateFromTableId(tableId: string): string | null {
  // Look for date pattern YYYY-MM-DD in the ID
  const dateMatch = tableId.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return dateMatch[1];
  }
  return null;
}

function applyMoveTask(workspace: any, change: AIChange) {
  console.log('🔄 Move: Starting move_tasks', {
    fromTableId: change.from_table_id,
    toTableId: change.to_table_id,
    taskIds: change.task_ids,
    workspaceTablesCount: workspace.tables?.length || 0
  });
  
  const fromTable = workspace.tables.find((t: any) => t.id === change.from_table_id);
  
  if (!fromTable) {
    console.error('❌ Move: Source table not found', {
      fromTableId: change.from_table_id,
      availableTableIds: workspace.tables?.map((t: any) => t.id) || []
    });
    throw new Error(`Source table not found: ${change.from_table_id}`);
  }
  
  // Try to find target table by exact ID first
  let toTable = workspace.tables.find((t: any) => t.id === change.to_table_id);
  
  if (!toTable) {
    console.log('⚠️ Move: Target table not found by ID, attempting date-based lookup', {
      toTableId: change.to_table_id
    });
    
    // Try to extract date from the target table ID
    const extractedDate = extractDateFromTableId(change.to_table_id);
    
    if (extractedDate) {
      console.log('📅 Move: Extracted date from table ID', {
        toTableId: change.to_table_id,
        extractedDate
      });
      toTable = findOrCreateTableByDate(workspace, extractedDate);
    } else {
      // Couldn't extract date, check if we can infer from source table
      // If source table has a date and we're moving to "tomorrow", calculate it
      if (fromTable.date && fromTable.type === 'day') {
        const sourceDate = new Date(fromTable.date);
        sourceDate.setDate(sourceDate.getDate() + 1);
        const tomorrowDate = sourceDate.toISOString().split('T')[0];
        
        console.log('📅 Move: Inferring tomorrow date from source table', {
          sourceDate: fromTable.date,
          tomorrowDate
        });
        toTable = findOrCreateTableByDate(workspace, tomorrowDate);
      } else {
        console.error('❌ Move: Cannot determine target table', {
          toTableId: change.to_table_id,
          fromTableDate: fromTable.date,
          fromTableType: fromTable.type
        });
        throw new Error(`Target table not found: ${change.to_table_id}`);
      }
    }
  }
  
  console.log('✅ Move: Found target table', {
    toTableId: toTable.id,
    toTableTitle: toTable.title,
    toTableDate: toTable.date,
    toTableTasksCount: toTable.tasks?.length || 0
  });

  // Find and remove tasks from source
  const tasksToMove = [];
  for (const taskId of change.task_ids) {
    const index = fromTable.tasks.findIndex((t: any) => t.id === taskId);
    if (index === -1) {
      console.error('❌ Move: Task not found in source table', {
        taskId,
        sourceTableId: fromTable.id,
        availableTaskIds: fromTable.tasks?.map((t: any) => t.id) || []
      });
      throw new Error(`Task not found: ${taskId}`);
    }
    tasksToMove.push(fromTable.tasks.splice(index, 1)[0]);
  }
  
  console.log('📦 Move: Moving tasks', {
    tasksCount: tasksToMove.length,
    taskTitles: tasksToMove.map((t: any) => t.title)
  });

  // Add to target
  toTable.tasks.push(...tasksToMove);
  
  console.log('✅ Move: Successfully moved tasks', {
    fromTableId: fromTable.id,
    toTableId: toTable.id,
    movedTasksCount: tasksToMove.length,
    targetTableTasksCount: toTable.tasks.length
  });
}

function applyUpdateTask(workspace: any, change: AIChange) {
  const table = workspace.tables.find((t: any) => t.id === change.table_id);
  if (!table) throw new Error(`Table not found: ${change.table_id}`);

  const task = table.tasks.find((t: any) => t.id === change.task_id);
  if (!task) throw new Error(`Task not found: ${change.task_id}`);

  // Apply updates
  Object.assign(task, change.updates);
}

function applyCreateTask(workspace: any, change: AIChange) {
  const table = workspace.tables.find((t: any) => t.id === change.table_id);
  if (!table) throw new Error(`Table not found: ${change.table_id}`);

  // Insert at position
  const position = change.position || 'end';
  if (position === 'end') {
    table.tasks.push(change.task);
  } else if (position === 'start') {
    table.tasks.unshift(change.task);
  } else if (typeof position === 'number') {
    table.tasks.splice(position, 0, change.task);
  } else {
    throw new Error(`Invalid position: ${position}`);
  }
}

function applyDeleteTask(workspace: any, change: AIChange) {
  const table = workspace.tables.find((t: any) => t.id === change.table_id);
  if (!table) throw new Error(`Table not found: ${change.table_id}`);

  const index = table.tasks.findIndex((t: any) => t.id === change.task_id);
  if (index === -1) throw new Error(`Task not found: ${change.task_id}`);

  table.tasks.splice(index, 1);
}

function applyCreateTable(workspace: any, change: AIChange) {
  console.log('🎯 Table: applyCreateTable called', {
    changeTable: change.table ? JSON.stringify(change.table, null, 2) : 'null/undefined',
    workspaceTablesExists: !!workspace.tables,
    workspaceTablesLength: workspace.tables?.length || 0
  });
  
  if (!workspace.tables) workspace.tables = [];
  
  // Validate required fields
  if (!change.table) {
    console.error('❌ Table: change.table is missing');
    throw new Error('create_table requires table object');
  }
  
  console.log('🎯 Table: Validating table structure', {
    hasId: !!change.table.id,
    hasType: !!change.table.type,
    hasTitle: !!change.table.title,
    hasTasks: !!change.table.tasks,
    tasksIsArray: Array.isArray(change.table.tasks),
    hasPosition: !!change.table.position,
    positionType: typeof change.table.position,
    positionValue: change.table.position
  });
  
  if (!change.table.id) {
    console.error('❌ Table: table.id is missing');
    throw new Error('create_table: table must have id');
  }
  if (!change.table.type) {
    console.error('❌ Table: table.type is missing');
    throw new Error('create_table: table must have type');
  }
  if (!change.table.title) {
    console.error('❌ Table: table.title is missing');
    throw new Error('create_table: table must have title');
  }
  
  // Ensure tasks array exists (default to empty array)
  if (!change.table.tasks || !Array.isArray(change.table.tasks)) {
    console.log('🎯 Table: Setting default tasks array (was missing or not array)');
    change.table.tasks = [];
  }
  
  // Ensure position exists with default coordinates
  // Calculate default position based on existing tables count (similar to addTable logic)
  const tablesCount = workspace.tables.length;
  if (!change.table.position || typeof change.table.position !== 'object' || change.table.position === null) {
    console.log('🎯 Table: Setting default position (was missing or not object)', {
      tablesCount,
      defaultPosition: { x: 20 + tablesCount * 100, y: 20 + tablesCount * 50 }
    });
    change.table.position = {
      x: 20 + tablesCount * 100,
      y: 20 + tablesCount * 50
    };
  } else if (!change.table.position.x || !change.table.position.y) {
    // If position object exists but is incomplete, fill in defaults
    console.log('🎯 Table: Completing incomplete position object', {
      existingPosition: change.table.position,
      tablesCount,
      defaultPosition: {
        x: change.table.position.x ?? (20 + tablesCount * 100),
        y: change.table.position.y ?? (20 + tablesCount * 50)
      }
    });
    change.table.position = {
      x: change.table.position.x ?? (20 + tablesCount * 100),
      y: change.table.position.y ?? (20 + tablesCount * 50)
    };
  }
  
  // Validate final table structure before pushing
  const finalTable = {
    id: change.table.id,
    type: change.table.type,
    title: change.table.title,
    date: change.table.date,
    startTime: change.table.startTime,
    spaceId: change.table.spaceId,
    tasks: change.table.tasks,
    position: change.table.position,
    size: change.table.size
  };
  
  console.log('🎯 Table: Final table structure before push', {
    table: JSON.stringify(finalTable, null, 2),
    hasPosition: !!finalTable.position,
    positionType: typeof finalTable.position,
    positionX: finalTable.position?.x,
    positionY: finalTable.position?.y,
    hasTasks: !!finalTable.tasks,
    tasksIsArray: Array.isArray(finalTable.tasks),
    tasksLength: finalTable.tasks?.length || 0
  });
  
  workspace.tables.push(finalTable);
  
  console.log('✅ Table: Successfully pushed table to workspace', {
    workspaceTablesLength: workspace.tables.length,
    lastTable: JSON.stringify(workspace.tables[workspace.tables.length - 1], null, 2)
  });
}

function applyUpdateTable(workspace: any, change: AIChange) {
  const table = workspace.tables.find((t: any) => t.id === change.table_id);
  if (!table) throw new Error(`Table not found: ${change.table_id}`);

  Object.assign(table, change.updates);
}

function applyReorderTasks(workspace: any, change: AIChange) {
  const table = workspace.tables.find((t: any) => t.id === change.table_id);
  if (!table) throw new Error(`Table not found: ${change.table_id}`);

  // Validate all task IDs exist
  const existingIds = new Set(table.tasks.map((t: any) => t.id));
  for (const id of change.task_ids) {
    if (!existingIds.has(id)) {
      throw new Error(`Task not found for reorder: ${id}`);
    }
  }

  // Reorder
  const taskMap = new Map(table.tasks.map((t: any) => [t.id, t]));
  table.tasks = change.task_ids.map((id: string) => taskMap.get(id));
}

/**
 * Create snapshot of workspace for undo
 */
export function createWorkspaceSnapshot(workspace: any): string {
  return JSON.stringify(workspace);
}

/**
 * Restore workspace from snapshot
 */
export function restoreWorkspaceSnapshot(snapshot: string): any {
  return JSON.parse(snapshot);
}

/**
 * Generate diff between two workspace states
 */
export function generateWorkspaceDiff(before: any, after: any): {
  added: any[];
  removed: any[];
  modified: any[];
} {
  const diff = {
    added: [] as any[],
    removed: [] as any[],
    modified: [] as any[]
  };

  // Simple diff for tables
  const beforeTables = new Map((before.tables || []).map((t: any) => [t.id, t]));
  const afterTables = new Map((after.tables || []).map((t: any) => [t.id, t]));

  // Find added tables
  for (const [id, table] of afterTables) {
    if (!beforeTables.has(id)) {
      diff.added.push({ type: 'table', id, data: table });
    }
  }

  // Find removed tables
  for (const [id, table] of beforeTables) {
    if (!afterTables.has(id)) {
      diff.removed.push({ type: 'table', id, data: table });
    }
  }

  // Find modified tables
  for (const [id, afterTable] of afterTables) {
    const beforeTable = beforeTables.get(id);
    if (beforeTable && JSON.stringify(beforeTable) !== JSON.stringify(afterTable)) {
      diff.modified.push({
        type: 'table',
        id,
        before: beforeTable,
        after: afterTable
      });
    }
  }

  return diff;
}
