import { Calendar, Clock, CheckSquare, User, Bot } from 'lucide-react';
import { format } from 'date-fns';
import type { Task, TaskPriority } from '@/types';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
  /** When true, suppresses role="button" and tabIndex to avoid nested interactive elements (e.g. inside a drag handle) */
  disableButton?: boolean;
}

const priorityColors: Record<TaskPriority, string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  urgent: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
};

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export function TaskCard({ task, onClick, isDragging, disableButton }: TaskCardProps) {
  const hasSubtasks = task.subtask_count > 0;
  const subtaskProgress = hasSubtasks
    ? Math.round((task.subtask_completed / task.subtask_count) * 100)
    : 0;

  return (
    <div
      role={disableButton ? undefined : 'button'}
      tabIndex={disableButton ? undefined : 0}
      aria-label={disableButton ? undefined : `${task.title}, ${priorityLabels[task.priority]} priority`}
      onClick={onClick}
      onKeyDown={disableButton ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      className={`bg-white dark:bg-gray-800/80 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-600
        ${!disableButton ? 'cursor-pointer hover:shadow-md' : 'cursor-default'} transition-shadow focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
      style={task.color ? { borderLeftColor: task.color, borderLeftWidth: 4 } : undefined}
    >
      {/* Header */}
      <div className="mb-2">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2">{task.title}</h3>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{task.description}</p>
      )}

      {/* Subtasks Progress */}
      {hasSubtasks && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span className="flex items-center gap-1">
              <CheckSquare size={12} aria-hidden="true" />
              {task.subtask_completed}/{task.subtask_count}
            </span>
            <span>{subtaskProgress}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
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
        {task.agent && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" aria-label={`Assigned to agent: ${task.agent.name}`}>
            <Bot size={10} aria-hidden="true" />
            {task.agent.name}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Due Date */}
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          {task.due_date && (
            <span className="flex items-center gap-1">
              <Calendar size={14} aria-hidden="true" />
              {format(new Date(task.due_date.includes('T') ? task.due_date : task.due_date + 'T00:00:00'), 'MMM d')}
            </span>
          )}
          {task.estimated_hours && (
            <span className="flex items-center gap-1">
              <Clock size={14} aria-hidden="true" />
              {task.estimated_hours}h
            </span>
          )}
        </div>

        {/* Assignees */}
        <div className="flex -space-x-2">
          {task.assignees.slice(0, 3).map((user) => (
            <div
              key={user.id}
              role="img"
              aria-label={user.full_name || user.username}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white border-2 border-white dark:border-gray-800"
              style={{ backgroundColor: user.avatar_color || '#4F46E5' }}
            >
              {(user.full_name || user.username).slice(0, 2).toUpperCase()}
            </div>
          ))}
          {task.assignees.length > 3 && (
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 border-2 border-white dark:border-gray-800">
              +{task.assignees.length - 3}
            </div>
          )}
          {task.assignees.length === 0 && (
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-400">
              <User size={14} aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
