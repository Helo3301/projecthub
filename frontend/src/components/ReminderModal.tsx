import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Bell, Trash2, Plus, Clock } from 'lucide-react';
import { format, addDays, addHours } from 'date-fns';
import type { Reminder, Task } from '@/types';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (remind_at: string, message?: string) => void;
  onDelete: (reminderId: number) => void;
  task: Task;
  reminders: Reminder[];
}

const quickOptions = [
  { label: 'In 1 hour', getValue: () => addHours(new Date(), 1) },
  { label: 'In 3 hours', getValue: () => addHours(new Date(), 3) },
  { label: 'Tomorrow', getValue: () => addDays(new Date(), 1) },
  { label: 'In 3 days', getValue: () => addDays(new Date(), 3) },
  { label: 'In 1 week', getValue: () => addDays(new Date(), 7) },
];

export function ReminderModal({
  isOpen,
  onClose,
  onAdd,
  onDelete,
  task,
  reminders,
}: ReminderModalProps) {
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [message, setMessage] = useState('');
  const [dateError, setDateError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCustomDate('');
      setCustomTime('');
      setDateError('');
      setMessage('');
      // Move focus to the first interactive element inside the dialog
      requestAnimationFrame(() => {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.[0]?.focus();
      });
    }
  }, [isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
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
  }, [onClose]);

  const handleQuickAdd = (getValue: () => Date) => {
    const date = getValue();
    onAdd(date.toISOString(), message || undefined);
  };

  const handleCustomAdd = () => {
    if (customDate && customTime) {
      const dateTime = new Date(`${customDate}T${customTime}`);
      if (dateTime <= new Date()) {
        setDateError('Reminder must be in the future');
        return;
      }
      setDateError('');
      onAdd(dateTime.toISOString(), message || undefined);
      setCustomDate('');
      setCustomTime('');
      setMessage('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="reminder-modal" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="reminder-modal-title" tabIndex={-1} className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md outline-none">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-primary-500" aria-hidden="true" />
            <h2 id="reminder-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">Reminders</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Task Info */}
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="font-medium text-gray-900 dark:text-gray-100">{task.title}</p>
            {task.due_date && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Due: {format(new Date(task.due_date.includes('T') ? task.due_date : task.due_date + 'T00:00:00'), 'MMM d, yyyy')}
              </p>
            )}
          </div>

          {/* Existing Reminders */}
          {reminders.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Scheduled Reminders</h3>
              <div className="space-y-2">
                {reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    data-testid={`reminder-${reminder.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-gray-400" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {format(new Date(reminder.remind_at), 'MMM d, yyyy h:mm a')}
                        </p>
                        {reminder.message && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{reminder.message}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onDelete(reminder.id)}
                      aria-label={`Delete reminder for ${format(new Date(reminder.remind_at), 'MMM d, yyyy h:mm a')}`}
                      className="p-1 text-gray-400 hover:text-red-500"
                      data-testid={`delete-reminder-${reminder.id}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Add */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Add</h3>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Quick reminder options">
              {quickOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={() => handleQuickAdd(option.getValue)}
                  className="px-3 py-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg text-sm hover:bg-primary-100 dark:hover:bg-primary-900/50"
                  data-testid={`quick-${option.label.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date/Time */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Custom Date & Time</h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                aria-label="Reminder date"
                aria-describedby={dateError ? 'reminder-date-error' : undefined}
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500"
                data-testid="custom-date"
              />
              <input
                type="time"
                aria-label="Reminder time"
                aria-describedby={dateError ? 'reminder-date-error' : undefined}
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500"
                data-testid="custom-time"
              />
            </div>
            {dateError && (
              <p id="reminder-date-error" role="alert" className="text-xs text-red-500 mt-1">{dateError}</p>
            )}
          </div>

          {/* Message */}
          <div>
            <label htmlFor="reminder-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Message (optional)
            </label>
            <input
              id="reminder-message"
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a note for this reminder"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500"
              data-testid="reminder-message"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            Close
          </button>
          <button
            onClick={handleCustomAdd}
            disabled={!customDate || !customTime}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="add-reminder-btn"
          >
            <Plus size={18} aria-hidden="true" />
            Add Reminder
          </button>
        </div>
      </div>
    </div>
  );
}
