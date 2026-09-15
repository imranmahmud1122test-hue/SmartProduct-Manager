import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'security';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => string;
  dismissToast: (id: string) => void;
  toast: {
    success: (message: string, title?: string) => string;
    error: (message: string, title?: string) => string;
    warning: (message: string, title?: string) => string;
    info: (message: string, title?: string) => string;
    security: (message: string, title?: string) => string;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Global helper to trigger toast notifications from outside React tree (e.g. services, Firestore handlers)
export function emitGlobalToast(type: ToastType, title: string, message: string, duration = 6000) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('spm_toast_event', {
        detail: { type, title, message, duration },
      })
    );
  }
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 6000 }: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      return id;
    },
    [dismissToast]
  );

  const toastHelpers = {
    success: (message: string, title = 'Success') => showToast({ type: 'success', title, message }),
    error: (message: string, title = 'Error') => showToast({ type: 'error', title, message, duration: 8000 }),
    warning: (message: string, title = 'Warning') => showToast({ type: 'warning', title, message }),
    info: (message: string, title = 'Notice') => showToast({ type: 'info', title, message }),
    security: (message: string, title = 'Security Rule Restriction') =>
      showToast({ type: 'security', title, message, duration: 10000 }),
  };

  useEffect(() => {
    const handleCustomToast = (event: Event) => {
      const customEvent = event as CustomEvent<{
        type: ToastType;
        title: string;
        message: string;
        duration?: number;
      }>;
      if (customEvent.detail) {
        const { type, title, message, duration } = customEvent.detail;
        showToast({ type, title, message, duration });
      }
    };

    window.addEventListener('spm_toast_event', handleCustomToast);
    return () => {
      window.removeEventListener('spm_toast_event', handleCustomToast);
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, toast: toastHelpers }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      id="global-toast-container"
      className="fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-md w-full px-4 pointer-events-none"
    >
      {toasts.map((t) => {
        let borderClass = 'border-slate-200 bg-white text-slate-900 shadow-xl';
        let icon = <Info className="w-5 h-5 text-indigo-600 shrink-0" />;
        let badgeBg = 'bg-indigo-50 text-indigo-700';

        if (t.type === 'success') {
          borderClass = 'border-emerald-200 bg-white shadow-emerald-900/10 shadow-xl';
          icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
          badgeBg = 'bg-emerald-50 text-emerald-700';
        } else if (t.type === 'error') {
          borderClass = 'border-rose-300 bg-rose-50/90 text-rose-950 shadow-rose-900/10 shadow-xl';
          icon = <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />;
          badgeBg = 'bg-rose-100 text-rose-800';
        } else if (t.type === 'warning') {
          borderClass = 'border-amber-300 bg-amber-50/90 text-amber-950 shadow-amber-900/10 shadow-xl';
          icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
          badgeBg = 'bg-amber-100 text-amber-800';
        } else if (t.type === 'security') {
          borderClass = 'border-red-400 bg-red-950 text-red-50 shadow-2xl shadow-red-950/40 ring-2 ring-red-500/50';
          icon = <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 animate-pulse" />;
          badgeBg = 'bg-red-900/80 text-red-200 border border-red-700';
        }

        return (
          <div
            key={t.id}
            id={`toast-${t.id}`}
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border transition-all duration-300 transform translate-y-0 ${borderClass}`}
          >
            <div className="mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeBg}`}>
                  {t.type}
                </span>
                <h4 className="text-sm font-bold truncate">{t.title}</h4>
              </div>
              <p className="text-xs leading-relaxed opacity-90 break-words">{t.message}</p>
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
