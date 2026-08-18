import React from 'react';
import { ShieldAlert, X, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-[#11202F] border border-[#1FB6A8]/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8FA3AD] hover:text-white p-1 rounded-lg hover:bg-[#1E3247]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{t('forgot_password')}</h3>
            <p className="text-xs text-[#8FA3AD]">Security Policy Notice (PRD Section 6.2)</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0B1622] border border-[#1E3247] text-xs text-[#EAF2F5] leading-relaxed">
          {t('forgot_password_notice')}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl bg-[#1FB6A8] hover:bg-[#22A6B3] text-[#0F2D52] font-bold text-xs transition-all shadow-md"
          >
            ঠিক আছে (Got It)
          </button>
        </div>
      </div>
    </div>
  );
};
