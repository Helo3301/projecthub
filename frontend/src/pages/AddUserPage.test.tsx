import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddUserPage } from './AddUserPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/lib/api', () => ({
  users: {
    create: vi.fn(),
  },
}));

import { users } from '@/lib/api';

let queryClient: QueryClient;

function renderAddUser() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AddUserPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('AddUserPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('renders add team member heading', () => {
    renderAddUser();
    expect(screen.getByRole('heading', { name: 'Add Team Member' })).toBeInTheDocument();
    expect(screen.getByText('Create a new user account')).toBeInTheDocument();
  });

  it('renders back to team button', () => {
    renderAddUser();
    expect(screen.getByRole('button', { name: /Back to Team/i })).toBeInTheDocument();
  });

  it('renders all form fields', () => {
    renderAddUser();
    expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('johndoe')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('john@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Minimum 6 characters')).toBeInTheDocument();
  });

  it('renders required field indicators', () => {
    renderAddUser();
    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
  });

  it('allows typing in form fields', () => {
    renderAddUser();
    const username = screen.getByPlaceholderText('johndoe');
    fireEvent.change(username, { target: { value: 'alice' } });
    expect(username).toHaveValue('alice');

    const email = screen.getByPlaceholderText('john@example.com');
    fireEvent.change(email, { target: { value: 'alice@test.com' } });
    expect(email).toHaveValue('alice@test.com');
  });

  it('toggles password visibility', () => {
    renderAddUser();
    const input = screen.getByPlaceholderText('Minimum 6 characters');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByLabelText('Show password'));
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByLabelText('Hide password'));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('renders avatar color picker', () => {
    renderAddUser();
    expect(screen.getByText('Avatar Color')).toBeInTheDocument();
    expect(screen.getByLabelText('Set avatar color to Red')).toBeInTheDocument();
  });

  it('shows default avatar initials', () => {
    renderAddUser();
    expect(screen.getByText('US')).toBeInTheDocument();
  });

  it('updates avatar initials when username typed', () => {
    renderAddUser();
    fireEvent.change(screen.getByPlaceholderText('johndoe'), { target: { value: 'al' } });
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('highlights default avatar color', () => {
    renderAddUser();
    const defaultColor = screen.getByLabelText('Set avatar color to Indigo');
    expect(defaultColor).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders create user button', () => {
    renderAddUser();
    expect(screen.getByRole('button', { name: /Create User/i })).toBeInTheDocument();
  });

  it('shows password length error when password is too short', () => {
    renderAddUser();
    fireEvent.change(screen.getByPlaceholderText('john@example.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('johndoe'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Password must be at least 6 characters');
  });

  it('shows success screen and navigates to team on successful creation', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (users.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 2, username: 'newuser' });
    renderAddUser();

    fireEvent.change(screen.getByPlaceholderText('johndoe'), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByPlaceholderText('john@example.com'), { target: { value: 'new@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));

    await waitFor(() => {
      expect(screen.getByText('User Created!')).toBeInTheDocument();
    });
    expect(screen.getByText('Redirecting to team page...')).toBeInTheDocument();

    // Advance timer past the 2s redirect delay
    vi.advanceTimersByTime(2000);
    expect(mockNavigate).toHaveBeenCalledWith('/team');
    vi.useRealTimers();
  });

  it('shows API error message (string detail)', async () => {
    (users.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { detail: 'Username already exists' } },
    });
    renderAddUser();

    fireEvent.change(screen.getByPlaceholderText('johndoe'), { target: { value: 'existing' } });
    fireEvent.change(screen.getByPlaceholderText('john@example.com'), { target: { value: 'e@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));

    await waitFor(() => {
      expect(screen.getByText('Username already exists')).toBeInTheDocument();
    });
  });

  it('shows API error message (array detail)', async () => {
    (users.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { detail: [{ msg: 'Invalid email' }, { msg: 'Username too short' }] } },
    });
    renderAddUser();

    fireEvent.change(screen.getByPlaceholderText('johndoe'), { target: { value: 'ab' } });
    fireEvent.change(screen.getByPlaceholderText('john@example.com'), { target: { value: 'ab@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email, Username too short')).toBeInTheDocument();
    });
  });

  it('sets aria-busy on submit button while creating', async () => {
    let resolveCreate!: (value: unknown) => void;
    (users.create as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => { resolveCreate = resolve; })
    );
    renderAddUser();

    fireEvent.change(screen.getByPlaceholderText('johndoe'), { target: { value: 'user1' } });
    fireEvent.change(screen.getByPlaceholderText('john@example.com'), { target: { value: 'u@t.com' } });
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));

    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });
    const btn = screen.getByRole('button', { name: /Creating/i });
    expect(btn).toHaveAttribute('aria-busy', 'true');

    resolveCreate({ id: 99, username: 'user1' });
  });

  it('shows generic error message for network errors', async () => {
    (users.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network Error'));
    renderAddUser();

    fireEvent.change(screen.getByPlaceholderText('johndoe'), { target: { value: 'user1' } });
    fireEvent.change(screen.getByPlaceholderText('john@example.com'), { target: { value: 'u@t.com' } });
    fireEvent.change(screen.getByPlaceholderText('Minimum 6 characters'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));

    await waitFor(() => {
      expect(screen.getByText('Network Error')).toBeInTheDocument();
    });
  });
});
