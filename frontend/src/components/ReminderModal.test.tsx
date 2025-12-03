import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReminderModal } from './ReminderModal';
import type { Task, Reminder } from '@/types';

const mockTask: Task = {
  id: 1,
  title: 'Test Task',
  description: 'Test description',
  status: 'todo',
  priority: 'high',
  position: 0,
  project_id: 1,
  created_at: '2024-01-01T00:00:00Z',
  due_date: '2024-12-31T00:00:00Z',
  assignees: [],
  subtasks: [],
  dependencies: [],
  subtask_count: 0,
  subtask_completed: 0,
};

const mockReminders: Reminder[] = [
  {
    id: 1,
    task_id: 1,
    user_id: 1,
    remind_at: '2024-12-15T10:00:00Z',
    message: 'Check progress',
    is_sent: false,
    created_at: '2024-01-01T00:00:00Z',
  },
];

describe('ReminderModal', () => {
  const mockOnClose = vi.fn();
  const mockOnAdd = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(
      <ReminderModal
        isOpen={false}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        onDelete={mockOnDelete}
        task={mockTask}
        reminders={[]}
      />
    );

    expect(screen.queryByTestId('reminder-modal')).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', () => {
    render(
      <ReminderModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        onDelete={mockOnDelete}
        task={mockTask}
        reminders={[]}
      />
    );

    expect(screen.getByTestId('reminder-modal')).toBeInTheDocument();
  });

  it('displays task title', () => {
    render(
      <ReminderModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        onDelete={mockOnDelete}
        task={mockTask}
        reminders={[]}
      />
    );

    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('displays task due date', () => {
    render(
      <ReminderModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        onDelete={mockOnDelete}
        task={mockTask}
        reminders={[]}
      />
    );

    expect(screen.getByText(/Due:/)).toBeInTheDocument();
  });

  it('displays existing reminders', () => {
    render(
      <ReminderModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        onDelete={mockOnDelete}
        task={mockTask}
        reminders={mockReminders}
      />
    );

    expect(screen.getByTestId('reminder-1')).toBeInTheDocument();
    expect(screen.getByText('Check progress')).toBeInTheDocument();
  });

  it('renders quick add buttons', () => {
    render(
      <ReminderModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        onDelete={mockOnDelete}
        task={mockTask}
        reminders={[]}
      />
    );

    expect(screen.getByTestId('quick-in-1-hour')).toBeInTheDocument();
    expect(screen.getByTestId('quick-in-3-hours')).toBeInTheDocument();
    expect(screen.getByTestId('quick-tomorrow')).toBeInTheDocument();
    expect(screen.getByTestId('quick-in-3-days')).toBeInTheDocument();
    expect(screen.getByTestId('quick-in-1-week')).toBeInTheDocument();
  });

  it('calls onAdd when quick add button clicked', () => {
    render(
      <ReminderModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        onDelete={mockOnDelete}
        task={mockTask}
        reminders={[]}
      />
    );

    fireEvent.click(screen.getByTestId('quick-in-1-hour'));
    expect(mockOnAdd).toHaveBeenCalled();
  });

  it('calls onDelete when delete button clicked', () => {
    render(
      <ReminderModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        onDelete={mockOnDelete}
        task={mockTask}
        reminders={mockReminders}
      />
    );

    fireEvent.click(screen.getByTestId('delete-reminder-1'));
    expect(mockOnDelete).toHaveBeenCalledWith(1);
  });

  it('calls onClose when close button clicked', () => {
    render(
      <ReminderModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        onDelete={mockOnDelete}
        task={mockTask}
        reminders={[]}
      />
    );

    fireEvent.click(screen.getByText('Close'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('renders custom date and time inputs', () => {
    render(
      <ReminderModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        onDelete={mockOnDelete}
        task={mockTask}
        reminders={[]}
      />
    );

    expect(screen.getByTestId('custom-date')).toBeInTheDocument();
    expect(screen.getByTestId('custom-time')).toBeInTheDocument();
  });

  it('renders message input', () => {
    render(
      <ReminderModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        onDelete={mockOnDelete}
        task={mockTask}
        reminders={[]}
      />
    );

    expect(screen.getByTestId('reminder-message')).toBeInTheDocument();
  });

  it('add button is disabled without date and time', () => {
    render(
      <ReminderModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        onDelete={mockOnDelete}
        task={mockTask}
        reminders={[]}
      />
    );

    const addButton = screen.getByTestId('add-reminder-btn');
    expect(addButton).toBeDisabled();
  });

  it('add button is enabled with date and time', () => {
    render(
      <ReminderModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        onDelete={mockOnDelete}
        task={mockTask}
        reminders={[]}
      />
    );

    fireEvent.change(screen.getByTestId('custom-date'), {
      target: { value: '2024-12-20' },
    });
    fireEvent.change(screen.getByTestId('custom-time'), {
      target: { value: '10:00' },
    });

    const addButton = screen.getByTestId('add-reminder-btn');
    expect(addButton).not.toBeDisabled();
  });

  it('calls onAdd with custom date and time', () => {
    render(
      <ReminderModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        onDelete={mockOnDelete}
        task={mockTask}
        reminders={[]}
      />
    );

    fireEvent.change(screen.getByTestId('custom-date'), {
      target: { value: '2024-12-20' },
    });
    fireEvent.change(screen.getByTestId('custom-time'), {
      target: { value: '10:00' },
    });
    fireEvent.click(screen.getByTestId('add-reminder-btn'));

    expect(mockOnAdd).toHaveBeenCalled();
  });
});
