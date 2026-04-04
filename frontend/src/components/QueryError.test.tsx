import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryError } from './QueryError';

describe('QueryError', () => {
  it('renders default error message with role="alert"', () => {
    render(<QueryError />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Failed to load data');
  });

  it('renders custom error message', () => {
    render(<QueryError message="Custom error occurred" />);
    expect(screen.getByText('Custom error occurred')).toBeInTheDocument();
  });

  it('renders retry button when onRetry provided', () => {
    render(<QueryError onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('does not render retry button when onRetry not provided', () => {
    render(<QueryError />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button clicked', () => {
    const onRetry = vi.fn();
    render(<QueryError onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
