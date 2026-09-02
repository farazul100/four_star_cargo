import React, { useState } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  Calendar,
  Filter,
  Search,
  Printer,
  RotateCcw,
  PieChart,
  BarChart3,
  FileSpreadsheet,
  XCircle,
} from 'lucide-react';
import { ExpenseItem, Language, Theme, LedgerEntry } from '../types';
import { useTheme } from '../context/ThemeContext';
import { ToastContainer, ToastMessage } from './Toast';
import { getHostingerDbData, saveHostingerDbData, subscribeToDbUpdates, logSystemAuditAction } from '../lib/db';

interface BudgetExpenseManagerProps {
  language?: Language;
  theme?: Theme;
  ledgerEntries?: LedgerEntry[];
}

// Initial Mock Expense Items (Empty by default for fresh operations)
const INITIAL_EXPENSES: ExpenseItem[] = [];

export const BudgetExpenseManager: React.FC<BudgetExpenseManagerProps> = ({
  language = 'en',
  theme: themeProp,
  ledgerEntries: ledgerEntriesProp,
}) => {
  const { theme: contextTheme } = useTheme();
  const activeTheme = contextTheme || themeProp || 'light';
  const isBn = language === 'bn';
  const isDark = activeTheme === 'dark';

  // Toasts State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: `toast-${Date.now()}`, type, title, message }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Expenses Main State synced with Hostinger DB / Accountant Panel
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    const dbData = getHostingerDbData();
    if (dbData.expenses && Array.isArray(dbData.expenses)) {
      return dbData.expenses;
    }
    return [];
  });

  // Real-time DB Sync Listener
  React.useEffect(() => {
    return subscribeToDbUpdates(() => {
      const dbData = getHostingerDbData();
      if (dbData.expenses && Array.isArray(dbData.expenses)) {
        setExpenses(dbData.expenses);
      } else {
        setExpenses([]);
      }
    });
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [reportTab, setReportTab] = useState<'daily' | 'monthly' | 'yearly'>('monthly');

  // Smart Date Filter States
  type DateFilterMode = 'all' | 'date_range' | 'single_date' | 'single_month' | 'month_range' | 'single_year' | 'year_range';
  const [dateFilterType, setDateFilterType] = useState<DateFilterMode>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [singleDate, setSingleDate] = useState('');
  const [singleMonth, setSingleMonth] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [singleYear, setSingleYear] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');

  const resetDateFilters = () => {
    setDateFilterType('all');
    setStartDate('');
    setEndDate('');
    setSingleDate('');
    setSingleMonth('');
    setStartMonth('');
    setEndMonth('');
    setSingleYear('');
    setStartYear('');
    setEndYear('');
  };

  // Add Expense Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseItem['category']>('shipping');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState('2026-08-15');
  const [expPaymentMethod, setExpPaymentMethod] = useState<ExpenseItem['payment_method']>('bank_transfer');
  const [expVoucherNo, setExpVoucherNo] = useState('');
  const [expNotes, setExpNotes] = useState('');

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle || !expAmount || parseFloat(expAmount) <= 0) {
      addToast('error', isBn ? 'ভুল ইনপুট' : 'Invalid Input', isBn ? 'সঠিক শিরোনাম ও টাকার পরিমাণ লিখুন।' : 'Please fill title and valid amount.');
      return;
    }

    const newExpense: ExpenseItem = {
      id: `exp-${Date.now()}`,
      title: expTitle,
      category: expCategory,
      amount: parseFloat(expAmount),
      date: expDate || '2026-08-15',
      payment_method: expPaymentMethod,
      voucher_no: expVoucherNo || `VCH-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: expNotes,
      created_by: 'আরিফুল হক (Accountant)',
      created_at: new Date().toISOString(),
    };

    const updatedExpenses = [newExpense, ...expenses];
    setExpenses(updatedExpenses);
    saveHostingerDbData('fsc_vps_expenses', updatedExpenses);

    logSystemAuditAction(
      null,
      'CREATE_EXPENSE_VOUCHER',
      'expense',
      newExpense.id,
      `নতুন খরচ ভাউচার তৈরি: ${newExpense.title} (৳${newExpense.amount.toLocaleString()}, মেথড: ${newExpense.payment_method}, ভাউচার: ${newExpense.voucher_no})`
    );

    addToast('success', isBn ? 'নতুন খরচ ভাউচার যোগ সফল!' : 'Expense Voucher Recorded!', isBn ? `৳${parseFloat(expAmount).toLocaleString()} একাউন্টস প্যানেলে সিঙ্ক করা হয়েছে` : `Voucher of ৳${parseFloat(expAmount).toLocaleString()} synced to Accounts`);

    // Reset Form
    setExpTitle('');
    setExpAmount('');
    setExpVoucherNo('');
    setExpNotes('');
    setShowAddModal(false);
  };

  // Dynamically compute live revenue from Hostinger DB ledger charges
  const liveDbData = getHostingerDbData();
  const liveLedgerEntries: LedgerEntry[] = ledgerEntriesProp || liveDbData.ledgerEntries || [];

  const totalCargoIncome = liveLedgerEntries
    .filter((l) => l.type === 'charge')
    .reduce((sum, entry) => sum + entry.amount, 0);

  // Filtered Expenses
  const filteredExpenses = expenses.filter((exp) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      exp.title.toLowerCase().includes(q) ||
      exp.voucher_no.toLowerCase().includes(q) ||
      (exp.notes && exp.notes.toLowerCase().includes(q));

    const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;

    // Smart Date Filter Logic
    let matchesDate = true;
    if (dateFilterType !== 'all') {
      const itemDateStr = exp.date; // "YYYY-MM-DD"
      const itemMonthStr = itemDateStr.substring(0, 7);
      const itemYearStr = itemDateStr.substring(0, 4);

      if (dateFilterType === 'single_date' && singleDate) {
        if (itemDateStr !== singleDate) matchesDate = false;
      } else if (dateFilterType === 'date_range') {
        if (startDate && itemDateStr < startDate) matchesDate = false;
        if (endDate && itemDateStr > endDate) matchesDate = false;
      } else if (dateFilterType === 'single_month' && singleMonth) {
        if (itemMonthStr !== singleMonth) matchesDate = false;
      } else if (dateFilterType === 'month_range') {
        if (startMonth && itemMonthStr < startMonth) matchesDate = false;
        if (endMonth && itemMonthStr > endMonth) matchesDate = false;
      } else if (dateFilterType === 'single_year' && singleYear) {
        if (itemYearStr !== singleYear) matchesDate = false;
      } else if (dateFilterType === 'year_range') {
        if (startYear && itemYearStr < startYear) matchesDate = false;
        if (endYear && itemYearStr > endYear) matchesDate = false;
      }
    }

    return matchesSearch && matchesCategory && matchesDate;
  });

  // Calculate Financial Summaries
  const totalFilteredExpense = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const netProfitOrLoss = totalCargoIncome - totalFilteredExpense;
  const netMarginPercent = totalCargoIncome > 0 ? ((netProfitOrLoss / totalCargoIncome) * 100).toFixed(1) : '0';
  const expenseRatio = totalCargoIncome > 0 ? ((totalFilteredExpense / totalCargoIncome) * 100).toFixed(1) : '0';

  // Category Breakdown Totals
  const categoryTotals = {
    shipping: filteredExpenses.filter((e) => e.category === 'shipping').reduce((s, e) => s + e.amount, 0),
    warehouse_rent: filteredExpenses.filter((e) => e.category === 'warehouse_rent').reduce((s, e) => s + e.amount, 0),
    salary: filteredExpenses.filter((e) => e.category === 'salary').reduce((s, e) => s + e.amount, 0),
    customs: filteredExpenses.filter((e) => e.category === 'customs').reduce((s, e) => s + e.amount, 0),
    packing_transport: filteredExpenses.filter((e) => e.category === 'packing_transport').reduce((s, e) => s + e.amount, 0),
    utilities: filteredExpenses.filter((e) => e.category === 'utilities').reduce((s, e) => s + e.amount, 0),
    other: filteredExpenses.filter((e) => e.category === 'other').reduce((s, e) => s + e.amount, 0),
  };

  const getCategoryLabel = (cat: ExpenseItem['category']) => {
    switch (cat) {
      case 'shipping':
        return isBn ? 'এয়ার ফ্রাইট ও শিপিং চার্জ' : 'Flight & Freight Cargo';
      case 'daily_cost':
        return isBn ? 'ডেইলি কস্ট (Daily Cost)' : 'Daily Cost';
      case 'warehouse_rent':
        return isBn ? 'ওয়্যারহাউজ ভাড়া ও লিজ' : 'Warehouse Rent & Maintenance';
      case 'salary':
        return isBn ? 'স্টাফ বেতন ও ওভারটাইম' : 'Staff Salary & Allowance';
      case 'customs':
        return isBn ? 'কাস্টমস শুল্ক ও এআইটি ট্যাক্স' : 'Customs Duty & Clearance';
      case 'packing_transport':
        return isBn ? 'প্যাকিং ও লোকাল ট্রান্সপোর্ট' : 'Packing & Local Transport';
      case 'utilities':
        return isBn ? 'ইউটিলিটি (বিদ্যুৎ/ইন্টারনেট)' : 'Utilities & Bills';
      default:
        return isBn ? 'অন্যান্য প্রশাসনিক খরচ' : 'Other Administrative Expenses';
    }
  };

  return (
    <div className="font-sans font-light">
      {/* Screen Interactive UI (Hidden during Print) */}
      <div className="print:hidden space-y-5">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        {/* 1. Top Section Header */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3.5 ${isDark ? 'border-[#1E3247]' : 'border-slate-200'}`}>
          <div>
            <h1 className={`text-lg md:text-xl font-normal flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <Wallet className="w-5 h-5 text-[#00897B]" />
              <span>{isBn ? 'বাজেট ও আয়-ব্যয় রিপোর্ট (Budget & Financial Statement)' : 'Budget & Expense Analytics'}</span>
            </h1>
            <p className={`text-xs mt-0.5 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>
              {isBn
                ? 'কোম্পানির সকল খাতের খরচ, আয়ের সাথে নিট পার্থক্য, স্মার্ট তারিখ ফিল্টার ও দৈনিক/মাসিক/বাৎসরিক আর্থিক রিপোর্ট'
                : 'Itemized expense tracking, profit & loss analysis, smart date filters & automated financial statements'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-none border text-xs font-light ${
              isDark ? 'bg-[#0B1622] border-[#1E3247] text-[#8FA3AD]' : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}>
              <span className="w-2 h-2 rounded-full bg-[#00897B] animate-pulse" />
              <span>{isBn ? 'অ্যাকাউন্টস ম্যানেজার প্যানেল থেকে সিঙ্ককৃত' : 'Live Synced from Accountant Panel'}</span>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-none text-xs font-normal bg-[#00897B] hover:bg-[#00796B] text-white transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="font-light">{isBn ? 'নতুন খরচ যোগ করুন' : 'Record New Expense'}</span>
            </button>
          </div>
        </div>

        {/* 2. Top Summary KPI Cards (Income vs Expense Difference) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Income */}
          <div className={`p-5 rounded-none border transition-all ${
            isDark
              ? 'bg-[#1E293B] border-[#1E3247] text-white'
              : 'bg-white border-slate-200 text-slate-900 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'মোট কার্গো বুকিং আয়' : 'Total Cargo Revenue'}</span>
              <div className="text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold font-mono mt-2 text-emerald-600 dark:text-emerald-400">৳{totalCargoIncome.toLocaleString()}</p>
            <p className={`text-[11px] mt-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'বিতরণকৃত ও বুকড কার্টুন রাজস্ব' : 'Delivered & booked cargo fees'}</p>
          </div>

          {/* Card 2: Total Expense */}
          <div className={`p-5 rounded-none border transition-all ${
            isDark
              ? 'bg-[#1E293B] border-[#1E3247] text-white'
              : 'bg-white border-slate-200 text-slate-900 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'ফিল্টারকৃত মোট ব্যয়' : 'Total Filtered Expense'}</span>
              <div className="text-rose-600 dark:text-rose-400">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold font-mono mt-2 text-rose-600 dark:text-rose-400">৳{totalFilteredExpense.toLocaleString()}</p>
            <p className={`text-[11px] mt-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>
              {isBn ? `${filteredExpenses.length} টি ভাউচারের মোট খরচ` : `Sum of ${filteredExpenses.length} expense entries`}
            </p>
          </div>

          {/* Card 3: Net Profit / Difference */}
          <div className={`p-5 rounded-none border transition-all ${
            isDark
              ? 'bg-[#1E293B] border-[#1E3247] text-white'
              : 'bg-white border-slate-200 text-slate-900 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'আয়-ব্যয়ের নিট পার্থক্য' : 'Net Profit / Difference'}</span>
              <div className={netProfitOrLoss >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600'}>
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <p className={`text-xl font-bold font-mono mt-2 ${netProfitOrLoss >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-rose-700'}`}>
              {netProfitOrLoss >= 0 ? '+' : ''}৳{netProfitOrLoss.toLocaleString()}
            </p>
            <p className={`text-[11px] mt-1 font-light ${netProfitOrLoss >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700'}`}>
              {isBn ? `মার্জিন: ${netMarginPercent}% লাভ` : `Net Margin: ${netMarginPercent}% Profit`}
            </p>
          </div>

          {/* Card 4: Expense Ratio */}
          <div className={`p-5 rounded-none border ${
            isDark
              ? 'bg-[#1E293B] border-[#1E3247] text-white'
              : 'bg-white border-slate-200 text-slate-900 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'ব্যয়ের শতাংশ (Ratio)' : 'Expense-to-Income Ratio'}</span>
              <div className="text-purple-600 dark:text-purple-400">
                <PieChart className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold font-mono mt-2 text-purple-700 dark:text-purple-400">{expenseRatio}%</p>
            <p className={`text-[11px] mt-1 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{isBn ? 'আয়ের বিপরীতে খরচ' : 'Expense % of total income'}</p>
          </div>
        </div>

        {/* 3. Smart Date Filter Bar */}
        <div className={`p-4 rounded-none border flex flex-wrap items-center justify-between gap-3 text-xs ${
          isDark ? 'bg-[#1E293B] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
        }`}>
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative min-w-[220px]">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-400'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isBn ? 'খরচের বিবরণ বা ভাউচার খুঁজুন...' : 'Search expense title or voucher...'}
                className={`w-full border rounded-none py-1.5 pl-8 pr-3 text-xs outline-none font-light ${
                  isDark ? 'bg-[#0B1622] border-[#1E3247] text-white placeholder-[#8FA3AD]' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white border-0 bg-transparent cursor-pointer">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Selector */}
            <div className={`flex items-center space-x-2 border rounded-none px-2.5 py-1.5 ${isDark ? 'bg-[#0B1622] border-[#1E3247] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}>
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent outline-none cursor-pointer text-xs font-light dark:bg-[#0B1622] dark:text-white"
              >
                <option value="all">{isBn ? 'সব খাতের খরচ (All Categories)' : 'All Expense Categories'}</option>
                <option value="shipping">এয়ার ফ্রাইট ও শিপিং চার্জ</option>
                <option value="warehouse_rent">ওয়্যারহাউজ ভাড়া ও লিজ</option>
                <option value="salary">স্টাফ বেতন ও ওভারটাইম</option>
                <option value="customs">কাস্টমস শুল্ক ও ট্যাক্স</option>
                <option value="packing_transport">প্যাকিং ও ট্রান্সপোর্ট</option>
                <option value="utilities">ইউটিলিটি ও বিল</option>
              </select>
            </div>

            {/* 📅 Smart Date Filter Selector */}
            <div className={`flex items-center space-x-2 border rounded-none px-2.5 py-1.5 ${isDark ? 'bg-[#0B1622] border-[#1E3247] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}>
              <Calendar className="w-3.5 h-3.5 text-[#00897B]" />
              <select
                value={dateFilterType}
                onChange={(e) => setDateFilterType(e.target.value as DateFilterMode)}
                className="bg-transparent outline-none cursor-pointer text-xs font-light dark:bg-[#0B1622] dark:text-white"
              >
                <option value="all">{isBn ? '📅 সব সময় (All Time)' : '📅 All Time'}</option>
                <option value="single_date">{isBn ? '📅 নির্দিষ্ট তারিখ (Specific Date)' : '📅 Specific Date'}</option>
                <option value="date_range">{isBn ? '📆 তারিখ থেকে তারিখ (Date Range)' : '📆 Date Range'}</option>
                <option value="single_month">{isBn ? '🗓️ নির্দিষ্ট মাস (Specific Month)' : '🗓️ Specific Month'}</option>
                <option value="month_range">{isBn ? '🗓️ মাস থেকে মাস (Month Range)' : '🗓️ Month Range'}</option>
                <option value="single_year">{isBn ? '📊 নির্দিষ্ট বছর (Specific Year)' : '📊 Specific Year'}</option>
                <option value="year_range">{isBn ? '📊 বছর থেকে বছর (Year Range)' : '📊 Year Range'}</option>
              </select>
            </div>

            {/* Dynamic Inputs Based on Date Filter Type */}
            {dateFilterType === 'single_date' && (
              <div className={`flex items-center space-x-2 border rounded-none px-2.5 py-1.5 ${isDark ? 'bg-[#0B1622] border-[#1E3247] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}>
                <span className="text-[11px] font-light">{isBn ? 'তারিখ:' : 'Date:'}</span>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="bg-transparent outline-none text-xs font-mono cursor-pointer dark:bg-[#0B1622] dark:text-white"
                />
              </div>
            )}

            {dateFilterType === 'date_range' && (
              <div className="flex items-center space-x-2">
                <div className={`flex items-center space-x-2 border rounded-none px-2.5 py-1.5 ${isDark ? 'bg-[#0B1622] border-[#1E3247] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}>
                  <span className="text-[11px] font-light">{isBn ? 'হতে:' : 'From:'}</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent outline-none text-xs font-mono cursor-pointer dark:bg-[#0B1622] dark:text-white"
                  />
                </div>
                <div className={`flex items-center space-x-2 border rounded-none px-2.5 py-1.5 ${isDark ? 'bg-[#0B1622] border-[#1E3247] text-white' : 'bg-slate-50 border-slate-300 text-slate-900'}`}>
                  <span className="text-[11px] font-light">{isBn ? 'পর্যন্ত:' : 'To:'}</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent outline-none text-xs font-mono cursor-pointer dark:bg-[#0B1622] dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* Reset Date Filter Button */}
            {dateFilterType !== 'all' && (
              <button
                onClick={resetDateFilters}
                className={`px-2.5 py-1.5 rounded-none border text-xs font-light flex items-center space-x-1 cursor-pointer outline-none transition-all ${
                  isDark
                    ? 'bg-[#0B1622] hover:bg-[#1E3247] border-[#1E3247] text-rose-400'
                    : 'bg-white hover:bg-slate-50 border-slate-300 text-rose-600'
                }`}
                title={isBn ? 'তারিখ ফিল্টার রিসেট' : 'Reset Date Filter'}
              >
                <RotateCcw className="w-3 h-3 text-rose-500" />
                <span>{isBn ? 'রিসেট' : 'Reset'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. Category Wise Breakdown */}
        <div className={`p-5 rounded-none border space-y-4 shadow-sm ${
          isDark ? 'bg-[#1E293B] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E3247] pb-3">
            <h2 className="text-sm font-bold flex items-center space-x-2">
              <PieChart className="w-4 h-4 text-[#00897B]" />
              <span>{isBn ? 'খাতভিত্তিক খরচ বণ্টন (কি বাবদ কি খরচ হচ্ছে)' : 'Expense Breakdown by Category'}</span>
            </h2>
            <span className={`text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>
              {isBn ? 'ফিল্টারকৃত মোট খরচের শতাংশ' : '% Share of Total Expenses'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(categoryTotals).map(([catKey, catSum]) => {
              const pct = totalFilteredExpense > 0 ? ((catSum / totalFilteredExpense) * 100).toFixed(1) : '0';
              return (
                <div
                  key={catKey}
                  className={`p-4 rounded-none border flex flex-col justify-between transition-all ${
                    isDark ? 'bg-[#0B1622] border-[#1E3247]' : 'bg-slate-50 border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-normal ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {getCategoryLabel(catKey as ExpenseItem['category'])}
                      </span>
                      <span className={`text-xs font-mono font-normal ${isDark ? 'text-[#8FA3AD]' : 'text-slate-600'}`}>{pct}%</span>
                    </div>
                    <p className={`text-xl font-bold font-mono mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>৳{catSum.toLocaleString()}</p>
                  </div>

                  {/* Progress bar */}
                  <div className={`w-full h-2 rounded-none mt-3.5 overflow-hidden ${isDark ? 'bg-[#1E293B]' : 'bg-slate-200'}`}>
                    <div className="h-full bg-[#00897B] rounded-none transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. Daily / Monthly / Yearly Financial Report Statement Tabs */}
        <div className={`p-5 rounded-none border space-y-4 shadow-sm ${
          isDark ? 'bg-[#1E293B] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-[#1E3247] pb-3">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-[#00897B]" />
              <h2 className="text-sm font-bold">Periodical Financial Statements</h2>
            </div>

            <div className="flex items-center space-x-2">
              <div className={`flex rounded-none p-0.5 border ${isDark ? 'bg-[#0B1622] border-[#1E3247]' : 'bg-slate-100 border-slate-200'}`}>
                <button
                  onClick={() => setReportTab('daily')}
                  className={`px-3 py-1 rounded-none text-xs font-light transition-all cursor-pointer ${
                    reportTab === 'daily'
                      ? 'bg-[#00897B] text-white shadow-xs'
                      : isDark
                      ? 'text-[#8FA3AD] hover:text-white'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Daily Report
                </button>
                <button
                  onClick={() => setReportTab('monthly')}
                  className={`px-3 py-1 rounded-none text-xs font-light transition-all cursor-pointer ${
                    reportTab === 'monthly'
                      ? 'bg-[#00897B] text-white shadow-xs'
                      : isDark
                      ? 'text-[#8FA3AD] hover:text-white'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Monthly Report
                </button>
                <button
                  onClick={() => setReportTab('yearly')}
                  className={`px-3 py-1 rounded-none text-xs font-light transition-all cursor-pointer ${
                    reportTab === 'yearly'
                      ? 'bg-[#00897B] text-white shadow-xs'
                      : isDark
                      ? 'text-[#8FA3AD] hover:text-white'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Yearly Report
                </button>
              </div>

              <button
                onClick={() => window.print()}
                className={`p-1.5 px-3 rounded-none border text-xs font-light flex items-center space-x-1.5 transition-all cursor-pointer ${
                  isDark ? 'bg-[#0B1622] border-[#1E3247] text-white hover:bg-[#1E3247]' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
                title="Print / Export Report"
              >
                <Printer className="w-3.5 h-3.5 opacity-80" />
                <span className="hidden sm:inline font-light">Print</span>
              </button>
            </div>
          </div>

          {/* Report Content Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`uppercase text-[10px] tracking-wider border-b font-medium ${
                isDark ? 'bg-[#0B1622] text-[#8FA3AD] border-[#1E3247]' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                <tr>
                  <th className="p-3">Time Period / Date</th>
                  <th className="p-3">Total Cargo Revenue (৳)</th>
                  <th className="p-3">Total Operating Expense (৳)</th>
                  <th className="p-3">Net Profit / Loss (৳)</th>
                  <th className="p-3">Expense Ratio (%)</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#1E3247]' : 'divide-slate-200'}`}>
                {reportTab === 'daily' && (
                  <tr className={`transition-colors ${isDark ? 'hover:bg-[#1E3247]/40' : 'hover:bg-slate-50'}`}>
                    <td className={`p-3 font-normal ${isDark ? 'text-white' : 'text-slate-900'}`}>Today (August 2026)</td>
                    <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">৳{totalCargoIncome.toLocaleString()}</td>
                    <td className="p-3 font-mono text-rose-500 dark:text-rose-400">৳{totalFilteredExpense.toLocaleString()}</td>
                    <td className="p-3 font-mono font-bold text-teal-600 dark:text-teal-400">
                      {netProfitOrLoss >= 0 ? '+' : ''}৳{netProfitOrLoss.toLocaleString()}
                    </td>
                    <td className="p-3 font-mono">{expenseRatio}%</td>
                    <td className="p-3 text-right font-normal text-emerald-600 dark:text-emerald-400">
                      {netProfitOrLoss >= 0 ? `Surplus (Profit ${netMarginPercent}%)` : 'Deficit (Loss)'}
                    </td>
                  </tr>
                )}

                {reportTab === 'monthly' && (
                  <tr className={`transition-colors ${isDark ? 'hover:bg-[#1E3247]/40' : 'hover:bg-slate-50'}`}>
                    <td className={`p-3 font-normal ${isDark ? 'text-white' : 'text-slate-900'}`}>August 2026 (Current Month)</td>
                    <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">৳{totalCargoIncome.toLocaleString()}</td>
                    <td className="p-3 font-mono text-rose-500 dark:text-rose-400">৳{totalFilteredExpense.toLocaleString()}</td>
                    <td className="p-3 font-mono font-bold text-teal-600 dark:text-teal-400">
                      {netProfitOrLoss >= 0 ? '+' : ''}৳{netProfitOrLoss.toLocaleString()}
                    </td>
                    <td className="p-3 font-mono">{expenseRatio}%</td>
                    <td className="p-3 text-right font-normal text-emerald-600 dark:text-emerald-400">
                      {netProfitOrLoss >= 0 ? `Surplus (Profit ${netMarginPercent}%)` : 'Deficit (Loss)'}
                    </td>
                  </tr>
                )}

                {reportTab === 'yearly' && (
                  <tr className={`transition-colors ${isDark ? 'hover:bg-[#1E3247]/40' : 'hover:bg-slate-50'}`}>
                    <td className={`p-3 font-normal ${isDark ? 'text-white' : 'text-slate-900'}`}>YTD 2026 (Fiscal Year 2026)</td>
                    <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">৳{totalCargoIncome.toLocaleString()}</td>
                    <td className="p-3 font-mono text-rose-500 dark:text-rose-400">৳{totalFilteredExpense.toLocaleString()}</td>
                    <td className="p-3 font-mono font-bold text-teal-600 dark:text-teal-400">
                      {netProfitOrLoss >= 0 ? '+' : ''}৳{netProfitOrLoss.toLocaleString()}
                    </td>
                    <td className="p-3 font-mono">{expenseRatio}%</td>
                    <td className="p-3 text-right font-normal text-emerald-600 dark:text-emerald-400">
                      {netProfitOrLoss >= 0 ? `Annual Net Profit (${netMarginPercent}%)` : 'Deficit (Loss)'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6. Itemized Expenses Audit Ledger Table */}
        <div className={`border rounded-none overflow-hidden shadow-sm ${
          isDark ? 'bg-[#1E293B] border-[#1E3247] text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="p-4 border-b border-slate-200 dark:border-[#1E3247] flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-[#00897B]" />
              <span>Itemized Expenses Ledger</span>
            </h2>
            <span className={`text-xs font-mono ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>
              {filteredExpenses.length} entries
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`uppercase text-[10px] tracking-wider border-b font-medium ${
                isDark ? 'bg-[#0B1622] text-[#8FA3AD] border-[#1E3247]' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Voucher No</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Description / Title</th>
                  <th className="p-3.5">Payment Method</th>
                  <th className="p-3.5 text-right">Amount (৳)</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#1E3247]' : 'divide-slate-200'}`}>
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`p-6 text-center text-xs font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>
                      {isBn ? 'কোনো খরচের ভাউচার পাওয়া যায়নি' : 'No expenses found matching your filter'}
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => (
                    <tr key={exp.id} className={`transition-colors ${isDark ? 'hover:bg-[#1E3247]/40' : 'hover:bg-slate-50'}`}>
                      <td className={`p-3.5 font-mono ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{exp.date}</td>
                      <td className="p-3.5 font-mono font-bold text-[#00897B]">{exp.voucher_no}</td>
                      <td className="p-3.5">
                        <span className={`font-normal text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {getCategoryLabel(exp.category)}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <p className={`font-normal text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{exp.title}</p>
                        {exp.notes && <p className={`text-[11px] mt-0.5 font-light ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>{exp.notes}</p>}
                      </td>
                      <td className={`p-3.5 font-mono uppercase text-[11px] ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>
                        {exp.payment_method.replace('_', ' ')}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-sm text-rose-600 dark:text-rose-400">
                        ৳{exp.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 7. Record New Expense Modal (Sleek, Spacious & Executive Design) */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in-50 duration-200">
            <div className={`w-full max-w-2xl rounded-2xl border p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in zoom-in-95 duration-200 ${
              isDark ? 'bg-[#1E293B] border-[#1FB6A8]/40 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              {/* Modal Header Bar */}
              <div className="flex items-start justify-between border-b pb-4 border-slate-200 dark:border-[#1E3247]">
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 rounded-xl bg-[#00897B]/10 dark:bg-[#00897B]/20 flex items-center justify-center text-[#00897B] font-bold shadow-xs">
                    <PlusCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-poppins flex items-center space-x-2">
                      <span>{isBn ? 'নতুন খরচ / ভাউচার রেকর্ড এন্ট্রি' : 'Record New Expense Voucher'}</span>
                    </h3>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-500'}`}>
                      {isBn ? 'কোম্পানির যেকোনো খরচের ভাউচার ইনপুট দিন (সুপার এডমিনে অটো সিঙ্ক)' : 'Enter operational expense details live-synced with Super Admin'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateExpense} className="space-y-5 text-xs">
                {/* 1. Title Input (Full Width) */}
                <div>
                  <label className={`block font-semibold mb-1.5 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-700'}`}>
                    {isBn ? 'খরচের বিবরণ / শিরোনাম *' : 'Expense Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    placeholder={isBn ? 'যেমন: ঢাকা ওয়্যারহাউজ আগস্ট লিজ বা ফ্ল্যাট ফ্রাইট ফি' : 'e.g. Flight Charter Cargo Fee'}
                    className={`w-full border rounded-xl p-3 text-sm outline-none transition-all font-medium ${
                      isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1FB6A8] focus:ring-2 focus:ring-[#1FB6A8]/20' : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20'
                    }`}
                  />
                </div>

                {/* 2. Category & Amount (2 Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block font-semibold mb-1.5 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-700'}`}>
                      {isBn ? 'খরচের খাত / ক্যাটাগরি *' : 'Expense Category *'}
                    </label>
                    <select
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value as ExpenseItem['category'])}
                      className={`w-full border rounded-xl p-3 text-xs outline-none transition-all font-medium ${
                        isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1FB6A8]' : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-[#00897B]'
                      }`}
                    >
                      <option value="shipping">✈️ Flight Cargo & Shipping Fee</option>
                      <option value="daily_cost">🗓️ Daily Cost (ডেইলি কস্ট)</option>
                      <option value="warehouse_rent">🏢 Warehouse Rent & Maintenance</option>
                      <option value="salary">👥 Staff Salary & Allowance</option>
                      <option value="customs">🛃 Customs Duty & Clearance</option>
                      <option value="packing_transport">🚚 Packing & Local Transport</option>
                      <option value="utilities">⚡ Utilities & Bills</option>
                      <option value="other">📦 Other Administrative Expenses</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block font-semibold mb-1.5 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-700'}`}>
                      {isBn ? 'টাকার পরিমাণ (BDT ৳) *' : 'Amount (BDT ৳) *'}
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      placeholder="e.g. 50000"
                      className={`w-full border rounded-xl p-3 text-sm outline-none font-mono font-bold transition-all ${
                        isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1FB6A8] focus:ring-2 focus:ring-[#1FB6A8]/20' : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-[#00897B] focus:ring-2 focus:ring-[#00897B]/20'
                      }`}
                    />
                  </div>
                </div>

                {/* 3. Expense Date & Payment Method (2 Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block font-semibold mb-1.5 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-700'}`}>
                      {isBn ? 'খরচের তারিখ *' : 'Expense Date *'}
                    </label>
                    <input
                      type="date"
                      required
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      className={`w-full border rounded-xl p-3 text-xs font-mono outline-none transition-all ${
                        isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1FB6A8]' : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-[#00897B]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block font-semibold mb-1.5 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-700'}`}>
                      {isBn ? 'পেমেন্ট মেথড *' : 'Payment Method *'}
                    </label>
                    <select
                      value={expPaymentMethod}
                      onChange={(e) => setExpPaymentMethod(e.target.value as ExpenseItem['payment_method'])}
                      className={`w-full border rounded-xl p-3 text-xs outline-none transition-all font-medium ${
                        isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1FB6A8]' : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-[#00897B]'
                      }`}
                    >
                      <option value="bank_transfer">🏦 Bank Transfer (ব্যাংক ট্রান্সফার)</option>
                      <option value="cash">💵 Cash (ক্যাশ পেমেন্ট)</option>
                      <option value="mobile_banking">📱 Mobile Banking (bKash/Nagad)</option>
                    </select>
                  </div>
                </div>

                {/* 4. Voucher No & Notes (2 Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block font-semibold mb-1.5 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-700'}`}>
                      {isBn ? 'ভাউচার নম্বর (ঐচ্ছিক):' : 'Voucher No (Optional):'}
                    </label>
                    <input
                      type="text"
                      value={expVoucherNo}
                      onChange={(e) => setExpVoucherNo(e.target.value)}
                      placeholder="e.g. VCH-8812"
                      className={`w-full border rounded-xl p-3 text-xs outline-none font-mono transition-all ${
                        isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1FB6A8]' : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-[#00897B]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block font-semibold mb-1.5 ${isDark ? 'text-[#8FA3AD]' : 'text-slate-700'}`}>
                      {isBn ? 'নোট / অতিরিক্ত তথ্য:' : 'Notes / References:'}
                    </label>
                    <input
                      type="text"
                      value={expNotes}
                      onChange={(e) => setExpNotes(e.target.value)}
                      placeholder={isBn ? 'অতিরিক্ত তথ্য বা রেফারেন্স...' : 'Add notes or reference...'}
                      className={`w-full border rounded-xl p-3 text-xs outline-none font-medium transition-all ${
                        isDark ? 'bg-[#0B1622] border-[#1E3247] text-white focus:border-[#1FB6A8]' : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-[#00897B]'
                      }`}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-[#1E3247]">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className={`px-5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      isDark ? 'bg-[#0B1622] border-[#1E3247] text-[#8FA3AD] hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>

                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#00897B] to-[#00796B] hover:from-[#00796B] hover:to-[#00695C] text-white transition-all cursor-pointer shadow-md flex items-center space-x-2"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{isBn ? 'খরচ সংরক্ষণ করুন' : 'Save Expense Voucher'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* 8. OFFICIAL EXECUTIVE PRINTABLE REPORT */}
      <div className="hidden print:block printable-document text-slate-900 bg-white p-6 font-sans">
        {/* Company Official Letterhead */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-black tracking-wider text-slate-900">M/S FOUR STAR CARGO</span>
            </div>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">মেসার্স ফোর স্টার কার্গো — আন্তর্জাতিক কার্গো ও এক্সপ্রেস শিপিং</p>
            <p className="text-[11px] text-slate-600 mt-1">
              House #12, Road #04, Sector #03, Uttara Commercial Hub, Dhaka-1230, Bangladesh
            </p>
            <p className="text-[11px] text-slate-600">
              Phone: +880 1711-000000, +880 1819-000000 | Email: accounts@fourstarcargo.com
            </p>
          </div>

          <div className="text-right border-l pl-4 border-slate-300">
            <span className="inline-block px-2.5 py-1 bg-[#1E293B] text-white text-[10px] font-bold tracking-widest uppercase rounded-none">
              Official Document
            </span>
            <p className="text-xs font-mono font-bold text-slate-900 mt-2">Ref: FSC-FIN-2026-0815</p>
            <p className="text-xs text-slate-700 mt-0.5">Issue Date: {new Date().toLocaleDateString('en-GB')}</p>
            <p className="text-xs text-slate-700">Scope: {dateFilterType === 'all' ? 'All Time Financials' : dateFilterType}</p>
          </div>
        </div>

        {/* Document Title */}
        <div className="text-center bg-slate-100 py-3 rounded-none border border-slate-300 mb-6">
          <h1 className="text-lg font-bold tracking-wide uppercase text-slate-900">
            {isBn ? 'কোম্পানি বাজেট ও আয়-ব্যয় অডিট রিপোর্ট' : 'OFFICIAL FINANCIAL STATEMENT & EXPENSE AUDIT REPORT'}
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Executive Summary & Itemized Operational Expense Ledger — Prepared for Board of Directors
          </p>
        </div>

        {/* 4 Key Summary Financial KPI Boxes */}
        <div className="grid grid-cols-4 gap-3 mb-6 text-center">
          <div className="p-3 border border-slate-300 rounded-none bg-slate-50">
            <p className="text-[10px] font-bold text-slate-600 uppercase">Total Revenue (আয়)</p>
            <p className="text-base font-bold font-mono text-emerald-700 mt-1">৳{totalCargoIncome.toLocaleString()}</p>
          </div>
          <div className="p-3 border border-slate-300 rounded-none bg-slate-50">
            <p className="text-[10px] font-bold text-slate-600 uppercase">Total Expense (ব্যয়)</p>
            <p className="text-base font-bold font-mono text-rose-700 mt-1">৳{totalFilteredExpense.toLocaleString()}</p>
          </div>
          <div className="p-3 border border-slate-300 rounded-none bg-slate-50">
            <p className="text-[10px] font-bold text-slate-600 uppercase">Net Surplus (লাভ)</p>
            <p className="text-base font-bold font-mono text-teal-800 mt-1">+৳{netProfitOrLoss.toLocaleString()}</p>
          </div>
          <div className="p-3 border border-slate-300 rounded-none bg-slate-50">
            <p className="text-[10px] font-bold text-slate-600 uppercase">Expense Ratio</p>
            <p className="text-base font-bold font-mono text-slate-900 mt-1">{expenseRatio}%</p>
          </div>
        </div>

        {/* Category Breakdown Table */}
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2">
            1. Expense Breakdown by Category (খাতভিত্তিক পরিচালন খরচ)
          </h3>
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-200 text-slate-900 font-bold uppercase text-[10px]">
                <th className="border border-slate-300 p-2 text-left">Category Name (খাতের নাম)</th>
                <th className="border border-slate-300 p-2 text-center">% Share</th>
                <th className="border border-slate-300 p-2 text-right">Total Amount (৳)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(categoryTotals).map(([catKey, catSum]) => {
                const pct = totalFilteredExpense > 0 ? ((catSum / totalFilteredExpense) * 100).toFixed(1) : '0';
                return (
                  <tr key={catKey} className="border-b border-slate-200">
                    <td className="border border-slate-300 p-2 font-medium">{getCategoryLabel(catKey as ExpenseItem['category'])}</td>
                    <td className="border border-slate-300 p-2 text-center font-mono">{pct}%</td>
                    <td className="border border-slate-300 p-2 text-right font-mono font-bold">৳{catSum.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Itemized Expense Ledger Table */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2">
            2. Itemized Expense Vouchers Ledger (খরচের ভাউচার অডিট তালিকা)
          </h3>
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-200 text-slate-900 font-bold uppercase text-[10px]">
                <th className="border border-slate-300 p-2">Date</th>
                <th className="border border-slate-300 p-2">Voucher No</th>
                <th className="border border-slate-300 p-2">Category</th>
                <th className="border border-slate-300 p-2">Title & Description</th>
                <th className="border border-slate-300 p-2">Payment</th>
                <th className="border border-slate-300 p-2 text-right">Amount (৳)</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((exp) => (
                <tr key={exp.id} className="border-b border-slate-200">
                  <td className="border border-slate-300 p-2 font-mono">{exp.date}</td>
                  <td className="border border-slate-300 p-2 font-mono font-bold text-teal-800">{exp.voucher_no}</td>
                  <td className="border border-slate-300 p-2 font-semibold">{getCategoryLabel(exp.category)}</td>
                  <td className="border border-slate-300 p-2">
                    <p className="font-semibold text-slate-900">{exp.title}</p>
                    {exp.notes && <p className="text-[10px] text-slate-600">{exp.notes}</p>}
                  </td>
                  <td className="border border-slate-300 p-2 uppercase text-[10px]">{exp.payment_method.replace('_', ' ')}</td>
                  <td className="border border-slate-300 p-2 text-right font-mono font-bold text-rose-800">৳{exp.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Official Signatures & Seal Section */}
        <div className="pt-8 mt-12 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs">
          <div>
            <div className="h-12 border-b border-dashed border-slate-400 mb-2 flex items-end justify-center">
              <span className="text-[10px] text-slate-400 font-mono italic">[ Signed Electronically ]</span>
            </div>
            <p className="font-bold text-slate-900">Prepared By</p>
            <p className="text-[10px] text-slate-600">Senior Accountant & Manager</p>
          </div>

          <div>
            <div className="h-12 border-b border-dashed border-slate-400 mb-2 flex items-end justify-center">
              <span className="text-[10px] text-slate-400 font-mono italic">[ Signed Electronically ]</span>
            </div>
            <p className="font-bold text-slate-900">Verified By</p>
            <p className="text-[10px] text-slate-600">Head of Finance & Audit</p>
          </div>

          <div>
            <div className="h-12 border-b border-dashed border-slate-400 mb-2 flex items-end justify-center">
              <span className="text-[10px] text-slate-400 font-mono italic">[ Official Seal Approved ]</span>
            </div>
            <p className="font-bold text-slate-900">Approved By</p>
            <p className="text-[10px] text-slate-600">Managing Director / Super Admin</p>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <div className="mt-8 text-center text-[10px] text-slate-500 border-t pt-3">
          <p>This is a system-generated official financial statement from M/S Four Star Cargo ERP. Confidential & Proprietary.</p>
        </div>
      </div>
    </div>
  );
};
