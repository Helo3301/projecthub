import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';

// Stub localStorage before importing store
const storage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { storage[key] = val; }),
  removeItem: vi.fn((key: string) => { delete storage[key]; }),
});

// Must import after stubbing globals
const { useStore } = await import('./index');

function makeProject(id: number, name = `Project ${id}`) {
  return {
    id,
    name,
    description: '',
    color: '#6366F1',
    icon: '',
    owner_id: 1,
    is_archived: false,
    created_at: '2024-01-01',
    task_count: 0,
    completed_count: 0,
  };
}

function makeTask(id: number, title = `Task ${id}`) {
  return {
    id,
    title,
    description: '',
    status: 'todo' as const,
    priority: 'medium' as const,
    position: 0,
    project_id: 1,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    assignees: [],
    subtasks: [],
    dependencies: [],
    subtask_count: 0,
    subtask_completed: 0,
  };
}

function resetStore() {
  const { setUser, setProjects, setCurrentProject, setTasks, setCurrentView } = useStore.getState();
  setUser(null);
  setProjects([]);
  setCurrentProject(null);
  setTasks([]);
  setCurrentView('dashboard');
  // Reset sidebar
  if (!useStore.getState().sidebarOpen) useStore.getState().toggleSidebar();
  // Reset dark mode
  if (useStore.getState().darkMode) useStore.getState().toggleDarkMode();
}

describe('useStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    document.documentElement.classList.remove('dark');
  });

  // Auth
  describe('auth', () => {
    it('starts with null user and not authenticated', () => {
      const state = useStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('setUser sets user and isAuthenticated', () => {
      act(() => useStore.getState().setUser({ id: 1, username: 'tim', email: 'tim@test.com' } as any));
      expect(useStore.getState().user?.username).toBe('tim');
      expect(useStore.getState().isAuthenticated).toBe(true);
    });

    it('setUser(null) clears authentication', () => {
      act(() => useStore.getState().setUser({ id: 1, username: 'tim', email: 'tim@test.com' } as any));
      act(() => useStore.getState().setUser(null));
      expect(useStore.getState().user).toBeNull();
      expect(useStore.getState().isAuthenticated).toBe(false);
    });

    it('logout clears all state', () => {
      act(() => {
        const s = useStore.getState();
        s.setUser({ id: 1, username: 'tim', email: 'tim@test.com' } as any);
        s.setProjects([makeProject(1)]);
        s.setCurrentProject(makeProject(1));
        s.setTasks([makeTask(1)]);
      });
      act(() => useStore.getState().logout());

      const state = useStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.projects).toHaveLength(0);
      expect(state.currentProject).toBeNull();
      expect(state.tasks).toHaveLength(0);
      expect(state.darkMode).toBe(false);
      expect(state.currentView).toBe('dashboard');
      expect(state.sidebarOpen).toBe(true);
    });

    it('logout removes token from localStorage', () => {
      act(() => useStore.getState().logout());
      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    });

    it('logout removes dark class from document', () => {
      document.documentElement.classList.add('dark');
      act(() => useStore.getState().logout());
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  // Projects
  describe('projects', () => {
    it('setProjects replaces project list', () => {
      const projects = [makeProject(1), makeProject(2)];
      act(() => useStore.getState().setProjects(projects));
      expect(useStore.getState().projects).toHaveLength(2);
    });

    it('addProject appends to list', () => {
      act(() => useStore.getState().setProjects([makeProject(1)]));
      act(() => useStore.getState().addProject(makeProject(2)));
      expect(useStore.getState().projects).toHaveLength(2);
      expect(useStore.getState().projects[1].id).toBe(2);
    });

    it('updateProject updates matching project', () => {
      act(() => useStore.getState().setProjects([makeProject(1, 'Old')]));
      act(() => useStore.getState().updateProject(1, { name: 'New' }));
      expect(useStore.getState().projects[0].name).toBe('New');
    });

    it('updateProject also updates currentProject if matching', () => {
      const p = makeProject(1, 'Old');
      act(() => {
        useStore.getState().setProjects([p]);
        useStore.getState().setCurrentProject(p);
      });
      act(() => useStore.getState().updateProject(1, { name: 'New' }));
      expect(useStore.getState().currentProject?.name).toBe('New');
    });

    it('updateProject does not affect currentProject if different id', () => {
      act(() => {
        useStore.getState().setProjects([makeProject(1), makeProject(2, 'Current')]);
        useStore.getState().setCurrentProject(makeProject(2, 'Current'));
      });
      act(() => useStore.getState().updateProject(1, { name: 'Updated' }));
      expect(useStore.getState().currentProject?.name).toBe('Current');
    });

    it('removeProject removes from list', () => {
      act(() => useStore.getState().setProjects([makeProject(1), makeProject(2)]));
      act(() => useStore.getState().removeProject(1));
      expect(useStore.getState().projects).toHaveLength(1);
      expect(useStore.getState().projects[0].id).toBe(2);
    });

    it('removeProject clears currentProject if matching', () => {
      const p = makeProject(1);
      act(() => {
        useStore.getState().setProjects([p]);
        useStore.getState().setCurrentProject(p);
      });
      act(() => useStore.getState().removeProject(1));
      expect(useStore.getState().currentProject).toBeNull();
    });

    it('removeProject keeps currentProject if different id', () => {
      act(() => {
        useStore.getState().setProjects([makeProject(1), makeProject(2)]);
        useStore.getState().setCurrentProject(makeProject(2));
      });
      act(() => useStore.getState().removeProject(1));
      expect(useStore.getState().currentProject?.id).toBe(2);
    });
  });

  // Tasks
  describe('tasks', () => {
    it('setTasks replaces task list', () => {
      act(() => useStore.getState().setTasks([makeTask(1), makeTask(2)]));
      expect(useStore.getState().tasks).toHaveLength(2);
    });

    it('addTask appends', () => {
      act(() => useStore.getState().setTasks([makeTask(1)]));
      act(() => useStore.getState().addTask(makeTask(2)));
      expect(useStore.getState().tasks).toHaveLength(2);
    });

    it('updateTask updates matching task', () => {
      act(() => useStore.getState().setTasks([makeTask(1, 'Old')]));
      act(() => useStore.getState().updateTask(1, { title: 'New' }));
      expect(useStore.getState().tasks[0].title).toBe('New');
    });

    it('updateTask does not affect non-matching tasks', () => {
      act(() => useStore.getState().setTasks([makeTask(1, 'Keep'), makeTask(2, 'Old')]));
      act(() => useStore.getState().updateTask(2, { title: 'New' }));
      expect(useStore.getState().tasks[0].title).toBe('Keep');
      expect(useStore.getState().tasks[1].title).toBe('New');
    });

    it('removeTask removes matching task', () => {
      act(() => useStore.getState().setTasks([makeTask(1), makeTask(2)]));
      act(() => useStore.getState().removeTask(1));
      expect(useStore.getState().tasks).toHaveLength(1);
      expect(useStore.getState().tasks[0].id).toBe(2);
    });
  });

  // UI State
  describe('ui state', () => {
    it('toggleSidebar flips state', () => {
      expect(useStore.getState().sidebarOpen).toBe(true);
      act(() => useStore.getState().toggleSidebar());
      expect(useStore.getState().sidebarOpen).toBe(false);
      act(() => useStore.getState().toggleSidebar());
      expect(useStore.getState().sidebarOpen).toBe(true);
    });

    it('toggleDarkMode flips state and toggles DOM class', () => {
      expect(useStore.getState().darkMode).toBe(false);
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      act(() => useStore.getState().toggleDarkMode());
      expect(useStore.getState().darkMode).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      act(() => useStore.getState().toggleDarkMode());
      expect(useStore.getState().darkMode).toBe(false);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('setCurrentView changes view', () => {
      act(() => useStore.getState().setCurrentView('kanban'));
      expect(useStore.getState().currentView).toBe('kanban');
    });
  });

  // Persistence
  describe('persistence', () => {
    it('partialize excludes user, isAuthenticated, projects, tasks', () => {
      // After setting data, check what gets persisted
      act(() => {
        const s = useStore.getState();
        s.setUser({ id: 1, username: 'tim', email: 'tim@test.com' } as any);
        s.setProjects([makeProject(1)]);
        s.setTasks([makeTask(1)]);
        s.setCurrentProject(makeProject(1));
        s.toggleDarkMode();
      });

      // Check localStorage was called with serialized state
      const lastSetItem = (localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls;
      const storedData = lastSetItem.find((c: string[]) => c[0] === 'projecthub-storage');
      expect(storedData).toBeDefined();

      const parsed = JSON.parse(storedData![1]);
      const persisted = parsed.state;

      // Should include these
      expect(persisted).toHaveProperty('sidebarOpen');
      expect(persisted).toHaveProperty('darkMode');
      expect(persisted).toHaveProperty('currentView');

      // Should NOT include these (loaded from API after auth)
      expect(persisted).not.toHaveProperty('currentProject');
      expect(persisted).not.toHaveProperty('user');
      expect(persisted).not.toHaveProperty('isAuthenticated');
      expect(persisted).not.toHaveProperty('projects');
      expect(persisted).not.toHaveProperty('tasks');
    });
  });
});
