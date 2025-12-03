import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard } from './TaskCard';
import type { Task } from '@/types';

const mockTask: Task = {
  id: 1,
  title: 'Test Task',
  description: 'Test description',
  status: 'todo',
  priority: 'high',
  position: 0,
  project_id: 1,
  created_at: '2024-01-01T00:00:00Z',
  assignees: [
    { id: 1, username: 'john', full_name: 'John Doe', avatar_color: '#4F46E5' },
  ],
  subtasks: [],
  dependencies: [],
  subtask_count: 3,
  subtask_completed: 1,
};

describe('TaskCard', () => {
  it('renders task title', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('renders task description', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('renders priority badge', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders subtask progress', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('renders assignee avatars', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('JO')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<TaskCard task={mockTask} onClick={onClick} />);
    fireEvent.click(screen.getByText('Test Task'));
    expect(onClick).toHaveBeenCalled();
  });

  it('applies dragging styles when isDragging is true', () => {
    const { container } = render(<TaskCard task={mockTask} isDragging />);
    expect(container.firstChild).toHaveClass('opacity-50');
  });

  it('shows due date when present', () => {
    const taskWithDueDate = {
      ...mockTask,
      due_date: '2024-12-15T00:00:00Z',
    };
    render(<TaskCard task={taskWithDueDate} />);
    // Check for the date text - format may vary based on locale
    expect(screen.getByText(/Dec/i)).toBeInTheDocument();
  });

  it('shows estimated hours when present', () => {
    const taskWithHours = {
      ...mockTask,
      estimated_hours: 4,
    };
    render(<TaskCard task={taskWithHours} />);
    expect(screen.getByText('4h')).toBeInTheDocument();
  });

  it('shows custom color border when task has color', () => {
    const taskWithColor = {
      ...mockTask,
      color: '#FF0000',
    };
    const { container } = render(<TaskCard task={taskWithColor} />);
    expect(container.firstChild).toHaveStyle({ borderLeftColor: '#FF0000' });
  });
});
