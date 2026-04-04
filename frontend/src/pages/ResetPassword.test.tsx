import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ResetPassword } from './ResetPassword';

vi.mock('@/lib/api', () => ({
  auth: {
    resetPassword: vi.fn(),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function renderResetPassword(initialEntry = '/reset-password') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ResetPassword />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ResetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('renders reset password form', () => {
    renderResetPassword();
    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeInTheDocument();
    expect(screen.getByText('Enter your new password below')).toBeInTheDocument();
  });

  it('shows token field when no token in URL', () => {
    renderResetPassword();
    expect(screen.getByPlaceholderText('Paste your reset token')).toBeInTheDocument();
  });

  it('hides token field when token is in URL', () => {
    renderResetPassword('/reset-password?token=abc123');
    expect(screen.queryByPlaceholderText('Paste your reset token')).not.toBeInTheDocument();
  });

  it('renders password and confirm password fields', () => {
    renderResetPassword();
    expect(screen.getByPlaceholderText('Enter new password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirm new password')).toBeInTheDocument();
  });

  it('toggles password visibility', () => {
    renderResetPassword();
    const input = screen.getByPlaceholderText('Enter new password');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByLabelText('Show password'));
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByLabelText('Hide password'));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows password mismatch warning', () => {
    renderResetPassword();
    fireEvent.change(screen.getByPlaceholderText('Enter new password'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm new password'), {
      target: { value: 'different' },
    });
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });

  it('shows password length warning', () => {
    renderResetPassword();
    fireEvent.change(screen.getByPlaceholderText('Enter new password'), {
      target: { value: 'abc' },
    });
    expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
  });

  it('disables submit when passwords do not match', () => {
    renderResetPassword('/reset-password?token=abc123');
    fireEvent.change(screen.getByPlaceholderText('Enter new password'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm new password'), {
      target: { value: 'different' },
    });
    const submitBtn = screen.getByRole('button', { name: /Reset Password/i });
    expect(submitBtn).toBeDisabled();
  });

  it('has back to login link', () => {
    renderResetPassword();
    const link = screen.getByText('Back to Login');
    expect(link.closest('a')).toHaveAttribute('href', '/login');
  });
});
