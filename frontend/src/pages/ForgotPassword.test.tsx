import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ForgotPassword } from './ForgotPassword';

vi.mock('@/lib/api', () => ({
  auth: {
    forgotPassword: vi.fn(),
  },
}));

import { auth } from '@/lib/api';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function renderForgotPassword() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ForgotPassword />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('renders forgot password form', () => {
    renderForgotPassword();
    expect(screen.getByText('Forgot Password?')).toBeInTheDocument();
    expect(screen.getByText('Enter your email or username to reset your password')).toBeInTheDocument();
  });

  it('renders email/username input', () => {
    renderForgotPassword();
    expect(screen.getByPlaceholderText('Enter your email or username')).toBeInTheDocument();
  });

  it('renders reset password button', () => {
    renderForgotPassword();
    expect(screen.getByText('Reset Password')).toBeInTheDocument();
  });

  it('has back to login link', () => {
    renderForgotPassword();
    const link = screen.getByText('Back to Login');
    expect(link.closest('a')).toHaveAttribute('href', '/login');
  });

  it('allows typing in email field', () => {
    renderForgotPassword();
    const input = screen.getByPlaceholderText('Enter your email or username');
    fireEvent.change(input, { target: { value: 'tim@test.com' } });
    expect(input).toHaveValue('tim@test.com');
  });

  it('shows token after successful submission', async () => {
    (auth.forgotPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
      message: 'Token generated',
      reset_token: 'abc123token',
    });

    renderForgotPassword();
    fireEvent.change(screen.getByPlaceholderText('Enter your email or username'), {
      target: { value: 'tim' },
    });
    fireEvent.click(screen.getByText('Reset Password'));

    expect(await screen.findByText('Token Generated!')).toBeInTheDocument();
    expect(screen.getByText('abc123token')).toBeInTheDocument();
    expect(screen.getByText('Continue to Reset Password')).toBeInTheDocument();
  });

  it('shows token expiry notice after generation', async () => {
    (auth.forgotPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
      message: 'Token generated',
      reset_token: 'abc123token',
    });

    renderForgotPassword();
    fireEvent.change(screen.getByPlaceholderText('Enter your email or username'), {
      target: { value: 'tim' },
    });
    fireEvent.click(screen.getByText('Reset Password'));

    expect(await screen.findByText('This token expires in 1 hour')).toBeInTheDocument();
  });

  it('renders copy button for token', async () => {
    (auth.forgotPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
      message: 'Token generated',
      reset_token: 'abc123token',
    });

    renderForgotPassword();
    fireEvent.change(screen.getByPlaceholderText('Enter your email or username'), {
      target: { value: 'tim' },
    });
    fireEvent.click(screen.getByText('Reset Password'));

    expect(await screen.findByText('Copy')).toBeInTheDocument();
  });

  it('shows check email message when server omits reset_token', async () => {
    (auth.forgotPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
      message: 'Reset email sent',
    });

    renderForgotPassword();
    fireEvent.change(screen.getByPlaceholderText('Enter your email or username'), {
      target: { value: 'tim@test.com' },
    });
    fireEvent.click(screen.getByText('Reset Password'));

    expect(await screen.findByText('Request Sent')).toBeInTheDocument();
    expect(screen.getByText(/receive a password reset link/)).toBeInTheDocument();
  });
});
