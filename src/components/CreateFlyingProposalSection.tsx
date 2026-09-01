import React, { useState, useEffect, useMemo } from 'react';
import {
  Plane,
  Search,
  Package,
  Layers,
  Send,
} from 'lucide-react';
import { Carton, Warehouse, User, Language, FlyingProposal } from '../types';
import { getHostingerDbData, saveHostingerDbMultiData, logSystemAuditAction, publishSystemNotification, subscribeToDbUpdates } from '../lib/db';
import { useTheme } from '../context/ThemeContext';
import { ToastContainer, ToastMessage } from './Toast';

interface CreateFlyingProposalSectionProps {
  currentUser: User;
  warehouses: Warehouse[];
  language: Language;
  onProposalCreated?: () => void;
}

export const CreateFlyingProposalSection: React.FC<CreateFlyingProposalSectionProps> = ({
  currentUser,
  warehouses,
  language,
  onProposalCreated,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isBn = language === 'bn';

  // Live state from DB
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [proposals, setProposals] = useState<FlyingProposal[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Toast Helper
  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: `toast-${Date.now()}`, type, title, message }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Form States
  const originWarehouses = useMemo(() => warehouses.filter((w) => !w.is_final_destination), [warehouses]);

  const [selectedOriginWhId, setSelectedOriginWhId] = useState<string>(
    currentUser?.warehouse_id || originWarehouses[0]?.id || 'wh-china'
  );
  const [selectedDestWhId] = useState<string>('wh-bd');
  const [flyingDate, setFlyingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [flightNumber, setFlightNumber] = useState<string>('BS-206');
  const [flyingName, setFlyingName] = useState<string>('Guangzhou Flight Batch #1');
  const [airline] = useState<string>('US-Bangla Airlines / Biman Cargo');

  // Carton Selection States
  const [selectedCartonIds, setSelectedCartonIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Real-time DB subscription
  useEffect(() => {
    const syncDb = () => {
      const dbData = getHostingerDbData();
      setCartons(dbData.cartons || []);
      setProposals(dbData.proposals || []);
    };
    syncDb();
    const unsubscribe = subscribeToDbUpdates(syncDb);
    return () => unsubscribe();
  }, []);

  // Filter available stock cartons in selected origin warehouse
  const availableStockCartons = useMemo(() => {
    return cartons.filter(
      (c) =>
        (c.current_warehouse_id === selectedOriginWhId ||
          (c.current_warehouse_name || '').toLowerCase().includes('guangzhou') ||
          selectedOriginWhId === 'wh-china') &&
        (c.status === 'booked' || c.status === 'received')
    );
  }, [cartons, selectedOriginWhId]);

  const filteredCartons = useMemo(() => {
    if (!searchQuery.trim()) return availableStockCartons;
    const q = searchQuery.toLowerCase().trim();
    return availableStockCartons.filter(
      (c) =>
        c.ctn_no.toLowerCase().includes(q) ||
        (c.shipping_mark || '').toLowerCase().includes(q) ||
        (c.tracking_number || '').toLowerCase().includes(q) ||
        (c.product_name_en || '').toLowerCase().includes(q) ||
        (c.customer_name || '').toLowerCase().includes(q)
    );
  }, [availableStockCartons, searchQuery]);

  // Payload totals for selected cartons
  const selectedCartons = useMemo(
    () => cartons.filter((c) => selectedCartonIds.includes(c.id)),
    [cartons, selectedCartonIds]
  );
  const totalSelectedWeight = useMemo(
    () => selectedCartons.reduce((sum, c) => sum + (c.gross_weight || 0), 0),
    [selectedCartons]
  );
  const totalSelectedCbm = useMemo(
    () => selectedCartons.reduce((sum, c) => sum + (c.cbm || 0), 0),
    [selectedCartons]
  );

  // Toggle single carton selection
  const handleToggleSelect = (id: string) => {
    setSelectedCartonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Toggle select all cartons
  const handleToggleSelectAll = () => {
    if (selectedCartonIds.length === filteredCartons.length) {
      setSelectedCartonIds([]);
    } else {
      setSelectedCartonIds(filteredCartons.map((c) => c.id));
    }
  };

  // Submit new Flying Proposal Batch
  const handleSubmitProposal = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedCartonIds.length === 0) {
      addToast(
        'error',
        isBn ? 'কোনো কার্টুন নির্বাচন করা হয়নি!' : 'No Cartons Selected!',
        isBn ? 'প্রস্তাবিত ফ্লাইটে অন্তত ১টি কার্টুন টিক দিয়ে নির্বাচন করুন।' : 'Please select at least 1 carton for flight proposal.'
      );
      return;
    }

    const originWhObj = warehouses.find((w) => w.id === selectedOriginWhId);
    const destWhObj = warehouses.find((w) => w.id === selectedDestWhId);

    const newProposal: FlyingProposal = {
      id: `prop-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      flying_name: flyingName.trim() || `Flight Batch ${flightNumber}`,
      warehouse_id: selectedOriginWhId,
      warehouse_name: originWhObj?.name || 'Guangzhou Air Hub',
      destination_warehouse_id: selectedDestWhId,
      destination_warehouse_name: destWhObj?.name || 'Dhaka Central Freight Hub',
      proposed_by: currentUser.id,
      proposed_by_name: currentUser.name,
      date: flyingDate,
      status: 'pending',
      flight_number: flightNumber.trim() || 'BS-206',
      airline: airline.trim() || 'US-Bangla Airlines',
      carton_ids: selectedCartonIds,
      items_count: selectedCartonIds.length,
      total_weight: Math.round(totalSelectedWeight * 10) / 10,
      total_cbm: Math.round(totalSelectedCbm * 100) / 100,
    };

    // Update status of selected cartons to proposed
    const updatedCartons = cartons.map((c) =>
      selectedCartonIds.includes(c.id)
        ? {
            ...c,
            status: 'proposed' as const,
            flight_number: flightNumber.trim(),
            updated_at: new Date().toISOString(),
          }
        : c
    );

    const updatedProposals = [newProposal, ...proposals];

    saveHostingerDbMultiData({
      fsc_vps_proposals: updatedProposals,
      fsc_vps_cartons: updatedCartons,
    });

    logSystemAuditAction(
      currentUser,
      'CREATE_FLYING_PROPOSAL',
      'flying_proposal',
      newProposal.id,
      `নতুন ফ্লাইং প্রোপোজাল ব্যাচ জেনারেট সম্পন্ন! Flight: ${flightNumber}, Date: ${flyingDate}, Cartons: ${selectedCartonIds.length}`
    );

    publishSystemNotification({
      title: 'নতুন ফ্লাইং প্রোপোজাল সাবমিট হয়েছে',
      message: `অপারেশনস ডিরেক্টর নতুন ফ্লাইট ব্যাচ "${flyingName}" (${selectedCartonIds.length}টি কার্টুন, ${totalSelectedWeight.toFixed(1)} kg) তৈরি করেছেন।`,
      type: 'info',
      target_role: 'operation_director',
    });

    addToast(
      'success',
      isBn ? 'ফ্লাইং প্রোপোজাল ব্যাচ সফলভাবে জেনারেট হয়েছে!' : 'Flight Proposal Batch Created!',
      isBn
        ? `ফ্লাইট: ${flightNumber} (${flyingDate}) — ${selectedCartonIds.length}টি কার্টুন সফলভাবে যুক্ত হয়েছে।`
        : `Flight: ${flightNumber} (${flyingDate}) — ${selectedCartonIds.length} cartons attached.`
    );

    // Reset Form
    setSelectedCartonIds([]);
    if (onProposalCreated) {
      onProposalCreated();
    }
  };

  return (
    <div className="space-y-5 font-sans">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* HEADER TITLE CARD */}
      <div
        className={`p-5 rounded-xl border transition-colors shadow-xs space-y-3 ${
          isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-sm font-semibold flex items-center space-x-2 text-slate-800 dark:text-slate-100">
              <Plane className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{isBn ? 'নতুন ফ্লাইং প্রোপোজাল ও ফ্লাইট ব্যাচ জেনারেটর' : 'Create Flying Proposal & Flight Batch Builder'}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
              {isBn
                ? 'ওয়্যারহাউজের বুকিংকৃত কার্টুনসমূহ থেকে পছন্দমতো কার্টুন নির্বাচন করে নতুন ফ্লাইটের জন্য ব্যাচ জেনারেট করুন।'
                : 'Select booked cartons from origin inventory and dispatch new flight payload batches.'}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {availableStockCartons.length} Cartons Available
            </span>
          </div>
        </div>

        {/* PAYLOAD METRICS SUMMARY BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
          <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#0F172A] border-slate-700' : 'bg-white border-slate-200'}`}>
            <span className="text-slate-500 dark:text-slate-400 font-normal">{isBn ? 'সিলেক্টকৃত কার্টুন' : 'Selected Cartons'}</span>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
              {selectedCartonIds.length} / {availableStockCartons.length} {isBn ? 'টি' : 'Pcs'}
            </div>
          </div>

          <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#0F172A] border-slate-700' : 'bg-white border-slate-200'}`}>
            <span className="text-slate-500 dark:text-slate-400 font-normal">{isBn ? 'মোট গ্রস ওজন (KG)' : 'Total Gross Weight'}</span>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
              {totalSelectedWeight.toFixed(1)} KG
            </div>
          </div>

          <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#0F172A] border-slate-700' : 'bg-white border-slate-200'}`}>
            <span className="text-slate-500 dark:text-slate-400 font-normal">{isBn ? 'মোট সিবিএম (CBM)' : 'Total CBM Volume'}</span>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
              {totalSelectedCbm.toFixed(2)} CBM
            </div>
          </div>
        </div>
      </div>

      {/* FLIGHT BUILDER FORM */}
      <form onSubmit={handleSubmitProposal} className="space-y-5">
        <div
          className={`p-5 rounded-xl border transition-colors shadow-xs space-y-4 ${
            isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <h3 className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center space-x-2 border-b pb-2.5 border-slate-200 dark:border-slate-700">
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{isBn ? '১. ফ্লাইট বিস্তারিত তথ্য (Flight Configuration)' : '1. Flight Batch Details'}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-normal">
            {/* Origin Warehouse */}
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">{isBn ? 'অরিজিন ওয়্যারহাউজ *' : 'Origin Hub *'}</label>
              <select
                value={selectedOriginWhId}
                onChange={(e) => {
                  setSelectedOriginWhId(e.target.value);
                  setSelectedCartonIds([]);
                }}
                className={`w-full px-3 py-1.5 rounded-lg border text-xs font-normal focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                  isDark ? 'bg-[#0F172A] border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                {originWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Flying Date */}
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">{isBn ? 'ফ্লাইটের তারিখ *' : 'Flight Date *'}</label>
              <input
                type="date"
                required
                value={flyingDate}
                onChange={(e) => setFlyingDate(e.target.value)}
                className={`w-full px-3 py-1.5 rounded-lg border text-xs font-normal focus:ring-1 focus:ring-blue-500 ${
                  isDark ? 'bg-[#0F172A] border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>

            {/* Flight Number */}
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">{isBn ? 'ফ্লাইট নম্বর / কোড *' : 'Flight Number *'}</label>
              <input
                type="text"
                required
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value)}
                placeholder="e.g. BS-206"
                className={`w-full px-3 py-1.5 rounded-lg border text-xs font-normal focus:ring-1 focus:ring-blue-500 ${
                  isDark ? 'bg-[#0F172A] border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>

            {/* Flight Batch Name */}
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">{isBn ? 'ফ্লাইট ব্যাচের নাম' : 'Flight Batch Name'}</label>
              <input
                type="text"
                value={flyingName}
                onChange={(e) => setFlyingName(e.target.value)}
                placeholder="Guangzhou Batch #1"
                className={`w-full px-3 py-1.5 rounded-lg border text-xs font-normal focus:ring-1 focus:ring-blue-500 ${
                  isDark ? 'bg-[#0F172A] border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>
          </div>
        </div>

        {/* CARTONS PAYLOAD SELECTOR */}
        <div
          className={`rounded-xl border transition-colors shadow-xs overflow-hidden ${
            isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {isBn ? '২. প্রোপোজালে কার্টুন যুক্তকরণ (Cartons Inventory Payload)' : '2. Select Cartons Payload'}
              </h3>
            </div>

            {/* Search Filter */}
            <div className="relative max-w-xs w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isBn ? 'খুঁজুন: মার্ক, কাস্টমার, CTN, পণ্য...' : 'Filter mark, customer, ctn...'}
                className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs font-normal focus:ring-1 focus:ring-blue-500 ${
                  isDark ? 'bg-[#0F172A] border-slate-600 text-white placeholder:text-slate-400' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Cartons Table List with ALL Columns & SEPARATE Customer Name Column (No Icons!) */}
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs border-collapse min-w-[900px]">
              <thead
                className={`text-xs font-semibold border-b transition-colors ${
                  isDark ? 'bg-[#0F172A] text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <tr>
                  <th className="p-2.5 text-center border-r border-slate-200/60 dark:border-slate-700/50 w-10 font-normal">
                    <input
                      type="checkbox"
                      checked={
                        filteredCartons.length > 0 && selectedCartonIds.length === filteredCartons.length
                      }
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 font-semibold whitespace-nowrap">CTN NO</th>
                  <th className="p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 font-semibold whitespace-nowrap text-emerald-700 dark:text-emerald-300">SHIPMENT CTN NO.</th>
                  <th className="p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 font-semibold whitespace-nowrap">SHIPPING MARK</th>
                  <th className="p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 font-semibold whitespace-nowrap">CUSTOMER NAME</th>
                  <th className="p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 font-semibold whitespace-nowrap">TRACKING NO</th>
                  <th className="p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 font-semibold whitespace-nowrap">PRODUCT NAME</th>
                  <th className="p-2.5 text-center border-r border-slate-200/60 dark:border-slate-700/50 font-semibold whitespace-nowrap">QTY / CTNS</th>
                  <th className="p-2.5 text-center border-r border-slate-200/60 dark:border-slate-700/50 font-semibold whitespace-nowrap">GROSS WT (KG)</th>
                  <th className="p-2.5 text-center border-r border-slate-200/60 dark:border-slate-700/50 font-semibold whitespace-nowrap">CHARGEABLE WT (KG)</th>
                  <th className="p-2.5 text-center border-r border-slate-200/60 dark:border-slate-700/50 font-semibold whitespace-nowrap">CBM</th>
                  <th className="p-2.5 text-center font-semibold whitespace-nowrap">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs font-normal">
                {filteredCartons.length > 0 ? (
                  filteredCartons.map((c) => {
                    const isSelected = selectedCartonIds.includes(c.id);
                    const custNameClean = c.customer_name && !c.customer_name.includes('Unassigned')
                      ? c.customer_name
                      : 'Unassigned';

                    return (
                      <tr
                        key={c.id}
                        onClick={() => handleToggleSelect(c.id)}
                        className={`transition-colors duration-150 cursor-pointer ${
                          isSelected
                            ? isDark
                              ? 'bg-blue-950/50 text-white border-l-4 border-l-blue-500'
                              : 'bg-blue-50/80 text-slate-900 border-l-4 border-l-blue-600'
                            : isDark
                            ? 'bg-[#1E293B] hover:bg-slate-800 text-white'
                            : 'bg-white hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <td className="p-2.5 text-center border-r border-slate-200/60 dark:border-slate-700/50">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(c.id)}
                            className="rounded border-slate-300 cursor-pointer accent-blue-600"
                          />
                        </td>
                        <td className="p-2.5 font-medium border-r border-slate-200/60 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {c.ctn_no}
                        </td>
                        <td className="p-2.5 font-medium border-r border-slate-200/60 dark:border-slate-700/50 text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {c.packaging_number || c.master_group_id || `CTN-${c.ctn_no}`}
                        </td>
                        <td className="p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 font-medium text-blue-700 dark:text-sky-300 whitespace-nowrap">
                          {c.shipping_mark}
                        </td>
                        <td className="p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {custNameClean !== 'Unassigned' ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                              {custNameClean}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 dark:text-slate-300 border-r border-slate-200/60 dark:border-slate-700/50 whitespace-nowrap">
                          {c.tracking_number}
                        </td>
                        <td className="p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 max-w-[200px] truncate">
                          {c.product_name_en}
                        </td>
                        <td className="p-2.5 text-center font-medium text-slate-800 dark:text-slate-200 border-r border-slate-200/60 dark:border-slate-700/50 whitespace-nowrap">
                          {c.quantity || 1}
                        </td>
                        <td className="p-2.5 text-center font-medium text-slate-800 dark:text-slate-200 border-r border-slate-200/60 dark:border-slate-700/50 whitespace-nowrap">
                          {c.gross_weight} kg
                        </td>
                        <td className="p-2.5 text-center font-medium text-slate-800 dark:text-slate-200 border-r border-slate-200/60 dark:border-slate-700/50 whitespace-nowrap">
                          {c.chargeable_weight || c.gross_weight} kg
                        </td>
                        <td className="p-2.5 text-center font-medium text-slate-800 dark:text-slate-200 border-r border-slate-200/60 dark:border-slate-700/50 whitespace-nowrap">
                          {c.cbm} CBM
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400">
                      <Package className="w-7 h-7 mx-auto opacity-40 mb-2" />
                      <div className="font-normal">{isBn ? 'ওয়্যারহাউজে কোনো স্টক কার্টুন পাওয়া যায়নি' : 'No available stock cartons found in this warehouse.'}</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* SUBMIT BUTTON BAR */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="text-xs font-normal text-slate-600 dark:text-slate-400">
              <span>{selectedCartonIds.length} Cartons Selected</span>
            </div>

            <button
              type="submit"
              disabled={selectedCartonIds.length === 0}
              className={`px-5 py-2 rounded-lg font-medium text-xs flex items-center space-x-2 transition-colors cursor-pointer shadow-xs ${
                selectedCartonIds.length > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isBn ? 'ফ্লাইং প্রোপোজাল সাবমিট করুন' : 'Submit Flying Proposal Batch'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
