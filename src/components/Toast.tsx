import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] space-y-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismissRef.current(toast.id);
    }, 2000);
    return () => clearTimeout(timer);
  }, [toast.id]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-cyan-400 shrink-0" />,
  };

  const bgStyles = {
    success: 'bg-[#0F172A] border-l-4 border-l-emerald-500 border-t border-r border-b border-slate-700/80 text-white shadow-2xl',
    error: 'bg-[#0F172A] border-l-4 border-l-red-500 border-t border-r border-b border-slate-700/80 text-white shadow-2xl',
    info: 'bg-[#0F172A] border-l-4 border-l-cyan-500 border-t border-r border-b border-slate-700/80 text-white shadow-2xl',
  };

  return (
    <div
      className={`pointer-events-auto p-3.5 rounded-none flex items-start justify-between space-x-3 transition-all duration-300 animate-in slide-in-from-right ${
        bgStyles[toast.type]
      }`}
    >
      <div className="flex items-start space-x-3 min-w-0 flex-1">
        <div className="mt-0.5">{icons[toast.type]}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white leading-snug tracking-wide">{toast.title}</p>
          {toast.message && (
            <p className="text-[11px] font-medium text-slate-200 mt-1 leading-snug">{toast.message}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-white p-1 transition-colors cursor-pointer shrink-0"
        title="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
