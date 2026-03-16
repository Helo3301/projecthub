import { useMemo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import type { CalendarEvent } from '@/types';

interface CalendarViewProps {
  events: CalendarEvent[];
  isLoading?: boolean;
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  onMonthChange?: (start: Date, end: Date) => void;
}

const priorityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700',
  high: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
  urgent: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700',
};

export function CalendarView({
  events,
  isLoading,
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

  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    return events.filter((event) => {
      // Force local-time interpretation for date-only strings to avoid UTC off-by-one
      const eventDate = new Date(event.start.includes('T') ? event.start : event.start + 'T00:00:00');
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      );
    });
  }, [events]);

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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" data-testid="calendar-view">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Previous month"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <h2 className="text-base sm:text-lg font-semibold min-w-[140px] sm:min-w-[180px] text-center text-gray-900 dark:text-gray-100">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => navigateMonth('next')}
            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Next month"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
        <button
          onClick={goToToday}
          className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 shrink-0"
          aria-label={`Go to today, ${format(new Date(), 'MMMM yyyy')}`}
        >
          Today
        </button>
      </div>

      {/* Calendar Grid */}
      <div aria-label={format(currentMonth, 'MMMM yyyy') + ' calendar'} role="region">
        {/* Week Day Headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-1.5 sm:p-3 text-center text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700"
            >
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.slice(0, 2)}</span>
            </div>
          ))}
        </div>

        {/* Calendar Rows */}
        {Array.from({ length: Math.ceil(calendarDays.length / 7) }, (_, weekIndex) => {
          const weekDaysSlice = calendarDays.slice(weekIndex * 7, weekIndex * 7 + 7);
          return (
            <div key={weekDaysSlice[0].toISOString()} className="grid grid-cols-7">
              {weekDaysSlice.map((day) => {
                const index = weekIndex * 7 + weekDaysSlice.indexOf(day);
          const dayEvents = isLoading ? [] : getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isToday(day);
          // Show shimmer placeholders on some days while loading
          const showLoadingShimmer = isLoading && isCurrentMonth && [2, 5, 8, 11, 17, 22].includes(index);

          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              onClick={() => onDateClick?.(day)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDateClick?.(day); } }}
              aria-label={`${format(day, 'EEEE, MMMM d, yyyy')}${dayEvents.length > 0 ? `, ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}` : ''}`}
              className={`min-h-[60px] sm:min-h-[120px] p-1 sm:p-2 border-b border-r border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 ${
                !isCurrentMonth ? 'bg-gray-50 dark:bg-gray-800/50' : ''
              }`}
              data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
            >
              {/* Date Number */}
              <div className="flex items-center justify-center mb-1">
                <span
                  className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-xs sm:text-sm rounded-full ${
                    isCurrentDay
                      ? 'bg-primary-500 text-white font-bold'
                      : isCurrentMonth
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Loading shimmer */}
              {showLoadingShimmer && (
                <>
                  <div className="hidden sm:block space-y-1">
                    <div className="h-5 w-full bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                  </div>
                  <div className="flex justify-center sm:hidden">
                    <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse" />
                  </div>
                </>
              )}

              {/* Events - dots on mobile, labels on desktop */}
              {/* Mobile: colored dots */}
              <div className="flex flex-wrap gap-1 justify-center sm:hidden">
                {dayEvents.slice(0, 4).map((event) => {
                  const dotColor = event.color || (
                    event.priority === 'urgent' ? '#A855F7' :
                    event.priority === 'high' ? '#EF4444' :
                    event.priority === 'medium' ? '#EAB308' : '#22C55E'
                  );
                  return (
                    <div
                      key={event.id}
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: dotColor }}
                      title={event.title}
                      aria-hidden="true"
                    />
                  );
                })}
                {dayEvents.length > 4 && (
                  <span className="text-[10px] text-gray-400">+{dayEvents.length - 4}</span>
                )}
              </div>
              {/* Desktop: full labels */}
              <div className="hidden sm:block space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onEventClick?.(event); } }}
                    className={`px-2 py-1 text-xs rounded border truncate cursor-pointer hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      priorityColors[event.priority] || 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                    }`}
                    style={event.color ? { backgroundColor: event.color, borderColor: event.color, color: 'white' } : undefined}
                    aria-label={event.title}
                    data-testid={`event-${event.id}`}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
