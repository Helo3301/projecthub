import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

function ToastTrigger({ type }: { type?: 'error' | 'success' | 'info' }) {
  const { toast } = useToast();
  return (
    <button onClick={() => toast('Test message', type)}>
      Show Toast
    </button>
  );
}

describe('Toast', () => {
  it('renders toast provider with children', () => {
    render(
      <ToastProvider>
        <div data-testid="child">Hello</div>
      </ToastProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders notifications region unconditionally', () => {
    render(
      <ToastProvider>
        <div>Hello</div>
      </ToastProvider>
    );
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('shows error toast when triggered', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows success toast', () => {
    render(
      <ToastProvider>
        <ToastTrigger type="success" />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('shows info toast', () => {
    render(
      <ToastProvider>
        <ToastTrigger type="info" />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('dismisses toast when dismiss button clicked', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Test message')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Dismiss notification'));
    expect(screen.queryByText('Test message')).not.toBeInTheDocument();
  });

  it('auto-dismisses toast after timeout', () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <ToastTrigger />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show Toast'));
      expect(screen.getByText('Test message')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(screen.queryByText('Test message')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('supports multiple toasts simultaneously', () => {
    function MultiTrigger() {
      const { toast } = useToast();
      return (
        <>
          <button onClick={() => toast('First toast')}>First</button>
          <button onClick={() => toast('Second toast', 'success')}>Second</button>
        </>
      );
    }

    render(
      <ToastProvider>
        <MultiTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('First'));
    fireEvent.click(screen.getByText('Second'));

    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
  });

  it('defaults to error type when no type specified', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Show Toast'));
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-red');
  });
});
