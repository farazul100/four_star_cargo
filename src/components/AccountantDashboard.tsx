import React, { useState } from 'react';
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
  UserCheck,
  Building2,
  XCircle,
  FileText,
} from 'lucide-react';
import { Customer, LedgerEntry, User, Language, ExpenseItem } from '../types';
import { ToastContainer, ToastMessage } from './Toast';
import { BudgetExpenseManager } from './BudgetExpenseManager';
import { saveHostingerDbData } from '../lib/db';

interface AccountantDashboardProps {
  ledgerEntries: LedgerEntry[];
  setLedgerEntries: React.Dispatch<React.SetStateAction<LedgerEntry[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  expenses?: ExpenseItem[];
  setExpenses?: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
  currentUser: User;
  language: Language;
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
}) => {
  const isBn = language === 'bn';

  // Toast feedback
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: `toast-${Date.now()}`, type, title, message }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // State: Active View Mode ('directory' | 'detail' | 'reports' | 'expenses')
  const [viewMode, setViewMode] = useState<'directory' | 'detail' | 'reports' | 'expenses'>('directory');
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

  // --------------------------------------------------------------------------
  // TAB 0: EXPENSE & BUDGET MANAGEMENT VIEW
  // --------------------------------------------------------------------------
  if (viewMode === 'expenses') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#1E3247] pb-3">
          <button
            onClick={() => setViewMode('directory')}
            className="flex items-center space-x-2 text-xs font-semibold text-[#8FA3AD] hover:text-[#1FB6A8] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{isBn ? 'কাস্টমার লেজারে ফিরে যান' : 'Back to Customer Ledger'}</span>
          </button>
        </div>
        <BudgetExpenseManager language={language} theme="dark" />
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

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E3247] pb-4">
          <div>
            <h2 className="text-xl font-bold text-white font-poppins flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5 text-[#1FB6A8]" />
              <span>{isBn ? 'ফিন্যান্সিয়াল লেজার ও ফিল্টারড রিপোর্টস' : 'Financial Ledger Activity Reports'}</span>
            </h2>
            <p className="text-xs text-[#8FA3AD]">
              {isBn ? 'তারিখ ও কাস্টমার অনুযায়ী ফিল্টার করে স্টেটমেন্ট ডাউনলোড করুন' : 'Date-range filtered ledger activity with CSV export'}
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center space-x-2 py-2.5 px-5 rounded-xl bg-[#1FB6A8] hover:bg-[#22A6B3] text-[#0F2D52] font-bold text-xs transition-all shadow-md"
          >
            <Download className="w-4 h-4" />
            <span>{isBn ? 'CSV লেজার স্টেটমেন্ট ডাউনলোড' : 'Export CSV Report'}</span>
          </button>
        </div>

        {/* Date Filter Bar */}
        <div className="bg-[#11202F] border border-[#1E3247] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-[#8FA3AD] block mb-1">{isBn ? 'শুরূতের তারিখ' : 'Start Date'}</label>
            <input
              type="date"
              value={reportStartDate}
              onChange={(e) => setReportStartDate(e.target.value)}
              className="w-full bg-[#0B1622] border border-[#1E3247] rounded-xl p-2 text-white font-mono outline-none"
            />
          </div>

          <div>
            <label className="text-[#8FA3AD] block mb-1">{isBn ? 'শেষের তারিখ' : 'End Date'}</label>
            <input
              type="date"
              value={reportEndDate}
              onChange={(e) => setReportEndDate(e.target.value)}
              className="w-full bg-[#0B1622] border border-[#1E3247] rounded-xl p-2 text-white font-mono outline-none"
            />
          </div>

          <div>
            <label className="text-[#8FA3AD] block mb-1">{isBn ? 'কাস্টমার ফিল্টার' : 'Filter Customer'}</label>
            <select
              value={reportCustFilter}
              onChange={(e) => setReportCustFilter(e.target.value)}
              className="w-full bg-[#0B1622] border border-[#1E3247] rounded-xl p-2 text-white outline-none"
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
        <div className="bg-[#11202F] border border-[#1E3247] rounded-3xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-[#1E3247] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">{isBn ? 'ফিল্টারড ট্রানজ্যাকশন এন্ট্রি' : 'Filtered Transaction Entries'}</h3>
            <span className="text-xs text-[#1FB6A8] font-mono">{reportEntries.length} Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#EAF2F5]">
              <thead className="bg-[#0B1622] text-[#8FA3AD] uppercase text-[10px] tracking-wider border-b border-[#1E3247]">
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
              <tbody className="divide-y divide-[#1E3247]">
                {reportEntries.map((re) => (
                  <tr key={re.id} className="hover:bg-[#1E3247]/40 transition-colors">
                    <td className="p-3.5 font-mono text-[#8FA3AD]">{re.created_at.split('T')[0]}</td>
                    <td className="p-3.5 font-mono text-[#1FB6A8] font-bold">{re.customer_code}</td>
                    <td className="p-3.5 font-bold text-white">{re.customer_name}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          re.type === 'charge'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {re.type}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold font-mono text-white">৳{re.amount.toLocaleString()}</td>
                    <td className="p-3.5 text-[#8FA3AD]">
                      {re.source === 'auto_cash_collection' ? (
                        <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Auto Cash ({re.entered_by_name})</span>
                        </span>
                      ) : (
                        <span>Manual ({re.entered_by_name})</span>
                      )}
                    </td>
                    <td className="p-3.5 text-[#8FA3AD]">{re.note}</td>
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
        <div className="flex items-center justify-between border-b border-[#1E3247] pb-4">
          <button
            onClick={() => setViewMode('directory')}
            className="flex items-center space-x-2 text-xs font-semibold text-[#8FA3AD] hover:text-[#1FB6A8] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{isBn ? 'কাস্টমার তালিকায় ফিরে যান' : 'Back to Customer Directory'}</span>
          </button>

          <button
            onClick={() => setShowAddLedgerModal(true)}
            className="flex items-center space-x-2 py-2 px-4 rounded-xl bg-[#1FB6A8] hover:bg-[#22A6B3] text-[#0F2D52] font-bold text-xs shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>{isBn ? 'ম্যানুয়াল লেজার এন্ট্রি করুন' : 'Add Manual Ledger Entry'}</span>
          </button>
        </div>

        {/* Customer Balance Header Card */}
        <div className="bg-gradient-to-r from-[#11202F] via-[#0F2D52] to-[#11202F] border border-[#1FB6A8]/30 rounded-3xl p-6 shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <span className="text-xs text-[#8FA3AD] uppercase font-bold tracking-wider">{selectedCust.customer_code}</span>
            <h2 className="text-xl font-extrabold text-white mt-1">{selectedCust.name}</h2>
            <p className="text-xs text-[#8FA3AD] mt-1">{selectedCust.phone} | {selectedCust.address}</p>
          </div>

          <div className="border-t sm:border-t-0 sm:border-l border-[#1E3247] pt-4 sm:pt-0 sm:pl-6 space-y-1">
            <span className="text-xs text-[#8FA3AD]">{isBn ? 'মোট চার্জ (Total Charges)' : 'Total Charges'}</span>
            <div className="text-lg font-bold text-amber-400 font-mono">৳{stats.totalCharges.toLocaleString()}</div>
            <span className="text-[11px] text-[#8FA3AD] block">{isBn ? 'মোট পরিশোধ (Total Paid)' : 'Total Paid'}: ৳{stats.totalPayments.toLocaleString()}</span>
          </div>

          <div className="border-t sm:border-t-0 sm:border-l border-[#1E3247] pt-4 sm:pt-0 sm:pl-6 space-y-1">
            <span className="text-xs text-[#8FA3AD]">{isBn ? 'বর্তমান নিট বকেয়া (Current Net Due)' : 'Current Net Outstanding Due'}</span>
            <div className="text-2xl font-extrabold text-[#1FB6A8] font-mono">৳{stats.currentDue.toLocaleString()}</div>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">
              ON-THE-FLY COMPUTED (LIVE)
            </span>
          </div>
        </div>

        {/* Timeline Ledger Entries List */}
        <div className="bg-[#11202F] border border-[#1E3247] rounded-3xl p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <FileText className="w-4 h-4 text-[#1FB6A8]" />
            <span>{isBn ? 'লেজার লেনদেন ইতিহাস (Chronological Timeline)' : 'Chronological Transaction History'}</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#EAF2F5]">
              <thead className="bg-[#0B1622] text-[#8FA3AD] uppercase text-[10px] tracking-wider border-b border-[#1E3247]">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Amount (BDT ৳)</th>
                  <th className="p-3.5">Source / Initiator</th>
                  <th className="p-3.5">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E3247]">
                {stats.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#1E3247]/40 transition-colors">
                    <td className="p-3.5 font-mono text-[#8FA3AD]">{entry.created_at.split('T')[0]}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center space-x-1 w-fit ${
                          entry.type === 'charge'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
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
                    <td className="p-3.5 font-bold font-mono text-white text-sm">৳{entry.amount.toLocaleString()}</td>
                    <td className="p-3.5 text-[#8FA3AD]">
                      {entry.source === 'auto_cash_collection' ? (
                        <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Auto-Cash ({entry.entered_by_name})</span>
                        </span>
                      ) : (
                        <span>Manual ({entry.entered_by_name})</span>
                      )}
                    </td>
                    <td className="p-3.5 text-[#8FA3AD]">{entry.note}</td>
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
              className="bg-[#11202F] border border-[#1FB6A8]/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95"
            >
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-[#1FB6A8]" />
                <span>{isBn ? 'ম্যানুয়াল লেজার এন্ট্রি ফরম' : 'Add Manual Ledger Entry'}</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[#8FA3AD] block mb-1">{isBn ? 'এন্ট্রি টাইপ (Type)' : 'Entry Type'}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEntryType('charge')}
                      className={`p-2.5 rounded-xl font-bold transition-all ${
                        entryType === 'charge'
                          ? 'bg-amber-500 text-black shadow-md'
                          : 'bg-[#0B1622] text-[#8FA3AD]'
                      }`}
                    >
                      CHARGE (বকেয়া চার্জ)
                    </button>

                    <button
                      type="button"
                      onClick={() => setEntryType('payment')}
                      className={`p-2.5 rounded-xl font-bold transition-all ${
                        entryType === 'payment'
                          ? 'bg-emerald-500 text-white shadow-md'
                          : 'bg-[#0B1622] text-[#8FA3AD]'
                      }`}
                    >
                      PAYMENT (পরিশোধ)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[#8FA3AD] block mb-1">{isBn ? 'টাকার পরিমাণ (BDT ৳)' : 'Amount (BDT ৳)'}</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(Number(e.target.value))}
                    className="w-full bg-[#0B1622] border border-[#1E3247] rounded-xl p-2.5 text-white font-bold font-mono outline-none focus:border-[#1FB6A8]"
                  />
                </div>

                <div>
                  <label className="text-[#8FA3AD] block mb-1">{isBn ? 'নোট / বিবরণ' : 'Description Note'}</label>
                  <input
                    type="text"
                    required
                    value={entryNote}
                    onChange={(e) => setEntryNote(e.target.value)}
                    placeholder="e.g. ব্যাংক ট্রান্সফার রসিদ #9901"
                    className="w-full bg-[#0B1622] border border-[#1E3247] rounded-xl p-2.5 text-white outline-none focus:border-[#1FB6A8]"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLedgerModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#0B1622] text-[#8FA3AD] text-xs font-semibold hover:text-white"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#1FB6A8] text-[#0F2D52] font-bold text-xs hover:bg-[#22A6B3]"
                >
                  {isBn ? 'এন্ট্রি সেভ করুন' : 'Save Entry'}
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
        <div className="bg-[#11202F] border border-[#1E3247] rounded-2xl p-5 space-y-2 card-hover-glow">
          <span className="text-xs text-[#8FA3AD]">{isBn ? 'সর্বমোট বকেয়া (Total Dues)' : 'Total Outstanding Dues'}</span>
          <div className="text-2xl font-extrabold text-[#1FB6A8] font-poppins">৳{totalCompanyDue.toLocaleString()}</div>
          <span className="text-[11px] text-[#8FA3AD]">{customers.length} Registered Customers</span>
        </div>

        <div className="bg-[#11202F] border border-[#1E3247] rounded-2xl p-5 space-y-2 card-hover-glow">
          <span className="text-xs text-[#8FA3AD]">{isBn ? 'কোম্পানি বাজেট ও খরচ' : 'Budget & Expense Vouchers'}</span>
          <button
            onClick={() => setViewMode('expenses')}
            className="w-full py-2 px-3 rounded-xl bg-[#00897B]/20 hover:bg-[#00897B]/30 text-[#00897B] text-xs font-bold transition-all border border-[#00897B]/30 text-left flex items-center justify-between cursor-pointer"
          >
            <span>{isBn ? 'খরচ ভাউচার এন্ট্রি →' : 'Manage Expenses & Budget →'}</span>
          </button>
        </div>

        <div className="bg-[#11202F] border border-[#1E3247] rounded-2xl p-5 space-y-2 card-hover-glow">
          <span className="text-xs text-[#8FA3AD]">{isBn ? 'রিপোর্ট মোড' : 'Quick Reports'}</span>
          <button
            onClick={() => setViewMode('reports')}
            className="w-full py-2 px-3 rounded-xl bg-[#1FB6A8]/20 hover:bg-[#1FB6A8]/30 text-[#1FB6A8] text-xs font-bold transition-all border border-[#1FB6A8]/30 text-left flex items-center justify-between cursor-pointer"
          >
            <span>{isBn ? 'স্টেটমেন্ট ও রিপোর্টস দেখুন →' : 'View Financial Reports →'}</span>
          </button>
        </div>

        <div className="bg-[#11202F] border border-[#1E3247] rounded-2xl p-5 space-y-2 card-hover-glow flex flex-col justify-between">
          <span className="text-xs text-[#8FA3AD]">{isBn ? 'কাস্টমার অ্যাকশন' : 'Customer Directory Action'}</span>
          <button
            onClick={() => setShowAddCustomerModal(true)}
            className="py-2 px-3 rounded-xl bg-[#1FB6A8] hover:bg-[#22A6B3] text-[#0F2D52] font-bold text-xs transition-all shadow-md flex items-center justify-center space-x-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isBn ? 'নতুন কাস্টমার' : 'Add Customer'}</span>
          </button>
        </div>
      </div>

      {/* Search & Sort Controls Bar */}
      <div className="bg-[#11202F] border border-[#1E3247] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-[#8FA3AD] absolute left-3 top-2.5" />
          <input
            type="text"
            value={custSearch}
            onChange={(e) => setCustSearch(e.target.value)}
            placeholder={isBn ? 'কাস্টমার নাম, কোড বা ফোন খুঁজুন...' : 'Search name, code or phone...'}
            className="w-full bg-[#0B1622] border border-[#1E3247] rounded-xl py-1.5 pl-9 pr-3 text-xs text-white placeholder-[#8FA3AD] outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setSortByDue(!sortByDue)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              sortByDue
                ? 'bg-[#1FB6A8] text-[#0F2D52] border-[#1FB6A8]'
                : 'bg-[#0B1622] text-[#8FA3AD] border-[#1E3247]'
            }`}
          >
            {isBn ? 'সর্বোচ্চ বকেয়া অনুযায়ী সাজান' : 'Sort by Highest Due'}
          </button>
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-[#11202F] border border-[#1E3247] rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#EAF2F5]">
            <thead className="bg-[#0B1622] text-[#8FA3AD] uppercase text-[10px] tracking-wider border-b border-[#1E3247]">
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
            <tbody className="divide-y divide-[#1E3247]">
              {paginatedCustomers.map((cust) => {
                const stats = getCustomerStats(cust.customer_code);
                return (
                  <tr key={cust.id} className="hover:bg-[#1E3247]/40 transition-colors">
                    <td className="p-3.5 font-bold font-mono text-[#1FB6A8]">{cust.customer_code}</td>
                    <td className="p-3.5 font-bold text-white">{cust.name}</td>
                    <td className="p-3.5 text-[#8FA3AD] font-mono">{cust.phone}</td>
                    <td className="p-3.5 text-amber-400 font-mono">৳{stats.totalCharges.toLocaleString()}</td>
                    <td className="p-3.5 text-emerald-400 font-mono">৳{stats.totalPayments.toLocaleString()}</td>
                    <td className="p-3.5 font-extrabold text-white text-sm font-mono">
                      ৳{stats.currentDue.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => {
                          setSelectedCustomerId(cust.id);
                          setViewMode('detail');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-[#1FB6A8] hover:bg-[#22A6B3] text-[#0F2D52] font-bold text-xs transition-all shadow-md"
                      >
                        {isBn ? 'লেজার বিবরণ দেখুন →' : 'View Ledger →'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-[#1E3247] flex items-center justify-between text-xs text-[#8FA3AD]">
          <div>
            Showing {paginatedCustomers.length} of {filteredCustomers.length} Customers
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={custPage === 1}
              onClick={() => setCustPage(custPage - 1)}
              className="p-1.5 rounded-lg bg-[#0B1622] disabled:opacity-40 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-white">
              {custPage} / {totalCustPages}
            </span>
            <button
              disabled={custPage >= totalCustPages}
              onClick={() => setCustPage(custPage + 1)}
              className="p-1.5 rounded-lg bg-[#0B1622] disabled:opacity-40 hover:text-white"
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
            className="bg-[#11202F] border border-[#1FB6A8]/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Users className="w-5 h-5 text-[#1FB6A8]" />
              <span>{isBn ? 'নতুন কাস্টমার তৈরি করুন' : 'Quick Add New Customer'}</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#8FA3AD] block mb-1">{isBn ? 'কাস্টমার কোড (Customer Code)' : 'Customer Code'}</label>
                <input
                  type="text"
                  required
                  value={newCustCode}
                  onChange={(e) => setNewCustCode(e.target.value)}
                  className="w-full bg-[#0B1622] border border-[#1E3247] rounded-xl p-2.5 text-white font-mono outline-none focus:border-[#1FB6A8]"
                />
              </div>

              <div>
                <label className="text-[#8FA3AD] block mb-1">{isBn ? 'কাস্টমার নাম *' : 'Customer Name *'}</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. গ্লোবাল ইলেকট্রনিক্স ট্রেডার্স"
                  className="w-full bg-[#0B1622] border border-[#1E3247] rounded-xl p-2.5 text-white outline-none focus:border-[#1FB6A8]"
                />
              </div>

              <div>
                <label className="text-[#8FA3AD] block mb-1">{isBn ? 'মোবাইল নম্বর' : 'Phone Number'}</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="01700000000"
                  className="w-full bg-[#0B1622] border border-[#1E3247] rounded-xl p-2.5 text-white font-mono outline-none focus:border-[#1FB6A8]"
                />
              </div>

              <div>
                <label className="text-[#8FA3AD] block mb-1">{isBn ? 'ঠিকানা' : 'Address'}</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="Dhaka, Bangladesh"
                  className="w-full bg-[#0B1622] border border-[#1E3247] rounded-xl p-2.5 text-white outline-none focus:border-[#1FB6A8]"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="px-4 py-2 rounded-xl bg-[#0B1622] text-[#8FA3AD] text-xs font-semibold hover:text-white"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#1FB6A8] text-[#0F2D52] font-bold text-xs hover:bg-[#22A6B3]"
              >
                {isBn ? 'কাস্টমার সেভ করুন' : 'Save Customer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
