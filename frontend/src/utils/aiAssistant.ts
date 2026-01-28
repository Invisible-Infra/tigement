/**
 * AI Assistant Utilities
 * Smart context selection, request building, and change application
 */

import { createAIClient, AIConfig, AIMessage } from './aiProviders';
import { TASK_MANAGEMENT_SYSTEM_PROMPT, DATA_ANALYSIS_SYSTEM_PROMPT } from './aiPrompts';

export interface Table {
  id: string;
  type: 'day' | 'todo';
  title: string;
  date?: string;
  startTime?: string;
  spaceId?: string | null;
  tasks: Task[];
}

export interface Task {
  id: string;
  title: string;
  duration: number;
  selected: boolean;
  group?: string;
  notebook?: string;
}

export interface TaskGroup {
  id: string;
  name: string;
  color: string;
}

export interface WorkspaceContext {
  tables: Table[];
  taskGroups: TaskGroup[];
  settings: any;
  currentDate: string;
  userTimezone: string;
}

export interface AIRequest {
  prompt: string;
  mode: 'task-management' | 'analysis';
  contextFilter?: {
    tableIds?: string[];
    dateRange?: { start: string; end: string };
    taskGroups?: string[];
  };
}

export interface AIChange {
  action: string;
  [key: string]: any;
}

export interface AIResult {
  changes: AIChange[];
  summary: string;
  reasoning: string;
  insights?: Array<{
    type: 'pattern' | 'recommendation' | 'statistic' | 'warning';
    title: string;
    description: string;
    data?: any;
  }>;
}

/**
 * Detect if a query is informational (analysis) or action-oriented (task-management)
 */
export function detectQueryIntent(prompt: string): 'task-management' | 'analysis' {
  // Informational keywords
  const infoKeywords = [
    /\b(how many|how much|count|total|list|show|what|which|when|where|tell me|analyze|summary|statistics|stats|pattern|insight)\b/i,
    /\b(questions?|answer|information|data|report)\b/i
  ];
  
  // Action keywords  
  const actionKeywords = [
    /\b(move|create|add|delete|update|change|modify|set|remove|reorder|schedule)\b/i
  ];
  
  // Check for informational patterns
  for (const pattern of infoKeywords) {
    if (pattern.test(prompt)) {
      return 'analysis';
    }
  }
  
  // Check for action patterns
  for (const pattern of actionKeywords) {
    if (pattern.test(prompt)) {
      return 'task-management';
    }
  }
  
  // Default to task-management for ambiguous queries
  return 'task-management';
}

/**
 * Extract relevant context based on user prompt and filter
 */
export function extractRelevantContext(
  fullWorkspace: any,
  request: AIRequest
): WorkspaceContext {
  const { tables = [], taskGroups = [], settings = {} } = fullWorkspace;
  const { contextFilter } = request;

  let filteredTables = tables;

  // Filter by table IDs if specified
  if (contextFilter?.tableIds && contextFilter.tableIds.length > 0) {
    filteredTables = tables.filter((t: Table) => contextFilter.tableIds!.includes(t.id));
  }

  // Filter by date range if specified
  if (contextFilter?.dateRange) {
    const { start, end } = contextFilter.dateRange;
    filteredTables = filteredTables.filter((t: Table) => {
      if (!t.date) return false;
      return t.date >= start && t.date <= end;
    });
  }

  // Filter tasks by groups if specified
  if (contextFilter?.taskGroups && contextFilter.taskGroups.length > 0) {
    filteredTables = filteredTables.map((t: Table) => ({
      ...t,
      tasks: t.tasks.filter((task: Task) =>
        contextFilter.taskGroups!.includes(task.group || '')
      )
    }));
  }

  // Smart detection: if prompt mentions specific dates, auto-filter
  const dateMatch = request.prompt.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)\b/i);
  if (dateMatch && !contextFilter?.dateRange) {
    // This is a simple heuristic - could be enhanced with NLP
    const targetDay = dateMatch[0].toLowerCase();
    filteredTables = autoFilterByDay(tables, targetDay);
  }

  return {
    tables: filteredTables.map((t: Table) => ({
      id: t.id,
      type: t.type,
      title: t.title,
      date: t.date,
      startTime: t.startTime,
      spaceId: t.spaceId,
      tasks: t.tasks
    })),
    taskGroups,
    settings: {
      // Only include relevant settings for AI
      defaultDayStart: settings.defaultDayStart,
      defaultTaskDuration: settings.defaultTaskDuration
    },
    currentDate: new Date().toISOString().split('T')[0],
    userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

/**
 * Auto-filter tables by day name (helper for smart detection)
 */
function autoFilterByDay(tables: Table[], dayName: string): Table[] {
  // Simple implementation - can be enhanced
  if (dayName === 'today') {
    const today = new Date().toISOString().split('T')[0];
    return tables.filter((t: Table) => t.date === today);
  }
  if (dayName === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    return tables.filter((t: Table) => t.date === tomorrowStr);
  }
  // For other days, filter by title containing the day name
  return tables.filter((t: Table) =>
    t.title.toLowerCase().includes(dayName)
  );
}

/**
 * Process AI request and get changes
 */
export async function processAIRequest(
  config: AIConfig,
  workspace: any,
  request: AIRequest
): Promise<AIResult> {
  // Extract relevant context
  const context = extractRelevantContext(workspace, request);

  // Build messages
  const systemPrompt = request.mode === 'task-management'
    ? TASK_MANAGEMENT_SYSTEM_PROMPT
    : DATA_ANALYSIS_SYSTEM_PROMPT;

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Context:\n${JSON.stringify(context, null, 2)}\n\nRequest: ${request.prompt}`
    }
  ];

  // Call AI
  const client = createAIClient(config);
  const response = await client.complete(messages);

  // Parse JSON response
  try {
    const result = JSON.parse(response.content);
    
    if (request.mode === 'analysis') {
      // Validate analysis response
      if (!result.insights || !Array.isArray(result.insights)) {
        throw new Error('Invalid AI response: missing insights array');
      }
      if (!result.summary) {
        throw new Error('Invalid AI response: missing summary');
      }
      // Return analysis result (no changes)
      return {
        changes: [],
        summary: result.summary,
        reasoning: result.summary,
        insights: result.insights
      } as AIResult;
    } else {
      // Validate task-management response (existing logic)
      if (!result.changes || !Array.isArray(result.changes)) {
        throw new Error('Invalid AI response: missing changes array');
      }
      if (!result.summary || !result.reasoning) {
        throw new Error('Invalid AI response: missing summary or reasoning');
      }
      return result as AIResult;
    }
  } catch (error: any) {
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
}

/**
 * Validate AI changes before applying
 */
export function validateAIChanges(changes: AIChange[], workspace: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const tableIds = new Set(workspace.tables?.map((t: Table) => t.id) || []);

  for (const change of changes) {
    switch (change.action) {
      case 'move_tasks':
        if (!tableIds.has(change.from_table_id)) {
          errors.push(`Source table not found: ${change.from_table_id}`);
        }
        if (!tableIds.has(change.to_table_id)) {
          errors.push(`Target table not found: ${change.to_table_id}`);
        }
        if (!Array.isArray(change.task_ids) || change.task_ids.length === 0) {
          errors.push('move_tasks requires non-empty task_ids array');
        }
        break;

      case 'update_task':
        if (!tableIds.has(change.table_id)) {
          errors.push(`Table not found: ${change.table_id}`);
        }
        if (!change.task_id) {
          errors.push('update_task requires task_id');
        }
        if (!change.updates || typeof change.updates !== 'object') {
          errors.push('update_task requires updates object');
        }
        break;

      case 'create_task':
        if (!tableIds.has(change.table_id)) {
          errors.push(`Table not found: ${change.table_id}`);
        }
        if (!change.task || typeof change.task !== 'object') {
          errors.push('create_task requires task object');
        }
        if (change.task && !change.task.id) {
          errors.push('create_task: task must have id');
        }
        break;

      case 'delete_task':
        if (!tableIds.has(change.table_id)) {
          errors.push(`Table not found: ${change.table_id}`);
        }
        if (!change.task_id) {
          errors.push('delete_task requires task_id');
        }
        break;

      case 'create_table':
        if (!change.table || typeof change.table !== 'object') {
          errors.push('create_table requires table object');
        }
        break;

      case 'update_table':
        if (!tableIds.has(change.table_id)) {
          errors.push(`Table not found: ${change.table_id}`);
        }
        if (!change.updates || typeof change.updates !== 'object') {
          errors.push('update_table requires updates object');
        }
        break;

      case 'reorder_tasks':
        if (!tableIds.has(change.table_id)) {
          errors.push(`Table not found: ${change.table_id}`);
        }
        if (!Array.isArray(change.task_ids)) {
          errors.push('reorder_tasks requires task_ids array');
        }
        break;

      default:
        errors.push(`Unknown action type: ${change.action}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate estimated tokens for context (rough estimate)
 */
export function estimateContextTokens(context: WorkspaceContext): number {
  const jsonStr = JSON.stringify(context);
  // Rough estimate: ~4 chars per token
  return Math.ceil(jsonStr.length / 4);
}
