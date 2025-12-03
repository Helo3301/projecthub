import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CheckCircle2, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isAfter, isBefore, addDays } from 'date-fns';
import { useStore } from '@/store';
import { tasks as tasksApi, projects as projectsApi, calendar as calendarApi } from '@/lib/api';
import { TaskCard } from '@/components/TaskCard';
import type { Task, CalendarEvent } from '@/types';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  change?: string;
}

function StatCard({ title, value, icon, color, change }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {change && (
            <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp size={14} />
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

export function Dashboard() {
  const { currentProject } = useStore();

  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks', currentProject?.id],
    queryFn: () => tasksApi.list(currentProject?.id),
    enabled: !!currentProject,
  });

  const { data: upcomingTasks = [] } = useQuery({
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

  const stats = {
    total: allTasks.length,
    completed: allTasks.filter((t) => t.status === 'done').length,
    inProgress: allTasks.filter((t) => t.status === 'in_progress').length,
    overdue: allTasks.filter(
      (t) => t.due_date && isBefore(new Date(t.due_date), new Date()) && t.status !== 'done'
    ).length,
  };

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const recentTasks = allTasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const highPriorityTasks = allTasks
    .filter((t) => (t.priority === 'high' || t.priority === 'urgent') && t.status !== 'done')
    .slice(0, 5);

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">No Project Selected</h2>
          <p className="text-gray-500 mt-2">Select a project from the sidebar to view the dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="dashboard">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{currentProject.name}</h1>
        <p className="text-gray-500">{currentProject.description || 'Project Dashboard'}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Tasks"
          value={stats.total}
          icon={<BarChart3 size={24} className="text-blue-600" />}
          color="bg-blue-100"
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={<CheckCircle2 size={24} className="text-green-600" />}
          color="bg-green-100"
          change={`${completionRate}% completion`}
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={<Clock size={24} className="text-yellow-600" />}
          color="bg-yellow-100"
        />
        <StatCard
          title="Overdue"
          value={stats.overdue}
          icon={<AlertTriangle size={24} className="text-red-600" />}
          color="bg-red-100"
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Tasks</h2>
          <div className="space-y-3">
            {recentTasks.length > 0 ? (
              recentTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No tasks yet</p>
            )}
          </div>
        </div>

        {/* High Priority */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" />
            High Priority
          </h2>
          <div className="space-y-3">
            {highPriorityTasks.length > 0 ? (
              highPriorityTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No high priority tasks</p>
            )}
          </div>
        </div>

        {/* Upcoming Due Dates */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock size={20} className="text-blue-500" />
            Upcoming This Week
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingTasks.length > 0 ? (
              upcomingTasks.map((event: CalendarEvent) => (
                <div
                  key={event.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <p className="font-medium truncate">{event.title}</p>
                  <p className="text-sm text-gray-500">
                    Due: {format(new Date(event.start), 'MMM d, yyyy')}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 col-span-full text-center py-4">
                No upcoming tasks this week
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
