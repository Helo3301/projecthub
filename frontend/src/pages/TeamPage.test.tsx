import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeamPage } from './TeamPage';

vi.mock('@/lib/api', () => ({
  users: {
    list: vi.fn(),
  },
}));

import { users } from '@/lib/api';

let queryClient: QueryClient;

function renderTeamPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TeamPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('TeamPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
  });

  it('renders team heading', () => {
    (users.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderTeamPage();
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByText('Manage your team members')).toBeInTheDocument();
  });

  it('renders add user link', () => {
    (users.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderTeamPage();
    const link = screen.getByText('Add User');
    expect(link.closest('a')).toHaveAttribute('href', '/team/add');
  });

  it('shows loading skeleton initially', () => {
    (users.list as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    const { container } = renderTeamPage();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows "Members" without count while loading', () => {
    (users.list as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderTeamPage();
    expect(screen.getByText('Members')).toBeInTheDocument();
  });

  it('displays team members after loading', async () => {
    (users.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, username: 'alice', full_name: 'Alice Smith', avatar_color: '#EF4444' },
      { id: 2, username: 'bob', full_name: null, avatar_color: '#3B82F6' },
    ]);
    renderTeamPage();

    expect(await screen.findByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('@alice')).toBeInTheDocument();
    // When full_name is null, falls back to username
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
  });

  it('shows member count after loading', async () => {
    (users.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, username: 'alice', full_name: 'Alice', avatar_color: '#EF4444' },
    ]);
    renderTeamPage();
    expect(await screen.findByText('Members (1)')).toBeInTheDocument();
  });

  it('shows empty state when no members', async () => {
    (users.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderTeamPage();
    expect(await screen.findByText('No team members yet')).toBeInTheDocument();
  });

  it('displays avatar initials from username, not full_name', async () => {
    (users.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, username: 'alice', full_name: 'Zara Jones', avatar_color: '#EF4444' },
    ]);
    renderTeamPage();
    // Initials come from username ('alice' → 'AL'), not full_name ('Zara' → 'ZA')
    expect(await screen.findByText('AL')).toBeInTheDocument();
  });

  it('uses default avatar color when avatar_color is null', async () => {
    (users.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, username: 'tim', full_name: 'Tim', avatar_color: null },
    ]);
    renderTeamPage();
    const avatar = await screen.findByText('TI');
    expect(avatar).toHaveStyle({ backgroundColor: '#4F46E5' });
  });

  it('shows Member role badge for each member', async () => {
    (users.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, username: 'alice', full_name: 'Alice', avatar_color: '#EF4444' },
      { id: 2, username: 'bob', full_name: 'Bob', avatar_color: '#3B82F6' },
    ]);
    renderTeamPage();
    await screen.findByText('Alice');
    const memberBadges = screen.getAllByText('Member');
    expect(memberBadges).toHaveLength(2);
  });

  // --- Accessibility ---
  it('renders member list with role="list" and role="listitem"', async () => {
    (users.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, username: 'alice', full_name: 'Alice', avatar_color: '#EF4444' },
    ]);
    renderTeamPage();
    await screen.findByText('Alice');
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toBeInTheDocument();
  });

  it('avatar has role="img" with accessible name', async () => {
    (users.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, username: 'alice', full_name: 'Alice Smith', avatar_color: '#EF4444' },
    ]);
    renderTeamPage();
    await screen.findByText('Alice Smith');
    expect(screen.getByRole('img', { name: 'Alice Smith' })).toBeInTheDocument();
  });

  // --- Error states ---
  it('shows error state when users fail to load', async () => {
    (users.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    renderTeamPage();
    await waitFor(() => {
      expect(screen.getByText('Failed to load team members')).toBeInTheDocument();
    });
  });

  it('shows retry button on error', async () => {
    (users.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    renderTeamPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  // --- Stale-data banner ---
  it('shows stale-data banner when refetch fails but cached data exists', async () => {
    // Pre-seed cache to ensure data survives regardless of gcTime settings
    const cachedMembers = [{ id: 1, username: 'alice', full_name: 'Alice', avatar_color: '#EF4444' }];
    queryClient.setQueryData(['users'], cachedMembers);
    // API will reject on next call
    (users.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
    renderTeamPage();
    await waitFor(() => {
      expect(screen.getByText('Failed to refresh — showing cached data')).toBeInTheDocument();
    });
    // Cached data still visible
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
