import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useStore } from '@/store';
import { tasks as tasksApi, users as usersApi } from '@/lib/api';
import { KanbanBoard } from '@/components/KanbanBoard';
import { TaskModal } from '@/components/TaskModal';
import type { Task, TaskStatus, CreateTaskInput, UpdateTaskInput } from '@/types';

export function KanbanPage() {
  const queryClient = useQueryClient();
  const { currentProject } = useStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('todo');

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', currentProject?.id],
    queryFn: () => tasksApi.list(currentProject?.id),
    enabled: !!currentProject,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const reorderMutation = useMutation({
    mutationFn: tasksApi.reorder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTaskInput }) =>
      tasksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setSelectedTask(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsModalOpen(false);
      setSelectedTask(null);
    },
  });

  const handleTaskMove = useCallback(
    (taskId: number, newStatus: TaskStatus, newPosition: number) => {
      // Optimistic update
      const tasksByStatus = tasks.filter((t) => t.status === newStatus);
      const updates = [
        { id: taskId, position: newPosition, status: newStatus },
        ...tasksByStatus
          .filter((t) => t.id !== taskId)
          .map((t, i) => ({
            id: t.id,
            position: i >= newPosition ? i + 1 : i,
          })),
      ];

      reorderMutation.mutate(updates);
    },
    [tasks, reorderMutation]
  );

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
    } else {
      createMutation.mutate({
        ...data,
        status: newTaskStatus,
        project_id: currentProject?.id || 0,
      } as CreateTaskInput);
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
          <p className="text-gray-500 mt-2">Select a project from the sidebar to view the Kanban board</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6" data-testid="kanban-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kanban Board</h1>
          <p className="text-gray-500">{currentProject.name}</p>
        </div>
        <button
          onClick={() => handleAddTask('todo')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          <Plus size={20} />
          Add Task
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          tasks={tasks}
          onTaskMove={handleTaskMove}
          onTaskClick={handleTaskClick}
          onAddTask={handleAddTask}
        />
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
      />
    </div>
  );
}
