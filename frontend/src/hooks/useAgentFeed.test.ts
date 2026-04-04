import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentFeed } from './useAgentFeed';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateClose(code = 1000) {
    this.onclose?.({ code } as CloseEvent);
  }

  simulateError() {
    this.onerror?.();
  }
}

describe('useAgentFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('test-token'),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function getLatestWs(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }

  function makeAction(id: number, summary = `Action ${id}`) {
    return {
      type: 'agent_action',
      action: {
        id,
        agent_id: 1,
        agent_name: 'test-agent',
        action_type: 'tool_use',
        summary,
        detail: '',
        timestamp: new Date().toISOString(),
      },
    };
  }

  it('connects to WebSocket on mount', () => {
    renderHook(() => useAgentFeed());
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(getLatestWs().url).toContain('/api/agents/ws/feed');
    expect(getLatestWs().url).toContain('token=test-token');
  });

  it('sets isConnected to true on open', () => {
    const { result } = renderHook(() => useAgentFeed());
    expect(result.current.isConnected).toBe(false);

    act(() => getLatestWs().simulateOpen());
    expect(result.current.isConnected).toBe(true);
  });

  it('sets isConnected to false on close', () => {
    const { result } = renderHook(() => useAgentFeed());
    act(() => getLatestWs().simulateOpen());
    expect(result.current.isConnected).toBe(true);

    act(() => getLatestWs().simulateClose());
    expect(result.current.isConnected).toBe(false);
  });

  it('receives and displays actions', () => {
    const { result } = renderHook(() => useAgentFeed());
    act(() => getLatestWs().simulateOpen());

    act(() => getLatestWs().simulateMessage(makeAction(1, 'First action')));
    expect(result.current.actions).toHaveLength(1);
    expect(result.current.actions[0].summary).toBe('First action');
  });

  it('prepends new actions (newest first)', () => {
    const { result } = renderHook(() => useAgentFeed());
    act(() => getLatestWs().simulateOpen());

    act(() => getLatestWs().simulateMessage(makeAction(1, 'First')));
    act(() => getLatestWs().simulateMessage(makeAction(2, 'Second')));
    expect(result.current.actions[0].summary).toBe('Second');
    expect(result.current.actions[1].summary).toBe('First');
  });

  it('caps actions at maxItems', () => {
    const { result } = renderHook(() => useAgentFeed({ maxItems: 3 }));
    act(() => getLatestWs().simulateOpen());

    for (let i = 0; i < 5; i++) {
      act(() => getLatestWs().simulateMessage(makeAction(i)));
    }
    expect(result.current.actions).toHaveLength(3);
  });

  it('ignores non-agent_action messages', () => {
    const { result } = renderHook(() => useAgentFeed());
    act(() => getLatestWs().simulateOpen());

    act(() => getLatestWs().simulateMessage({ type: 'heartbeat' }));
    expect(result.current.actions).toHaveLength(0);
  });

  it('ignores malformed JSON', () => {
    const { result } = renderHook(() => useAgentFeed());
    act(() => getLatestWs().simulateOpen());

    act(() => {
      getLatestWs().onmessage?.({ data: 'not json' } as MessageEvent);
    });
    expect(result.current.actions).toHaveLength(0);
  });

  it('buffers actions when paused', () => {
    const { result } = renderHook(() => useAgentFeed());
    act(() => getLatestWs().simulateOpen());

    act(() => result.current.togglePause());
    expect(result.current.isPaused).toBe(true);

    act(() => getLatestWs().simulateMessage(makeAction(1)));
    expect(result.current.actions).toHaveLength(0);
    expect(result.current.newCount).toBe(1);
  });

  it('flushes buffer when unpaused', () => {
    const { result } = renderHook(() => useAgentFeed());
    act(() => getLatestWs().simulateOpen());

    act(() => result.current.togglePause());
    act(() => getLatestWs().simulateMessage(makeAction(1, 'Buffered')));
    expect(result.current.actions).toHaveLength(0);

    act(() => result.current.togglePause());
    expect(result.current.isPaused).toBe(false);
    expect(result.current.actions).toHaveLength(1);
    expect(result.current.actions[0].summary).toBe('Buffered');
    expect(result.current.newCount).toBe(0);
  });

  it('buffers actions when scrolled down', () => {
    const { result } = renderHook(() => useAgentFeed());
    act(() => getLatestWs().simulateOpen());

    act(() => result.current.setScrolledDown(true));
    act(() => getLatestWs().simulateMessage(makeAction(1)));
    expect(result.current.actions).toHaveLength(0);
    expect(result.current.newCount).toBe(1);
  });

  it('flushes buffer when scrolled back to top', () => {
    const { result } = renderHook(() => useAgentFeed());
    act(() => getLatestWs().simulateOpen());

    act(() => result.current.setScrolledDown(true));
    act(() => getLatestWs().simulateMessage(makeAction(1)));

    act(() => result.current.setScrolledDown(false));
    expect(result.current.actions).toHaveLength(1);
    expect(result.current.newCount).toBe(0);
  });

  it('scrollToTop flushes buffer', () => {
    const { result } = renderHook(() => useAgentFeed());
    act(() => getLatestWs().simulateOpen());

    act(() => result.current.setScrolledDown(true));
    act(() => getLatestWs().simulateMessage(makeAction(1)));
    act(() => getLatestWs().simulateMessage(makeAction(2)));

    act(() => result.current.scrollToTop());
    expect(result.current.actions).toHaveLength(2);
    expect(result.current.newCount).toBe(0);
  });

  it('clear empties actions and buffer', () => {
    const { result } = renderHook(() => useAgentFeed());
    act(() => getLatestWs().simulateOpen());

    act(() => getLatestWs().simulateMessage(makeAction(1)));
    act(() => result.current.togglePause());
    act(() => getLatestWs().simulateMessage(makeAction(2)));

    act(() => result.current.clear());
    expect(result.current.actions).toHaveLength(0);
    expect(result.current.newCount).toBe(0);
  });

  it('retries connection with exponential backoff', () => {
    renderHook(() => useAgentFeed());
    const ws1 = getLatestWs();

    act(() => ws1.simulateOpen());
    act(() => ws1.simulateClose(1006));

    // First retry after 1s
    expect(MockWebSocket.instances).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(MockWebSocket.instances).toHaveLength(2);

    // Second close triggers 2s delay
    act(() => getLatestWs().simulateClose(1006));
    act(() => { vi.advanceTimersByTime(1999); });
    expect(MockWebSocket.instances).toHaveLength(2);
    act(() => { vi.advanceTimersByTime(1); });
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('resets retry counter on successful connection', () => {
    renderHook(() => useAgentFeed());

    act(() => getLatestWs().simulateClose(1006));
    act(() => { vi.advanceTimersByTime(1000); });
    // Reconnected
    act(() => getLatestWs().simulateOpen());
    // Close again — should use 1s delay (retry reset), not 2s
    act(() => getLatestWs().simulateClose(1006));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('closes WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useAgentFeed());
    const ws = getLatestWs();
    act(() => ws.simulateOpen());

    unmount();
    expect(ws.close).toHaveBeenCalled();
  });

  it('cancels retry timer on unmount', () => {
    const { unmount } = renderHook(() => useAgentFeed());
    act(() => getLatestWs().simulateClose(1006));

    unmount();
    // Advancing past retry delay should NOT create a new connection
    const countBefore = MockWebSocket.instances.length;
    act(() => { vi.advanceTimersByTime(5000); });
    expect(MockWebSocket.instances).toHaveLength(countBefore);
  });

  it('redirects to login on auth failure (code 4001)', () => {
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, protocol: 'http:', host: 'localhost:3030' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window.location, 'href', {
      set: hrefSetter,
      configurable: true,
    });

    renderHook(() => useAgentFeed());
    act(() => getLatestWs().simulateClose(4001));

    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(hrefSetter).toHaveBeenCalledWith('/login');
  });

  it('handles error by closing WebSocket', () => {
    renderHook(() => useAgentFeed());
    const ws = getLatestWs();

    act(() => ws.simulateError());
    expect(ws.close).toHaveBeenCalled();
  });

  it('retries with backoff when no token is available', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    renderHook(() => useAgentFeed());
    // No WebSocket created immediately
    expect(MockWebSocket.instances).toHaveLength(0);

    // After backoff delay, it retries (still no token)
    act(() => { vi.advanceTimersByTime(1000); });
    expect(MockWebSocket.instances).toHaveLength(0);

    // Provide a token and advance past next backoff
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('new-token');
    act(() => { vi.advanceTimersByTime(2000); });
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('caps buffer size during long pauses', () => {
    const { result } = renderHook(() => useAgentFeed({ maxItems: 5 }));
    const ws = getLatestWs();
    act(() => ws.simulateOpen());

    // Pause the feed
    act(() => result.current.togglePause());

    // Send more messages than maxItems
    for (let i = 0; i < 10; i++) {
      act(() => ws.simulateMessage(makeAction(i)));
    }

    // Flush by unpausing
    act(() => result.current.togglePause());

    // Actions should be capped at maxItems even though 10 were buffered
    expect(result.current.actions).toHaveLength(5);
    expect(result.current.newCount).toBe(0);
  });
});
