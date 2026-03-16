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

  it('does not render description when absent', () => {
    const taskNoDesc = { ...mockTask, description: '' };
    const { container } = render(<TaskCard task={taskNoDesc} />);
    // Only the title text and metadata — no <p> description element
    expect(container.querySelector('p.text-sm.text-gray-500')).not.toBeInTheDocument();
  });

  it('does not render subtask progress when subtask_count is 0', () => {
    const taskNoSubtasks = { ...mockTask, subtask_count: 0, subtask_completed: 0 };
    render(<TaskCard task={taskNoSubtasks} />);
    expect(screen.queryByText(/0\/0/)).not.toBeInTheDocument();
  });

  it('renders unassigned icon when no assignees', () => {
    const taskNoAssignees = { ...mockTask, assignees: [] };
    const { container } = render(<TaskCard task={taskNoAssignees} />);
    // Unassigned shows a User icon instead of avatar circles
    expect(container.querySelector('.bg-gray-100')).toBeInTheDocument();
  });

  it('shows +N overflow for more than 3 assignees', () => {
    const taskManyAssignees = {
      ...mockTask,
      assignees: [
        { id: 1, username: 'alice', full_name: 'Alice', avatar_color: '#EF4444' },
        { id: 2, username: 'bob', full_name: 'Bob', avatar_color: '#3B82F6' },
        { id: 3, username: 'carol', full_name: 'Carol', avatar_color: '#22C55E' },
        { id: 4, username: 'dave', full_name: 'Dave', avatar_color: '#F59E0B' },
        { id: 5, username: 'eve', full_name: 'Eve', avatar_color: '#8B5CF6' },
      ],
    };
    render(<TaskCard task={taskManyAssignees} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
    // Only first 3 shown
    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(screen.getByText('BO')).toBeInTheDocument();
    expect(screen.getByText('CA')).toBeInTheDocument();
    expect(screen.queryByText('DA')).not.toBeInTheDocument();
  });

  it('renders agent badge when task has agent', () => {
    const taskWithAgent = {
      ...mockTask,
      agent: { id: 1, name: 'code-reviewer', agent_type: 'claude_code' as const, status: 'idle' as const, is_alive: true },
    };
    render(<TaskCard task={taskWithAgent} />);
    expect(screen.getByText('code-reviewer')).toBeInTheDocument();
    expect(screen.getByLabelText('Assigned to agent: code-reviewer')).toBeInTheDocument();
  });

  it('triggers onClick on Enter key', () => {
    const onClick = vi.fn();
    render(<TaskCard task={mockTask} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalled();
  });

  it('renders all priority variants', () => {
    for (const [priority, label] of [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['urgent', 'Urgent']] as const) {
      const { unmount } = render(<TaskCard task={{ ...mockTask, priority }} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });
});
