import React from 'react';
import {
  ShieldCheck,
  Plane,
  Building2,
  FileSpreadsheet,
  Search,
  ArrowRight,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { User, UserRole, Language } from '../types';

interface LandingPortalProps {
  users: User[];
  onSelectRole: (role: UserRole) => void;
  onOpenPublicTrack: () => void;
  language: Language;
}

export const LandingPortal: React.FC<LandingPortalProps> = ({
  users,
  onSelectRole,
  onOpenPublicTrack,
  language,
}) => {
  const isBn = language === 'bn';

  const roleCards = [
    {
      role: 'super_admin' as UserRole,
      title: isBn ? 'সুপার এডমিন (Super Admin)' : 'Super Admin Panel',
      desc: isBn
        ? 'সম্পূর্ণ সিস্টেমের মালিকানা — ইউজার ম্যানেজমেন্ট, ওয়্যারহাউজ সেটআপ ও অডিট লগস'
        : 'Full system ownership — warehouse CRUD, user permissions & audit history',
      icon: ShieldCheck,
      color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400',
      badgeBg: 'bg-amber-500/20 text-amber-300',
      user: users.find((u) => u.role === 'super_admin'),
    },
    {
      role: 'operation_director' as UserRole,
      title: isBn ? 'অপারেশন ডিরেক্টর (Op Director)' : 'Operation Director Panel',
      desc: isBn
        ? 'ওয়্যারহাউজের প্রস্তাবিত ফ্লাইং লিস্ট পর্যালোচনা, সম্পাদনা ও ডিসপ্যাচ ফাইনালাইজেশন'
        : 'Review daily proposed flying lists, adjust cartons & finalize dispatch',
      icon: Plane,
      color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
      badgeBg: 'bg-blue-500/20 text-blue-300',
      user: users.find((u) => u.role === 'operation_director'),
    },
    {
      role: 'warehouse_incharge' as UserRole,
      title: isBn ? 'ওয়্যারহাউজ ইনচার্জ (Warehouse Incharge)' : 'Warehouse Incharge Panel',
      desc: isBn
        ? 'নতুন কার্টুন বুকিং এন্ট্রি, ইনভেন্টরি পণ্য পরিচালনা ও ফ্লাইং প্রোপোজাল তৈরি'
        : 'Carton booking entry, stock inventory, flying proposals & destination receiving',
      icon: Building2,
      color: 'from-teal-500/20 to-teal-600/10 border-teal-500/30 text-teal-400',
      badgeBg: 'bg-teal-500/20 text-teal-300',
      user: users.find((u) => u.role === 'warehouse_incharge'),
    },
    {
      role: 'accountant' as UserRole,
      title: isBn ? 'অ্যাকাউন্টেন্ট (Accountant)' : 'Accountant Panel',
      desc: isBn
        ? 'গ্রাহকভিত্তিক আর্থিক লেজার, পেমেন্ট হিসাব ও ক্যাশ কালেকশন সিঙ্ক'
        : 'Customer financial ledgers, charge/payment entries & auto-synced cash dues',
      icon: FileSpreadsheet,
      color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
      badgeBg: 'bg-emerald-500/20 text-emerald-300',
      user: users.find((u) => u.role === 'accountant'),
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B1622] text-[#EAF2F5] flex flex-col justify-between p-4 md:p-8 relative overflow-hidden">
      {/* Background Animated Floating Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/5 w-96 h-96 bg-[#1FB6A8]/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/5 w-96 h-96 bg-[#1B4F91]/15 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      {/* Top Header */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between z-10 py-4">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#1B4F91] via-[#22A6B3] to-[#1FB6A8] flex items-center justify-center text-white font-black text-xl shadow-xl shadow-[#1FB6A8]/20 border border-[#1FB6A8]/40">
            4★
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold font-poppins text-white tracking-wide">
              M/S FOUR STAR <span className="text-[#1FB6A8]">CARGO</span>
            </h1>
            <p className="text-xs text-[#8FA3AD]">
              {isBn ? 'কার্গো অপারেশনস ম্যানেজমেন্ট সিস্টেম' : 'Cargo Operations Management System'}
            </p>
          </div>
        </div>

        {/* Public Track Shortcut Button */}
        <button
          onClick={onOpenPublicTrack}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#1FB6A8]/15 hover:bg-[#1FB6A8]/25 text-[#1FB6A8] border border-[#1FB6A8]/40 text-xs font-semibold transition-all shadow-md hover:scale-105"
        >
          <Search className="w-4 h-4" />
          <span>{isBn ? 'শিপমেন্ট ট্র্যাকিং' : 'Track Shipment'}</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto w-full z-10 my-8">
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#1E3247]/60 border border-[#1FB6A8]/30 text-xs font-medium text-[#1FB6A8]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isBn ? 'অপারেশনস পোর্টাল নির্বাচন করুন' : 'Select Operations Portal'}</span>
          </div>
          <h2 className="text-2xl md:text-4xl font-extrabold text-white font-poppins">
            {isBn
              ? 'আপনার নির্ধারিত রোলে প্রবেশ করুন'
              : 'Access Your Role-Based Dashboard'}
          </h2>
          <p className="text-sm text-[#8FA3AD] max-w-2xl mx-auto">
            {isBn
              ? 'প্রতিটি রোলের আলাদা লগইন প্যানেল ও সিকিউরিটি পারমিশন নির্ধারিত রয়েছে। নিচে থেকে যেকোনো প্যানেলে প্রবেশ করুন।'
              : 'Each role has a separate login dashboard with strictly enforced database-level security policies.'}
          </p>
        </div>

        {/* 4 Role Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {roleCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.role}
                className={`bg-gradient-to-b ${card.color} rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-[#1FB6A8]/10 flex flex-col justify-between group relative`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-xl ${card.badgeBg}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#0B1622]/80 text-[#8FA3AD]">
                      {card.role}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-[#1FB6A8] transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs text-[#8FA3AD] leading-relaxed mt-2">
                      {card.desc}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
                  {/* Demo user hint */}
                  {card.user && (
                    <div className="text-[11px] text-[#8FA3AD] flex items-center space-x-1.5 truncate">
                      <UserCheck className="w-3.5 h-3.5 text-[#1FB6A8] shrink-0" />
                      <span className="truncate">{card.user.name}</span>
                    </div>
                  )}

                  <button
                    onClick={() => onSelectRole(card.role)}
                    className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-[#1B4F91] hover:bg-[#1FB6A8] text-white text-xs font-semibold transition-all shadow-md group-hover:shadow-lg"
                  >
                    <span>{isBn ? 'লগইন করুন' : 'Login Now'}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Public Tracking Banner Card */}
        <div className="mt-10 bg-gradient-to-r from-[#1E293B] via-[#1B4F91]/40 to-[#1E293B] rounded-2xl p-6 border border-[#1FB6A8]/30 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center space-x-4">
            <div className="p-3.5 rounded-2xl bg-[#1FB6A8]/20 text-[#1FB6A8] shrink-0">
              <Search className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isBn ? 'গ্রাহক শিপমেন্ট ট্র্যাকিং পোর্টাল (No Login Required)' : 'Customer Shipment Tracking Portal'}
              </h3>
              <p className="text-xs text-[#8FA3AD] mt-0.5">
                {isBn
                  ? 'কাস্টমার কোন লগইন ছাড়াই ট্র্যাক আইডি/সিটিএন নম্বর দিয়ে পার্সেলের বর্তমান অবস্থান ও টাইমলাইন দেখতে পারবে।'
                  : 'Allows customers to check live status via tracking number or CTN without system login.'}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenPublicTrack}
            className="w-full md:w-auto flex items-center justify-center space-x-2 py-3 px-6 rounded-xl bg-[#1FB6A8] hover:bg-[#22A6B3] text-[#0F2D52] font-bold text-xs transition-all shrink-0 shadow-lg shadow-[#1FB6A8]/20"
          >
            <span>{isBn ? 'ট্র্যাকিং পেজ খুলুন' : 'Open Tracking Page'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full text-center text-xs text-[#8FA3AD] py-4 z-10 border-t border-[#1E3247]">
        © 2026 M/S Four Star Cargo. {isBn ? 'সর্বস্বত্ব সংরক্ষিত।' : 'All rights reserved.'}
      </footer>
    </div>
  );
};
