import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { X, AlertCircle, CheckCircle2, Info } from 'lucide-react';

type ToastType = 'error' | 'success' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {
    if (import.meta.env.DEV) {
      console.error('useToast() called outside <ToastProvider>. Wrap your app in <ToastProvider>.');
    }
  },
});

export function useToast() {
  return useContext(ToastContext);
}

const icons: Record<ToastType, React.ReactNode> = {
  error: <AlertCircle size={18} className="text-red-400 shrink-0" />,
  success: <CheckCircle2 size={18} className="text-green-400 shrink-0" />,
  info: <Info size={18} className="text-blue-400 shrink-0" />,
};

const bgColors: Record<ToastType, string> = {
  error: 'bg-red-900/90 border-red-700',
  success: 'bg-green-900/90 border-green-700',
  info: 'bg-blue-900/90 border-blue-700',
};

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(t.id), 4000);
    return () => clearTimeout(timer);
    // onDismiss is stable via useCallback — safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.id]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg text-white text-sm animate-slide-in ${bgColors[t.type]}`}
      role="alert"
    >
      {icons[t.type]}
      <span className="flex-1">{t.message}</span>
      <button onClick={() => onDismiss(t.id)} aria-label="Dismiss notification" className="text-white/60 hover:text-white shrink-0">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'error') => {
    setToasts((prev) => [...prev, { id: ++nextId.current, message, type }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
