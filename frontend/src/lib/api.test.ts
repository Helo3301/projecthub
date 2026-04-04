import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

// Mock axios before importing api
vi.mock('axios', () => {
  const requestInterceptors: Array<(config: any) => any> = [];
  const responseInterceptors: Array<{ fulfilled: (r: any) => any; rejected: (e: any) => any }> = [];

  const instance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn((fn: any) => { requestInterceptors.push(fn); }),
      },
      response: {
        use: vi.fn((fulfilled: any, rejected: any) => {
          responseInterceptors.push({ fulfilled, rejected });
        }),
      },
    },
    _requestInterceptors: requestInterceptors,
    _responseInterceptors: responseInterceptors,
  };

  return {
    default: {
      create: vi.fn(() => instance),
    },
  };
});

// Stub globals
vi.stubGlobal('localStorage', {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

const hrefSetter = vi.fn();
Object.defineProperty(window, 'location', {
  value: { href: '/' },
  writable: true,
  configurable: true,
});
Object.defineProperty(window.location, 'href', {
  set: hrefSetter,
  get: () => '/',
  configurable: true,
});

// Import after mocks
const { auth, projects, tasks, users, calendar, agents } = await import('./api');

// Get the mocked instance
const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;

describe('api interceptors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('request interceptor', () => {
    it('adds Authorization header when token exists', () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
      const interceptor = mockInstance._requestInterceptors[0];
      const config = { headers: {} as Record<string, string> };
      const result = interceptor(config);
      expect(result.headers.Authorization).toBe('Bearer test-token');
    });

    it('does not add Authorization header when no token', () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const interceptor = mockInstance._requestInterceptors[0];
      const config = { headers: {} as Record<string, string> };
      const result = interceptor(config);
      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  describe('response interceptor', () => {
    it('passes successful responses through', () => {
      const interceptor = mockInstance._responseInterceptors[0];
      const response = { data: 'test', status: 200 };
      expect(interceptor.fulfilled(response)).toBe(response);
    });

    it('redirects to login on 401 for non-auth URLs', async () => {
      const interceptor = mockInstance._responseInterceptors[0];
      const error = {
        response: { status: 401 },
        config: { url: '/tasks/' },
      };
      await expect(interceptor.rejected(error)).rejects.toBe(error);
      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(hrefSetter).toHaveBeenCalledWith('/login');
    });

    it('does not redirect on 401 for auth URLs', async () => {
      const interceptor = mockInstance._responseInterceptors[0];
      const error = {
        response: { status: 401 },
        config: { url: '/auth/login' },
      };
      await expect(interceptor.rejected(error)).rejects.toBe(error);
      expect(hrefSetter).not.toHaveBeenCalled();
    });

    it('does not redirect on non-401 errors', async () => {
      const interceptor = mockInstance._responseInterceptors[0];
      const error = {
        response: { status: 500 },
        config: { url: '/tasks/' },
      };
      await expect(interceptor.rejected(error)).rejects.toBe(error);
      expect(hrefSetter).not.toHaveBeenCalled();
    });
  });
});

describe('auth.login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends form-encoded data and stores token', async () => {
    mockInstance.post.mockResolvedValue({ data: { access_token: 'new-token' } });
    await auth.login('tim', 'password123');

    expect(mockInstance.post).toHaveBeenCalledWith(
      '/auth/login',
      expect.any(URLSearchParams),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    );
    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'new-token');
  });
});

describe('auth.logout', () => {
  it('removes token from localStorage', () => {
    auth.logout();
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
  });
});

describe('auth endpoints', () => {
  beforeEach(() => vi.clearAllMocks());

  it('register posts user data', async () => {
    mockInstance.post.mockResolvedValue({ data: { id: 1, username: 'newuser' } });
    const result = await auth.register('a@b.com', 'newuser', 'pass', 'Full Name');
    expect(mockInstance.post).toHaveBeenCalledWith('/auth/register', {
      email: 'a@b.com', username: 'newuser', password: 'pass', full_name: 'Full Name',
    });
    expect(result.username).toBe('newuser');
  });

  it('me fetches current user', async () => {
    mockInstance.get.mockResolvedValue({ data: { id: 1, username: 'tim' } });
    const result = await auth.me();
    expect(mockInstance.get).toHaveBeenCalledWith('/auth/me');
    expect(result.username).toBe('tim');
  });

  it('forgotPassword sends email_or_username', async () => {
    mockInstance.post.mockResolvedValue({ data: { message: 'Email sent' } });
    const result = await auth.forgotPassword('tim@test.com');
    expect(mockInstance.post).toHaveBeenCalledWith('/auth/forgot-password', {
      email_or_username: 'tim@test.com',
    });
    expect(result.message).toBe('Email sent');
  });

  it('resetPassword sends token and new_password', async () => {
    mockInstance.post.mockResolvedValue({ data: { message: 'Password reset' } });
    const result = await auth.resetPassword('reset-token', 'newpass');
    expect(mockInstance.post).toHaveBeenCalledWith('/auth/reset-password', {
      token: 'reset-token', new_password: 'newpass',
    });
    expect(result.message).toBe('Password reset');
  });
});

describe('projects endpoints', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list defaults include_archived to false', async () => {
    mockInstance.get.mockResolvedValue({ data: [] });
    await projects.list();
    expect(mockInstance.get).toHaveBeenCalledWith('/projects/', {
      params: { include_archived: false },
    });
  });

  it('list passes include_archived param', async () => {
    mockInstance.get.mockResolvedValue({ data: [] });
    await projects.list(true);
    expect(mockInstance.get).toHaveBeenCalledWith('/projects/', {
      params: { include_archived: true },
    });
  });

  it('get fetches by id', async () => {
    mockInstance.get.mockResolvedValue({ data: { id: 5 } });
    const result = await projects.get(5);
    expect(mockInstance.get).toHaveBeenCalledWith('/projects/5');
    expect(result.id).toBe(5);
  });

  it('create posts project data', async () => {
    mockInstance.post.mockResolvedValue({ data: { id: 1, name: 'New' } });
    await projects.create({ name: 'New', color: '#fff' });
    expect(mockInstance.post).toHaveBeenCalledWith('/projects/', { name: 'New', color: '#fff' });
  });

  it('update puts project data', async () => {
    mockInstance.put.mockResolvedValue({ data: { id: 1, name: 'Updated' } });
    await projects.update(1, { name: 'Updated' });
    expect(mockInstance.put).toHaveBeenCalledWith('/projects/1', { name: 'Updated' });
  });

  it('delete calls DELETE', async () => {
    mockInstance.delete.mockResolvedValue({});
    await projects.delete(1);
    expect(mockInstance.delete).toHaveBeenCalledWith('/projects/1');
  });
});

describe('tasks endpoints', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list passes all params', async () => {
    mockInstance.get.mockResolvedValue({ data: [] });
    await tasks.list(1, 'todo', true);
    expect(mockInstance.get).toHaveBeenCalledWith('/tasks/', {
      params: { project_id: 1, status: 'todo', include_subtasks: true },
    });
  });

  it('get fetches by id', async () => {
    mockInstance.get.mockResolvedValue({ data: { id: 1 } });
    await tasks.get(1);
    expect(mockInstance.get).toHaveBeenCalledWith('/tasks/1');
  });

  it('create posts task data', async () => {
    mockInstance.post.mockResolvedValue({ data: { id: 1 } });
    await tasks.create({ title: 'T', project_id: 1 });
    expect(mockInstance.post).toHaveBeenCalledWith('/tasks/', { title: 'T', project_id: 1 });
  });

  it('update puts task data', async () => {
    mockInstance.put.mockResolvedValue({ data: { id: 1 } });
    await tasks.update(1, { title: 'Updated' });
    expect(mockInstance.put).toHaveBeenCalledWith('/tasks/1', { title: 'Updated' });
  });

  it('delete calls DELETE', async () => {
    mockInstance.delete.mockResolvedValue({});
    await tasks.delete(1);
    expect(mockInstance.delete).toHaveBeenCalledWith('/tasks/1');
  });

  it('reorder posts array of updates', async () => {
    mockInstance.post.mockResolvedValue({});
    await tasks.reorder([{ id: 1, position: 0 }, { id: 2, position: 1 }]);
    expect(mockInstance.post).toHaveBeenCalledWith('/tasks/reorder', [
      { id: 1, position: 0 }, { id: 2, position: 1 },
    ]);
  });

  it('adjustDates posts with new_end_date param', async () => {
    mockInstance.post.mockResolvedValue({ data: {} });
    await tasks.adjustDates(1, '2026-03-15');
    expect(mockInstance.post).toHaveBeenCalledWith('/tasks/1/adjust-dates', null, {
      params: { new_end_date: '2026-03-15' },
    });
  });

  it('gantt fetches by project id', async () => {
    mockInstance.get.mockResolvedValue({ data: [] });
    await tasks.gantt(1);
    expect(mockInstance.get).toHaveBeenCalledWith('/tasks/gantt/1');
  });

  it('kanban fetches by project id', async () => {
    mockInstance.get.mockResolvedValue({ data: {} });
    await tasks.kanban(1);
    expect(mockInstance.get).toHaveBeenCalledWith('/tasks/kanban/1');
  });

  it('createReminder posts reminder data', async () => {
    mockInstance.post.mockResolvedValue({ data: { id: 1 } });
    await tasks.createReminder(5, '2026-03-15T10:00:00', 'Reminder msg');
    expect(mockInstance.post).toHaveBeenCalledWith('/tasks/5/reminders', {
      task_id: 5, remind_at: '2026-03-15T10:00:00', message: 'Reminder msg',
    });
  });

  it('getReminders fetches by task id', async () => {
    mockInstance.get.mockResolvedValue({ data: [] });
    await tasks.getReminders(5);
    expect(mockInstance.get).toHaveBeenCalledWith('/tasks/5/reminders');
  });

  it('deleteReminder calls DELETE', async () => {
    mockInstance.delete.mockResolvedValue({});
    await tasks.deleteReminder(10);
    expect(mockInstance.delete).toHaveBeenCalledWith('/tasks/reminders/10');
  });
});

describe('users endpoints', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list fetches users', async () => {
    mockInstance.get.mockResolvedValue({ data: [] });
    await users.list();
    expect(mockInstance.get).toHaveBeenCalledWith('/users/');
  });

  it('updateMe puts user data', async () => {
    mockInstance.put.mockResolvedValue({ data: { id: 1 } });
    await users.updateMe({ full_name: 'Tim' });
    expect(mockInstance.put).toHaveBeenCalledWith('/users/me', { full_name: 'Tim' });
  });

  it('create posts user data', async () => {
    mockInstance.post.mockResolvedValue({ data: { id: 1 } });
    await users.create({ email: 'a@b.com', username: 'u', password: 'p' });
    expect(mockInstance.post).toHaveBeenCalledWith('/users/', {
      email: 'a@b.com', username: 'u', password: 'p',
    });
  });
});

describe('calendar endpoints', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tasks fetches with date range and project', async () => {
    mockInstance.get.mockResolvedValue({ data: [] });
    await calendar.tasks('2026-03-01', '2026-03-31', 1);
    expect(mockInstance.get).toHaveBeenCalledWith('/calendar/tasks', {
      params: { start_date: '2026-03-01', end_date: '2026-03-31', project_id: 1 },
    });
  });

  it('upcoming defaults to 7 days', async () => {
    mockInstance.get.mockResolvedValue({ data: [] });
    await calendar.upcoming();
    expect(mockInstance.get).toHaveBeenCalledWith('/calendar/upcoming', {
      params: { days: 7 },
    });
  });

  it('upcoming accepts custom days', async () => {
    mockInstance.get.mockResolvedValue({ data: [] });
    await calendar.upcoming(14);
    expect(mockInstance.get).toHaveBeenCalledWith('/calendar/upcoming', {
      params: { days: 14 },
    });
  });
});

describe('agents endpoints', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list fetches agents', async () => {
    mockInstance.get.mockResolvedValue({ data: [] });
    await agents.list();
    expect(mockInstance.get).toHaveBeenCalledWith('/agents/');
  });

  it('get fetches by id', async () => {
    mockInstance.get.mockResolvedValue({ data: { id: 1 } });
    await agents.get(1);
    expect(mockInstance.get).toHaveBeenCalledWith('/agents/1');
  });

  it('getActions defaults to limit 50', async () => {
    mockInstance.get.mockResolvedValue({ data: [] });
    await agents.getActions(1);
    expect(mockInstance.get).toHaveBeenCalledWith('/agents/1/actions', {
      params: { limit: 50 },
    });
  });

  it('getActions accepts custom limit', async () => {
    mockInstance.get.mockResolvedValue({ data: [] });
    await agents.getActions(1, 25);
    expect(mockInstance.get).toHaveBeenCalledWith('/agents/1/actions', {
      params: { limit: 25 },
    });
  });

  it('getGlobalFeed defaults to limit 100', async () => {
    mockInstance.get.mockResolvedValue({ data: [] });
    await agents.getGlobalFeed();
    expect(mockInstance.get).toHaveBeenCalledWith('/agents/actions/feed', {
      params: { limit: 100 },
    });
  });

  it('delete calls DELETE', async () => {
    mockInstance.delete.mockResolvedValue({});
    await agents.delete(1);
    expect(mockInstance.delete).toHaveBeenCalledWith('/agents/1');
  });

  it('orchestratorStatus fetches status', async () => {
    mockInstance.get.mockResolvedValue({ data: { status: 'running' } });
    await agents.orchestratorStatus();
    expect(mockInstance.get).toHaveBeenCalledWith('/agents/orchestrator/status');
  });

  it('getGitHubLinks fetches by task id', async () => {
    mockInstance.get.mockResolvedValue({ data: [] });
    await agents.getGitHubLinks(5);
    expect(mockInstance.get).toHaveBeenCalledWith('/agents/github-links/5');
  });
});
