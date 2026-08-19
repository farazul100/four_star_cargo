import React from 'react';
import {
  LayoutDashboard,
  Package,
  Plane,
  Building2,
  Users,
  FileSpreadsheet,
  History,
  Search,
  PlusCircle,
  Truck,
  CheckCircle2,
  Globe,
  Bell,
  Activity,
  Wallet,
  Settings,
  BarChart3,
  Send,
} from 'lucide-react';
import { User, Language, Theme } from '../types';

interface SidebarProps {
  currentUser: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  language: Language;
  theme?: Theme;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  language,
  theme = 'dark',
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const isBn = language === 'bn';
  const isDark = theme === 'dark';

  if (!currentUser) return null;

  const role = currentUser.role;

  const getRolePanelTitle = (role: string) => {
    switch (role) {
      case 'super_admin': return isBn ? 'সুপার এডমিন প্যানেল' : 'Super Admin Panel';
      case 'operation_director': return isBn ? 'অপারেশনস ডিরেক্টর' : 'Operation Director Panel';
      case 'warehouse_incharge': return isBn ? 'ওয়্যারহাউস ইনচার্জ' : 'Warehouse Incharge Panel';
      case 'accountant': return isBn ? 'অ্যাকাউন্টেন্ট প্যানেল' : 'Accountant Panel';
      case 'crm_executive': return isBn ? 'কাস্টমার রিলেশনশিপ (CRM)' : 'CRM Executive Panel';
      default: return 'User Panel';
    }
  };

  const getRoleThemeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return '#00897B';
      case 'operation_director': return '#1E88E5';
      case 'warehouse_incharge': return '#8E24AA';
      case 'accountant': return '#F57C00';
      case 'crm_executive': return '#00897B';
      default: return '#00897B';
    }
  };

  const panelColor = getRoleThemeColor(role);

  // Build navigation items based on role
  const getNavItems = () => {
    switch (role) {
      case 'super_admin':
        return [
          {
            section: isBn ? 'প্রধান' : 'MAIN',
            items: [
              { id: 'dashboard', label: isBn ? 'কোম্পানি অ্যানালিটিক্স' : 'Company Analytics', icon: LayoutDashboard },
              { id: 'live_lifecycle', label: isBn ? '⚡ কার্গো লাইফসাইকেল মনিটর' : '⚡ Cargo Live Lifecycle', icon: Activity },
              { id: 'cargo_search', label: isBn ? '🔍 কার্গো ট্র্যাকিং সার্চ' : '🔍 Cargo Tracking Search', icon: Search },
              { id: 'notifications', label: isBn ? 'নোটিফিকেশন' : 'Notifications', icon: Bell },
              { id: 'data_tracker', label: isBn ? 'ডাটা ট্র্যাকার' : 'Data Tracker', icon: Activity },
              { id: 'cartons', label: isBn ? 'সব কার্টুন ডাটা' : 'All Carton Data', icon: Package },
              { id: 'budget', label: isBn ? 'বাজেট ও খরচ' : 'Budget & Expenses', icon: Wallet },
              { id: 'proposals', label: isBn ? 'ফ্লাইং প্রস্তাবনা' : 'Flying Proposals', icon: Plane },
              { id: 'final_flying_list', label: isBn ? 'ফাইনাল ফ্লাইং লিস্ট' : 'Final Flying List', icon: Send },
            ],
          },
          {
            section: isBn ? 'ব্যবস্থাপনা' : 'MANAGEMENT',
            items: [
              { id: 'crm', label: isBn ? '👥 কাস্টমার রিলেশনশিপ (CRM)' : '👥 CRM Management', icon: Users },
              { id: 'warehouses', label: isBn ? 'ওয়্যারহাউজ ম্যানেজমেন্ট' : 'Warehouse Setup', icon: Building2 },
              { id: 'users', label: isBn ? 'ইউজার ও রোলস' : 'User Accounts', icon: Users },
              { id: 'ledger', label: isBn ? 'কাস্টমার লেজার ওভারভিউ' : 'Customer Dues Ledger', icon: FileSpreadsheet },
            ],
          },
          {
            section: isBn ? 'সেটিংস' : 'SETTINGS',
            items: [
              { id: 'settings', label: isBn ? 'সিস্টেম সেটিংস' : 'System Settings', icon: Settings },
              { id: 'audit_logs', label: isBn ? 'অডিট লগস (Audit Log)' : 'System Audit Logs', icon: History },
              { id: 'public_track', label: isBn ? 'পাবলিক ট্র্যাকিং পেজ' : 'Public Track Preview', icon: Search },
            ],
          },
        ];

      case 'operation_director':
        return [
          {
            section: isBn ? 'প্রধান' : 'MAIN',
            items: [
              { id: 'dashboard', label: isBn ? 'অপারেশনস ড্যাশবোর্ড' : 'Operations Dashboard', icon: LayoutDashboard },
              { id: 'crm', label: isBn ? '👥 কাস্টমার রিলেশনশিপ (CRM)' : '👥 CRM Management', icon: Users },
              { id: 'live_lifecycle', label: isBn ? '⚡ কার্গো লাইফসাইকেল মনিটর' : '⚡ Cargo Live Lifecycle', icon: Activity },
              { id: 'cargo_search', label: isBn ? '🔍 কার্গো ট্র্যাকিং সার্চ' : '🔍 Cargo Tracking Search', icon: Search },
              { id: 'notifications', label: isBn ? 'নোটিফিকেশন' : 'Notifications', icon: Bell },
              { id: 'proposals', label: isBn ? 'পেন্ডিং ফ্লাইং লিস্ট' : 'Pending Flying Lists', icon: Plane },
              { id: 'final_flying_list', label: isBn ? 'ফাইনাল ফ্লাইং লিস্ট' : 'Final Flying List', icon: Send },
              { id: 'cartons', label: isBn ? 'অল বুকিং লিস্ট' : 'All Booking List', icon: Package },
            ],
          },
          {
            section: isBn ? 'রিপোর্ট ও অ্যানালিটিক্স' : 'REPORTS & ANALYTICS',
            items: [
              { id: 'history', label: isBn ? 'রিসিভ ফ্লাইং' : 'Receive Flying', icon: Truck },
              { id: 'analytics', label: isBn ? 'অপারেশনস অ্যানালিটিক্স' : 'Operations Analytics', icon: BarChart3 },
              { id: 'public_track', label: isBn ? 'শিপমেন্ট ট্র্যাকার' : 'Shipment Tracker', icon: Search },
            ],
          },
        ];

      case 'warehouse_incharge':
        return [
          {
            section: isBn ? 'প্রধান' : 'MAIN',
            items: [
              { id: 'dashboard', label: isBn ? 'ওয়্যারহাউজ ড্যাশবোর্ড' : 'Warehouse Dashboard', icon: LayoutDashboard },
              { id: 'cargo_search', label: isBn ? '🔍 কার্গো ট্র্যাকিং সার্চ' : '🔍 Cargo Tracking Search', icon: Search },
              { id: 'notifications', label: isBn ? 'নোটিফিকেশন' : 'Notifications', icon: Bell },
              { id: 'booking_entry', label: isBn ? 'নতুন কার্টুন এন্ট্রি' : 'New Carton Booking', icon: PlusCircle },
              { id: 'inventory', label: isBn ? 'ইনভেন্টরি পণ্য' : 'Current Stock Items', icon: Package },
              { id: 'proposal_create', label: isBn ? 'ফ্লাইং প্রস্তাবনা তৈরি' : 'Create Flying Proposal', icon: Plane },
              { id: 'final_flying_list', label: isBn ? 'ফাইনাল ফ্লাইং লিস্ট' : 'Final Flying List', icon: Send },
              { id: 'history', label: isBn ? 'রিসিভ ফ্লাইং' : 'Receive Flying', icon: Truck },
              { id: 'receive_incoming', label: isBn ? 'ইনকামিং কার্গো গ্রহণ' : 'Receive Incoming Cargo', icon: Package },
            ],
          },
          {
            section: isBn ? 'ডেলিভারি' : 'DELIVERY',
            items: [
              { id: 'delivered_products', label: isBn ? 'বিলিকৃত প্রোডাক্ট' : 'Delivered Products Stock', icon: CheckCircle2 },
              { id: 'delivery_cash', label: isBn ? 'ডেলিভারি ও ক্যাশ আদায়' : 'Delivery & Cash Collection', icon: CheckCircle2 },
            ],
          },
        ];

      case 'accountant':
        return [
          {
            section: isBn ? 'প্রধান' : 'MAIN',
            items: [
              { id: 'dashboard', label: isBn ? 'অ্যাকাউন্টস ড্যাশবোর্ড' : 'Accounts Dashboard', icon: LayoutDashboard },
              { id: 'cargo_search', label: isBn ? '🔍 কার্গো ট্র্যাকিং সার্চ' : '🔍 Cargo Tracking Search', icon: Search },
              { id: 'notifications', label: isBn ? 'নোটিফিকেশন' : 'Notifications', icon: Bell },
              { id: 'customer_ledger', label: isBn ? 'কাস্টমার লেজার' : 'Customer Ledger', icon: FileSpreadsheet },
              { id: 'budget', label: isBn ? 'বাজেট ও খরচ (Super Admin)' : 'Budget & Expenses', icon: Wallet },
              { id: 'cash_collections', label: isBn ? 'ক্যাশ কালেকশন সিঙ্ক' : 'Cash Collection Sync', icon: CheckCircle2 },
              { id: 'reports', label: isBn ? 'ফাইনান্সিয়াল রিপোর্টস' : 'Financial Reports', icon: FileSpreadsheet },
            ],
          },
        ];

      case 'crm_executive':
        return [
          {
            section: isBn ? 'প্রধান' : 'MAIN',
            items: [
              { id: 'dashboard', label: isBn ? 'সিআরএম কাস্টমার বোর্ড' : 'CRM Customer Board', icon: Users },
              { id: 'cargo_search', label: isBn ? '🔍 কার্গো ট্র্যাকিং সার্চ' : '🔍 Cargo Tracking Search', icon: Search },
              { id: 'notifications', label: isBn ? 'নোটিফিকেশন' : 'Notifications', icon: Bell },
            ],
          },
        ];

      default:
        return [];
    }
  };

  const navSections = getNavItems();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
        />
      )}

      {/* Sidebar Navigation Panel */}
      <aside
        className={`w-64 border-r flex flex-col font-sans shrink-0 overflow-y-auto h-full z-40 transition-all duration-200 ${
          isOpenMobile ? 'fixed inset-y-0 left-0 md:static' : 'hidden md:flex'
        } ${
          isDark
            ? 'bg-[#121214] border-[#2C2C2E]/60 text-white'
            : 'bg-white border-gray-200 text-gray-900 shadow-sm'
        }`}
      >
        {/* Top Brand Logo Section (inside sidebar) */}
        <div
          className={`h-14 flex items-center px-4 gap-3 border-b shrink-0 ${
            isDark ? 'border-[#2C2C2E]/60 bg-[#121214]' : 'border-gray-200 bg-white'
          }`}
        >
          <img src="/logo.png" alt="Four Star Cargo" className="w-8 h-8 rounded-lg object-contain" />
          <div>
            <span
              className={`font-bold text-sm tracking-wider font-sans block leading-tight ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              FOUR STAR CARGO
            </span>
            <p className={`text-[10px] ${isDark ? 'text-[#7C7C7C]' : 'text-gray-500'} mt-0.5 leading-none`}>
              {getRolePanelTitle(role)}
            </p>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <div className={`px-3.5 pt-2 pb-1 text-[11px] font-normal text-[#7C7C7C]`}>
                {section.section}
              </div>

              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-normal transition-all duration-150 cursor-pointer ${
                      isActive
                        ? isDark
                          ? 'bg-[#28282A] text-white font-semibold shadow-xs'
                          : 'bg-slate-100 text-slate-900 font-semibold shadow-xs'
                        : isDark
                        ? 'text-[#A0A0A0] hover:text-white hover:bg-[#1C1C1E]'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-[#1FB6A8]'
                          : isDark
                          ? 'text-[#8E8E93]'
                          : 'text-gray-500'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div
          className={`p-3 border-t shrink-0 ${
            isDark ? 'border-[#2C2C2E]/60 bg-[#121214]' : 'border-gray-200 bg-white'
          }`}
        >
          <button
            onClick={() => {
              setActiveTab('cargo_search');
              if (onCloseMobile) onCloseMobile();
            }}
            className={`w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              isDark
                ? 'bg-[#1C1C1E] hover:bg-[#28282A] text-[#A0A0A0] hover:text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-[#00897B]" />
            <span>{isBn ? 'পাবলিক ট্র্যাকিং পেজ' : 'Public Track Portal'}</span>
          </button>
        </div>
      </aside>
    </>
  );
};
