import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPicker } from './ColorPicker';

describe('ColorPicker', () => {
  it('renders label', () => {
    render(<ColorPicker value={undefined} onChange={() => {}} />);
    expect(screen.getByText('Color')).toBeInTheDocument();
  });

  it('renders custom label', () => {
    render(<ColorPicker value={undefined} onChange={() => {}} label="Task Color" />);
    expect(screen.getByText('Task Color')).toBeInTheDocument();
  });

  it('renders preset color buttons', () => {
    render(<ColorPicker value={undefined} onChange={() => {}} />);
    expect(screen.getByTestId('color-#EF4444')).toBeInTheDocument();
    expect(screen.getByTestId('color-#3B82F6')).toBeInTheDocument();
    expect(screen.getByTestId('color-#6366F1')).toBeInTheDocument();
  });

  it('renders no-color button when allowNone is true', () => {
    render(<ColorPicker value={undefined} onChange={() => {}} allowNone={true} />);
    expect(screen.getByTestId('color-none')).toBeInTheDocument();
  });

  it('does not render no-color button when allowNone is false', () => {
    render(<ColorPicker value={undefined} onChange={() => {}} allowNone={false} />);
    expect(screen.queryByTestId('color-none')).not.toBeInTheDocument();
  });

  it('calls onChange when preset color clicked', () => {
    const onChange = vi.fn();
    render(<ColorPicker value={undefined} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('color-#EF4444'));
    expect(onChange).toHaveBeenCalledWith('#EF4444');
  });

  it('calls onChange with undefined when no-color clicked', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#EF4444" onChange={onChange} />);

    fireEvent.click(screen.getByTestId('color-none'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('highlights selected preset color', () => {
    render(<ColorPicker value="#3B82F6" onChange={() => {}} />);
    const selected = screen.getByTestId('color-#3B82F6');
    expect(selected.className).toContain('scale-110');
  });

  it('shows preset color name when a preset color is selected', () => {
    render(<ColorPicker value="#EF4444" onChange={() => {}} />);
    expect(screen.getByText('Red')).toBeInTheDocument();
  });

  it('shows hex value when a custom color is selected', () => {
    render(<ColorPicker value="#123456" onChange={() => {}} />);
    expect(screen.getByText('#123456')).toBeInTheDocument();
  });

  it('does not show color value when no color selected', () => {
    render(<ColorPicker value={undefined} onChange={() => {}} />);
    expect(screen.queryByText(/#[A-F0-9]{6}/i)).not.toBeInTheDocument();
  });

  it('uses human-readable names in aria-labels', () => {
    render(<ColorPicker value={undefined} onChange={() => {}} />);
    expect(screen.getByLabelText('Select color Red')).toBeInTheDocument();
    expect(screen.getByLabelText('Select color Blue')).toBeInTheDocument();
    expect(screen.getByLabelText('Select color Indigo')).toBeInTheDocument();
  });

  it('renders custom color picker button', () => {
    render(<ColorPicker value={undefined} onChange={() => {}} />);
    expect(screen.getByLabelText('Custom color')).toBeInTheDocument();
  });

  it('renders custom color button with value when custom color is active', () => {
    render(<ColorPicker value="#123456" onChange={() => {}} />);
    expect(screen.getByLabelText('Custom color: #123456')).toBeInTheDocument();
  });
});
