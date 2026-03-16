import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPage } from './SettingsPage';

const mockToggleDarkMode = vi.fn();
const mockSetUser = vi.fn();
const mockToast = vi.fn();

vi.mock('@/store', () => ({
  useStore: vi.fn(() => ({
    user: { id: 1, username: 'tim', email: 'tim@test.com', full_name: 'Tim Test', avatar_color: '#3B82F6' },
    setUser: mockSetUser,
    darkMode: false,
    toggleDarkMode: mockToggleDarkMode,
  })),
}));

vi.mock('@/components/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/api', () => ({
  users: {
    updateMe: vi.fn(),
  },
}));

import { useStore } from '@/store';
import { users } from '@/lib/api';

let queryClient: QueryClient;

function renderSettings() {
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 1, username: 'tim', email: 'tim@test.com', full_name: 'Tim Test', avatar_color: '#3B82F6' },
      setUser: mockSetUser,
      darkMode: false,
      toggleDarkMode: mockToggleDarkMode,
    });
    (users.updateMe as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, username: 'tim', email: 'tim@test.com', full_name: 'Tim Updated', avatar_color: '#3B82F6',
    });
  });

  it('renders settings heading', () => {
    renderSettings();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Manage your account settings')).toBeInTheDocument();
  });

  it('renders profile section with user data', () => {
    renderSettings();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByDisplayValue('tim')).toBeInTheDocument();
    expect(screen.getByDisplayValue('tim@test.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Tim Test')).toBeInTheDocument();
  });

  it('has labels associated with inputs via htmlFor/id', () => {
    renderSettings();
    expect(screen.getByLabelText('Username')).toHaveAttribute('id', 'settings-username');
    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'settings-email');
    expect(screen.getByLabelText('Full Name')).toHaveAttribute('id', 'settings-full-name');
  });

  it('disables username and email fields', () => {
    renderSettings();
    expect(screen.getByLabelText('Username')).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeDisabled();
  });

  it('shows username cannot be changed hint', () => {
    renderSettings();
    expect(screen.getByText('Username cannot be changed')).toBeInTheDocument();
  });

  it('renders appearance section with dark mode toggle', () => {
    renderSettings();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeInTheDocument();
  });

  it('calls toggleDarkMode when toggle clicked', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('switch', { name: 'Dark mode' }));
    expect(mockToggleDarkMode).toHaveBeenCalled();
  });

  it('renders avatar color picker', () => {
    renderSettings();
    expect(screen.getByText('Avatar Color')).toBeInTheDocument();
    expect(screen.getByLabelText('Set avatar color to Red')).toBeInTheDocument();
  });

  it('renders avatar preview with user initials', () => {
    renderSettings();
    expect(screen.getByText('TI')).toBeInTheDocument();
  });

  it('allows editing full name', () => {
    renderSettings();
    const input = screen.getByDisplayValue('Tim Test');
    fireEvent.change(input, { target: { value: 'Tim Updated' } });
    expect(input).toHaveValue('Tim Updated');
  });

  it('renders save button', () => {
    renderSettings();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('highlights selected avatar color', () => {
    renderSettings();
    const selected = screen.getByLabelText('Set avatar color to Blue');
    expect(selected).toHaveAttribute('aria-pressed', 'true');
  });

  // --- Save button disabled/enabled (isDirty) ---
  it('disables save button when no changes made', () => {
    renderSettings();
    const saveBtn = screen.getByText('Save Changes').closest('button')!;
    expect(saveBtn).toBeDisabled();
  });

  it('enables save button when full name is changed', () => {
    renderSettings();
    const input = screen.getByDisplayValue('Tim Test');
    fireEvent.change(input, { target: { value: 'Tim Updated' } });
    const saveBtn = screen.getByText('Save Changes').closest('button')!;
    expect(saveBtn).not.toBeDisabled();
  });

  it('enables save button when avatar color is changed', () => {
    renderSettings();
    fireEvent.click(screen.getByLabelText('Set avatar color to Red'));
    const saveBtn = screen.getByText('Save Changes').closest('button')!;
    expect(saveBtn).not.toBeDisabled();
  });

  // --- Save mutation ---
  it('shows success toast on save', async () => {
    renderSettings();
    fireEvent.change(screen.getByDisplayValue('Tim Test'), { target: { value: 'Tim Updated' } });
    fireEvent.click(screen.getByText('Save Changes').closest('button')!);
    await waitFor(() => {
      expect(users.updateMe).toHaveBeenCalledWith({
        full_name: 'Tim Updated',
        avatar_color: '#3B82F6',
      });
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Settings saved.', 'success');
    });
    expect(mockSetUser).toHaveBeenCalled();
  });

  it('shows error toast on save failure', async () => {
    (users.updateMe as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    renderSettings();
    fireEvent.change(screen.getByDisplayValue('Tim Test'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByText('Save Changes').closest('button')!);
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Failed to save settings. Please try again.');
    });
  });

  // --- Saving... state ---
  it('shows Saving... text and disables button while save is pending', async () => {
    (users.updateMe as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderSettings();
    fireEvent.change(screen.getByDisplayValue('Tim Test'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByText('Save Changes').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
    expect(screen.getByText('Saving...').closest('button')).toBeDisabled();
  });

  // --- Clear full_name sends undefined ---
  it('sends full_name: undefined when name field is cleared', async () => {
    renderSettings();
    fireEvent.change(screen.getByDisplayValue('Tim Test'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Save Changes').closest('button')!);
    await waitFor(() => {
      expect(users.updateMe).toHaveBeenCalledWith({
        full_name: undefined,
        avatar_color: '#3B82F6',
      });
    });
  });

  it('shows aria-busy on save button while pending', async () => {
    (users.updateMe as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderSettings();
    fireEvent.change(screen.getByDisplayValue('Tim Test'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByText('Save Changes').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
    const btn = screen.getByText('Saving...').closest('button')!;
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('has aria-describedby on dark mode toggle', () => {
    renderSettings();
    const toggle = screen.getByRole('switch', { name: 'Dark mode' });
    expect(toggle).toHaveAttribute('aria-describedby', 'dark-mode-desc');
    expect(screen.getByText('Switch between light and dark theme')).toHaveAttribute('id', 'dark-mode-desc');
  });

  // --- Dark mode switch reflects state ---
  it('shows aria-checked when dark mode is on', () => {
    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 1, username: 'tim', email: 'tim@test.com', full_name: 'Tim', avatar_color: '#3B82F6' },
      setUser: mockSetUser,
      darkMode: true,
      toggleDarkMode: mockToggleDarkMode,
    });
    renderSettings();
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toHaveAttribute('aria-checked', 'true');
  });
});
