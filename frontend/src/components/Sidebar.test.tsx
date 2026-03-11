import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useStore } from '@/store';
import type { Project } from '@/types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockProjects: Project[] = [
  { id: 1, name: 'Alpha Project', description: 'First project', color: '#EF4444', icon: '', owner_id: 1, is_archived: false, created_at: '2026-01-01', task_count: 0, completed_count: 0 },
  { id: 2, name: 'Beta Project', description: 'Second project', color: '#3B82F6', icon: '', owner_id: 1, is_archived: false, created_at: '2026-01-01', task_count: 0, completed_count: 0 },
];

function renderSidebar(props: Partial<React.ComponentProps<typeof Sidebar>> = {}, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar
        projects={mockProjects}
        onCreateProject={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      user: { id: 1, username: 'tim', email: 'tim@test.com', full_name: 'Tim', avatar_color: '#6366F1', is_active: true, created_at: '2026-01-01' },
      currentProject: mockProjects[0],
    });
  });

  it('renders navigation links', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /kanban/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /gantt/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /calendar/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /agents/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /team/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });

  it('renders project list', () => {
    renderSidebar();
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.getByText('Beta Project')).toBeInTheDocument();
  });

  it('renders user info in footer', () => {
    renderSidebar();
    expect(screen.getByText('Tim')).toBeInTheDocument();
    expect(screen.getByText('tim@test.com')).toBeInTheDocument();
    expect(screen.getByText('TI')).toBeInTheDocument();
  });

  it('highlights active nav link based on route', () => {
    renderSidebar({}, '/kanban');
    const kanbanLink = screen.getByRole('link', { name: /kanban/i });
    expect(kanbanLink.className).toContain('bg-indigo-600');
    expect(kanbanLink).toHaveAttribute('aria-current', 'page');
  });

  it('does not set aria-current on inactive nav links', () => {
    renderSidebar({}, '/kanban');
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).not.toHaveAttribute('aria-current');
  });

  it('calls onCreateProject when New Project clicked', () => {
    const onCreateProject = vi.fn();
    renderSidebar({ onCreateProject });
    fireEvent.click(screen.getByText('New Project'));
    expect(onCreateProject).toHaveBeenCalledTimes(1);
  });

  it('selects project when clicked', () => {
    renderSidebar();
    fireEvent.click(screen.getByText('Beta Project'));
    expect(useStore.getState().currentProject?.id).toBe(2);
  });

  it('calls onNavigate when project is selected', () => {
    const onNavigate = vi.fn();
    renderSidebar({ onNavigate });
    fireEvent.click(screen.getByText('Beta Project'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('calls onNavigate when nav link is clicked', () => {
    const onNavigate = vi.fn();
    renderSidebar({ onNavigate });
    fireEvent.click(screen.getByText('Kanban'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('toggles project list when Projects header clicked', () => {
    renderSidebar();
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();

    const projectsToggle = screen.getByRole('button', { name: /projects/i });
    fireEvent.click(projectsToggle);
    expect(screen.queryByText('Alpha Project')).not.toBeInTheDocument();

    fireEvent.click(projectsToggle);
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
  });

  it('sets aria-expanded on projects toggle', () => {
    renderSidebar();
    const toggle = screen.getByRole('button', { name: /projects/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('logs out and navigates to login', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /logout/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
    expect(useStore.getState().isAuthenticated).toBe(false);
  });

  it('renders empty project list', () => {
    renderSidebar({ projects: [] });
    expect(screen.getByText('New Project')).toBeInTheDocument();
    expect(screen.queryByText('Alpha Project')).not.toBeInTheDocument();
  });

  it('falls back to username when full_name is empty', () => {
    useStore.setState({
      user: { id: 1, username: 'tim', email: 'tim@test.com', full_name: '', avatar_color: '#6366F1', is_active: true, created_at: '2026-01-01' },
    });
    renderSidebar();
    // Username should be displayed instead of full_name
    const userDisplay = screen.getAllByText('tim');
    expect(userDisplay.length).toBeGreaterThan(0);
  });

  it('falls back to default avatar color when user avatar_color is empty', () => {
    useStore.setState({
      user: { id: 1, username: 'zz', email: 'z@z.com', full_name: 'Zara Zen', avatar_color: '', is_active: true, created_at: '2026-01-01' },
    });
    renderSidebar();
    const avatar = screen.getByText('ZZ');
    expect(avatar).toBeInTheDocument();
    // Fallback color should be #4F46E5 — style is on the avatar div itself
    expect(avatar.closest('[style]')).toHaveStyle({ backgroundColor: '#4F46E5' });
  });

  it('highlights the currently active project', () => {
    renderSidebar();
    const alphaBtn = screen.getByRole('button', { name: /alpha project/i });
    const betaBtn = screen.getByRole('button', { name: /beta project/i });
    // Active project has 'bg-gray-800 text-white', inactive only has 'hover:bg-gray-800'
    expect(alphaBtn.className).toMatch(/(^|\s)bg-gray-800(\s|$)/);
    expect(betaBtn.className).not.toMatch(/(^|\s)bg-gray-800(\s|$)/);
    // Active project has aria-pressed
    expect(alphaBtn).toHaveAttribute('aria-pressed', 'true');
    expect(betaBtn).toHaveAttribute('aria-pressed', 'false');
  });
});
