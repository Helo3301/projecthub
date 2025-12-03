import axios from 'axios';
import type {
  User, Project, Task, KanbanBoard, GanttTask, CalendarEvent,
  CreateTaskInput, UpdateTaskInput, UserBrief, Reminder
} from '@/types';

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
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
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
    const { data } = await api.post<{ message: string; reset_token: string }>(
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
  list: async (projectId?: number, status?: string) => {
    const { data } = await api.get<Task[]>('/tasks/', {
      params: { project_id: projectId, status },
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

export default api;
