import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarView } from './CalendarView';
import type { CalendarEvent } from '@/types';
import { format, addDays, subMonths, addMonths } from 'date-fns';

const today = new Date();
const currentMonth = format(today, 'MMMM yyyy');

const mockEvents: CalendarEvent[] = [
  {
    id: 1,
    title: 'High Priority Task',
    start: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
    end: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
    priority: 'high',
    status: 'todo',
    color: '',
    project_id: 1,
    project_name: 'Test Project',
    assignees: [],
  },
  {
    id: 2,
    title: 'Low Priority Task',
    start: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
    end: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
    priority: 'low',
    status: 'in_progress',
    color: '',
    project_id: 1,
    project_name: 'Test Project',
    assignees: [],
  },
  {
    id: 3,
    title: 'Tomorrow Task',
    start: format(addDays(today, 1), "yyyy-MM-dd'T'HH:mm:ss"),
    end: format(addDays(today, 1), "yyyy-MM-dd'T'HH:mm:ss"),
    priority: 'medium',
    status: 'todo',
    color: '',
    project_id: 1,
    project_name: 'Test Project',
    assignees: [],
  },
  {
    id: 4,
    title: 'Colored Task',
    start: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
    end: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
    priority: 'medium',
    status: 'todo',
    color: '#FF5733',
    project_id: 1,
    project_name: 'Test Project',
    assignees: [],
  },
];

describe('CalendarView', () => {
  it('renders calendar view container', () => {
    render(<CalendarView events={[]} />);
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
  });

  it('displays current month and year', () => {
    render(<CalendarView events={[]} />);
    expect(screen.getByText(currentMonth)).toBeInTheDocument();
  });

  it('renders weekday headers', () => {
    render(<CalendarView events={[]} />);

    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
  });

  it('renders today date cell', () => {
    render(<CalendarView events={[]} />);

    const todayFormatted = format(today, 'yyyy-MM-dd');
    expect(screen.getByTestId(`calendar-day-${todayFormatted}`)).toBeInTheDocument();
  });

  it('renders events on correct dates', () => {
    render(<CalendarView events={mockEvents} />);

    expect(screen.getByText('High Priority Task')).toBeInTheDocument();
    expect(screen.getByText('Low Priority Task')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow Task')).toBeInTheDocument();
  });

  it('navigates to previous month', () => {
    render(<CalendarView events={[]} />);

    const prevButton = screen.getByRole('button', { name: /previous month/i });
    fireEvent.click(prevButton);

    const prevMonth = format(subMonths(today, 1), 'MMMM yyyy');
    expect(screen.getByText(prevMonth)).toBeInTheDocument();
  });

  it('navigates to next month', () => {
    render(<CalendarView events={[]} />);

    const nextButton = screen.getByRole('button', { name: /next month/i });
    fireEvent.click(nextButton);

    const nextMonth = format(addMonths(today, 1), 'MMMM yyyy');
    expect(screen.getByText(nextMonth)).toBeInTheDocument();
  });

  it('navigates back to current month on Today click', () => {
    render(<CalendarView events={[]} />);

    // Navigate away
    const nextButton = screen.getByRole('button', { name: /next month/i });
    fireEvent.click(nextButton);

    // Click today
    const todayButton = screen.getByText('Today');
    fireEvent.click(todayButton);

    expect(screen.getByText(currentMonth)).toBeInTheDocument();
  });

  it('calls onEventClick when event is clicked', () => {
    const onEventClick = vi.fn();
    render(<CalendarView events={mockEvents} onEventClick={onEventClick} />);

    fireEvent.click(screen.getByTestId('event-1'));
    expect(onEventClick).toHaveBeenCalledWith(mockEvents[0]);
  });

  it('calls onDateClick when date cell is clicked', () => {
    const onDateClick = vi.fn();
    render(<CalendarView events={[]} onDateClick={onDateClick} />);

    const todayFormatted = format(today, 'yyyy-MM-dd');
    fireEvent.click(screen.getByTestId(`calendar-day-${todayFormatted}`));

    expect(onDateClick).toHaveBeenCalled();
  });

  it('calls onMonthChange when navigating months', () => {
    const onMonthChange = vi.fn();
    render(<CalendarView events={[]} onMonthChange={onMonthChange} />);

    const nextButton = screen.getByRole('button', { name: /next month/i });
    fireEvent.click(nextButton);

    expect(onMonthChange).toHaveBeenCalled();
  });

  it('applies custom color to event', () => {
    render(<CalendarView events={mockEvents} />);

    const coloredEvent = screen.getByTestId('event-4');
    expect(coloredEvent).toHaveStyle({ backgroundColor: '#FF5733' });
  });

  it('applies priority-based styling to events', () => {
    render(<CalendarView events={mockEvents} />);

    const highPriorityEvent = screen.getByTestId('event-1');
    expect(highPriorityEvent).toHaveClass('bg-red-100');

    const lowPriorityEvent = screen.getByTestId('event-2');
    expect(lowPriorityEvent).toHaveClass('bg-green-100');
  });

  it('handles empty events array', () => {
    render(<CalendarView events={[]} />);
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
  });

  it('shows +more indicator for dates with many events', () => {
    const manyEvents: CalendarEvent[] = [
      ...mockEvents.filter(e => format(new Date(e.start), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')),
      {
        id: 5,
        title: 'Extra Task 1',
        start: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
        end: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
        priority: 'medium',
        status: 'todo',
        color: '',
        project_id: 1,
        project_name: 'Test Project',
        assignees: [],
      },
      {
        id: 6,
        title: 'Extra Task 2',
        start: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
        end: format(today, "yyyy-MM-dd'T'HH:mm:ss"),
        priority: 'medium',
        status: 'todo',
        color: '',
        project_id: 1,
        project_name: 'Test Project',
        assignees: [],
      },
    ];

    render(<CalendarView events={manyEvents} />);

    // Should show +X more indicator
    expect(screen.getByText(/\+\d+ more/)).toBeInTheDocument();
  });
});
