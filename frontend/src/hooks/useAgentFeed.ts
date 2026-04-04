import { useState, useEffect, useRef, useCallback } from 'react';
import type { AgentAction } from '@/types';

interface UseAgentFeedOptions {
  maxItems?: number;
}

interface UseAgentFeedReturn {
  actions: AgentAction[];
  isConnected: boolean;
  isPaused: boolean;
  newCount: number;
  togglePause: () => void;
  clear: () => void;
  scrollToTop: () => void;
  setScrolledDown: (scrolled: boolean) => void;
}

export function useAgentFeed(options: UseAgentFeedOptions = {}): UseAgentFeedReturn {
  const { maxItems = 500 } = options;
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const noTokenRetryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);
  const bufferRef = useRef<AgentAction[]>([]);
  const cleanedUpRef = useRef(false);
  const scrolledDownRef = useRef(false);
  // Use ref for maxItems so connect() doesn't need it as a dependency
  const maxItemsRef = useRef(maxItems);
  maxItemsRef.current = maxItems;

  // Single canonical flush — all paths that drain the buffer go through here.
  // This prevents double-flush races between scrollToTop and setScrolledDown.
  const flushBuffer = useCallback(() => {
    if (bufferRef.current.length > 0) {
      const flushed = [...bufferRef.current].reverse();
      const cap = maxItemsRef.current;
      setActions(prev => [...flushed, ...prev].slice(0, cap));
      bufferRef.current = [];
    }
    setNewCount(0);
  }, []);

  const connect = useCallback(() => {
    if (cleanedUpRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // NOTE: JWT in URL is a known tradeoff — browsers don't support auth headers on WebSocket.
    // The JWT has a short expiry. For production, consider a ticket exchange endpoint.
    const token = localStorage.getItem('token');
    if (!token) {
      // Give up after 5 attempts — user is not authenticated
      if (noTokenRetryRef.current >= 5) return;
      const delay = Math.min(1000 * Math.pow(2, Math.min(noTokenRetryRef.current, 2)), 5000);
      noTokenRetryRef.current++;
      retryTimerRef.current = setTimeout(connect, delay);
      return;
    }
    noTokenRetryRef.current = 0;
    const url = `${protocol}//${window.location.host}/api/agents/ws/feed?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (cleanedUpRef.current) { ws.close(); return; }
      setIsConnected(true);
      retryRef.current = 0;
    };

    ws.onmessage = (event) => {
      if (cleanedUpRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'agent_action') {
          const action: AgentAction = msg.action;
          const cap = maxItemsRef.current;

          if (pausedRef.current || scrolledDownRef.current) {
            bufferRef.current.push(action);
            if (bufferRef.current.length > maxItemsRef.current) {
              bufferRef.current = bufferRef.current.slice(-maxItemsRef.current);
            }
            setNewCount(prev => prev + 1);
          } else {
            setActions(prev => [action, ...prev].slice(0, cap));
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = (event) => {
      if (cleanedUpRef.current) return;
      setIsConnected(false);
      wsRef.current = null;
      // Auth failure — redirect to login instead of retrying with bad token
      if (event.code === 4001) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }
      const delay = Math.min(1000 * Math.pow(2, retryRef.current), 30000);
      retryRef.current++;
      // Track the retry timer so we can cancel it on cleanup
      retryTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []); // No deps — uses refs for all mutable state

  useEffect(() => {
    cleanedUpRef.current = false;
    connect();
    return () => {
      cleanedUpRef.current = true;
      // Cancel any pending retry timer to prevent ghost connections
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const setScrolledDown = useCallback((scrolled: boolean) => {
    scrolledDownRef.current = scrolled;
    if (!scrolled) {
      flushBuffer();
    }
  }, [flushBuffer]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      const newPaused = !prev;
      pausedRef.current = newPaused;
      if (!newPaused) {
        flushBuffer();
      }
      return newPaused;
    });
  }, [flushBuffer]);

  const clear = useCallback(() => {
    setActions([]);
    bufferRef.current = [];
    setNewCount(0);
  }, []);

  const scrollToTop = useCallback(() => {
    // Set scrolledDown false BEFORE flushing so incoming messages during
    // the flush go directly to setActions, not back into the buffer.
    scrolledDownRef.current = false;
    flushBuffer();
  }, [flushBuffer]);

  return {
    actions, isConnected, isPaused, newCount,
    togglePause, clear, scrollToTop,
    setScrolledDown,
  };
}
