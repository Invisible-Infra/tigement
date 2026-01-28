import { useState, useEffect } from 'react';
import { aiConfigManager, AIActionHistory } from '../utils/aiConfig';
import { restoreWorkspaceSnapshot } from '../utils/applyChanges';

interface AIHistoryProps {
  workspace: any;
  onWorkspaceUpdate: (workspace: any) => void;
  onClose: () => void;
}

export function AIHistory({ workspace, onWorkspaceUpdate, onClose }: AIHistoryProps) {
  const [history, setHistory] = useState<AIActionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState<AIActionHistory | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const loaded = await aiConfigManager.loadHistory();
      setHistory(loaded.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async (action: AIActionHistory) => {
    if (!action.applied || action.undoneAt) {
      return;
    }

    const now = Date.now();
    const config = await aiConfigManager.loadConfig();
    const undoWindowMs = (config?.undoWindowMinutes || 60) * 60 * 1000;

    if (now - action.appliedAt! > undoWindowMs) {
      alert(`Undo window expired (${config?.undoWindowMinutes} minutes)`);
      return;
    }

    if (!confirm('Undo this AI action and restore previous state?')) {
      return;
    }

    try {
      const restored = restoreWorkspaceSnapshot(JSON.stringify(action.beforeSnapshot));
      onWorkspaceUpdate(restored);

      await aiConfigManager.updateAction(action.id, {
        undoneAt: now
      });

      await loadHistory();
    } catch (error: any) {
      alert(`Failed to undo: ${error.message}`);
    }
  };

  const canUndo = (action: AIActionHistory): boolean => {
    if (!action.applied || action.undoneAt) return false;

    const now = Date.now();
    const config = history.length > 0 ? 60 : 60; // Default 60 min
    const undoWindowMs = config * 60 * 1000;

    return now - action.appliedAt! <= undoWindowMs;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          Loading history...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              AI Action History
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {history.length} actions
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-2">📜</div>
              <div>No AI actions yet</div>
              <div className="text-sm mt-1">Actions will appear here after using the AI assistant</div>
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {history.map(action => (
                <div
                  key={action.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {action.undoneAt ? (
                          <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 text-xs rounded">
                            Undone
                          </span>
                        ) : action.applied ? (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs rounded">
                            Applied
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                            Not Applied
                          </span>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(action.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <div className="font-medium text-gray-900 dark:text-white mb-1 truncate">
                        {action.requestPrompt}
                      </div>

                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {action.changesJson?.length || 0} changes
                      </div>

                      {selectedAction?.id === action.id && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded text-xs">
                          <div className="font-medium mb-2">Changes:</div>
                          <ul className="space-y-1">
                            {action.changesJson.map((change: any, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-gray-500 dark:text-gray-400">•</span>
                                <span className="text-gray-700 dark:text-gray-300">
                                  {change.action.replace(/_/g, ' ')}
                                  {change.table_id && ` (table: ${change.table_id})`}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setSelectedAction(
                          selectedAction?.id === action.id ? null : action
                        )}
                        className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        {selectedAction?.id === action.id ? 'Hide' : 'Details'}
                      </button>

                      {canUndo(action) && (
                        <button
                          onClick={() => handleUndo(action)}
                          className="px-3 py-1 text-sm bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
                        >
                          Undo
                        </button>
                      )}

                      {action.applied && !canUndo(action) && !action.undoneAt && (
                        <div className="text-xs text-gray-400 text-center">
                          Undo expired
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
          <button
            onClick={async () => {
              if (confirm('Clear all AI action history? This cannot be undone.')) {
                aiConfigManager.clearHistory();
                await loadHistory();
              }
            }}
            disabled={history.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear All
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
