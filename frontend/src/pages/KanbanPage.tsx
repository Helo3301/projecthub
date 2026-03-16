import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import { useStore } from '@/store';
import { tasks as tasksApi, users as usersApi, agents as agentsApi } from '@/lib/api';
import { KanbanBoard } from '@/components/KanbanBoard';
import { TaskModal } from '@/components/TaskModal';
import { useToast } from '@/components/Toast';
import { EmptyProjectState } from '@/components/EmptyProjectState';
import { QueryError } from '@/components/QueryError';
import type { Task, TaskStatus, TaskPriority, CreateTaskInput, UpdateTaskInput } from '@/types';

export function KanbanPage() {
  const queryClient = useQueryClient();
  const { currentProject } = useStore();
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('todo');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');

  const { data: tasks = [], isPending: isTasksPending, isError: isTasksError, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks', currentProject?.id],
    queryFn: () => tasksApi.list(currentProject?.id),
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

  const reorderMutation = useMutation({
    mutationFn: tasksApi.reorder,
    onMutate: async (updates) => {
      const projectId = currentProject?.id;
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] });
      const previous = queryClient.getQueryData<Task[]>(['tasks', projectId]);

      queryClient.setQueryData<Task[]>(['tasks', projectId], (old) => {
        if (!old) return old;
        const updateMap = new Map(updates.map((u) => [u.id, u]));
        return old.map((task) => {
          const update = updateMap.get(task.id);
          return update
            ? { ...task, status: update.status as TaskStatus, position: update.position }
            : task;
        });
      });

      return { previous, projectId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tasks', context.projectId], context.previous);
      }
      toast('Failed to move task. Please try again.');
    },
    onSettled: (_data, _err, _vars, context) => {
      if (context?.projectId != null) {
        queryClient.invalidateQueries({ queryKey: ['tasks', context.projectId] });
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      toast('Task created successfully.', 'success');
    },
    onError: () => { toast('Failed to create task. Please try again.'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTaskInput }) =>
      tasksApi.update(id, data),
    onSuccess: () => {
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
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setSelectedTask(null);
      toast('Task deleted.', 'success');
    },
    onError: () => { toast('Failed to delete task. Please try again.'); },
  });

  const { mutate: reorder } = reorderMutation;

  const handleTaskMove = useCallback(
    (taskId: number, newStatus: TaskStatus, newPosition: number) => {
      // Read latest tasks from query cache to avoid stale closure on rapid moves
      const latestTasks = queryClient.getQueryData<Task[]>(['tasks', currentProject?.id]) ?? tasks;
      const movedTask = latestTasks.find((t) => t.id === taskId);
      if (!movedTask) return;

      const oldStatus = movedTask.status;

      // Build reorder updates for the destination column
      const destTasks = latestTasks
        .filter((t) => t.status === newStatus && t.id !== taskId)
        .sort((a, b) => a.position - b.position);
      destTasks.splice(newPosition, 0, movedTask);
      const updates = destTasks.map((t, i) => ({
        id: t.id,
        position: i,
        ...(t.id === taskId ? { status: newStatus } : { status: t.status }),
      }));

      // If cross-column move, also reorder the source column
      if (oldStatus !== newStatus) {
        const srcTasks = latestTasks
          .filter((t) => t.status === oldStatus && t.id !== taskId)
          .sort((a, b) => a.position - b.position);
        srcTasks.forEach((t, i) => {
          updates.push({ id: t.id, position: i, status: oldStatus });
        });
      }

      reorder(updates);
    },
    [queryClient, tasks, reorder, currentProject?.id]
  );

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    }
    if (priorityFilter !== 'all') {
      result = result.filter((t) => t.priority === priorityFilter);
    }
    return result;
  }, [tasks, searchQuery, priorityFilter]);

  const isFiltered = searchQuery.trim() !== '' || priorityFilter !== 'all';

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleAddTask = (status: TaskStatus) => {
    setNewTaskStatus(status);
    setSelectedTask(null);
    setIsModalOpen(true);
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
    return <EmptyProjectState feature="the Kanban board" />;
  }

  return (
    <div className="h-full flex flex-col p-6" data-testid="kanban-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kanban Board</h1>
          <p className="text-gray-500 dark:text-gray-400">{currentProject.name}</p>
        </div>
        <button
          onClick={() => handleAddTask('todo')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          <Plus size={20} aria-hidden="true" />
          Add Task
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            aria-label="Search tasks"
            className="pl-9 pr-8 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent w-48"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Filter by priority">
          {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              aria-pressed={priorityFilter === p}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                priorityFilter === p
                  ? p === 'all' ? 'bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900'
                  : p === 'urgent' ? 'bg-purple-600 text-white'
                  : p === 'high' ? 'bg-red-600 text-white'
                  : p === 'medium' ? 'bg-yellow-500 text-white'
                  : 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        {isFiltered && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {filteredTasks.length} of {tasks.length} tasks
          </span>
        )}
      </div>

      {/* Kanban Board */}
      {isTasksError && tasks.length > 0 && (
        <div role="alert" className="mb-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-sm flex items-center justify-between rounded-lg">
          <span>Failed to refresh — showing cached data</span>
          <button onClick={() => refetchTasks()} className="underline hover:no-underline">Retry</button>
        </div>
      )}
      <div className="flex-1 min-h-0">
        {isTasksError && !tasks.length ? (
          <QueryError message="Failed to load tasks" onRetry={refetchTasks} />
        ) : (
          <KanbanBoard
            tasks={filteredTasks}
            isLoading={isTasksPending}
            onTaskMove={isFiltered ? undefined : handleTaskMove}
            onTaskClick={handleTaskClick}
            onAddTask={handleAddTask}
          />
        )}
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
        isSaving={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
        agents={agentsList}
        initialStatus={!selectedTask ? newTaskStatus : undefined}
      />
    </div>
  );
}
