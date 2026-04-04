import axios from 'axios';
import type {
  User, Project, Task, KanbanBoard, GanttTask, CalendarEvent,
  CreateTaskInput, UpdateTaskInput, UserBrief, Reminder,
  Agent, AgentAction, OrchestratorStatus, GitHubLink,
  AgentMessage, AgentDirective, TaskQueueItem, DirectiveType
} from '@/types';
import { useStore } from '@/store';

// Use relative URL so nginx can proxy to backend
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const publicApiPaths = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/auth/me'];
    if (error.response?.status === 401 && !publicApiPaths.some(p => error.config?.url?.startsWith(p))) {
      useStore.getState().logout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============ Auth ============
export const auth = {
  login: async (username: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    const { data } = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    localStorage.setItem('token', data.access_token);
    return data;
  },

  register: async (email: string, username: string, password: string, full_name?: string) => {
    const { data } = await api.post<User>('/auth/register', {
      email, username, password, full_name,
    });
    return data;
  },

  me: async () => {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  logout: () => {
    localStorage.removeItem('token');
  },

  forgotPassword: async (emailOrUsername: string) => {
    // NOTE: reset_token in response is a dev convenience — production should deliver via email only
    const { data } = await api.post<{ message: string; reset_token?: string }>(
      '/auth/forgot-password',
      { email_or_username: emailOrUsername }
    );
    return data;
  },

  resetPassword: async (token: string, newPassword: string) => {
    const { data } = await api.post<{ message: string }>(
      '/auth/reset-password',
      { token, new_password: newPassword }
    );
    return data;
  },
};

// ============ Projects ============
export const projects = {
  list: async (includeArchived = false) => {
    const { data } = await api.get<Project[]>('/projects/', {
      params: { include_archived: includeArchived },
    });
    return data;
  },

  get: async (id: number) => {
    const { data } = await api.get<Project>(`/projects/${id}`);
    return data;
  },

  create: async (project: Partial<Project>) => {
    const { data } = await api.post<Project>('/projects/', project);
    return data;
  },

  update: async (id: number, project: Partial<Project>) => {
    const { data } = await api.put<Project>(`/projects/${id}`, project);
    return data;
  },

  delete: async (id: number) => {
    await api.delete(`/projects/${id}`);
  },
};

// ============ Tasks ============
export const tasks = {
  list: async (projectId?: number, status?: string, includeSubtasks = false) => {
    const { data } = await api.get<Task[]>('/tasks/', {
      params: { project_id: projectId, status, include_subtasks: includeSubtasks },
    });
    return data;
  },

  get: async (id: number) => {
    const { data } = await api.get<Task>(`/tasks/${id}`);
    return data;
  },

  create: async (task: CreateTaskInput) => {
    const { data } = await api.post<Task>('/tasks/', task);
    return data;
  },

  update: async (id: number, task: UpdateTaskInput) => {
    const { data } = await api.put<Task>(`/tasks/${id}`, task);
    return data;
  },

  delete: async (id: number) => {
    await api.delete(`/tasks/${id}`);
  },

  reorder: async (updates: { id: number; position: number; status?: string; parent_id?: number }[]) => {
    await api.post('/tasks/reorder', updates);
  },

  adjustDates: async (taskId: number, newEndDate: string) => {
    const { data } = await api.post(`/tasks/${taskId}/adjust-dates`, null, {
      params: { new_end_date: newEndDate },
    });
    return data;
  },

  // Gantt view
  gantt: async (projectId: number) => {
    const { data } = await api.get<GanttTask[]>(`/tasks/gantt/${projectId}`);
    return data;
  },

  // Kanban view
  kanban: async (projectId: number) => {
    const { data } = await api.get<KanbanBoard>(`/tasks/kanban/${projectId}`);
    return data;
  },

  // Reminders
  createReminder: async (taskId: number, remind_at: string, message?: string) => {
    const { data } = await api.post<Reminder>(`/tasks/${taskId}/reminders`, {
      task_id: taskId,
      remind_at,
      message,
    });
    return data;
  },

  getReminders: async (taskId: number) => {
    const { data } = await api.get<Reminder[]>(`/tasks/${taskId}/reminders`);
    return data;
  },

  deleteReminder: async (reminderId: number) => {
    await api.delete(`/tasks/reminders/${reminderId}`);
  },
};

// ============ Users ============
export const users = {
  list: async () => {
    const { data } = await api.get<UserBrief[]>('/users/');
    return data;
  },

  updateMe: async (userData: Partial<User>) => {
    const { data } = await api.put<User>('/users/me', userData);
    return data;
  },

  create: async (userData: {
    email: string;
    username: string;
    password: string;
    full_name?: string;
    avatar_color?: string;
  }) => {
    const { data } = await api.post<User>('/users/', userData);
    return data;
  },
};

// ============ Calendar ============
export const calendar = {
  tasks: async (startDate: string, endDate: string, projectId?: number) => {
    const { data } = await api.get<CalendarEvent[]>('/calendar/tasks', {
      params: { start_date: startDate, end_date: endDate, project_id: projectId },
    });
    return data;
  },

  upcoming: async (days = 7) => {
    const { data } = await api.get('/calendar/upcoming', {
      params: { days },
    });
    return data;
  },
};

// ============ Pluteus Integration ============
export const pluteus = {
  status: async () => {
    const { data } = await api.get('/integrations/pluteus/status');
    return data as { configured: boolean; reachable: boolean; url?: string };
  },

  decisions: async (correlationId?: string) => {
    const params = correlationId ? { correlation_id: correlationId } : {};
    const { data } = await api.get('/integrations/pluteus/decisions', { params });
    return data as PluteusDecision[];
  },

  search: async (query: string) => {
    const { data } = await api.get('/integrations/pluteus/search', { params: { q: query } });
// ============ Agents ============
export const agents = {
  list: async () => {
    const { data } = await api.get<Agent[]>('/agents/');
    return data;
  },

  get: async (id: number) => {
    const { data } = await api.get<Agent>(`/agents/${id}`);
    return data;
  },

  getActions: async (id: number, limit = 50) => {
    const { data } = await api.get<AgentAction[]>(`/agents/${id}/actions`, {
      params: { limit },
    });
    return data;
  },

  getGlobalFeed: async (limit = 100) => {
    const { data } = await api.get<AgentAction[]>('/agents/actions/feed', {
      params: { limit },
    });
    return data;
  },

  delete: async (id: number) => {
    await api.delete(`/agents/${id}`);
  },

  orchestratorStatus: async () => {
    const { data } = await api.get<OrchestratorStatus>('/agents/orchestrator/status');
    return data;
  },

  getGitHubLinks: async (taskId: number) => {
    const { data } = await api.get<GitHubLink[]>(`/agents/github-links/${taskId}`);
    return data;
  },

  // Coordination: Messages
  getInbox: async (agentId: number, limit = 50) => {
    const { data } = await api.get<AgentMessage[]>(`/agents/${agentId}/messages/inbox`, {
      params: { limit },
    });
    return data;
  },

  getOutbox: async (agentId: number, limit = 50) => {
    const { data } = await api.get<AgentMessage[]>(`/agents/${agentId}/messages/outbox`, {
      params: { limit },
    });
    return data;
  },

  getThread: async (threadId: string) => {
    const { data } = await api.get<AgentMessage[]>(`/agents/messages/threads/${threadId}`);
    return data;
  },

  // Coordination: Directives
  sendDirective: async (agentId: number, directiveType: DirectiveType, payload?: Record<string, unknown>) => {
    const { data } = await api.post<AgentDirective>(`/agents/${agentId}/directives`, {
      directive_type: directiveType,
      payload,
    });
    return data;
  },

  getDirectives: async (agentId: number, pendingOnly = false) => {
    const { data } = await api.get<AgentDirective[]>(`/agents/${agentId}/directives`, {
      params: { pending_only: pendingOnly },
    });
    return data;
  },

  // Coordination: Task Queue
  getTaskQueue: async (projectId?: number, limit = 50) => {
    const { data } = await api.get<TaskQueueItem[]>('/agents/queue', {
      params: { project_id: projectId, limit },
    });
    return data;
  },
};

export interface PluteusDecision {
  ID: number;
  AmphoraNodeID: string;
  Title: string;
  Question: string;
  ChosenOption: string;
  Tier: string;
  Confidence: string;
  URL: string;
  UpdatedAt: string;
}

export default api;
