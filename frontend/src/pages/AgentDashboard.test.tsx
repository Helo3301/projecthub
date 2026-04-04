import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AgentDashboard from './AgentDashboard';

vi.mock('@/lib/api', () => ({
  agents: {
    list: vi.fn(),
    orchestratorStatus: vi.fn(),
    getGlobalFeed: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mutable feed state for per-test overrides
const mockFeedState = {
  actions: [] as any[],
  isConnected: true,
  isPaused: false,
  newCount: 0,
  togglePause: vi.fn(),
  clear: vi.fn(),
  scrollToTop: vi.fn(),
  setScrolledDown: vi.fn(),
};

vi.mock('@/hooks/useAgentFeed', () => ({
  useAgentFeed: () => mockFeedState,
}));

import { agents as agentsApi } from '@/lib/api';

let queryClient: QueryClient;

function renderDashboard() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AgentDashboard />
    </QueryClientProvider>
  );
}

function makeAgent(id: number, name: string, status = 'working', isAlive = true) {
  return {
    id,
    name,
    agent_type: 'claude_code',
    status,
    is_alive: isAlive,
    capabilities: [],
    created_at: new Date().toISOString(),
    last_heartbeat: new Date().toISOString(),
    current_task: null,
    session_id: null,
  };
}

function makeAction(id: number, opts: Partial<{
  agent_id: number;
  agent_name: string;
  action_type: string;
  summary: string;
  detail: string;
  created_at: string;
  metadata: Record<string, unknown>;
}> = {}) {
  return {
    id,
    agent_id: opts.agent_id ?? 1,
    agent_name: opts.agent_name ?? 'test-agent',
    action_type: opts.action_type ?? 'tool_call',
    summary: opts.summary ?? `Action ${id}`,
    detail: opts.detail ?? '',
    created_at: opts.created_at ?? new Date().toISOString(),
    metadata: opts.metadata,
  };
}

describe('AgentDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    (agentsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (agentsApi.orchestratorStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ max_agents: 5 });
    (agentsApi.getGlobalFeed as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    // Reset mutable feed state
    mockFeedState.actions = [];
    mockFeedState.isConnected = true;
    mockFeedState.isPaused = false;
    mockFeedState.newCount = 0;
  });

  it('renders dashboard heading', () => {
    renderDashboard();
    expect(screen.getByText('Agent Orchestrator')).toBeInTheDocument();
  });

  it('shows live connection status', () => {
    renderDashboard();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows reconnecting status when not connected', () => {
    mockFeedState.isConnected = false;
    renderDashboard();
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
  });

  it('shows status skeleton while loading', () => {
    (agentsApi.list as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderDashboard();
    // Capacity text should NOT be visible while loading (skeleton shown instead)
    expect(screen.queryByText('Capacity')).not.toBeInTheDocument();
  });

  it('shows capacity info after loading', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/0 of 5 slots/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no agents', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('No agents registered')).toBeInTheDocument();
    });
  });

  it('shows empty feed message', () => {
    renderDashboard();
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('renders feed filter buttons', () => {
    renderDashboard();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tools' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decisions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Errors' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderDashboard();
    expect(screen.getByPlaceholderText('Search feed…')).toBeInTheDocument();
  });

  it('renders pause and clear controls', () => {
    renderDashboard();
    expect(screen.getByLabelText('Pause feed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear activity feed' })).toBeInTheDocument();
  });

  it('renders capacity and feed panels', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Capacity')).toBeInTheDocument();
    });
    expect(screen.getByText('Feed')).toBeInTheDocument();
  });

  it('displays agents when loaded', async () => {
    (agentsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([makeAgent(1, 'test-agent')]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getAllByText('test-agent').length).toBeGreaterThan(0);
    });
  });

  it('shows registered count in header', async () => {
    (agentsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([makeAgent(1, 'agent-1')]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('registered')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
    });
  });

  it('displays feed actions', () => {
    mockFeedState.actions = [
      makeAction(1, { summary: 'Running tests' }),
      makeAction(2, { summary: 'Deploying code', action_type: 'decision' }),
    ];
    renderDashboard();
    expect(screen.getByText('Running tests')).toBeInTheDocument();
    expect(screen.getByText('Deploying code')).toBeInTheDocument();
  });

  it('shows feed event count in status panel', async () => {
    mockFeedState.actions = [makeAction(1), makeAction(2), makeAction(3)];
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('3 events')).toBeInTheDocument();
    });
  });

  it('filters feed by search query', () => {
    mockFeedState.actions = [
      makeAction(1, { summary: 'Running tests' }),
      makeAction(2, { summary: 'Deploying code' }),
    ];
    renderDashboard();
    fireEvent.change(screen.getByPlaceholderText('Search feed…'), { target: { value: 'deploy' } });
    expect(screen.getByText('Deploying code')).toBeInTheDocument();
    expect(screen.queryByText('Running tests')).not.toBeInTheDocument();
  });

  it('filters feed by type', () => {
    mockFeedState.actions = [
      makeAction(1, { summary: 'Tool action', action_type: 'tool_call' }),
      makeAction(2, { summary: 'Error occurred', action_type: 'error' }),
    ];
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Errors' }));
    expect(screen.getByText('Error occurred')).toBeInTheDocument();
    expect(screen.queryByText('Tool action')).not.toBeInTheDocument();
  });

  it('shows agent status badge', async () => {
    (agentsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeAgent(1, 'worker-1', 'working'),
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    });
  });

  it('shows agent type formatted', async () => {
    (agentsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeAgent(1, 'worker-1', 'idle'),
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Claude Code')).toBeInTheDocument();
    });
  });

  it('shows offline agent status', async () => {
    (agentsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeAgent(1, 'dead-agent', 'offline', false),
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getAllByText('Offline').length).toBeGreaterThan(0);
    });
  });

  it('clears search when X button clicked', () => {
    mockFeedState.actions = [
      makeAction(1, { summary: 'Running tests' }),
      makeAction(2, { summary: 'Deploying code' }),
    ];
    renderDashboard();
    const searchInput = screen.getByPlaceholderText('Search feed…');
    fireEvent.change(searchInput, { target: { value: 'deploy' } });
    expect(screen.queryByText('Running tests')).not.toBeInTheDocument();

    // Click the clear search button
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(screen.getByText('Running tests')).toBeInTheDocument();
    expect(screen.getByText('Deploying code')).toBeInTheDocument();
  });

  it('filters github actions together', () => {
    mockFeedState.actions = [
      makeAction(1, { summary: 'Pushed code', action_type: 'github_push' }),
      makeAction(2, { summary: 'Opened PR', action_type: 'github_pr' }),
      makeAction(3, { summary: 'Called tool', action_type: 'tool_call' }),
    ];
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'GitHub' }));
    expect(screen.getByText('Pushed code')).toBeInTheDocument();
    expect(screen.getByText('Opened PR')).toBeInTheDocument();
    expect(screen.queryByText('Called tool')).not.toBeInTheDocument();
  });

  it('shows new events banner when newCount > 0', () => {
    mockFeedState.newCount = 5;
    mockFeedState.actions = [makeAction(1)];
    renderDashboard();
    expect(screen.getByText('5 new events')).toBeInTheDocument();
  });

  it('shows singular event text for newCount = 1', () => {
    mockFeedState.newCount = 1;
    mockFeedState.actions = [makeAction(1)];
    renderDashboard();
    expect(screen.getByText('1 new event')).toBeInTheDocument();
  });

  it('shows paused status in feed panel', async () => {
    mockFeedState.isPaused = true;
    mockFeedState.newCount = 3;
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Paused (3 buffered)')).toBeInTheDocument();
    });
  });

  it('shows resume feed title when paused', () => {
    mockFeedState.isPaused = true;
    renderDashboard();
    expect(screen.getByLabelText('Resume feed')).toBeInTheDocument();
  });

  it('toggles pause when pause button clicked', () => {
    renderDashboard();
    fireEvent.click(screen.getByLabelText('Pause feed'));
    expect(mockFeedState.togglePause).toHaveBeenCalledTimes(1);
  });

  it('shows no matching activity when filters yield no results', () => {
    mockFeedState.actions = [makeAction(1, { action_type: 'tool_call' })];
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Errors' }));
    expect(screen.getByText('No matching activity')).toBeInTheDocument();
    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('clear filters button resets all filters', () => {
    mockFeedState.actions = [makeAction(1, { summary: 'Tool action', action_type: 'tool_call' })];
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Errors' }));
    expect(screen.getByText('No matching activity')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear filters'));
    expect(screen.getByText('Tool action')).toBeInTheDocument();
  });

  it('shows filtered event count when filters active', async () => {
    mockFeedState.actions = [
      makeAction(1, { action_type: 'tool_call' }),
      makeAction(2, { action_type: 'error' }),
      makeAction(3, { action_type: 'tool_call' }),
    ];
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Feed')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Errors' }));
    expect(screen.getByText('1 of 3 events')).toBeInTheDocument();
  });

  it('shows agent detail panel when agent clicked', async () => {
    (agentsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeAgent(1, 'detail-agent', 'working'),
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getAllByText('detail-agent').length).toBeGreaterThan(0);
    });
    // Click the agent in the right-panel status list
    const agentButtons = screen.getAllByRole('button', { name: /detail-agent/i });
    fireEvent.click(agentButtons[agentButtons.length - 1]);
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });
  });

  it('shows agent capabilities in detail panel', async () => {
    const agentWithCaps = { ...makeAgent(1, 'cap-agent'), capabilities: ['code_review', 'testing'] };
    (agentsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([agentWithCaps]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getAllByText('cap-agent').length).toBeGreaterThan(0);
    });
    const agentButtons = screen.getAllByRole('button', { name: /cap-agent/i });
    fireEvent.click(agentButtons[agentButtons.length - 1]);
    await waitFor(() => {
      expect(screen.getByText('Capabilities')).toBeInTheDocument();
      expect(screen.getByText('code_review')).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument();
    });
  });

  it('shows current task in agent detail panel', async () => {
    const agentWithTask = { ...makeAgent(1, 'busy-agent'), current_task: { id: 1, title: 'Fix login bug' } };
    (agentsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([agentWithTask]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getAllByText('busy-agent').length).toBeGreaterThan(0);
    });
    const agentButtons = screen.getAllByRole('button', { name: /busy-agent/i });
    fireEvent.click(agentButtons[agentButtons.length - 1]);
    await waitFor(() => {
      expect(screen.getByText('Current Task')).toBeInTheDocument();
      expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    });
  });

  it('deduplicates live and historical actions', async () => {
    // Same action ID in both live and historical — should appear once
    mockFeedState.actions = [makeAction(1, { summary: 'Live action' })];
    (agentsApi.getGlobalFeed as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeAction(1, { summary: 'Historical action' }),
    ]);
    renderDashboard();
    // Wait for query to resolve so deduplication logic runs
    await waitFor(() => {
      expect(screen.getByText('Live action')).toBeInTheDocument();
    });
    // Live version takes precedence — historical duplicate should be filtered
    expect(screen.queryByText('Historical action')).not.toBeInTheDocument();
  });

  it('shows confirm clear dialog', () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Clear activity feed' }));
    expect(screen.getByText('Confirm?')).toBeInTheDocument();
  });

  it('calls clear on confirm', () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Clear activity feed' }));
    fireEvent.click(screen.getByText('Confirm?'));
    expect(mockFeedState.clear).toHaveBeenCalledTimes(1);
  });

  it('shows agent API registration instructions when empty', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Register via API')).toBeInTheDocument();
    });
  });

  it('shows action detail when Details button clicked', () => {
    mockFeedState.actions = [
      makeAction(1, { summary: 'Action with detail', detail: 'Detailed output here' }),
    ];
    renderDashboard();
    fireEvent.click(screen.getByText('Details'));
    expect(screen.getByText('Detailed output here')).toBeInTheDocument();
    // Click again to hide
    fireEvent.click(screen.getByText('Hide'));
    expect(screen.queryByText('Detailed output here')).not.toBeInTheDocument();
  });

  it('shows loading skeletons while agents load', () => {
    (agentsApi.list as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderDashboard();
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('shows multiple status types', async () => {
    (agentsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeAgent(1, 'idle-agent', 'idle'),
      makeAgent(2, 'waiting-agent', 'waiting'),
      makeAgent(3, 'error-agent', 'error'),
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getAllByText('Idle').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Waiting for input').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Error').length).toBeGreaterThan(0);
    });
  });
});
