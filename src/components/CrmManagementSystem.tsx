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
  Plus,
} from 'lucide-react';
import { CrmCustomer, User, Language, Theme } from '../types';
import { getHostingerDbData, saveHostingerDbData, subscribeToDbUpdates, logSystemAuditAction } from '../lib/db';
import { useTheme } from '../context/ThemeContext';
import { ToastContainer, ToastMessage } from './Toast';

export type CrmStageTab = 'followup' | 'order_complete' | 'important_regular';

interface CrmManagementSystemProps {
  currentUser: User;
  language: Language;
  theme?: Theme;
  initialStageTab?: CrmStageTab;
}

export const CrmManagementSystem: React.FC<CrmManagementSystemProps> = ({
  currentUser,
  language = 'bn',
  theme: themeProp,
  initialStageTab = 'followup',
}) => {
  const isBn = language === 'bn';
  const { theme: contextTheme } = useTheme();
  const activeTheme = contextTheme || themeProp || 'light';
  const isDark = activeTheme === 'dark';

  // Active Stage Tab synced with prop from main sidebar selection
  const [activeStageTab, setActiveStageTab] = useState<CrmStageTab>(initialStageTab);

  useEffect(() => {
    if (initialStageTab) {
      setActiveStageTab(initialStageTab);
    }
  }, [initialStageTab]);

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

  // Customer Entry Form States (Top Direct Form)
  const [showAddForm, setShowAddForm] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCategory, setCountryCategory] = useState<CrmCustomer['country_category']>('CN_New');
  const [initialCategory, setInitialCategory] = useState<CrmStageTab>('followup');
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
      followup_status: initialCategory,
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

    const categoryLabel =
      initialCategory === 'followup'
        ? 'ফলো আপ'
        : initialCategory === 'order_complete'
        ? 'নতুন কাস্টমার'
        : 'রেগুলার কাস্টমার';

    addToast(
      'success',
      isBn ? 'কাস্টমার এন্ট্রি সফল!' : 'Customer Added Successfully!',
      isBn ? `${newCust.name} (${categoryLabel}) তালিকায় অনবোর্ড হয়েছে` : `${newCust.name} onboarded to ${categoryLabel}`
    );

    // Switch view to match newly created category tab
    setActiveStageTab(initialCategory);

    setName('');
    setPhone('');
    setNotes('');
  };

  // Stage 1 -> Stage 2: Convert Followup -> New Customer
  const handleConvertToNewCustomer = (cust: CrmCustomer) => {
    const updatedList = customers.map((c) => {
      if (c.id === cust.id) {
        return { ...c, followup_status: 'order_complete' as const };
      }
      return c;
    });

    setCustomers(updatedList);
    saveHostingerDbData('fsc_vps_crm_customers', updatedList);

    logSystemAuditAction(
      currentUser,
      'CONVERT_TO_NEW_CUSTOMER',
      'crm',
      cust.id,
      `${cust.name} কাস্টমার থেকে 'নতুন কাস্টমার' তালিকায় স্থানান্তরিত করা হয়েছে`
    );

    addToast(
      'success',
      isBn ? 'নতুন কাস্টমারে রূপান্তর সম্পন্ন!' : 'Converted to New Customer!',
      isBn ? `${cust.name} এখন 'নতুন কাস্টমার' তালিকায় স্থানান্তরিত হয়েছে` : `${cust.name} moved to New Customer stage`
    );
  };

  // Stage 2 -> Stage 3: Convert New Customer -> Regular Customer
  const handleConvertToRegularCustomer = (cust: CrmCustomer) => {
    const updatedList = customers.map((c) => {
      if (c.id === cust.id) {
        return { ...c, followup_status: 'important_regular' as const };
      }
      return c;
    });

    setCustomers(updatedList);
    saveHostingerDbData('fsc_vps_crm_customers', updatedList);

    logSystemAuditAction(
      currentUser,
      'CONVERT_TO_REGULAR_CUSTOMER',
      'crm',
      cust.id,
      `${cust.name} কাস্টমার থেকে 'রেগুলার কাস্টমার' তালিকায় স্থানান্তরিত করা হয়েছে`
    );

    addToast(
      'success',
      isBn ? 'রেগুলার কাস্টমারে রূপান্তর সম্পন্ন!' : 'Converted to Regular Customer!',
      isBn ? `${cust.name} এখন 'রেগুলার কাস্টমার' তালিকায় যুক্ত হয়েছে` : `${cust.name} moved to Regular Customer stage`
    );
  };

  // Stage 3 Only: Hand Over Regular Customer
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
      `রেগুলার কাস্টমার ${cust.name} অপারেশনে সফলভাবে হ্যান্ড ওভার করা হয়েছে (${currentUser.name})`
    );

    addToast(
      'success',
      isBn ? '🤝 কাস্টমার হ্যান্ড ওভার সম্পন্ন!' : '🤝 Customer Handed Over!',
      isBn ? `${cust.name} কাস্টমার সফলভাবে অপারেশনে হ্যান্ড ওভার করা হয়েছে` : `${cust.name} handed over successfully to operations`
    );
  };

  // Stage Groups Calculation
  const followupCustomers = customers.filter((c) => c.followup_status === 'followup');
  const newCustomers = customers.filter((c) => c.followup_status === 'order_complete');
  const regularCustomers = customers.filter((c) => c.followup_status === 'important_regular');

  // Filtered List for Current Selected Stage Tab
  const targetStageList =
    activeStageTab === 'followup'
      ? followupCustomers
      : activeStageTab === 'order_complete'
      ? newCustomers
      : regularCustomers;

  const filteredCustomers = targetStageList.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.notes && c.notes.toLowerCase().includes(q));
    const matchesCountry = selectedCountryTab === 'ALL' || c.country_category === selectedCountryTab;
    const matchesExec = executiveFilter === 'all' || c.created_by === executiveFilter;
    return matchesSearch && matchesCountry && matchesExec;
  });

  // Performance Leaderboard Calculation per Executive
  const executiveStatsMap = new Map<string, { total: number; handedOver: number; orderComplete: number; regular: number }>();
  customers.forEach((c) => {
    const execName = c.created_by || 'Executive';
    const current = executiveStatsMap.get(execName) || { total: 0, handedOver: 0, orderComplete: 0, regular: 0 };
    current.total += 1;
    if (c.is_handed_over) current.handedOver += 1;
    if (c.followup_status === 'order_complete') current.orderComplete += 1;
    if (c.followup_status === 'important_regular') current.regular += 1;
    executiveStatsMap.set(execName, current);
  });

  const executiveStatsList = Array.from(executiveStatsMap.entries()).map(([name, stats]) => ({
    name,
    ...stats,
  }));

  const uniqueExecutives = Array.from(new Set(customers.map((c) => c.created_by).filter(Boolean)));

  return (
    <div className="space-y-5 max-w-7xl mx-auto font-sans font-light">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 1. CUSTOMER CREATION / ONBOARDING PANEL (DIRECT TOP FORM AS REQUESTED) */}
      <div className={`border rounded-xl p-4.5 shadow-2xs space-y-3.5 transition-all ${
        isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-800'
      }`}>
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-4 h-4 text-[#00897B]" />
            <h3 className="text-xs font-normal text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              {isBn ? 'নতুন কাস্টমার এন্ট্রি ও ক্যাটাগরি সেটিং' : 'Create New Customer & Assign Category'}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs text-[#00897B] font-light hover:underline cursor-pointer flex items-center space-x-1"
          >
            <span>{showAddForm ? (isBn ? 'ফর্ম লোকান' : 'Hide Form') : (isBn ? '+ ফর্ম খুলুন' : '+ Show Form')}</span>
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleCreateCustomer} className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Customer Name */}
              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 font-light block">
                  {isBn ? 'কাস্টমারের নাম (Name) *' : 'Customer Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Masuka Begum"
                  className={`w-full border rounded-lg py-2 px-3 text-xs font-light outline-none transition-all ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-slate-50/70 border-slate-200 text-slate-800 focus:border-[#00897B] focus:bg-white'
                  }`}
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 font-light block">
                  {isBn ? 'ফোন নম্বর (Phone Number) *' : 'Phone Number *'}
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01828661711"
                  className={`w-full border rounded-lg py-2 px-3 text-xs font-mono font-light outline-none transition-all ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-slate-50/70 border-slate-200 text-slate-800 focus:border-[#00897B] focus:bg-white'
                  }`}
                />
              </div>

              {/* Country Sheet Category */}
              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 font-light block">
                  {isBn ? 'কান্ট্রি ক্যাটাগরি (Country Sheet)' : 'Country Category'}
                </label>
                <select
                  value={countryCategory}
                  onChange={(e) => setCountryCategory(e.target.value as any)}
                  className={`w-full border rounded-lg py-2 px-2.5 text-xs font-light outline-none cursor-pointer ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50/70 border-slate-200 text-slate-800 focus:bg-white'
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

              {/* Initial Stage Category Selection Dropdown (AS EXPLICITLY REQUESTED) */}
              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 font-light block">
                  {isBn ? 'কাস্টমার প্রাথমিক ক্যাটাগরি (Stage) *' : 'Initial Customer Category *'}
                </label>
                <select
                  value={initialCategory}
                  onChange={(e) => setInitialCategory(e.target.value as any)}
                  className={`w-full border rounded-lg py-2 px-2.5 text-xs font-light outline-none cursor-pointer ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50/70 border-slate-200 text-slate-800 focus:bg-white'
                  }`}
                >
                  <option value="followup">🔴 ফলো আপ কাস্টমার (Follow Up)</option>
                  <option value="order_complete">🔵 নতুন কাস্টমার (New Customer)</option>
                  <option value="important_regular">⚫ রেগুলার কাস্টমার (Regular Customer)</option>
                </select>
              </div>
            </div>

            {/* Notes / Inquiry & Submit Button */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-1">
              <div className="md:col-span-9 space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 font-light block">
                  {isBn ? 'নোট বা ইনকোয়ারি তথ্য (Notes)' : 'Inquiry / Notes'}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Air freight rates asked for 200kg garment accessories..."
                  className={`w-full border rounded-lg py-2 px-3 text-xs font-light outline-none transition-all ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-slate-50/70 border-slate-200 text-slate-800 focus:border-[#00897B] focus:bg-white'
                  }`}
                />
              </div>

              <div className="md:col-span-3">
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg bg-[#00897B] hover:bg-[#00796B] text-white font-normal text-xs shadow-2xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>{isBn ? 'কাস্টমার সেভ করুন' : 'Save Customer'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* 2. EXECUTIVE PERFORMANCE LEADERBOARD (LIGHT CLEAN STYLING) */}
      <div className={`border rounded-xl p-4 shadow-2xs space-y-3 ${
        isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-800'
      }`}>
        <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800">
          <h3 className="text-xs font-normal text-slate-600 dark:text-slate-300 flex items-center space-x-2">
            <Award className="w-4 h-4 text-amber-500" />
            <span>{isBn ? '📊 সিআরএম অনবোর্ডার পারফরম্যান্স ওভারভিউ' : 'CRM Performance Overview'}</span>
          </h3>
          <span className="text-xs text-slate-500 font-light">
            {isBn ? `মোট কাস্টমার: ${customers.length} জন` : `Total Onboarded: ${customers.length}`}
          </span>
        </div>

        {executiveStatsList.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-light">
              <thead className={`border-b ${isDark ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-slate-100/70 border-slate-200 text-slate-600'}`}>
                <tr>
                  <th className="py-2 px-3 font-normal">{isBn ? 'সিআরএম এক্সিকিউটিভ' : 'Executive'}</th>
                  <th className="py-2 px-3 font-normal">{isBn ? 'মোট তৈরি' : 'Total Created'}</th>
                  <th className="py-2 px-3 font-normal">{isBn ? '🔴 ফলোআপ' : 'Followup'}</th>
                  <th className="py-2 px-3 font-normal">{isBn ? '🔵 নতুন কাস্টমার' : 'New Customer'}</th>
                  <th className="py-2 px-3 font-normal">{isBn ? '⚫ রেগুলার কাস্টমার' : 'Regular Customer'}</th>
                  <th className="py-2 px-3 font-normal">{isBn ? '🤝 হ্যান্ড ওভার সম্পন্ন' : 'Handed Over'}</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {executiveStatsList.map((st, idx) => (
                  <tr key={idx} className={isDark ? 'hover:bg-slate-900/40' : 'hover:bg-slate-50/60'}>
                    <td className="py-2 px-3 font-normal text-slate-700 dark:text-slate-200 flex items-center space-x-2">
                      <span className="w-4 h-4 rounded-full bg-[#00897B]/15 text-[#00897B] text-[10px] flex items-center justify-center font-mono">{idx + 1}</span>
                      <span>{st.name}</span>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-200">{st.total} জন</td>
                    <td className="py-2 px-3 font-mono text-rose-600 dark:text-rose-400">{st.total - st.orderComplete - st.regular} জন</td>
                    <td className="py-2 px-3 font-mono text-blue-600 dark:text-blue-400">{st.orderComplete} জন</td>
                    <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">{st.regular} জন</td>
                    <td className="py-2 px-3 font-mono text-teal-600 dark:text-teal-400">
                      🤝 {st.handedOver} জন
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. FULL WIDTH CUSTOMER DETAILS TABLE VIEW (LIGHT ELEGANT STYLING) */}
      <div className="space-y-3.5 w-full">
        {/* Active Section Info & Filter Bar */}
        <div className={`border rounded-xl p-4 shadow-2xs space-y-3 ${
          isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-800'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 dark:border-slate-800">
            <div className="flex items-center space-x-2.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs ${
                activeStageTab === 'followup' ? 'bg-rose-500' : activeStageTab === 'order_complete' ? 'bg-blue-600' : 'bg-slate-700'
              }`}>
                {activeStageTab === 'followup' && '🔴'}
                {activeStageTab === 'order_complete' && '🔵'}
                {activeStageTab === 'important_regular' && '⚫'}
              </div>
              <div>
                <h3 className="text-xs font-normal text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                  <span>
                    {activeStageTab === 'followup' && (isBn ? '🔴 ফলো আপ কাস্টমার ডাটা টেবিল (Follow-Up)' : 'Follow-Up Customer Table')}
                    {activeStageTab === 'order_complete' && (isBn ? '🔵 নতুন কাস্টমার ডাটা টেবিল (New Customer)' : 'New Customer Table')}
                    {activeStageTab === 'important_regular' && (isBn ? '⚫ রেগুলার কাস্টমার ডাটা টেবিল (Regular Customer)' : 'Regular Customer Table')}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 font-light mt-0.5">
                  {activeStageTab === 'followup' && (isBn ? 'ফলো আপ থেকে পরবর্তীতে "নতুন কাস্টমারে" কনভার্ট করা যাবে' : 'Convert to New Customer upon booking')}
                  {activeStageTab === 'order_complete' && (isBn ? 'নতুন কাস্টমার থেকে পরবর্তীতে "রেগুলার কাস্টমারে" কনভার্ট করা যাবে' : 'Convert to Regular Customer upon repeat bookings')}
                  {activeStageTab === 'important_regular' && (isBn ? 'শুধুমাত্র এখান থেকেই অপারেশনে হ্যান্ড ওভার সম্পন্ন করা যাবে' : 'Handover to operations allowed here only')}
                </p>
              </div>
            </div>

            <span className="text-xs font-mono px-3 py-1 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200/80 dark:border-slate-700 font-light self-start sm:self-auto">
              {filteredCustomers.length} জন কাস্টমার
            </span>
          </div>

          {/* Country Sheet Filter Tabs & Search Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-0.5">
            {/* Country Sheet Tabs */}
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
                  className={`px-3 py-1 rounded-lg text-xs font-light transition-all cursor-pointer ${
                    selectedCountryTab === tab.id
                      ? 'bg-slate-800 text-white dark:bg-teal-600 shadow-2xs'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search & Executive Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isBn ? 'নাম বা ফোন নম্বর...' : 'Search name/phone...'}
                  className={`pl-8 pr-3 py-1.5 border rounded-lg text-xs font-light outline-none transition-all ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-slate-50/70 border-slate-200 text-slate-800 focus:border-[#00897B] focus:bg-white'
                  }`}
                />
              </div>

              <select
                value={executiveFilter}
                onChange={(e) => setExecutiveFilter(e.target.value)}
                className={`py-1.5 px-2.5 border rounded-lg text-xs font-light outline-none cursor-pointer ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-slate-50/70 border-slate-200 text-slate-800 focus:border-[#00897B]'
                }`}
              >
                <option value="all">{isBn ? 'সকল এক্সিকিউটিভ' : 'All Executives'}</option>
                {uniqueExecutives.map((exec, idx) => (
                  <option key={idx} value={exec}>{exec}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* DETAILED CUSTOMER DATA TABLE (ALL LIGHT FONTS) */}
        <div className={`border rounded-xl shadow-2xs overflow-hidden ${
          isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-800'
        }`}>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-14 px-4">
              <Users className="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <h4 className="text-xs font-normal text-slate-600 dark:text-slate-400">
                {isBn ? 'এই ট্যাবে কোনো কাস্টমার ডাটা পাওয়া যায়নি' : 'No customer records in this section'}
              </h4>
              <p className="text-xs text-slate-400 font-light mt-1">
                {isBn ? 'উপরে "নতুন কাস্টমার এন্ট্রি" ফর্মে তথ্য লিখে কাস্টমার যুক্ত করুন' : 'Use the form above to onboard new clients'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse font-light">
                <thead className={`border-b ${isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-slate-100/80 border-slate-200 text-slate-600'}`}>
                  <tr>
                    <th className="py-2.5 px-3.5 font-normal">#</th>
                    <th className="py-2.5 px-3.5 font-normal">{isBn ? 'কাস্টমার নাম ও ফোন' : 'Customer & Phone'}</th>
                    <th className="py-2.5 px-3.5 font-normal">{isBn ? 'অনবোর্ডিং ক্যাটাগরি' : 'Sheet Category'}</th>
                    <th className="py-2.5 px-3.5 font-normal">{isBn ? 'ইনকোয়ারি নোটস' : 'Inquiry Notes'}</th>
                    <th className="py-2.5 px-3.5 font-normal">{isBn ? 'অনবোর্ডার এক্সিকিউটিভ' : 'CRM Executive'}</th>
                    <th className="py-2.5 px-3.5 font-normal text-right">{isBn ? 'স্টেজ রূপান্তর ও হ্যান্ড ওভার' : 'Action / Handover'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-slate-100 dark:divide-slate-800">
                  {filteredCustomers.map((cust, idx) => (
                    <tr key={cust.id} className={isDark ? 'hover:bg-slate-900/40 transition-colors' : 'hover:bg-slate-50/60 transition-colors'}>
                      <td className="py-3 px-3.5 font-mono text-slate-400 font-light">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3.5">
                        <p className="font-normal text-slate-800 dark:text-white text-xs">{cust.name}</p>
                        <p className="text-[11px] font-mono text-teal-600 dark:text-teal-400 font-light flex items-center space-x-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          <span>{cust.phone}</span>
                        </p>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-light rounded-md border border-slate-200/80 dark:border-slate-700 text-[11px]">
                          🏷️ {cust.country_category}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 max-w-xs">
                        {cust.notes ? (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 font-light bg-slate-50/80 dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800 leading-relaxed truncate">
                            {cust.notes}
                          </p>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">নির্ধারিত নোট নেই</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300 font-light">
                        <p className="flex items-center space-x-1">
                          <span>👤</span>
                          <span>{cust.created_by}</span>
                        </p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">{cust.date || '15.08.26'}</p>
                      </td>
                      <td className="py-3 px-3.5 text-right font-light">
                        {/* STAGE 1: FOLLOW UP -> CONVERT TO NEW CUSTOMER */}
                        {cust.followup_status === 'followup' && (
                          <button
                            type="button"
                            onClick={() => handleConvertToNewCustomer(cust)}
                            className="py-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-normal rounded-md shadow-2xs inline-flex items-center space-x-1 transition-all cursor-pointer"
                          >
                            <span>{isBn ? '➔ কনভার্ট টু কাস্টমার' : '➔ Convert to New Customer'}</span>
                          </button>
                        )}

                        {/* STAGE 2: NEW CUSTOMER -> CONVERT TO REGULAR CUSTOMER */}
                        {cust.followup_status === 'order_complete' && (
                          <button
                            type="button"
                            onClick={() => handleConvertToRegularCustomer(cust)}
                            className="py-1 px-2.5 bg-slate-700 hover:bg-slate-800 text-white text-[11px] font-normal rounded-md shadow-2xs inline-flex items-center space-x-1 transition-all cursor-pointer"
                          >
                            <span>{isBn ? '➔ কনভার্ট টু রেগুলার' : '➔ Convert to Regular'}</span>
                          </button>
                        )}

                        {/* STAGE 3: REGULAR CUSTOMER -> HANDOVER BUTTON AVAILABLE HERE ONLY */}
                        {cust.followup_status === 'important_regular' && (
                          <div>
                            {cust.is_handed_over ? (
                              <span className="py-0.5 px-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-md border border-emerald-200 dark:border-emerald-800 text-[11px] font-light inline-flex items-center space-x-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>{isBn ? 'হ্যান্ড ওভার সম্পন্ন' : 'Handed Over'}</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleHandoverCustomer(cust)}
                                className="py-1 px-2.5 bg-[#00897B] hover:bg-[#00796B] text-white text-[11px] font-normal rounded-md shadow-2xs inline-flex items-center space-x-1 transition-all cursor-pointer"
                              >
                                <Send className="w-3 h-3 text-white" />
                                <span>{isBn ? '🤝 হ্যান্ড ওভার করুন' : '🤝 Hand Over'}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
