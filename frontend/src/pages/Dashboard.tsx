import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart3, CheckCircle2, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { format, isBefore, addDays } from 'date-fns';
import { useStore } from '@/store';
import { tasks as tasksApi, calendar as calendarApi, users as usersApi, agents as agentsApi } from '@/lib/api';
import { TaskCard } from '@/components/TaskCard';
import { TaskModal } from '@/components/TaskModal';
import { useToast } from '@/components/Toast';
import { EmptyProjectState } from '@/components/EmptyProjectState';
import { QueryError } from '@/components/QueryError';
import { AgentTasksPanel } from '@/components/AgentTasksPanel';
import type { Task, CalendarEvent, CreateTaskInput, UpdateTaskInput } from '@/types';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  change?: string;
}

function StatCard({ title, value, icon, color, change }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">{value}</p>
          {change && (
            <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp size={14} aria-hidden="true" />
              {change}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>
    </div>
  );
}

function TaskCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800/80 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-600">
      <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
      <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-14 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-7 w-7 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      </div>
    </div>
  );
}

function UpcomingCardSkeleton() {
  return (
    <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
      <div className="h-5 w-3/4 bg-gray-300 dark:bg-gray-600 rounded animate-pulse mb-2" />
      <div className="h-4 w-1/2 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
    </div>
  );
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const { currentProject } = useStore();
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [agentId, setAgentId] = useState(() => {
    return localStorage.getItem('projecthub_agent_id') || '';
  });
  const authToken = localStorage.getItem('token') || '';

  const { data: allTasks = [], isPending: isTasksPending, isError: isTasksError, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks', currentProject?.id],
    queryFn: () => tasksApi.list(currentProject?.id),
    enabled: !!currentProject,
  });

  const { data: upcomingTasks = [], isPending: isUpcomingPending } = useQuery({
    queryKey: ['upcoming', currentProject?.id],
    queryFn: async () => {
      const now = new Date();
      const weekFromNow = addDays(now, 7);
      const events = await calendarApi.tasks(
        format(now, 'yyyy-MM-dd'),
        format(weekFromNow, 'yyyy-MM-dd'),
        currentProject?.id
      );
      return events;
    },
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
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming'] });
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
      queryClient.invalidateQueries({ queryKey: ['upcoming'] });
      setIsModalOpen(false);
      setSelectedTask(null);
      toast('Task deleted.', 'success');
    },
    onError: () => { toast('Failed to delete task. Please try again.'); },
  });

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleSaveTask = (data: CreateTaskInput | UpdateTaskInput) => {
    if (selectedTask) {
      updateMutation.mutate({ id: selectedTask.id, data: data as UpdateTaskInput });
    }
  };

  const handleDeleteTask = () => {
    if (selectedTask) {
      deleteMutation.mutate(selectedTask.id);
    }
  };

  const { stats, completionRate, recentTasks, highPriorityTasks } = useMemo(() => {
    const sot = new Date();
    sot.setHours(0, 0, 0, 0);

    const s = {
      total: allTasks.length,
      completed: allTasks.filter((t) => t.status === 'done').length,
      inProgress: allTasks.filter((t) => t.status === 'in_progress').length,
      overdue: allTasks.filter(
        (t) => t.due_date && isBefore(new Date(t.due_date.includes('T') ? t.due_date : t.due_date + 'T00:00:00'), sot) && t.status !== 'done'
      ).length,
    };

    return {
      stats: s,
      completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      recentTasks: allTasks
        .filter((t) => t.status !== 'done')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
      highPriorityTasks: allTasks
        .filter((t) => (t.priority === 'high' || t.priority === 'urgent') && t.status !== 'done')
        .sort((a, b) => {
          const order: Record<string, number> = { urgent: 0, high: 1 };
          return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
        })
        .slice(0, 5),
    };
  }, [allTasks]);

  if (!currentProject) {
    return <EmptyProjectState feature="the dashboard" />;
  }

  return (
    <div className="p-6 space-y-6" data-testid="dashboard">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{currentProject.name}</h1>
        <p className="text-gray-500 dark:text-gray-400">{currentProject.description || 'Project Dashboard'}</p>
      </div>

      {isTasksError && !allTasks.length ? (
        <QueryError message="Failed to load dashboard data" onRetry={refetchTasks} />
      ) : isTasksError && allTasks.length > 0 ? (
        <div role="alert" className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-sm flex items-center justify-between rounded-lg">
          <span>Failed to refresh — showing cached data</span>
          <button onClick={() => refetchTasks()} className="underline hover:no-underline">Retry</button>
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isTasksPending ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Tasks"
              value={stats.total}
              icon={<BarChart3 size={24} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />}
              color="bg-blue-100 dark:bg-blue-900/50"
            />
            <StatCard
              title="Completed"
              value={stats.completed}
              icon={<CheckCircle2 size={24} className="text-green-600 dark:text-green-400" aria-hidden="true" />}
              color="bg-green-100 dark:bg-green-900/50"
              change={`${completionRate}% completion`}
            />
            <StatCard
              title="In Progress"
              value={stats.inProgress}
              icon={<Clock size={24} className="text-yellow-600 dark:text-yellow-400" aria-hidden="true" />}
              color="bg-yellow-100 dark:bg-yellow-900/50"
            />
            <StatCard
              title="Overdue"
              value={stats.overdue}
              icon={<AlertTriangle size={24} className="text-red-600 dark:text-red-400" aria-hidden="true" />}
              color="bg-red-100 dark:bg-red-900/50"
            />
          </>
        )}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Recent Tasks</h2>
          <div className="space-y-3">
            {isTasksPending ? (
              <>
                <TaskCardSkeleton />
                <TaskCardSkeleton />
                <TaskCardSkeleton />
              </>
            ) : recentTasks.length > 0 ? (
              recentTasks.map((task) => (
                <TaskCard key={task.id} task={task} onClick={() => handleTaskClick(task)} />
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No tasks yet</p>
            )}
          </div>
        </div>

        {/* High Priority */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <AlertTriangle size={20} className="text-red-500" aria-hidden="true" />
            High Priority
          </h2>
          <div className="space-y-3">
            {isTasksPending ? (
              <>
                <TaskCardSkeleton />
                <TaskCardSkeleton />
              </>
            ) : highPriorityTasks.length > 0 ? (
              highPriorityTasks.map((task) => (
                <TaskCard key={task.id} task={task} onClick={() => handleTaskClick(task)} />
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No high priority tasks</p>
            )}
          </div>
        </div>

        {/* Upcoming Due Dates */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Clock size={20} className="text-blue-500" aria-hidden="true" />
            Upcoming This Week
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {isUpcomingPending ? (
              <>
                <UpcomingCardSkeleton />
                <UpcomingCardSkeleton />
                <UpcomingCardSkeleton />
              </>
            ) : upcomingTasks.length > 0 ? (
              upcomingTasks.map((event: CalendarEvent) => {
                const task = allTasks.find((t) => t.id === event.id);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isOverdue = isBefore(new Date(event.start.includes('T') ? event.start : event.start + 'T00:00:00'), today) && event.status !== 'done';
                return (
                  <div
                    key={event.id}
                    role={task ? 'button' : undefined}
                    tabIndex={task ? 0 : undefined}
                    aria-label={task ? `View task: ${event.title}` : undefined}
                    onClick={() => task && handleTaskClick(task)}
                    onKeyDown={task ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTaskClick(task); } } : undefined}
                    className={`p-3 rounded-lg border transition-all ${
                      isOverdue
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-100 dark:border-gray-600'
                    } ${
                      task ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1' : 'cursor-default opacity-60'
                    }`}
                  >
                    <p className="font-medium truncate text-gray-900 dark:text-gray-100" title={event.title}>{event.title}</p>
                    <p className={`text-sm ${isOverdue ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {isOverdue ? 'Overdue: ' : 'Due: '}{format(new Date(event.start.includes('T') ? event.start : event.start + 'T00:00:00'), 'MMM d, yyyy')}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-4">
                No upcoming tasks this week
              </p>
            )}
          </div>
        </div>
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
        isSaving={updateMutation.isPending || deleteMutation.isPending}
      />

      {/* Agent Tasks */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-2">
          <label htmlFor="agent-id-input" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Agent Session ID:
          </label>
          <input
            id="agent-id-input"
            type="text"
            value={agentId}
            onChange={(e) => {
              setAgentId(e.target.value);
              localStorage.setItem('projecthub_agent_id', e.target.value);
            }}
            placeholder="Enter CLAUDE_SESSION_ID"
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-72"
          />
        </div>
        {agentId ? (
          <AgentTasksPanel agentId={agentId} authToken={authToken} />
        ) : (
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-4">
            Enter an agent session ID above to view its planned work items.
          </p>
        )}
      </div>
    </div>
  );
}
