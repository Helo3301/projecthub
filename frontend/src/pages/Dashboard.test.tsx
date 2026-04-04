import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from './Dashboard';

// --- Mock store ---
/* eslint-disable @typescript-eslint/no-explicit-any */
const mockStoreState: Record<string, any> = { currentProject: null };
vi.mock('@/store', () => ({
  useStore: () => mockStoreState,
}));
function setState(s: Record<string, any>) {
  Object.assign(mockStoreState, s);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// --- Mock API ---
const mockTasksList = vi.fn().mockResolvedValue([]);
const mockTasksUpdate = vi.fn().mockResolvedValue({});
const mockTasksDelete = vi.fn().mockResolvedValue({});
const mockCalendarTasks = vi.fn().mockResolvedValue([]);

vi.mock('@/lib/api', () => ({
  tasks: {
    list: (...args: unknown[]) => mockTasksList(...args),
    create: vi.fn(),
    update: (...args: unknown[]) => mockTasksUpdate(...args),
    delete: (...args: unknown[]) => mockTasksDelete(...args),
  },
  calendar: {
    tasks: (...args: unknown[]) => mockCalendarTasks(...args),
  },
  users: { list: vi.fn().mockResolvedValue([]) },
  agents: { list: vi.fn().mockResolvedValue([]) },
}));

// --- Mock Toast ---
const mockToast = vi.fn();
vi.mock('@/components/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// --- Mock TaskModal to capture props and interactions ---
/* eslint-disable @typescript-eslint/no-explicit-any */
let capturedModalProps: Record<string, any> = {};
vi.mock('@/components/TaskModal', () => ({
  TaskModal: (props: Record<string, any>) => {
    capturedModalProps = props;
    if (!props.isOpen) return null;
    return (
      <div data-testid="task-modal">
        <button data-testid="modal-save" onClick={() => props.onSave({ title: 'Updated' })}>Save</button>
        {props.onDelete && <button data-testid="modal-delete" onClick={() => props.onDelete()}>Delete</button>}
        <button data-testid="modal-close" onClick={() => props.onClose()}>Close</button>
      </div>
    );
  },
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

// --- Helpers ---
const mockProject = {
  id: 1,
  name: 'Test Project',
  description: 'A test project',
  color: '#6366F1',
};

function makeTask(id: number, overrides: Partial<{
  title: string; status: string; priority: string; due_date: string;
  created_at: string; position: number; project_id: number;
}> = {}) {
  return {
    id,
    title: overrides.title ?? `Task ${id}`,
    status: overrides.status ?? 'todo',
    priority: overrides.priority ?? 'medium',
    due_date: overrides.due_date,
    created_at: overrides.created_at ?? '2026-01-01T00:00:00',
    position: overrides.position ?? id,
    project_id: overrides.project_id ?? 1,
    assignees: [],
    subtasks: [],
    dependencies: [],
    subtask_count: 0,
    subtask_completed: 0,
  };
}

function makeEvent(id: number, overrides: Partial<{
  title: string; start: string; end: string; status: string; priority: string;
}> = {}) {
  return {
    id,
    title: overrides.title ?? `Event ${id}`,
    start: overrides.start ?? '2026-03-15',
    end: overrides.end ?? '2026-03-15',
    status: overrides.status ?? 'todo',
    priority: overrides.priority ?? 'medium',
    project_id: 1,
    project_name: 'Test Project',
    assignees: [],
  };
}

let queryClient: QueryClient;

function renderDashboard() {
  return render(
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedModalProps = {};
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Reset all keys to avoid cross-test pollution
    Object.keys(mockStoreState).forEach(k => delete mockStoreState[k]);
    setState({ currentProject: mockProject });
    mockTasksList.mockResolvedValue([]);
    mockCalendarTasks.mockResolvedValue([]);
  });

  // --- Basic rendering ---
  it('renders dashboard container with data-testid', () => {
    renderDashboard();
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });

  it('displays project name and description', () => {
    renderDashboard();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('A test project')).toBeInTheDocument();
  });

  it('shows "Project Dashboard" when description is empty', () => {
    setState({ currentProject: { ...mockProject, description: '' } });
    renderDashboard();
    expect(screen.getByText('Project Dashboard')).toBeInTheDocument();
  });

  // --- Empty project state ---
  it('shows EmptyProjectState when no project selected', () => {
    setState({ currentProject: null });
    renderDashboard();
    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });

  // --- Stats calculations ---
  it('computes stat values from task data', async () => {
    mockTasksList.mockResolvedValue([
      makeTask(1, { status: 'todo' }),
      makeTask(2, { status: 'done' }),
      makeTask(3, { status: 'in_progress' }),
      makeTask(4, { status: 'done' }),
      makeTask(5, { status: 'todo' }),
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // total
    });
    expect(screen.getByText('2')).toBeInTheDocument(); // completed
    expect(screen.getByText('1')).toBeInTheDocument(); // in progress
    expect(screen.getByText('40% completion')).toBeInTheDocument();
  });

  it('shows 0% completion when no tasks', async () => {
    mockTasksList.mockResolvedValue([]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('0% completion')).toBeInTheDocument();
    });
    // Verify each stat value by its label context
    const statTitles = ['Total Tasks', 'Completed', 'In Progress', 'Overdue'];
    for (const title of statTitles) {
      const label = screen.getByText(title);
      const card = label.closest('.bg-white, [class*="bg-white"]')!;
      expect(card).not.toBeNull();
      // The value element is a sibling p tag with text-2xl
      const value = card.querySelector('.text-2xl');
      expect(value?.textContent).toBe('0');
    }
  });

  it('counts overdue tasks correctly', async () => {
    // Use a date well in the past
    mockTasksList.mockResolvedValue([
      makeTask(1, { status: 'todo', due_date: '2020-01-01' }),
      makeTask(2, { status: 'todo', due_date: '2020-06-15' }),
      makeTask(3, { status: 'done', due_date: '2020-01-01' }), // done → not overdue
      makeTask(4, { status: 'todo' }), // no due_date → not overdue
      makeTask(5, { status: 'in_progress', due_date: '2099-12-31' }), // future → not overdue
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // total
    });
    // Overdue stat card should show 2
    const statCards = screen.getAllByText('2');
    expect(statCards.length).toBeGreaterThanOrEqual(1);
  });

  it('handles ISO datetime due_date format for overdue calculation', async () => {
    mockTasksList.mockResolvedValue([
      makeTask(1, { title: 'ISO Date Task', status: 'todo', due_date: '2020-01-01T15:30:00' }),
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('ISO Date Task')).toBeInTheDocument();
    });
    // Overdue stat should be 1 (past ISO datetime, not done)
    const overdueLabel = screen.getByText('Overdue');
    const card = overdueLabel.closest('.bg-white, [class*="bg-white"]')!;
    const value = card.querySelector('.text-2xl');
    expect(value?.textContent).toBe('1');
  });

  // --- Recent Tasks filtering & sorting ---
  it('shows recent tasks excluding done, sorted newest first, max 5', async () => {
    mockTasksList.mockResolvedValue([
      makeTask(1, { title: 'Oldest', status: 'todo', created_at: '2026-01-01T00:00:00' }),
      makeTask(2, { title: 'Middle', status: 'todo', created_at: '2026-01-05T00:00:00' }),
      makeTask(3, { title: 'Newest', status: 'todo', created_at: '2026-01-10T00:00:00' }),
      makeTask(4, { title: 'Done Task', status: 'done', created_at: '2026-01-15T00:00:00' }),
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Newest')).toBeInTheDocument();
    });
    expect(screen.getByText('Middle')).toBeInTheDocument();
    expect(screen.getByText('Oldest')).toBeInTheDocument();
    expect(screen.queryByText('Done Task')).not.toBeInTheDocument();
  });

  it('shows "No tasks yet" when all tasks are done', async () => {
    mockTasksList.mockResolvedValue([
      makeTask(1, { title: 'Done A', status: 'done' }),
      makeTask(2, { title: 'Done B', status: 'done' }),
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('No tasks yet')).toBeInTheDocument();
    });
    // Verify done tasks don't leak into the view
    expect(screen.queryByText('Done A')).not.toBeInTheDocument();
    expect(screen.queryByText('Done B')).not.toBeInTheDocument();
  });

  // --- High Priority filtering & sorting ---
  it('shows only high and urgent priority tasks in High Priority section', async () => {
    mockTasksList.mockResolvedValue([
      makeTask(1, { title: 'Urgent Fix', priority: 'urgent', status: 'todo' }),
      makeTask(2, { title: 'High Bug', priority: 'high', status: 'todo' }),
      makeTask(3, { title: 'Medium Task', priority: 'medium', status: 'todo' }),
      makeTask(4, { title: 'Low Task', priority: 'low', status: 'todo' }),
    ]);
    renderDashboard();
    await waitFor(() => {
      // High/urgent tasks appear in BOTH recent and high priority sections
      const urgentElements = screen.getAllByText('Urgent Fix');
      expect(urgentElements.length).toBe(2); // once in recent, once in high priority
    });
    const highElements = screen.getAllByText('High Bug');
    expect(highElements.length).toBe(2);
    // Medium and low only appear once (in recent tasks, not high priority)
    expect(screen.getAllByText('Medium Task')).toHaveLength(1);
    expect(screen.getAllByText('Low Task')).toHaveLength(1);
  });

  it('excludes done tasks from high priority list', async () => {
    mockTasksList.mockResolvedValue([
      makeTask(1, { title: 'Done High', priority: 'high', status: 'done' }),
      makeTask(2, { title: 'Active High', priority: 'high', status: 'todo' }),
    ]);
    renderDashboard();
    await waitFor(() => {
      // Active High appears in both Recent Tasks and High Priority
      const activeElements = screen.getAllByText('Active High');
      expect(activeElements.length).toBe(2);
    });
    // Done High should not appear anywhere (filtered from both recent and high priority)
    expect(screen.queryByText('Done High')).not.toBeInTheDocument();
  });

  it('shows "No high priority tasks" when none qualify', async () => {
    mockTasksList.mockResolvedValue([
      makeTask(1, { priority: 'low', status: 'todo' }),
      makeTask(2, { priority: 'medium', status: 'todo' }),
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('No high priority tasks')).toBeInTheDocument();
    });
  });

  // --- Upcoming Tasks ---
  it('renders upcoming events with due dates', async () => {
    mockCalendarTasks.mockResolvedValue([
      makeEvent(1, { title: 'Deploy Feature', start: '2026-03-15' }),
      makeEvent(2, { title: 'Review Code', start: '2026-03-16' }),
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Deploy Feature')).toBeInTheDocument();
    });
    expect(screen.getByText('Review Code')).toBeInTheDocument();
  });

  it('shows overdue label for past events', async () => {
    mockCalendarTasks.mockResolvedValue([
      makeEvent(1, { title: 'Past Task', start: '2020-01-01', status: 'todo' }),
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Past Task')).toBeInTheDocument();
    });
    expect(screen.getByText(/Overdue:/)).toBeInTheDocument();
  });

  it('shows "Due:" label for future events', async () => {
    mockCalendarTasks.mockResolvedValue([
      makeEvent(1, { title: 'Future Task', start: '2099-12-31', status: 'todo' }),
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Future Task')).toBeInTheDocument();
    });
    expect(screen.getByText(/Due:/)).toBeInTheDocument();
  });

  it('does not mark done events as overdue', async () => {
    mockCalendarTasks.mockResolvedValue([
      makeEvent(1, { title: 'Done Past', start: '2020-01-01', status: 'done' }),
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Done Past')).toBeInTheDocument();
    });
    expect(screen.getByText(/Due:/)).toBeInTheDocument();
    expect(screen.queryByText(/Overdue:/)).not.toBeInTheDocument();
  });

  it('shows "No upcoming tasks this week" when empty', async () => {
    mockCalendarTasks.mockResolvedValue([]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('No upcoming tasks this week')).toBeInTheDocument();
    });
  });

  // --- Task click opens modal ---
  it('opens task modal when a task card is clicked', async () => {
    const tasks = [makeTask(1, { title: 'Clickable Task', status: 'todo' })];
    mockTasksList.mockResolvedValue(tasks);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Clickable Task')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Clickable Task'));
    expect(screen.getByTestId('task-modal')).toBeInTheDocument();
  });

  it('closes modal and clears selection', async () => {
    mockTasksList.mockResolvedValue([makeTask(1, { status: 'todo' })]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Task 1'));
    expect(screen.getByTestId('task-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modal-close'));
    expect(screen.queryByTestId('task-modal')).not.toBeInTheDocument();
  });

  // --- Save mutation ---
  it('calls update mutation on save and shows success toast', async () => {
    mockTasksList.mockResolvedValue([makeTask(1, { status: 'todo' })]);
    mockTasksUpdate.mockResolvedValue({ id: 1, title: 'Updated' });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Task 1'));
    fireEvent.click(screen.getByTestId('modal-save'));
    await waitFor(() => {
      expect(mockTasksUpdate).toHaveBeenCalledWith(1, { title: 'Updated' });
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Task updated successfully.', 'success');
    });
  });

  it('shows error toast on update failure', async () => {
    mockTasksList.mockResolvedValue([makeTask(1, { status: 'todo' })]);
    mockTasksUpdate.mockRejectedValueOnce(new Error('fail'));
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Task 1'));
    fireEvent.click(screen.getByTestId('modal-save'));
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to update task. Please try again.');
    });
  });

  // --- Delete mutation ---
  it('calls delete mutation and shows success toast', async () => {
    mockTasksList.mockResolvedValue([makeTask(1, { status: 'todo' })]);
    mockTasksDelete.mockResolvedValue({});
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Task 1'));
    fireEvent.click(screen.getByTestId('modal-delete'));
    await waitFor(() => {
      expect(mockTasksDelete).toHaveBeenCalled();
      expect(mockTasksDelete.mock.calls[0][0]).toBe(1);
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Task deleted.', 'success');
    });
  });

  it('shows error toast on delete failure', async () => {
    mockTasksList.mockResolvedValue([makeTask(1, { status: 'todo' })]);
    mockTasksDelete.mockRejectedValueOnce(new Error('fail'));
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Task 1'));
    fireEvent.click(screen.getByTestId('modal-delete'));
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to delete task. Please try again.');
    });
  });

  // --- Modal receives correct props ---
  it('passes onDelete only when a task is selected', async () => {
    mockTasksList.mockResolvedValue([makeTask(1, { status: 'todo' })]);
    renderDashboard();
    // Before any task click, modal is closed but onDelete should be undefined
    expect(capturedModalProps.onDelete).toBeUndefined();
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Task 1'));
    expect(capturedModalProps.onDelete).toBeDefined();
  });

  // --- Upcoming card click opens modal ---
  it('opens modal when clicking an upcoming event that has a matching task', async () => {
    const tasks = [makeTask(1, { title: 'My Task', status: 'todo', due_date: '2026-03-15' })];
    mockTasksList.mockResolvedValue(tasks);
    mockCalendarTasks.mockResolvedValue([
      makeEvent(1, { title: 'My Task', start: '2026-03-15' }),
    ]);
    renderDashboard();
    await waitFor(() => {
      // The upcoming card renders the event title
      const cards = screen.getAllByText('My Task');
      expect(cards.length).toBeGreaterThanOrEqual(1);
    });
    // Click the upcoming card — ID match (task.id=1 === event.id=1) gives it role="button"
    const dueLabel = screen.getByText(/Due: Mar 15, 2026/);
    const card = dueLabel.closest('[role="button"]');
    expect(card).not.toBeNull();
    fireEvent.click(card!);
    expect(screen.getByTestId('task-modal')).toBeInTheDocument();
  });

  // --- Keyboard accessibility on upcoming cards ---
  it('supports Enter key on upcoming cards', async () => {
    const tasks = [makeTask(10, { title: 'KB Task', status: 'todo', due_date: '2026-03-15' })];
    mockTasksList.mockResolvedValue(tasks);
    mockCalendarTasks.mockResolvedValue([
      makeEvent(10, { title: 'KB Task', start: '2026-03-15' }),
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Due:.*Mar 15/)).toBeInTheDocument();
    });
    // The upcoming card has role="button" when it matches a task
    const card = screen.getByText(/Due:.*Mar 15/).closest('[role="button"]');
    expect(card).not.toBeNull();
    fireEvent.keyDown(card!, { key: 'Enter' });
    expect(screen.getByTestId('task-modal')).toBeInTheDocument();
  });

  // --- Loading skeletons ---
  it('shows skeletons while tasks are loading', () => {
    // Never resolve the tasks query
    mockTasksList.mockReturnValue(new Promise(() => {}));
    renderDashboard();
    // Stat card skeletons have animate-pulse
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
    // Section titles still render
    expect(screen.getByText('Recent Tasks')).toBeInTheDocument();
  });

  // --- All section titles present ---
  it('renders all section headings', async () => {
    renderDashboard();
    expect(screen.getByText('Recent Tasks')).toBeInTheDocument();
    expect(screen.getByText('High Priority')).toBeInTheDocument();
    expect(screen.getByText('Upcoming This Week')).toBeInTheDocument();
  });

  // --- Error handling ---
  it('shows QueryError when tasks fail to load with no cached data', async () => {
    mockTasksList.mockRejectedValue(new Error('Network error'));
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument();
    });
  });

  it('shows stale-data banner when tasks fail to refresh but cached data exists', async () => {
    // First load succeeds
    mockTasksList.mockResolvedValueOnce([makeTask(1, { status: 'todo' })]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });
    // Simulate refetch failure
    mockTasksList.mockRejectedValueOnce(new Error('Network error'));
    await queryClient.refetchQueries({ queryKey: ['tasks', 1] });
    await waitFor(() => {
      expect(screen.getByText('Failed to refresh — showing cached data')).toBeInTheDocument();
    });
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('renders all stat card titles', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Total Tasks')).toBeInTheDocument();
    });
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });
});
