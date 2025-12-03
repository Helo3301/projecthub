import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
import type { Task, UserBrief, TaskPriority, TaskStatus, CreateTaskInput, UpdateTaskInput } from '@/types';
import { ColorPicker } from './ColorPicker';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: CreateTaskInput | UpdateTaskInput) => void;
  onDelete?: () => void;
  task?: Task | null;
  projectId: number;
  users: UserBrief[];
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-800' },
  { value: 'urgent', label: 'Urgent', color: 'bg-purple-100 text-purple-800' },
];


export function TaskModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  task,
  projectId,
  users,
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
  const [subtasks, setSubtasks] = useState<{ title: string; completed: boolean }[]>([]);
  const [newSubtask, setNewSubtask] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd') : '');
      setStartDate(task.start_date ? format(new Date(task.start_date), 'yyyy-MM-dd') : '');
      setEstimatedHours(task.estimated_hours || '');
      setColor(task.color || '');
      setAssigneeIds(task.assignees.map((a) => a.id));
      setSubtasks(
        task.subtasks?.map((s) => ({ title: s.title, completed: s.status === 'done' })) || []
      );
    } else {
      resetForm();
    }
  }, [task, isOpen]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatus('todo');
    setPriority('medium');
    setDueDate('');
    setStartDate('');
    setEstimatedHours('');
    setColor('');
    setAssigneeIds([]);
    setSubtasks([]);
    setNewSubtask('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const taskData = {
      title,
      description: description || undefined,
      status,
      priority,
      project_id: projectId,
      due_date: dueDate || undefined,
      start_date: startDate || undefined,
      estimated_hours: estimatedHours || undefined,
      color: color || undefined,
      assignee_ids: assigneeIds,
    };

    onSave(taskData);
  };

  const addSubtask = () => {
    if (newSubtask.trim()) {
      setSubtasks([...subtasks, { title: newSubtask.trim(), completed: false }]);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="task-modal">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 id="task-modal-title" className="text-xl font-semibold">
            {task ? 'Edit Task' : 'Create Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter task title"
              required
              data-testid="task-title-input"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              placeholder="Enter task description"
              data-testid="task-description-input"
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar size={14} className="inline mr-1" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                data-testid="task-start-date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar size={14} className="inline mr-1" />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                data-testid="task-due-date"
              />
            </div>
          </div>

          {/* Estimated Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock size={14} className="inline mr-1" />
              Estimated Hours
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value ? parseFloat(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Users size={14} className="inline mr-1" />
              Assignees
            </label>
            <div className="flex flex-wrap gap-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleAssignee(user.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                    assigneeIds.includes(user.id)
                      ? 'bg-primary-100 text-primary-800 border-2 border-primary-300'
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                  }`}
                  data-testid={`assignee-${user.id}`}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white"
                    style={{ backgroundColor: user.avatar_color }}
                  >
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span>{user.full_name || user.username}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subtasks
            </label>
            <div className="space-y-2">
              {subtasks.map((subtask, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                  data-testid={`subtask-${index}`}
                >
                  <input
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={() => toggleSubtask(index)}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className={subtask.completed ? 'line-through text-gray-400' : ''}>
                    {subtask.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSubtask(index)}
                    className="ml-auto p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Add a subtask"
                  data-testid="new-subtask-input"
                />
                <button
                  type="button"
                  onClick={addSubtask}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  data-testid="add-subtask-btn"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          {task && onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              data-testid="delete-task-btn"
            >
              <Trash2 size={18} />
              Delete
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              data-testid="save-task-btn"
            >
              {task ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
