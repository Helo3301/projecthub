import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KanbanPage } from './KanbanPage';

const mockCurrentProject = { id: 1, name: 'Test Project', description: '', color: '#6366F1', icon: 'folder', owner_id: 1, is_archived: false, task_count: 0, completed_count: 0, created_at: '', updated_at: '' };

vi.mock('@/store', () => ({
  useStore: vi.fn(() => ({
    currentProject: mockCurrentProject,
  })),
}));

const mockToast = vi.fn();
vi.mock('@/components/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/api', () => ({
  tasks: {
    list: vi.fn(),
    reorder: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  users: { list: vi.fn() },
  agents: { list: vi.fn() },
}));

import { useStore } from '@/store';
import { tasks, users, agents } from '@/lib/api';

let queryClient: QueryClient;

function makeTask(id: number, overrides: Partial<{
  title: string; status: string; priority: string; position: number;
}> = {}) {
  return {
    id,
    title: overrides.title ?? `Task ${id}`,
    status: overrides.status ?? 'todo',
    priority: overrides.priority ?? 'medium',
    position: overrides.position ?? id,
    project_id: 1,
    created_at: '2026-01-01T00:00:00',
    assignees: [],
    subtasks: [],
    dependencies: [],
    subtask_count: 0,
    subtask_completed: 0,
  };
}

function renderKanban() {
  return render(
    <QueryClientProvider client={queryClient}>
      <KanbanPage />
    </QueryClientProvider>
  );
}

describe('KanbanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ currentProject: mockCurrentProject });
    (tasks.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (tasks.reorder as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (tasks.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 99, title: 'New' });
    (tasks.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (tasks.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (users.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (agents.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  // --- Basic rendering ---
  it('renders kanban board heading', () => {
    renderKanban();
    expect(screen.getByText('Kanban Board')).toBeInTheDocument();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('renders add task button', () => {
    renderKanban();
    expect(screen.getByText('Add Task')).toBeInTheDocument();
  });

  it('has kanban-page test id', () => {
    renderKanban();
    expect(screen.getByTestId('kanban-page')).toBeInTheDocument();
  });

  // --- Empty project state ---
  it('shows empty project state when no project selected', () => {
    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ currentProject: null });
    renderKanban();
    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
    expect(screen.queryByTestId('kanban-page')).not.toBeInTheDocument();
  });

  // --- Columns ---
  it('renders kanban columns', async () => {
    renderKanban();
    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  // --- Task rendering ---
  it('renders tasks in the board', async () => {
    (tasks.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeTask(1, { title: 'Fix bug', status: 'todo' }),
      makeTask(2, { title: 'Write tests', status: 'in_progress' }),
      makeTask(3, { title: 'Deploy', status: 'done' }),
    ]);
    renderKanban();
    await waitFor(() => {
      expect(screen.getByText('Fix bug')).toBeInTheDocument();
      expect(screen.getByText('Write tests')).toBeInTheDocument();
      expect(screen.getByText('Deploy')).toBeInTheDocument();
    });
  });

  // --- Modal interactions ---
  it('opens task modal when Add Task button clicked', async () => {
    renderKanban();
    fireEvent.click(screen.getByText('Add Task'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('opens task modal when a task card is clicked', async () => {
    (tasks.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeTask(1, { title: 'Clickable Task', status: 'todo' }),
    ]);
    renderKanban();
    await waitFor(() => {
      expect(screen.getByText('Clickable Task')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Clickable Task'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // --- Error states ---
  it('shows error state when tasks fail to load', async () => {
    (tasks.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    renderKanban();
    await waitFor(() => {
      expect(screen.getByText('Failed to load tasks')).toBeInTheDocument();
    });
  });

  it('shows retry button on error', async () => {
    (tasks.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    renderKanban();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  // --- Create mutation ---
  it('shows success toast on task create', async () => {
    renderKanban();
    fireEvent.click(screen.getByText('Add Task'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    // Fill and submit
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'New Task' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    await waitFor(() => {
      expect(tasks.create).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Task created successfully.', 'success');
    });
  });

  it('shows error toast on task create failure', async () => {
    (tasks.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    renderKanban();
    fireEvent.click(screen.getByText('Add Task'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Fail Task' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to create task. Please try again.');
    });
  });

  // --- Update mutation (edit existing task) ---
  it('shows success toast on task update', async () => {
    (tasks.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeTask(1, { title: 'Edit Me', status: 'todo' }),
    ]);
    renderKanban();
    await waitFor(() => {
      expect(screen.getByText('Edit Me')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Edit Me'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    await waitFor(() => {
      expect(tasks.update).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Task updated successfully.', 'success');
    });
  });

  it('shows error toast on task update failure', async () => {
    (tasks.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (tasks.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeTask(1, { title: 'Fail Edit', status: 'todo' }),
    ]);
    renderKanban();
    await waitFor(() => {
      expect(screen.getByText('Fail Edit')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Fail Edit'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Changed' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to update task. Please try again.');
    });
  });

  // --- Loading state ---
  it('shows loading state while tasks are pending', () => {
    (tasks.list as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderKanban();
    // The KanbanBoard component handles loading — columns should still render
    expect(screen.getByText('Kanban Board')).toBeInTheDocument();
  });

  // --- Stale-data banner ---
  it('shows stale-data banner when refetch fails but cached data exists', async () => {
    // First load succeeds
    (tasks.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      makeTask(1, { title: 'Cached Task', status: 'todo' }),
    ]);
    renderKanban();
    await waitFor(() => {
      expect(screen.getByText('Cached Task')).toBeInTheDocument();
    });

    // Second fetch (refetch) fails — React Query keeps stale data but sets isError
    (tasks.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));
    // Invalidate to trigger refetch
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    await waitFor(() => {
      expect(screen.getByText('Failed to refresh — showing cached data')).toBeInTheDocument();
    });
    // Cached task should still be visible
    expect(screen.getByText('Cached Task')).toBeInTheDocument();
  });

  // --- Search and filter ---
  it('renders search input and priority filter buttons', () => {
    renderKanban();
    expect(screen.getByLabelText('Search tasks')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filter by priority' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'High' })).toBeInTheDocument();
  });

  it('filters tasks by search query', async () => {
    (tasks.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeTask(1, { title: 'Fix login bug', status: 'todo' }),
      makeTask(2, { title: 'Add dashboard', status: 'todo' }),
      makeTask(3, { title: 'Write tests', status: 'in_progress' }),
    ]);
    renderKanban();
    await waitFor(() => {
      expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Search tasks'), { target: { value: 'login' } });

    await waitFor(() => {
      expect(screen.getByText('Fix login bug')).toBeInTheDocument();
      expect(screen.queryByText('Add dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
      expect(screen.getByText('1 of 3 tasks')).toBeInTheDocument();
    });
  });

  it('filters tasks by priority', async () => {
    (tasks.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeTask(1, { title: 'Low task', status: 'todo', priority: 'low' }),
      makeTask(2, { title: 'High task', status: 'todo', priority: 'high' }),
      makeTask(3, { title: 'Medium task', status: 'in_progress', priority: 'medium' }),
    ]);
    renderKanban();
    await waitFor(() => {
      expect(screen.getByText('Low task')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'High' }));

    await waitFor(() => {
      expect(screen.getByText('High task')).toBeInTheDocument();
      expect(screen.queryByText('Low task')).not.toBeInTheDocument();
      expect(screen.queryByText('Medium task')).not.toBeInTheDocument();
      expect(screen.getByText('1 of 3 tasks')).toBeInTheDocument();
    });
  });

  it('clears search with X button', async () => {
    (tasks.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeTask(1, { title: 'Task A', status: 'todo' }),
      makeTask(2, { title: 'Task B', status: 'todo' }),
    ]);
    renderKanban();
    await waitFor(() => {
      expect(screen.getByText('Task A')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Search tasks'), { target: { value: 'Task A' } });
    await waitFor(() => {
      expect(screen.queryByText('Task B')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Clear search'));
    await waitFor(() => {
      expect(screen.getByText('Task A')).toBeInTheDocument();
      expect(screen.getByText('Task B')).toBeInTheDocument();
    });
  });

  // --- Delete mutation ---
  it('shows success toast on task delete', async () => {
    (tasks.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeTask(1, { title: 'Delete Me', status: 'todo' }),
    ]);
    renderKanban();
    await waitFor(() => {
      expect(screen.getByText('Delete Me')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Delete Me'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    // Two-step delete
    fireEvent.click(screen.getByTestId('delete-task-btn'));
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));
    await waitFor(() => {
      expect(tasks.delete).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Task deleted.', 'success');
    });
  });
});
