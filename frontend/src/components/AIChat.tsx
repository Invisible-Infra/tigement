import { useState, useRef, useEffect } from 'react';
import { aiConfigManager } from '../utils/aiConfig';
import { processAIRequest, AIRequest, extractRelevantContext, detectQueryIntent } from '../utils/aiAssistant';
import { validateAIResult, sanitizeAIResult, AIValidationError, AIProviderError, retryWithBackoff } from '../utils/aiValidation';
import { applyAIChanges, generateWorkspaceDiff, restoreWorkspaceSnapshot } from '../utils/applyChanges';

interface AIChatProps {
  workspace: any;
  onWorkspaceUpdate: (workspace: any) => void;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  result?: any;
  error?: string;
}

/**
 * Format a single change into a human-readable preview string
 */
function formatChangePreview(change: any, workspace: any): string {
  switch (change.action) {
    case 'move_tasks': {
      const fromTable = workspace.tables?.find((t: any) => t.id === change.from_table_id);
      const toTable = workspace.tables?.find((t: any) => t.id === change.to_table_id);
      
      // Try to find by date if table not found by ID
      let toTableTitle = change.to_table_id;
      if (!toTable) {
        const dateMatch = change.to_table_id.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          const date = new Date(dateMatch[1]);
          toTableTitle = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
      } else {
        toTableTitle = toTable.title || toTable.date || change.to_table_id;
      }
      
      const fromTableTitle = fromTable?.title || fromTable?.date || change.from_table_id;
      const taskTitles: string[] = [];
      
      if (fromTable && Array.isArray(change.task_ids)) {
        for (const taskId of change.task_ids) {
          const task = fromTable.tasks?.find((t: any) => t.id === taskId);
          if (task) {
            taskTitles.push(task.title || '(untitled)');
          } else {
            taskTitles.push(taskId);
          }
        }
      }
      
      if (taskTitles.length === 0) {
        return `Move ${change.task_ids?.length || 0} tasks from '${fromTableTitle}' to '${toTableTitle}'`;
      } else if (taskTitles.length <= 3) {
        return `Move ${taskTitles.map(t => `'${t}'`).join(', ')} from '${fromTableTitle}' to '${toTableTitle}'`;
      } else {
        return `Move ${taskTitles.slice(0, 2).map(t => `'${t}'`).join(', ')}, and ${taskTitles.length - 2} more from '${fromTableTitle}' to '${toTableTitle}'`;
      }
    }
    
    case 'create_task': {
      const table = workspace.tables?.find((t: any) => t.id === change.table_id);
      const tableTitle = table?.title || table?.date || change.table_id;
      const taskTitle = change.task?.title || '(untitled)';
      const duration = change.task?.duration ? `${change.task.duration} min` : '';
      return `Add '${taskTitle}'${duration ? ` (${duration})` : ''} to '${tableTitle}'`;
    }
    
    case 'update_task': {
      const table = workspace.tables?.find((t: any) => t.id === change.table_id);
      const task = table?.tasks?.find((t: any) => t.id === change.task_id);
      const taskTitle = task?.title || change.task_id;
      const updates = change.updates || {};
      const updateParts: string[] = [];
      
      if (updates.title !== undefined) {
        updateParts.push(`title: '${task?.title || '(old)'}' → '${updates.title}'`);
      }
      if (updates.duration !== undefined) {
        updateParts.push(`duration: ${task?.duration || '?'} → ${updates.duration} min`);
      }
      if (updates.group !== undefined) {
        updateParts.push(`group: ${task?.group || 'none'} → ${updates.group}`);
      }
      if (updates.selected !== undefined) {
        updateParts.push(`selected: ${task?.selected ? 'yes' : 'no'} → ${updates.selected ? 'yes' : 'no'}`);
      }
      
      if (updateParts.length === 0) {
        return `Update '${taskTitle}' in '${table?.title || change.table_id}'`;
      }
      return `Update '${taskTitle}': ${updateParts.join(', ')}`;
    }
    
    case 'delete_task': {
      const table = workspace.tables?.find((t: any) => t.id === change.table_id);
      const task = table?.tasks?.find((t: any) => t.id === change.task_id);
      const taskTitle = task?.title || change.task_id;
      const tableTitle = table?.title || table?.date || change.table_id;
      return `Delete '${taskTitle}' from '${tableTitle}'`;
    }
    
    case 'create_table': {
      const tableType = change.table?.type || 'table';
      const tableTitle = change.table?.title || change.table?.date || '(new table)';
      return `Create ${tableType} table '${tableTitle}'`;
    }
    
    case 'update_table': {
      const table = workspace.tables?.find((t: any) => t.id === change.table_id);
      const tableTitle = table?.title || table?.date || change.table_id;
      const updates = change.updates || {};
      const updateParts: string[] = [];
      
      if (updates.title !== undefined) {
        updateParts.push(`title: '${table?.title || '(old)'}' → '${updates.title}'`);
      }
      if (updates.startTime !== undefined) {
        updateParts.push(`start time: ${table?.startTime || '?'} → ${updates.startTime}`);
      }
      if (updates.date !== undefined) {
        updateParts.push(`date: ${table?.date || '?'} → ${updates.date}`);
      }
      
      if (updateParts.length === 0) {
        return `Update table '${tableTitle}'`;
      }
      return `Update '${tableTitle}': ${updateParts.join(', ')}`;
    }
    
    case 'reorder_tasks': {
      const table = workspace.tables?.find((t: any) => t.id === change.table_id);
      const tableTitle = table?.title || table?.date || change.table_id;
      const taskCount = change.task_ids?.length || 0;
      return `Reorder ${taskCount} tasks in '${tableTitle}'`;
    }
    
    default:
      return `${change.action.replace(/_/g, ' ')}`;
  }
}

export function AIChat({ workspace, onWorkspaceUpdate, onClose }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [lastAppliedAction, setLastAppliedAction] = useState<{
    id: string;
    beforeSnapshot: any;
    appliedAt: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConfig = async () => {
    const loaded = await aiConfigManager.loadConfig();
    if (!loaded || !loaded.enabled) {
      alert('Please configure AI assistant first');
      onClose();
      return;
    }
    setConfig(loaded);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !config) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const request: AIRequest = {
        prompt: userMessage.content,
        mode: detectQueryIntent(userMessage.content)
      };

      console.log('🤖 AI: Processing AI request', {
        prompt: userMessage.content,
        workspaceTablesCount: workspace.tables?.length || 0
      });

      const result = await retryWithBackoff(async () => {
        console.log('🤖 AI: Calling processAIRequest');
        const aiResult = await processAIRequest(config, workspace, request);
        console.log('🤖 AI: processAIRequest completed', {
          changesCount: aiResult.changes?.length || 0,
          changes: aiResult.changes?.map((c: any) => ({
            action: c.action,
            ...(c.action === 'create_table' ? {
              tableId: c.table?.id,
              tableType: c.table?.type,
              hasPosition: !!c.table?.position,
              hasTasks: !!c.table?.tasks
            } : {})
          }))
        });
        return aiResult;
      });

      // Validate and sanitize
      console.log('🤖 AI: Validating and sanitizing result');
      validateAIResult(result);
      const sanitized = sanitizeAIResult(result);
      console.log('🤖 AI: Result sanitized', {
        changesCount: sanitized.changes?.length || 0
      });

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: sanitized.summary,
        timestamp: Date.now(),
        result: sanitized
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Auto-apply in automatic mode
      if (config.mode === 'automatic' && sanitized.changes.length > 0) {
        handleApply(sanitized);
      }
    } catch (error: any) {
      let errorMessage = 'An error occurred';
      
      if (error instanceof AIValidationError) {
        errorMessage = `Validation error: ${error.message}`;
      } else if (error instanceof AIProviderError) {
        errorMessage = `${error.provider} error: ${error.message}`;
      } else {
        errorMessage = error.message || errorMessage;
      }

      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: errorMessage,
        timestamp: Date.now(),
        error: errorMessage
      };

      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!lastAppliedAction) return;

    const now = Date.now();
    const undoWindowMs = (config?.undoWindowMinutes || 60) * 60 * 1000;

    if (now - lastAppliedAction.appliedAt > undoWindowMs) {
      alert(`Undo window expired (${config?.undoWindowMinutes || 60} minutes)`);
      setLastAppliedAction(null);
      return;
    }

    if (!confirm('Undo the last AI action and restore previous state?')) {
      return;
    }

    try {
      const restored = restoreWorkspaceSnapshot(JSON.stringify(lastAppliedAction.beforeSnapshot));
      onWorkspaceUpdate(restored);

      // Try to mark action as undone in history, but don't fail if action not found
      // (workspace restoration is the important part)
      try {
        await aiConfigManager.updateAction(lastAppliedAction.id, {
          undoneAt: now
        });
      } catch (updateError: any) {
        // Action might not be in history yet (timing/encryption issues), but undo still succeeded
        console.warn('Could not update action history:', updateError.message);
      }

      setLastAppliedAction(null);

      setMessages(prev => [...prev, {
        id: `undo-${Date.now()}`,
        role: 'assistant',
        content: '✓ Changes undone',
        timestamp: Date.now()
      }]);
    } catch (error: any) {
      alert(`Failed to undo: ${error.message}`);
    }
  };

  const canUndo = (): boolean => {
    if (!lastAppliedAction) return false;
    const now = Date.now();
    const undoWindowMs = (config?.undoWindowMinutes || 60) * 60 * 1000;
    return now - lastAppliedAction.appliedAt <= undoWindowMs;
  };

  const handleApply = async (result: any) => {
    console.log('🤖 AI: handleApply called', {
      changesCount: result.changes?.length || 0,
      changes: result.changes?.map((c: any) => ({
        action: c.action,
        ...(c.action === 'create_table' ? {
          tableId: c.table?.id,
          tableType: c.table?.type,
          tableTitle: c.table?.title,
          hasPosition: !!c.table?.position,
          hasTasks: !!c.table?.tasks
        } : {})
      })),
      workspaceTablesBefore: workspace.tables?.length || 0
    });
    
    try {
      console.log('🤖 AI: Calling applyAIChanges', {
        workspaceTablesCount: workspace.tables?.length || 0,
        changes: JSON.stringify(result.changes, null, 2)
      });
      
      const applyResult = applyAIChanges(workspace, result.changes);

      console.log('🤖 AI: applyAIChanges completed', {
        success: applyResult.success,
        appliedChanges: applyResult.appliedChanges,
        errors: applyResult.errors,
        updatedWorkspaceTablesCount: applyResult.updatedWorkspace?.tables?.length || 0,
        updatedWorkspaceTables: applyResult.updatedWorkspace?.tables?.map((t: any) => ({
          id: t.id,
          type: t.type,
          title: t.title,
          hasPosition: !!t.position,
          positionType: typeof t.position,
          positionX: t.position?.x,
          positionY: t.position?.y,
          hasTasks: !!t.tasks,
          tasksIsArray: Array.isArray(t.tasks),
          tasksLength: t.tasks?.length || 0
        }))
      });

      if (!applyResult.success) {
        console.error('❌ AI: applyAIChanges failed', {
          errors: applyResult.errors
        });
        throw new Error(`Failed to apply changes: ${applyResult.errors.join(', ')}`);
      }

      // Save action to history
      const actionId = `action-${Date.now()}`;
      await aiConfigManager.saveAction({
        id: actionId,
        timestamp: Date.now(),
        requestPrompt: messages[messages.length - 2]?.content || '',
        requestType: 'task-management',
        changesJson: result.changes,
        beforeSnapshot: workspace,
        applied: true,
        appliedAt: Date.now()
      });

      // Store last applied action for undo
      setLastAppliedAction({
        id: actionId,
        beforeSnapshot: workspace,
        appliedAt: Date.now()
      });

      console.log('🤖 AI: Calling onWorkspaceUpdate', {
        updatedWorkspace: {
          tablesCount: applyResult.updatedWorkspace?.tables?.length || 0,
          tables: applyResult.updatedWorkspace?.tables?.map((t: any) => ({
            id: t.id,
            type: t.type,
            title: t.title,
            hasPosition: !!t.position,
            position: t.position,
            hasTasks: !!t.tasks,
            tasksLength: t.tasks?.length || 0
          }))
        }
      });

      // Update workspace
      onWorkspaceUpdate(applyResult.updatedWorkspace);

      console.log('✅ AI: Successfully applied changes and updated workspace');

      // Add success message with undo capability
      setMessages(prev => [...prev, {
        id: `system-${Date.now()}`,
        role: 'assistant',
        content: `✓ Applied ${applyResult.appliedChanges} changes successfully`,
        timestamp: Date.now(),
        result: { applied: true, actionId }
      }]);
    } catch (error: any) {
      console.error('❌ AI: Error in handleApply', {
        error: error.message,
        stack: error.stack,
        errorName: error.name
      });
      
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Failed to apply changes: ${error.message}`,
        timestamp: Date.now(),
        error: error.message
      }]);
    }
  };

  if (!config) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              AI Assistant
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {config.provider} • {config.model} • {config.mode} mode
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
              <div className="text-4xl mb-2">🤖</div>
              <div className="font-medium mb-2">AI Assistant is ready!</div>
              <div className="text-sm space-y-1">
                <div>Try: "Move my Monday tasks to Tuesday"</div>
                <div>Or: "Add 15 minute breaks between meetings"</div>
                <div>Or: "Reschedule incomplete tasks to tomorrow"</div>
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : msg.error
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {msg.result && !msg.error && !msg.result.applied && (
                  <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600 space-y-2">
                    {msg.result.insights && msg.result.changes.length === 0 ? (
                      // Informational response
                      <div className="text-xs">
                        <div className="font-medium mb-2">Analysis:</div>
                        <div className="space-y-2">
                          {msg.result.insights.map((insight: any, i: number) => (
                            <div key={i} className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                              <div className="font-semibold text-blue-900 dark:text-blue-300">
                                {insight.title}
                              </div>
                              <div className="text-blue-800 dark:text-blue-400 text-xs mt-1">
                                {insight.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      // Action response (existing preview code)
                      <div className="text-xs">
                        <div className="font-medium mb-2">Preview of Changes ({msg.result.changes.length}):</div>
                        <ul className="space-y-1.5">
                          {msg.result.changes.map((change: any, i: number) => {
                            const preview = formatChangePreview(change, workspace);
                            return (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-gray-500 dark:text-gray-400 mt-0.5">•</span>
                                <span className="text-gray-700 dark:text-gray-300 flex-1">{preview}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {config.mode === 'preview' && msg.result.changes.length > 0 && (
                      <button
                        onClick={() => handleApply(msg.result)}
                        className="w-full mt-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                      >
                        Apply Changes
                      </button>
                    )}
                  </div>
                )}

                {msg.result?.applied && msg.result.actionId === lastAppliedAction?.id && (
                  <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                    {canUndo() && (
                      <button
                        onClick={handleUndo}
                        className="w-full px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50 text-sm font-medium transition-colors"
                      >
                        ↶ Undo Last Action
                      </button>
                    )}
                    {!canUndo() && lastAppliedAction && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-1">
                        Undo window expired
                      </div>
                    )}
                  </div>
                )}

                <div className="text-xs opacity-50 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <div className="animate-pulse">●</div>
                  <div className="animate-pulse delay-100">●</div>
                  <div className="animate-pulse delay-200">●</div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t dark:border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask AI to modify your schedule..."
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Thinking...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
