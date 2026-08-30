import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Users, Target, User, ArrowRight, Sun, Moon } from 'lucide-react';
import { Logo } from '../components/Logo';
import { AnimatedBackground } from '../components/AnimatedBackground';
import { LanguageSelector } from '../components/LanguageSelector';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../context/ThemeContext';
import { UserRole } from '../types';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === 'dark';

  const roleCards = [
    {
      role: 'super_admin' as UserRole,
      title: lang === 'bn' ? 'সুপার এডমিন প্যানেল' : 'Super Admin Panel',
      desc: lang === 'bn' ? 'MD, Operations Manager, Warehouse Director' : 'MD, Operations Manager, Warehouse Director',
      loginRoute: '/admin/login',
      icon: ShieldCheck,
      badgeBg: 'bg-[#00897B]',
      linkColor: isDark ? 'text-[#00897B] hover:text-[#26A69A]' : 'text-[#00897B] hover:text-[#00695C]',
    },
    {
      role: 'operation_director' as UserRole,
      title: lang === 'bn' ? 'অপারেশন ডিরেক্টর প্যানেল' : 'Operation Director Panel',
      desc: lang === 'bn' ? 'Operations Manager, Flight Dispatch Director' : 'Operations Manager, Flight Dispatch Director',
      loginRoute: '/operations/login',
      icon: Users,
      badgeBg: 'bg-[#1E88E5]',
      linkColor: isDark ? 'text-[#1E88E5] hover:text-[#42A5F5]' : 'text-[#1E88E5] hover:text-[#1565C0]',
    },
    {
      role: 'warehouse_incharge' as UserRole,
      title: lang === 'bn' ? 'ওয়্যারহাউজ ইনচার্জ প্যানেল' : 'Warehouse Incharge Panel',
      desc: lang === 'bn' ? 'Warehouse Incharge, Receiving & Dispatch' : 'Warehouse Incharge, Receiving & Dispatch',
      loginRoute: '/warehouse/login',
      icon: Target,
      badgeBg: 'bg-[#8E24AA]',
      linkColor: isDark ? 'text-[#8E24AA] hover:text-[#AB47BC]' : 'text-[#8E24AA] hover:text-[#6A1B9A]',
    },
    {
      role: 'accountant' as UserRole,
      title: lang === 'bn' ? 'অ্যালকাউন্টেন্ট প্যানেল' : 'Accountant Panel',
      desc: lang === 'bn' ? 'Accounts Manager, Ledger & Cash Collection' : 'Accounts Manager, Ledger & Cash Collection',
      loginRoute: '/accounts/login',
      icon: User,
      badgeBg: 'bg-[#F57C00]',
      linkColor: isDark ? 'text-[#F57C00] hover:text-[#FFA726]' : 'text-[#F57C00] hover:text-[#E65100]',
    },
  ];

  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-6 md:p-12 relative overflow-hidden font-sans transition-colors duration-300 ${
        isDark ? 'bg-[#1E293B] text-[#E0E0E0]' : 'bg-[#F8FAFC] text-[#0F2D52]'
      }`}
    >
      {/* 
        VIBRANT ANIMATED LOGO & CONSTELLATION CANVAS BACKGROUND
        Renders spinning logos, triangles, squares, lines, and mouse repulsion matching Image 4
      */}
      <AnimatedBackground />

      {/* Top-Right Corner Minimalist Controls */}
      <header className="absolute top-6 right-8 z-50 flex items-center space-x-6">
        {/* Theme Toggle Icon (Sun / Moon) */}
        <button
          onClick={toggleTheme}
          className={`p-0 bg-transparent border-0 outline-none cursor-pointer transition-all duration-200 transform hover:scale-110 ${
            isDark
              ? 'text-[#A0A0A0] hover:text-amber-400'
              : 'text-[#5C6B73] hover:text-[#1FB6A8]'
          }`}
          title="Toggle Theme"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Multi-Country Language Selector */}
        <LanguageSelector />
      </header>

      {/* Center Hero Branding Section */}
      <main className="max-w-7xl mx-auto w-full z-10 my-auto py-8 space-y-12">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="mb-2">
            <Logo size="lg" />
          </div>

          <h1
            className={`text-3xl md:text-5xl font-light tracking-[0.2em] uppercase font-poppins transition-colors ${
              isDark ? 'text-white' : 'text-[#0F2D52]'
            }`}
          >
            FOUR STAR CARGO
          </h1>

          {/* Underline Bar Accent */}
          <div className="w-12 h-1 bg-[#F57C00] rounded-full my-1 opacity-90" />

          <p
            className={`text-xs md:text-sm tracking-widest uppercase font-light transition-colors ${
              isDark ? 'text-[#999999]' : 'text-[#5C6B73]'
            }`}
          >
            {lang === 'bn' ? 'অপারেশনস ম্যানেজমেন্ট সিস্টেম' : 'Operation Management System'}
          </p>
        </div>

        {/* 4 Equal-Sized Role Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {roleCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.role}
                onClick={() => navigate(card.loginRoute)}
                className={`rounded-2xl p-7 flex flex-col justify-between cursor-pointer group transition-all duration-300 ${
                  isDark
                    ? 'bg-[#1E293B] border border-[#2C2C2E] hover:border-[#3A3A3C] hover:bg-[#222224]'
                    : 'bg-white border border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow-md'
                }`}
              >
                <div>
                  {/* Top-Left Solid Colored Icon Badge */}
                  <div
                    className={`w-12 h-12 rounded-2xl ${card.badgeBg} flex items-center justify-center text-white mb-6 shadow-md`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Role Title */}
                  <h2
                    className={`text-base md:text-lg font-medium transition-colors mb-2 font-poppins tracking-wide ${
                      isDark ? 'text-white' : 'text-[#0F2D52]'
                    }`}
                  >
                    {card.title}
                  </h2>

                  {/* Description */}
                  <p
                    className={`text-xs leading-relaxed mb-8 min-h-[38px] font-light transition-colors ${
                      isDark ? 'text-[#999999]' : 'text-[#5C6B73]'
                    }`}
                  >
                    {card.desc}
                  </p>
                </div>

                {/* Bottom Left Accent Link (Login →) */}
                <div className="pt-2">
                  <div
                    className={`inline-flex items-center space-x-1.5 text-xs font-normal ${card.linkColor} transition-all`}
                  >
                    <span>{lang === 'bn' ? 'লগইন করুন' : 'Login'}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer
        className={`max-w-7xl mx-auto w-full text-xs font-light py-2 z-10 transition-colors ${
          isDark ? 'text-[#666666]' : 'text-[#8FA3AD]'
        }`}
      >
        © 2026 Four Star Cargo
      </footer>
    </div>
  );
};
