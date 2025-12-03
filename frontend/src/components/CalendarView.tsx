import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import type { CalendarEvent } from '@/types';

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  onMonthChange?: (start: Date, end: Date) => void;
}

const priorityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-red-100 text-red-800 border-red-200',
  urgent: 'bg-purple-100 text-purple-800 border-purple-200',
};

export function CalendarView({
  events,
  onEventClick,
  onDateClick,
  onMonthChange,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    return events.filter((event) => {
      const eventDate = new Date(event.start);
      return isSameDay(eventDate, date);
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = direction === 'prev' ? subMonths(currentMonth, 1) : addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    onMonthChange?.(startOfMonth(newMonth), endOfMonth(newMonth));
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(now);
    onMonthChange?.(startOfMonth(now), endOfMonth(now));
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-lg border border-gray-200" data-testid="calendar-view">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Previous month"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold min-w-[180px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Next month"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <button
          onClick={goToToday}
          className="px-4 py-2 text-sm bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200"
        >
          Today
        </button>
      </div>

      {/* Week Day Headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-3 text-center text-sm font-medium text-gray-600 bg-gray-50"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => {
          const dayEvents = getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDateClick?.(day)}
              className={`min-h-[120px] p-2 border-b border-r border-gray-100 cursor-pointer hover:bg-gray-50 ${
                !isCurrentMonth ? 'bg-gray-50' : ''
              }`}
              data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
            >
              {/* Date Number */}
              <div className="flex items-center justify-center mb-1">
                <span
                  className={`w-7 h-7 flex items-center justify-center text-sm rounded-full ${
                    isCurrentDay
                      ? 'bg-primary-500 text-white font-bold'
                      : isCurrentMonth
                      ? 'text-gray-900'
                      : 'text-gray-400'
                  }`}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event);
                    }}
                    className={`px-2 py-1 text-xs rounded border truncate cursor-pointer hover:opacity-80 ${
                      priorityColors[event.priority] || 'bg-gray-100 text-gray-800 border-gray-200'
                    }`}
                    style={event.color ? { backgroundColor: event.color, borderColor: event.color, color: 'white' } : undefined}
                    title={event.title}
                    data-testid={`event-${event.id}`}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 text-center">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
