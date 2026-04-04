import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GanttChart } from './GanttChart';
import type { GanttTask } from '@/types';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const today = new Date();
const currentMonth = format(today, 'MMMM yyyy');

const mockTasks: GanttTask[] = [
  {
    id: 1,
    title: 'Task 1',
    start_date: format(startOfMonth(today), 'yyyy-MM-dd'),
    due_date: format(endOfMonth(today), 'yyyy-MM-dd'),
    progress: 50,
    color: '#4F46E5',
    dependencies: [],
    status: 'in_progress',
    priority: 'high',
    assignees: [],
  },
  {
    id: 2,
    title: 'Task 2',
    start_date: format(today, 'yyyy-MM-dd'),
    due_date: format(today, 'yyyy-MM-dd'),
    progress: 100,
    color: '#10B981',
    dependencies: [1],
    status: 'done',
    priority: 'medium',
    assignees: [],
  },
  {
    id: 3,
    title: 'Task without dates',
    progress: 0,
    dependencies: [],
    status: 'todo',
    priority: 'low',
    assignees: [],
  },
];

describe('GanttChart', () => {
  it('renders gantt chart container', () => {
    render(<GanttChart tasks={mockTasks} />);
    expect(screen.getByTestId('gantt-chart')).toBeInTheDocument();
  });

  it('displays current month and year', () => {
    render(<GanttChart tasks={mockTasks} />);
    expect(screen.getByText(currentMonth)).toBeInTheDocument();
  });

  it('renders task names in the sidebar', () => {
    render(<GanttChart tasks={mockTasks} />);
    // Use getAllBy since task names appear in both sidebar and task bars
    expect(screen.getAllByText('Task 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Task 2').length).toBeGreaterThan(0);
    expect(screen.getByText('Task without dates')).toBeInTheDocument();
  });

  it('renders task rows', () => {
    render(<GanttChart tasks={mockTasks} />);
    expect(screen.getByTestId('task-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-row-2')).toBeInTheDocument();
    expect(screen.getByTestId('task-row-3')).toBeInTheDocument();
  });

  it('renders task timelines', () => {
    render(<GanttChart tasks={mockTasks} />);
    expect(screen.getByTestId('task-timeline-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-timeline-2')).toBeInTheDocument();
  });

  it('renders task bars for tasks with dates', () => {
    render(<GanttChart tasks={mockTasks} />);
    // Tasks 1 and 2 have dates within the current month
    const taskBar1 = screen.queryByTestId('task-bar-1');
    const taskBar2 = screen.queryByTestId('task-bar-2');
    // At least one should be visible (depends on date range)
    expect(taskBar1 || taskBar2).toBeTruthy();
  });

  it('navigates to previous month', () => {
    render(<GanttChart tasks={mockTasks} />);
    const prevButton = screen.getByRole('button', { name: /previous month/i });

    fireEvent.click(prevButton);

    const prevMonth = format(new Date(today.getFullYear(), today.getMonth() - 1), 'MMMM yyyy');
    expect(screen.getByText(prevMonth)).toBeInTheDocument();
  });

  it('navigates to next month', () => {
    render(<GanttChart tasks={mockTasks} />);
    const nextButton = screen.getByRole('button', { name: /next month/i });

    fireEvent.click(nextButton);

    const nextMonth = format(new Date(today.getFullYear(), today.getMonth() + 1), 'MMMM yyyy');
    expect(screen.getByText(nextMonth)).toBeInTheDocument();
  });

  it('shows Today button and navigates back to current month', async () => {
    render(<GanttChart tasks={mockTasks} />);

    // Navigate away first
    const nextButton = screen.getByRole('button', { name: /next month/i });
    fireEvent.click(nextButton);

    // Click today
    const todayButton = screen.getByRole('button', { name: /today/i });
    fireEvent.click(todayButton);

    expect(screen.getByText(currentMonth)).toBeInTheDocument();
  });

  it('calls onTaskClick when task row is clicked', () => {
    const onTaskClick = vi.fn();
    render(<GanttChart tasks={mockTasks} onTaskClick={onTaskClick} />);

    fireEvent.click(screen.getByTestId('task-row-1'));
    expect(onTaskClick).toHaveBeenCalledWith(mockTasks[0]);
  });

  it('calls onTaskClick when task bar is clicked', () => {
    const onTaskClick = vi.fn();
    render(<GanttChart tasks={mockTasks} onTaskClick={onTaskClick} />);

    fireEvent.click(screen.getByTestId('task-bar-1'));
    expect(onTaskClick).toHaveBeenCalledWith(mockTasks[0]);
  });

  it('renders today line', () => {
    render(<GanttChart tasks={mockTasks} />);
    expect(screen.getByTestId('today-line')).toBeInTheDocument();
  });

  it('renders legend', () => {
    render(<GanttChart tasks={mockTasks} />);

    expect(screen.getByText('Weekend')).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
  });

  it('handles empty task list', () => {
    render(<GanttChart tasks={[]} />);
    expect(screen.getByTestId('gantt-chart')).toBeInTheDocument();
  });

  it('applies task color to task bar', () => {
    render(<GanttChart tasks={mockTasks} />);

    const taskBar = screen.getByTestId('task-bar-1');
    expect(taskBar).toHaveStyle({ backgroundColor: '#4F46E5' });
  });

  it('renders drag handles when onDateChange is provided', () => {
    const onDateChange = vi.fn();
    render(<GanttChart tasks={mockTasks} onDateChange={onDateChange} />);
    expect(screen.getByTestId('drag-handle-1')).toBeInTheDocument();
    expect(screen.getByTestId('drag-handle-2')).toBeInTheDocument();
    expect(screen.getByText('Drag edge to resize')).toBeInTheDocument();
  });

  it('does not render drag handles when onDateChange is not provided', () => {
    render(<GanttChart tasks={mockTasks} />);
    expect(screen.queryByTestId('drag-handle-1')).not.toBeInTheDocument();
    expect(screen.queryByText('Drag edge to resize')).not.toBeInTheDocument();
  });

  it('calls onDateChange with ArrowRight key on task bar', () => {
    const onDateChange = vi.fn();
    render(<GanttChart tasks={mockTasks} onDateChange={onDateChange} />);
    const bar1 = screen.getByTestId('task-bar-1');
    fireEvent.keyDown(bar1, { key: 'ArrowRight' });
    expect(onDateChange).toHaveBeenCalledTimes(1);
    expect(onDateChange.mock.calls[0][0]).toBe(1); // task id
  });

  it('calls onDateChange with ArrowLeft key on task bar', () => {
    const onDateChange = vi.fn();
    render(<GanttChart tasks={mockTasks} onDateChange={onDateChange} />);
    const bar1 = screen.getByTestId('task-bar-1');
    fireEvent.keyDown(bar1, { key: 'ArrowLeft' });
    expect(onDateChange).toHaveBeenCalledTimes(1);
    expect(onDateChange.mock.calls[0][0]).toBe(1);
  });

  it('includes resize hint in aria-label when onDateChange provided', () => {
    const onDateChange = vi.fn();
    render(<GanttChart tasks={mockTasks} onDateChange={onDateChange} />);
    const bar1 = screen.getByTestId('task-bar-1');
    expect(bar1.getAttribute('aria-label')).toContain('use arrow keys to resize');
  });

  it('task bars have role="button" and aria-label', () => {
    render(<GanttChart tasks={mockTasks} />);
    const bar1 = screen.getByTestId('task-bar-1');
    expect(bar1).toHaveAttribute('role', 'button');
    // aria-label includes date range and progress
    const label = bar1.getAttribute('aria-label')!;
    expect(label).toContain('Task 1');
    expect(label).toContain('50% complete');
    expect(bar1).toHaveAttribute('tabindex', '0');
  });

  it('task bar responds to keyboard Enter', () => {
    const onTaskClick = vi.fn();
    render(<GanttChart tasks={mockTasks} onTaskClick={onTaskClick} />);
    const bar1 = screen.getByTestId('task-bar-1');
    fireEvent.keyDown(bar1, { key: 'Enter' });
    expect(onTaskClick).toHaveBeenCalledWith(mockTasks[0]);
  });

  it('task bar responds to keyboard Space', () => {
    const onTaskClick = vi.fn();
    render(<GanttChart tasks={mockTasks} onTaskClick={onTaskClick} />);
    const bar1 = screen.getByTestId('task-bar-1');
    fireEvent.keyDown(bar1, { key: ' ' });
    expect(onTaskClick).toHaveBeenCalledWith(mockTasks[0]);
  });

  it('task row has role="button" and responds to keyboard', () => {
    const onTaskClick = vi.fn();
    render(<GanttChart tasks={mockTasks} onTaskClick={onTaskClick} />);
    const row1 = screen.getByTestId('task-row-1');
    expect(row1).toHaveAttribute('role', 'button');
    fireEvent.keyDown(row1, { key: 'Enter' });
    expect(onTaskClick).toHaveBeenCalledWith(mockTasks[0]);
  });

  it('shows loading skeleton when isLoading is true', () => {
    const { container } = render(<GanttChart tasks={[]} isLoading />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBeGreaterThan(0);
  });

  it('does not render task without dates as a bar', () => {
    render(<GanttChart tasks={mockTasks} />);
    // Task 3 has no dates
    expect(screen.queryByTestId('task-bar-3')).not.toBeInTheDocument();
  });

  it('includes progress in task row aria-label', () => {
    render(<GanttChart tasks={mockTasks} />);
    expect(screen.getByLabelText('Task 1, 50% complete')).toBeInTheDocument();
    expect(screen.getByLabelText('Task 2, 100% complete')).toBeInTheDocument();
    expect(screen.getByLabelText('Task without dates, 0% complete')).toBeInTheDocument();
  });
});
