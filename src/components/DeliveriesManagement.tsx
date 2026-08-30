import React, { useState } from 'react';
import {
  Truck,
  CheckCircle2,
  DollarSign,
  UserCheck,
  Plus,
  Search,
  Package,
  X,
  AlertCircle,
  Building2,
  Calendar,
} from 'lucide-react';
import { Carton, Customer, LedgerEntry, User, Language, AuditLog } from '../types';
import { ToastContainer, ToastMessage } from './Toast';
import { INITIAL_CUSTOMERS } from '../mockData';
import { useTheme } from '../context/ThemeContext';
import { saveHostingerDbData, logSystemAuditAction } from '../lib/db';

interface DeliveriesManagementProps {
  cartons: Carton[];
  setCartons: React.Dispatch<React.SetStateAction<Carton[]>>;
  setLedgerEntries: React.Dispatch<React.SetStateAction<LedgerEntry[]>>;
  currentUser: User;
  language: Language;
}

export const DeliveriesManagement: React.FC<DeliveriesManagementProps> = ({
  cartons,
  setCartons,
  setLedgerEntries,
  currentUser,
  language,
}) => {
  const isBn = language === 'bn';
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const myWhId = currentUser.warehouse_id || 'wh-bd';

  // Toast feedback
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: `toast-${Date.now()}`, type, title, message }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Customers State (with inline quick-add support)
  const [customersList, setCustomersList] = useState<Customer[]>(INITIAL_CUSTOMERS);

  // Cartons ready for delivery at warehouse (Scoped strictly by destination warehouse ID)
  const userWhId = currentUser?.warehouse_id || 'wh-bd';
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const readyCartons = cartons.filter((c) => {
    const isReadyStatus = c.status === 'received' || (c.current_warehouse_id === userWhId && c.status !== 'delivered' && c.status !== 'in_transit' && c.status !== 'booked');

    if (isSuperAdmin) return isReadyStatus;

    // Strict destination / current location match:
    const isMyDestinationOrWh = c.destination_warehouse_id === userWhId || c.current_warehouse_id === userWhId;
    return isReadyStatus && isMyDestinationOrWh;
  });

  // Payment Type Filter Pill ('all' | 'with_pay' | 'without_pay')
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'with_pay' | 'without_pay'>('all');

  const filteredReadyCartons = readyCartons.filter((c) => {
    const matchedCust = customersList.find(
      (cust) => cust.shipping_mark && c.shipping_mark && cust.shipping_mark.toLowerCase() === c.shipping_mark.toLowerCase()
    );
    const hasDue = matchedCust ? matchedCust.total_due > 0 : false;
    if (paymentFilter === 'with_pay') return hasDue;
    if (paymentFilter === 'without_pay') return !hasDue;
    return true;
  });

  // Multi-select for Bulk Delivery
  const [selectedCartonIds, setSelectedCartonIds] = useState<string[]>([]);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  // Delivery Modal Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customersList[0]?.id || '');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [collectCash, setCollectCash] = useState(true);
  const [cashAmount, setCashAmount] = useState<number>(50000);
  const [deliveryNote, setDeliveryNote] = useState('');

  const toggleSelectCarton = (id: string) => {
    setSelectedCartonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedCartonIds.length === readyCartons.length) {
      setSelectedCartonIds([]);
    } else {
      setSelectedCartonIds(readyCartons.map((c) => c.id));
    }
  };

  const handleOpenDeliveryModal = (singleCartonId?: string) => {
    if (singleCartonId) {
      setSelectedCartonIds([singleCartonId]);
    }
    if (selectedCartonIds.length === 0 && !singleCartonId) {
      addToast('error', isBn ? 'কমপক্ষে একটি কার্টুন নির্বাচন করুন!' : 'Select at least one carton!');
      return;
    }
    setShowDeliveryModal(true);
  };

  const handleConfirmDelivery = (e: React.FormEvent) => {
    e.preventDefault();

    let targetCustomer: Customer | undefined;

    // Quick-add new customer inline if selected
    if (isNewCustomer) {
      if (!newCustName.trim()) {
        addToast('error', isBn ? 'নতুন গ্রাহকের নাম দিন!' : 'Enter new customer name!');
        return;
      }
      targetCustomer = {
        id: `cust-${Date.now()}`,
        customer_code: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
        name: newCustName,
        phone: newCustPhone || '01700000000',
        address: 'Dhaka, Bangladesh',
        total_due: 0,
        total_paid: 0,
        created_at: new Date().toISOString(),
      };
      setCustomersList((prev) => [targetCustomer!, ...prev]);
    } else {
      targetCustomer = customersList.find((c) => c.id === selectedCustomerId);
    }

    if (!targetCustomer) return;

    // 1. Mark selected cartons as delivered
    const updatedCartons = cartons.map((c) =>
      selectedCartonIds.includes(c.id) || selectedCartonIds.includes(c.ctn_no)
        ? {
            ...c,
            status: 'delivered' as const,
            updated_at: new Date().toISOString(),
          }
        : c
    );

    setCartons(updatedCartons);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);

    logSystemAuditAction(
      currentUser,
      'carton_delivered_customer',
      'carton',
      selectedCartonIds.join(','),
      `${selectedCartonIds.length} cartons delivered to customer ${targetCustomer.name} by ${currentUser.name}`
    );

    // 2. Insert into ledger_entries if cash collected
    if (collectCash && cashAmount > 0) {
      const newLedgerEntry: LedgerEntry = {
        id: `ledg-${Date.now()}`,
        customer_id: targetCustomer.id,
        customer_code: targetCustomer.customer_code,
        customer_name: targetCustomer.name,
        type: 'payment',
        amount: cashAmount,
        note: deliveryNote || `Physical Delivery Cash Collection (${selectedCartonIds.length} Cartons)`,
        source: 'auto_cash_collection',
        entered_by: currentUser.id,
        entered_by_name: currentUser.name,
        warehouse_id: myWhId,
        created_at: new Date().toISOString(),
      };

      setLedgerEntries((prev) => [newLedgerEntry, ...prev]);
    }

    addToast(
      'success',
      isBn ? 'ডেলিভারি ও ক্যাশ কালেকশন সম্পন্ন!' : 'Delivery & Cash Collection Completed!',
      isBn
        ? `${selectedCartonIds.length} টি কার্টুন গ্রাহক (${targetCustomer.name}) কে ডেলিভারি দেওয়া হয়েছে${
            collectCash ? ` এবং ৳${cashAmount.toLocaleString()} লেজারে জমা হয়েছে` : ''
          }`
        : `${selectedCartonIds.length} cartons delivered to ${targetCustomer.name}`
    );

    setShowDeliveryModal(false);
    setSelectedCartonIds([]);
  };

  return (
    <div className="space-y-6 font-sans">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header Banner */}
      <div className={`p-6 rounded-none border ${
        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
      } flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-none">
            <Truck className="w-6 h-6 font-light" />
          </div>
          <div>
            <h2 className="text-lg font-normal tracking-wide flex items-center space-x-2">
              <span>{isBn ? 'বাংলাদেশ ওয়্যারহাউজ ডেলিভারি ও ক্যাশ কালেকশন' : 'Customer Delivery & Payment Processing'}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-light mt-1">
              {isBn
                ? 'গন্তব্য ওয়্যারহাউজে রিসিভড হওয়া কার্টুনগুলো With Pay (টাকা বাকি) ও Without Pay (পরিশোধিত) হিসেবে শ্রেণীবদ্ধ করে ডেলিভারি দিন'
                : 'Hand over arrived cartons to customers and divide by With Pay (Due) vs Without Pay (Paid)'}
            </p>
          </div>
        </div>

        {selectedCartonIds.length > 0 && (
          <button
            type="button"
            onClick={() => handleOpenDeliveryModal()}
            className="flex items-center justify-center space-x-2 py-2 px-5 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-light text-xs transition-all border border-emerald-700 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isBn
                ? `একত্রে ডেলিভারি দিন (${selectedCartonIds.length} Cartons)`
                : `Bulk Deliver (${selectedCartonIds.length} Cartons)`}
            </span>
          </button>
        )}
      </div>

      {/* Payment Classification Filter Bar */}
      <div className={`p-4 rounded-none border ${
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
      } flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-light">{isBn ? 'পেমেন্ট ধরন ফিল্টার:' : 'Filter Payment:'}</span>
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setPaymentFilter('all')}
              className={`px-3 py-1.5 rounded-none text-xs font-light border cursor-pointer transition-all ${
                paymentFilter === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              📦 {isBn ? `সকল রিসিভড পণ্য (${readyCartons.length})` : `All Ready (${readyCartons.length})`}
            </button>
            <button
              type="button"
              onClick={() => setPaymentFilter('with_pay')}
              className={`px-3 py-1.5 rounded-none text-xs font-light border cursor-pointer transition-all ${
                paymentFilter === 'with_pay'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              💰 {isBn ? 'With Pay (টাকা বাকি)' : 'With Pay (Due)'}
            </button>
            <button
              type="button"
              onClick={() => setPaymentFilter('without_pay')}
              className={`px-3 py-1.5 rounded-none text-xs font-light border cursor-pointer transition-all ${
                paymentFilter === 'without_pay'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              ✅ {isBn ? 'Without Pay (পরিশোধিত)' : 'Without Pay (Paid)'}
            </button>
          </div>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono font-light">
          {filteredReadyCartons.length} {isBn ? 'টি কার্টুন প্রদর্শিত' : 'Cartons Displayed'}
        </div>
      </div>

      {/* Ready Cartons Table */}
      <div className={`rounded-none border overflow-hidden ${
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
      }`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-normal text-slate-900 dark:text-white flex items-center space-x-2">
            <Package className="w-4 h-4 text-emerald-500" />
            <span>{isBn ? 'ডেলিভারির জন্য প্রস্তুত কার্টুনসমূহ (Received Stock)' : 'Ready for Customer Delivery'}</span>
          </h3>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-light">{filteredReadyCartons.length} Ready</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-light">
            <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3">
                  <input
                    type="checkbox"
                    checked={filteredReadyCartons.length > 0 && selectedCartonIds.length === filteredReadyCartons.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-emerald-600 rounded-none cursor-pointer"
                  />
                </th>
                <th className="p-3 font-normal">CTN No</th>
                <th className="p-3 font-normal">Shipping Mark</th>
                <th className="p-3 font-normal">Tracking No</th>
                <th className="p-3 font-normal">Product Name</th>
                <th className="p-3 font-normal">Gross Weight</th>
                <th className="p-3 font-normal">Payment Type</th>
                <th className="p-3 text-right font-normal">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredReadyCartons.map((c) => {
                const isSelected = selectedCartonIds.includes(c.id);
                const matchedCust = customersList.find(
                  (cust) => cust.shipping_mark && c.shipping_mark && cust.shipping_mark.toLowerCase() === c.shipping_mark.toLowerCase()
                );
                const hasDue = matchedCust ? matchedCust.total_due > 0 : false;
                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                      isSelected ? 'bg-emerald-500/10' : ''
                    }`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectCarton(c.id)}
                        className="w-4 h-4 accent-emerald-600 rounded-none cursor-pointer"
                      />
                    </td>
                    <td className="p-3 font-mono font-normal text-slate-900 dark:text-white">{c.ctn_no}</td>
                    <td className="p-3 text-blue-600 dark:text-blue-400 font-normal">{c.shipping_mark}</td>
                    <td className="p-3 text-slate-500 dark:text-slate-400 font-mono">{c.tracking_number}</td>
                    <td className="p-3">
                      <div className="font-normal text-slate-800 dark:text-slate-200">{c.product_name_en}</div>
                      {c.product_name_cn && (
                        <div className="text-[10px] text-slate-400 font-light">{c.product_name_cn}</div>
                      )}
                    </td>
                    <td className="p-3 text-slate-900 dark:text-white font-normal">{c.gross_weight} kg</td>
                    <td className="p-3">
                      {hasDue ? (
                        <span className="px-2 py-0.5 rounded-none bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-light border border-amber-500/20 inline-flex items-center space-x-1">
                          <span>💰 With Pay</span>
                          <span className="text-[9px] opacity-80">(৳{matchedCust?.total_due.toLocaleString()} বাকি)</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-none bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-light border border-emerald-500/20 inline-flex items-center space-x-1">
                          <span>✅ Without Pay</span>
                          <span className="text-[9px] opacity-80">(পরিশোধিত)</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDeliveryModal(c.id)}
                        className="px-3 py-1 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-light text-xs transition-all border border-emerald-700 cursor-pointer"
                      >
                        {isBn ? 'ডেলিভারি ও ক্যাশ' : 'Deliver & Cash'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {readyCartons.length === 0 && (
          <div className="p-12 text-center text-xs text-slate-400 font-light">
            {isBn ? 'বর্তমানে ডেলিভারি দেওয়ার মতো রিসিভড কার্টুন নেই!' : 'No received cartons awaiting delivery!'}
          </div>
        )}
      </div>

      {/* Delivery & Cash Collection Modal */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmDelivery}
            className={`p-6 max-w-lg w-full space-y-5 rounded-none border ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            } shadow-2xl animate-in zoom-in-95`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="text-base font-normal tracking-wide flex items-center space-x-2">
                <Truck className="w-5 h-5 text-emerald-500" />
                <span>{isBn ? 'ডেলিভারি ও ক্যাশ কালেকশন ফরম' : 'Delivery & Cash Collection Form'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowDeliveryModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-none bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1 font-light">
              <div>মোট সিলেক্টেড কার্টুন: <strong className="text-slate-900 dark:text-white font-normal">{selectedCartonIds.length} Pcs</strong></div>
              <div>ওয়্যারহাউজ: <strong className="text-emerald-600 dark:text-emerald-400 font-normal">M/S Four Star Cargo (Dhaka Hub)</strong></div>
            </div>

            {/* Customer Selection / Inline Quick-Add */}
            <div className="space-y-3 text-xs font-light">
              <div className="flex items-center justify-between">
                <label className="text-slate-600 dark:text-slate-300 font-normal">{isBn ? 'কাস্টমার নির্বাচন করুন *' : 'Select Customer *'}</label>
                <button
                  type="button"
                  onClick={() => setIsNewCustomer(!isNewCustomer)}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isNewCustomer ? (isBn ? 'বিদ্যমান কাস্টমার সিলেক্ট' : 'Select Existing') : (isBn ? '+ নতুন কাস্টমার যোগ' : '+ Quick Add New')}</span>
                </button>
              </div>

              {!isNewCustomer ? (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-none p-2.5 text-slate-800 dark:text-white outline-none focus:border-emerald-500 font-light"
                >
                  {customersList.map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {cust.name} ({cust.customer_code}) — {cust.phone}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-none bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">{isBn ? 'গ্রাহকের নাম *' : 'Customer Name *'}</label>
                    <input
                      type="text"
                      required
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      placeholder="e.g. বিসমিল্লাহ ট্রেডার্স"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none p-2 text-slate-800 dark:text-white outline-none font-light"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">{isBn ? 'মোবাইল নম্বর' : 'Phone Number'}</label>
                    <input
                      type="text"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      placeholder="01700000000"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none p-2 text-slate-800 dark:text-white font-mono outline-none font-light"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Optional Cash Collection Toggle */}
            <div className="p-4 rounded-none bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3 text-xs font-light">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span className="font-normal text-slate-900 dark:text-white">{isBn ? 'নগদ অর্থ সংগ্রহ করবেন? (Collect Cash)' : 'Collect Cash Now?'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={collectCash}
                  onChange={(e) => setCollectCash(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded-none cursor-pointer"
                />
              </div>

              {collectCash && (
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1 font-normal">
                      {isBn ? 'সংগৃহীত নগদ টাকার পরিমাণ (BDT ৳)' : 'Collected Cash Amount (BDT ৳)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none p-2.5 text-emerald-600 dark:text-emerald-400 font-normal font-mono outline-none text-base"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">{isBn ? 'নোট / রসিদ নম্বর (Note)' : 'Receipt Note'}</label>
                    <input
                      type="text"
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder="e.g. ক্যাশ মেমো নং #8894"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-none p-2 text-slate-800 dark:text-white outline-none font-light"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeliveryModal(false)}
                className="px-4 py-2 rounded-none bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-light hover:bg-slate-200 border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-light text-xs transition-all border border-emerald-700 cursor-pointer"
              >
                {isBn ? 'ডেলিভারি ও ক্যাশ কনফার্ম করুন' : 'Confirm Delivery & Cash'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
