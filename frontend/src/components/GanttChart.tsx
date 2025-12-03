import { useMemo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  differenceInDays,
  addMonths,
  subMonths,
  isWeekend,
  isSameDay,
} from 'date-fns';
import type { GanttTask } from '@/types';

interface GanttChartProps {
  tasks: GanttTask[];
  onTaskClick?: (task: GanttTask) => void;
  onDateChange?: (taskId: number, startDate: Date, endDate: Date) => void;
}

type ZoomLevel = 'day' | 'week' | 'month';

export function GanttChart({ tasks, onTaskClick, onDateChange }: GanttChartProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('day');

  const dateRange = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const getTaskPosition = useCallback(
    (task: GanttTask) => {
      if (!task.start_date || !task.due_date) return null;

      const startDate = new Date(task.start_date);
      const endDate = new Date(task.due_date);
      const rangeStart = dateRange[0];
      const rangeEnd = dateRange[dateRange.length - 1];

      // Check if task is visible in current range
      if (endDate < rangeStart || startDate > rangeEnd) return null;

      const visibleStart = startDate < rangeStart ? rangeStart : startDate;
      const visibleEnd = endDate > rangeEnd ? rangeEnd : endDate;

      const startOffset = differenceInDays(visibleStart, rangeStart);
      const duration = differenceInDays(visibleEnd, visibleStart) + 1;

      return {
        left: `${(startOffset / dateRange.length) * 100}%`,
        width: `${(duration / dateRange.length) * 100}%`,
      };
    },
    [dateRange]
  );

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
  };

  const getProgressColor = (progress: number): string => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 50) return 'bg-blue-500';
    if (progress >= 25) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const today = new Date();

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" data-testid="gantt-chart">
      {/* Header Controls - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b border-gray-200 gap-3">
        {/* Navigation */}
        <div className="flex items-center justify-center gap-1 sm:gap-2">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} className="sm:w-5 sm:h-5" />
          </button>
          <h2 className="text-base sm:text-lg font-semibold min-w-[120px] sm:min-w-[150px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => navigateMonth('next')}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Next month"
          >
            <ChevronRight size={18} className="sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="ml-2 px-2 sm:px-3 py-1 text-xs sm:text-sm bg-primary-100 text-primary-700 rounded hover:bg-primary-200"
          >
            Today
          </button>
        </div>
        {/* Zoom Controls - Hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1 border border-gray-200 rounded-lg p-1">
          <button
            onClick={() => setZoomLevel('day')}
            className={`px-2 py-1 text-sm rounded ${
              zoomLevel === 'day' ? 'bg-primary-500 text-white' : 'hover:bg-gray-100'
            }`}
          >
            Day
          </button>
          <button
            onClick={() => setZoomLevel('week')}
            className={`px-2 py-1 text-sm rounded ${
              zoomLevel === 'week' ? 'bg-primary-500 text-white' : 'hover:bg-gray-100'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setZoomLevel('month')}
            className={`px-2 py-1 text-sm rounded ${
              zoomLevel === 'month' ? 'bg-primary-500 text-white' : 'hover:bg-gray-100'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      <div className="flex overflow-hidden">
        {/* Task List - Narrower on mobile */}
        <div className="w-24 sm:w-40 md:w-64 flex-shrink-0 border-r border-gray-200">
          <div className="h-10 sm:h-12 border-b border-gray-200 bg-gray-50 px-2 sm:px-4 flex items-center">
            <span className="font-medium text-gray-700 text-xs sm:text-sm">Task Name</span>
          </div>
          <div className="divide-y divide-gray-100">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="h-10 sm:h-12 px-2 sm:px-4 flex items-center gap-1 sm:gap-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => onTaskClick?.(task)}
                data-testid={`task-row-${task.id}`}
              >
                <div
                  className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: task.color || '#6366F1' }}
                />
                <span className="truncate text-xs sm:text-sm">{task.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-x-auto">
          {/* Date Headers */}
          <div className="h-10 sm:h-12 border-b border-gray-200 bg-gray-50 flex min-w-max">
            {dateRange.map((date) => (
              <div
                key={date.toISOString()}
                className={`w-8 sm:w-10 md:min-w-[40px] flex-shrink-0 flex flex-col items-center justify-center border-r border-gray-100 text-[10px] sm:text-xs ${
                  isWeekend(date) ? 'bg-gray-100' : ''
                } ${isSameDay(date, today) ? 'bg-primary-50' : ''}`}
              >
                <span className="text-gray-500 hidden sm:block">{format(date, 'EEE')}</span>
                <span className="text-gray-500 sm:hidden">{format(date, 'EEEEE')}</span>
                <span className={`font-medium ${isSameDay(date, today) ? 'text-primary-600' : ''}`}>
                  {format(date, 'd')}
                </span>
              </div>
            ))}
          </div>

          {/* Task Bars */}
          <div className="relative min-w-max">
            {tasks.map((task) => {
              const position = getTaskPosition(task);
              return (
                <div
                  key={task.id}
                  className="h-10 sm:h-12 relative border-b border-gray-100"
                  data-testid={`task-timeline-${task.id}`}
                >
                  {/* Background grid */}
                  <div className="absolute inset-0 flex">
                    {dateRange.map((date) => (
                      <div
                        key={date.toISOString()}
                        className={`w-8 sm:w-10 md:min-w-[40px] flex-shrink-0 border-r border-gray-100 ${
                          isWeekend(date) ? 'bg-gray-50' : ''
                        } ${isSameDay(date, today) ? 'bg-primary-50/50' : ''}`}
                      />
                    ))}
                  </div>

                  {/* Task bar */}
                  {position && (
                    <div
                      className="absolute top-1.5 sm:top-2 h-7 sm:h-8 rounded-md cursor-pointer hover:opacity-90 transition-opacity flex items-center overflow-hidden"
                      style={{
                        left: position.left,
                        width: position.width,
                        backgroundColor: task.color || '#6366F1',
                      }}
                      onClick={() => onTaskClick?.(task)}
                      data-testid={`task-bar-${task.id}`}
                    >
                      {/* Progress */}
                      <div
                        className="absolute inset-y-0 left-0 bg-black/20 rounded-l-md"
                        style={{ width: `${task.progress}%` }}
                      />
                      <span className="relative z-10 text-white text-[10px] sm:text-xs font-medium px-1 sm:px-2 truncate">
                        {task.title}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Today line */}
            {dateRange.some((d) => isSameDay(d, today)) && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                style={{
                  left: `${
                    ((differenceInDays(today, dateRange[0]) + 0.5) / dateRange.length) * 100
                  }%`,
                }}
                data-testid="today-line"
              />
            )}
          </div>
        </div>
      </div>

      {/* Legend - Responsive */}
      <div className="p-2 sm:p-4 border-t border-gray-200 flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm text-gray-600">
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-3 sm:w-4 h-1.5 sm:h-2 bg-red-500 rounded" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-3 sm:w-4 h-3 sm:h-4 bg-gray-100 rounded" />
          <span>Weekend</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-3 sm:w-4 h-3 sm:h-4 bg-primary-500/20 rounded relative">
            <div className="absolute inset-y-0 left-0 w-1/2 bg-black/20 rounded-l" />
          </div>
          <span>Progress</span>
        </div>
      </div>
    </div>
  );
}
