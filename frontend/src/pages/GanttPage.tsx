import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@/store';
import { tasks as tasksApi, users as usersApi } from '@/lib/api';
import { GanttChart } from '@/components/GanttChart';
import { TaskModal } from '@/components/TaskModal';
import type { GanttTask, Task, UpdateTaskInput } from '@/types';

export function GanttPage() {
  const queryClient = useQueryClient();
  const { currentProject } = useStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: ganttTasks = [] } = useQuery({
    queryKey: ['gantt', currentProject?.id],
    queryFn: () => tasksApi.gantt(currentProject!.id),
    enabled: !!currentProject,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTaskInput }) =>
      tasksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gantt'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setSelectedTask(null);
    },
  });

  const adjustDatesMutation = useMutation({
    mutationFn: ({ taskId, newEndDate }: { taskId: number; newEndDate: string }) =>
      tasksApi.adjustDates(taskId, newEndDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gantt'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gantt'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setSelectedTask(null);
    },
  });

  const handleTaskClick = async (ganttTask: GanttTask) => {
    // Fetch full task details
    const task = await tasksApi.get(ganttTask.id);
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleDateChange = (taskId: number, startDate: Date, endDate: Date) => {
    adjustDatesMutation.mutate({
      taskId,
      newEndDate: endDate.toISOString(),
    });
  };

  const handleSaveTask = (data: UpdateTaskInput) => {
    if (selectedTask) {
      updateMutation.mutate({ id: selectedTask.id, data });
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
          <p className="text-gray-500 mt-2">Select a project from the sidebar to view the Gantt chart</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 sm:p-6" data-testid="gantt-page">
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gantt Chart</h1>
          <p className="text-sm sm:text-base text-gray-500">{currentProject.name}</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm sm:text-base"
        >
          <span className="text-lg">+</span>
          <span>Add Task</span>
        </button>
      </div>

      {/* Gantt Chart */}
      <div className="flex-1 overflow-hidden">
        <GanttChart
          tasks={ganttTasks}
          onTaskClick={handleTaskClick}
          onDateChange={handleDateChange}
        />
      </div>

      {/* Info - Responsive */}
      <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-blue-50 rounded-lg text-xs sm:text-sm text-blue-700">
        <strong>Tip:</strong> When you extend a task's due date, all dependent tasks will automatically
        shift forward to maintain the dependency chain.
      </div>

      {/* Task Modal */}
      {selectedTask && (
        <TaskModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTask(null);
          }}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          task={selectedTask}
          projectId={currentProject.id}
          users={users}
        />
      )}
    </div>
  );
}
