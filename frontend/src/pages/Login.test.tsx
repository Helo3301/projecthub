import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Login } from './Login';

// Mock the API
vi.mock('@/lib/api', () => ({
  auth: {
    login: vi.fn(),
    me: vi.fn(),
  },
}));

// Mock the store
vi.mock('@/store', () => ({
  useStore: () => ({
    setUser: vi.fn(),
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderLogin = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login page', () => {
    renderLogin();
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('displays ProjectHub branding', () => {
    renderLogin();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Hub')).toBeInTheDocument();
  });

  it('shows sign in heading', () => {
    renderLogin();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
  });

  it('renders username input', () => {
    renderLogin();
    expect(screen.getByTestId('username-input')).toBeInTheDocument();
  });

  it('renders password input', () => {
    renderLogin();
    expect(screen.getByTestId('password-input')).toBeInTheDocument();
  });

  it('renders login button', () => {
    renderLogin();
    expect(screen.getByTestId('login-button')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('renders link to registration page', () => {
    renderLogin();
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByText('Sign up')).toBeInTheDocument();
  });

  it('allows typing in username field', () => {
    renderLogin();
    const input = screen.getByTestId('username-input');
    fireEvent.change(input, { target: { value: 'testuser' } });
    expect(input).toHaveValue('testuser');
  });

  it('allows typing in password field', () => {
    renderLogin();
    const input = screen.getByTestId('password-input');
    fireEvent.change(input, { target: { value: 'password123' } });
    expect(input).toHaveValue('password123');
  });

  it('password input is hidden by default', () => {
    renderLogin();
    const input = screen.getByTestId('password-input');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('toggles password visibility', () => {
    renderLogin();
    const input = screen.getByTestId('password-input');
    // Find the button within the password field's parent
    const container = input.parentElement;
    const toggleButton = container?.querySelector('button');

    if (toggleButton) {
      fireEvent.click(toggleButton);
      expect(input).toHaveAttribute('type', 'text');

      fireEvent.click(toggleButton);
      expect(input).toHaveAttribute('type', 'password');
    }
  });
});
