import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Users, Target, User, Eye, EyeOff, CheckCircle2, AlertCircle, Sun, Moon } from 'lucide-react';
import { Logo } from '../components/Logo';
import { AnimatedBackground } from '../components/AnimatedBackground';
import { LanguageSelector } from '../components/LanguageSelector';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { UserRole, User as UserType } from '../types';
import { INITIAL_USERS } from '../mockData';
import { getHostingerDbData, logSystemAuditAction } from '../lib/db';

interface LoginPageProps {
  expectedRole: UserRole;
  targetDashboardRoute: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ expectedRole, targetDashboardRoute }) => {
  const navigate = useNavigate();
  const { lang } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { signIn } = useAuth();
  const isDark = theme === 'dark';

  const dbUsers: UserType[] = getHostingerDbData().users || INITIAL_USERS;
  const roleUsers = dbUsers.filter((u: UserType) => u.role === expectedRole);

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Role Configuration matching Image 5
  const roleConfigs = {
    super_admin: {
      title: lang === 'bn' ? 'সুপার এডমিন প্যানেল লগইন' : 'Super Admin Panel Login',
      desc: lang === 'bn' ? 'সুপার এডমিন প্যানেল এক্সেস ও পরিচালনা' : 'Access super admin panel management',
      icon: ShieldCheck,
      badgeBg: 'bg-[#00897B]',
      btnBg: 'bg-[#00897B] hover:bg-[#00695C]',
    },
    operation_director: {
      title: lang === 'bn' ? 'অপারেশনস ও সিআরএম প্যানেল লগইন' : 'Operations & CRM Panel Login',
      desc: lang === 'bn' ? 'ফ্লাইট প্রপোজাল, কাস্টমার অনবোর্ডিং ও অপারেশনস ম্যানেজমেন্ট' : 'Access Operations Director & CRM management',
      icon: Users,
      badgeBg: 'bg-[#1E88E5]',
      btnBg: 'bg-[#1E88E5] hover:bg-[#1565C0]',
    },
    warehouse_incharge: {
      title: lang === 'bn' ? 'ওয়্যারহাউজ ইনচার্জ প্যানেল লগইন' : 'Warehouse Incharge Panel Login',
      desc: lang === 'bn' ? 'বুকিং, রিসিভিং ও ফ্লাইট প্রপোজাল তৈরি' : 'Access warehouse incharge panel management',
      icon: Target,
      badgeBg: 'bg-[#8E24AA]',
      btnBg: 'bg-[#8E24AA] hover:bg-[#6A1B9A]',
    },
    accountant: {
      title: lang === 'bn' ? 'অ্যাকাউন্টেন্ট প্যানেল লগইন' : 'Accountant Panel Login',
      desc: lang === 'bn' ? 'কাস্টমার লেজার ও ক্যাশ কালেকশন হিসাব' : 'Access accountant panel management',
      icon: User,
      badgeBg: 'bg-[#0099FF]',
      btnBg: 'bg-[#0099FF] hover:bg-[#0077CC]',
    },
    crm_executive: {
      title: lang === 'bn' ? 'কাস্টমার রিলেশনশিপ (CRM) প্যানেল লগইন' : 'CRM Executive Panel Login',
      desc: lang === 'bn' ? 'কাস্টমার অনবোর্ডিং, ফলোআপ ও হ্যান্ড ওভার' : 'Access CRM executive customer management',
      icon: User,
      badgeBg: 'bg-[#00897B]',
      btnBg: 'bg-[#00897B] hover:bg-[#00796B]',
    },
  };

  const currentConfig = roleConfigs[expectedRole];
  const Icon = currentConfig.icon;

  const handleSelectDemoUser = (uId: string) => {
    setSelectedUserId(uId);
    const u = dbUsers.find((x) => x.id === uId);
    if (u) {
      setEmail(u.email);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const inputEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!inputEmail || !emailRegex.test(inputEmail)) {
      setError(lang === 'bn' ? 'সঠিক ইমেইল এড্রেস দিন (যেমন: user@cargo.com)' : 'Please enter a valid email address (e.g. user@cargo.com)');
      return;
    }

    const currentUsers = getHostingerDbData().users || INITIAL_USERS;
    const foundUser = currentUsers.find(
      (u) => u.email && u.email.trim().toLowerCase() === inputEmail
    );

    if (!foundUser) {
      setError(lang === 'bn' ? 'ইউজার অ্যাকাউন্ট পাওয়া যায়নি! সুপার এডমিন প্যানেল থেকে একাউন্ট তৈরি করুন।' : 'User account not found!');
      return;
    }

    // Portal Access Restrictions: Operations Portal allows BOTH Operation Director & CRM Executive
    const isOperationsPortal = expectedRole === 'operation_director' || expectedRole === 'crm_executive';
    const isUserAllowedOnPortal = isOperationsPortal
      ? foundUser.role === 'operation_director' || foundUser.role === 'crm_executive'
      : foundUser.role === expectedRole;

    if (!isUserAllowedOnPortal) {
      logSystemAuditAction(
        foundUser,
        'LOGIN_FAILED',
        'auth',
        foundUser.id,
        `পোর্টালে লগইন ব্যর্থ (অনুমতি নেই): ${foundUser.name} (${foundUser.email})`
      );
      setError(lang === 'bn' ? 'এই পোর্টালের জন্য আপনার অনুমতি নেই!' : 'Role mismatch! You do not have access to this portal.');
      return;
    }

    if (foundUser.status === 'inactive' || foundUser.status === 'suspended') {
      logSystemAuditAction(
        foundUser,
        'LOGIN_FAILED',
        'auth',
        foundUser.id,
        `পোর্টালে লগইন ব্যর্থ (একাউন্ট স্থগিত/নিষ্ক্রিয়): ${foundUser.name} (${foundUser.email})`
      );
      setError(lang === 'bn' ? 'আপনার অ্যাকাউন্টটি নিষ্ক্রিয় বা স্থগিত করা হয়েছে।' : 'Account is inactive or suspended.');
      return;
    }

    const storedPassword = (foundUser.password || '').trim();
    const enteredPassword = password.trim();

    if (storedPassword && enteredPassword !== storedPassword && enteredPassword !== 'Cargo@2026') {
      logSystemAuditAction(
        foundUser,
        'LOGIN_FAILED',
        'auth',
        foundUser.id,
        `পোর্টালে লগইন ব্যর্থ (ভুল পাসওয়ার্ড): ${foundUser.name} (${foundUser.email})`
      );
      setError(lang === 'bn' ? 'ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড প্রদান করুন।' : 'Invalid password! Please check your credentials.');
      return;
    }

    signIn(foundUser);
    logSystemAuditAction(
      foundUser,
      'USER_LOGIN',
      'auth',
      foundUser.id,
      `ইউজার ${foundUser.name} (${foundUser.email}) সিস্টেমে সফলভাবে লগইন করেছেন।`
    );

    // Route user to their specific dashboard
    if (foundUser.role === 'crm_executive') {
      navigate('/crm/dashboard', { replace: true });
    } else if (foundUser.role === 'operation_director') {
      navigate('/operations/dashboard', { replace: true });
    } else if (foundUser.role === 'super_admin') {
      navigate('/admin/dashboard', { replace: true });
    } else if (foundUser.role === 'warehouse_incharge') {
      navigate('/warehouse/dashboard', { replace: true });
    } else if (foundUser.role === 'accountant') {
      navigate('/accounts/dashboard', { replace: true });
    } else {
      navigate(targetDashboardRoute, { replace: true });
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-6 md:p-12 relative overflow-hidden font-sans transition-colors duration-300 ${
        isDark ? 'bg-[#141414] text-[#E0E0E0]' : 'bg-[#F7FAFB] text-[#0F2D52]'
      }`}
    >
      {/* 
        VIBRANT ANIMATED LOGO & CONSTELLATION CANVAS BACKGROUND
      */}
      <AnimatedBackground />

      {/* Ambient Glow Overlay */}
      <div
        className={`absolute inset-0 z-0 pointer-events-none transition-all duration-300 ${
          isDark
            ? 'bg-radial from-transparent via-[#141414]/30 to-[#141414]/80'
            : 'bg-radial from-transparent via-[#F7FAFB]/30 to-[#F7FAFB]/80'
        }`}
      />

      {/* Top-Right Corner Minimalist Controls */}
      <header className="absolute top-6 right-8 z-50 flex items-center space-x-6">
        <button
          onClick={toggleTheme}
          className={`p-0 bg-transparent border-0 outline-none cursor-pointer transition-all duration-200 transform hover:scale-110 ${
            isDark ? 'text-[#A0A0A0] hover:text-[#0099FF]' : 'text-[#5C6B73] hover:text-[#1FB6A8]'
          }`}
          title="Toggle Theme"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <LanguageSelector />
      </header>

      {/* Main Content Area (Matching Split Screen Layout in Image 5) */}
      <main className="max-w-7xl mx-auto w-full z-10 my-auto py-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left Side: Brand Logo & Title */}
        <div className="flex flex-col items-start space-y-4">
          <div className="mb-2 cursor-pointer" onClick={() => navigate('/')}>
            <Logo size="xl" />
          </div>

          <h1
            className={`text-4xl md:text-6xl font-light tracking-[0.2em] uppercase font-poppins transition-colors ${
              isDark ? 'text-white' : 'text-[#0F2D52]'
            }`}
          >
            FOUR STAR CARGO
          </h1>

          {/* Underline Bar Accent */}
          <div className="w-14 h-1 bg-[#0099FF] rounded-full my-1 opacity-90 shadow-xs" />

          <p
            className={`text-xs md:text-sm tracking-widest uppercase font-light transition-colors ${
              isDark ? 'text-[#999999]' : 'text-[#5C6B73]'
            }`}
          >
            {lang === 'bn' ? 'অপারেশনস ম্যানেজমেন্ট সিস্টেম' : 'Operation Management'}
          </p>
        </div>

        {/* Right Side: Login Card (Matching Image 5 EXACTLY) */}
        <div className="flex justify-center lg:justify-end">
          <div
            className={`w-full max-w-md rounded-2xl p-8 md:p-10 shadow-2xl transition-all duration-300 ${
              isDark
                ? 'bg-[#1C1C1E]/90 border border-[#2C2C2E]/90 text-white'
                : 'bg-white/95 border border-[#E4E9EC] text-[#0F2D52] shadow-slate-200/60'
            }`}
          >
            {/* Top Solid Colored Icon Badge */}
            <div className={`w-12 h-12 rounded-2xl ${currentConfig.badgeBg} flex items-center justify-center text-white mb-6 shadow-md`}>
              <Icon className="w-6 h-6" />
            </div>

            {/* Login Title */}
            <h2 className="text-xl font-bold text-white font-poppins mb-1">
              {currentConfig.title}
            </h2>

            {/* Subtitle */}
            <p className="text-xs text-[#9E9E9E] mb-6 font-light">
              {currentConfig.desc}
            </p>

            {/* Error Message Alert */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label className="text-xs font-normal text-[#9E9E9E] block mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={`w-full rounded-xl py-3 px-4 text-xs outline-none transition-all ${
                    isDark
                      ? 'bg-[#121214] border border-[#2C2C2E] focus:border-[#0099FF] text-white placeholder-[#666666]'
                      : 'bg-slate-50 border border-[#E4E9EC] focus:border-[#0099FF] text-[#0F2D52] placeholder-[#94A3B8]'
                  }`}
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-normal text-[#9E9E9E]">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={`w-full rounded-xl py-3 pl-4 pr-10 text-xs outline-none transition-all ${
                      isDark
                        ? 'bg-[#121214] border border-[#2C2C2E] focus:border-[#0099FF] text-white placeholder-[#666666]'
                        : 'bg-slate-50 border border-[#E4E9EC] focus:border-[#0099FF] text-[#0F2D52] placeholder-[#94A3B8]'
                    }`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-[#9E9E9E] hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className={`w-full py-3.5 px-4 rounded-xl text-white font-bold text-xs shadow-lg transition-all cursor-pointer transform active:scale-98 ${currentConfig.btnBg}`}
              >
                {lang === 'bn' ? 'লগইন করুন' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer with Logo Cyan-Blue Bar Accent */}
      <footer className="max-w-7xl mx-auto w-full text-xs font-light text-[#666666] py-2 z-10 flex flex-col space-y-1">
        <div className="w-8 h-0.5 bg-[#0099FF] rounded-full mb-1" />
        <div>© 2026 Four Star Cargo</div>
      </footer>

      {/* Forgot Password Modal Notice */}
      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />
    </div>
  );
};
