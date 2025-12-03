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

  it('renders zoom level buttons', () => {
    render(<GanttChart tasks={mockTasks} />);

    expect(screen.getByText('Day')).toBeInTheDocument();
    expect(screen.getByText('Week')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
  });

  it('changes zoom level when buttons clicked', () => {
    render(<GanttChart tasks={mockTasks} />);

    const weekButton = screen.getByText('Week');
    fireEvent.click(weekButton);

    expect(weekButton).toHaveClass('bg-primary-500');
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
});
