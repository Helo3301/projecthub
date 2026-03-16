import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Plus } from 'lucide-react';
import { useStore } from '@/store';
import { calendar as calendarApi, tasks as tasksApi, users as usersApi, agents as agentsApi } from '@/lib/api';
import { CalendarView } from '@/components/CalendarView';
import { TaskModal } from '@/components/TaskModal';
import { useToast } from '@/components/Toast';
import { EmptyProjectState } from '@/components/EmptyProjectState';
import { QueryError } from '@/components/QueryError';
import type { CalendarEvent, Task, CreateTaskInput, UpdateTaskInput } from '@/types';

export function CalendarPage() {
  const queryClient = useQueryClient();
  const { currentProject } = useStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { toast } = useToast();

  const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: events = [], isPending: isEventsPending, isError: isEventsError, refetch: refetchEvents } = useQuery({
    queryKey: ['calendar', startDate, endDate, currentProject?.id],
    queryFn: () => calendarApi.tasks(startDate, endDate, currentProject?.id),
    enabled: !!currentProject,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const { data: agentsList = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setSelectedDate(null);
      toast('Task created successfully.', 'success');
    },
    onError: () => { toast('Failed to create task. Please try again.'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTaskInput }) =>
      tasksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setSelectedTask(null);
      toast('Task updated successfully.', 'success');
    },
    onError: () => { toast('Failed to update task. Please try again.'); },
  });

  const deleteMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setSelectedTask(null);
      toast('Task deleted.', 'success');
    },
    onError: () => { toast('Failed to delete task. Please try again.'); },
  });

  const handleMonthChange = useCallback((start: Date, _end: Date) => {
    setCurrentMonth(start);
  }, []);

  const eventClickIdRef = useRef(0);
  const handleEventClick = useCallback(async (event: CalendarEvent) => {
    const clickId = ++eventClickIdRef.current;
    setSelectedDate(null);
    try {
      const task = await tasksApi.get(event.id);
      if (clickId !== eventClickIdRef.current) return;
      setSelectedTask(task);
      setIsModalOpen(true);
    } catch {
      if (clickId !== eventClickIdRef.current) return;
      toast('Failed to load task details. Please try again.');
    }
  }, [toast]);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  const handleSaveTask = (data: CreateTaskInput | UpdateTaskInput) => {
    if (selectedTask) {
      updateMutation.mutate({ id: selectedTask.id, data: data as UpdateTaskInput });
    } else if (currentProject) {
      const taskData: CreateTaskInput = {
        ...data,
        project_id: currentProject.id,
        due_date: (data as CreateTaskInput).due_date ?? (selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined),
      } as CreateTaskInput;
      createMutation.mutate(taskData);
    }
  };

  const handleDeleteTask = () => {
    if (selectedTask) {
      deleteMutation.mutate(selectedTask.id);
    }
  };

  if (!currentProject) {
    return <EmptyProjectState feature="the calendar" />;
  }

  return (
    <div className="h-full flex flex-col p-6" data-testid="calendar-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Calendar</h1>
          <p className="text-gray-500 dark:text-gray-400">{currentProject.name}</p>
        </div>
        <button
          onClick={() => {
            setSelectedDate(new Date());
            setSelectedTask(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          <Plus size={20} aria-hidden="true" />
          Add Task
        </button>
      </div>

      {/* Calendar */}
      {isEventsError && events.length > 0 && (
        <div role="alert" className="mb-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-sm flex items-center justify-between rounded-lg">
          <span>Failed to refresh — showing cached data</span>
          <button onClick={() => refetchEvents()} className="underline hover:no-underline">Retry</button>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {isEventsError && !events.length ? (
          <QueryError message="Failed to load calendar events" onRetry={refetchEvents} />
        ) : (
          <CalendarView
            events={events}
            isLoading={isEventsPending}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
            onMonthChange={handleMonthChange}
          />
        )}
      </div>

      {/* Task Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTask(null);
          setSelectedDate(null);
        }}
        onSave={handleSaveTask}
        onDelete={selectedTask ? handleDeleteTask : undefined}
        task={selectedTask}
        projectId={currentProject.id}
        users={users}
        agents={agentsList}
        isSaving={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
      />
    </div>
  );
}
