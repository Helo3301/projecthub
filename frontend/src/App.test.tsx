import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Outlet } from 'react-router-dom';

// Mock all page components to avoid pulling in their dependencies
vi.mock('./pages/Dashboard', () => ({ Dashboard: () => <div>Dashboard Page</div> }));
vi.mock('./pages/KanbanPage', () => ({ KanbanPage: () => <div>Kanban Page</div> }));
vi.mock('./pages/GanttPage', () => ({ GanttPage: () => <div>Gantt Page</div> }));
vi.mock('./pages/CalendarPage', () => ({ CalendarPage: () => <div>Calendar Page</div> }));
vi.mock('./pages/Login', () => ({ Login: () => <div>Login Page</div> }));
vi.mock('./pages/Register', () => ({ Register: () => <div>Register Page</div> }));
vi.mock('./pages/ForgotPassword', () => ({ ForgotPassword: () => <div>Forgot Password Page</div> }));
vi.mock('./pages/ResetPassword', () => ({ ResetPassword: () => <div>Reset Password Page</div> }));
vi.mock('./pages/TeamPage', () => ({ TeamPage: () => <div>Team Page</div> }));
vi.mock('./pages/SettingsPage', () => ({ SettingsPage: () => <div>Settings Page</div> }));
vi.mock('./pages/AddUserPage', () => ({ AddUserPage: () => <div>Add User Page</div> }));
vi.mock('./pages/AgentDashboard', () => ({ default: () => <div>Agent Dashboard Page</div> }));

// Mock Layout to render Outlet (child routes)
vi.mock('./components/Layout', () => ({
  Layout: () => <div data-testid="layout"><Outlet /></div>,
}));

// Mock Toast provider and hook
vi.mock('./components/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock ErrorBoundary to pass through children
vi.mock('./components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import App from './App';

// We need to control BrowserRouter's location, so we'll use a different approach:
// Render the full App but manipulate window.history
function renderAppAt(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

describe('App', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  // --- Public routes ---
  it('renders login page at /login', () => {
    renderAppAt('/login');
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('renders register page at /register', async () => {
    renderAppAt('/register');
    expect(await screen.findByText('Register Page')).toBeInTheDocument();
  });

  it('renders forgot password page at /forgot-password', async () => {
    renderAppAt('/forgot-password');
    expect(await screen.findByText('Forgot Password Page')).toBeInTheDocument();
  });

  it('renders reset password page at /reset-password', async () => {
    renderAppAt('/reset-password');
    expect(await screen.findByText('Reset Password Page')).toBeInTheDocument();
  });

  // --- Protected routes (Layout wrapper) ---
  it('renders dashboard at /', () => {
    renderAppAt('/');
    expect(screen.getByTestId('layout')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('renders kanban page at /kanban', () => {
    renderAppAt('/kanban');
    expect(screen.getByText('Kanban Page')).toBeInTheDocument();
  });

  it('renders gantt page at /gantt', async () => {
    renderAppAt('/gantt');
    expect(await screen.findByText('Gantt Page')).toBeInTheDocument();
  });

  it('renders calendar page at /calendar', async () => {
    renderAppAt('/calendar');
    expect(await screen.findByText('Calendar Page')).toBeInTheDocument();
  });

  it('renders team page at /team', () => {
    renderAppAt('/team');
    expect(screen.getByText('Team Page')).toBeInTheDocument();
  });

  it('renders add user page at /team/add', () => {
    renderAppAt('/team/add');
    expect(screen.getByText('Add User Page')).toBeInTheDocument();
  });

  it('renders settings page at /settings', () => {
    renderAppAt('/settings');
    expect(screen.getByText('Settings Page')).toBeInTheDocument();
  });

  it('renders agent dashboard at /agents', async () => {
    renderAppAt('/agents');
    expect(await screen.findByText('Agent Dashboard Page')).toBeInTheDocument();
  });

  // --- Fallback ---
  it('redirects unknown routes to /', () => {
    renderAppAt('/nonexistent-route');
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  // --- Providers ---
  it('wraps protected routes in Layout with child content', () => {
    renderAppAt('/kanban');
    expect(screen.getByTestId('layout')).toBeInTheDocument();
    // Verify Outlet renders the child route inside the layout
    expect(screen.getByText('Kanban Page')).toBeInTheDocument();
  });

  it('does not wrap public routes in Layout', () => {
    renderAppAt('/login');
    expect(screen.queryByTestId('layout')).not.toBeInTheDocument();
  });
});
