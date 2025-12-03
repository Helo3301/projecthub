import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Plus } from 'lucide-react';
import { useStore } from '@/store';
import { calendar as calendarApi, tasks as tasksApi, users as usersApi } from '@/lib/api';
import { CalendarView } from '@/components/CalendarView';
import { TaskModal } from '@/components/TaskModal';
import type { CalendarEvent, Task, CreateTaskInput, UpdateTaskInput } from '@/types';

export function CalendarPage() {
  const queryClient = useQueryClient();
  const { currentProject } = useStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: events = [] } = useQuery({
    queryKey: ['calendar', startDate, endDate, currentProject?.id],
    queryFn: () => calendarApi.tasks(startDate, endDate, currentProject?.id),
    enabled: !!currentProject,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTaskInput }) =>
      tasksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setSelectedTask(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setSelectedTask(null);
    },
  });

  const handleMonthChange = useCallback((start: Date, end: Date) => {
    setCurrentMonth(start);
  }, []);

  const handleEventClick = async (event: CalendarEvent) => {
    const task = await tasksApi.get(event.id);
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  const handleSaveTask = (data: CreateTaskInput | UpdateTaskInput) => {
    if (selectedTask) {
      updateMutation.mutate({ id: selectedTask.id, data: data as UpdateTaskInput });
    } else {
      const taskData: CreateTaskInput = {
        ...data,
        project_id: currentProject?.id || 0,
        due_date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined,
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
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">No Project Selected</h2>
          <p className="text-gray-500 mt-2">Select a project from the sidebar to view the calendar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6" data-testid="calendar-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500">{currentProject.name}</p>
        </div>
        <button
          onClick={() => {
            setSelectedDate(new Date());
            setSelectedTask(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          <Plus size={20} />
          Add Task
        </button>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-hidden">
        <CalendarView
          events={events}
          onEventClick={handleEventClick}
          onDateClick={handleDateClick}
          onMonthChange={handleMonthChange}
        />
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
      />
    </div>
  );
}
