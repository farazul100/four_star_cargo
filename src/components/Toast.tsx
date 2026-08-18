import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

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
    <div className="fixed bottom-5 right-5 z-50 space-y-3 max-w-sm w-full pointer-events-none">
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
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
    info: <AlertCircle className="w-5 h-5 text-[#1FB6A8] shrink-0" />,
  };

  const borderColors = {
    success: 'border-emerald-500/40 bg-[#11202F]',
    error: 'border-red-500/40 bg-[#11202F]',
    info: 'border-[#1FB6A8]/40 bg-[#11202F]',
  };

  return (
    <div
      className={`pointer-events-auto p-4 rounded-2xl border shadow-2xl flex items-start justify-between space-x-3 animate-in slide-in-from-right duration-300 ${
        borderColors[toast.type]
      }`}
    >
      <div className="flex items-start space-x-3">
        {icons[toast.type]}
        <div>
          <div className="text-xs font-bold text-white">{toast.title}</div>
          {toast.message && (
            <div className="text-[11px] text-[#8FA3AD] mt-0.5">{toast.message}</div>
          )}
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-[#8FA3AD] hover:text-white p-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
