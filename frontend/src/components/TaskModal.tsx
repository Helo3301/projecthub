import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Trash2, Calendar, Clock, Users, Bot, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, UserBrief, TaskPriority, TaskStatus, CreateTaskInput, UpdateTaskInput, Agent } from '@/types';
import { tasks as tasksApi } from '@/lib/api';
import { ColorPicker } from './ColorPicker';
import PluteusPanel from './PluteusPanel';
import { ReminderModal } from './ReminderModal';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: CreateTaskInput | UpdateTaskInput) => void;
  onDelete?: () => void;
  task?: Task | null;
  projectId: number;
  users: UserBrief[];
  agents?: Agent[];
  initialStatus?: TaskStatus;
  isSaving?: boolean;
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  { value: 'urgent', label: 'Urgent', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
];


export function TaskModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  task,
  projectId,
  users,
  agents = [],
  initialStatus,
  isSaving = false,
}: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');
  const [color, setColor] = useState<string>('');
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [agentId, setAgentId] = useState<number | null>(null);
  const [subtasks, setSubtasks] = useState<{ clientKey: string; id?: number; title: string; completed: boolean }[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const confirmDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reminders query and mutations
  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders', task?.id],
    queryFn: () => tasksApi.getReminders(task!.id),
    enabled: !!task?.id && isOpen,
  });

  const createReminderMutation = useMutation({
    mutationFn: ({ remind_at, message }: { remind_at: string; message?: string }) =>
      tasksApi.createReminder(task!.id, remind_at, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', task?.id] });
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: (reminderId: number) => tasksApi.deleteReminder(reminderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', task?.id] });
    },
  });

  // Focus trap + Escape key + restore focus on close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        const titleInput = modalRef.current?.querySelector<HTMLElement>('[data-testid="task-title-input"]');
        titleInput?.focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Clean up confirmDelete timer on unmount
  useEffect(() => {
    return () => {
      if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
    };
  }, []);

  // Clear confirmDelete auto-reset timer when delete mutation fires
  useEffect(() => {
    if (isSaving && confirmDeleteTimerRef.current) {
      clearTimeout(confirmDeleteTimerRef.current);
      confirmDeleteTimerRef.current = null;
    }
  }, [isSaving]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (reminderModalOpen) return;
    if (e.key === 'Escape') {
      if (!isSaving) onClose();
      return;
    }
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [onClose, isSaving, reminderModalOpen]);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setStatus(initialStatus || 'todo');
    setPriority('medium');
    setDueDate('');
    setStartDate('');
    setEstimatedHours('');
    setColor('');
    setAssigneeIds([]);
    setAgentId(null);
    setSubtasks([]);
    setNewSubtask('');
    setReminderModalOpen(false);
  }, [initialStatus]);

  useEffect(() => {
    setConfirmDelete(false);
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.due_date ? format(new Date(task.due_date.includes('T') ? task.due_date : task.due_date + 'T00:00:00'), 'yyyy-MM-dd') : '');
      setStartDate(task.start_date ? format(new Date(task.start_date.includes('T') ? task.start_date : task.start_date + 'T00:00:00'), 'yyyy-MM-dd') : '');
      setEstimatedHours(task.estimated_hours || '');
      setColor(task.color || '');
      setAssigneeIds(task.assignees.map((a) => a.id));
      setAgentId(task.agent_id || null);
      setSubtasks(
        task.subtasks?.map((s) => ({ clientKey: String(s.id), id: s.id, title: s.title, completed: s.status === 'done' })) || []
      );
    } else {
      resetForm();
    }
  }, [task, isOpen, resetForm]);

  const dateWarning = startDate && dueDate && startDate > dueDate
    ? 'Start date is after due date'
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const taskData = {
      title: title.trim(),
      description: description || undefined,
      status,
      priority,
      project_id: projectId,
      due_date: dueDate ? `${dueDate}T00:00:00Z` : undefined,
      start_date: startDate ? `${startDate}T00:00:00Z` : undefined,
      estimated_hours: estimatedHours || undefined,
      color: color || undefined,
      assignee_ids: assigneeIds,
      agent_id: agentId,
      subtasks: subtasks.map((s) => ({
        id: s.id,
        title: s.title,
        completed: s.completed,
      })),
    };

    onSave(taskData);
  };

  const addSubtask = () => {
    if (newSubtask.trim()) {
      setSubtasks([...subtasks, { clientKey: crypto.randomUUID(), title: newSubtask.trim(), completed: false }]);
      setNewSubtask('');
    }
  };

  const removeSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const toggleSubtask = (index: number) => {
    setSubtasks(
      subtasks.map((s, i) => (i === index ? { ...s, completed: !s.completed } : s))
    );
  };

  const toggleAssignee = (userId: number) => {
    setAssigneeIds(
      assigneeIds.includes(userId)
        ? assigneeIds.filter((id) => id !== userId)
        : [...assigneeIds, userId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="task-modal" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={!isSaving ? onClose : undefined} />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="task-modal-title" className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {task ? 'Edit Task' : 'Create Task'}
          </h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close dialog"
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <form id="task-form" onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Title */}
          <div>
            <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter task title"
              required
              data-testid="task-title-input"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="task-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              placeholder="Enter task description"
              data-testid="task-description-input"
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                data-testid="task-status-select"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="task-priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                data-testid="task-priority-select"
              >
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-start-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Calendar size={14} className="inline mr-1" aria-hidden="true" />
                Start Date
              </label>
              <input
                id="task-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                data-testid="task-start-date"
              />
            </div>
            <div>
              <label htmlFor="task-due-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Calendar size={14} className="inline mr-1" aria-hidden="true" />
                Due Date
              </label>
              <input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                data-testid="task-due-date"
              />
            </div>
          </div>

          {dateWarning && (
            <p role="alert" className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Calendar size={14} aria-hidden="true" />
              {dateWarning}
            </p>
          )}

          {/* Estimated Hours */}
          <div>
            <label htmlFor="task-hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Clock size={14} className="inline mr-1" aria-hidden="true" />
              Estimated Hours
            </label>
            <input
              id="task-hours"
              type="number"
              min="0"
              step="0.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value ? parseFloat(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="0"
              data-testid="task-hours-input"
            />
          </div>

          {/* Color */}
          <ColorPicker
            value={color || undefined}
            onChange={(c) => setColor(c || '')}
          />

          {/* Assignees */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Users size={14} className="inline mr-1" aria-hidden="true" />
              Assignees
            </label>
            <div className="flex flex-wrap gap-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleAssignee(user.id)}
                  aria-pressed={assigneeIds.includes(user.id)}
                  aria-label={`${assigneeIds.includes(user.id) ? 'Remove' : 'Assign'} ${user.full_name || user.username}`}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                    assigneeIds.includes(user.id)
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 border-2 border-primary-300 dark:border-primary-700'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  data-testid={`assignee-${user.id}`}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white"
                    style={{ backgroundColor: user.avatar_color || '#4F46E5' }}
                  >
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span>{user.full_name || user.username}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Agent Assignment */}
          {(agents.length > 0 || agentId !== null) && (
            <div>
              <label htmlFor="task-agent-select-field" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Bot size={14} className="inline mr-1" aria-hidden="true" />
                Agent Assignment
              </label>
              <select
                id="task-agent-select-field"
                value={agentId ?? ''}
                onChange={(e) => setAgentId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                data-testid="task-agent-select"
              >
                <option value="">No agent assigned</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.agent_type}) — {agent.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Subtasks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Subtasks
            </label>
            <div className="space-y-2">
              {subtasks.map((subtask, index) => (
                <div
                  key={subtask.clientKey}
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  data-testid={`subtask-${index}`}
                >
                  <input
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={() => toggleSubtask(index)}
                    aria-label={`Toggle subtask: ${subtask.title}`}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className={subtask.completed ? 'line-through text-gray-400' : ''}>
                    {subtask.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSubtask(index)}
                    aria-label={`Remove subtask: ${subtask.title}`}
                    className="ml-auto p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Add a subtask"
                  data-testid="new-subtask-input"
                />
                <button
                  type="button"
                  onClick={addSubtask}
                  aria-label="Add subtask"
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500"
                  data-testid="add-subtask-btn"
                >
                  <Plus size={20} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Pluteus decisions panel — only shown for existing tasks */}
        {task && (
          <div className="px-4">
            <PluteusPanel
              correlationId={task.correlation_id}
              taskTitle={task.title}
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
          {task && (
            <button
              type="button"
              onClick={() => setReminderModalOpen(true)}
              aria-label={reminders.length > 0 ? `Manage reminders (${reminders.length} set)` : 'Manage reminders'}
              className="relative flex items-center gap-1.5 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
              data-testid="reminder-btn"
            >
              <Bell size={18} aria-hidden="true" />
              <span className="text-sm">Reminders</span>
              {reminders.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center" aria-hidden="true">
                  {reminders.length > 9 ? '9+' : reminders.length}
                </span>
              )}
            </button>
          )}
          {task && onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  data-testid="confirm-delete-btn"
                  aria-label={`Confirm delete task: ${title}`}
                >
                  <Trash2 size={18} aria-hidden="true" />
                  {isSaving ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmDeleteTimerRef.current) {
                      clearTimeout(confirmDeleteTimerRef.current);
                      confirmDeleteTimerRef.current = null;
                    }
                    setConfirmDelete(false);
                  }}
                  aria-label="Cancel delete"
                  className="px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(true);
                  if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
                  confirmDeleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 5000);
                }}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                data-testid="delete-task-btn"
                aria-label={`Delete task: ${title}`}
              >
                <Trash2 size={18} aria-hidden="true" />
                Delete
              </button>
            )
          ) : (
            <div />
          )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="task-form"
              disabled={isSaving}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
              data-testid="save-task-btn"
            >
              {isSaving ? 'Saving...' : (task ? 'Update' : 'Create')}
            </button>
          </div>
        </div>
      </div>

      {/* Reminder Modal */}
      {task && (
        <ReminderModal
          isOpen={reminderModalOpen}
          onClose={() => setReminderModalOpen(false)}
          onAdd={(remind_at, message) => createReminderMutation.mutate({ remind_at, message })}
          onDelete={(reminderId) => deleteReminderMutation.mutate(reminderId)}
          task={task}
          reminders={reminders}
        />
      )}
    </div>
  );
}
