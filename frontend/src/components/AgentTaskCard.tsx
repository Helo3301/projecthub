import { ArrowRightLeft } from 'lucide-react';

export interface AgentTask {
  task_id: string;
  subject: string;
  description: string;
  owner: string;
  status: string;
  blocked_by: string[];
  blocks: string[];
  created_at: string;
}

interface AgentTaskCardProps {
  task: AgentTask;
}

const statusBadge: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
};

export function AgentTaskCard({ task }: AgentTaskCardProps) {
  const truncatedDesc =
    task.description && task.description.length > 100
      ? task.description.slice(0, 100) + '...'
      : task.description;

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
      <h4 className="font-semibold text-gray-900 text-sm">{task.subject}</h4>

      {truncatedDesc && (
        <p className="text-xs text-gray-500 mt-1">{truncatedDesc}</p>
      )}

      {task.owner && (
        <p className="text-xs text-gray-400 mt-1">Owner: {task.owner}</p>
      )}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            statusBadge[task.status] || statusBadge.pending
          }`}
        >
          {task.status.replace('_', ' ')}
        </span>

        {task.blocked_by.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <ArrowRightLeft size={12} />
            Blocked by: {task.blocked_by.length} task{task.blocked_by.length > 1 ? 's' : ''}
          </span>
        )}

        {task.blocks.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-orange-600">
            <ArrowRightLeft size={12} />
            Blocks: {task.blocks.length} task{task.blocks.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
