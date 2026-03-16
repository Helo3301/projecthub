import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyProjectState } from './EmptyProjectState';

describe('EmptyProjectState', () => {
  it('renders no project selected heading', () => {
    render(<EmptyProjectState feature="the calendar" />);
    expect(screen.getByText('No Project Selected')).toBeInTheDocument();
  });

  it('displays feature name in description', () => {
    render(<EmptyProjectState feature="the Gantt chart" />);
    expect(screen.getByText(/Select a project from the sidebar to view the Gantt chart/)).toBeInTheDocument();
  });

  it('renders with different feature names', () => {
    render(<EmptyProjectState feature="the Kanban board" />);
    expect(screen.getByText(/the Kanban board/)).toBeInTheDocument();
  });
});
