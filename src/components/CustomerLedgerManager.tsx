import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  BarChart3,
  TrendingUp,
  Clock,
  Mail,
  Phone,
  Building2,
  DollarSign,
  FileText,
  ChevronRight,
  Package,
  Plus,
  CreditCard,
  Receipt,
  AlertTriangle,
  Send,
  Printer,
  Tag,
  MapPin,
  CheckCircle,
  Layers,
  Sparkles,
  Box,
} from 'lucide-react';
import { Customer, LedgerEntry, Carton, Language, Theme } from '../types';
import { getHostingerDbData, saveHostingerDbData, subscribeToDbUpdates, logSystemAuditAction, publishSystemNotification } from '../lib/db';
import { recalculateCustomerLedgerAndBilling, formatInvoiceNoteToEnglish } from '../lib/ledgerHelper';
import { INITIAL_CUSTOMERS, INITIAL_LEDGER } from '../mockData';
import { useTheme } from '../context/ThemeContext';
import { ToastContainer, ToastMessage } from './Toast';

interface CustomerLedgerManagerProps {
  language: Language;
  theme?: Theme;
}

const DB_KEYS = {
  CUSTOMERS: 'fsc_vps_customers',
  LEDGER: 'fsc_vps_ledger',
  CARTONS: 'fsc_vps_cartons',
  AUDIT: 'fsc_vps_audit',
};

class CustomerLedgerErrorBoundary extends React.Component<
  { children: React.ReactNode; isBn?: boolean },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('CustomerLedgerManager ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isBn = this.props.isBn;
      return (
        <div className="p-6 my-6 border border-rose-300 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 space-y-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
            <h2 className="text-base font-bold">
              {isBn ? 'কাস্টমার লেজার লোড করতে সাময়িক সমস্যা হয়েছে' : 'Customer Ledger Loading Issue Detected'}
            </h2>
          </div>
          <p className="text-xs">
            {isBn
              ? 'কাস্টমারের তথ্যে কোন অসম্পূর্ণ ফরমেট পাওয়ার কারণে এই পেজটি রেন্ডার করা যায়নি।'
              : 'Unable to render profile due to an invalid field format in customer data.'}
          </p>
          <div className="p-3 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 font-mono text-[11px] text-rose-700 dark:text-rose-300 overflow-x-auto">
            {this.state.error?.toString() || 'Render Exception'}
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 bg-[#00897B] hover:bg-[#00796B] text-white text-xs font-semibold cursor-pointer"
          >
            {isBn ? '🔄 পুনরায় পেজ লোড করুন' : '🔄 Refresh Page'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const CustomerLedgerManagerContent: React.FC<CustomerLedgerManagerProps> = ({
  language,
  theme: themeProp,
}) => {
  const { theme: contextTheme } = useTheme();
  const activeTheme = contextTheme || themeProp || 'light';
  const isDark = activeTheme === 'dark';
  const isBn = language === 'bn';

  // Live Database State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'vip' | 'paid'>('all');

  // Selected Customer View State (Full Dedicated Tracker Page View)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerActiveTab, setCustomerActiveTab] = useState<'products' | 'transactions'>('products');

  // Modals State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [customerForPayment, setCustomerForPayment] = useState<Customer | null>(null);
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);

  // Add Customer Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustShippingMark, setNewCustShippingMark] = useState('');
  const [newCustCompany, setNewCustCompany] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  // Payment Collection Form State
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'bkash' | 'nagad' | 'bank_wire' | 'check'>('bkash');
  const [payRefNo, setPayRefNo] = useState('');
  const [payNote, setPayNote] = useState('');

  // Custom Ledger Entry Form State
  const [entryType, setEntryType] = useState<'charge' | 'discount' | 'adjustment'>('charge');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDesc, setEntryDesc] = useState('');

  // Toast Helper
  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: `toast-${Date.now()}`, type, title, message }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load Data with Migration & Live Real-time Sync
  useEffect(() => {
    const loadDbData = () => {
      const recalculated = recalculateCustomerLedgerAndBilling(undefined, false);
      setCustomers(recalculated.customers);
      setLedgerEntries(recalculated.ledgerEntries);
      setCartons(recalculated.cartons);
    };

    loadDbData();
    return subscribeToDbUpdates(loadDbData);
  }, []);

  // Sync Customers to DB
  const syncCustomers = (updatedCusts: Customer[], auditMsg?: string) => {
    setCustomers(updatedCusts);
    saveHostingerDbData(DB_KEYS.CUSTOMERS, updatedCusts);

    if (auditMsg) {
      logSystemAuditAction(null, 'customer_management', 'customer', 'cust-sync', auditMsg);
    }
  };

  // Sync Ledger Entries to DB
  const syncLedger = (updatedLedger: LedgerEntry[]) => {
    setLedgerEntries(updatedLedger);
    saveHostingerDbData(DB_KEYS.LEDGER, updatedLedger);
  };

  // CREATE NEW CUSTOMER
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim() || !newCustShippingMark.trim()) {
      addToast('error', isBn ? 'তথ্য অসম্পূর্ণ' : 'Incomplete Form', isBn ? 'কাস্টমারের নাম, ফোন নম্বর ও শিপিং মার্ক দেওয়া বাধ্যতামূলক' : 'Name, Phone & Shipping Mark are required');
      return;
    }

    const formattedMark = newCustShippingMark.toUpperCase().trim();
    const custId = `cust-${Date.now().toString().slice(-4)}`;
    const custCode = `CUST-${Math.floor(1000 + Math.random() * 9000)}`;

    const newCustomer: Customer = {
      id: custId,
      customer_code: custCode,
      shipping_mark: formattedMark,
      name: newCustName.trim(),
      phone: newCustPhone.trim(),
      company_name: newCustCompany.trim() || undefined,
      address: newCustAddress.trim() || 'Dhaka, Bangladesh',
      total_billed: 0,
      total_paid: 0,
      total_due: 0,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    const updatedCusts = [newCustomer, ...customers];
    syncCustomers(updatedCusts, `New Customer Profile Registered: ${newCustomer.name} (${newCustomer.shipping_mark})`);

    // Reset
    setNewCustName('');
    setNewCustPhone('');
    setNewCustShippingMark('');
    setNewCustCompany('');
    setNewCustAddress('');
    setShowAddCustomerModal(false);

    addToast(
      'success',
      isBn ? 'নতুন কাস্টমার নিবন্ধন সম্পন্ন!' : 'Customer Registered!',
      isBn ? `${newCustomer.name} (মার্ক: ${newCustomer.shipping_mark}) সফলভাবে যুক্ত হয়েছে।` : `Mark ${newCustomer.shipping_mark} registered.`
    );
  };

  // SUBMIT PAYMENT RECEIVED (টাকা জমা নিন)
  const handleCollectPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForPayment) return;

    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      addToast('error', isBn ? 'অকার্যকর পরিমাণ' : 'Invalid Amount', isBn ? 'সঠিক টাকার পরিমাণ দিন' : 'Enter valid payment amount');
      return;
    }

    const newLedgerEntry: LedgerEntry = {
      id: `ledg-${Date.now()}`,
      customer_id: customerForPayment.id,
      customer_code: customerForPayment.customer_code,
      shipping_mark: customerForPayment.shipping_mark || 'MAR-8801',
      customer_name: customerForPayment.name,
      type: 'payment',
      amount: amount,
      payment_method: payMethod,
      reference_no: payRefNo.trim() || `TRX-${Date.now().toString().slice(-6)}`,
      note: payNote.trim() || `${payMethod.toUpperCase()} পেমেন্ট জমা নেওয়া হয়েছে`,
      source: 'manual',
      entered_by: 'usr-1',
      entered_by_name: 'তানভীর আহমেদ (Super Admin)',
      created_at: new Date().toISOString(),
    };

    // Update Customer Paid & Due
    const updatedCusts = customers.map((c) => {
      if (c.id === customerForPayment.id) {
        const newTotalPaid = (c.total_paid || 0) + amount;
        const newTotalDue = Math.max(0, (c.total_due || 0) - amount);
        return {
          ...c,
          total_paid: newTotalPaid,
          total_due: newTotalDue,
        };
      }
      return c;
    });

    const updatedLedger = [newLedgerEntry, ...ledgerEntries];
    syncLedger(updatedLedger);
    syncCustomers(updatedCusts, `Payment Received: ৳${amount.toLocaleString()} from ${customerForPayment.name} (${customerForPayment.shipping_mark}) via ${payMethod}`);

    // Update selectedCustomer if open
    if (selectedCustomer && selectedCustomer.id === customerForPayment.id) {
      setSelectedCustomer((prev) =>
        prev
          ? {
              ...prev,
              total_paid: (prev.total_paid || 0) + amount,
              total_due: Math.max(0, (prev.total_due || 0) - amount),
            }
          : null
      );
    }

    // Reset Form
    setPayAmount('');
    setPayRefNo('');
    setPayNote('');
    setCustomerForPayment(null);

    addToast(
      'success',
      isBn ? 'পেমেন্ট জমা সফল!' : 'Payment Received Successfully!',
      isBn ? `৳${amount.toLocaleString()} জমা হয়েছে (${customerForPayment.name})` : `৳${amount.toLocaleString()} credited.`
    );
  };

  const handleAddLedgerEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amt = parseFloat(entryAmount);
    if (isNaN(amt) || amt <= 0) {
      addToast('error', isBn ? 'ত্রুটি' : 'Error', isBn ? 'সঠিক টাকার পরিমাণ দিন' : 'Please enter a valid amount');
      return;
    }

    const newEntry: LedgerEntry = {
      id: `LEDG-${Date.now()}`,
      customer_id: selectedCustomer.id,
      customer_name: selectedCustomer.name,
      customer_code: selectedCustomer.customer_code || selectedCustomer.shipping_mark,
      date: new Date().toISOString().split('T')[0],
      description: entryDesc || (entryType === 'discount' ? 'Discount / Waiver' : 'Additional Charge / Fee'),
      debit: entryType === 'charge' ? amt : 0,
      credit: entryType === 'discount' || entryType === 'adjustment' ? amt : 0,
      balance: 0,
      reference_no: `ADJ-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    const updatedEntries = [newEntry, ...ledgerEntries];
    setLedgerEntries(updatedEntries);

    saveHostingerDbData('fsc_vps_ledger', updatedEntries);
    logSystemAuditAction('Super Admin', 'ADD_LEDGER_ENTRY', `Added ledger entry for ${selectedCustomer.name}: ৳${amt}`);

    const recalculated = recalculateCustomerLedgerAndBilling(selectedCustomer.id, true);
    if (recalculated && recalculated.updatedCustomers) {
      setCustomers(recalculated.updatedCustomers);
      const updatedSelected = recalculated.updatedCustomers.find((c) => c.id === selectedCustomer.id);
      if (updatedSelected) setSelectedCustomer(updatedSelected);
    }

    setShowAddEntryModal(false);
    setEntryAmount('');
    setEntryDesc('');
    addToast('success', isBn ? 'সফল' : 'Success', isBn ? 'এন্ট্রি সংরক্ষণ করা হয়েছে' : 'Ledger entry saved successfully');
  };

  // Helper to find cartons for a customer (by customer_id, customer_code, shipping_mark, or phone)
  const getCustomerCartons = (c: Customer) => {
    if (!c || !cartons || !Array.isArray(cartons) || cartons.length === 0) return [];

    const custId = String(c.id || '');
    const custCode = String(c.customer_code || '').toLowerCase().trim();
    const custName = String(c.name || '').toLowerCase().trim();
    const custPhone = String(c.phone || '').replace(/\D/g, '');

    const cleanMark = (str?: any) => String(str || '').toLowerCase().replace(/^mark:\s*/i, '').trim();
    const custMark = cleanMark(c.shipping_mark);

    return cartons.filter((ctn) => {
      if (!ctn) return false;

      // 1. Direct ID match
      if (ctn.customer_id && String(ctn.customer_id) === custId) return true;

      // 2. Customer Code match
      const ctnCustCode = String(ctn.customer_code || '').toLowerCase().trim();
      if (custCode && ctnCustCode && ctnCustCode === custCode) return true;

      // 3. Customer Name match
      const ctnCustName = String(ctn.customer_name || '').toLowerCase().trim();
      if (custName && ctnCustName && ctnCustName === custName) return true;

      // 4. Shipping Mark & Tracking Substring matching
      const cMark = cleanMark(ctn.shipping_mark);
      const cTrk = cleanMark(ctn.tracking_number);
      const cMaster = cleanMark(ctn.master_tracking_number);
      const cGroup = cleanMark(ctn.master_group_id);

      if (custMark) {
        if (
          cMark === custMark ||
          (cMark && custMark && (cMark.includes(custMark) || custMark.includes(cMark))) ||
          cTrk === custMark ||
          cMaster === custMark ||
          cGroup === custMark
        ) {
          return true;
        }
      }

      // 5. Phone / Digits matching (e.g. RK-01904019315 matching 01904019315)
      if (custPhone && custPhone.length >= 6) {
        if (cMark.includes(custPhone) || cTrk.includes(custPhone) || cMaster.includes(custPhone)) {
          return true;
        }
      }

      return false;
    });
  };

  // Filter Customers
  const filteredCustomers = customers.filter((c) => {
    if (!c) return false;
    if (statusFilter === 'due' && (c.total_due || 0) <= 0) return false;
    if (statusFilter === 'vip' && c.status !== 'vip') return false;
    if (statusFilter === 'paid' && (c.total_due || 0) > 0) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = String(c.name || '').toLowerCase().includes(q);
      const matchMark = String(c.shipping_mark || '').toLowerCase().includes(q);
      const matchPhone = String(c.phone || '').toLowerCase().includes(q);
      const matchCode = String(c.customer_code || '').toLowerCase().includes(q);
      if (!matchName && !matchMark && !matchPhone && !matchCode) return false;
    }
    return true;
  });

  // Calculate Overall Customer Financials with Clean Fallback Logic
  const totalBilledAll = customers.reduce(
    (sum, c) => sum + (c.total_billed && c.total_billed > 0 ? c.total_billed : (c.total_due || 0) + (c.total_paid || 0)),
    0
  );
  const totalPaidAll = customers.reduce((sum, c) => sum + (c.total_paid || 0), 0);
  const totalDueAll = customers.reduce((sum, c) => sum + (c.total_due || 0), 0);

  // Print Report Handler
  const handlePrintReport = () => {
    window.print();
  };

  const formatBdt = (val?: any) => {
    const num = Number(val);
    return isNaN(num) ? '0' : num.toLocaleString();
  };

  // =========================================================================
  // DEDICATED FULL-PAGE CUSTOMER PROFILE & LEDGER TRACKER VIEW
  // =========================================================================
  if (selectedCustomer) {
    const custName = String(selectedCustomer.name || 'Customer');
    const custMarkStr = String(selectedCustomer.shipping_mark || 'MAR-8801');
    const custPhoneStr = String(selectedCustomer.phone || '');
    const custEmailStr = String(selectedCustomer.email || '');
    const custAddressStr = String(selectedCustomer.address || '');

    const customerCartons = getCustomerCartons(selectedCustomer);
    const customerLedger = (ledgerEntries || []).filter(
      (ledg) =>
        ledg &&
        (String(ledg.customer_id || '') === String(selectedCustomer.id || '') ||
          (selectedCustomer.customer_code && String(ledg.customer_code || '') === String(selectedCustomer.customer_code)) ||
          (selectedCustomer.shipping_mark && String(ledg.customer_code || '') === String(selectedCustomer.shipping_mark)))
    );

    const totalWeightShipped = customerCartons.reduce((sum, c) => sum + (Number(c.gross_weight) || 0), 0);
    const totalCbmShipped = customerCartons.reduce((sum, c) => sum + (Number(c.cbm) || 0), 0);
    const billedVal =
      selectedCustomer.total_billed && selectedCustomer.total_billed > 0
        ? selectedCustomer.total_billed
        : (selectedCustomer.total_due || 0) + (selectedCustomer.total_paid || 0);

    return (
      <div className="space-y-6 font-sans">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        {/* =========================================================================
            1. SCREEN VIEW ONLY (HIDDEN WHEN PRINTING)
            ========================================================================= */}
        <div className="print:hidden space-y-6">
          {/* Top Back Navigation Bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedCustomer(null)}
              className={`px-4 py-2 rounded-none-none text-xs font-normal border transition-all cursor-pointer flex items-center space-x-2 shadow-2xs ${
                isDark
                  ? 'bg-[#1E293B] border-slate-700/80 text-slate-200 hover:bg-slate-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ChevronRight className="w-4 h-4 rotate-180 text-[#00897B]" />
              <span>{isBn ? '← কাস্টমার তালিকায় ফিরে যান' : '← Back to Customer List'}</span>
            </button>

            <div className="flex items-center space-x-2.5">
              <button
                onClick={() => setCustomerForPayment(selectedCustomer)}
                className="px-4 py-2 rounded-none-none text-xs font-normal bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer flex items-center space-x-1.5 shadow-2xs"
              >
                <DollarSign className="w-4 h-4" />
                <span>{isBn ? '💰 টাকা জমা নিন (Collect Payment)' : 'Record Payment'}</span>
              </button>

              <button
                onClick={handlePrintReport}
                className={`px-4 py-2 rounded-none-none text-xs font-normal border transition-all cursor-pointer flex items-center space-x-1.5 shadow-2xs ${
                  isDark ? 'bg-[#1E293B] border-slate-700/80 text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Printer className="w-4 h-4 text-[#00897B]" />
                <span>{isBn ? '🖨️ স্টেটমেন্ট প্রিন্ট' : 'Print Statement'}</span>
              </button>
            </div>
          </div>

          {/* Customer Profile Header Banner */}
          <div className={`p-6 rounded-none-none border space-y-6 shadow-2xs ${
            isDark ? 'bg-[#1E293B] border-slate-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-900'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center space-x-4">
                <div className={`w-14 h-14 rounded-none-none border flex items-center justify-center font-semibold text-lg shadow-2xs ${
                  isDark ? 'bg-teal-950/40 border-teal-800/60 text-teal-300' : 'bg-teal-50/80 border-teal-200/70 text-[#00897B]'
                }`}>
                  {custName.charAt(0).toUpperCase()}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5 flex-wrap gap-1.5">
                    <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{custName}</h2>
                    <span className="px-2.5 py-0.5 rounded-none-none text-xs font-mono font-medium bg-[#00897B]/10 text-[#00897B] border border-[#00897B]/20">
                      🏷️ {custMarkStr}
                    </span>
                    {selectedCustomer.status === 'vip' && (
                      <span className="px-2.5 py-0.5 rounded-none-none text-[11px] font-normal bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50">
                        ⭐ VIP Client
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap gap-y-1 font-normal">
                    {custPhoneStr && <span>📱 {custPhoneStr}</span>}
                    {custEmailStr && <span>✉️ {custEmailStr}</span>}
                    {custAddressStr && <span>📍 {custAddressStr}</span>}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowAddEntryModal(true)}
                  className="px-3.5 py-2 rounded-none-none text-xs font-normal border border-[#00897B]/30 bg-[#00897B]/10 hover:bg-[#00897B]/20 text-[#00897B] transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isBn ? '+ লেনদেন এন্ট্রি (Entry)' : '+ Ledger Entry'}</span>
                </button>
              </div>
            </div>

            {/* 4 Key Financial Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div className={`p-4 rounded-none-none border space-y-1 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[11px] font-normal text-slate-500">{isBn ? 'মোট চার্জ করা বিল' : 'Total Billed Freight'}</span>
                <p className="text-base font-semibold font-mono text-slate-900 dark:text-white">৳{formatBdt(billedVal)}</p>
              </div>

              <div className={`p-4 rounded-none-none border space-y-1 ${isDark ? 'bg-emerald-950/20 border-emerald-800/50' : 'bg-emerald-50/50 border-emerald-100'}`}>
                <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400">{isBn ? 'মোট প্রাপ্ত টাকা (জমা)' : 'Total Received'}</span>
                <p className="text-base font-semibold font-mono text-emerald-700 dark:text-emerald-400">৳{formatBdt(selectedCustomer.total_paid)}</p>
              </div>

              <div className={`p-4 rounded-none-none border space-y-1 ${
                (selectedCustomer.total_due || 0) > 0
                  ? isDark ? 'bg-rose-950/20 border-rose-800/50' : 'bg-rose-50/50 border-rose-100'
                  : isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`text-[11px] font-normal ${(selectedCustomer.total_due || 0) > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500'}`}>
                  {isBn ? 'বর্তমান বকেয়া (বাকি)' : 'Net Outstanding Due'}
                </span>
                <p className={`text-base font-semibold font-mono ${(selectedCustomer.total_due || 0) > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                  ৳{formatBdt(selectedCustomer.total_due)}
                </p>
              </div>

              <div className={`p-4 rounded-none-none border space-y-1 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[11px] font-normal text-slate-500">{isBn ? 'মোট চালান (কার্টুন / ওজন)' : 'Shipment Roster'}</span>
                <p className="text-base font-semibold font-mono text-slate-900 dark:text-white">
                  {customerCartons.length} <span className="text-xs font-normal text-slate-500">ctns ({totalWeightShipped.toFixed(1)} kg)</span>
                </p>
              </div>
            </div>
          </div>

          {/* Ledger History & Carton Roster Tabs */}
          <div className="space-y-4">
            {/* Financial Ledger Audit Table */}
            <div className={`border rounded-none-none overflow-hidden shadow-2xs ${
              isDark ? 'bg-[#1E293B] border-slate-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-900'
            }`}>
              <div className="p-4 border-b flex items-center justify-between border-slate-200/80 dark:border-slate-700/80">
                <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 text-[#00897B]">
                  <Receipt className="w-4 h-4" />
                  <span>{isBn ? 'লেনদেনের বিস্তারিত হিসেব (Financial Ledger Audit)' : 'Financial Ledger Transactions Audit'}</span>
                </h3>
                <span className="text-[11px] text-slate-500 font-normal">{customerLedger.length} {isBn ? 'টি এন্ট্রি' : 'records'}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-normal">
                  <thead className={`uppercase text-[10px] tracking-wider border-b font-medium ${
                    isDark ? 'bg-[#1E293B] text-slate-400 border-slate-700/80' : 'bg-slate-50/80 text-slate-500 border-slate-200/70'
                  }`}>
                    <tr>
                      <th className="p-3">তারিখ (Date)</th>
                      <th className="p-3">বিবরণ / রসিদ নং (Particulars / Ref)</th>
                      <th className="p-3 text-right">চার্জ (Debit ৳)</th>
                      <th className="p-3 text-right">জমা (Credit ৳)</th>
                      <th className="p-3 text-right">জের (Balance ৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
                    {customerLedger.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400 text-xs">
                          {isBn ? 'কোন লেনদেনের তথ্য পাওয়া যায়নি' : 'No financial transaction entries found.'}
                        </td>
                      </tr>
                    ) : (
                      customerLedger.map((ledg) => (
                        <tr key={ledg.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">{ledg.date || '-'}</td>
                          <td className="p-3">
                            <p className="font-medium text-slate-800 dark:text-slate-200">{ledg.description || 'Transaction Entry'}</p>
                            {ledg.reference_no && <p className="text-[10px] text-slate-400 font-mono">Ref: {ledg.reference_no}</p>}
                          </td>
                          <td className="p-3 text-right font-mono font-medium text-slate-900 dark:text-white">
                            {Number(ledg?.debit || 0) > 0 ? `৳${formatBdt(ledg?.debit)}` : '-'}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {Number(ledg?.credit || 0) > 0 ? `৳${formatBdt(ledg?.credit)}` : '-'}
                          </td>
                          <td className={`p-3 text-right font-mono font-semibold ${
                            (Number(ledg?.balance) || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            ৳{formatBdt(ledg?.balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Carton Roster Table */}
            <div className={`border rounded-none-none overflow-hidden shadow-2xs ${
              isDark ? 'bg-[#1E293B] border-slate-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-900'
            }`}>
              <div className="p-4 border-b flex items-center justify-between border-slate-200/80 dark:border-slate-700/80">
                <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 text-[#00897B]">
                  <Box className="w-4 h-4" />
                  <span>{isBn ? 'কার্টুন ও শিপমেন্ট হিস্টোরি (Carton Roster History)' : 'Shipment & Carton Roster History'}</span>
                </h3>
                <span className="text-[11px] text-slate-500 font-normal">{customerCartons.length} {isBn ? 'টি কার্টুন' : 'cartons'}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-normal">
                  <thead className={`uppercase text-[10px] tracking-wider border-b font-medium ${
                    isDark ? 'bg-[#1E293B] text-slate-400 border-slate-700/80' : 'bg-slate-50/80 text-slate-500 border-slate-200/70'
                  }`}>
                    <tr>
                      <th className="p-3">কার্টুন নং (Carton Code)</th>
                      <th className="p-3">শিপিং মার্ক (Mark)</th>
                      <th className="p-3">পণ্যের বিবরণ (Goods)</th>
                      <th className="p-3 text-right">ওজন (Kg) / CBM</th>
                      <th className="p-3 text-right">রেট / বিল (৳)</th>
                      <th className="p-3 text-center">স্ট্যাটাস</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
                    {customerCartons.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400 text-xs">
                          {isBn ? 'এই কাস্টমারের কোন কার্টুন অ্যাসাইন বা এন্ট্রি করা নেই' : 'No cartons found for this customer shipping mark.'}
                        </td>
                      </tr>
                    ) : (
                      customerCartons.map((ctn) => (
                        <tr key={ctn.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-medium text-slate-900 dark:text-white">{ctn.carton_code}</td>
                          <td className="p-3 font-mono text-xs text-[#00897B] font-semibold">{ctn.shipping_mark}</td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">{ctn.product_name || ctn.remarks || 'General Cargo'}</td>
                          <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                            {ctn.gross_weight ? `${ctn.gross_weight} kg` : ctn.cbm ? `${ctn.cbm} CBM` : '-'}
                          </td>
                          <td className="p-3 text-right font-mono font-medium text-slate-900 dark:text-white">
                            ৳{formatBdt(ctn.total_freight_bdt)}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold rounded-none-none bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                              {ctn.status || 'Received'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            2. OFFICIAL PRINTABLE A4 STATEMENT DOCUMENT (PRINT ONLY)
            ========================================================================= */}
        <div className="printable-document hidden print:block text-slate-900 font-sans p-4 bg-white">
          {/* Header Banner */}
          <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">M/S FOUR STAR CARGO</h1>
              <p className="text-[11px] text-slate-600 font-medium">Cargo Tracking, International Logistics & Financial Operations</p>
              <p className="text-[10px] text-slate-500 mt-1">Guangzhou / HK Origin Hub & Dhaka Head Office | Tel: +880 1700-000000</p>
            </div>
            <div className="text-right">
              <div className="inline-block bg-slate-900 text-white text-xs font-bold px-3 py-1 uppercase tracking-wider mb-1">
                STATEMENT OF ACCOUNT
              </div>
              <p className="text-[10px] text-slate-600 font-mono">Date: {new Date().toLocaleDateString('en-GB')}</p>
              <p className="text-[10px] text-slate-600 font-mono">Time: {new Date().toLocaleTimeString()}</p>
            </div>
          </div>

          {/* Customer & Summary Meta Box */}
          <div className="grid grid-cols-2 gap-4 mb-4 border border-slate-300 p-3 bg-slate-50/50 text-xs">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">CLIENT BILL TO:</p>
              <h2 className="text-sm font-bold text-slate-900">{custName}</h2>
              <p className="text-xs font-mono font-semibold text-[#00897B]">Shipping Mark: {custMarkStr}</p>
              <p className="text-xs font-mono text-slate-700">Mobile: {custPhoneStr}</p>
              {custAddressStr && <p className="text-xs text-slate-600">Address: {custAddressStr}</p>}
            </div>

            <div className="border-l border-slate-300 pl-4 space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">FINANCIAL ACCOUNT SUMMARY:</p>
              <div className="flex justify-between text-xs py-0.5 border-b border-slate-200">
                <span>Total Freight Billed:</span>
                <span className="font-mono font-semibold">৳{formatBdt(billedVal)}</span>
              </div>
              <div className="flex justify-between text-xs py-0.5 border-b border-slate-200">
                <span>Total Payments Received:</span>
                <span className="font-mono font-semibold text-emerald-700">৳{formatBdt(selectedCustomer.total_paid)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold py-1 text-slate-900">
                <span>NET OUTSTANDING DUE:</span>
                <span className="font-mono text-sm text-rose-700">৳{formatBdt(selectedCustomer.total_due)}</span>
              </div>
            </div>
          </div>

          {/* Ledger Audit Table */}
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-400 pb-1">
              1. FINANCIAL TRANSACTION AUDIT LEDGER
            </h3>
            <table className="w-full text-left text-xs border border-slate-300">
              <thead className="bg-slate-100 text-slate-900 font-bold uppercase text-[10px] border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300">Date</th>
                  <th className="p-2 border-r border-slate-300">Particulars / Transaction Description</th>
                  <th className="p-2 border-r border-slate-300 text-right">Debit (৳)</th>
                  <th className="p-2 border-r border-slate-300 text-right">Credit (৳)</th>
                  <th className="p-2 text-right">Balance (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {customerLedger.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-slate-500 italic">No ledger entries recorded.</td>
                  </tr>
                ) : (
                  customerLedger.map((ledg) => (
                    <tr key={ledg.id}>
                      <td className="p-2 border-r border-slate-200 font-mono text-[10px]">{ledg.date || '-'}</td>
                      <td className="p-2 border-r border-slate-200">{ledg.description || 'Transaction Entry'} {ledg.reference_no ? `(Ref: ${ledg.reference_no})` : ''}</td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono">{Number(ledg?.debit || 0) > 0 ? `৳${formatBdt(ledg?.debit)}` : '-'}</td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono font-semibold text-emerald-800">{Number(ledg?.credit || 0) > 0 ? `৳${formatBdt(ledg?.credit)}` : '-'}</td>
                      <td className="p-2 text-right font-mono font-bold">৳{formatBdt(ledg?.balance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Carton Roster Table */}
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-400 pb-1">
              2. CARGO SHIPMENT & CARTON ROSTER
            </h3>
            <table className="w-full text-left text-xs border border-slate-300">
              <thead className="bg-slate-100 text-slate-900 font-bold uppercase text-[10px] border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300">Carton Code</th>
                  <th className="p-2 border-r border-slate-300">Shipping Mark</th>
                  <th className="p-2 border-r border-slate-300">Goods Description</th>
                  <th className="p-2 border-r border-slate-300 text-right">Weight/CBM</th>
                  <th className="p-2 text-right">Billed Amount (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {customerCartons.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-slate-500 italic">No cartons assigned to this shipping mark.</td>
                  </tr>
                ) : (
                  customerCartons.map((ctn) => (
                    <tr key={ctn.id}>
                      <td className="p-2 border-r border-slate-200 font-mono font-medium">{ctn.carton_code}</td>
                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-[#00897B]">{ctn.shipping_mark}</td>
                      <td className="p-2 border-r border-slate-200">{ctn.product_name || ctn.remarks || 'General Cargo'}</td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono">{ctn.gross_weight ? `${ctn.gross_weight} kg` : ctn.cbm ? `${ctn.cbm} CBM` : '-'}</td>
                      <td className="p-2 text-right font-mono font-semibold">৳{formatBdt(ctn.total_freight_bdt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Signatures & Approval Footer */}
          <div className="pt-8 mt-6 border-t border-slate-300 grid grid-cols-3 gap-4 text-center text-xs">
            <div>
              <div className="border-t border-slate-800 pt-1 mt-8 font-semibold text-slate-900">PREPARED BY</div>
              <p className="text-[10px] text-slate-500">Accounts Executive</p>
            </div>
            <div>
              <div className="border-t border-slate-800 pt-1 mt-8 font-semibold text-slate-900">VERIFIED BY</div>
              <p className="text-[10px] text-slate-500">Audit & Operations Manager</p>
            </div>
            <div>
              <div className="border-t border-slate-800 pt-1 mt-8 font-semibold text-slate-900">CUSTOMER SIGNATURE</div>
              <p className="text-[10px] text-slate-500">Received & Accepted</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN CUSTOMER CRM & LEDGER DIRECTORY VIEW
  // =========================================================================
  return (
    <div className="space-y-6 font-sans">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 1. Header & Executive Metrics Overview */}
      <div className={`p-5 rounded-none-none border space-y-4 shadow-2xs ${
        isDark ? 'bg-[#1E293B] border-slate-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-900'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-none-none border flex items-center justify-center font-normal ${
              isDark ? 'bg-teal-950/40 border-teal-800/60 text-teal-300' : 'bg-teal-50/80 border-teal-200/70 text-[#00897B]'
            }`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className={`text-base font-semibold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <span>{isBn ? 'কাস্টমার প্রোফাইল ও লেজার অ্যাকাউন্টস ট্র্যাকিং' : 'Customer Profiles & Financial Ledger Accounts'}</span>
              </h1>
              <p className={`text-xs mt-0.5 font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {isBn
                  ? 'সকল কাস্টমারের প্রোডাক্ট ইতিহাস, কার্টুন শিপিং মার্ক ট্র্যাকিং ও বকেয়া (বাকি) হিসাব'
                  : 'Manage customer Directory, track product shipments per mark, and maintain accurate payment ledgers'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddCustomerModal(true)}
            className="px-3.5 py-2 rounded-none-none text-xs font-normal bg-[#00897B] hover:bg-[#00796B] text-white transition-all cursor-pointer flex items-center space-x-2 shadow-2xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isBn ? '+ নতুন কাস্টমার রেজিস্ট্রেশন' : '+ Add New Customer'}</span>
          </button>
        </div>

        {/* 4 Refined Financial Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 pt-2">
          {/* Total Customers */}
          <div className={`p-4 rounded-none-none border space-y-1.5 ${
            isDark ? 'bg-[#1E293B] border-slate-700/80' : 'bg-teal-50/30 border-teal-100/80'
          }`}>
            <span className="text-[11px] font-normal text-slate-500 flex items-center justify-between">
              <span>{isBn ? 'মোট কাস্টমার' : 'Total Customers'}</span>
              <Users className="w-3.5 h-3.5 text-[#00897B]" />
            </span>
            <p className="text-lg font-semibold text-slate-800 dark:text-white font-mono">
              {customers.length} <span className="text-xs font-normal text-slate-500">{isBn ? 'জন ক্লায়েন্ট' : 'clients'}</span>
            </p>
          </div>

          {/* Total Billed */}
          <div className={`p-4 rounded-none-none border space-y-1.5 ${
            isDark ? 'bg-[#1E293B] border-slate-700/80' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className="text-[11px] font-normal text-slate-500 flex items-center justify-between">
              <span>{isBn ? 'মোট ফ্রেইট চার্জ বিল' : 'Total Freight Billed'}</span>
              <Receipt className="w-3.5 h-3.5 text-slate-700" />
            </span>
            <p className="text-lg font-semibold text-slate-900 dark:text-white font-mono">৳{totalBilledAll.toLocaleString()}</p>
          </div>

          {/* Total Paid */}
          <div className={`p-4 rounded-none-none border space-y-1.5 ${
            isDark ? 'bg-[#1E293B] border-slate-700/80' : 'bg-emerald-50/40 border-emerald-100/80'
          }`}>
            <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
              <span>{isBn ? 'মোট আদায়কৃত টাকা' : 'Total Revenue Collected'}</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            </span>
            <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400 font-mono">৳{totalPaidAll.toLocaleString()}</p>
          </div>

          {/* Total Due */}
          <div className={`p-4 rounded-none-none border space-y-1.5 ${
            isDark ? 'bg-[#1E293B] border-slate-700/80' : 'bg-rose-50/40 border-rose-100/80'
          }`}>
            <span className="text-[11px] font-normal text-rose-700 dark:text-rose-400 flex items-center justify-between">
              <span>{isBn ? 'সর্বমোট বাকি বকেয়া' : 'Total Outstanding Dues'}</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            </span>
            <p className="text-lg font-semibold text-rose-700 dark:text-rose-400 font-mono">৳{totalDueAll.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* 2. Smart System Explanation Alert Banner */}
      <div className={`p-4 rounded-none-none border flex items-start space-x-3 text-xs ${
        isDark ? 'bg-teal-950/30 border-teal-800/50 text-teal-200' : 'bg-teal-50/60 border-teal-200/60 text-[#00695C]'
      }`}>
        <Tag className="w-4 h-4 text-[#00897B] shrink-0 mt-0.5" />
        <div className="space-y-1 font-normal">
          <p className="font-medium text-xs flex items-center space-x-1.5">
            <span>💡 {isBn ? 'শিপিং মার্ক (Shipping Mark) ও কার্টুন ট্র্যাকিং ব্যবস্থা' : 'Per-Carton Shipping Mark Tracking Hierarchy'}</span>
          </p>
          <p className="text-[11px] leading-relaxed opacity-90">
            {isBn
              ? 'আন্তর্জাতিক লজিস্টিকসে প্রতিটি কার্টুনের গায়ে কাস্টমারের ইউনিক শিপিং মার্ক (যেমন: MAR-8801-01, MAR-8801-02) স্প্রে বা লেখা থাকে। চীন বা হংকং হাব থেকে যে কার্টুনই বুকিং করা হোক না কেন, শিপিং মার্ক দেওয়া মাত্রই সিস্টেম স্বয়ংক্রিয়ভাবে উক্ত কাস্টমারের প্রোফাইলে তার সমস্ত পণ্য, ওজন, সিবিএম এবং ডেবিট/ক্রেডিট টাকা হিসাব করে নেবে।'
              : 'Each carton carries a specific Shipping Mark under the customer prefix. All items booked at origin hubs are automatically grouped into their account balance.'}
          </p>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className={`p-3 rounded-none-none border flex flex-wrap items-center justify-between gap-3 text-xs ${
        isDark ? 'bg-[#1E293B] border-slate-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-900 shadow-2xs'
      }`}>
        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-1.5 flex-wrap gap-1 font-normal">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-none-none text-xs transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#00897B] text-white shadow-2xs'
                : isDark
                ? 'bg-[#1E293B] text-slate-400 hover:text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            {isBn ? 'সব কাস্টমার' : 'All Clients'} ({customers.length})
          </button>

          <button
            onClick={() => setStatusFilter('due')}
            className={`px-3 py-1.5 rounded-none-none text-xs transition-all cursor-pointer ${
              statusFilter === 'due'
                ? 'bg-[#00897B] text-white shadow-2xs'
                : isDark
                ? 'bg-[#1E293B] text-slate-400 hover:text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            🔴 {isBn ? 'বকেয়া/বাকি আছে' : 'Has Outstanding Due'}
          </button>

          <button
            onClick={() => setStatusFilter('vip')}
            className={`px-3 py-1.5 rounded-none-none text-xs transition-all cursor-pointer ${
              statusFilter === 'vip'
                ? 'bg-[#00897B] text-white shadow-2xs'
                : isDark
                ? 'bg-[#1E293B] text-slate-400 hover:text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            ⭐ {isBn ? 'ভিআইপি ক্লায়েন্ট' : 'VIP Clients'}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[260px]">
          <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isBn ? 'নাম, শিপিং মার্ক (MAR-8801), মোবাইল...' : 'Search Name, Mark (MAR-8801), Phone...'}
            className={`w-full border rounded-none-none py-1.5 pl-8 pr-3 text-xs outline-none font-normal ${
              isDark ? 'bg-[#1E293B] border-slate-700/80 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
            }`}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700">
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Main Customer Directory Table */}
      <div className={`border rounded-none-none overflow-hidden shadow-2xs ${
        isDark ? 'bg-[#1E293B] border-slate-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-900'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-normal">
            <thead className={`uppercase text-[10px] tracking-wider border-b font-medium ${
              isDark ? 'bg-[#1E293B] text-slate-400 border-slate-700/80' : 'bg-slate-50/80 text-slate-500 border-slate-200/70'
            }`}>
              <tr>
                <th className="p-3.5">Customer Name & Code</th>
                <th className="p-3.5">Shipping Mark (ইউনিক মার্ক)</th>
                <th className="p-3.5">Contact Phone & Company</th>
                <th className="p-3.5 text-right">Total Billed</th>
                <th className="p-3.5 text-right">Total Paid</th>
                <th className="p-3.5 text-right">Current Due (বাকি)</th>
                <th className="p-3.5 text-right">Actions & Ledger Tracker</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800/80' : 'divide-slate-100'}`}>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-xs text-slate-400 font-normal">
                    {isBn ? 'কোনো কাস্টমার প্রোফাইল পাওয়া যায়নি।' : 'No customers found matching search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const custCartons = getCustomerCartons(cust);
                  const displayMark = cust.shipping_mark || (cust.id === 'cust-1' ? 'MAR-8801' : cust.id === 'cust-2' ? 'SAY-9920' : 'APX-7710');
                  const billedAmt = cust.total_billed && cust.total_billed > 0 ? cust.total_billed : (cust.total_due || 0) + (cust.total_paid || 0);

                  return (
                    <tr key={cust.id} className={isDark ? 'hover:bg-[#222224] transition-colors' : 'hover:bg-slate-50/60 transition-colors'}>
                      {/* Customer Identity */}
                      <td className="p-3.5">
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-8 h-8 rounded-none-none border flex items-center justify-center font-medium text-xs ${
                            isDark ? 'bg-teal-950/40 border-teal-800/60 text-teal-300' : 'bg-teal-50/80 border-teal-200/70 text-[#00897B]'
                          }`}>
                            {String(cust.name || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-xs text-slate-800 dark:text-white">{cust.name || 'Client'}</p>
                            <p className="text-[10px] font-mono text-slate-400">{cust.customer_code}</p>
                          </div>
                        </div>
                      </td>

                      {/* Shipping Mark Column with Carton Count Sub-Badge */}
                      <td className="p-3.5 space-y-1">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-none-none text-xs font-mono font-medium bg-[#00897B]/10 text-[#00897B] border border-[#00897B]/20">
                          <Tag className="w-3 h-3 text-[#00897B]" />
                          <span>{displayMark}</span>
                        </span>
                        <p className="text-[10px] text-slate-400 flex items-center space-x-1">
                          <Package className="w-3 h-3 text-slate-400" />
                          <span>{custCartons.length} {isBn ? 'টি কার্টুন অন্তর্ভুক্ত' : 'cartons linked'}</span>
                        </p>
                      </td>

                      {/* Contact Phone & Company */}
                      <td className="p-3.5 space-y-0.5 font-normal">
                        <p className="font-mono text-slate-700 dark:text-slate-300">{cust.phone || '-'}</p>
                        <p className="text-[10px] text-slate-400">{cust.company_name || cust.address}</p>
                      </td>

                      {/* Billed */}
                      <td className="p-3.5 text-right font-mono font-normal text-slate-700 dark:text-slate-300">
                        ৳{formatBdt(billedAmt)}
                      </td>

                      {/* Paid */}
                      <td className="p-3.5 text-right font-mono font-medium text-emerald-700 dark:text-emerald-400">
                        ৳{formatBdt(cust?.total_paid)}
                      </td>

                      {/* Current Due (বাকি) */}
                      <td className="p-3.5 text-right font-mono">
                        {(cust?.total_due || 0) > 0 ? (
                          <span className="font-semibold text-rose-600 dark:text-rose-400 text-xs">
                            ৳{formatBdt(cust?.total_due)}
                          </span>
                        ) : (
                          <span className="font-normal text-emerald-600 dark:text-emerald-400 text-xs">
                            ৳0
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setCustomerForPayment(cust)}
                            className="px-3 py-1.5 rounded-none-none text-xs font-normal bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer flex items-center space-x-1 shadow-2xs"
                            title={isBn ? 'টাকা জমা রিসিভ করুন' : 'Collect Payment'}
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>{isBn ? 'টাকা জমা' : 'Pay'}</span>
                          </button>

                          <button
                            onClick={() => setSelectedCustomer(cust)}
                            className={`px-3 py-1.5 rounded-none-none text-xs font-normal border transition-all cursor-pointer flex items-center space-x-1.5 shadow-2xs ${
                              isDark
                                ? 'bg-teal-950/30 border-teal-800/60 text-teal-300 hover:bg-teal-900/40'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <BarChart3 className="w-3.5 h-3.5 text-[#00897B]" />
                            <span>{isBn ? 'লেজার ও পণ্য' : 'Ledger & Products'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL: REGISTER NEW CUSTOMER */}
      {/* ========================================================================= */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E293B] backdrop-blur-xs animate-backdrop-blur-fade">
          <div className={`w-full max-w-lg rounded-none-none border p-6 space-y-5 shadow-2xl animate-modal-pop-bounce ${
            isDark ? 'bg-[#1E293B] border-slate-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-slate-700/80' : 'border-slate-100'}`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-none-none border flex items-center justify-center ${
                  isDark ? 'bg-teal-950/40 border-teal-800/60 text-teal-300' : 'bg-teal-50/80 border-teal-200/70 text-[#00897B]'
                }`}>
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">
                    {isBn ? 'নতুন কাস্টমার নিবন্ধন করুন' : 'Register New Customer Profile'}
                  </h2>
                  <p className={`text-xs font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {isBn ? 'শিপিং মার্ক প্রিফিক্স দিয়ে নতুন কাস্টমার আইডি তৈরি করুন' : 'Setup customer profile with unique shipping mark'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddCustomerModal(false)}
                className={`p-1.5 rounded-none-none transition-all cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs font-normal">
              <div>
                <label className={`block text-[11px] font-normal mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'ইউনিক শিপিং মার্ক (Shipping Mark Prefix) *' : 'Unique Shipping Mark Prefix *'}
                </label>
                <input
                  type="text"
                  required
                  value={newCustShippingMark}
                  onChange={(e) => setNewCustShippingMark(e.target.value)}
                  placeholder={isBn ? 'যেমন: MAR-8801, SAY-9920' : 'e.g. MAR-8801'}
                  className={`w-full border rounded-none-none py-2.5 px-3.5 outline-none font-mono font-medium uppercase transition-all ${
                    isDark
                      ? 'bg-[#1E293B] border-slate-700 text-teal-300 focus:border-teal-500'
                      : 'bg-teal-50/40 border-teal-200/80 text-[#00897B] focus:bg-white focus:border-[#00897B]'
                  }`}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {isBn ? 'চীন বা হংকং ওয়্যারহাউজে প্রতিটি কার্টুনের গায়ে এই মার্কটি লেখা হবে।' : 'Printed on boxes at origin hubs.'}
                </p>
              </div>

              <div>
                <label className={`block text-[11px] font-normal mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'কাস্টমারের পূর্ণ নাম *' : 'Customer Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder={isBn ? 'যেমন: মাসুম বিল্লাহ' : 'e.g. Masum Billah'}
                  className={`w-full border rounded-none-none py-2.5 px-3.5 outline-none transition-all ${
                    isDark
                      ? 'bg-[#1E293B] border-slate-700 text-white'
                      : 'bg-slate-50/60 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className={`block text-[11px] font-normal mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {isBn ? 'মোবাইল ফোন নম্বর *' : 'Phone Number *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="+880 1700-000000"
                    className={`w-full border rounded-none-none py-2.5 px-3.5 outline-none font-mono transition-all ${
                      isDark
                        ? 'bg-[#1E293B] border-slate-700 text-white'
                        : 'bg-slate-50/60 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-normal mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {isBn ? 'কোম্পানি / শপের নাম' : 'Company Name'}
                  </label>
                  <input
                    type="text"
                    value={newCustCompany}
                    onChange={(e) => setNewCustCompany(e.target.value)}
                    placeholder={isBn ? 'যেমন: গ্লোবাল ট্রেডিং' : 'e.g. Global Traders'}
                    className={`w-full border rounded-none-none py-2.5 px-3.5 outline-none transition-all ${
                      isDark
                        ? 'bg-[#1E293B] border-slate-700 text-white'
                        : 'bg-slate-50/60 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[11px] font-normal mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'ঠিকানা (Address)' : 'Address'}
                </label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder={isBn ? 'যেমন: নওয়াবপুর রোড, ঢাকা' : 'e.g. Nawabpur, Dhaka'}
                  className={`w-full border rounded-none-none py-2.5 px-3.5 outline-none transition-all ${
                    isDark
                      ? 'bg-[#1E293B] border-slate-700 text-white'
                      : 'bg-slate-50/60 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                  }`}
                />
              </div>

              <div className={`flex justify-end space-x-3 pt-4 border-t ${isDark ? 'border-slate-700/80' : 'border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className={`px-4 py-2 rounded-none-none text-xs font-normal border transition-all cursor-pointer ${
                    isDark
                      ? 'bg-[#1E293B] border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  }`}
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-none-none text-xs font-normal bg-[#00897B] hover:bg-[#00796B] text-white shadow-2xs hover:shadow transition-all cursor-pointer"
                >
                  {isBn ? 'নিবন্ধন সম্পন্ন করুন' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: RECORD PAYMENT RECEIVED (টাকা জমা নিন) */}
      {/* ========================================================================= */}
      {customerForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E293B] backdrop-blur-xs animate-backdrop-blur-fade">
          <div className={`w-full max-w-md rounded-none-none border p-6 space-y-5 shadow-2xl animate-modal-pop-bounce ${
            isDark ? 'bg-[#1E293B] border-slate-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-slate-700/80' : 'border-slate-100'}`}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-none-none bg-emerald-50 border border-emerald-200/80 dark:bg-emerald-950/40 dark:border-emerald-800/60 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
                    {isBn ? 'পেমেন্ট জমা রিসিভ করুন' : 'Record Payment Received'}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono font-normal">
                    {customerForPayment.name} ({customerForPayment.shipping_mark || 'MAR-8801'})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCustomerForPayment(null)}
                className={`p-1.5 rounded-none-none transition-all cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className={`p-3 rounded-none-none border flex items-center justify-between text-xs font-normal ${
              isDark ? 'bg-[#1E293B] border-slate-700/80' : 'bg-slate-50/70 border-slate-200/70'
            }`}>
              <span className="text-slate-500">{isBn ? 'বর্তমান বকেয়া (Due):' : 'Current Due:'}</span>
              <span className="font-semibold font-mono text-rose-600 dark:text-rose-400 text-sm">৳{(customerForPayment.total_due || 0).toLocaleString()}</span>
            </div>

            <form onSubmit={handleCollectPaymentSubmit} className="space-y-4 text-xs font-normal">
              <div>
                <label className={`block text-[11px] font-normal mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'জমা টাকার পরিমাণ (৳) *' : 'Payment Amount (৳) *'}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className={`w-full border rounded-none-none py-2.5 px-3.5 outline-none font-mono font-semibold text-sm transition-all ${
                    isDark
                      ? 'bg-[#1E293B] border-slate-700 text-emerald-400 focus:border-emerald-500'
                      : 'bg-emerald-50/40 border-emerald-200/80 text-emerald-800 focus:bg-white focus:border-emerald-600'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-normal mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'পেমেন্ট মাধ্যম (Payment Method) *' : 'Payment Method *'}
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className={`w-full border rounded-none-none py-2.5 px-3.5 outline-none cursor-pointer transition-all ${
                    isDark
                      ? 'bg-[#1E293B] border-slate-700 text-white'
                      : 'bg-slate-50/60 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                  }`}
                >
                  <option value="bkash">📱 bKash Merchant / Personal</option>
                  <option value="nagad">📱 Nagad Wallet</option>
                  <option value="bank_wire">🏦 Bank Wire / EFT Transfer</option>
                  <option value="cash">💵 Cash Deposit at Hub</option>
                  <option value="check">📄 Account Payee Cheque</option>
                </select>
              </div>

              <div>
                <label className={`block text-[11px] font-normal mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'ট্রানজেকশন আইডি / চেক নম্বর / রসিদ' : 'Trx ID / Cheque / Ref No'}
                </label>
                <input
                  type="text"
                  value={payRefNo}
                  onChange={(e) => setPayRefNo(e.target.value)}
                  placeholder="e.g. bKash Trx 99A8X10"
                  className={`w-full border rounded-none-none py-2.5 px-3.5 outline-none font-mono transition-all ${
                    isDark
                      ? 'bg-[#1E293B] border-slate-700 text-white'
                      : 'bg-slate-50/60 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-normal mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'নোট বা মন্তব্য' : 'Notes'}
                </label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder={isBn ? 'যেমন: ঢাকা ওয়্যারহাউজে ক্যাশ রিসিভ' : 'e.g. Received at Tejgaon Hub'}
                  className={`w-full border rounded-none-none py-2.5 px-3.5 outline-none transition-all ${
                    isDark
                      ? 'bg-[#1E293B] border-slate-700 text-white'
                      : 'bg-slate-50/60 border-slate-200 text-slate-900 focus:bg-white focus:border-[#00897B]'
                  }`}
                />
              </div>

              <div className={`flex justify-end space-x-3 pt-4 border-t ${isDark ? 'border-slate-700/80' : 'border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => setCustomerForPayment(null)}
                  className={`px-4 py-2 rounded-none-none text-xs font-normal border transition-all cursor-pointer ${
                    isDark
                      ? 'bg-[#1E293B] border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  }`}
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-none-none text-xs font-normal bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs hover:shadow transition-all cursor-pointer flex items-center space-x-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{isBn ? 'পেমেন্ট রিসিভ সম্পন্ন করুন' : 'Confirm Payment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Ledger Entry Modal */}
      {showAddEntryModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className={`w-full max-w-md p-6 rounded-none-none border shadow-2xl space-y-5 ${
            isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
              <h3 className="text-sm font-semibold flex items-center space-x-2 text-[#00897B]">
                <Plus className="w-4 h-4" />
                <span>{isBn ? 'নতুন লেনদেন / এডজাস্টমেন্ট এন্ট্রি' : 'Add Custom Ledger Entry'}</span>
              </h3>
              <button
                onClick={() => setShowAddEntryModal(false)}
                className={`p-1 rounded-none-none transition-colors ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLedgerEntry} className="space-y-4 text-xs font-normal">
              <div>
                <label className={`block text-[11px] font-normal mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'এন্ট্রির ধরন (Entry Type) *' : 'Entry Type *'}
                </label>
                <select
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as any)}
                  className={`w-full border rounded-none-none py-2 px-3 outline-none cursor-pointer transition-all ${
                    isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="charge">➕ অতিরিক্ত ফ্রেইট চার্জ / বিল (Debit Charge)</option>
                  <option value="discount">➖ ডিসকাউন্ট / ওয়েভার (Credit Discount)</option>
                  <option value="adjustment">🔄 ব্যালেন্স এডজাস্টমেন্ট (Credit Adjustment)</option>
                </select>
              </div>

              <div>
                <label className={`block text-[11px] font-normal mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'টাকার পরিমাণ (৳) *' : 'Amount (৳) *'}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                  placeholder="e.g. 1500"
                  className={`w-full border rounded-none-none py-2 px-3 outline-none font-mono transition-all ${
                    isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-normal mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isBn ? 'বিবরণ / নোট (Description)' : 'Description / Remarks'}
                </label>
                <input
                  type="text"
                  value={entryDesc}
                  onChange={(e) => setEntryDesc(e.target.value)}
                  placeholder={isBn ? 'যেমন: বিশেষ ডিসকাউন্ট প্রদান করা হয়েছে' : 'e.g. Special freight waiver'}
                  className={`w-full border rounded-none-none py-2 px-3 outline-none transition-all ${
                    isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className={`flex justify-end space-x-3 pt-4 border-t ${isDark ? 'border-slate-700/80' : 'border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => setShowAddEntryModal(false)}
                  className={`px-4 py-2 rounded-none-none text-xs font-normal border transition-all cursor-pointer ${
                    isDark ? 'bg-[#1E293B] border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  }`}
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-none-none text-xs font-normal bg-[#00897B] hover:bg-[#00796B] text-white shadow-2xs hover:shadow transition-all cursor-pointer flex items-center space-x-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{isBn ? 'এন্ট্রি সেভ করুন' : 'Save Entry'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const CustomerLedgerManager: React.FC<CustomerLedgerManagerProps> = (props) => {
  return (
    <CustomerLedgerErrorBoundary isBn={props.language === 'bn'}>
      <CustomerLedgerManagerContent {...props} />
    </CustomerLedgerErrorBoundary>
  );
};
