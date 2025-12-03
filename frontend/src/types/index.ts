export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface User {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  avatar_color: string;
  is_active: boolean;
  created_at: string;
}

export interface UserBrief {
  id: number;
  username: string;
  full_name?: string;
  avatar_color: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  color: string;
  icon: string;
  owner_id: number;
  is_archived: boolean;
  created_at: string;
  task_count: number;
  completed_count: number;
}

export interface TaskBrief {
  id: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  color?: string;
  start_date?: string;
  due_date?: string;
  completed_at?: string;
  estimated_hours?: number;
  parent_id?: number;
  position: number;
  project_id: number;
  created_at: string;
  updated_at?: string;
  assignees: UserBrief[];
  subtasks: TaskBrief[];
  dependencies: TaskBrief[];
  subtask_count: number;
  subtask_completed: number;
}

export interface GanttTask {
  id: number;
  title: string;
  start_date?: string;
  due_date?: string;
  status: TaskStatus;
  priority: TaskPriority;
  color?: string;
  progress: number;
  dependencies: number[];
  assignees: UserBrief[];
  parent_id?: number;
}

export interface KanbanColumn {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  wip_limit?: number;
}

export interface KanbanBoard {
  project_id: number;
  columns: KanbanColumn[];
}

export interface CalendarEvent {
  id: number;
  title: string;
  start: string;
  end: string;
  color: string;
  status: TaskStatus;
  priority: TaskPriority;
  project_id: number;
  project_name: string;
  assignees: UserBrief[];
}

export interface Reminder {
  id: number;
  task_id: number;
  user_id: number;
  remind_at: string;
  message?: string;
  is_sent: boolean;
  created_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  project_id: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  color?: string;
  start_date?: string;
  due_date?: string;
  estimated_hours?: number;
  parent_id?: number;
  assignee_ids?: number[];
  dependency_ids?: number[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  color?: string;
  start_date?: string;
  due_date?: string;
  completed_at?: string;
  estimated_hours?: number;
  parent_id?: number;
  position?: number;
  assignee_ids?: number[];
  dependency_ids?: number[];
}
