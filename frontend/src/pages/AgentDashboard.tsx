import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Circle, Pause, Play, Trash2, ChevronDown, ChevronRight,
  GitBranch, Zap, AlertTriangle, MessageSquare, RefreshCw,
  ArrowUp, CheckCircle, Search, X, Clock, Shield, Activity,
  Hash, Copy, Check, ExternalLink
} from 'lucide-react';
import { agents as agentsApi } from '@/lib/api';
import { useAgentFeed } from '@/hooks/useAgentFeed';
import type { Agent, AgentAction, AgentStatus, AgentType } from '@/types';

// ============ Constants ============

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: 'text-gray-400',
  working: 'text-green-400',
  waiting: 'text-yellow-400',
  error: 'text-red-400',
  offline: 'text-gray-500',
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Idle',
  working: 'Active',
  waiting: 'Waiting for input',
  error: 'Error',
  offline: 'Offline',
};

const ACTION_STYLES: Record<string, { color: string; icon: typeof Zap; label: string }> = {
  tool_call: { color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: Zap, label: 'Tool' },
  tool_result: { color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', icon: CheckCircle, label: 'Result' },
  decision: { color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: MessageSquare, label: 'Decision' },
  status_change: { color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: RefreshCw, label: 'Status' },
  error: { color: 'bg-red-500/20 text-red-300 border-red-500/30', icon: AlertTriangle, label: 'Error' },
  github_push: { color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: GitBranch, label: 'Push' },
  github_pr: { color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: GitBranch, label: 'PR' },
  task_update: { color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', icon: RefreshCw, label: 'Task' },
};

const FILTER_OPTIONS: Array<{ value: string | null; label: string }> = [
  { value: null, label: 'All' },
  { value: 'tool_call', label: 'Tools' },
  { value: 'decision', label: 'Decisions' },
  { value: 'github', label: 'GitHub' },
  { value: 'error', label: 'Errors' },
  { value: 'status_change', label: 'Status' },
];

// ============ Helpers ============

// Build a stable color map from visible agents, not DB IDs
const AGENT_COLORS = [
  '#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6',
];

function formatAgentType(type: AgentType): string {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function timeAgo(dateStr: string): string {
  const ms = new Date(dateStr).getTime();
  if (isNaN(ms)) return 'unknown';
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function absoluteTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'unknown';
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function extractLinks(metadata?: Record<string, unknown>): Array<{ key: string; url: string; label: string }> {
  if (!metadata) return [];
  const links: Array<{ key: string; url: string; label: string }> = [];
  for (const [key, val] of Object.entries(metadata)) {
    if (typeof val === 'string' && /^https?:\/\/(www\.)?github\.com\//i.test(val)) {
      const label = key.replace(/_/g, ' ').replace(/url$/i, '').trim() || 'Link';
      links.push({ key, url: val, label });
    }
  }
  return links;
}

const DETAIL_MAX_CHARS = 4096;
function truncateDetail(detail: string): { text: string; truncated: boolean } {
  if (detail.length <= DETAIL_MAX_CHARS) return { text: detail, truncated: false };
  return { text: detail.slice(0, DETAIL_MAX_CHARS), truncated: true };
}

// ============ Components ============

function AgentCard({
  agent,
  latestAction,
  isSelected,
  colorHex,
  onClick,
  onDelete,
}: {
  agent: Agent;
  latestAction?: AgentAction;
  isSelected: boolean;
  colorHex: string;
  onClick: () => void;
  onDelete: (id: number) => Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset confirm state when selection changes
  useEffect(() => {
    setConfirmDelete(false);
    setDeleteError(null);
  }, [isSelected]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      if (deleteErrorTimerRef.current) clearTimeout(deleteErrorTimerRef.current);
    };
  }, []);

  const startConfirmTimer = () => {
    setConfirmDelete(true);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 5000);
  };

  const handleDelete = async () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    try {
      await onDelete(agent.id);
    } catch {
      setConfirmDelete(false);
      setDeleteError('Failed to remove');
      if (deleteErrorTimerRef.current) clearTimeout(deleteErrorTimerRef.current);
      deleteErrorTimerRef.current = setTimeout(() => setDeleteError(null), 3000);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (confirmDelete) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      aria-label={`Select agent: ${agent.name}`}
      className={`bg-gray-800 border rounded-lg p-3 transition-colors cursor-pointer ${
        isSelected
          ? 'border-indigo-500 ring-1 ring-indigo-500/30'
          : 'border-gray-700 hover:border-gray-600'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: colorHex }}
            aria-hidden="true"
          />
          <span className="font-medium text-gray-100 text-sm truncate">{agent.name}</span>
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={handleDelete}
              aria-label={`Confirm remove agent ${agent.name}`}
              className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-500/10"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              aria-label="Cancel remove"
              className="text-xs text-gray-500 hover:text-gray-300 px-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); startConfirmTimer(); }}
            className="text-gray-600 hover:text-red-400 transition-colors p-0.5"
            aria-label={`Remove agent ${agent.name}`}
          >
            <Trash2 className="w-3 h-3" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-xs font-medium ${STATUS_COLORS[agent.status]}`}>
          {STATUS_LABELS[agent.status]}
        </span>
        <span className="text-xs text-gray-500">{formatAgentType(agent.agent_type)}</span>
      </div>
      {deleteError && (
        <p className="text-xs text-red-400 mb-1" role="alert">{deleteError}</p>
      )}
      {latestAction ? (
        <p className="text-xs text-gray-400 truncate leading-relaxed" title={latestAction.summary}>
          {latestAction.summary}
        </p>
      ) : agent.current_task ? (
        <p className="text-xs text-gray-400 truncate" title={agent.current_task.title}>
          Task: {agent.current_task.title}
        </p>
      ) : null}
    </div>
  );
}

const ActionItem = memo(function ActionItem({ action, agentColorHex }: { action: AgentAction; agentColorHex: string }) {
  const [expanded, setExpanded] = useState(false);
  const [, setRefresh] = useState(0);
  const style = ACTION_STYLES[action.action_type] || ACTION_STYLES.tool_call;

  // Each item refreshes its own timestamp independently
  useEffect(() => {
    const interval = setInterval(() => setRefresh(r => r + 1), 15000);
    return () => clearInterval(interval);
  }, []);
  const Icon = style.icon;
  const isError = action.action_type === 'error';

  return (
    <div
      className={`border-l-2 pl-3 py-2 transition-colors ${
        isError
          ? 'border-red-500/60 bg-red-500/5'
          : 'border-gray-700 hover:border-gray-500'
      }`}
      style={isError ? {} : { borderLeftColor: `${agentColorHex}40` }}
    >
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 p-1 rounded border ${style.color}`}>
          <Icon className="w-3 h-3" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: agentColorHex }}
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-gray-300">
              {action.agent_name || `Agent #${action.agent_id}`}
            </span>
            <span
              className="text-xs text-gray-500 cursor-default"
              title={absoluteTime(action.created_at)}
            >
              {timeAgo(action.created_at)}
            </span>
          </div>
          <p className={`text-sm leading-snug ${isError ? 'text-red-200' : 'text-gray-200'}`}>
            {action.summary}
          </p>
          {extractLinks(action.metadata).map(link => (
            <a
              key={link.key}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-0.5"
            >
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
              {link.url.replace(/^https?:\/\/github\.com\//, '')}
            </a>
          ))}
          {action.detail && (
            <button
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mt-1 transition-colors"
            >
              {expanded ? <ChevronDown className="w-3 h-3" aria-hidden="true" /> : <ChevronRight className="w-3 h-3" aria-hidden="true" />}
              {expanded ? 'Hide' : 'Details'}
            </button>
          )}
          {expanded && action.detail && (() => {
            const { text, truncated } = truncateDetail(action.detail);
            return (
              <div>
                <pre className="mt-2 p-2 bg-gray-900 rounded text-xs text-gray-400 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words border border-gray-800">
                  {text}
                </pre>
                {truncated && (
                  <p className="text-xs text-gray-600 mt-1">Output truncated at {DETAIL_MAX_CHARS} characters</p>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
});

// ============ Agent Detail Panel ============

function AgentDetailPanel({
  agent,
  actions,
  colorHex,
  onClose,
  actionsLoading = false,
}: {
  agent: Agent;
  actions: AgentAction[];
  colorHex: string;
  onClose: () => void;
  actionsLoading?: boolean;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const agentActions = actions.filter(a => a.agent_id === agent.id).slice(0, 50);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  // Focus panel on open for keyboard/screen reader accessibility
  useEffect(() => {
    panelRef.current?.focus();
  }, [agent.id]);

  const copyToClipboard = async (text: string, field: string) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // Fallback for HTTP contexts where clipboard API is unavailable
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        ok = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        // Both methods failed
      }
    }
    if (ok) {
      setCopiedField(field);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const uptime = agent.last_heartbeat
    ? timeAgo(agent.last_heartbeat)
    : 'Never';

  return (
    <div ref={panelRef} tabIndex={-1} className="bg-gray-850 border-t border-gray-700 lg:border-t-0 lg:border-l outline-none">
      <div className="p-4">
        {/* Mobile back button */}
        <button onClick={onClose} className="lg:hidden flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mb-3">
          <ChevronRight className="w-3 h-3 rotate-180" aria-hidden="true" />
          Back to overview
        </button>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorHex }} aria-hidden="true" />
            <h3 className="font-semibold text-gray-100">{agent.name}</h3>
          </div>
          <button onClick={onClose} aria-label="Close agent detail" className="text-gray-500 hover:text-gray-300 p-1 hidden lg:block">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            agent.is_alive
              ? 'bg-green-500/15 text-green-400 border border-green-500/30'
              : 'bg-gray-700 text-gray-400 border border-gray-600'
          }`}>
            <Circle className={`w-1.5 h-1.5 fill-current ${agent.is_alive ? 'text-green-400' : 'text-gray-500'}`} aria-hidden="true" />
            {STATUS_LABELS[agent.status]}
          </span>
          <span className="text-xs text-gray-500">{formatAgentType(agent.agent_type)}</span>
        </div>

        {/* Info Grid */}
        <div className="space-y-2.5 mb-4">
          <div className="flex items-start gap-2 text-xs">
            <Clock className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div>
              <span className="text-gray-500">Last heartbeat</span>
              <p className="text-gray-300" title={agent.last_heartbeat ? absoluteTime(agent.last_heartbeat) : undefined}>
                {uptime}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs">
            <Activity className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div>
              <span className="text-gray-500">Actions</span>
              <p className="text-gray-300">
                {actionsLoading && agentActions.length === 0 ? 'Loading…' : `${agentActions.length} shown`}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs">
            <Hash className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div>
              <span className="text-gray-500">Registered</span>
              <p className="text-gray-300">{absoluteTime(agent.created_at)}</p>
            </div>
          </div>

          {agent.session_id && (
            <div className="flex items-start gap-2 text-xs">
              <Shield className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <span className="text-gray-500">Session</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <code className="text-gray-400 bg-gray-800 px-1 rounded text-[10px] truncate block">
                    {agent.session_id}
                  </code>
                  <button
                    onClick={() => copyToClipboard(agent.session_id!, 'session')}
                    className="text-gray-600 hover:text-gray-400 flex-shrink-0"
                    aria-label="Copy session ID"
                  >
                    {copiedField === 'session' ? <Check className="w-3 h-3 text-green-400" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Capabilities */}
        {agent.capabilities.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-1.5">Capabilities</p>
            <div className="flex flex-wrap gap-1">
              {agent.capabilities.map(cap => (
                <span key={cap} className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-400">
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Current Task */}
        {agent.current_task && (
          <div className="mb-4 p-2 bg-indigo-500/10 border border-indigo-500/20 rounded">
            <p className="text-xs text-indigo-400 mb-0.5">Current Task</p>
            <p className="text-sm text-gray-200">{agent.current_task.title}</p>
          </div>
        )}

        {/* Recent Actions */}
        <div>
          <p className="text-xs text-gray-500 mb-2">Recent Activity</p>
          {agentActions.length === 0 ? (
            <p className="text-xs text-gray-600 italic">No recorded actions</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {agentActions.map(action => {
                const style = ACTION_STYLES[action.action_type] || ACTION_STYLES.tool_call;
                const Icon = style.icon;
                return (
                  <div key={action.id} className="flex items-start gap-2 py-1">
                    <div className={`mt-0.5 p-0.5 rounded ${style.color}`}>
                      <Icon className="w-2.5 h-2.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-300 truncate">{action.summary}</p>
                      <span className="text-[10px] text-gray-600">{timeAgo(action.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Main Dashboard ============

export default function AgentDashboard() {
  const queryClient = useQueryClient();
  const feedRef = useRef<HTMLDivElement>(null);
  const [feedFilter, setFeedFilter] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<number | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tick, setTick] = useState(0);

  // Refresh relative timestamps every 15s
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  // Clean up confirm-clear timer on unmount
  useEffect(() => {
    return () => {
      if (confirmClearTimerRef.current) clearTimeout(confirmClearTimerRef.current);
    };
  }, []);

  const { data: agentList = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: agentsApi.list,
    refetchInterval: 10000,
  });

  const { data: orchestrator } = useQuery({
    queryKey: ['orchestrator-status'],
    queryFn: agentsApi.orchestratorStatus,
    refetchInterval: 10000,
  });

  const { data: historicalActions = [], isLoading: feedLoading } = useQuery({
    queryKey: ['agent-feed'],
    queryFn: () => agentsApi.getGlobalFeed(100),
    refetchInterval: 30000, // Periodic refresh to catch events missed during WS drops
  });

  const { actions: liveActions, isConnected, isPaused, newCount, togglePause, clear, scrollToTop, setScrolledDown } = useAgentFeed();

  // Refetch historical feed when WebSocket reconnects to fill any gaps
  const prevConnectedRef = useRef(isConnected);
  useEffect(() => {
    if (isConnected && !prevConnectedRef.current) {
      queryClient.invalidateQueries({ queryKey: ['agent-feed'] });
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, queryClient]);

  // Stable color map — assign colors in agent creation order (sorted by id)
  // Pure derivation from agentList, no ref side-effects (safe under Strict Mode)
  const colorAssignmentsRef = useRef<Record<number, string>>({});
  const nextColorIndexRef = useRef(0);

  // useEffect for ref mutation instead of useMemo side-effects
  useEffect(() => {
    let changed = false;
    for (const agent of agentList) {
      if (!(agent.id in colorAssignmentsRef.current)) {
        colorAssignmentsRef.current[agent.id] = AGENT_COLORS[nextColorIndexRef.current % AGENT_COLORS.length];
        nextColorIndexRef.current++;
        changed = true;
      }
    }
    if (changed) setTick(t => t + 1); // trigger re-render to pick up new colors
  }, [agentList]);

  const getAgentColor = useCallback((agentId: number) => colorAssignmentsRef.current[agentId] || '#6b7280', []);

  // Merge live + historical (deduped) — memoized to avoid re-processing on every render
  const allActions = useMemo(() => {
    const liveIds = new Set(liveActions.map(a => a.id));
    return [...liveActions, ...historicalActions.filter(a => !liveIds.has(a.id))];
  }, [liveActions, historicalActions]);

  // Apply client-side filters (type + agent + search) — memoized
  const filteredActions = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return allActions.filter(a => {
      if (agentFilter !== null && a.agent_id !== agentFilter) return false;
      if (feedFilter === 'github') {
        if (a.action_type !== 'github_push' && a.action_type !== 'github_pr') return false;
      } else if (feedFilter && a.action_type !== feedFilter) {
        return false;
      }
      if (searchLower && !a.summary.toLowerCase().includes(searchLower) &&
          !(a.agent_name?.toLowerCase().includes(searchLower)) &&
          !(a.detail?.toLowerCase().includes(searchLower))) {
        return false;
      }
      return true;
    });
  }, [allActions, feedFilter, agentFilter, searchQuery]);

  // Latest action per agent (for current action indicator) — memoized
  const latestActionByAgent = useMemo(() => {
    const map: Record<number, AgentAction> = {};
    for (const a of allActions) {
      if (!map[a.agent_id]) {
        map[a.agent_id] = a;
      }
    }
    return map;
  }, [allActions]);

  // Count registered agents (visible in sidebar) and active agents (heartbeat alive)
  const activeAgents = agentList.filter(a => a.is_alive && a.status !== 'offline');
  const registeredCount = agentList.length;

  // Track scroll position for "new items" banner (CRIT-1 fix)
  const handleScroll = useCallback(() => {
    if (feedRef.current) {
      const scrolled = feedRef.current.scrollTop > 100;
      setScrolledDown(scrolled);
    }
  }, [setScrolledDown]);

  const handleScrollToTop = useCallback(() => {
    scrollToTop(); // flush buffer and reset scroll state first
    if (isPaused) togglePause(); // then unpause (buffer already empty)
    feedRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [scrollToTop, isPaused, togglePause]);

  const handleDeleteAgent = useCallback(async (id: number) => {
    await agentsApi.delete(id);
    // Clean up selection state before invalidating queries (guaranteed to run if delete succeeded)
    if (agentFilter === id) setAgentFilter(null);
    if (selectedAgentId === id) setSelectedAgentId(null);
    queryClient.invalidateQueries({ queryKey: ['agents'] });
    queryClient.invalidateQueries({ queryKey: ['orchestrator-status'] });
    queryClient.invalidateQueries({ queryKey: ['agent-feed'] });
  }, [queryClient, agentFilter, selectedAgentId]);

  const handleClear = useCallback(() => {
    clear();
    queryClient.invalidateQueries({ queryKey: ['agent-feed'] });
  }, [clear, queryClient]);

  const handleAgentClick = (agentId: number) => {
    const isDeselecting = agentFilter === agentId;
    setAgentFilter(isDeselecting ? null : agentId);
    setSelectedAgentId(isDeselecting ? null : agentId);
  };

  const selectedAgent = selectedAgentId ? agentList.find(a => a.id === selectedAgentId) : null;
  const selectedAgentName = agentFilter ? agentList.find(a => a.id === agentFilter)?.name : null;
  const isFiltered = agentFilter !== null || feedFilter !== null || searchQuery !== '';

  // Force re-render on tick for timestamp updates
  void tick;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 agent-dashboard">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-indigo-400" aria-hidden="true" />
            <h1 className="text-xl font-semibold">Agent Orchestrator</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Circle className={`w-2 h-2 fill-current ${isConnected ? 'text-green-400' : 'text-red-400'}`} aria-hidden="true" />
              <span className="text-xs text-gray-400">{isConnected ? 'Live' : 'Reconnecting...'}</span>
            </div>
            <div className="text-sm flex items-center gap-3">
              <span>
                <span className="text-gray-100 font-medium">{registeredCount}</span>
                <span className="text-gray-500">/{orchestrator?.max_agents ?? 5}</span>
                <span className="ml-1 text-gray-400">registered</span>
              </span>
              {activeAgents.length > 0 && (
                <span>
                  <span className="text-green-400 font-medium">{activeAgents.length}</span>
                  <span className="ml-1 text-gray-400">active</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-0 h-[calc(100vh-73px)]">
        {/* Left: Agent Pool — hidden on mobile when feed is shown, visible on desktop */}
        <div className="hidden lg:block w-72 border-r border-gray-800 p-4 overflow-y-auto flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Agents</h2>
            {agentFilter && (
              <button
                onClick={() => { setAgentFilter(null); setSelectedAgentId(null); }}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Show all
              </button>
            )}
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-3 animate-pulse h-20" />
              ))}
            </div>
          ) : agentList.length === 0 ? (
            <div className="text-center py-6">
              <Bot className="w-8 h-8 text-gray-700 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-gray-400 mb-3">No agents registered</p>
              <div className="text-left mx-auto max-w-[220px] bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Register via API</p>
                <pre className="text-[10px] text-gray-400 overflow-x-auto whitespace-pre leading-relaxed">
{`POST /api/agents/register
Authorization: Bearer <jwt>

{
  "name": "my-agent",
  "agent_type": "claude_code"
}`}
                </pre>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {agentList.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  latestAction={latestActionByAgent[agent.id]}
                  isSelected={agentFilter === agent.id}
                  colorHex={getAgentColor(agent.id)}
                  onClick={() => handleAgentClick(agent.id)}
                  onDelete={handleDeleteAgent}
                />
              ))}
            </div>
          )}
        </div>

        {/* Center: Activity Feed */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Feed Controls */}
          <div className="border-b border-gray-800 px-4 py-2 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Feed filters">
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value ?? 'all'}
                  aria-pressed={feedFilter === opt.value}
                  onClick={() => setFeedFilter(opt.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    feedFilter === opt.value
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-gray-500 hover:text-gray-300 border border-transparent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              {/* Active filter indicator */}
              {selectedAgentName && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-700 text-gray-300 ml-1">
                  {selectedAgentName}
                  <button onClick={() => { setAgentFilter(null); setSelectedAgentId(null); }} aria-label={`Remove filter: ${selectedAgentName}`} className="hover:text-white">
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" aria-hidden="true" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search feed…"
                  aria-label="Search feed"
                  className="w-36 pl-6 pr-6 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    aria-label="Clear search"
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                )}
              </div>
              <button
                onClick={togglePause}
                className={`p-1.5 rounded transition-colors ${
                  isPaused ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-500 hover:text-gray-300'
                }`}
                aria-label={isPaused ? 'Resume feed' : 'Pause feed'}
              >
                {isPaused ? <Play className="w-3.5 h-3.5" aria-hidden="true" /> : <Pause className="w-3.5 h-3.5" aria-hidden="true" />}
              </button>
              {confirmClear ? (
                <button
                  onClick={() => { if (confirmClearTimerRef.current) { clearTimeout(confirmClearTimerRef.current); confirmClearTimerRef.current = null; } handleClear(); setConfirmClear(false); }}
                  aria-label="Confirm clear activity feed"
                  className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
                >
                  Confirm?
                </button>
              ) : (
                <button
                  onClick={() => {
                    setConfirmClear(true);
                    if (confirmClearTimerRef.current) clearTimeout(confirmClearTimerRef.current);
                    confirmClearTimerRef.current = setTimeout(() => setConfirmClear(false), 3000);
                  }}
                  aria-label="Clear activity feed"
                  className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Feed */}
          <div
            ref={feedRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-0.5"
          >
            {/* "New items" banner — sticky inside scroll container so it doesn't occlude content */}
            {newCount > 0 && !isFiltered && (
              <div className="sticky top-0 z-10 flex justify-center pb-2">
                <button
                  onClick={handleScrollToTop}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-full shadow-lg hover:bg-indigo-500 transition-colors"
                >
                  <ArrowUp className="w-3 h-3" aria-hidden="true" />
                  {newCount} new {newCount === 1 ? 'event' : 'events'}
                </button>
              </div>
            )}
            {filteredActions.length === 0 ? (
              <div className="text-center py-16">
                {isFiltered ? (
                  <>
                    <Search className="w-8 h-8 text-gray-700 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm text-gray-500">No matching activity</p>
                    <button
                      onClick={() => { setAgentFilter(null); setFeedFilter(null); setSelectedAgentId(null); setSearchQuery(''); }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 mt-2"
                    >
                      Clear filters
                    </button>
                  </>
                ) : (
                  <>
                    <Zap className="w-8 h-8 text-gray-700 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm text-gray-500">No activity yet</p>
                    <p className="text-xs text-gray-600 mt-1">Agent actions appear here in real-time</p>
                  </>
                )}
              </div>
            ) : (
              filteredActions.map(action => (
                <ActionItem
                  key={action.id}
                  action={action}
                  agentColorHex={getAgentColor(action.agent_id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Agent Detail or Status */}
        <div className="w-full lg:w-72 border-l border-gray-800 overflow-y-auto flex-shrink-0">
          {selectedAgent ? (
            <AgentDetailPanel
              agent={selectedAgent}
              actions={allActions}
              actionsLoading={feedLoading}
              colorHex={getAgentColor(selectedAgent.id)}
              onClose={() => {
                setSelectedAgentId(null);
                setAgentFilter(null);
              }}
            />
          ) : (
            <div className="p-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Status</h2>

              {isLoading ? (
                <div className="space-y-4">
                  <div className="bg-gray-800 rounded-lg p-3 animate-pulse">
                    <div className="h-3 w-16 bg-gray-700 rounded mb-2" />
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4,5].map(i => <div key={i} className="h-2 flex-1 bg-gray-700 rounded-full" />)}
                    </div>
                    <div className="h-3 w-20 bg-gray-700 rounded mt-1" />
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3 animate-pulse">
                    <div className="h-3 w-14 bg-gray-700 rounded mb-2" />
                    <div className="space-y-1.5">
                      {[1,2].map(i => <div key={i} className="h-4 bg-gray-700 rounded" />)}
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3 animate-pulse">
                    <div className="h-3 w-10 bg-gray-700 rounded mb-1" />
                    <div className="h-4 w-16 bg-gray-700 rounded" />
                  </div>
                </div>
              ) : (
              <div className="space-y-4">
                {/* Capacity */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-2">Capacity</p>
                  <div className="flex items-center gap-1 mb-1">
                    {Array.from({ length: orchestrator?.max_agents ?? 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 flex-1 rounded-full ${
                          i < registeredCount ? 'bg-indigo-500' : 'bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">
                    {registeredCount} of {orchestrator?.max_agents ?? 5} slots
                  </p>
                  {activeAgents.length > 0 && (
                    <p className="text-xs text-green-400 mt-1">
                      {activeAgents.length} active
                    </p>
                  )}
                </div>

                {/* Agent Status Breakdown */}
                {agentList.length > 0 && (
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-2">Agents</p>
                    <div className="space-y-1">
                      {agentList.map(agent => (
                        <button
                          key={agent.id}
                          onClick={() => handleAgentClick(agent.id)}
                          className={`w-full hidden lg:flex items-center gap-2 px-1.5 py-1 rounded text-left text-xs transition-colors ${
                            agentFilter === agent.id
                              ? 'bg-indigo-500/15'
                              : 'hover:bg-gray-700/50'
                          }`}
                        >
                          <Circle className={`w-1.5 h-1.5 fill-current flex-shrink-0 ${
                            agent.is_alive ? STATUS_COLORS[agent.status] : 'text-gray-600'
                          }`} aria-hidden="true" />
                          <span className="text-gray-300 truncate flex-1">{agent.name}</span>
                          <span className={`text-[10px] ${STATUS_COLORS[agent.status]}`}>
                            {STATUS_LABELS[agent.status]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feed Stats */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Feed</p>
                  <p className="text-sm text-gray-300">
                    {isFiltered
                      ? `${filteredActions.length} of ${allActions.length} events`
                      : `${allActions.length} events`
                    }
                  </p>
                  {isPaused && (
                    <p className="text-xs text-yellow-400 mt-1">Paused ({newCount} buffered)</p>
                  )}
                </div>

                {/* Mobile: Agent list */}
                <div className="lg:hidden">
                  <p className="text-xs text-gray-500 mb-2">Agents</p>
                  <div className="space-y-1.5">
                    {agentList.map(agent => (
                      <button
                        key={agent.id}
                        onClick={() => handleAgentClick(agent.id)}
                        className={`w-full flex items-center gap-2 p-2 rounded text-left text-xs transition-colors ${
                          agentFilter === agent.id
                            ? 'bg-indigo-500/15 border border-indigo-500/30'
                            : 'bg-gray-800 border border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getAgentColor(agent.id) }} aria-hidden="true" />
                        <span className="text-gray-200 flex-1 truncate">{agent.name}</span>
                        <span className={`${STATUS_COLORS[agent.status]}`}>{STATUS_LABELS[agent.status]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
