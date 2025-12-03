import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (isOpen) {
      setCustomDate('');
      setCustomTime('');
      setMessage('');
    }
  }, [isOpen]);

  const handleQuickAdd = (getValue: () => Date) => {
    const date = getValue();
    onAdd(date.toISOString(), message || undefined);
  };

  const handleCustomAdd = () => {
    if (customDate && customTime) {
      const dateTime = new Date(`${customDate}T${customTime}`);
      onAdd(dateTime.toISOString(), message || undefined);
      setCustomDate('');
      setCustomTime('');
      setMessage('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="reminder-modal">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-primary-500" />
            <h2 className="text-lg font-semibold">Reminders</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Task Info */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="font-medium">{task.title}</p>
            {task.due_date && (
              <p className="text-sm text-gray-500">
                Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
              </p>
            )}
          </div>

          {/* Existing Reminders */}
          {reminders.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Scheduled Reminders</h3>
              <div className="space-y-2">
                {reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    data-testid={`reminder-${reminder.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">
                          {format(new Date(reminder.remind_at), 'MMM d, yyyy h:mm a')}
                        </p>
                        {reminder.message && (
                          <p className="text-xs text-gray-500">{reminder.message}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onDelete(reminder.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      data-testid={`delete-reminder-${reminder.id}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Add */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Quick Add</h3>
            <div className="flex flex-wrap gap-2">
              {quickOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={() => handleQuickAdd(option.getValue)}
                  className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm hover:bg-primary-100"
                  data-testid={`quick-${option.label.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date/Time */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Custom Date & Time</h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                data-testid="custom-date"
              />
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                data-testid="custom-time"
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message (optional)
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a note for this reminder"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              data-testid="reminder-message"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
          <button
            onClick={handleCustomAdd}
            disabled={!customDate || !customTime}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="add-reminder-btn"
          >
            <Plus size={18} />
            Add Reminder
          </button>
        </div>
      </div>
    </div>
  );
}
