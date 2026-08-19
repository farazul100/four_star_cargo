import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Phone,
  CheckCircle2,
  Clock,
  Search,
  Award,
  Send,
  X,
  Star,
} from 'lucide-react';
import { CrmCustomer, User, Language, Theme } from '../types';
import { getHostingerDbData, saveHostingerDbData, subscribeToDbUpdates, logSystemAuditAction } from '../lib/db';
import { useTheme } from '../context/ThemeContext';
import { ToastContainer, ToastMessage } from './Toast';

interface CrmManagementSystemProps {
  currentUser: User;
  language: Language;
  theme?: Theme;
}

export const CrmManagementSystem: React.FC<CrmManagementSystemProps> = ({
  currentUser,
  language = 'bn',
  theme: themeProp,
}) => {
  const isBn = language === 'bn';
  const { theme: contextTheme } = useTheme();
  const activeTheme = contextTheme || themeProp || 'light';
  const isDark = activeTheme === 'dark';

  // Toast Alerts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: `toast-${Date.now()}`, type, title, message }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Main CRM Customers State live synced with Hostinger DB
  const [customers, setCustomers] = useState<CrmCustomer[]>(() => {
    const dbData = getHostingerDbData();
    return dbData.crmCustomers || [];
  });

  // Real-time DB Sync
  useEffect(() => {
    return subscribeToDbUpdates(() => {
      const dbData = getHostingerDbData();
      if (dbData.crmCustomers) {
        setCustomers(dbData.crmCustomers);
      }
    });
  }, []);

  // Filter States
  const [selectedCountryTab, setSelectedCountryTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [executiveFilter, setExecutiveFilter] = useState('all');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCategory, setCountryCategory] = useState<CrmCustomer['country_category']>('CN_New');
  const [followupStatus, setFollowupStatus] = useState<CrmCustomer['followup_status']>('followup');
  const [notes, setNotes] = useState('');

  // Handle Save New Customer
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const newCust: CrmCustomer = {
      id: `crm-cust-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      country_category: countryCategory,
      followup_status: followupStatus,
      notes: notes.trim(),
      created_by: currentUser.name,
      created_by_id: currentUser.id,
      created_at: new Date().toISOString(),
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }),
      is_handed_over: false,
    };

    const updatedList = [newCust, ...customers];
    setCustomers(updatedList);
    saveHostingerDbData('fsc_vps_crm_customers', updatedList);

    logSystemAuditAction(
      currentUser,
      'CREATE_CRM_CUSTOMER',
      'crm',
      newCust.id,
      `নতুন কাস্টমার ${newCust.name} (${newCust.phone}) অনবোর্ড করা হয়েছে`
    );

    addToast(
      'success',
      isBn ? 'নতুন কাস্টমার তৈরি সফল!' : 'Customer Created Successfully!',
      isBn ? `${newCust.name} সিস্টেমে যুক্ত হয়েছে` : `${newCust.name} added to CRM`
    );

    setName('');
    setPhone('');
    setNotes('');
    setShowAddModal(false);
  };

  // Handle Hand Over Customer
  const handleHandoverCustomer = (cust: CrmCustomer) => {
    if (cust.is_handed_over) return;

    const updatedList = customers.map((c) => {
      if (c.id === cust.id) {
        return {
          ...c,
          is_handed_over: true,
          handed_over_at: new Date().toISOString(),
          handed_over_by: currentUser.name,
        };
      }
      return c;
    });

    setCustomers(updatedList);
    saveHostingerDbData('fsc_vps_crm_customers', updatedList);

    logSystemAuditAction(
      currentUser,
      'HANDOVER_CRM_CUSTOMER',
      'crm',
      cust.id,
      `কাস্টমার ${cust.name} অপারেশনে হ্যান্ড ওভার করা হয়েছে (${currentUser.name})`
    );

    addToast(
      'success',
      isBn ? '🤝 কাস্টমার হ্যান্ড ওভার সম্পন্ন!' : '🤝 Customer Handed Over!',
      isBn ? `${cust.name} কাস্টমার সফলভাবে হ্যান্ড ওভার হিসেবে মার্ক করা হয়েছে` : `${cust.name} handed over successfully`
    );
  };

  // Handle Move Status
  const handleShiftStatus = (cust: CrmCustomer, newStatus: CrmCustomer['followup_status']) => {
    const updatedList = customers.map((c) => {
      if (c.id === cust.id) {
        return { ...c, followup_status: newStatus };
      }
      return c;
    });

    setCustomers(updatedList);
    saveHostingerDbData('fsc_vps_crm_customers', updatedList);

    addToast(
      'info',
      isBn ? 'স্ট্যাটাস আপডেট সফল' : 'Status Shifted',
      isBn ? `${cust.name}-এর ক্যাটাগরি আপডেট করা হয়েছে` : `${cust.name} moved to ${newStatus}`
    );
  };

  // Filtered List based on Search, Country Sheet Tab & Executive Filter
  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.notes && c.notes.toLowerCase().includes(q));
    const matchesCountry = selectedCountryTab === 'ALL' || c.country_category === selectedCountryTab;
    const matchesExec = executiveFilter === 'all' || c.created_by === executiveFilter;
    return matchesSearch && matchesCountry && matchesExec;
  });

  // Category Column Groups
  const followupGroup = filteredCustomers.filter((c) => c.followup_status === 'followup');
  const orderCompleteGroup = filteredCustomers.filter((c) => c.followup_status === 'order_complete');
  const regularGroup = filteredCustomers.filter((c) => c.followup_status === 'important_regular');

  // Performance Leaderboard Calculation per Executive
  const executiveStatsMap = new Map<string, { total: number; handedOver: number; orderComplete: number }>();
  customers.forEach((c) => {
    const execName = c.created_by || 'Executive';
    const current = executiveStatsMap.get(execName) || { total: 0, handedOver: 0, orderComplete: 0 };
    current.total += 1;
    if (c.is_handed_over) current.handedOver += 1;
    if (c.followup_status === 'order_complete') current.orderComplete += 1;
    executiveStatsMap.set(execName, current);
  });

  const executiveStatsList = Array.from(executiveStatsMap.entries()).map(([name, stats]) => ({
    name,
    ...stats,
  }));

  const uniqueExecutives = Array.from(new Set(customers.map((c) => c.created_by).filter(Boolean)));

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans font-light">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Action Header */}
      <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800">
        <div className="flex items-center space-x-2.5">
          <Users className="w-5 h-5 text-[#00897B]" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {isBn ? 'কাস্টমার রিলেশনশিপ অনবোর্ডিং, ফলোআপ ও হ্যান্ড ওভার ড্যাশবোর্ড' : 'Customer Onboarding, Follow-up & Handover Hub'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="py-2.5 px-4.5 rounded-xl bg-[#00897B] hover:bg-[#00796B] text-white font-medium text-xs shadow-xs flex items-center space-x-2 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-white" />
          <span>{isBn ? '+ নতুন কাস্টমার তৈরি করুন' : '+ Create New Customer'}</span>
        </button>
      </div>

      {/* Executive Performance Leaderboard (Light Balanced Colors) */}
      <div className={`border rounded-2xl p-5 shadow-2xs space-y-4 transition-colors ${
        isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-800'
      }`}>
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-2">
            <Award className="w-4 h-4 text-amber-500" />
            <span>{isBn ? '📊 এক্সিকিউটিভ পারফরম্যান্স ও হ্যান্ড ওভার ওভারভিউ' : 'Executive Performance & Handover Overview'}</span>
          </h3>
          <span className="text-xs text-slate-500 font-normal">
            {isBn ? `মোট কাস্টমার: ${customers.length} জন` : `Total Onboarded: ${customers.length}`}
          </span>
        </div>

        {/* 4 Light Harmonious Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className={`p-3.5 border rounded-xl transition-all ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950'
          }`}>
            <p className="text-xs text-emerald-800 dark:text-emerald-400 font-medium">{isBn ? 'মোট অনবোর্ড কাস্টমার' : 'Total Onboarded'}</p>
            <p className="text-xl font-mono font-semibold text-emerald-700 dark:text-emerald-300 mt-1">{customers.length} <span className="text-xs font-normal">জন</span></p>
          </div>

          <div className={`p-3.5 border rounded-xl transition-all ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-rose-50/60 border-rose-200/80 text-rose-950'
          }`}>
            <p className="text-xs text-rose-800 dark:text-rose-400 font-medium">{isBn ? '🔴 ফলোআপ কাস্টমার' : 'Follow Up Pipeline'}</p>
            <p className="text-xl font-mono font-semibold text-rose-600 dark:text-rose-300 mt-1">{customers.filter(c => c.followup_status === 'followup').length} <span className="text-xs font-normal">জন</span></p>
          </div>

          <div className={`p-3.5 border rounded-xl transition-all ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-blue-50/60 border-blue-200/80 text-blue-950'
          }`}>
            <p className="text-xs text-blue-800 dark:text-blue-400 font-medium">{isBn ? '🔵 অর্ডার কমপ্লিট' : 'Order Complete'}</p>
            <p className="text-xl font-mono font-semibold text-blue-600 dark:text-blue-300 mt-1">{customers.filter(c => c.followup_status === 'order_complete').length} <span className="text-xs font-normal">জন</span></p>
          </div>

          <div className={`p-3.5 border rounded-xl transition-all ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-teal-50/60 border-teal-200/80 text-teal-950'
          }`}>
            <p className="text-xs text-teal-800 dark:text-teal-400 font-medium">{isBn ? '🤝 হ্যান্ড ওভার সম্পন্ন' : 'Handed Over'}</p>
            <p className="text-xl font-mono font-semibold text-teal-700 dark:text-teal-300 mt-1">{customers.filter(c => c.is_handed_over).length} <span className="text-xs font-normal">জন</span></p>
          </div>
        </div>

        {/* Executive Table */}
        {executiveStatsList.length > 0 && (
          <div className="overflow-x-auto pt-1">
            <table className="w-full text-xs text-left">
              <thead className={`border-b ${isDark ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-slate-100/90 border-slate-200/80 text-slate-700'}`}>
                <tr>
                  <th className="py-2.5 px-3 font-medium">{isBn ? 'সিআরএম এক্সিকিউটিভ (CRM Executive)' : 'Executive Name'}</th>
                  <th className="py-2.5 px-3 font-medium">{isBn ? 'মোট তৈরি কাস্টমার' : 'Total Created'}</th>
                  <th className="py-2.5 px-3 font-medium">{isBn ? 'অর্ডার কমপ্লিট' : 'Order Complete'}</th>
                  <th className="py-2.5 px-3 font-medium">{isBn ? 'হ্যান্ড ওভার সম্পন্ন' : 'Handed Over'}</th>
                  <th className="py-2.5 px-3 font-medium">{isBn ? 'কনভার্সন রেট' : 'Conversion'}</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {executiveStatsList.map((st, idx) => {
                  const convRate = st.total > 0 ? ((st.handedOver / st.total) * 100).toFixed(0) : '0';
                  return (
                    <tr key={idx} className={isDark ? 'hover:bg-slate-900/40' : 'hover:bg-slate-50/80'}>
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-[#00897B]/15 text-[#00897B] text-[10px] flex items-center justify-center font-mono font-semibold">{idx + 1}</span>
                        <span>{st.name}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-800 dark:text-slate-200">{st.total} জন</td>
                      <td className="py-2.5 px-3 font-mono text-blue-600 dark:text-blue-400 font-medium">{st.orderComplete} জন</td>
                      <td className="py-2.5 px-3 font-mono text-teal-700 dark:text-teal-400 font-medium">
                        🤝 {st.handedOver} জন
                      </td>
                      <td className="py-2.5 px-3 font-mono text-teal-700 dark:text-teal-400 font-medium">
                        {convRate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Country Sheet Tabs Bar & Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 border-b pb-3.5 dark:border-slate-800">
        {/* Country Sheet Tabs (Matching Google Sheet Style Tabs) */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'ALL', label: isBn ? 'সব কান্ট্রি (All)' : 'ALL' },
            { id: 'CN_Old', label: 'CHINA Old' },
            { id: 'KR_Old', label: 'Korea Old' },
            { id: 'CN_New', label: 'CN New' },
            { id: 'KR_New', label: 'KR New' },
            { id: 'JP_New', label: 'JP New' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCountryTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                selectedCountryTab === tab.id
                  ? 'bg-slate-900 text-white font-medium dark:bg-teal-600 shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-normal dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Executive Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? 'নাম বা ফোন নম্বর দিয়ে খুঁজুন...' : 'Search name or phone...'}
              className={`pl-9 pr-3.5 py-2 border rounded-xl text-xs outline-none transition-all ${
                isDark ? 'bg-[#1E293B] border-slate-700 text-white focus:border-[#00897B]' : 'bg-white border-slate-200 text-slate-800 focus:border-[#00897B]'
              }`}
            />
          </div>

          <select
            value={executiveFilter}
            onChange={(e) => setExecutiveFilter(e.target.value)}
            className={`py-2 px-3 border rounded-xl text-xs outline-none cursor-pointer transition-all ${
              isDark ? 'bg-[#1E293B] border-slate-700 text-white focus:border-[#00897B]' : 'bg-white border-slate-200 text-slate-800 focus:border-[#00897B]'
            }`}
          >
            <option value="all">{isBn ? 'সকল এক্সিকিউটিভ' : 'All Executives'}</option>
            {uniqueExecutives.map((exec, idx) => (
              <option key={idx} value={exec}>{exec}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 3-COLUMN BOARD LAYOUT WITH CRISP ELEGANT LIGHT THEMING */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* COLUMN 1: Follow Up Customer (Rose Header) */}
        <div className={`border rounded-2xl shadow-2xs overflow-hidden flex flex-col transition-colors ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-rose-50/30 border-rose-200/80'
        }`}>
          <div className="bg-[#EF4444] text-white px-4 py-3 font-medium text-xs uppercase tracking-wider flex items-center justify-between rounded-t-2xl">
            <span className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-white" />
              <span>Follow Up Customer</span>
            </span>
            <span className="bg-white/20 px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold">
              {followupGroup.length}
            </span>
          </div>

          <div className="p-3.5 space-y-3 flex-1 overflow-y-auto max-h-[650px]">
            {followupGroup.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10 font-normal">{isBn ? 'কোনো ফলোআপ কাস্টমার নেই' : 'No follow-up customers'}</p>
            ) : (
              followupGroup.map((cust) => (
                <CustomerCard
                  key={cust.id}
                  customer={cust}
                  isBn={isBn}
                  isDark={isDark}
                  onHandover={() => handleHandoverCustomer(cust)}
                  onShiftStatus={(st) => handleShiftStatus(cust, st)}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: New / Order Complete (Blue Header) */}
        <div className={`border rounded-2xl shadow-2xs overflow-hidden flex flex-col transition-colors ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-blue-50/30 border-blue-200/80'
        }`}>
          <div className="bg-[#2563EB] text-white px-4 py-3 font-medium text-xs uppercase tracking-wider flex items-center justify-between rounded-t-2xl">
            <span className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>New / Order Complete</span>
            </span>
            <span className="bg-white/20 px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold">
              {orderCompleteGroup.length}
            </span>
          </div>

          <div className="p-3.5 space-y-3 flex-1 overflow-y-auto max-h-[650px]">
            {orderCompleteGroup.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10 font-normal">{isBn ? 'কোনো অর্ডার কমপ্লিট কাস্টমার নেই' : 'No order complete customers'}</p>
            ) : (
              orderCompleteGroup.map((cust) => (
                <CustomerCard
                  key={cust.id}
                  customer={cust}
                  isBn={isBn}
                  isDark={isDark}
                  onHandover={() => handleHandoverCustomer(cust)}
                  onShiftStatus={(st) => handleShiftStatus(cust, st)}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUMN 3: Important / Regular (Dark Slate Header) */}
        <div className={`border rounded-2xl shadow-2xs overflow-hidden flex flex-col transition-colors ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-100/60 border-slate-200/90'
        }`}>
          <div className="bg-[#334155] text-white px-4 py-3 font-medium text-xs uppercase tracking-wider flex items-center justify-between rounded-t-2xl">
            <span className="flex items-center space-x-2">
              <Star className="w-4 h-4 text-amber-300" />
              <span>Important / Regular</span>
            </span>
            <span className="bg-white/20 px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold">
              {regularGroup.length}
            </span>
          </div>

          <div className="p-3.5 space-y-3 flex-1 overflow-y-auto max-h-[650px]">
            {regularGroup.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10 font-normal">{isBn ? 'কোনো ইম্পরট্যান্ট/রেগুলার কাস্টমার নেই' : 'No regular customers'}</p>
            ) : (
              regularGroup.map((cust) => (
                <CustomerCard
                  key={cust.id}
                  customer={cust}
                  isBn={isBn}
                  isDark={isDark}
                  onHandover={() => handleHandoverCustomer(cust)}
                  onShiftStatus={(st) => handleShiftStatus(cust, st)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* CREATE NEW CUSTOMER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md border rounded-2xl p-6 shadow-2xl space-y-4 ${
            isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-[#00897B]" />
                <span>{isBn ? 'নতুন কাস্টমার অনবোর্ড করুন' : 'Add New CRM Customer'}</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs text-slate-600 dark:text-slate-300 font-medium block">{isBn ? 'কাস্টমারের নাম (Name) *' : 'Customer Name *'}</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Masuka Begum"
                  className={`w-full border rounded-xl py-2.5 px-3.5 text-xs outline-none transition-all ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-[#00897B] focus:bg-white'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-600 dark:text-slate-300 font-medium block">{isBn ? 'ফোন নম্বর (Phone Number) *' : 'Phone Number *'}</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01828661711"
                  className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-mono outline-none transition-all ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-[#00897B] focus:bg-white'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-600 dark:text-slate-300 font-medium block">{isBn ? 'কান্ট্রি ক্যাটাগরি' : 'Country Sheet'}</label>
                  <select
                    value={countryCategory}
                    onChange={(e) => setCountryCategory(e.target.value as any)}
                    className={`w-full border rounded-xl py-2.5 px-3 text-xs outline-none cursor-pointer ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white'
                    }`}
                  >
                    <option value="CN_New">CN New</option>
                    <option value="CN_Old">CHINA Old</option>
                    <option value="KR_New">KR New</option>
                    <option value="KR_Old">Korea Old</option>
                    <option value="JP_New">JP New</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-600 dark:text-slate-300 font-medium block">{isBn ? 'ইনপুট স্ট্যাটাস' : 'Column Status'}</label>
                  <select
                    value={followupStatus}
                    onChange={(e) => setFollowupStatus(e.target.value as any)}
                    className={`w-full border rounded-xl py-2.5 px-3 text-xs outline-none cursor-pointer ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white'
                    }`}
                  >
                    <option value="followup">🔴 Follow Up Customer</option>
                    <option value="order_complete">🔵 New / Order Complete</option>
                    <option value="important_regular">⚫ Important / Regular</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-600 dark:text-slate-300 font-medium block">{isBn ? 'নোট বা মন্তব্য' : 'Notes / Inquiry'}</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Inquired about air freight rates..."
                  className={`w-full border rounded-xl py-2.5 px-3.5 text-xs outline-none transition-all ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-[#00897B] focus:bg-white'
                  }`}
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-2 px-4 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl bg-[#00897B] hover:bg-[#00796B] text-white font-medium text-xs shadow-xs cursor-pointer"
                >
                  {isBn ? 'কাস্টমার সেভ করুন' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-Component for Individual Customer Cards (Clean Soft Light Design)
interface CustomerCardProps {
  customer: CrmCustomer;
  isBn: boolean;
  isDark: boolean;
  onHandover: () => void;
  onShiftStatus: (newStatus: CrmCustomer['followup_status']) => void;
}

const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  isBn,
  isDark,
  onHandover,
  onShiftStatus,
}) => {
  return (
    <div className={`p-3.5 border rounded-xl shadow-2xs space-y-2.5 transition-all ${
      isDark ? 'bg-[#1E293B] border-slate-700/80 text-white' : 'bg-white border-slate-200/90 hover:border-slate-300'
    }`}>
      {/* Customer Name & Phone */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold text-slate-800 dark:text-white leading-tight">{customer.name}</h4>
          <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 mt-1 flex items-center space-x-1 font-medium">
            <Phone className="w-3 h-3" />
            <span>{customer.phone}</span>
          </p>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md border border-slate-200/60 dark:border-slate-700">
          {customer.date || '15.08.26'}
        </span>
      </div>

      {/* Sheet Category & Creator Tag */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-medium rounded-md border border-slate-200 dark:border-slate-700">
          🏷️ {customer.country_category}
        </span>
        <span className="text-slate-500 dark:text-slate-400 font-normal truncate">
          👤 {customer.created_by}
        </span>
      </div>

      {/* Notes (Crisp Light Pastel Background - NO BLACK!) */}
      {customer.notes && (
        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-normal bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-800 leading-relaxed">
          {customer.notes}
        </p>
      )}

      {/* Hand Over Button & Status Shift Bar */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        {/* Hand Over Action Button */}
        {customer.is_handed_over ? (
          <span className="px-2.5 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isBn ? 'হ্যান্ড ওভার সম্পন্ন' : 'Handed Over'}</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={onHandover}
            className="py-1.5 px-3 bg-[#00897B] hover:bg-[#00796B] text-white text-[11px] font-medium rounded-lg shadow-2xs flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Send className="w-3 h-3 text-white" />
            <span>{isBn ? '🤝 হ্যান্ড ওভার' : '🤝 Hand Over'}</span>
          </button>
        )}

        {/* Quick Shift Dropdown */}
        <select
          value={customer.followup_status}
          onChange={(e) => onShiftStatus(e.target.value as any)}
          className={`py-1 px-2 border rounded-lg text-[10px] font-normal outline-none cursor-pointer transition-colors ${
            isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <option value="followup">🔴 Follow Up</option>
          <option value="order_complete">🔵 Complete</option>
          <option value="important_regular">⚫ Regular</option>
        </select>
      </div>
    </div>
  );
};
