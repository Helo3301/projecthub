import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskModal } from './TaskModal';
import type { Task, UserBrief } from '@/types';

const mockUsers: UserBrief[] = [
  { id: 1, username: 'john', full_name: 'John Doe', avatar_color: '#4F46E5' },
  { id: 2, username: 'jane', full_name: 'Jane Smith', avatar_color: '#10B981' },
];

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
  start_date: '2024-12-01T00:00:00Z',
  estimated_hours: 8,
  color: '#EF4444',
  assignees: [mockUsers[0]],
  subtasks: [
    { id: 1, title: 'Subtask 1', status: 'done', priority: 'medium' },
  ],
  dependencies: [],
  subtask_count: 1,
  subtask_completed: 1,
};

describe('TaskModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(
      <TaskModal
        isOpen={false}
        onClose={mockOnClose}
        onSave={mockOnSave}
        projectId={1}
        users={mockUsers}
      />
    );

    expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        projectId={1}
        users={mockUsers}
      />
    );

    expect(screen.getByTestId('task-modal')).toBeInTheDocument();
  });

  it('shows Create Task title when no task provided', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        projectId={1}
        users={mockUsers}
      />
    );

    expect(screen.getByText('Create Task')).toBeInTheDocument();
  });

  it('shows Edit Task title when task is provided', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        task={mockTask}
        projectId={1}
        users={mockUsers}
      />
    );

    expect(screen.getByText('Edit Task')).toBeInTheDocument();
  });

  it('populates form fields when task is provided', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        task={mockTask}
        projectId={1}
        users={mockUsers}
      />
    );

    expect(screen.getByTestId('task-title-input')).toHaveValue('Test Task');
    expect(screen.getByTestId('task-description-input')).toHaveValue('Test description');
    expect(screen.getByTestId('task-status-select')).toHaveValue('todo');
    expect(screen.getByTestId('task-priority-select')).toHaveValue('high');
  });

  it('calls onClose when close button clicked', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        projectId={1}
        users={mockUsers}
      />
    );

    const closeButtons = screen.getAllByRole('button');
    fireEvent.click(closeButtons[0]); // X button

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when Cancel button clicked', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        projectId={1}
        users={mockUsers}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onSave with form data when Create clicked', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        projectId={1}
        users={mockUsers}
      />
    );

    fireEvent.change(screen.getByTestId('task-title-input'), {
      target: { value: 'New Task' },
    });
    fireEvent.click(screen.getByTestId('save-task-btn'));

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Task',
        project_id: 1,
      })
    );
  });

  it('renders all users as assignee options', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        projectId={1}
        users={mockUsers}
      />
    );

    expect(screen.getByTestId('assignee-1')).toBeInTheDocument();
    expect(screen.getByTestId('assignee-2')).toBeInTheDocument();
  });

  it('toggles assignee selection', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        projectId={1}
        users={mockUsers}
      />
    );

    const assigneeBtn = screen.getByTestId('assignee-1');
    fireEvent.click(assigneeBtn);

    // Should now be selected (has primary color class)
    expect(assigneeBtn).toHaveClass('bg-primary-100');
  });

  it('adds subtask when add button clicked', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        projectId={1}
        users={mockUsers}
      />
    );

    fireEvent.change(screen.getByTestId('new-subtask-input'), {
      target: { value: 'New Subtask' },
    });
    fireEvent.click(screen.getByTestId('add-subtask-btn'));

    expect(screen.getByTestId('subtask-0')).toBeInTheDocument();
    expect(screen.getByText('New Subtask')).toBeInTheDocument();
  });

  it('adds subtask on Enter key', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        projectId={1}
        users={mockUsers}
      />
    );

    const input = screen.getByTestId('new-subtask-input');
    fireEvent.change(input, { target: { value: 'Enter Subtask' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('Enter Subtask')).toBeInTheDocument();
  });

  it('renders delete button when task provided and onDelete given', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
        task={mockTask}
        projectId={1}
        users={mockUsers}
      />
    );

    expect(screen.getByTestId('delete-task-btn')).toBeInTheDocument();
  });

  it('calls onDelete when delete button clicked', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
        task={mockTask}
        projectId={1}
        users={mockUsers}
      />
    );

    fireEvent.click(screen.getByTestId('delete-task-btn'));
    expect(mockOnDelete).toHaveBeenCalled();
  });

  it('renders color selection options', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        projectId={1}
        users={mockUsers}
      />
    );

    expect(screen.getByTestId('color-none')).toBeInTheDocument();
    expect(screen.getByTestId('color-#EF4444')).toBeInTheDocument();
  });

  it('selects color when clicked', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        projectId={1}
        users={mockUsers}
      />
    );

    const colorBtn = screen.getByTestId('color-#EF4444');
    fireEvent.click(colorBtn);

    expect(colorBtn).toHaveClass('border-gray-800');
  });

  it('renders all status options', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        projectId={1}
        users={mockUsers}
      />
    );

    const select = screen.getByTestId('task-status-select');
    expect(select.querySelectorAll('option')).toHaveLength(5);
  });

  it('renders all priority options', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        projectId={1}
        users={mockUsers}
      />
    );

    const select = screen.getByTestId('task-priority-select');
    expect(select.querySelectorAll('option')).toHaveLength(4);
  });
});
