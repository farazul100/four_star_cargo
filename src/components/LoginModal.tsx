import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, Lock, Mail, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { User, UserRole, Language } from '../types';

interface LoginModalProps {
  role: UserRole;
  users: User[];
  onLoginSuccess: (user: User) => void;
  onBack: () => void;
  language: Language;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  role,
  users,
  onLoginSuccess,
  onBack,
  language,
}) => {
  const isBn = language === 'bn';
  const roleUsers = users.filter((u) => u.role === role);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const roleTitles: Record<UserRole, { bn: string; en: string }> = {
    super_admin: { bn: 'সুপার এডমিন প্যানেল লগইন', en: 'Super Admin Panel Login' },
    operation_director: { bn: 'অপারেশন ডিরেক্টর প্যানেল লগইন', en: 'Operation Director Panel Login' },
    warehouse_incharge: { bn: 'ওয়্যারহাউজ ইনচার্জ প্যানেল লগইন', en: 'Warehouse Incharge Panel Login' },
    accountant: { bn: 'অ্যাকাউন্টেন্ট প্যানেল লগইন', en: 'Accountant Panel Login' },
  };

  const handleSelectUser = (uId: string) => {
    setSelectedUserId(uId);
    const u = users.find((x) => x.id === uId);
    if (u) {
      setEmail(u.email);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const foundUser = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!foundUser) {
      setError(isBn ? 'ইউজার পাওয়া যায়নি! সঠিক ইমেইল দিন।' : 'User not found! Check email address.');
      return;
    }
    setError('');
    onLoginSuccess(foundUser);
  };

  return (
    <div className="min-h-screen bg-[#0B1622] text-[#EAF2F5] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Floating Particle Orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#1FB6A8]/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#1B4F91]/20 rounded-full blur-3xl" />

      <div className="w-full max-w-4xl bg-[#11202F] border border-[#1E3247] rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2 z-10">
        {/* Left Side: Brand Panel */}
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#11202F] to-[#0B1622] p-8 md:p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#1E3247] relative">
          <div>
            <button
              onClick={onBack}
              className="inline-flex items-center space-x-2 text-xs font-semibold text-[#8FA3AD] hover:text-[#1FB6A8] transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isBn ? 'পোর্টাল সিলেকশনে ফিরুন' : 'Back to Portal'}</span>
            </button>

            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1B4F91] to-[#1FB6A8] flex items-center justify-center text-white font-black text-2xl shadow-lg border border-[#1FB6A8]/40">
                4★
              </div>
              <div>
                <h1 className="text-xl font-bold text-white font-poppins">
                  FOUR STAR <span className="text-[#1FB6A8]">CARGO</span>
                </h1>
                <p className="text-xs text-[#8FA3AD]">Operations System</p>
              </div>
            </div>

            <div className="space-y-3 mt-8">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#1FB6A8]/10 text-[#1FB6A8] text-xs font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>{roleTitles[role][isBn ? 'bn' : 'en']}</span>
              </div>
              <h2 className="text-2xl font-extrabold text-white">
                {isBn ? 'নিরাপদ সিস্টেমে প্রবেশ করুন' : 'Secure Operations Access'}
              </h2>
              <p className="text-xs text-[#8FA3AD] leading-relaxed">
                {isBn
                  ? 'এই প্যানেলে আপনার রোল এবং অ্যাসাইনকৃত ওয়্যারহাউজের জন্য ডাটাবেজ লেভেলে RLS সিকিউরিটি সক্রিয় রয়েছে।'
                  : 'Database-level Row Security (RLS) is active for this session.'}
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#1E3247] text-xs text-[#8FA3AD] flex items-center justify-between">
            <span>M/S Four Star Cargo</span>
            <span className="text-[#1FB6A8] font-medium">v1.0 Live</span>
          </div>
        </div>

        {/* Right Side: Login Form Card */}
        <div className="p-8 md:p-10 flex flex-col justify-center space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white">
              {isBn ? 'অ্যাকাউন্টে সাইন ইন করুন' : 'Sign In To Account'}
            </h3>
            <p className="text-xs text-[#8FA3AD] mt-1">
              {isBn ? 'আপনার ইমেইল ও পাসওয়ার্ড প্রদান করুন' : 'Enter your email and password'}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#8FA3AD] block mb-1.5">
                {isBn ? 'ইমেইল অ্যাড্রেস' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8FA3AD] absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#0B1622] border border-[#1E3247] focus:border-[#1FB6A8] rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-[#8FA3AD] outline-none transition-colors"
                  placeholder="superadmin@cargo.com"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#8FA3AD] block mb-1.5">
                {isBn ? 'পাসওয়ার্ড' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8FA3AD] absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#0B1622] border border-[#1E3247] focus:border-[#1FB6A8] rounded-xl py-2.5 pl-10 pr-10 text-xs text-white placeholder-[#8FA3AD] outline-none transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#8FA3AD] hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#1B4F91] to-[#1FB6A8] hover:from-[#1FB6A8] hover:to-[#22A6B3] text-white font-bold text-xs shadow-lg shadow-[#1FB6A8]/20 transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              <span>{isBn ? 'লগইন সম্পন্ন করুন' : 'Sign In Now'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
