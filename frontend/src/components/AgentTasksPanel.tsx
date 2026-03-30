import { useState, useEffect } from 'react';
import { AgentTaskCard } from './AgentTaskCard';
import type { AgentTask } from './AgentTaskCard';

interface AgentTasksPanelProps {
  agentId: string;
  authToken: string;
}

type ColumnKey = 'pending' | 'in_progress' | 'completed';

interface Column {
  key: ColumnKey;
  label: string;
  color: string;
}

const columns: Column[] = [
  { key: 'pending', label: 'Planned', color: 'border-blue-400' },
  { key: 'in_progress', label: 'In Progress', color: 'border-yellow-400' },
  { key: 'completed', label: 'Completed', color: 'border-green-400' },
];

export function AgentTasksPanel({ agentId, authToken }: AgentTasksPanelProps) {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTasks() {
      try {
        const res = await fetch(`/api/agents/${agentId}/tasks`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setTasks(data.tasks ?? []);
          setError(null);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
          setLoading(false);
        }
      }
    }

    fetchTasks();
    const interval = setInterval(fetchTasks, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [agentId, authToken]);

  const grouped: Record<ColumnKey, AgentTask[]> = {
    pending: [],
    in_progress: [],
    completed: [],
  };

  for (const task of tasks) {
    const key = (task.status as ColumnKey) in grouped ? (task.status as ColumnKey) : 'pending';
    grouped[key].push(task);
  }

  if (loading) {
    return (
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Agent Tasks</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((col) => (
            <div key={col.key} className="space-y-3">
              <div className="h-6 bg-gray-200 rounded animate-pulse w-24" />
              <div className="h-24 bg-gray-100 rounded animate-pulse" />
              <div className="h-24 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Agent Tasks</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          Failed to load agent tasks: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Agent Tasks</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => (
          <div key={col.key}>
            <div className={`border-t-4 ${col.color} rounded-t-lg`}>
              <h3 className="text-sm font-semibold text-gray-700 px-2 py-2">
                {col.label}
                <span className="ml-2 text-gray-400 font-normal">
                  ({grouped[col.key].length})
                </span>
              </h3>
            </div>
            <div className="space-y-2 mt-1">
              {grouped[col.key].length > 0 ? (
                grouped[col.key].map((task) => (
                  <AgentTaskCard key={task.task_id} task={task} />
                ))
              ) : (
                <p className="text-xs text-gray-400 py-4 text-center">
                  No {col.label.toLowerCase()} tasks
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
