import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@/store';
import { tasks as tasksApi, users as usersApi, agents as agentsApi } from '@/lib/api';
import { GanttChart } from '@/components/GanttChart';
import { TaskModal } from '@/components/TaskModal';
import { useToast } from '@/components/Toast';
import { EmptyProjectState } from '@/components/EmptyProjectState';
import { QueryError } from '@/components/QueryError';
import type { GanttTask, Task, CreateTaskInput, UpdateTaskInput } from '@/types';

export function GanttPage() {
  const queryClient = useQueryClient();
  const { currentProject } = useStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  const { data: ganttTasks = [], isPending: isGanttPending, isError: isGanttError, refetch: refetchGantt } = useQuery({
    queryKey: ['gantt', currentProject?.id],
    queryFn: () => tasksApi.gantt(currentProject!.id),
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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTaskInput }) =>
      tasksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gantt'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setSelectedTask(null);
      toast('Task updated successfully.', 'success');
    },
    onError: () => { toast('Failed to update task. Please try again.'); },
  });

  const adjustDatesMutation = useMutation({
    mutationFn: ({ taskId, newEndDate }: { taskId: number; newEndDate: string }) =>
      tasksApi.adjustDates(taskId, newEndDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gantt'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => { toast('Failed to adjust dates. Please try again.'); },
  });

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gantt'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setSelectedTask(null);
      toast('Task created successfully.', 'success');
    },
    onError: () => { toast('Failed to create task. Please try again.'); },
  });

  const deleteMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gantt'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setSelectedTask(null);
      toast('Task deleted.', 'success');
    },
    onError: () => { toast('Failed to delete task. Please try again.'); },
  });

  const taskClickIdRef = useRef(0);
  const handleTaskClick = useCallback(async (ganttTask: GanttTask) => {
    const clickId = ++taskClickIdRef.current;
    try {
      const task = await tasksApi.get(ganttTask.id);
      if (clickId !== taskClickIdRef.current) return;
      setSelectedTask(task);
      setIsModalOpen(true);
    } catch {
      if (clickId !== taskClickIdRef.current) return;
      toast('Failed to load task details. Please try again.');
    }
  }, [toast]);

  // API only accepts newEndDate — server shifts dependent tasks automatically.
  // startDate changes are derived server-side from the dependency chain.
  const handleDateChange = (taskId: number, _startDate: Date, endDate: Date) => {
    adjustDatesMutation.mutate({
      taskId,
      newEndDate: endDate.toISOString().split('T')[0],
    });
  };

  const handleSaveTask = (data: CreateTaskInput | UpdateTaskInput) => {
    if (selectedTask) {
      updateMutation.mutate({ id: selectedTask.id, data: data as UpdateTaskInput });
    } else if (currentProject) {
      createMutation.mutate({
        ...data,
        project_id: currentProject.id,
      } as CreateTaskInput);
    }
  };

  const handleDeleteTask = () => {
    if (selectedTask) {
      deleteMutation.mutate(selectedTask.id);
    }
  };

  if (!currentProject) {
    return <EmptyProjectState feature="the Gantt chart" />;
  }

  return (
    <div className="h-full flex flex-col p-4 sm:p-6" data-testid="gantt-page">
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Gantt Chart</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">{currentProject.name}</p>
        </div>
        <button
          onClick={() => { setSelectedTask(null); setIsModalOpen(true); }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm sm:text-base"
        >
          <span className="text-lg" aria-hidden="true">+</span>
          <span>Add Task</span>
        </button>
      </div>

      {/* Gantt Chart */}
      {isGanttError && ganttTasks.length > 0 && (
        <div role="alert" className="mb-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-sm flex items-center justify-between rounded-lg">
          <span>Failed to refresh — showing cached data</span>
          <button onClick={() => refetchGantt()} className="underline hover:no-underline">Retry</button>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {isGanttError && !ganttTasks.length ? (
          <QueryError message="Failed to load Gantt data" onRetry={refetchGantt} />
        ) : (
          <GanttChart
            tasks={ganttTasks}
            isLoading={isGanttPending}
            onTaskClick={handleTaskClick}
            onDateChange={handleDateChange}
          />
        )}
      </div>

      {/* Info - Responsive */}
      <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-xs sm:text-sm text-blue-700 dark:text-blue-300">
        <strong>Tip:</strong> When you extend a task's due date, all dependent tasks will automatically
        shift forward to maintain the dependency chain.
      </div>

      {/* Task Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTask(null);
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
