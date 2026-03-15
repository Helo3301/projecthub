import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Send, Plus, X, Square, Play, ListTodo,
  ChevronDown, Circle, Terminal, ArrowRight
} from 'lucide-react';
import { agents as agentsApi } from '@/lib/api';
import type { TaskQueueItem } from '@/types';

// ============ Types ============

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
}

interface AgentSlot {
  id: number; // 1-5
  agentId: number | null; // ProjectHub agent DB id
  status: 'empty' | 'spawning' | 'running' | 'waiting' | 'complete';
  sessionId: string | null;
  taskId: number | null;
  taskTitle: string | null;
  messages: ChatMessage[];
  cwd: string;
  streamBuffer: string; // accumulates chunks for current response
}

const DEFAULT_CWD = '/home/hestiasadmin/projects/ao3-downloader';
const MAX_SLOTS = 5;

function createEmptySlot(id: number): AgentSlot {
  return {
    id, agentId: null, status: 'empty', sessionId: null,
    taskId: null, taskTitle: null, messages: [], cwd: DEFAULT_CWD,
    streamBuffer: '',
  };
}

// ============ Task Picker ============

function TaskPicker({
  onSelect,
  onClose,
}: {
  onSelect: (task: TaskQueueItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['task-queue-workbench'],
    queryFn: () => agentsApi.getTaskQueue(undefined, 200),
  });

  const filtered = tasks.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  const priorityColors: Record<string, string> = {
    urgent: 'text-red-400',
    high: 'text-orange-400',
    medium: 'text-yellow-400',
    low: 'text-gray-400',
  };

  return (
    <div className="absolute inset-0 bg-gray-900/95 z-20 flex flex-col p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">Select Task</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
          <X className="w-4 h-4" />
        </button>
      </div>
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search tasks..."
        autoFocus
        className="w-full px-3 py-2 mb-3 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
      />
      <div className="flex-1 overflow-y-auto space-y-1">
        {isLoading ? (
          <p className="text-xs text-gray-500">Loading tasks...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-gray-500">No matching tasks</p>
        ) : (
          filtered.map(task => (
            <button
              key={task.id}
              onClick={() => onSelect(task)}
              className="w-full flex items-start gap-2 p-2 text-left bg-gray-800 border border-gray-700 rounded hover:border-indigo-500/50 transition-colors"
            >
              <span className={`text-[10px] font-bold mt-0.5 ${priorityColors[task.priority] || ''}`}>
                {task.priority[0].toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-200 truncate">{task.title}</p>
                {task.project_name && (
                  <p className="text-[10px] text-gray-500">{task.project_name}</p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ============ Agent Chat Panel ============

function AgentPanel({
  slot,
  isActive,
  onActivate,
  onSend,
  onSpawn,
  onKill,
  onPickTask,
}: {
  slot: AgentSlot;
  isActive: boolean;
  onActivate: () => void;
  onSend: (text: string) => void;
  onSpawn: (prompt: string) => void;
  onKill: () => void;
  onPickTask: () => void;
}) {
  const [input, setInput] = useState('');
  const [showSpawn, setShowSpawn] = useState(false);
  const [spawnPrompt, setSpawnPrompt] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [slot.messages, slot.streamBuffer]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    if (slot.status === 'empty' || slot.status === 'complete') {
      onSpawn(input.trim());
    } else if (slot.status === 'waiting') {
      onSend(input.trim());
    }
    setInput('');
  };

  const handleSpawnWithTask = (prompt: string) => {
    onSpawn(prompt);
    setShowSpawn(false);
    setSpawnPrompt('');
  };

  const statusColors: Record<string, string> = {
    empty: 'text-gray-600',
    spawning: 'text-yellow-400',
    running: 'text-green-400',
    waiting: 'text-blue-400',
    complete: 'text-gray-400',
  };

  const statusLabels: Record<string, string> = {
    empty: 'Empty',
    spawning: 'Starting...',
    running: 'Working',
    waiting: 'Ready',
    complete: 'Done',
  };

  return (
    <div
      className={`flex flex-col h-full border rounded-lg transition-colors ${
        isActive
          ? 'border-indigo-500 ring-1 ring-indigo-500/30'
          : 'border-gray-700 hover:border-gray-600'
      }`}
      onClick={onActivate}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800/50 rounded-t-lg">
        <div className="flex items-center gap-2 min-w-0">
          <Circle className={`w-2 h-2 fill-current ${statusColors[slot.status]}`} />
          <span className="text-xs font-medium text-gray-300 truncate">
            {slot.taskTitle ? slot.taskTitle : `Slot ${slot.id}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-[10px] ${statusColors[slot.status]}`}>
            {statusLabels[slot.status]}
          </span>
          {slot.status !== 'empty' && (
            <button
              onClick={e => { e.stopPropagation(); onKill(); }}
              className="p-0.5 text-gray-600 hover:text-red-400 transition-colors"
              title="Kill agent"
            >
              <Square className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {slot.status === 'empty' && slot.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Terminal className="w-8 h-8 text-gray-700" />
            <p className="text-xs text-gray-500 text-center">
              Assign a task or type a prompt to start
            </p>
            <button
              onClick={e => { e.stopPropagation(); onPickTask(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded hover:bg-indigo-500/20"
            >
              <ListTodo className="w-3 h-3" /> Pick Task
            </button>
          </div>
        ) : (
          <>
            {slot.messages.map(msg => (
              <div key={msg.id} className={`text-xs ${
                msg.role === 'user'
                  ? 'ml-8 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-2 text-indigo-200'
                  : msg.role === 'system'
                  ? 'text-center text-gray-500 italic py-1'
                  : 'bg-gray-800 border border-gray-700 rounded-lg p-2 text-gray-200'
              }`}>
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{msg.text}</pre>
              </div>
            ))}
            {slot.streamBuffer && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-gray-200">
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{slot.streamBuffer}</pre>
                <span className="inline-block w-1.5 h-3 bg-green-400 animate-pulse ml-0.5" />
              </div>
            )}
            <div ref={chatEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-700 p-2">
        <div className="flex gap-1.5">
          {slot.status === 'empty' && (
            <button
              onClick={e => { e.stopPropagation(); onPickTask(); }}
              className="p-1.5 text-gray-500 hover:text-indigo-400 transition-colors"
              title="Pick task from queue"
            >
              <ListTodo className="w-4 h-4" />
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder={
              slot.status === 'running' ? 'Agent is working...'
              : slot.status === 'empty' ? 'Type a prompt to start...'
              : slot.status === 'complete' ? 'Type to start new task...'
              : 'Type a follow-up...'
            }
            disabled={slot.status === 'running' || slot.status === 'spawning'}
            className="flex-1 px-2.5 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || slot.status === 'running' || slot.status === 'spawning'}
            className="p-1.5 text-indigo-400 hover:text-indigo-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Main Workbench ============

export default function AgentWorkbench() {
  const [slots, setSlots] = useState<AgentSlot[]>(
    Array.from({ length: MAX_SLOTS }, (_, i) => createEmptySlot(i + 1))
  );
  const [activeSlot, setActiveSlot] = useState(1);
  const [taskPickerSlot, setTaskPickerSlot] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  // Connect WebSocket
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/api/agents/runner/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWsMessage(msg);
      } catch { /* ignore */ }
    };

    ws.onclose = (event) => {
      if (event.code === 4001) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const handleWsMessage = useCallback((msg: any) => {
    const agentId = msg.agent_id;
    if (!agentId) return;

    setSlots(prev => prev.map(slot => {
      if (slot.agentId !== agentId) return slot;

      switch (msg.type) {
        case 'status': {
          let newStatus = slot.status;
          if (msg.status === 'spawning') newStatus = 'spawning';
          else if (msg.status === 'running') newStatus = 'running';
          else if (msg.status === 'complete') {
            newStatus = 'waiting';
            // Flush stream buffer to messages
            const newMessages = [...slot.messages];
            if (slot.streamBuffer) {
              newMessages.push({
                id: `${Date.now()}-resp`,
                role: 'assistant',
                text: slot.streamBuffer,
                timestamp: Date.now(),
              });
            }
            return { ...slot, status: newStatus, messages: newMessages, streamBuffer: '',
                     sessionId: msg.session_id || slot.sessionId };
          }
          else if (msg.status === 'killed') {
            return createEmptySlot(slot.id);
          }
          return { ...slot, status: newStatus, sessionId: msg.session_id || slot.sessionId };
        }
        case 'chunk':
          return { ...slot, streamBuffer: slot.streamBuffer + (msg.text || '') };
        case 'error': {
          const errMsg: ChatMessage = {
            id: `${Date.now()}-err`,
            role: 'system',
            text: `Error: ${msg.message}`,
            timestamp: Date.now(),
          };
          return { ...slot, messages: [...slot.messages, errMsg], status: 'waiting' };
        }
        default:
          return slot;
      }
    }));
  }, []);

  const sendWs = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // Use a counter for agent IDs (simple incrementing)
  const nextAgentIdRef = useRef(100);

  const handleSpawn = useCallback((slotId: number, prompt: string) => {
    const agentId = nextAgentIdRef.current++;
    setSlots(prev => prev.map(s => {
      if (s.id !== slotId) return s;
      const userMsg: ChatMessage = {
        id: `${Date.now()}-user`,
        role: 'user',
        text: prompt,
        timestamp: Date.now(),
      };
      return {
        ...s,
        agentId,
        status: 'spawning',
        messages: [...s.messages, userMsg],
        streamBuffer: '',
      };
    }));
    const slot = slots.find(s => s.id === slotId);
    sendWs({
      type: 'spawn',
      agent_id: agentId,
      cwd: slot?.cwd || DEFAULT_CWD,
      prompt,
    });
  }, [slots, sendWs]);

  const handleSend = useCallback((slotId: number, text: string) => {
    setSlots(prev => prev.map(s => {
      if (s.id !== slotId) return s;
      const userMsg: ChatMessage = {
        id: `${Date.now()}-user`,
        role: 'user',
        text,
        timestamp: Date.now(),
      };
      return { ...s, messages: [...s.messages, userMsg], streamBuffer: '', status: 'running' };
    }));
    const slot = slots.find(s => s.id === slotId);
    if (slot?.agentId) {
      sendWs({ type: 'prompt', agent_id: slot.agentId, text });
    }
  }, [slots, sendWs]);

  const handleKill = useCallback((slotId: number) => {
    const slot = slots.find(s => s.id === slotId);
    if (slot?.agentId) {
      sendWs({ type: 'kill', agent_id: slot.agentId });
    }
    setSlots(prev => prev.map(s => s.id === slotId ? createEmptySlot(s.id) : s));
  }, [slots, sendWs]);

  const handleTaskSelect = useCallback((slotId: number, task: TaskQueueItem) => {
    setTaskPickerSlot(null);
    // Build prompt from task
    const prompt = [
      `You have been assigned this task:`,
      ``,
      `**${task.title}**`,
      task.description ? `\n${task.description}` : '',
      ``,
      `Please review this PR, provide feedback, and implement any necessary changes.`,
      `When done, commit your work and create a PR.`,
    ].filter(Boolean).join('\n');

    setSlots(prev => prev.map(s => {
      if (s.id !== slotId) return s;
      return { ...s, taskId: task.id, taskTitle: task.title };
    }));

    handleSpawn(slotId, prompt);
  }, [handleSpawn]);

  const activeSlotData = slots.find(s => s.id === activeSlot);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-indigo-400" />
            <h1 className="text-xl font-semibold">Agent Workbench</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>{slots.filter(s => s.status !== 'empty').length}/{MAX_SLOTS} active</span>
          </div>
        </div>
      </div>

      {/* Slot Tabs */}
      <div className="border-b border-gray-800 px-6 flex gap-1 overflow-x-auto">
        {slots.map(slot => (
          <button
            key={slot.id}
            onClick={() => setActiveSlot(slot.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeSlot === slot.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Circle className={`w-1.5 h-1.5 fill-current ${
              slot.status === 'running' ? 'text-green-400'
              : slot.status === 'waiting' ? 'text-blue-400'
              : slot.status === 'spawning' ? 'text-yellow-400'
              : 'text-gray-600'
            }`} />
            {slot.taskTitle
              ? (slot.taskTitle.length > 25 ? slot.taskTitle.slice(0, 25) + '...' : slot.taskTitle)
              : `Slot ${slot.id}`
            }
          </button>
        ))}
      </div>

      {/* Active Panel */}
      <div className="h-[calc(100vh-121px)] relative">
        {activeSlotData && (
          <AgentPanel
            slot={activeSlotData}
            isActive={true}
            onActivate={() => {}}
            onSend={(text) => handleSend(activeSlotData.id, text)}
            onSpawn={(prompt) => handleSpawn(activeSlotData.id, prompt)}
            onKill={() => handleKill(activeSlotData.id)}
            onPickTask={() => setTaskPickerSlot(activeSlotData.id)}
          />
        )}

        {/* Task Picker Overlay */}
        {taskPickerSlot !== null && (
          <TaskPicker
            onSelect={(task) => handleTaskSelect(taskPickerSlot, task)}
            onClose={() => setTaskPickerSlot(null)}
          />
        )}
      </div>
    </div>
  );
}
