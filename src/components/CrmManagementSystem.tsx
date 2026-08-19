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

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCategory, setCountryCategory] = useState<CrmCustomer['country_category']>('CN_New');
  const [notes, setNotes] = useState('');

  // Handle Save New Customer (Always starts in 'followup' stage)
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const newCust: CrmCustomer = {
      id: `crm-cust-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      country_category: countryCategory,
      followup_status: 'followup',
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
      `নতুন কাস্টমার ${newCust.name} (${newCust.phone}) ফলো আপ তালিকায় যুক্ত করা হয়েছে`
    );

    addToast(
      'success',
      isBn ? 'নতুন কাস্টমার তৈরি সফল!' : 'Customer Created Successfully!',
      isBn ? `${newCust.name} ফলো আপ তালিকায় যুক্ত হয়েছে` : `${newCust.name} added to Follow-Up list`
    );

    setName('');
    setPhone('');
    setNotes('');
    setShowAddModal(false);
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
      isBn ? 'নতুন কাস্টমারে সফল রূপান্তর!' : 'Converted to New Customer!',
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
      isBn ? 'রেগুলার কাস্টমারে সফল রূপান্তর!' : 'Converted to Regular Customer!',
      isBn ? `${cust.name} এখন 'রেগুলার কাস্টমার' তালিকায় স্থানান্তরিত হয়েছে (হ্যান্ড ওভারের জন্য প্রস্তুত)` : `${cust.name} moved to Regular Customer stage`
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
    <div className="space-y-6 max-w-7xl mx-auto font-sans font-light">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Executive Performance Summary Box */}
      <div className={`border rounded-2xl p-4.5 shadow-2xs space-y-4 ${
        isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-800'
      }`}>
        <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-2">
            <Award className="w-4 h-4 text-amber-500" />
            <span>{isBn ? '📊 এক্সিকিউটিভ অনবোর্ডিং পারফরম্যান্স লিডারবোর্ড' : 'Executive Performance Leaderboard'}</span>
          </h3>
          <span className="text-xs text-slate-500 font-normal">
            {isBn ? `মোট কাস্টমার: ${customers.length} জন` : `Total Onboarded: ${customers.length}`}
          </span>
        </div>

        {/* Executive Leaderboard Summary Table */}
        {executiveStatsList.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className={`border-b ${isDark ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-slate-100/90 border-slate-200/80 text-slate-700'}`}>
                <tr>
                  <th className="py-2 px-3 font-medium">{isBn ? 'সিআরএম এক্সিকিউটিভ' : 'Executive'}</th>
                  <th className="py-2 px-3 font-medium">{isBn ? 'মোট তৈরি' : 'Total Created'}</th>
                  <th className="py-2 px-3 font-medium">{isBn ? '🔴 ফলোআপ' : 'Followup'}</th>
                  <th className="py-2 px-3 font-medium">{isBn ? '🔵 নতুন কাস্টমার' : 'New Customer'}</th>
                  <th className="py-2 px-3 font-medium">{isBn ? '⚫ রেগুলার কাস্টমার' : 'Regular Customer'}</th>
                  <th className="py-2 px-3 font-medium">{isBn ? '🤝 হ্যান্ড ওভার সম্পন্ন' : 'Handed Over'}</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {executiveStatsList.map((st, idx) => (
                  <tr key={idx} className={isDark ? 'hover:bg-slate-900/40' : 'hover:bg-slate-50/80'}>
                    <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                      <span className="w-4 h-4 rounded-full bg-[#00897B]/15 text-[#00897B] text-[10px] flex items-center justify-center font-mono font-semibold">{idx + 1}</span>
                      <span>{st.name}</span>
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-800 dark:text-slate-200">{st.total} জন</td>
                    <td className="py-2 px-3 font-mono text-rose-600 dark:text-rose-400 font-medium">{st.total - st.orderComplete - st.regular} জন</td>
                    <td className="py-2 px-3 font-mono text-blue-600 dark:text-blue-400 font-medium">{st.orderComplete} জন</td>
                    <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300 font-medium">{st.regular} জন</td>
                    <td className="py-2 px-3 font-mono text-teal-700 dark:text-teal-400 font-medium">
                      🤝 {st.handedOver} জন
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FULL WIDTH CUSTOMER DETAILS TABLE VIEW (CONTROLLED FROM MAIN SIDEBAR) */}
      <div className="space-y-4 w-full">
        {/* Stage Header Info & Country Filters */}
        <div className={`border rounded-2xl p-4.5 shadow-2xs space-y-3.5 ${
          isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-800'
        }`}>
          {/* Active Stage Indicator & Add Customer Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3.5 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-2xs ${
                activeStageTab === 'followup' ? 'bg-rose-500' : activeStageTab === 'order_complete' ? 'bg-blue-600' : 'bg-slate-700'
              }`}>
                {activeStageTab === 'followup' && '🔴'}
                {activeStageTab === 'order_complete' && '🔵'}
                {activeStageTab === 'important_regular' && '⚫'}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                  <span>
                    {activeStageTab === 'followup' && (isBn ? 'ফলো আপ কাস্টমার ড্যাশবোর্ড (Follow-Up)' : 'Follow-Up Customer Dashboard')}
                    {activeStageTab === 'order_complete' && (isBn ? 'নতুন কাস্টমার ড্যাশবোর্ড (New Customer)' : 'New Customer Dashboard')}
                    {activeStageTab === 'important_regular' && (isBn ? 'রেগুলার কাস্টমার ও হ্যান্ড ওভার হাব (Regular Customer)' : 'Regular Customer & Handover Hub')}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-light mt-0.5">
                  {activeStageTab === 'followup' && (isBn ? 'ফলো আপ থেকে কনভার্ট করে "নতুন কাস্টমার" তৈরি করা যাবে' : 'Convert to New Customer upon first order')}
                  {activeStageTab === 'order_complete' && (isBn ? 'নতুন কাস্টমার থেকে কনভার্ট করে "রেগুলার কাস্টমার" তৈরি করা যাবে' : 'Convert to Regular Customer upon repeated shipments')}
                  {activeStageTab === 'important_regular' && (isBn ? 'এখানে রেগুলার কাস্টমার হিসেবে হ্যান্ড ওভার সম্পন্ন করা যাবে' : 'Handover customer to operations management')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 self-start sm:self-auto">
              <span className="text-xs font-mono px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 font-medium">
                {filteredCustomers.length} জন কাস্টমার
              </span>

              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="py-2.5 px-4 rounded-xl bg-[#00897B] hover:bg-[#00796B] text-white font-medium text-xs shadow-xs flex items-center space-x-2 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-white" />
                <span>{isBn ? '+ নতুন কাস্টমার অনবোর্ড করুন' : '+ Onboard New Customer'}</span>
              </button>
            </div>
          </div>

          {/* Quick Stage Switch Pills & Country Sheet Filter Tabs */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
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
                  className={`px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                    selectedCountryTab === tab.id
                      ? 'bg-slate-900 text-white font-medium dark:bg-teal-600 shadow-2xs'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-normal dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search & Executive Filter */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isBn ? 'নাম বা ফোন নম্বর...' : 'Search name/phone...'}
                  className={`pl-8 pr-3.5 py-1.5 border rounded-xl text-xs outline-none transition-all ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-[#00897B] focus:bg-white'
                  }`}
                />
              </div>

              <select
                value={executiveFilter}
                onChange={(e) => setExecutiveFilter(e.target.value)}
                className={`py-1.5 px-3 border rounded-xl text-xs outline-none cursor-pointer ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-[#00897B]' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-[#00897B]'
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

        {/* DETAILED CUSTOMER TABLE VIEW */}
        <div className={`border rounded-2xl shadow-2xs overflow-hidden ${
          isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-800'
        }`}>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {isBn ? 'এই ট্যাবে কোনো কাস্টমার তথ্য পাওয়া যায়নি' : 'No customer records in this section'}
              </h4>
              <p className="text-xs text-slate-400 font-light mt-1">
                {isBn ? 'উপরের "+ নতুন কাস্টমার অনবোর্ড করুন" বাটনে ক্লিক করে তথ্য যুক্ত করুন' : 'Click "+ Onboard New Customer" above to add clients'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className={`border-b ${isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-slate-100/90 border-slate-200/90 text-slate-700'}`}>
                  <tr>
                    <th className="py-3 px-4 font-semibold">#</th>
                    <th className="py-3 px-4 font-semibold">{isBn ? 'কাস্টমার নাম ও ফোন' : 'Customer & Phone'}</th>
                    <th className="py-3 px-4 font-semibold">{isBn ? 'অনবোর্ডিং ক্যাটাগরি' : 'Sheet Category'}</th>
                    <th className="py-3 px-4 font-semibold">{isBn ? 'ইনকোয়ারি নোটস' : 'Inquiry Notes'}</th>
                    <th className="py-3 px-4 font-semibold">{isBn ? 'অনবোর্ডার এক্সিকিউটিভ' : 'CRM Executive'}</th>
                    <th className="py-3 px-4 font-semibold text-right">{isBn ? 'স্টেজ রূপান্তর ও হ্যান্ড ওভার' : 'Action / Handover'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-slate-100 dark:divide-slate-800">
                  {filteredCustomers.map((cust, idx) => (
                    <tr key={cust.id} className={isDark ? 'hover:bg-slate-900/50 transition-colors' : 'hover:bg-slate-50/70 transition-colors'}>
                      <td className="py-3.5 px-4 font-mono text-slate-400 font-normal">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800 dark:text-white text-xs">{cust.name}</p>
                        <p className="text-[11px] font-mono text-teal-700 dark:text-teal-400 font-medium flex items-center space-x-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          <span>{cust.phone}</span>
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">
                          🏷️ {cust.country_category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        {cust.notes ? (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 font-normal bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-800 leading-relaxed truncate">
                            {cust.notes}
                          </p>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">নির্ধারিত নোট নেই</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-normal">
                        <p className="flex items-center space-x-1">
                          <span>👤</span>
                          <span>{cust.created_by}</span>
                        </p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">{cust.date || '15.08.26'}</p>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {/* ACTION ACCORDING TO USER'S STAGE STACK */}
                        {/* STAGE 1: FOLLOW UP -> CONVERT TO NEW CUSTOMER */}
                        {cust.followup_status === 'followup' && (
                          <button
                            type="button"
                            onClick={() => handleConvertToNewCustomer(cust)}
                            className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-2xs inline-flex items-center space-x-1.5 transition-all cursor-pointer"
                          >
                            <span>{isBn ? '➔ কনভার্ট টু কাস্টমার' : '➔ Convert to New Customer'}</span>
                          </button>
                        )}

                        {/* STAGE 2: NEW CUSTOMER -> CONVERT TO REGULAR CUSTOMER */}
                        {cust.followup_status === 'order_complete' && (
                          <button
                            type="button"
                            onClick={() => handleConvertToRegularCustomer(cust)}
                            className="py-1.5 px-3 bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-2xs inline-flex items-center space-x-1.5 transition-all cursor-pointer"
                          >
                            <span>{isBn ? '➔ কনভার্ট টু রেগুলার' : '➔ Convert to Regular'}</span>
                          </button>
                        )}

                        {/* STAGE 3: REGULAR CUSTOMER -> HANDOVER BUTTON AVAILABLE HERE ONLY */}
                        {cust.followup_status === 'important_regular' && (
                          <div>
                            {cust.is_handed_over ? (
                              <span className="py-1 px-3 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs font-medium inline-flex items-center space-x-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{isBn ? 'হ্যান্ড ওভার সম্পন্ন' : 'Handed Over'}</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleHandoverCustomer(cust)}
                                className="py-1.5 px-3 bg-[#00897B] hover:bg-[#00796B] text-white text-xs font-medium rounded-lg shadow-2xs inline-flex items-center space-x-1.5 transition-all cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5 text-white" />
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

      {/* CREATE NEW CUSTOMER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md border rounded-2xl p-6 shadow-2xl space-y-4 ${
            isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-[#00897B]" />
                <span>{isBn ? 'নতুন কাস্টমার অনবোর্ড করুন (ফলো আপ পর্যায়)' : 'Add New Follow-Up Customer'}</span>
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

              <div className="space-y-1">
                <label className="text-xs text-slate-600 dark:text-slate-300 font-medium block">{isBn ? 'কান্ট্রি অনবোর্ডিং ক্যাটাগরি' : 'Country Sheet'}</label>
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
                <label className="text-xs text-slate-600 dark:text-slate-300 font-medium block">{isBn ? 'নোট বা ইনকোয়ারি তথ্য' : 'Notes / Inquiry'}</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Air shipping rates inquired..."
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
                  {isBn ? 'অনবোর্ড করুন (Save)' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
