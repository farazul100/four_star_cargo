import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Package,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  Plane,
  Clock,
  Box,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Carton, Warehouse, User, Language, FlyingProposal } from '../types';
import { getHostingerDbData, saveHostingerDbData, saveHostingerDbMultiData, logSystemAuditAction, subscribeToDbUpdates } from '../lib/db';
import { useTheme } from '../context/ThemeContext';
import { ToastContainer, ToastMessage } from './Toast';

interface ReturnParcelSectionProps {
  cartons: Carton[];
  setCartons: React.Dispatch<React.SetStateAction<Carton[]>>;
  currentUser: User;
  language: Language;
  warehouses?: Warehouse[];
}

export const ReturnParcelSection: React.FC<ReturnParcelSectionProps> = ({
  cartons,
  setCartons,
  currentUser,
  language,
  warehouses = [],
}) => {
  const isBn = language === 'bn';
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Toast feedback
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: `toast-${Date.now()}`, type, title, message }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_transit' | 'proposed' | 'returned'>('all');
  const [selectedCartonIds, setSelectedCartonIds] = useState<string[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Live Sync with DB
  useEffect(() => {
    return subscribeToDbUpdates(() => {
      const db = getHostingerDbData();
      if (db.cartons) {
        setCartons(db.cartons);
      }
    });
  }, [setCartons]);

  // Filter cartons relevant for return operation
  const returnableCartons = React.useMemo(() => {
    return cartons.filter((c) => {
      // Must be either in_transit, proposed, or already returned
      const isValidStatus = c.status === 'in_transit' || c.status === 'proposed' || c.status === 'returned';
      if (!isValidStatus) return false;

      // Status filter
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCtn = (c.ctn_no || '').toLowerCase().includes(q);
        const matchMark = (c.shipping_mark || '').toLowerCase().includes(q);
        const matchTrk = (c.tracking_number || '').toLowerCase().includes(q);
        const matchMasterTrk = (c.master_tracking_number || '').toLowerCase().includes(q);
        const matchPkg = (c.packaging_number || '').toLowerCase().includes(q);
        const matchProd = (c.product_name_en || '').toLowerCase().includes(q);
        const matchFlight = (c.flight_number || '').toLowerCase().includes(q);
        return matchCtn || matchMark || matchTrk || matchMasterTrk || matchPkg || matchProd || matchFlight;
      }

      return true;
    });
  }, [cartons, statusFilter, searchQuery]);

  // Check if a carton is already received in BD (Cannot be returned!)
  const isBdReceivedCarton = (c: Carton): boolean => {
    return c.status === 'received' || c.status === 'delivered' || c.current_warehouse_id === 'wh-bd';
  };

  // Toggle selection for a single carton
  const handleToggleSelect = (carton: Carton) => {
    if (isBdReceivedCarton(carton)) {
      addToast(
        'error',
        isBn ? 'রিটার্ন অযোগ্য পার্সেল!' : 'Parcel Cannot Be Returned!',
        isBn
          ? 'যে পার্সেলগুলো ইতিমধ্যে বাংলাদেশে রিসিভ করা হয়েছে, সেগুলো আর রিটার্ন করা যাবে না।'
          : 'Parcels that have already been received in Bangladesh cannot be returned to origin warehouse.'
      );
      return;
    }

    if (carton.status === 'returned') {
      addToast(
        'info',
        isBn ? 'ইতিমধ্যে রিটার্নড' : 'Already Returned',
        isBn ? 'এই পার্সেলটি ইতিমধ্যে ওয়্যারহাউজে রিটার্ন করা হয়েছে।' : 'This parcel has already been returned to warehouse stock.'
      );
      return;
    }

    setSelectedCartonIds((prev) =>
      prev.includes(carton.id) ? prev.filter((id) => id !== carton.id) : [...prev, carton.id]
    );
  };

  // Toggle select all eligible cartons
  const handleToggleSelectAll = () => {
    const eligibleCartons = returnableCartons.filter((c) => !isBdReceivedCarton(c) && c.status !== 'returned');
    if (selectedCartonIds.length >= eligibleCartons.length && eligibleCartons.length > 0) {
      setSelectedCartonIds([]);
    } else {
      setSelectedCartonIds(eligibleCartons.map((c) => c.id));
    }
  };

  // Open confirmation modal
  const handleInitiateReturn = () => {
    if (selectedCartonIds.length === 0) {
      addToast(
        'error',
        isBn ? 'পার্সেল নির্বাচন করুন' : 'No Parcels Selected',
        isBn ? 'অনুগ্রহ করে রিটার্ন করার জন্য অন্তত ১টি ফ্লাইকৃত/ইন-ট্রানজিট পার্সেল সিলেক্ট করুন।' : 'Please select at least one flown/in-transit parcel to return.'
      );
      return;
    }

    // Double check if any selected carton was somehow BD received
    const containsBdReceived = cartons.some(
      (c) => selectedCartonIds.includes(c.id) && isBdReceivedCarton(c)
    );

    if (containsBdReceived) {
      addToast(
        'error',
        isBn ? 'রিটার্ন অযোগ্য পার্সেল পাওয়া গেছে!' : 'Invalid Parcels Selected!',
        isBn
          ? 'যে পার্সেলগুলো ইতিমধ্যে বাংলাদেশে রিসিভ করা হয়েছে, সেগুলো আর রিটার্ন করা যাবে না।'
          : 'Parcels already received in Bangladesh cannot be returned.'
      );
      return;
    }

    setShowConfirmModal(true);
  };

  // Execute Return Action
  const handleConfirmReturnParcels = () => {
    if (selectedCartonIds.length === 0) return;

    const dbData = getHostingerDbData();
    const currentCartons: Carton[] = dbData.cartons || cartons || [];
    const currentProposals: FlyingProposal[] = dbData.proposals || [];

    const targetSet = new Set(selectedCartonIds);
    const returnTimestamp = new Date().toISOString();
    const finalReason = returnReason.trim() || (isBn ? 'ফ্লাইট/ট্রানজিট থেকে অরিজিন ওয়্যারহাউজে রিটার্ন' : 'Returned from flight transit to origin warehouse');
    const myWhId = currentUser.warehouse_id || 'wh-china';

    // Update Cartons
    const updatedCartons = currentCartons.map((c) => {
      if (targetSet.has(c.id)) {
        return {
          ...c,
          status: 'returned' as const,
          current_warehouse_id: myWhId,
          returned_at: returnTimestamp,
          returned_reason: finalReason,
          returned_by: currentUser.name,
          updated_at: returnTimestamp,
        };
      }
      return c;
    });

    // Clean proposal lists if any returned carton was part of active proposals
    const updatedProposals = currentProposals.map((prop) => {
      if (prop.carton_ids && prop.carton_ids.some((id) => targetSet.has(id))) {
        return {
          ...prop,
          carton_ids: prop.carton_ids.filter((id) => !targetSet.has(id)),
          updated_at: returnTimestamp,
        };
      }
      return prop;
    });

    // Save to Database
    saveHostingerDbMultiData({
      fsc_vps_cartons: updatedCartons,
      fsc_vps_proposals: updatedProposals,
    });

    setCartons(updatedCartons);

    // Audit Logging
    logSystemAuditAction(
      currentUser,
      'RETURN_PARCELS_TO_WAREHOUSE',
      'carton',
      Array.from(targetSet).join(','),
      `ইউজার ${currentUser.name} (${currentUser.role}) ${selectedCartonIds.length}টি ফ্লাইকৃত কার্টুন সফলভাবে ওয়্যারহাউজে রিটার্ন করেছেন। কারণ: ${finalReason}`
    );

    addToast(
      'success',
      isBn ? 'রিটার্ন সফল হয়েছে!' : 'Parcels Returned Successfully!',
      isBn
        ? `সিলেক্টকৃত ${selectedCartonIds.length}টি পার্সেল ওয়্যারহাউজ স্টকে রিটার্ন করা হয়েছে। কাস্টমার ট্র্যাকিংয়ে এটি আপডেট দেখতে পাবেন।`
        : `${selectedCartonIds.length} parcels returned to origin warehouse. Customer tracking updated.`
    );

    setSelectedCartonIds([]);
    setReturnReason('');
    setShowConfirmModal(false);
  };

  // Option to Reset Returned Parcel Back to Normal Booked Stock
  const handleResetReturnedToBooked = (cartonId: string) => {
    const targetCarton = cartons.find((c) => c.id === cartonId);
    if (!targetCarton) return;

    if (!window.confirm(isBn ? `আপনি কি পার্সেল "${targetCarton.ctn_no}"-কে পুনরায় সাধারণ বুকিং স্টকে নিতে চান?` : `Re-activate parcel "${targetCarton.ctn_no}" into normal booked stock?`)) {
      return;
    }

    const dbData = getHostingerDbData();
    const currentCartons: Carton[] = dbData.cartons || cartons || [];

    const updatedCartons = currentCartons.map((c) => {
      if (c.id === cartonId) {
        const { returned_at, returned_reason, returned_by, ...rest } = c;
        return {
          ...rest,
          status: 'booked' as const,
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    saveHostingerDbData('fsc_vps_cartons', updatedCartons);
    setCartons(updatedCartons);

    addToast(
      'info',
      isBn ? 'স্টকে রিস্টোর করা হয়েছে' : 'Restored to Stock',
      isBn ? `পার্সেল "${targetCarton.ctn_no}" সাধারণ বুকিং তালিকায় ফেরত নেওয়া হয়েছে।` : `Parcel "${targetCarton.ctn_no}" restored to active booked stock.`
    );
  };

  return (
    <div className="space-y-6 font-sans">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 1. Header Banner */}
      <div className={`p-6 rounded-2xl border transition-all shadow-xl ${
        isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center font-bold shrink-0 shadow-sm">
              <RotateCcw className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black tracking-wide">
                  {isBn ? '🔄 রিটার্ন পার্সেল ব্যবস্থাপন (Return Parcel Management)' : '🔄 Return Parcel Management'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40">
                  LIVE STOCK RETURN
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isBn
                  ? 'ফ্লাইট/ট্রানজিটে থাকা কার্টুন ফেরত এনে ওয়্যারহাউজ স্টকে ব্যাক করুন। (বিডি ওয়্যারহাউজে রিসিভডকৃত পার্সেল রিটার্ন করা যাবে না)'
                  : 'Return in-transit or flown parcels back to origin warehouse stock. (Parcels already received in BD cannot be returned)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleInitiateReturn}
            disabled={selectedCartonIds.length === 0}
            className={`px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center space-x-2 transition-all cursor-pointer shadow-lg ${
              selectedCartonIds.length > 0
                ? 'bg-amber-600 hover:bg-amber-500 text-white ring-2 ring-amber-500/50 hover:scale-105'
                : isDark
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>
              {isBn
                ? `রিটার্ন সম্পন্ন করুন (${selectedCartonIds.length})`
                : `Confirm Return (${selectedCartonIds.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Filters & Toolbar */}
      <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 transition-all ${
        isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center space-x-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? 'CTN NO, মার্ক, ট্র্যাকিং ID বা প্রোডাক্ট দিয়ে সার্চ...' : 'Search CTN NO, Mark, Tracking ID, Product...'}
              className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl border outline-none font-mono transition-all ${
                isDark ? 'bg-[#0F172A] border-slate-700 text-white focus:ring-2 focus:ring-amber-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:ring-2 focus:ring-amber-500'
              }`}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={`px-3 py-2 text-xs font-bold rounded-xl border outline-none font-mono cursor-pointer ${
              isDark ? 'bg-[#0F172A] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            <option value="all">{isBn ? 'সকল ফ্লাইকৃত ও রিটার্নড' : 'All Flown & Returned'}</option>
            <option value="in_transit">{isBn ? '✈️ ফ্লাইটে আছে (In-Transit)' : '✈️ In-Transit (Flying)'}</option>
            <option value="proposed">{isBn ? '📝 প্রোপোজড ফ্লিট (Proposed)' : '📝 Proposed Fleet'}</option>
            <option value="returned">{isBn ? '🔄 ইতিমধ্যে রিটার্নড (Returned)' : '🔄 Already Returned'}</option>
          </select>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className={`px-3 py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
            }`}
          >
            {isBn ? 'সকল রিটার্নযোগ্য সিলেক্ট করুন' : 'Select All Eligible'}
          </button>
          <span className="text-slate-400 font-bold">
            {selectedCartonIds.length} Selected
          </span>
        </div>
      </div>

      {/* 3. Returnable Cartons Inventory Table */}
      <div className={`rounded-2xl border overflow-hidden shadow-xl transition-all ${
        isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
            <thead className={`uppercase text-[11px] tracking-wider border-b font-mono font-extrabold ${
              isDark ? 'bg-[#0F172A] text-white border-slate-700' : 'bg-slate-100 text-slate-900 border-slate-300'
            }`}>
              <tr>
                <th className="p-3 text-center w-12 border-r border-slate-200/60 dark:border-slate-700/50">
                  <input
                    type="checkbox"
                    checked={
                      returnableCartons.filter((c) => !isBdReceivedCarton(c) && c.status !== 'returned').length > 0 &&
                      returnableCartons.filter((c) => !isBdReceivedCarton(c) && c.status !== 'returned').every((c) => selectedCartonIds.includes(c.id))
                    }
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-400 cursor-pointer accent-amber-500"
                  />
                </th>
                <th className="p-3 border-r border-slate-200/60 dark:border-slate-700/50 w-32">CTN NO</th>
                <th className="p-3 border-r border-slate-200/60 dark:border-slate-700/50 w-28">SHIPPING MARK</th>
                <th className="p-3 border-r border-slate-200/60 dark:border-slate-700/50 w-36">MASTER TRACKING</th>
                <th className="p-3 border-r border-slate-200/60 dark:border-slate-700/50">PRODUCT & FLIGHT</th>
                <th className="p-3 border-r border-slate-200/60 dark:border-slate-700/50 text-center w-28">G.WEIGHT / CBM</th>
                <th className="p-3 border-r border-slate-200/60 dark:border-slate-700/50 text-center w-36">CURRENT STATUS</th>
                <th className="p-3 text-center w-28">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 font-sans">
              {returnableCartons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 font-medium">
                    <Box className="w-10 h-10 mx-auto opacity-30 mb-2" />
                    <div>{isBn ? 'কোনো ফ্লাইকৃত বা রিটার্নযোগ্য পার্সেল পাওয়া যায়নি।' : 'No flown or returnable parcels found.'}</div>
                  </td>
                </tr>
              ) : (
                returnableCartons.map((c) => {
                  const isBdReceived = isBdReceivedCarton(c);
                  const isSelected = selectedCartonIds.includes(c.id);
                  const isReturned = c.status === 'returned';

                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors duration-150 ${
                        isSelected
                          ? isDark
                            ? 'bg-amber-950/40 text-amber-200 font-bold border-l-4 border-l-amber-500'
                            : 'bg-amber-50 text-slate-900 font-bold border-l-4 border-l-amber-500'
                          : isBdReceived
                          ? isDark
                            ? 'bg-red-950/20 text-slate-400 opacity-60'
                            : 'bg-red-50/40 text-slate-500 opacity-70'
                          : isReturned
                          ? isDark
                            ? 'bg-emerald-950/20 text-slate-300'
                            : 'bg-emerald-50/40 text-slate-800'
                          : isDark
                          ? 'hover:bg-slate-800/60'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center border-r border-slate-200/60 dark:border-slate-700/50">
                        <input
                          type="checkbox"
                          disabled={isBdReceived || isReturned}
                          checked={isSelected}
                          onChange={() => handleToggleSelect(c)}
                          className={`rounded border-slate-400 accent-amber-500 ${
                            isBdReceived || isReturned ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                          }`}
                        />
                      </td>

                      {/* CTN NO */}
                      <td className="p-3 font-mono font-bold border-r border-slate-200/60 dark:border-slate-700/50">
                        <div className="flex items-center space-x-1.5">
                          <span className={isDark ? 'text-white' : 'text-slate-900'}>{c.ctn_no}</span>
                        </div>
                        {c.packaging_number && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                            {c.packaging_number}
                          </div>
                        )}
                      </td>

                      {/* SHIPPING MARK */}
                      <td className="p-3 font-mono border-r border-slate-200/60 dark:border-slate-700/50">
                        <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {c.shipping_mark}
                        </span>
                      </td>

                      {/* MASTER TRACKING */}
                      <td className="p-3 font-mono text-[11px] border-r border-slate-200/60 dark:border-slate-700/50 truncate">
                        {c.master_tracking_number || c.tracking_number}
                      </td>

                      {/* PRODUCT & FLIGHT */}
                      <td className="p-3 border-r border-slate-200/60 dark:border-slate-700/50">
                        <div className="font-bold text-xs truncate max-w-[200px]">
                          {c.product_name_en}
                        </div>
                        {c.flight_number && (
                          <div className="text-[10px] text-amber-500 font-mono font-bold flex items-center space-x-1 mt-0.5">
                            <Plane className="w-3 h-3" />
                            <span>Flight: {c.flight_number} ({c.flying_date || 'N/A'})</span>
                          </div>
                        )}
                      </td>

                      {/* G.WEIGHT / CBM */}
                      <td className="p-3 text-center font-mono border-r border-slate-200/60 dark:border-slate-700/50">
                        <div className="font-extrabold text-emerald-600 dark:text-emerald-400">
                          {(c.gross_weight || 0).toFixed(1)} KG
                        </div>
                        <div className="text-[10px] text-purple-600 dark:text-purple-400">
                          {(c.cbm || 0).toFixed(2)} CBM
                        </div>
                      </td>

                      {/* CURRENT STATUS & WARNING BADGES */}
                      <td className="p-3 text-center border-r border-slate-200/60 dark:border-slate-700/50">
                        {isBdReceived ? (
                          <span
                            className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center space-x-1 shadow-2xs cursor-help"
                            title={isBn ? 'যে পার্সেলগুলো ইতিমধ্যে বাংলাদেশে রিসিভ করা হয়েছে, সেগুলো আর রিটার্ন করা যাবে না।' : 'Parcels already received in Bangladesh cannot be returned.'}
                          >
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            <span>{isBn ? '⛔ বিডি রিসিভড (রিটার্ন অযোগ্য)' : '⛔ Received in BD (Cannot Return)'}</span>
                          </span>
                        ) : isReturned ? (
                          <div className="space-y-0.5">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isBn ? '🔄 ওয়্যারহাউজে রিটার্নড' : '🔄 Returned to Warehouse'}</span>
                            </span>
                            {c.returned_at && (
                              <div className="text-[9px] font-mono text-slate-400">
                                {new Date(c.returned_at).toLocaleDateString('en-GB')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center space-x-1">
                            <Plane className="w-3.5 h-3.5" />
                            <span>{isBn ? '✈️ ফ্লাইটে আছে (In-Transit)' : '✈️ Flying (In-Transit)'}</span>
                          </span>
                        )}
                      </td>

                      {/* ACTION BUTTON */}
                      <td className="p-3 text-center">
                        {isBdReceived ? (
                          <span className="text-[10px] font-bold text-rose-500 italic">
                            {isBn ? 'ব্লকড (বিডি রিসিভড)' : 'Blocked (BD Received)'}
                          </span>
                        ) : isReturned ? (
                          <button
                            type="button"
                            onClick={() => handleResetReturnedToBooked(c.id)}
                            className="px-2.5 py-1 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer"
                            title={isBn ? 'পুুনরায় সাধারণ বুকিং তালিকায় ব্যাক করুন' : 'Restore to active booked stock'}
                          >
                            {isBn ? 'স্টকে রিস্টোর' : 'Restore'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCartonIds([c.id]);
                              setShowConfirmModal(true);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#00897B] hover:bg-[#00796B] text-white transition-all cursor-pointer shadow-sm flex items-center justify-center space-x-1.5 mx-auto active:scale-95"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{isBn ? 'রিটার্ন করুন' : 'Return'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[3000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className={`w-full max-w-lg rounded-2xl border p-6 space-y-5 shadow-2xl ${
            isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
          }`}>
            <div className="flex items-center space-x-3 border-b border-slate-200 dark:border-slate-700 pb-4">
              <div className="w-11 h-11 rounded-xl bg-[#00897B]/10 text-[#00897B] border border-[#00897B]/30 flex items-center justify-center font-bold shrink-0 shadow-xs">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {isBn ? `সিলেক্টকৃত ${selectedCartonIds.length}টি পার্সেল রিটার্ন নিশ্চিতকরণ` : `Confirm Return for ${selectedCartonIds.length} Parcels`}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                  {isBn ? 'পার্সেলগুলো ফ্লাইট থেকে ফেরত এনে অরিজিন ওয়্যারহাউজ স্টকে সেভ করা হবে।' : 'Selected parcels will be removed from flight and returned to warehouse stock.'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold block text-slate-800 dark:text-slate-200">
                {isBn ? 'রিটার্ন করার কারণ (রিজন নোট):' : 'Return Reason / Note:'}
              </label>
              <textarea
                rows={3}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder={isBn ? 'যেমন: ফ্লাইট ক্যানসেলড / এয়ারপোর্টে মাল ফেরত দেওয়া হয়েছে...' : 'e.g. Flight cancelled / Cargo returned from airport customs...'}
                className={`w-full p-3 rounded-xl border text-xs outline-none font-sans font-medium transition-all ${
                  isDark
                    ? 'bg-[#0F172A] border-slate-700 text-white placeholder-slate-500 focus:border-[#00897B] focus:ring-1 focus:ring-[#00897B]'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#00897B] focus:ring-1 focus:ring-[#00897B]'
                }`}
              />
            </div>

            <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-900 dark:text-teal-200 text-xs font-medium space-y-1">
              <div className="font-bold flex items-center space-x-1.5 text-teal-800 dark:text-teal-300">
                <ShieldAlert className="w-4 h-4 text-[#00897B] shrink-0" />
                <span>{isBn ? 'কাস্টমার ট্র্যাকিং নোটিশ:' : 'Customer Tracking Notice:'}</span>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                {isBn
                  ? 'কাস্টমার তার ট্র্যাকিং নম্বরে সার্চ করলে "🔄 পার্সেল ওয়্যারহাউজে রিটার্ন করা হয়েছে" মেসেজটি দেখতে পাবেন।'
                  : 'Customers searching their tracking ID will see "🔄 Parcel Returned to Origin Warehouse".'}
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {isBn ? 'ক্যান্সেল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmReturnParcels}
                className="px-6 py-2.5 bg-[#00897B] hover:bg-[#00796B] text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer active:scale-95"
              >
                {isBn ? 'হ্যাঁ, রিটার্ন সম্পন্ন করুন' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
