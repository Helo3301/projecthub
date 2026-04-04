import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Register } from './Register';

function renderRegister() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Register />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Register', () => {
  it('renders registration form', () => {
    renderRegister();
    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('username-input')).toBeInTheDocument();
    expect(screen.getByTestId('password-input')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument();
  });

  it('renders full name field as optional', () => {
    renderRegister();
    expect(screen.getByText(/full name/i)).toBeInTheDocument();
    expect(screen.getByText(/optional/i)).toBeInTheDocument();
  });

  it('shows password mismatch error on submit', () => {
    renderRegister();

    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'different' } });

    fireEvent.click(screen.getByTestId('register-button'));
    // Inline hint + form-level error both show the message
    const matches = screen.getAllByText('Passwords do not match');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows password length error on submit', () => {
    renderRegister();

    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'short' } });
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'short' } });

    fireEvent.click(screen.getByTestId('register-button'));
    // Inline hint + form-level error both show the message
    const matches = screen.getAllByText('Password must be at least 6 characters');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('toggles password visibility', () => {
    renderRegister();
    const passwordInput = screen.getByTestId('password-input');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByLabelText('Show password'));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByLabelText('Hide password'));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('has link to login page', () => {
    renderRegister();
    const loginLink = screen.getByText('Sign in');
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  it('renders create account button', () => {
    renderRegister();
    expect(screen.getByTestId('register-button')).toHaveTextContent('Create Account');
  });

  it('shows inline password length hint while typing', () => {
    renderRegister();
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'abc' } });
    expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'abcdef' } });
    expect(screen.queryByText('Password must be at least 6 characters')).not.toBeInTheDocument();
  });

  it('shows inline password mismatch hint while typing', () => {
    renderRegister();
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'pass' } });
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'password123' } });
    expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument();
  });
});
