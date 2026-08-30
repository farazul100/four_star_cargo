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
} from 'lucide-react';
import { Customer, LedgerEntry, Carton, Language, Theme } from '../types';
import { getHostingerDbData, saveHostingerDbData, subscribeToDbUpdates, logSystemAuditAction, publishSystemNotification } from '../lib/db';
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

export const CustomerLedgerManager: React.FC<CustomerLedgerManagerProps> = ({
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
      const data = getHostingerDbData();
      const rawCusts: Customer[] = data.customers && data.customers.length > 0 ? data.customers : INITIAL_CUSTOMERS;
      const rawLedger: LedgerEntry[] = data.ledgerEntries && data.ledgerEntries.length > 0 ? data.ledgerEntries : INITIAL_LEDGER;

      // Sanitize Customers to guarantee shipping_mark and total_billed calculations
      const sanitizedCusts = rawCusts.map((c) => {
        const fallbackMark =
          c.id === 'cust-1' ? 'MAR-8801' : c.id === 'cust-2' ? 'SAY-9920' : c.id === 'cust-3' ? 'APX-7710' : `MAR-${(c.customer_code || '').replace('CUST-', '')}`;
        const mark = c.shipping_mark || fallbackMark;

        const billedCalculated = (c.total_due || 0) + (c.total_paid || 0);
        const totalBilled = c.total_billed && c.total_billed > 0 ? c.total_billed : billedCalculated;

        return {
          ...c,
          shipping_mark: mark,
          total_billed: totalBilled,
        };
      });

      setCustomers(sanitizedCusts);
      setLedgerEntries(rawLedger);
      setCartons(data.cartons || []);
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

  // Helper to find cartons for a customer (by mark or code)
  const getCustomerCartons = (c: Customer) => {
    const custMarkUpper = (c.shipping_mark || '').toUpperCase();
    const custCodeUpper = (c.customer_code || '').toUpperCase();
    return cartons.filter((ctn) => {
      const ctnMarkUpper = (ctn.shipping_mark || '').toUpperCase();
      return (
        (custMarkUpper && ctnMarkUpper.includes(custMarkUpper)) ||
        (custCodeUpper && ctnMarkUpper.includes(custCodeUpper))
      );
    });
  };

  // Filter Customers
  const filteredCustomers = customers.filter((c) => {
    if (statusFilter === 'due' && c.total_due <= 0) return false;
    if (statusFilter === 'vip' && c.status !== 'vip') return false;
    if (statusFilter === 'paid' && c.total_due > 0) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchMark = (c.shipping_mark || '').toLowerCase().includes(q);
      const matchPhone = (c.phone || '').toLowerCase().includes(q);
      const matchCode = (c.customer_code || '').toLowerCase().includes(q);
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

  // =========================================================================
  // DEDICATED FULL-PAGE CUSTOMER PROFILE & LEDGER TRACKER VIEW
  // =========================================================================
  if (selectedCustomer) {
    const customerCartons = getCustomerCartons(selectedCustomer);
    const customerLedger = ledgerEntries.filter(
      (ledg) => ledg.customer_id === selectedCustomer.id || ledg.customer_code === selectedCustomer.customer_code
    );

    const totalWeightShipped = customerCartons.reduce((sum, c) => sum + (c.gross_weight || 0), 0);
    const totalCbmShipped = customerCartons.reduce((sum, c) => sum + (c.cbm || 0), 0);
    const billedVal =
      selectedCustomer.total_billed && selectedCustomer.total_billed > 0
        ? selectedCustomer.total_billed
        : (selectedCustomer.total_due || 0) + (selectedCustomer.total_paid || 0);

    return (
      <div className="space-y-6 font-sans">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

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
                {selectedCustomer.name.charAt(0)}
              </div>

              <div className="space-y-1">
                <div className="flex items-center space-x-2.5 flex-wrap gap-1.5">
                  <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedCustomer.name}</h2>
                  <span className="px-2.5 py-0.5 rounded-none-none text-xs font-mono font-medium bg-[#00897B]/10 text-[#00897B] border border-[#00897B]/20">
                    🏷️ {selectedCustomer.shipping_mark || 'MAR-8801'}
                  </span>
                  {selectedCustomer.status === 'vip' && (
                    <span className="px-2.5 py-0.5 rounded-none-none text-[11px] font-normal bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50">
                      ⭐ VIP Client
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-3 text-xs text-slate-500 font-normal flex-wrap gap-2 pt-0.5">
                  <span className="flex items-center space-x-1 font-mono">
                    <Phone className="w-3.5 h-3.5 text-[#00897B]" />
                    <span>{selectedCustomer.phone}</span>
                  </span>
                  {selectedCustomer.company_name && (
                    <>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{selectedCustomer.company_name}</span>
                      </span>
                    </>
                  )}
                  <span>•</span>
                  <span className="flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedCustomer.address}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Dues Summary Cards */}
            <div className={`p-4 rounded-none-none border grid grid-cols-3 gap-4 text-xs min-w-[320px] ${
              isDark ? 'bg-[#1E293B] border-slate-700/80' : 'bg-slate-50/70 border-slate-200/70'
            }`}>
              <div>
                <span className="text-[11px] text-slate-500 font-normal block">{isBn ? 'মোট বিল (Billed)' : 'Total Billed'}</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-white font-mono">৳{billedVal.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[11px] text-emerald-600 font-normal block">{isBn ? 'আদায়কৃত (Paid)' : 'Total Paid'}</span>
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 font-mono">৳{(selectedCustomer.total_paid || 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[11px] text-rose-600 font-normal block">{isBn ? 'বাকি বকেয়া (Due)' : 'Current Due'}</span>
                <span className="text-sm font-semibold text-rose-700 dark:text-rose-400 font-mono">৳{(selectedCustomer.total_due || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t dark:border-slate-700/80 text-xs font-normal">
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-400">{isBn ? 'মোট কার্টুন সংখ্যা:' : 'Total Cartons:'}</span>
              <p className="font-semibold font-mono text-slate-700 dark:text-slate-200">{customerCartons.length} {isBn ? 'টি কার্টুন' : 'cartons'}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-400">{isBn ? 'মোট ফ্রেইট ওজন (kg):' : 'Total Weight:'}</span>
              <p className="font-semibold font-mono text-emerald-600 dark:text-emerald-400">{totalWeightShipped.toFixed(1)} kg</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-400">{isBn ? 'মোট কার্গো ভলিউম (CBM):' : 'Total Volume:'}</span>
              <p className="font-semibold font-mono text-blue-600 dark:text-blue-400">{totalCbmShipped.toFixed(2)} CBM</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-400">{isBn ? 'প্রাইমারি মার্ক প্রিফিক্স:' : 'Master Mark Prefix:'}</span>
              <p className="font-semibold font-mono text-[#00897B]">{selectedCustomer.shipping_mark || 'MAR-8801'}</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation: Products Cartons History vs Financial Transactions Ledger */}
        <div className="flex items-center space-x-2 border-b dark:border-slate-700/80 pb-2">
          <button
            onClick={() => setCustomerActiveTab('products')}
            className={`px-4 py-2 rounded-none-none text-xs font-normal transition-all cursor-pointer flex items-center space-x-2 ${
              customerActiveTab === 'products'
                ? 'bg-[#00897B] text-white shadow-2xs'
                : isDark
                ? 'bg-[#1E293B] text-slate-400 hover:text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>{isBn ? `📦 কাস্টমারের সব প্রোডাক্ট কার্টুন (${customerCartons.length})` : `Cartons & Product History (${customerCartons.length})`}</span>
          </button>

          <button
            onClick={() => setCustomerActiveTab('transactions')}
            className={`px-4 py-2 rounded-none-none text-xs font-normal transition-all cursor-pointer flex items-center space-x-2 ${
              customerActiveTab === 'transactions'
                ? 'bg-[#00897B] text-white shadow-2xs'
                : isDark
                ? 'bg-[#1E293B] text-slate-400 hover:text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>{isBn ? `💰 পেমেন্ট ও লেনদেন ইতিহাস (${customerLedger.length})` : `Ledger Transactions (${customerLedger.length})`}</span>
          </button>
        </div>

        {/* TAB 1: PRODUCT CARTONS HISTORY */}
        {customerActiveTab === 'products' && (
          <div className={`border rounded-none-none overflow-hidden shadow-2xs ${
            isDark ? 'bg-[#1E293B] border-slate-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-900'
          }`}>
            <div className="p-4 border-b dark:border-slate-700/80 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold flex items-center space-x-2">
                  <Package className="w-4 h-4 text-[#00897B]" />
                  <span>{isBn ? 'এই কাস্টমারের মাধ্যমে আনানো সকল প্রোডাক্ট ও কার্টুন তালিকা' : 'All Products & Cartons Shipped by Customer'}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 font-normal">
                  {isBn ? 'প্রত্যেকটি কার্টুনের আলাদা নিজস্ব শিপিং মার্ক সহ লাইভ ইনভেন্টরি' : 'Individual carton shipping marks and live tracking'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-normal">
                <thead className={`uppercase text-[10px] tracking-wider border-b font-medium ${
                  isDark ? 'bg-[#1E293B] text-slate-400 border-slate-700/80' : 'bg-slate-50/80 text-slate-500 border-slate-200/70'
                }`}>
                  <tr>
                    <th className="p-3.5">Carton Code</th>
                    <th className="p-3.5">কার্টুনের নিজস্ব শিপিং মার্ক</th>
                    <th className="p-3.5">Product Details</th>
                    <th className="p-3.5">Gross Weight</th>
                    <th className="p-3.5">Volume (CBM)</th>
                    <th className="p-3.5">Warehouse Hub</th>
                    <th className="p-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800/80' : 'divide-slate-100'}`}>
                  {customerCartons.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-xs text-slate-400 font-normal">
                        {isBn ? 'এই কাস্টমারের মার্কের বিপরীতে কোনো কার্টুন বুকিং পাওয়া যায়নি।' : 'No cartons found matching this shipping mark.'}
                      </td>
                    </tr>
                  ) : (
                    customerCartons.map((ctn) => (
                      <tr key={ctn.id} className={isDark ? 'hover:bg-[#222224] transition-colors' : 'hover:bg-slate-50/60 transition-colors'}>
                        <td className="p-3.5 font-mono font-medium text-[#00897B]">
                          {ctn.ctn_no}
                        </td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-none-none text-[11px] font-mono font-medium bg-[#00897B]/10 text-[#00897B] border border-[#00897B]/20">
                            <Tag className="w-3 h-3" />
                            <span>{ctn.shipping_mark || `${selectedCustomer.shipping_mark || 'MAR-8801'}/${ctn.ctn_no}`}</span>
                          </span>
                        </td>
                        <td className="p-3.5">
                          <p className="font-medium text-slate-800 dark:text-slate-200">{ctn.product_name_en}</p>
                          {ctn.product_name_cn && <p className="text-[10px] text-slate-400">{ctn.product_name_cn}</p>}
                        </td>
                        <td className="p-3.5 font-mono text-emerald-700 dark:text-emerald-400">
                          {ctn.gross_weight} kg
                        </td>
                        <td className="p-3.5 font-mono text-blue-600 dark:text-blue-400">
                          {ctn.cbm} CBM
                        </td>
                        <td className="p-3.5">
                          <span className="flex items-center space-x-1 text-slate-600 dark:text-slate-300">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{ctn.current_warehouse_name || 'Guangzhou Hub'}</span>
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-0.5 rounded-none-none text-[10px] font-normal border ${
                            ctn.status === 'delivered'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : ctn.status === 'in_transit'
                              ? 'bg-blue-50 text-blue-800 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300'
                              : 'bg-amber-50 text-amber-800 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}>
                            {ctn.status === 'delivered' ? '🟢 Delivered' : ctn.status === 'in_transit' ? '✈️ In Transit' : '📦 At Origin Hub'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: FINANCIAL TRANSACTIONS LEDGER */}
        {customerActiveTab === 'transactions' && (
          <div className={`border rounded-none-none overflow-hidden shadow-2xs ${
            isDark ? 'bg-[#1E293B] border-slate-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-900'
          }`}>
            <div className="p-4 border-b dark:border-slate-700/80 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold flex items-center space-x-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span>{isBn ? 'কাস্টমারের পেমেন্ট জমার অডিট লেজার' : 'Financial Ledger Transactions Audit Trail'}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 font-normal">
                  {isBn ? 'সমস্ত ফ্রেইট চার্জ এবং পেমেন্ট জমার সঠিক হিসাবপত্র' : 'Complete audit of billed charges and payments received'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-normal">
                <thead className={`uppercase text-[10px] tracking-wider border-b font-medium ${
                  isDark ? 'bg-[#1E293B] text-slate-400 border-slate-700/80' : 'bg-slate-50/80 text-slate-500 border-slate-200/70'
                }`}>
                  <tr>
                    <th className="p-3.5">Date & Time</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Details / Description</th>
                    <th className="p-3.5">Payment Method</th>
                    <th className="p-3.5 text-right">Charge (বিল)</th>
                    <th className="p-3.5 text-right">Payment (জমা)</th>
                    <th className="p-3.5 text-center">Officer</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800/80' : 'divide-slate-100'}`}>
                  {customerLedger.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-xs text-slate-400 font-normal">
                        {isBn ? 'এই কাস্টমারের কোনো লেজার ট্রানজেকশন রেকর্ড পাওয়া যায়নি।' : 'No transactions recorded for this customer.'}
                      </td>
                    </tr>
                  ) : (
                    customerLedger.map((entry) => (
                      <tr key={entry.id} className={isDark ? 'hover:bg-[#222224] transition-colors' : 'hover:bg-slate-50/60 transition-colors'}>
                        <td className="p-3.5 font-mono text-slate-400 text-[11px]">
                          {new Date(entry.created_at).toLocaleString()}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-none-none text-[10px] font-normal border ${
                            entry.type === 'payment'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-amber-50 text-amber-800 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}>
                            {entry.type === 'payment' ? '🟢 পেমেন্ট জমা' : '🧾 ফ্রেইট বিল'}
                          </span>
                        </td>
                        <td className="p-3.5 text-xs text-slate-700 dark:text-slate-200">
                          {entry.note}
                        </td>
                        <td className="p-3.5 font-mono text-[11px]">
                          {entry.payment_method ? (
                            <span className="uppercase text-[#00897B] font-medium">{entry.payment_method} ({entry.reference_no || 'N/A'})</span>
                          ) : (
                            <span className="text-slate-400">System Auto</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right font-mono font-medium text-amber-800 dark:text-amber-400">
                          {entry.type === 'charge' ? `৳${entry.amount.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-3.5 text-right font-mono font-medium text-emerald-700 dark:text-emerald-400">
                          {entry.type === 'payment' ? `৳${entry.amount.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-3.5 text-center text-slate-500 text-[11px]">
                          {entry.entered_by_name || 'System'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
            isDark ? 'bg-[#1E293B] border-slate-700/80' : 'bg-amber-50/40 border-amber-100/80'
          }`}>
            <span className="text-[11px] font-normal text-slate-500 flex items-center justify-between">
              <span>{isBn ? 'মোট ফ্রেইট চার্জ বিল' : 'Total Freight Billed'}</span>
              <Receipt className="w-3.5 h-3.5 text-amber-600" />
            </span>
            <p className="text-lg font-semibold text-amber-800 dark:text-amber-300 font-mono">৳{totalBilledAll.toLocaleString()}</p>
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
                            {cust.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-xs text-slate-800 dark:text-white">{cust.name}</p>
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
                        <p className="font-mono text-slate-700 dark:text-slate-300">{cust.phone}</p>
                        <p className="text-[10px] text-slate-400">{cust.company_name || cust.address}</p>
                      </td>

                      {/* Billed */}
                      <td className="p-3.5 text-right font-mono font-normal text-slate-700 dark:text-slate-300">
                        ৳{billedAmt.toLocaleString()}
                      </td>

                      {/* Paid */}
                      <td className="p-3.5 text-right font-mono font-medium text-emerald-700 dark:text-emerald-400">
                        ৳{(cust.total_paid || 0).toLocaleString()}
                      </td>

                      {/* Current Due (বাকি) */}
                      <td className="p-3.5 text-right font-mono">
                        {cust.total_due > 0 ? (
                          <span className="font-semibold text-rose-600 dark:text-rose-400 text-xs">
                            ৳{cust.total_due.toLocaleString()}
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
    </div>
  );
};
