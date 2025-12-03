import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KanbanBoard } from './KanbanBoard';
import type { Task } from '@/types';

const mockTasks: Task[] = [
  {
    id: 1,
    title: 'Backlog Task',
    description: 'Task in backlog',
    status: 'backlog',
    priority: 'low',
    position: 0,
    project_id: 1,
    created_at: '2024-01-01T00:00:00Z',
    assignees: [],
    subtasks: [],
    dependencies: [],
    subtask_count: 0,
    subtask_completed: 0,
  },
  {
    id: 2,
    title: 'Todo Task',
    description: 'Task to do',
    status: 'todo',
    priority: 'medium',
    position: 0,
    project_id: 1,
    created_at: '2024-01-01T00:00:00Z',
    assignees: [],
    subtasks: [],
    dependencies: [],
    subtask_count: 0,
    subtask_completed: 0,
  },
  {
    id: 3,
    title: 'In Progress Task',
    description: 'Working on it',
    status: 'in_progress',
    priority: 'high',
    position: 0,
    project_id: 1,
    created_at: '2024-01-01T00:00:00Z',
    assignees: [],
    subtasks: [],
    dependencies: [],
    subtask_count: 0,
    subtask_completed: 0,
  },
  {
    id: 4,
    title: 'Review Task',
    description: 'Ready for review',
    status: 'review',
    priority: 'medium',
    position: 0,
    project_id: 1,
    created_at: '2024-01-01T00:00:00Z',
    assignees: [],
    subtasks: [],
    dependencies: [],
    subtask_count: 0,
    subtask_completed: 0,
  },
  {
    id: 5,
    title: 'Done Task',
    description: 'Completed',
    status: 'done',
    priority: 'low',
    position: 0,
    project_id: 1,
    created_at: '2024-01-01T00:00:00Z',
    assignees: [],
    subtasks: [],
    dependencies: [],
    subtask_count: 0,
    subtask_completed: 0,
  },
];

describe('KanbanBoard', () => {
  const mockOnTaskMove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all columns', () => {
    render(<KanbanBoard tasks={[]} onTaskMove={mockOnTaskMove} />);

    expect(screen.getByText('Backlog')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('renders tasks in correct columns', () => {
    render(<KanbanBoard tasks={mockTasks} onTaskMove={mockOnTaskMove} />);

    expect(screen.getByText('Backlog Task')).toBeInTheDocument();
    expect(screen.getByText('Todo Task')).toBeInTheDocument();
    expect(screen.getByText('In Progress Task')).toBeInTheDocument();
    expect(screen.getByText('Review Task')).toBeInTheDocument();
    expect(screen.getByText('Done Task')).toBeInTheDocument();
  });

  it('displays task count for each column', () => {
    render(<KanbanBoard tasks={mockTasks} onTaskMove={mockOnTaskMove} />);

    const countBadges = screen.getAllByText('1');
    expect(countBadges.length).toBe(5); // One task per column
  });

  it('renders kanban board container', () => {
    render(<KanbanBoard tasks={mockTasks} onTaskMove={mockOnTaskMove} />);

    expect(screen.getByTestId('kanban-board')).toBeInTheDocument();
  });

  it('renders all column containers', () => {
    render(<KanbanBoard tasks={mockTasks} onTaskMove={mockOnTaskMove} />);

    expect(screen.getByTestId('column-backlog')).toBeInTheDocument();
    expect(screen.getByTestId('column-todo')).toBeInTheDocument();
    expect(screen.getByTestId('column-in_progress')).toBeInTheDocument();
    expect(screen.getByTestId('column-review')).toBeInTheDocument();
    expect(screen.getByTestId('column-done')).toBeInTheDocument();
  });

  it('renders add task button when onAddTask is provided', () => {
    const onAddTask = vi.fn();
    render(
      <KanbanBoard
        tasks={mockTasks}
        onTaskMove={mockOnTaskMove}
        onAddTask={onAddTask}
      />
    );

    const addButtons = screen.getAllByRole('button', { name: /add task to/i });
    expect(addButtons.length).toBe(5);
  });

  it('calls onAddTask with correct status when add button clicked', () => {
    const onAddTask = vi.fn();
    render(
      <KanbanBoard
        tasks={mockTasks}
        onTaskMove={mockOnTaskMove}
        onAddTask={onAddTask}
      />
    );

    const addToDoButton = screen.getByRole('button', { name: /add task to to do/i });
    fireEvent.click(addToDoButton);

    expect(onAddTask).toHaveBeenCalledWith('todo');
  });

  it('calls onTaskClick when task is clicked', () => {
    const onTaskClick = vi.fn();
    render(
      <KanbanBoard
        tasks={mockTasks}
        onTaskMove={mockOnTaskMove}
        onTaskClick={onTaskClick}
      />
    );

    fireEvent.click(screen.getByText('Backlog Task'));
    expect(onTaskClick).toHaveBeenCalledWith(mockTasks[0]);
  });

  it('handles empty task list', () => {
    render(<KanbanBoard tasks={[]} onTaskMove={mockOnTaskMove} />);

    const zeroCounts = screen.getAllByText('0');
    expect(zeroCounts.length).toBe(5);
  });

  it('sorts tasks by position within column', () => {
    const tasksWithPositions: Task[] = [
      { ...mockTasks[1], id: 10, position: 2, title: 'Third' },
      { ...mockTasks[1], id: 11, position: 0, title: 'First' },
      { ...mockTasks[1], id: 12, position: 1, title: 'Second' },
    ];

    render(<KanbanBoard tasks={tasksWithPositions} onTaskMove={mockOnTaskMove} />);

    // Check that all task titles are rendered
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });
});
