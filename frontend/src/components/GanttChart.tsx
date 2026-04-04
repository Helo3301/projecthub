import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  differenceInDays,
  addMonths,
  subMonths,
  addDays,
  isWeekend,
  isSameDay,
} from 'date-fns';
import type { GanttTask } from '@/types';

interface GanttChartProps {
  tasks: GanttTask[];
  onTaskClick?: (task: GanttTask) => void;
  onDateChange?: (taskId: number, startDate: Date, endDate: Date) => void;
  isLoading?: boolean;
}

export function GanttChart({ tasks, onTaskClick, onDateChange, isLoading }: GanttChartProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const timelineRef = useRef<HTMLDivElement>(null);

  // Drag state for resizing bars
  const [dragState, setDragState] = useState<{
    taskId: number;
    startX: number;
    originalEndDate: Date;
    originalStartDate: Date;
    dayWidth: number;
    originalBarWidth: number;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const raw = e.clientX - dragState.startX;
      // Clamp so bar never shrinks below 1 day width
      const minOffset = -(dragState.originalBarWidth - dragState.dayWidth);
      setDragOffset(Math.max(minOffset, raw));
    };

    const handleMouseUp = (e: MouseEvent) => {
      const rawOffset = e.clientX - dragState.startX;
      const minOffset = -(dragState.originalBarWidth - dragState.dayWidth);
      const totalOffset = Math.max(minOffset, rawOffset);
      const daysDelta = Math.round(totalOffset / dragState.dayWidth);
      if (daysDelta !== 0 && onDateChange) {
        const newEndDate = addDays(dragState.originalEndDate, daysDelta);
        // Don't allow end date before start date
        if (newEndDate >= dragState.originalStartDate) {
          onDateChange(dragState.taskId, dragState.originalStartDate, newEndDate);
        }
      }
      setDragState(null);
      setDragOffset(0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, onDateChange]);

  const dateRange = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const getTaskPosition = useCallback(
    (task: GanttTask) => {
      if (!task.start_date || !task.due_date) return null;

      const toLocal = (s: string) => new Date(s.includes('T') ? s : s + 'T00:00:00');
      const startDate = toLocal(task.start_date);
      const endDate = toLocal(task.due_date);
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

  const today = new Date();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" data-testid="gantt-chart">
      {/* Header Controls - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 gap-3">
        {/* Navigation */}
        <div className="flex items-center justify-center gap-1 sm:gap-2">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} className="sm:w-5 sm:h-5" aria-hidden="true" />
          </button>
          <h2 className="text-base sm:text-lg font-semibold min-w-[120px] sm:min-w-[150px] text-center text-gray-900 dark:text-gray-100">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => navigateMonth('next')}
            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Next month"
          >
            <ChevronRight size={18} className="sm:w-5 sm:h-5" aria-hidden="true" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="ml-2 px-2 sm:px-3 py-1 text-xs sm:text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded hover:bg-primary-200 dark:hover:bg-primary-900/50"
            aria-label={`Go to today, ${format(today, 'MMMM yyyy')}`}
          >
            Today
          </button>
        </div>
      </div>

      <div className="flex overflow-hidden">
        {/* Task List - Narrower on mobile */}
        <div className="w-24 sm:w-40 md:w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700">
          <div className="h-10 sm:h-12 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 px-2 sm:px-4 flex items-center">
            <span className="font-medium text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Task Name</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 sm:h-12 px-2 sm:px-4 flex items-center gap-1 sm:gap-2 animate-pulse">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0 bg-gray-200 dark:bg-gray-600" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded" style={{ width: `${50 + i * 10}%` }} />
                </div>
              ))
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${task.title}, ${Math.round(task.progress)}% complete`}
                  className="h-10 sm:h-12 px-2 sm:px-4 flex items-center gap-1 sm:gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => onTaskClick?.(task)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTaskClick?.(task); } }}
                  data-testid={`task-row-${task.id}`}
                >
                  <div
                    className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: task.color || '#6366F1' }}
                  />
                  <span className="truncate text-xs sm:text-sm text-gray-900 dark:text-gray-100" title={task.title}>{task.title}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-x-auto" ref={timelineRef}>
          {/* Date Headers */}
          <div className="h-10 sm:h-12 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex min-w-max">
            {dateRange.map((date) => (
              <div
                key={date.toISOString()}
                className={`w-8 sm:w-10 md:min-w-[40px] flex-shrink-0 flex flex-col items-center justify-center border-r border-gray-100 dark:border-gray-600 text-[10px] sm:text-xs ${
                  isWeekend(date) ? 'bg-gray-100 dark:bg-gray-600' : ''
                } ${isSameDay(date, today) ? 'bg-primary-50 dark:bg-primary-900/30' : ''}`}
              >
                <span className="text-gray-500 dark:text-gray-400 hidden sm:block">{format(date, 'EEE')}</span>
                <span className="text-gray-500 dark:text-gray-400 sm:hidden">{format(date, 'EEEEE')}</span>
                <span className={`font-medium text-gray-900 dark:text-gray-100 ${isSameDay(date, today) ? 'text-primary-600 dark:text-primary-400' : ''}`}>
                  {format(date, 'd')}
                </span>
              </div>
            ))}
          </div>

          {/* Task Bars */}
          <div className="relative min-w-max">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 sm:h-12 relative border-b border-gray-100 dark:border-gray-700">
                  <div className="absolute inset-0 flex">
                    {dateRange.map((date) => (
                      <div
                        key={date.toISOString()}
                        className={`w-8 sm:w-10 md:min-w-[40px] flex-shrink-0 border-r border-gray-100 dark:border-gray-700 ${
                          isWeekend(date) ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                        }`}
                      />
                    ))}
                  </div>
                  <div
                    className="absolute top-1.5 sm:top-2 h-7 sm:h-8 rounded-md bg-gray-200 dark:bg-gray-600 animate-pulse"
                    style={{
                      left: ['5%', '15%', '10%', '20%'][i],
                      width: ['30%', '45%', '25%', '35%'][i],
                    }}
                  />
                </div>
              ))
            ) : null}
            {!isLoading && tasks.map((task) => {
              const position = getTaskPosition(task);
              return (
                <div
                  key={task.id}
                  className="h-10 sm:h-12 relative border-b border-gray-100 dark:border-gray-700"
                  data-testid={`task-timeline-${task.id}`}
                >
                  {/* Background grid */}
                  <div className="absolute inset-0 flex">
                    {dateRange.map((date) => (
                      <div
                        key={date.toISOString()}
                        className={`w-8 sm:w-10 md:min-w-[40px] flex-shrink-0 border-r border-gray-100 dark:border-gray-700 ${
                          isWeekend(date) ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                        } ${isSameDay(date, today) ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''}`}
                      />
                    ))}
                  </div>

                  {/* Task bar */}
                  {position && (() => {
                    const isDragging = dragState?.taskId === task.id;
                    const extraWidth = isDragging ? dragOffset : 0;
                    return (
                      <div
                        className={`absolute top-1.5 sm:top-2 h-7 sm:h-8 rounded-md cursor-pointer hover:opacity-90 transition-opacity flex items-center overflow-hidden ${isDragging ? 'opacity-80 z-20' : ''}`}
                        style={{
                          left: position.left,
                          width: `calc(${position.width} + ${extraWidth}px)`,
                          minWidth: '8px',
                          backgroundColor: task.color || '#6366F1',
                        }}
                        role="button"
                        tabIndex={0}
                        onClick={() => !isDragging && onTaskClick?.(task)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!isDragging) onTaskClick?.(task); }
                          if (onDateChange && task.start_date && task.due_date && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
                            e.preventDefault();
                            const toLocal = (s: string) => new Date(s.includes('T') ? s : s + 'T00:00:00');
                            const startDate = toLocal(task.start_date);
                            const endDate = toLocal(task.due_date);
                            const delta = e.key === 'ArrowRight' ? 1 : -1;
                            const newEnd = addDays(endDate, delta);
                            if (newEnd >= startDate) onDateChange(task.id, startDate, newEnd);
                          }
                        }}
                        aria-label={`${task.title}${task.start_date && task.due_date ? `, ${format(new Date(task.start_date.includes('T') ? task.start_date : task.start_date + 'T00:00:00'), 'MMM d')} – ${format(new Date(task.due_date.includes('T') ? task.due_date : task.due_date + 'T00:00:00'), 'MMM d')}` : ''}, ${Math.round(task.progress)}% complete${onDateChange && task.start_date && task.due_date ? ', use arrow keys to resize' : ''}`}
                        data-testid={`task-bar-${task.id}`}
                      >
                        {/* Progress */}
                        <div
                          className="absolute inset-y-0 left-0 bg-black/20 rounded-l-md"
                          style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
                        />
                        <span className="relative z-10 text-white text-[10px] sm:text-xs font-medium px-1 sm:px-2 truncate">
                          {task.title}
                        </span>
                        {/* Drag handle on right edge */}
                        {onDateChange && task.start_date && task.due_date && (
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-r-md"
                            aria-hidden="true"
                            data-testid={`drag-handle-${task.id}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const timeline = timelineRef.current;
                              if (!timeline) return;
                              const dayWidth = timeline.scrollWidth / dateRange.length;
                              const toLocal = (s: string) => new Date(s.includes('T') ? s : s + 'T00:00:00');
                              const startDate = toLocal(task.start_date!);
                              const endDate = toLocal(task.due_date!);
                              const durationDays = differenceInDays(endDate, startDate) + 1;
                              setDragState({
                                taskId: task.id,
                                startX: e.clientX,
                                originalEndDate: endDate,
                                originalStartDate: startDate,
                                dayWidth,
                                originalBarWidth: durationDays * dayWidth,
                              });
                            }}
                          />
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}

            {/* Today line */}
            {dateRange.some((d) => isSameDay(d, today)) && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                aria-hidden="true"
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
      <div className="p-2 sm:p-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-3 sm:w-4 h-1.5 sm:h-2 bg-red-500 rounded" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-3 sm:w-4 h-3 sm:h-4 bg-gray-100 dark:bg-gray-600 rounded" />
          <span>Weekend</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-3 sm:w-4 h-3 sm:h-4 bg-primary-500/20 rounded relative">
            <div className="absolute inset-y-0 left-0 w-1/2 bg-black/20 rounded-l" />
          </div>
          <span>Progress</span>
        </div>
        {onDateChange && (
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="w-0.5 h-3 sm:h-4 bg-gray-400 dark:bg-gray-500 cursor-ew-resize" />
            <span>Drag edge to resize</span>
          </div>
        )}
      </div>
    </div>
  );
}
