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
  correlation_id?: string;
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
  agent_id?: number;
  agent?: {
    id: number;
    name: string;
    agent_type: AgentType;
    status: AgentStatus;
    is_alive: boolean;
  };
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
  color?: string;
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

export interface SubtaskInput {
  id?: number;
  title: string;
  completed: boolean;
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
  correlation_id?: string;
  parent_id?: number;
  assignee_ids?: number[];
  dependency_ids?: number[];
  agent_id?: number | null;
  subtasks?: SubtaskInput[];
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
  correlation_id?: string;
  parent_id?: number;
  position?: number;
  assignee_ids?: number[];
  dependency_ids?: number[];
  agent_id?: number | null;
  subtasks?: SubtaskInput[];
}

// ============ Agent Types ============
export type AgentType = 'claude_code' | 'tiny_mind' | 'hestia' | 'custom';
export type AgentStatus = 'idle' | 'working' | 'waiting' | 'error' | 'offline';

export interface Agent {
  id: number;
  name: string;
  agent_type: AgentType;
  status: AgentStatus;
  capabilities: string[];
  session_id?: string;
  last_heartbeat?: string;
  current_task_id?: number;
  current_task?: TaskBrief;
  is_alive: boolean;
  created_at: string;
}

export interface AgentAction {
  id: number;
  agent_id: number;
  agent_name?: string;
  agent_type?: AgentType;
  action_type: string;
  summary: string;
  detail?: string;
  task_id?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface GitHubLink {
  id: number;
  task_id?: number;
  project_id?: number;
  github_repo: string;
  github_type: 'issue' | 'pull_request' | 'commit';
  github_id: string;
  github_url: string;
  title?: string;
  state: string;
  created_at: string;
}

export interface OrchestratorStatus {
  active_agents: number;
  max_agents: number;
  queue_depth: number;
  agents: Array<{
    id: number;
    name: string;
    agent_type: AgentType;
    status: AgentStatus;
    is_alive: boolean;
  }>;
}

// ============ Agent Coordination Types ============
export type MessageStatus = 'pending' | 'read' | 'replied' | 'expired';
export type DirectiveType = 'pause' | 'resume' | 'cancel' | 'reassign' | 'message';

export interface AgentMessage {
  id: number;
  sender_id: number;
  sender_name?: string;
  recipient_id: number;
  recipient_name?: string;
  thread_id?: string;
  message_type: string;
  subject: string;
  body?: string;
  status: MessageStatus;
  in_reply_to?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  read_at?: string;
}

export interface AgentDirective {
  id: number;
  agent_id: number;
  directive_type: DirectiveType;
  payload?: Record<string, unknown>;
  issued_by?: number;
  acknowledged: boolean;
  acknowledged_at?: string;
  created_at: string;
}

export interface TaskQueueItem {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  project_id: number;
  project_name?: string;
  required_capabilities: string[];
  estimated_hours?: number;
  created_at: string;
}
