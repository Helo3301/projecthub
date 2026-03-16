import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarPage } from './CalendarPage';

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
  calendar: { tasks: vi.fn() },
  tasks: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), get: vi.fn() },
  users: { list: vi.fn() },
  agents: { list: vi.fn() },
}));

// Mock CalendarView to capture onEventClick / onDateClick callbacks
let capturedCalendarProps: Record<string, any> = {};
vi.mock('@/components/CalendarView', () => ({
  CalendarView: (props: Record<string, any>) => {
    capturedCalendarProps = props;
    return (
      <div data-testid="calendar-view">
        {props.events?.map((e: any) => (
          <div key={e.id} data-testid={`calendar-event-${e.id}`} onClick={() => props.onEventClick?.(e)}>
            {e.title}
          </div>
        ))}
        <button data-testid="prev-month" aria-label="Previous month"
          onClick={() => {
            const d = new Date();
            d.setMonth(d.getMonth() - 1);
            props.onMonthChange?.(d, d);
          }}>Prev</button>
        <button data-testid="next-month" aria-label="Next month"
          onClick={() => {
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            props.onMonthChange?.(d, d);
          }}>Next</button>
      </div>
    );
  },
}));

import { useStore } from '@/store';
import { calendar, tasks, users, agents } from '@/lib/api';

let queryClient: QueryClient;

function renderCalendar() {
  return render(
    <QueryClientProvider client={queryClient}>
      <CalendarPage />
    </QueryClientProvider>
  );
}

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCalendarProps = {};
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ currentProject: mockCurrentProject });
    (calendar.tasks as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (tasks.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 99 });
    (tasks.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (tasks.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (tasks.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, title: 'Task 1', status: 'todo', priority: 'medium',
      project_id: 1, created_at: '2026-01-01', assignees: [], subtasks: [],
      dependencies: [], subtask_count: 0, subtask_completed: 0,
    });
    (users.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (agents.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  // --- Basic rendering ---
  it('renders calendar heading', () => {
    renderCalendar();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('renders add task button', () => {
    renderCalendar();
    expect(screen.getByText('Add Task')).toBeInTheDocument();
  });

  it('has calendar-page test id', () => {
    renderCalendar();
    expect(screen.getByTestId('calendar-page')).toBeInTheDocument();
  });

  // --- Empty project ---
  it('shows empty project state when no project selected', () => {
    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ currentProject: null });
    renderCalendar();
    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-page')).not.toBeInTheDocument();
  });

  // --- Navigation ---
  it('renders calendar navigation', () => {
    renderCalendar();
    expect(screen.getByLabelText('Previous month')).toBeInTheDocument();
    expect(screen.getByLabelText('Next month')).toBeInTheDocument();
  });

  // --- Modal ---
  it('opens task modal when Add Task button clicked', async () => {
    renderCalendar();
    fireEvent.click(screen.getByText('Add Task'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // --- Error states ---
  it('shows error state when calendar events fail to load', async () => {
    (calendar.tasks as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    renderCalendar();
    await waitFor(() => {
      expect(screen.getByText('Failed to load calendar events')).toBeInTheDocument();
    });
  });

  it('shows retry button on error', async () => {
    (calendar.tasks as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    renderCalendar();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  // --- Create mutation ---
  it('shows success toast on task create', async () => {
    renderCalendar();
    fireEvent.click(screen.getByText('Add Task'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'New Event' } });
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
    renderCalendar();
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
  it('shows loading state while events are pending', () => {
    (calendar.tasks as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderCalendar();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
  });

  // --- Fetches events with correct date range ---
  it('calls calendar.tasks with date range and project id', async () => {
    renderCalendar();
    await waitFor(() => {
      expect(calendar.tasks).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        1
      );
    });
  });

  // --- handleEventClick: fetches full task and opens modal ---
  it('opens modal with task details when calendar event is clicked', async () => {
    const calEvent = { id: 1, title: 'Task 1', date: '2026-01-05', type: 'due_date' };
    (calendar.tasks as ReturnType<typeof vi.fn>).mockResolvedValue([calEvent]);
    renderCalendar();
    await waitFor(() => {
      expect(screen.getByTestId('calendar-event-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('calendar-event-1'));
    await waitFor(() => {
      expect(tasks.get).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('shows error toast when event click fails to load details', async () => {
    (tasks.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('not found'));
    const calEvent = { id: 1, title: 'Task 1', date: '2026-01-05', type: 'due_date' };
    (calendar.tasks as ReturnType<typeof vi.fn>).mockResolvedValue([calEvent]);
    renderCalendar();
    await waitFor(() => {
      expect(screen.getByTestId('calendar-event-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('calendar-event-1'));
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to load task details. Please try again.');
    });
  });

  // --- handleEventClick race guard ---
  it('ignores stale event click when a newer click supersedes', async () => {
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

    const calEvents = [
      { id: 1, title: 'Task 1', date: '2026-01-05', type: 'due_date' },
      { id: 2, title: 'Task 2', date: '2026-01-06', type: 'due_date' },
    ];
    (calendar.tasks as ReturnType<typeof vi.fn>).mockResolvedValue(calEvents);
    renderCalendar();
    await waitFor(() => {
      expect(screen.getByTestId('calendar-event-1')).toBeInTheDocument();
    });

    // Click event 1 (slow), then event 2 (fast)
    fireEvent.click(screen.getByTestId('calendar-event-1'));
    fireEvent.click(screen.getByTestId('calendar-event-2'));

    // Event 2 resolves first and opens modal
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Modal should show Task 2's data
    expect(screen.getByLabelText(/title/i)).toHaveValue('Task 2');

    // Now resolve event 1 — should be ignored (stale)
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

  // --- Update mutation via event click ---
  it('shows success toast on task update via event click', async () => {
    const calEvent = { id: 1, title: 'Task 1', date: '2026-01-05', type: 'due_date' };
    (calendar.tasks as ReturnType<typeof vi.fn>).mockResolvedValue([calEvent]);
    renderCalendar();
    await waitFor(() => {
      expect(screen.getByTestId('calendar-event-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('calendar-event-1'));
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
    const calEvent = { id: 1, title: 'Task 1', date: '2026-01-05', type: 'due_date' };
    (calendar.tasks as ReturnType<typeof vi.fn>).mockResolvedValue([calEvent]);
    renderCalendar();
    await waitFor(() => {
      expect(screen.getByTestId('calendar-event-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('calendar-event-1'));
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

  // --- Delete mutation via event click ---
  it('shows success toast on task delete via event click', async () => {
    const calEvent = { id: 1, title: 'Task 1', date: '2026-01-05', type: 'due_date' };
    (calendar.tasks as ReturnType<typeof vi.fn>).mockResolvedValue([calEvent]);
    renderCalendar();
    await waitFor(() => {
      expect(screen.getByTestId('calendar-event-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('calendar-event-1'));
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

  // --- Delete error path ---
  it('shows error toast on task delete failure', async () => {
    (tasks.delete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    const calEvent = { id: 1, title: 'Task 1', date: '2026-01-05', type: 'due_date' };
    (calendar.tasks as ReturnType<typeof vi.fn>).mockResolvedValue([calEvent]);
    renderCalendar();
    await waitFor(() => {
      expect(screen.getByTestId('calendar-event-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('calendar-event-1'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('delete-task-btn'));
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to delete task. Please try again.');
    });
  });

  // --- handleDateClick opens modal ---
  it('opens modal when a date is clicked via onDateClick', async () => {
    renderCalendar();
    await waitFor(() => {
      expect(capturedCalendarProps.onDateClick).toBeDefined();
    });
    act(() => {
      capturedCalendarProps.onDateClick(new Date('2026-01-15'));
    });
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // --- due_date pre-fill from selectedDate ---
  it('pre-fills due_date from clicked date when creating task', async () => {
    renderCalendar();
    await waitFor(() => {
      expect(capturedCalendarProps.onDateClick).toBeDefined();
    });
    // Use T00:00:00 to avoid UTC timezone offset shifting the date
    act(() => {
      capturedCalendarProps.onDateClick(new Date('2026-01-15T00:00:00'));
    });
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Date Click Task' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    await waitFor(() => {
      expect(tasks.create).toHaveBeenCalled();
    });
    // Verify the due_date was set from the clicked date
    const createCall = (tasks.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createCall.due_date).toBe('2026-01-15');
  });

  // --- Stale-data banner ---
  it('shows stale-data banner when refetch fails but cached data exists', async () => {
    const calEvent = { id: 1, title: 'Task 1', date: '2026-01-05', type: 'due_date' };
    (calendar.tasks as ReturnType<typeof vi.fn>).mockResolvedValueOnce([calEvent]);
    renderCalendar();
    await waitFor(() => {
      expect(screen.getByTestId('calendar-event-1')).toBeInTheDocument();
    });
    // Next fetch fails — cached data remains
    (calendar.tasks as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));
    queryClient.invalidateQueries({ queryKey: ['calendar'] });
    await waitFor(() => {
      expect(screen.getByText('Failed to refresh — showing cached data')).toBeInTheDocument();
    });
    // Cached event still visible
    expect(screen.getByTestId('calendar-event-1')).toBeInTheDocument();
  });
});
