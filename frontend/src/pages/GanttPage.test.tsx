import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GanttPage } from './GanttPage';

const mockCurrentProject = { id: 1, name: 'Test Project', description: '', color: '#6366F1', is_archived: false, created_at: '', updated_at: '' };

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
    gantt: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    adjustDates: vi.fn(),
    get: vi.fn(),
  },
  users: { list: vi.fn() },
  agents: { list: vi.fn() },
}));

// Mock GanttChart to capture onTaskClick / onDateChange callbacks
let capturedGanttProps: Record<string, any> = {};
vi.mock('@/components/GanttChart', () => ({
  GanttChart: (props: Record<string, any>) => {
    capturedGanttProps = props;
    return (
      <div data-testid="gantt-chart">
        {props.tasks?.map((t: any) => (
          <div key={t.id} data-testid={`gantt-task-${t.id}`} onClick={() => props.onTaskClick?.(t)}>
            {t.title}
          </div>
        ))}
      </div>
    );
  },
}));

import { useStore } from '@/store';
import { tasks, users, agents } from '@/lib/api';

let queryClient: QueryClient;

function renderGantt() {
  return render(
    <QueryClientProvider client={queryClient}>
      <GanttPage />
    </QueryClientProvider>
  );
}

describe('GanttPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedGanttProps = {};
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ currentProject: mockCurrentProject });
    (tasks.gantt as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (tasks.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 99 });
    (tasks.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (tasks.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (tasks.adjustDates as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (tasks.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, title: 'Task 1', status: 'todo', priority: 'medium',
      project_id: 1, created_at: '2026-01-01', assignees: [], subtasks: [],
      dependencies: [], subtask_count: 0, subtask_completed: 0,
    });
    (users.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (agents.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  // --- Basic rendering ---
  it('renders gantt heading', () => {
    renderGantt();
    expect(screen.getByText('Gantt Chart')).toBeInTheDocument();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('renders add task button', () => {
    renderGantt();
    expect(screen.getByText('Add Task')).toBeInTheDocument();
  });

  it('has gantt-page test id', () => {
    renderGantt();
    expect(screen.getByTestId('gantt-page')).toBeInTheDocument();
  });

  it('shows dependency tip', () => {
    renderGantt();
    expect(screen.getByText(/dependent tasks will automatically/)).toBeInTheDocument();
  });

  // --- Empty project ---
  it('shows empty project state when no project selected', () => {
    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ currentProject: null });
    renderGantt();
    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
    expect(screen.queryByTestId('gantt-page')).not.toBeInTheDocument();
  });

  // --- Modal ---
  it('opens task modal when Add Task button clicked', async () => {
    renderGantt();
    fireEvent.click(screen.getByText('Add Task'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // --- Error states ---
  it('shows error state when gantt data fails to load', async () => {
    (tasks.gantt as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    renderGantt();
    await waitFor(() => {
      expect(screen.getByText('Failed to load Gantt data')).toBeInTheDocument();
    });
  });

  it('shows retry button on error', async () => {
    (tasks.gantt as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    renderGantt();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  // --- Create mutation ---
  it('shows success toast on task create', async () => {
    renderGantt();
    fireEvent.click(screen.getByText('Add Task'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'New Gantt Task' } });
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
    renderGantt();
    fireEvent.click(screen.getByText('Add Task'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Fail' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to create task. Please try again.');
    });
  });

  // --- Loading state ---
  it('shows loading state while gantt data is pending', () => {
    (tasks.gantt as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderGantt();
    expect(screen.getByText('Gantt Chart')).toBeInTheDocument();
  });

  // --- Fetches gantt with project id ---
  it('calls tasks.gantt with project id', async () => {
    renderGantt();
    await waitFor(() => {
      expect(tasks.gantt).toHaveBeenCalledWith(1);
    });
  });

  // --- handleTaskClick: fetches full task and opens modal ---
  it('opens modal with task details when gantt task is clicked', async () => {
    const ganttTask = { id: 1, title: 'Task 1', start_date: '2026-01-01', end_date: '2026-01-10', dependencies: [] };
    (tasks.gantt as ReturnType<typeof vi.fn>).mockResolvedValue([ganttTask]);
    renderGantt();
    await waitFor(() => {
      expect(screen.getByTestId('gantt-task-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('gantt-task-1'));
    await waitFor(() => {
      expect(tasks.get).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('shows error toast when task click fails to load details', async () => {
    (tasks.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('not found'));
    const ganttTask = { id: 1, title: 'Task 1', start_date: '2026-01-01', end_date: '2026-01-10', dependencies: [] };
    (tasks.gantt as ReturnType<typeof vi.fn>).mockResolvedValue([ganttTask]);
    renderGantt();
    await waitFor(() => {
      expect(screen.getByTestId('gantt-task-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('gantt-task-1'));
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to load task details. Please try again.');
    });
  });

  // --- handleTaskClick race guard ---
  it('ignores stale task click when a newer click supersedes', async () => {
    let resolveFirst: (v: any) => void;
    const firstPromise = new Promise(r => { resolveFirst = r; });
    const secondResult = {
      id: 2, title: 'Task 2', status: 'todo', priority: 'medium',
      project_id: 1, created_at: '2026-01-01', assignees: [], subtasks: [],
      dependencies: [], subtask_count: 0, subtask_completed: 0,
    };

    (tasks.get as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce(secondResult);

    const ganttTasks = [
      { id: 1, title: 'Task 1', start_date: '2026-01-01', end_date: '2026-01-10', dependencies: [] },
      { id: 2, title: 'Task 2', start_date: '2026-01-01', end_date: '2026-01-10', dependencies: [] },
    ];
    (tasks.gantt as ReturnType<typeof vi.fn>).mockResolvedValue(ganttTasks);
    renderGantt();
    await waitFor(() => {
      expect(screen.getByTestId('gantt-task-1')).toBeInTheDocument();
    });

    // Click task 1 (slow), then task 2 (fast)
    fireEvent.click(screen.getByTestId('gantt-task-1'));
    fireEvent.click(screen.getByTestId('gantt-task-2'));

    // Task 2 resolves first and opens modal with Task 2's data
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toHaveValue('Task 2');
    });

    // Now resolve task 1 — should be ignored (stale)
    await act(async () => {
      resolveFirst!({
        id: 1, title: 'Task 1', status: 'todo', priority: 'medium',
        project_id: 1, created_at: '2026-01-01', assignees: [], subtasks: [],
        dependencies: [], subtask_count: 0, subtask_completed: 0,
      });
    });

    // Modal must still show Task 2, not Task 1
    expect(screen.getByLabelText(/title/i)).toHaveValue('Task 2');
    expect(tasks.get).toHaveBeenCalledTimes(2);
  });

  // --- Update mutation via task click ---
  it('shows success toast on task update via gantt click', async () => {
    const ganttTask = { id: 1, title: 'Task 1', start_date: '2026-01-01', end_date: '2026-01-10', dependencies: [] };
    (tasks.gantt as ReturnType<typeof vi.fn>).mockResolvedValue([ganttTask]);
    renderGantt();
    await waitFor(() => {
      expect(screen.getByTestId('gantt-task-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('gantt-task-1'));
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
    const ganttTask = { id: 1, title: 'Task 1', start_date: '2026-01-01', end_date: '2026-01-10', dependencies: [] };
    (tasks.gantt as ReturnType<typeof vi.fn>).mockResolvedValue([ganttTask]);
    renderGantt();
    await waitFor(() => {
      expect(screen.getByTestId('gantt-task-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('gantt-task-1'));
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

  // --- Delete mutation via task click ---
  it('shows success toast on task delete via gantt click', async () => {
    const ganttTask = { id: 1, title: 'Task 1', start_date: '2026-01-01', end_date: '2026-01-10', dependencies: [] };
    (tasks.gantt as ReturnType<typeof vi.fn>).mockResolvedValue([ganttTask]);
    renderGantt();
    await waitFor(() => {
      expect(screen.getByTestId('gantt-task-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('gantt-task-1'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    // Two-step delete: click Delete, then Confirm Delete
    fireEvent.click(screen.getByTestId('delete-task-btn'));
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));
    await waitFor(() => {
      expect(tasks.delete).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Task deleted.', 'success');
    });
  });

  // --- adjustDates mutation ---
  it('calls adjustDates when onDateChange fires', async () => {
    const ganttTask = { id: 1, title: 'Task 1', start_date: '2026-01-01', end_date: '2026-01-10', dependencies: [] };
    (tasks.gantt as ReturnType<typeof vi.fn>).mockResolvedValue([ganttTask]);
    renderGantt();
    await waitFor(() => {
      expect(capturedGanttProps.onDateChange).toBeDefined();
    });
    act(() => {
      capturedGanttProps.onDateChange(1, new Date('2026-01-01'), new Date('2026-01-15'));
    });
    await waitFor(() => {
      expect(tasks.adjustDates).toHaveBeenCalledWith(1, '2026-01-15');
    });
  });

  it('shows error toast when adjustDates fails', async () => {
    (tasks.adjustDates as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    const ganttTask = { id: 1, title: 'Task 1', start_date: '2026-01-01', end_date: '2026-01-10', dependencies: [] };
    (tasks.gantt as ReturnType<typeof vi.fn>).mockResolvedValue([ganttTask]);
    renderGantt();
    await waitFor(() => {
      expect(capturedGanttProps.onDateChange).toBeDefined();
    });
    act(() => {
      capturedGanttProps.onDateChange(1, new Date('2026-01-01'), new Date('2026-01-15'));
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to adjust dates. Please try again.');
    });
  });

  // --- Delete error path ---
  it('shows error toast on task delete failure', async () => {
    (tasks.delete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    const ganttTask = { id: 1, title: 'Task 1', start_date: '2026-01-01', end_date: '2026-01-10', dependencies: [] };
    (tasks.gantt as ReturnType<typeof vi.fn>).mockResolvedValue([ganttTask]);
    renderGantt();
    await waitFor(() => {
      expect(screen.getByTestId('gantt-task-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('gantt-task-1'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('delete-task-btn'));
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to delete task. Please try again.');
    });
  });

  // --- Stale-data banner ---
  it('shows stale-data banner when refetch fails but cached data exists', async () => {
    const ganttTask = { id: 1, title: 'Task 1', start_date: '2026-01-01', end_date: '2026-01-10', dependencies: [] };
    (tasks.gantt as ReturnType<typeof vi.fn>).mockResolvedValueOnce([ganttTask]);
    renderGantt();
    await waitFor(() => {
      expect(screen.getByTestId('gantt-task-1')).toBeInTheDocument();
    });
    // Next fetch fails — cached data remains
    (tasks.gantt as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));
    queryClient.invalidateQueries({ queryKey: ['gantt'] });
    await waitFor(() => {
      expect(screen.getByText('Failed to refresh — showing cached data')).toBeInTheDocument();
    });
    // Cached task still visible
    expect(screen.getByTestId('gantt-task-1')).toBeInTheDocument();
  });
});
