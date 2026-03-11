import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './Layout';
import { useStore } from '@/store';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/components/Toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({
  projects: {
    list: vi.fn(),
    create: vi.fn(),
  },
  auth: {
    me: vi.fn(),
  },
}));

import { projects as projectsApi, auth } from '@/lib/api';

let queryClient: QueryClient;

function renderLayout(path = '/') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<div>Page Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    localStorage.setItem('token', 'fake-token');
    useStore.setState({
      user: { id: 1, username: 'tim', email: 'tim@test.com', full_name: 'Tim', avatar_color: '#6366F1', is_active: true, created_at: '2026-01-01' },
      isAuthenticated: true,
      currentProject: null,
      projects: [],
      darkMode: false,
    });
    (projectsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('renders loading spinner when no user', () => {
    useStore.setState({ user: null, isAuthenticated: false });
    (auth.me as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, username: 'tim' });
    renderLayout();
    // Should show spinner, not main content
    expect(screen.queryByText('Page Content')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('redirects to login when no token', () => {
    localStorage.removeItem('token');
    useStore.setState({ user: null });
    renderLayout();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('renders main content when authenticated', async () => {
    renderLayout();
    expect(screen.getByText('Page Content')).toBeInTheDocument();
  });

  it('renders mobile menu toggle button', () => {
    renderLayout();
    expect(screen.getByLabelText('Toggle menu')).toBeInTheDocument();
  });

  it('renders ProjectHub brand in mobile header', () => {
    renderLayout();
    // Brand is split: "Project" text + "Hub" in a span
    const headings = screen.getAllByRole('heading', { level: 1 });
    const brand = headings.find((h) => h.textContent?.includes('ProjectHub'));
    expect(brand).toBeDefined();
  });

  it('redirects on 401 from auth.me', async () => {
    useStore.setState({ user: null });
    (auth.me as ReturnType<typeof vi.fn>).mockRejectedValueOnce({ response: { status: 401 } });
    renderLayout();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('redirects on 403 from auth.me', async () => {
    useStore.setState({ user: null });
    (auth.me as ReturnType<typeof vi.fn>).mockRejectedValueOnce({ response: { status: 403 } });
    renderLayout();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('does not redirect on network error from auth.me', async () => {
    useStore.setState({ user: null });
    (auth.me as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network Error'));
    renderLayout();
    // Wait a tick to ensure the catch handler runs
    await new Promise((r) => setTimeout(r, 50));
    // Should not navigate — keep user on page
    expect(mockNavigate).not.toHaveBeenCalledWith('/login');
  });

  it('fetches projects when user is set', async () => {
    const mockProjects = [
      { id: 1, name: 'Test Project', description: '', color: '#EF4444', icon: '', owner_id: 1, is_archived: false, created_at: '2026-01-01', task_count: 0, completed_count: 0 },
    ];
    (projectsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockProjects);
    renderLayout();
    await waitFor(() => {
      expect(projectsApi.list).toHaveBeenCalled();
    });
  });

  it('opens project modal when sidebar New Project is clicked', async () => {
    renderLayout();
    fireEvent.click(screen.getByText('New Project'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('New Project', { selector: 'h2' })).toBeInTheDocument();
  });

  it('closes project modal on Cancel click', async () => {
    renderLayout();
    fireEvent.click(screen.getByText('New Project'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('submits new project via modal', async () => {
    const newProject = { id: 2, name: 'New', description: '', color: '#6366F1', icon: '', owner_id: 1, is_archived: false, created_at: '2026-01-01', task_count: 0, completed_count: 0 };
    (projectsApi.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce(newProject);
    renderLayout();

    fireEvent.click(screen.getByText('New Project'));
    // Label is now associated via htmlFor/id
    const nameInput = screen.getByLabelText(/project name/i);
    fireEvent.change(nameInput, { target: { value: 'New' } });
    const dialog = screen.getByRole('dialog');
    fireEvent.submit(dialog.querySelector('form')!);

    await waitFor(() => {
      expect(projectsApi.create).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('closes project modal on Escape key', () => {
    renderLayout();
    fireEvent.click(screen.getByText('New Project'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog').parentElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('applies dark mode class from store', () => {
    useStore.setState({ darkMode: true });
    renderLayout();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
