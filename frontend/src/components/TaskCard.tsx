import { useState } from 'react';
import { Calendar, Clock, CheckSquare, MoreHorizontal, User } from 'lucide-react';
import { format } from 'date-fns';
import type { Task, TaskPriority } from '@/types';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  onStatusChange?: (status: string) => void;
  isDragging?: boolean;
}

const priorityColors: Record<TaskPriority, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
  urgent: 'bg-purple-100 text-purple-800',
};

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const hasSubtasks = task.subtask_count > 0;
  const subtaskProgress = hasSubtasks
    ? Math.round((task.subtask_completed / task.subtask_count) * 100)
    : 0;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 cursor-pointer
        hover:shadow-md transition-shadow ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
      style={task.color ? { borderLeftColor: task.color, borderLeftWidth: 4 } : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-gray-900 line-clamp-2">{task.title}</h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{task.description}</p>
      )}

      {/* Subtasks Progress */}
      {hasSubtasks && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="flex items-center gap-1">
              <CheckSquare size={12} />
              {task.subtask_completed}/{task.subtask_count}
            </span>
            <span>{subtaskProgress}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${subtaskProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[task.priority]}`}>
          {priorityLabels[task.priority]}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Due Date */}
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {task.due_date && (
            <span className="flex items-center gap-1">
              <Calendar size={14} />
              {format(new Date(task.due_date), 'MMM d')}
            </span>
          )}
          {task.estimated_hours && (
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {task.estimated_hours}h
            </span>
          )}
        </div>

        {/* Assignees */}
        <div className="flex -space-x-2">
          {task.assignees.slice(0, 3).map((user) => (
            <div
              key={user.id}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white border-2 border-white"
              style={{ backgroundColor: user.avatar_color }}
              title={user.full_name || user.username}
            >
              {(user.full_name || user.username).slice(0, 2).toUpperCase()}
            </div>
          ))}
          {task.assignees.length > 3 && (
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium bg-gray-200 text-gray-600 border-2 border-white">
              +{task.assignees.length - 3}
            </div>
          )}
          {task.assignees.length === 0 && (
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 text-gray-400">
              <User size={14} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
