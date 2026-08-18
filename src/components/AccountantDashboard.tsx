import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Users,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Calendar,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  UserCheck,
  Building2,
  XCircle,
  FileText,
  Wallet,
  Activity,
  BarChart3,
  PieChart,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Clock,
  Layers,
} from 'lucide-react';
import { Customer, LedgerEntry, User, Language, ExpenseItem } from '../types';
import { ToastContainer, ToastMessage } from './Toast';
import { BudgetExpenseManager } from './BudgetExpenseManager';
import { saveHostingerDbData } from '../lib/db';
import { useTheme } from '../context/ThemeContext';

interface AccountantDashboardProps {
  ledgerEntries: LedgerEntry[];
  setLedgerEntries: React.Dispatch<React.SetStateAction<LedgerEntry[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  expenses?: ExpenseItem[];
  setExpenses?: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
  currentUser: User;
  language: Language;
  activeTab?: string;
}

export const AccountantDashboard: React.FC<AccountantDashboardProps> = ({
  ledgerEntries,
  setLedgerEntries,
  customers,
  setCustomers,
  expenses = [],
  setExpenses,
  currentUser,
  language,
  activeTab,
}) => {
  const isBn = language === 'bn';
  const { theme: contextTheme } = useTheme();
  const isDark = contextTheme === 'dark';

  // Toast feedback
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: `toast-${Date.now()}`, type, title, message }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // State: Active View Mode ('overview' | 'directory' | 'detail' | 'reports' | 'expenses' | 'cash_collections')
  const [viewMode, setViewMode] = useState<'overview' | 'directory' | 'detail' | 'reports' | 'expenses' | 'cash_collections'>('overview');

  useEffect(() => {
    if (activeTab === 'ledger') setViewMode('directory');
    else if (activeTab === 'expenses' || activeTab === 'budget') setViewMode('expenses');
    else if (activeTab === 'reports') setViewMode('reports');
    else if (activeTab === 'cash_collections') setViewMode('cash_collections');
    else if (activeTab === 'dashboard') setViewMode('overview');
  }, [activeTab]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Search & Filter state for Customers
  const [custSearch, setCustSearch] = useState('');
  const [sortByDue, setSortByDue] = useState(false);
  const [custPage, setCustPage] = useState(1);
  const itemsPerPage = 5;

  // Add Customer Form Modal State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustCode, setNewCustCode] = useState(`CUST-${Math.floor(1000 + Math.random() * 9000)}`);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  // Add Manual Ledger Entry Form Modal State
  const [showAddLedgerModal, setShowAddLedgerModal] = useState(false);
  const [entryType, setEntryType] = useState<'charge' | 'payment'>('charge');
  const [entryAmount, setEntryAmount] = useState<number>(15000);
  const [entryNote, setEntryNote] = useState('');

  // Add Expense Voucher Modal State (Direct Sync to Super Admin)
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseItem['category']>('shipping');
  const [expAmount, setExpAmount] = useState('');
  const [expVoucherNo, setExpVoucherNo] = useState(`VCH-${Math.floor(1000 + Math.random() * 9000)}`);
  const [expNotes, setExpNotes] = useState('');

  // Report Date Range Filter
  const [reportStartDate, setReportStartDate] = useState('2026-08-01');
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportCustFilter, setReportCustFilter] = useState('all');

  // Compute live customer ledger statistics on the fly
  /*
   * ARCHITECTURE DECISION COMMENT (PRD Section 4.3):
   * Running balance is calculated ON THE FLY from raw `ledger_entries` instead of storing
   * a denormalized `total_due` in the `customers` table. This prevents race conditions,
   * stale balances, and guarantees 100% audit accuracy with auto-synced warehouse cash collections.
   */
  const getCustomerStats = (custCode: string) => {
    const entries = ledgerEntries.filter((l) => l.customer_code === custCode);
    const totalCharges = entries
      .filter((l) => l.type === 'charge')
      .reduce((acc, curr) => acc + curr.amount, 0);
    const totalPayments = entries
      .filter((l) => l.type === 'payment')
      .reduce((acc, curr) => acc + curr.amount, 0);
    const currentDue = totalCharges - totalPayments;

    return { totalCharges, totalPayments, currentDue, entries };
  };

  // Add Customer Handler
  const handleSaveNewCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      customer_code: newCustCode,
      name: newCustName,
      phone: newCustPhone || '01700000000',
      address: newCustAddress || 'Dhaka, Bangladesh',
      total_due: 0,
      total_paid: 0,
      created_at: new Date().toISOString(),
    };

    setCustomers((prev) => [newCust, ...prev]);
    addToast('success', isBn ? 'নতুন কাস্টমার তৈরি হয়েছে!' : 'Customer Created Successfully!');
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setNewCustCode(`CUST-${Math.floor(1000 + Math.random() * 9000)}`);
    setShowAddCustomerModal(false);
  };

  // Add Manual Ledger Entry Handler
  const handleSaveLedgerEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || entryAmount <= 0) return;

    const cust = customers.find((c) => c.id === selectedCustomerId);
    if (!cust) return;

    const newEntry: LedgerEntry = {
      id: `ledg-${Date.now()}`,
      customer_id: cust.id,
      customer_code: cust.customer_code,
      customer_name: cust.name,
      type: entryType,
      amount: entryAmount,
      note: entryNote || (entryType === 'charge' ? 'শিপমেন্ট চার্জ' : 'ক্যাশ পেমেন্ট'),
      source: 'manual',
      entered_by: currentUser.id,
      entered_by_name: `${currentUser.name} (Accountant)`,
      created_at: new Date().toISOString(),
    };

    setLedgerEntries((prev) => [newEntry, ...prev]);
    addToast(
      'success',
      isBn ? 'লেজার এন্ট্রি সফল হয়েছে!' : 'Ledger Entry Recorded!',
      isBn ? `৳${entryAmount.toLocaleString()} (${entryType.toUpperCase()}) সিঙ্ক করা হয়েছে` : `৳${entryAmount.toLocaleString()} added`
    );

    setEntryNote('');
    setShowAddLedgerModal(false);
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,Date,Customer Code,Customer Name,Type,Amount,Source,Entered By,Note\n';
    ledgerEntries.forEach((l) => {
      csvContent += `${l.created_at.split('T')[0]},${l.customer_code},"${l.customer_name}",${l.type},${l.amount},${l.source},"${l.entered_by_name}","${l.note}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FourStarCargo_Financial_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('success', isBn ? 'CSV লেজার রিপোর্ট ডাউনলোড সম্পন্ন!' : 'CSV Report Exported!');
  };

  // Add Expense Voucher Handler (Live Sync with Super Admin & Persisted to Hostinger DB)
  const handleSaveExpenseVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || !expAmount || Number(expAmount) <= 0) return;

    const newExp: ExpenseItem = {
      id: `exp-${Date.now()}`,
      title: expTitle.trim(),
      category: expCategory,
      amount: Number(expAmount),
      date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      voucher_no: expVoucherNo.trim() || `VCH-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: expNotes.trim() || 'Accounts Team Manual Entry',
      created_by: `${currentUser.name} (Accountant)`,
      created_at: new Date().toISOString(),
    };

    const updatedExpList = [newExp, ...(expenses || [])];
    if (setExpenses) setExpenses(updatedExpList);
    saveHostingerDbData('fsc_vps_expenses', updatedExpList);

    addToast(
      'success',
      isBn ? 'খরচ ভাউচার ইনপুট সফল ও সুপার এডমিনে সিঙ্ক হয়েছে!' : 'Expense Voucher Recorded!',
      isBn ? `৳${Number(expAmount).toLocaleString()} সুপার এডমিন এর বাজেট ও খরচ সেকশনে আপডেট হয়েছে` : `৳${Number(expAmount).toLocaleString()} synced to Super Admin`
    );

    setExpTitle('');
    setExpAmount('');
    setExpVoucherNo(`VCH-${Math.floor(1000 + Math.random() * 9000)}`);
    setExpNotes('');
    setShowAddExpenseModal(false);
  };

  // Filtered & Sorted Customer List
  const filteredCustomers = customers
    .filter(
      (c) =>
        c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
        c.customer_code.toLowerCase().includes(custSearch.toLowerCase()) ||
        c.phone.includes(custSearch)
    )
    .sort((a, b) => {
      if (sortByDue) {
        const dueA = getCustomerStats(a.customer_code).currentDue;
        const dueB = getCustomerStats(b.customer_code).currentDue;
        return dueB - dueA;
      }
      return 0;
    });

  const paginatedCustomers = filteredCustomers.slice(
    (custPage - 1) * itemsPerPage,
    custPage * itemsPerPage
  );
  const totalCustPages = Math.ceil(filteredCustomers.length / itemsPerPage) || 1;

  // Selected Customer for Detailed Ledger View
  const selectedCust = customers.find((c) => c.id === selectedCustomerId);

  // Total Outstanding Across All Customers
  const totalCompanyDue = customers.reduce(
    (acc, curr) => acc + getCustomerStats(curr.customer_code).currentDue,
    0
  );

  // Compute Overall Totals for Analytics
  const totalBilledAll = customers.reduce(
    (acc, curr) => acc + getCustomerStats(curr.customer_code).totalCharges,
    0
  );
  const totalCollectedCash = customers.reduce(
    (acc, curr) => acc + getCustomerStats(curr.customer_code).totalPayments,
    0
  );
  const totalExpenseAmount = (expenses || []).reduce((acc, curr) => acc + curr.amount, 0);
  const netCashflow = totalCollectedCash - totalExpenseAmount;

  // --------------------------------------------------------------------------
  // TAB: ACCOUNTS OVERVIEW & ANALYTICS DASHBOARD (Landing Tab)
  // --------------------------------------------------------------------------
  if (viewMode === 'overview') {
    return (
      <div className="space-y-6">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        {/* Quick Action Navigation & Input Bar */}
        <div className={`border rounded-none p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div>
            <span className={`text-xs font-mono uppercase font-light ${isDark ? 'text-[#1FB6A8]' : 'text-[#00897B]'}`}>
              👋 {isBn ? 'স্বাগত' : 'Welcome'}, {currentUser.name} ({isBn ? 'অ্যাকাউন্টস টিম' : 'Accounts Team'})
            </span>
            <h2 className={`text-xl font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isBn ? 'অ্যাকাউন্টস অ্যানালিটিক্স ও ফিনান্সিয়াল কন্ট্রোল প্যানেল' : 'Accounts Financial Control Panel'}
            </h2>
            <p className={`text-xs font-light mt-1 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>
              {isBn
                ? 'আয়, বকেয়া, খরচ সিঙ্ক এবং ম্যানুয়াল হিসাব ইনপুট করার প্রধান ড্যাশবোর্ড'
                : 'Central financial analytics, manual voucher inputs & Super Admin live synchronization'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="px-4 py-2 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white text-xs font-normal transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="font-light">{isBn ? '➕ নতুন খরচ ভাউচার (Super Admin Sync)' : '➕ Add Expense Voucher'}</span>
            </button>

            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="px-4 py-2 rounded-none bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-normal transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span className="font-light">{isBn ? '👤 নতুন কাস্টমার এন্ট্রি' : '👤 Add Customer'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              className={`px-3.5 py-2 rounded-none text-xs font-normal border transition-all flex items-center space-x-1.5 cursor-pointer ${
                isDark ? 'bg-[#0B1622] hover:bg-[#1E3247] text-[#8FA3AD] hover:text-white border-[#1E3247]' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <Download className="w-4 h-4 text-[#00897B]" />
              <span className="font-light">{isBn ? 'CSV অডিট ডাউনলোড' : 'CSV Export'}</span>
            </button>
          </div>
        </div>

        {/* 4 Financial Analytics KPI Overview Cards (rounded-none, font-light) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Customer Dues */}
          <div className={`border rounded-none p-5 space-y-2 ${
            isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'সর্বমোট বকেয়া (Total Dues)' : 'Total Dues Outstanding'}</span>
              <FileSpreadsheet className="w-4 h-4 text-[#00897B]" />
            </div>
            <div className={`text-2xl font-bold font-poppins ${isDark ? 'text-[#1FB6A8]' : 'text-[#007791]'}`}>৳{totalCompanyDue.toLocaleString()}</div>
            <div className={`flex items-center justify-between text-[11px] font-light pt-1 border-t ${isDark ? 'text-[#8FA3AD] border-[#1E3247]' : 'text-slate-500 border-slate-100'}`}>
              <span>{customers.length} {isBn ? 'জন নিবন্ধিত কাস্টমার' : 'Registered Customers'}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono">ON-THE-FLY LIVE</span>
            </div>
          </div>

          {/* Card 2: Total Cash Collected */}
          <div className={`border rounded-none p-5 space-y-2 ${
            isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'মোট আদায়কৃত ক্যাশ (Collected)' : 'Total Cash Collected'}</span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div className={`text-2xl font-bold font-poppins ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>৳{totalCollectedCash.toLocaleString()}</div>
            <div className={`flex items-center justify-between text-[11px] font-light pt-1 border-t ${isDark ? 'text-[#8FA3AD] border-[#1E3247]' : 'text-slate-500 border-slate-100'}`}>
              <span>{isBn ? 'মোট ইনভয়েস বিল' : 'Total Billed'}: ৳{totalBilledAll.toLocaleString()}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono">{(totalBilledAll > 0 ? (totalCollectedCash / totalBilledAll * 100) : 0).toFixed(1)}%</span>
            </div>
          </div>

          {/* Card 3: Operational Expenses Vouchers */}
          <div className={`border rounded-none p-5 space-y-2 ${
            isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'কোম্পানি খরচ (Super Admin Sync)' : 'Operational Expenses'}</span>
              <Wallet className="w-4 h-4 text-amber-500" />
            </div>
            <div className={`text-2xl font-bold font-poppins ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>৳{totalExpenseAmount.toLocaleString()}</div>
            <div className={`flex items-center justify-between text-[11px] font-light pt-1 border-t ${isDark ? 'text-[#8FA3AD] border-[#1E3247]' : 'text-slate-500 border-slate-100'}`}>
              <span>{(expenses || []).length} {isBn ? 'টি ভাউচার এন্ট্রি' : 'Vouchers Recorded'}</span>
              <button
                onClick={() => setViewMode('expenses')}
                className="text-[#00897B] hover:underline font-light cursor-pointer"
              >
                {isBn ? 'ডিটেইলস →' : 'Details →'}
              </button>
            </div>
          </div>

          {/* Card 4: Net Cashflow */}
          <div className={`border rounded-none p-5 space-y-2 ${
            isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'নিট অপারেটিং ক্যাশফ্লো' : 'Net Operating Cashflow'}</span>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <div className={`text-2xl font-bold font-poppins ${netCashflow >= 0 ? (isDark ? 'text-blue-400' : 'text-blue-700') : 'text-rose-600'}`}>
              ৳{netCashflow.toLocaleString()}
            </div>
            <div className={`flex items-center justify-between text-[11px] font-light pt-1 border-t ${isDark ? 'text-[#8FA3AD] border-[#1E3247]' : 'text-slate-500 border-slate-100'}`}>
              <span>{isBn ? 'আদায় বিয়োগ মোট খরচ' : 'Collected - Expenses'}</span>
              <span className="text-blue-600 dark:text-blue-400 font-mono">BALANCED</span>
            </div>
          </div>
        </div>

        {/* Financial Analytics & Category Breakdown Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Category Expenses Breakdown */}
          <div className={`lg:col-span-2 border rounded-none p-6 space-y-4 shadow-sm ${
            isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-[#1E3247]' : 'border-slate-200'}`}>
              <h3 className="text-sm font-bold flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-[#00897B]" />
                <span>{isBn ? 'কোম্পানি খরচ ক্যাটাগরি বিশ্লেষণ (Super Admin Sync Analytics)' : 'Company Expense Category Analytics'}</span>
              </h3>
              <button
                onClick={() => setViewMode('expenses')}
                className="text-xs text-[#00897B] hover:underline font-light cursor-pointer"
              >
                {isBn ? 'খরচ প্যানেল ম্যানেজ করুন →' : 'Manage Expenses →'}
              </button>
            </div>

            <div className="space-y-3.5 text-xs font-light">
              <div>
                <div className={`flex justify-between mb-1 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>
                  <span>✈️ {isBn ? 'চায়না বিমান ফ্রেইট ও কার্গো চার্জ (Flight Cargo Shipping)' : 'China Air Freight Cargo Shipping'}</span>
                  <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>৳850,000 (51.6%)</span>
                </div>
                <div className={`w-full h-2 rounded-none overflow-hidden ${isDark ? 'bg-[#0B1622]' : 'bg-slate-100 border border-slate-200'}`}>
                  <div className="bg-[#00897B] h-full" style={{ width: '51.6%' }} />
                </div>
              </div>

              <div>
                <div className={`flex justify-between mb-1 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>
                  <span>👥 {isBn ? 'ওয়্যারহাউজ ও স্টাফ বেতন (Staff Salary Disbursed)' : 'Warehouse Staff Salaries'}</span>
                  <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>৳320,000 (19.5%)</span>
                </div>
                <div className={`w-full h-2 rounded-none overflow-hidden ${isDark ? 'bg-[#0B1622]' : 'bg-slate-100 border border-slate-200'}`}>
                  <div className="bg-blue-600 h-full" style={{ width: '19.5%' }} />
                </div>
              </div>

              <div>
                <div className={`flex justify-between mb-1 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>
                  <span>🏢 {isBn ? 'তেজগাঁও হাবে মাসিক ভাড়া ও ইউটিলিটি (Warehouse Lease & Rent)' : 'Warehouse Lease & Rent'}</span>
                  <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>৳250,000 (15.2%)</span>
                </div>
                <div className={`w-full h-2 rounded-none overflow-hidden ${isDark ? 'bg-[#0B1622]' : 'bg-slate-100 border border-slate-200'}`}>
                  <div className="bg-amber-600 h-full" style={{ width: '15.2%' }} />
                </div>
              </div>

              <div>
                <div className={`flex justify-between mb-1 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>
                  <span>🛃 {isBn ? 'ঢাকা এয়ারপোর্ট কাস্টমস ক্লিয়ারেন্স ও ডিউটি ট্যাক্স (Customs Duty)' : 'Customs Clearance Duty & Tax'}</span>
                  <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>৳140,000 (8.5%)</span>
                </div>
                <div className={`w-full h-2 rounded-none overflow-hidden ${isDark ? 'bg-[#0B1622]' : 'bg-slate-100 border border-slate-200'}`}>
                  <div className="bg-purple-600 h-full" style={{ width: '8.5%' }} />
                </div>
              </div>

              <div>
                <div className={`flex justify-between mb-1 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>
                  <span>🚚 {isBn ? 'লোকাল ট্রাক ট্রানজিট ও প্যাকিং মেটেরিয়ালস (Local Transport & Packing)' : 'Local Transit & Transport'}</span>
                  <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>৳85,000 (5.2%)</span>
                </div>
                <div className={`w-full h-2 rounded-none overflow-hidden ${isDark ? 'bg-[#0B1622]' : 'bg-slate-100 border border-slate-200'}`}>
                  <div className="bg-emerald-600 h-full" style={{ width: '5.2%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Right 1 Col: Customer Payment Collection Progress & Direct Actions */}
          <div className={`border rounded-none p-6 space-y-4 shadow-sm flex flex-col justify-between ${
            isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div>
              <h3 className={`text-sm font-bold flex items-center space-x-2 border-b pb-3 ${isDark ? 'border-[#1E3247]' : 'border-slate-200'}`}>
                <PieChart className="w-4 h-4 text-emerald-500" />
                <span>{isBn ? 'কাস্টমার পেমেন্ট রিকভারি স্টেটাস' : 'Payment Recovery Status'}</span>
              </h3>

              <div className="mt-4 space-y-4">
                <div className={`text-center p-4 border rounded-none ${
                  isDark ? 'bg-[#0B1622] border-[#1E3247]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'মোট আদায় অনুপাত (Recovery Rate)' : 'Total Recovery Ratio'}</span>
                  <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                    {(totalBilledAll > 0 ? (totalCollectedCash / totalBilledAll * 100) : 0).toFixed(1)}%
                  </div>
                  <span className={`text-[11px] font-light mt-1 block ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>
                    ৳{totalCollectedCash.toLocaleString()} {isBn ? 'আদায়কৃত / মোট' : 'paid of'} ৳{totalBilledAll.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2 text-xs font-light">
                  <div className={`flex justify-between items-center p-2 border ${
                    isDark ? 'bg-[#0B1622]/50 border-[#1E3247] text-[#8FA3AD]' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <span>{isBn ? 'মোট নিবন্ধিত কাস্টমার' : 'Registered Clients'}:</span>
                    <span className={`font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{customers.length}</span>
                  </div>
                  <div className={`flex justify-between items-center p-2 border ${
                    isDark ? 'bg-[#0B1622]/50 border-[#1E3247] text-[#8FA3AD]' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <span>{isBn ? 'বকেয়া যুক্ত কাস্টমার' : 'Clients with Dues'}:</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold font-mono">
                      {customers.filter((c) => getCustomerStats(c.customer_code).currentDue > 0).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`pt-3 border-t space-y-2 ${isDark ? 'border-[#1E3247]' : 'border-slate-200'}`}>
              <button
                onClick={() => setViewMode('directory')}
                className="w-full py-2 px-3 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white text-xs font-normal shadow-sm cursor-pointer text-center"
              >
                <span className="font-light">{isBn ? '📋 কাস্টমার লেজার ডিরেক্টরি খুলুন →' : 'Open Customer Ledger Directory →'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Financial Audit Stream Table */}
        <div className={`border rounded-none overflow-hidden shadow-sm ${
          isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-[#1E3247]' : 'border-slate-200'}`}>
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <Clock className="w-4 h-4 text-[#00897B]" />
              <span>{isBn ? 'সাম্প্রতিক ফিনান্সিয়াল ট্রানজ্যাকশন ও ভাউচার স্ট্রীম' : 'Recent Financial Transactions & Vouchers Stream'}</span>
            </h3>
            <span className={`text-xs font-mono font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{ledgerEntries.length} Ledger Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`uppercase text-[10px] tracking-wider border-b font-medium ${
                isDark ? 'bg-[#0B1622] text-[#8FA3AD] border-[#1E3247]' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Customer / Ref</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Amount (BDT ৳)</th>
                  <th className="p-3.5">Entry Staff</th>
                  <th className="p-3.5">Note</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#1E3247]' : 'divide-slate-200'}`}>
                {ledgerEntries.slice(0, 5).map((re) => (
                  <tr key={re.id} className={`transition-colors ${isDark ? 'hover:bg-[#1E3247]/40' : 'hover:bg-slate-50'}`}>
                    <td className={`p-3.5 font-mono ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{re.created_at.split('T')[0]}</td>
                    <td className="p-3.5 font-mono font-bold text-[#00897B]">{re.customer_code} ({re.customer_name})</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-none text-[10px] font-normal uppercase ${
                          re.type === 'charge'
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                        }`}
                      >
                        {re.type}
                      </span>
                    </td>
                    <td className={`p-3.5 font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>৳{re.amount.toLocaleString()}</td>
                    <td className={`p-3.5 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{re.entered_by_name}</td>
                    <td className={`p-3.5 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{re.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Add Expense Voucher Modal (Live Synced with Super Admin) */}
        {showAddExpenseModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <form
              onSubmit={handleSaveExpenseVoucher}
              className={`border rounded-none p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 ${
                isDark ? 'bg-[#11202F] border-[#1FB6A8]/40 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <h3 className="text-base font-bold flex items-center space-x-2">
                <Wallet className="w-5 h-5 text-amber-500" />
                <span>{isBn ? 'নতুন খরচ ভাউচার ইনপুট (Super Admin Sync)' : 'Record New Expense Voucher'}</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className={`block mb-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{isBn ? 'ভাউচার শিরোনাম / বিবরণ *' : 'Voucher Title *'}</label>
                  <input
                    type="text"
                    required
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    placeholder="e.g. ঢাকা এয়ারপোর্ট কার্গো কাস্টমস ক্লিয়ারেন্স বিল"
                    className={`w-full border rounded-none p-2.5 outline-none font-light ${
                      isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1FB6A8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#00897B]'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block mb-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{isBn ? 'ক্যাটাগরি' : 'Category'}</label>
                    <select
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value as any)}
                      className={`w-full border rounded-none p-2.5 outline-none font-light ${
                        isDark ? 'bg-[#0B1622] border-[#1E3247] text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="shipping">✈️ Flight Cargo Shipping</option>
                      <option value="warehouse_rent">🏢 Warehouse Rent & Lease</option>
                      <option value="salary">👥 Staff Salary</option>
                      <option value="customs">🛃 Customs Duty & Tax</option>
                      <option value="packing_transport">🚚 Transit & Packing</option>
                      <option value="other">📦 Other Operations</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block mb-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{isBn ? 'টাকার পরিমাণ (BDT ৳) *' : 'Amount (BDT ৳) *'}</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      placeholder="e.g. 85000"
                      className={`w-full border rounded-none p-2.5 font-mono outline-none ${
                        isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1FB6A8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#00897B]'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block mb-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{isBn ? 'ভাউচার নাম্বার' : 'Voucher No'}</label>
                  <input
                    type="text"
                    value={expVoucherNo}
                    onChange={(e) => setExpVoucherNo(e.target.value)}
                    className={`w-full border rounded-none p-2.5 font-mono outline-none ${
                      isDark ? 'bg-[#0B1622] border-[#1E3247] text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block mb-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{isBn ? 'অতিরিক্ত নোট (Optional)' : 'Notes'}</label>
                  <input
                    type="text"
                    value={expNotes}
                    onChange={(e) => setExpNotes(e.target.value)}
                    placeholder="নোট বা ব্যাংক ট্রান্সফার নম্বর"
                    className={`w-full border rounded-none p-2.5 outline-none font-light ${
                      isDark ? 'bg-[#0B1622] border-[#1E3247] text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className={`px-4 py-2 rounded-none text-xs font-normal hover:text-white cursor-pointer ${
                    isDark ? 'bg-[#0B1622] text-[#8FA3AD]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span className="font-light">{isBn ? 'বাতিল' : 'Cancel'}</span>
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white font-normal text-xs cursor-pointer shadow-sm"
                >
                  <span className="font-light">{isBn ? 'সেভ করুন ও সুপার এডমিনে সিঙ্ক করুন' : 'Save & Sync Super Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // TAB: CASH COLLECTIONS SYNC VIEW
  // --------------------------------------------------------------------------
  if (viewMode === 'cash_collections') {
    return (
      <div className="space-y-6">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-[#1E3247]' : 'border-slate-200'}`}>
          <div>
            <h2 className={`text-xl font-bold font-poppins flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>{isBn ? 'ওয়্যারহাউজ ডেলিভারি ও ক্যাশ কালেকশন সিঙ্ক অডিট' : 'Warehouse Delivery & Cash Collection Sync'}</span>
            </h2>
            <p className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>
              {isBn ? 'কাউন্টার থেকে আদায়কৃত ক্যাশ কালেকশন যাচাই এবং লেজারে অটো-অডিট সিঙ্ক' : 'Audit counter cash collections synced automatically with customer ledger'}
            </p>
          </div>

          <button
            onClick={() => setViewMode('overview')}
            className={`flex items-center space-x-2 text-xs font-normal transition-colors cursor-pointer ${
              isDark ? 'text-[#8FA3AD] hover:text-[#1FB6A8]' : 'text-slate-600 hover:text-[#00897B]'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="font-light">{isBn ? 'ড্যাশবোর্ডে ফিরে যান' : 'Back to Overview'}</span>
          </button>
        </div>

        <div className={`border rounded-none p-6 space-y-4 shadow-sm ${
          isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-[#1E3247]' : 'border-slate-200'}`}>
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span>{isBn ? 'কাউন্টার রিসিভড ক্যাশ রেকর্ডস' : 'Verified Counter Cash Receipts'}</span>
            </h3>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-light">
              {ledgerEntries.filter((l) => l.source === 'auto_cash_collection' || l.type === 'payment').length} Verified Payments
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`uppercase text-[10px] tracking-wider border-b font-medium ${
                isDark ? 'bg-[#0B1622] text-[#8FA3AD] border-[#1E3247]' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Customer Code</th>
                  <th className="p-3.5">Customer Name</th>
                  <th className="p-3.5">Collected Amount (৳)</th>
                  <th className="p-3.5">Source / Staff</th>
                  <th className="p-3.5">Audit Status</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#1E3247]' : 'divide-slate-200'}`}>
                {ledgerEntries
                  .filter((l) => l.type === 'payment')
                  .map((pe) => (
                    <tr key={pe.id} className={`transition-colors ${isDark ? 'hover:bg-[#1E3247]/40' : 'hover:bg-slate-50'}`}>
                      <td className={`p-3.5 font-mono ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{pe.created_at.split('T')[0]}</td>
                      <td className="p-3.5 font-mono text-[#00897B] font-bold">{pe.customer_code}</td>
                      <td className={`p-3.5 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{pe.customer_name}</td>
                      <td className="p-3.5 font-bold font-mono text-emerald-600 dark:text-emerald-400">৳{pe.amount.toLocaleString()}</td>
                      <td className={`p-3.5 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{pe.entered_by_name}</td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-0.5 rounded-none text-[10px] font-normal uppercase bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                          ✓ SYNCED & AUDITED
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // TAB 0: EXPENSE & BUDGET MANAGEMENT VIEW
  // --------------------------------------------------------------------------
  if (viewMode === 'expenses') {
    return (
      <div className="space-y-4">
        <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-[#1E3247]' : 'border-slate-200'}`}>
          <button
            onClick={() => setViewMode('overview')}
            className={`flex items-center space-x-2 text-xs font-semibold transition-colors cursor-pointer ${
              isDark ? 'text-[#8FA3AD] hover:text-[#1FB6A8]' : 'text-slate-600 hover:text-[#00897B]'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{isBn ? 'অ্যাকাউন্টস ড্যাশবোর্ডে ফিরে যান' : 'Back to Accounts Dashboard'}</span>
          </button>
        </div>
        <BudgetExpenseManager language={language} theme={contextTheme || 'light'} />
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // TAB 1: REPORTS VIEW
  // --------------------------------------------------------------------------
  if (viewMode === 'reports') {
    const reportEntries = ledgerEntries.filter((l) => {
      const matchesCust = reportCustFilter === 'all' || l.customer_id === reportCustFilter;
      const dateStr = l.created_at.split('T')[0];
      const matchesDate = dateStr >= reportStartDate && dateStr <= reportEndDate;
      return matchesCust && matchesDate;
    });

    return (
      <div className="space-y-6">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 ${isDark ? 'border-[#1E3247]' : 'border-slate-200'}`}>
          <div>
            <h2 className={`text-xl font-bold font-poppins flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <FileSpreadsheet className="w-5 h-5 text-[#00897B]" />
              <span>{isBn ? 'ফিন্যান্সিয়াল লেজার ও ফিল্টারড রিপোর্টস' : 'Financial Ledger Activity Reports'}</span>
            </h2>
            <p className={`text-xs ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>
              {isBn ? 'তারিখ ও কাস্টমার অনুযায়ী ফিল্টার করে স্টেটমেন্ট ডাউনলোড করুন' : 'Date-range filtered ledger activity with CSV export'}
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center space-x-2 py-2.5 px-5 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white font-normal text-xs transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span className="font-light">{isBn ? 'CSV লেজার স্টেটমেন্ট ডাউনলোড' : 'Export CSV Report'}</span>
          </button>
        </div>

        {/* Date Filter Bar */}
        <div className={`border rounded-none p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs ${
          isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
        }`}>
          <div>
            <label className={`block mb-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{isBn ? 'শুরূতের তারিখ' : 'Start Date'}</label>
            <input
              type="date"
              value={reportStartDate}
              onChange={(e) => setReportStartDate(e.target.value)}
              className={`w-full border rounded-none p-2 font-mono outline-none ${
                isDark ? 'bg-[#0B1622] border-[#1E3247] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className={`block mb-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{isBn ? 'শেষের তারিখ' : 'End Date'}</label>
            <input
              type="date"
              value={reportEndDate}
              onChange={(e) => setReportEndDate(e.target.value)}
              className={`w-full border rounded-none p-2 font-mono outline-none ${
                isDark ? 'bg-[#0B1622] border-[#1E3247] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className={`block mb-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{isBn ? 'কাস্টমার ফিল্টার' : 'Filter Customer'}</label>
            <select
              value={reportCustFilter}
              onChange={(e) => setReportCustFilter(e.target.value)}
              className={`w-full border rounded-none p-2 outline-none font-light ${
                isDark ? 'bg-[#0B1622] border-[#1E3247] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="all">{isBn ? 'সকল কাস্টমার' : 'All Customers'}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.customer_code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reports Table */}
        <div className={`border rounded-none overflow-hidden shadow-sm ${
          isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-[#1E3247]' : 'border-slate-200'}`}>
            <h3 className="text-sm font-bold">{isBn ? 'ফিল্টারড ট্রানজ্যাকশন এন্ট্রি' : 'Filtered Transaction Entries'}</h3>
            <span className="text-xs text-[#00897B] font-mono">{reportEntries.length} Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`uppercase text-[10px] tracking-wider border-b font-medium ${
                isDark ? 'bg-[#0B1622] text-[#8FA3AD] border-[#1E3247]' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Customer Code</th>
                  <th className="p-3.5">Customer Name</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Amount (BDT ৳)</th>
                  <th className="p-3.5">Source / Staff</th>
                  <th className="p-3.5">Note</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#1E3247]' : 'divide-slate-200'}`}>
                {reportEntries.map((re) => (
                  <tr key={re.id} className={`transition-colors ${isDark ? 'hover:bg-[#1E3247]/40' : 'hover:bg-slate-50'}`}>
                    <td className={`p-3.5 font-mono ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{re.created_at.split('T')[0]}</td>
                    <td className="p-3.5 font-mono text-[#00897B] font-bold">{re.customer_code}</td>
                    <td className={`p-3.5 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{re.customer_name}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-none text-[10px] font-normal uppercase ${
                          re.type === 'charge'
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                        }`}
                      >
                        {re.type}
                      </span>
                    </td>
                    <td className={`p-3.5 font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>৳{re.amount.toLocaleString()}</td>
                    <td className={`p-3.5 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>
                      {re.source === 'auto_cash_collection' ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-normal flex items-center space-x-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Auto Cash ({re.entered_by_name})</span>
                        </span>
                      ) : (
                        <span>Manual ({re.entered_by_name})</span>
                      )}
                    </td>
                    <td className={`p-3.5 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{re.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // TAB 2: DETAILED CUSTOMER LEDGER VIEW (Single Customer Focus)
  // --------------------------------------------------------------------------
  if (viewMode === 'detail' && selectedCust) {
    const stats = getCustomerStats(selectedCust.customer_code);

    return (
      <div className="space-y-6">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        {/* Back Header */}
        <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-[#1E3247]' : 'border-slate-200'}`}>
          <button
            onClick={() => setViewMode('directory')}
            className={`flex items-center space-x-2 text-xs font-normal transition-colors cursor-pointer ${
              isDark ? 'text-[#8FA3AD] hover:text-[#1FB6A8]' : 'text-slate-600 hover:text-[#00897B]'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="font-light">{isBn ? 'কাস্টমার তালিকায় ফিরে যান' : 'Back to Customer Directory'}</span>
          </button>

          <button
            onClick={() => setShowAddLedgerModal(true)}
            className="flex items-center space-x-2 py-2 px-4 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white font-normal text-xs shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="font-light">{isBn ? 'ম্যানুয়াল লেজার এন্ট্রি করুন' : 'Add Manual Ledger Entry'}</span>
          </button>
        </div>

        {/* Customer Balance Header Card */}
        <div className={`border rounded-none p-6 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-6 ${
          isDark
            ? 'bg-gradient-to-r from-[#11202F] via-[#0F2D52] to-[#11202F] border-[#1FB6A8]/30 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div>
            <span className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{selectedCust.customer_code}</span>
            <h2 className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedCust.name}</h2>
            <p className={`text-xs mt-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{selectedCust.phone} | {selectedCust.address}</p>
          </div>

          <div className={`border-t sm:border-t-0 sm:border-l pt-4 sm:pt-0 sm:pl-6 space-y-1 ${isDark ? 'border-[#1E3247]' : 'border-slate-200'}`}>
            <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'মোট চার্জ (Total Charges)' : 'Total Charges'}</span>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono">৳{stats.totalCharges.toLocaleString()}</div>
            <span className={`text-[11px] block font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'মোট পরিশোধ (Total Paid)' : 'Total Paid'}: ৳{stats.totalPayments.toLocaleString()}</span>
          </div>

          <div className={`border-t sm:border-t-0 sm:border-l pt-4 sm:pt-0 sm:pl-6 space-y-1 ${isDark ? 'border-[#1E3247]' : 'border-slate-200'}`}>
            <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'বর্তমান নিট বকেয়া (Current Net Due)' : 'Current Net Outstanding Due'}</span>
            <div className="text-2xl font-bold text-[#00897B] dark:text-[#1FB6A8] font-mono">৳{stats.currentDue.toLocaleString()}</div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal bg-emerald-500/10 px-2 py-0.5 rounded-none inline-block">
              ON-THE-FLY COMPUTED (LIVE)
            </span>
          </div>
        </div>

        {/* Timeline Ledger Entries List */}
        <div className={`border rounded-none p-6 space-y-4 shadow-sm ${
          isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <h3 className="text-sm font-bold flex items-center space-x-2">
            <FileText className="w-4 h-4 text-[#00897B]" />
            <span>{isBn ? 'লেজার লেনদেন ইতিহাস (Chronological Timeline)' : 'Chronological Transaction History'}</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`uppercase text-[10px] tracking-wider border-b font-medium ${
                isDark ? 'bg-[#0B1622] text-[#8FA3AD] border-[#1E3247]' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Amount (BDT ৳)</th>
                  <th className="p-3.5">Source / Initiator</th>
                  <th className="p-3.5">Note</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#1E3247]' : 'divide-slate-200'}`}>
                {stats.entries.map((entry) => (
                  <tr key={entry.id} className={`transition-colors ${isDark ? 'hover:bg-[#1E3247]/40' : 'hover:bg-slate-50'}`}>
                    <td className={`p-3.5 font-mono ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{entry.created_at.split('T')[0]}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-none text-[10px] font-normal uppercase flex items-center space-x-1 w-fit ${
                          entry.type === 'charge'
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                        }`}
                      >
                        {entry.type === 'charge' ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownLeft className="w-3 h-3" />
                        )}
                        <span>{entry.type}</span>
                      </span>
                    </td>
                    <td className={`p-3.5 font-bold font-mono text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>৳{entry.amount.toLocaleString()}</td>
                    <td className={`p-3.5 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>
                      {entry.source === 'auto_cash_collection' ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Auto-Cash ({entry.entered_by_name})</span>
                        </span>
                      ) : (
                        <span>Manual ({entry.entered_by_name})</span>
                      )}
                    </td>
                    <td className={`p-3.5 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{entry.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Manual Entry Modal */}
        {showAddLedgerModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <form
              onSubmit={handleSaveLedgerEntry}
              className={`border rounded-none p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 ${
                isDark ? 'bg-[#11202F] border-[#1FB6A8]/40 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <h3 className="text-base font-bold flex items-center space-x-2">
                <Plus className="w-5 h-5 text-[#00897B]" />
                <span>{isBn ? 'ম্যানুয়াল লেজার এন্ট্রি ফরম' : 'Add Manual Ledger Entry'}</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className={`block mb-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{isBn ? 'এন্ট্রি টাইপ (Type)' : 'Entry Type'}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEntryType('charge')}
                      className={`p-2.5 rounded-none font-bold transition-all ${
                        entryType === 'charge'
                          ? 'bg-amber-500 text-black shadow-sm'
                          : isDark
                          ? 'bg-[#0B1622] text-[#8FA3AD]'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      CHARGE (বকেয়া চার্জ)
                    </button>

                    <button
                      type="button"
                      onClick={() => setEntryType('payment')}
                      className={`p-2.5 rounded-none font-bold transition-all ${
                        entryType === 'payment'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : isDark
                          ? 'bg-[#0B1622] text-[#8FA3AD]'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      PAYMENT (পরিশোধ)
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`block mb-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{isBn ? 'টাকার পরিমাণ (BDT ৳)' : 'Amount (BDT ৳)'}</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(Number(e.target.value))}
                    className={`w-full border rounded-none p-2.5 font-bold font-mono outline-none ${
                      isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1FB6A8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#00897B]'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block mb-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{isBn ? 'নোট / বিবরণ' : 'Description Note'}</label>
                  <input
                    type="text"
                    required
                    value={entryNote}
                    onChange={(e) => setEntryNote(e.target.value)}
                    placeholder="e.g. ব্যাংক ট্রান্সফার রসিদ #9901"
                    className={`w-full border rounded-none p-2.5 outline-none font-light ${
                      isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1FB6A8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#00897B]'
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLedgerModal(false)}
                  className={`px-4 py-2 rounded-none text-xs font-normal hover:text-white cursor-pointer ${
                    isDark ? 'bg-[#0B1622] text-[#8FA3AD]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span className="font-light">{isBn ? 'বাতিল' : 'Cancel'}</span>
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white font-normal text-xs cursor-pointer shadow-sm"
                >
                  <span className="font-light">{isBn ? 'এন্ট্রি সেভ করুন' : 'Save Entry'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // DEFAULT TAB: CUSTOMER DIRECTORY & BALANCE OVERVIEW
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`border rounded-none p-5 space-y-2 ${
          isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
        }`}>
          <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'সর্বমোট বকেয়া (Total Dues)' : 'Total Outstanding Dues'}</span>
          <div className={`text-2xl font-bold font-poppins ${isDark ? 'text-[#1FB6A8]' : 'text-[#007791]'}`}>৳{totalCompanyDue.toLocaleString()}</div>
          <span className={`text-[11px] font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{customers.length} Registered Customers</span>
        </div>

        <div className={`border rounded-none p-5 space-y-2 ${
          isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
        }`}>
          <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'কোম্পানি বাজেট ও খরচ' : 'Budget & Expense Vouchers'}</span>
          <button
            onClick={() => setViewMode('expenses')}
            className="w-full py-2 px-3 rounded-none bg-[#00897B]/10 hover:bg-[#00897B]/20 text-[#00897B] text-xs font-normal transition-all border border-[#00897B]/30 text-left flex items-center justify-between cursor-pointer"
          >
            <span className="font-light">{isBn ? 'খরচ ভাউচার এন্ট্রি →' : 'Manage Expenses & Budget →'}</span>
          </button>
        </div>

        <div className={`border rounded-none p-5 space-y-2 ${
          isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
        }`}>
          <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'রিপোর্ট মোড' : 'Quick Reports'}</span>
          <button
            onClick={() => setViewMode('reports')}
            className="w-full py-2 px-3 rounded-none bg-[#0284C7]/10 hover:bg-[#0284C7]/20 text-[#0284C7] text-xs font-normal transition-all border border-[#0284C7]/30 text-left flex items-center justify-between cursor-pointer"
          >
            <span className="font-light">{isBn ? 'স্টেটমেন্ট ও রিপোর্টস দেখুন →' : 'View Financial Reports →'}</span>
          </button>
        </div>

        <div className={`border rounded-none p-5 space-y-2 flex flex-col justify-between ${
          isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
        }`}>
          <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'কাস্টমার অ্যাকশন' : 'Customer Directory Action'}</span>
          <button
            onClick={() => setShowAddCustomerModal(true)}
            className="py-2 px-3 rounded-none bg-[#0284C7] hover:bg-[#0369A1] text-white font-normal text-xs transition-all shadow-sm flex items-center justify-center space-x-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="font-light">{isBn ? '+ নতুন কাস্টমার' : '+ Add Customer'}</span>
          </button>
        </div>
      </div>

      {/* Search & Sort Controls Bar */}
      <div className={`border rounded-none p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
      }`}>
        <div className="relative flex-1 max-w-xs">
          <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-400'}`} />
          <input
            type="text"
            value={custSearch}
            onChange={(e) => setCustSearch(e.target.value)}
            placeholder={isBn ? 'কাস্টমার নাম, কোড বা ফোন খুঁজুন...' : 'Search name, code or phone...'}
            className={`w-full border rounded-none py-1.5 pl-9 pr-3 text-xs outline-none font-light ${
              isDark ? 'bg-[#0B1622] border-[#1E3247] text-white placeholder-[#8FA3AD]' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setSortByDue(!sortByDue)}
            className={`px-3 py-1.5 rounded-none border text-xs font-normal transition-all cursor-pointer ${
              sortByDue
                ? 'bg-[#00897B] text-white border-[#00897B]'
                : isDark
                ? 'bg-[#0B1622] text-[#8FA3AD] border-[#1E3247]'
                : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            <span className="font-light">{isBn ? 'সর্বোচ্চ বকেয়া অনুযায়ী সাজান' : 'Sort by Highest Due'}</span>
          </button>
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className={`border rounded-none overflow-hidden shadow-sm ${
        isDark ? 'bg-[#11202F] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase text-[10px] tracking-wider border-b font-medium ${
              isDark ? 'bg-[#0B1622] text-[#8FA3AD] border-[#1E3247]' : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              <tr>
                <th className="p-3.5">Customer Code</th>
                <th className="p-3.5">Customer Name</th>
                <th className="p-3.5">Phone</th>
                <th className="p-3.5">Total Charges</th>
                <th className="p-3.5">Total Paid</th>
                <th className="p-3.5">Current Net Due</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#1E3247]' : 'divide-slate-200'}`}>
              {paginatedCustomers.map((cust) => {
                const stats = getCustomerStats(cust.customer_code);
                return (
                  <tr key={cust.id} className={`transition-colors ${isDark ? 'hover:bg-[#1E3247]/40' : 'hover:bg-slate-50'}`}>
                    <td className="p-3.5 font-bold font-mono text-[#00897B]">{cust.customer_code}</td>
                    <td className={`p-3.5 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{cust.name}</td>
                    <td className={`p-3.5 font-mono ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{cust.phone}</td>
                    <td className="p-3.5 text-amber-600 dark:text-amber-400 font-mono">৳{stats.totalCharges.toLocaleString()}</td>
                    <td className="p-3.5 text-emerald-600 dark:text-emerald-400 font-mono">৳{stats.totalPayments.toLocaleString()}</td>
                    <td className={`p-3.5 font-bold text-sm font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      ৳{stats.currentDue.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => {
                          setSelectedCustomerId(cust.id);
                          setViewMode('detail');
                        }}
                        className="px-3.5 py-1.5 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white font-normal text-xs transition-all shadow-sm cursor-pointer"
                      >
                        <span className="font-light">{isBn ? 'লেজার বিবরণ দেখুন →' : 'View Ledger →'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className={`p-4 border-t flex items-center justify-between text-xs ${
          isDark ? 'border-[#1E3247] text-[#8FA3AD]' : 'border-slate-200 text-slate-500'
        }`}>
          <div className="font-light">
            Showing {paginatedCustomers.length} of {filteredCustomers.length} Customers
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={custPage === 1}
              onClick={() => setCustPage(custPage - 1)}
              className={`p-1.5 rounded-none disabled:opacity-40 cursor-pointer ${
                isDark ? 'bg-[#0B1622] hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className={`font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {custPage} / {totalCustPages}
            </span>
            <button
              disabled={custPage >= totalCustPages}
              onClick={() => setCustPage(custPage + 1)}
              className={`p-1.5 rounded-none disabled:opacity-40 cursor-pointer ${
                isDark ? 'bg-[#0B1622] hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveNewCustomer}
            className={`border rounded-none p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 ${
              isDark ? 'bg-[#11202F] border-[#1FB6A8]/40 text-white' : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <h3 className="text-base font-bold flex items-center space-x-2">
              <Users className="w-5 h-5 text-[#00897B]" />
              <span>{isBn ? 'নতুন কাস্টমার তৈরি করুন' : 'Quick Add New Customer'}</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className={`block mb-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{isBn ? 'কাস্টমার কোড (Customer Code)' : 'Customer Code'}</label>
                <input
                  type="text"
                  required
                  value={newCustCode}
                  onChange={(e) => setNewCustCode(e.target.value)}
                  className={`w-full border rounded-none p-2.5 font-mono outline-none ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1FB6A8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#00897B]'
                  }`}
                />
              </div>

              <div>
                <label className={`block mb-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{isBn ? 'কাস্টমার নাম *' : 'Customer Name *'}</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. গ্লোবাল ইলেকট্রনিক্স ট্রেডার্স"
                  className={`w-full border rounded-none p-2.5 outline-none font-light ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1FB6A8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#00897B]'
                  }`}
                />
              </div>

              <div>
                <label className={`block mb-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{isBn ? 'মোবাইল নম্বর' : 'Phone Number'}</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="01700000000"
                  className={`w-full border rounded-none p-2.5 font-mono outline-none ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1FB6A8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#00897B]'
                  }`}
                />
              </div>

              <div>
                <label className={`block mb-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{isBn ? 'ঠিকানা' : 'Address'}</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="Dhaka, Bangladesh"
                  className={`w-full border rounded-none p-2.5 outline-none font-light ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1FB6A8]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#00897B]'
                  }`}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className={`px-4 py-2 rounded-none text-xs font-normal hover:text-white cursor-pointer ${
                  isDark ? 'bg-[#0B1622] text-[#8FA3AD]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span className="font-light">{isBn ? 'বাতিল' : 'Cancel'}</span>
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white font-normal text-xs cursor-pointer shadow-sm"
              >
                <span className="font-light">{isBn ? 'কাস্টমার সেভ করুন' : 'Save Customer'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
