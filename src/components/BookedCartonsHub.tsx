import React, { useState } from 'react';
import {
  Package,
  Search,
  Filter,
  User,
  MapPin,
  Building2,
  Calendar,
  Eye,
  FileCheck,
  ChevronRight,
  Sparkles,
  Layers,
  Scale,
  Box,
  X,
  Edit2,
  Trash2,
  CheckCircle2,
  ListFilter,
  LayoutGrid,
} from 'lucide-react';
import { Carton, Warehouse, User as UserType, Language, Customer } from '../types';
import { useTheme } from '../context/ThemeContext';
import { getHostingerDbData, saveHostingerDbData, logSystemAuditAction, subscribeToDbUpdates } from '../lib/db';

interface BookedCartonsHubProps {
  cartons: Carton[];
  warehouses: Warehouse[];
  currentUser: UserType;
  language: Language;
  onUpdateCarton?: (updatedCarton: Carton) => void;
  onDeleteCarton?: (cartonId: string) => void;
}

export const BookedCartonsHub: React.FC<BookedCartonsHubProps> = ({
  cartons,
  warehouses,
  currentUser,
  language,
  onUpdateCarton,
  onDeleteCarton,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isBn = language === 'bn';

  // -------------------------------------------------------------
  // VIEW MODE TOGGLE & FILTER STATES
  // -------------------------------------------------------------
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('cards');
  const [groupByMode, setGroupByMode] = useState<'tracking' | 'mark'>('tracking');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestWh, setSelectedDestWh] = useState('all');
  const [selectedDestinationFilter, setSelectedDestinationFilter] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState('all');

  // Customer Detail Modal View
  const [activeCustomerModalMark, setActiveCustomerModalMark] = useState<string | null>(null);

  // Photo Preview Modal View
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Edit Carton Row Modal
  const [editingCarton, setEditingCarton] = useState<Carton | null>(null);

  // Live Real-Time Cartons Sync State
  const [liveRealtimeCartons, setLiveRealtimeCartons] = useState<Carton[]>(cartons);

  React.useEffect(() => {
    setLiveRealtimeCartons(cartons);
  }, [cartons]);

  React.useEffect(() => {
    return subscribeToDbUpdates(() => {
      const dbData = getHostingerDbData();
      if (dbData.cartons) {
        setLiveRealtimeCartons(dbData.cartons);
      }
    });
  }, []);

  // Check if current user is restricted to their assigned warehouse only (Warehouse Incharge)
  const isWarehouseIncharge =
    currentUser?.role === 'warehouse_incharge' ||
    (currentUser?.role !== 'super_admin' && currentUser?.role !== 'operation_director' && !!currentUser?.warehouse_id);

  const myWhId = currentUser?.warehouse_id;

  // Base cartons accessible by current user (Restricted for Warehouse Incharge to CURRENT physical warehouse stock)
  const accessibleCartons = React.useMemo(() => {
    if (isWarehouseIncharge && myWhId) {
      return liveRealtimeCartons.filter(
        (c) => c.current_warehouse_id === myWhId
      );
    }
    return liveRealtimeCartons;
  }, [liveRealtimeCartons, isWarehouseIncharge, myWhId]);

  // Warehouses available in filter dropdown
  const accessibleWarehouses = React.useMemo(() => {
    if (isWarehouseIncharge && myWhId) {
      return warehouses.filter((w) => w.id === myWhId);
    }
    return warehouses;
  }, [warehouses, isWarehouseIncharge, myWhId]);

  // -------------------------------------------------------------
  // FILTERING LOGIC
  // -------------------------------------------------------------
  const filteredCartons = accessibleCartons.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.ctn_no.toLowerCase().includes(q) ||
      (c.shipping_mark || '').toLowerCase().includes(q) ||
      (c.tracking_number || '').toLowerCase().includes(q) ||
      (c.product_name_en || '').toLowerCase().includes(q) ||
      (c.product_name_cn || '').toLowerCase().includes(q);

    const effectiveWhFilter = isWarehouseIncharge && myWhId ? myWhId : selectedDestWh;

    const matchesWh =
      effectiveWhFilter === 'all' ||
      c.current_warehouse_id === effectiveWhFilter;

    const matchesStatus = selectedStatus === 'all' || c.status === selectedStatus;

    // Destination Country / Hub Filter Logic
    const destWhId = c.destination_warehouse_id || '';
    const destWhName = (c.destination_warehouse_name || '').toLowerCase();
    const isBdBound =
      destWhId === 'wh-bd' ||
      destWhName.includes('bangladesh') ||
      destWhName.includes('ঢাকা') ||
      destWhName.includes('bd');

    const matchesDest =
      selectedDestinationFilter === 'all'
        ? true
        : selectedDestinationFilter === 'bd_bound'
        ? isBdBound
        : selectedDestinationFilter === 'other_dest'
        ? !isBdBound
        : destWhId === selectedDestinationFilter;

    return matchesSearch && matchesWh && matchesStatus && matchesDest;
  });

  // Group Cartons strictly by Master Tracking Number
  const customerGroupsMap = filteredCartons.reduce<Record<string, Carton[]>>((acc, carton) => {
    const groupKey = carton.tracking_number || carton.shipping_mark || 'UNASSIGNED';

    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(carton);
    return acc;
  }, {});

  const customerGroupKeys = Object.keys(customerGroupsMap);

  // Unique Shipping Marks for Filter Dropdown
  const allShippingMarks = Array.from(new Set(liveRealtimeCartons.map((c) => c.shipping_mark).filter(Boolean)));

  // KPI Metrics
  const totalCartonCount = filteredCartons.length;
  const totalGrossWeight = filteredCartons.reduce((sum, c) => sum + (c.gross_weight || 0), 0);
  const totalCbmVolume = filteredCartons.reduce((sum, c) => sum + (c.cbm || 0), 0);

  // Active Customer in Modal
  const activeCustomerCartons = activeCustomerModalMark ? customerGroupsMap[activeCustomerModalMark] || [] : [];

  const handleSaveEditedCarton = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCarton) return;

    if (onUpdateCarton) {
      onUpdateCarton(editingCarton);
    }
    setEditingCarton(null);
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* KPI METRICS & VIEW MODE HEADER CONTROLS */}
      {/* ------------------------------------------------------------- */}
      <div
        className={`p-5 rounded-2xl border transition-all shadow-xs space-y-4 ${
          isDark
            ? 'bg-[#1C1C1E] border-slate-800 text-white'
            : 'bg-white border-slate-200/90 text-slate-900'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 border-slate-200 dark:border-slate-800">
          <div>
            <h2 className={`text-base font-semibold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <Box className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>{isBn ? 'বুকিংকৃত কার্টুন স্টক হাব (Live Booked Stock Hub)' : 'Live Booked Cartons Inventory Hub'}</span>
            </h2>
            <p className={`text-xs mt-0.5 font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {isBn
                ? 'সিস্টেমে ইনপুট দেওয়া সকল কার্টুন তালিকা ও কাস্টমারভিত্তিক সংকলিত কার্ড ভিউ'
                : 'Central repository of all booked cargo cartons with list and customer card modes'}
            </p>
          </div>

          {/* VIEW TOGGLE & GROUP BY BUTTONS */}
          <div className="flex flex-wrap items-center gap-2">
            {/* GROUP BY TOGGLE */}
            {/* GROUP BY BADGE (Tracking ID Only) */}
            {viewMode === 'cards' && (
              <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-[10px] text-slate-500 font-mono">{isBn ? 'গ্রুপ:' : 'Group:'}</span>
                <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white shadow-2xs">
                  {isBn ? '📦 ট্র্যাকিং ID' : 'Tracking ID'}
                </span>
              </div>
            )}

            {/* VIEW MODE TOGGLE */}
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{isBn ? '👤 কাস্টমার কার্ডস ভিউ' : 'Customer Cards'}</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>{isBn ? '📋 সাধারণ টেবিল লিস্ট' : 'Table List'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* TOP SUMMARY KPIS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-500 font-mono uppercase">{isBn ? 'মোট কাস্টমার' : 'Total Customers'}</div>
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5 font-mono">{customerGroupKeys.length} জন</div>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-500 font-mono uppercase">{isBn ? 'মোট কার্টুন সংখ্যা' : 'Total Cartons'}</div>
            <div className={`text-sm font-bold mt-0.5 font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalCartonCount} টি</div>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-500 font-mono uppercase">{isBn ? 'মোট গ্রস ওজন' : 'Total Gross Weight'}</div>
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">{totalGrossWeight.toFixed(1)} KG</div>
          </div>

          <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-500 font-mono uppercase">{isBn ? 'মোট সিবিএম ভলিউম' : 'Total CBM Volume'}</div>
            <div className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5 font-mono">{totalCbmVolume.toFixed(2)} CBM</div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* DYNAMIC SEARCH & WAREHOUSE FILTERS BAR */}
        {/* ------------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {/* Live Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? 'খুঁজুন: শিপিং মার্ক, কার্টুন নং, ট্র্যাকিং বা পণ্য...' : 'Search mark, CTN, tracking...'}
              className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs font-normal focus:ring-2 focus:ring-blue-500 ${
                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          {/* Warehouse Filter (With Live Carton Counts) */}
          <div>
            <select
              value={isWarehouseIncharge && myWhId ? myWhId : selectedDestWh}
              onChange={(e) => {
                if (!isWarehouseIncharge) {
                  setSelectedDestWh(e.target.value);
                }
              }}
              disabled={isWarehouseIncharge}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              } ${isWarehouseIncharge ? 'opacity-90 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}`}
            >
              {!isWarehouseIncharge && (
                <option value="all">
                  {isBn ? `সকল অরিজিন/ওয়্যারহাউজ (${accessibleCartons.length}টি কার্টুন)` : `All Warehouses (${accessibleCartons.length} Cartons)`}
                </option>
              )}
              {accessibleWarehouses.map((w) => {
                const count = accessibleCartons.filter(
                  (c) => c.destination_warehouse_id === w.id || c.current_warehouse_id === w.id
                ).length;
                return (
                  <option key={w.id} value={w.id}>
                    {w.name} ({count}টি কার্টুন)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Destination Country / Hub Filter (NEW) */}
          <div>
            <select
              value={selectedDestinationFilter}
              onChange={(e) => setSelectedDestinationFilter(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="all">
                {isBn ? 'সকল গন্তব্য দেশ (All Destinations)' : 'All Destinations'}
              </option>
              <option value="bd_bound">
                {isBn ? '🇧🇩 বাংলাদেশ গন্তব্য (Bangladesh Bound)' : '🇧🇩 Bangladesh Bound'}
              </option>
              <option value="other_dest">
                {isBn ? '🌐 অন্যান্য আন্তর্জাতিক গন্তব্য (Other Countries)' : '🌐 Other Countries'}
              </option>
              {warehouses.map((w) => {
                const destCount = accessibleCartons.filter((c) => c.destination_warehouse_id === w.id).length;
                return (
                  <option key={`dest-${w.id}`} value={w.id}>
                    {w.name} ({destCount}টি কার্টুন)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-mono focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="all">{isBn ? 'সকল বুকিং স্ট্যাটাস' : 'All Booking Status'}</option>
              <option value="booked">Booked (বুকিংকৃত)</option>
              <option value="proposed">Proposed (ফ্লাইং প্রোপোজাল)</option>
              <option value="in_transit">In Transit (পরিবহনে)</option>
              <option value="received">Received (রিসিভড)</option>
              <option value="delivered">Delivered (ডেলিভার্ড)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODE 1: CUSTOMER CARDS VIEW (কাস্টমার অনুযায়ী কার্ড ভিউ) */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'cards' && (
        <div>
          {customerGroupKeys.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {customerGroupKeys.map((mark) => {
                const groupCartons = customerGroupsMap[mark];
                const custGrossWt = groupCartons.reduce((sum, c) => sum + (c.gross_weight || 0), 0);
                const custCbm = groupCartons.reduce((sum, c) => sum + (c.cbm || 0), 0);
                const trackingNos = Array.from(new Set(groupCartons.map((c) => c.tracking_number).filter(Boolean)));
                const firstCarton = groupCartons[0];
                const destName = firstCarton?.destination_warehouse_name || warehouses.find((w) => w.id === firstCarton?.destination_warehouse_id)?.name || 'Bangladesh Hub';

                return (
                  <div
                    key={mark}
                    className={`p-5 rounded-2xl border transition-all shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md cursor-pointer ${
                      isDark
                        ? 'bg-[#1C1C1E] border-slate-800 hover:border-blue-500/50'
                        : 'bg-white border-slate-200 hover:border-blue-400'
                    }`}
                    onClick={() => setActiveCustomerModalMark(mark)}
                  >
                    <div>
                      {/* Customer Card Header */}
                      <div className="flex items-start justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                        <div>
                          <div className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold">
                            {mark}
                          </div>
                          <h3 className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {firstCarton?.product_name_en || 'Customer Shipment'}
                          </h3>
                        </div>

                        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {groupCartons.length} Cartons
                        </span>
                      </div>

                      {/* Customer Card Details Grid */}
                      <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block">{isBn ? 'মোট গ্রস ওজন' : 'Total Gross Weight'}</span>
                          <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{custGrossWt.toFixed(1)} KG</strong>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 block">{isBn ? 'মোট সিবিএম' : 'Total CBM'}</span>
                          <strong className="text-purple-600 dark:text-purple-400 font-mono font-bold">{custCbm.toFixed(2)} CBM</strong>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 block">{isBn ? 'গন্তব্য ওয়্যারহাউজ' : 'Destination'}</span>
                          <strong className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{destName}</strong>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 block">{isBn ? 'মাস্টার ট্র্যাকিং ID' : 'Tracking ID'}</span>
                          <strong className="font-mono text-slate-600 dark:text-slate-400 truncate block">{trackingNos[0] || 'N/A'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Card Action Footer */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-500 text-[11px]">
                        {isBn ? 'কার্টুন বিস্তারিত দেখুন' : 'Click to view cartons'}
                      </span>
                      <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 font-medium">
                        <span>{isBn ? 'বিস্তারিত' : 'View Details'}</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`p-10 rounded-2xl border text-center space-y-3 ${
              isDark ? 'bg-[#1C1C1E] border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
            }`}>
              <Box className="w-10 h-10 text-slate-400 mx-auto opacity-40" />
              <div className="text-sm font-medium">{isBn ? 'কোনো বুকিংকৃত কার্টুন পাওয়া যায়নি' : 'No Booked Cartons Found'}</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {isBn ? 'নতুন কার্টুন বুকিং ফিল করে জেনারেট ও সেভ করলে এখানে দেখা যাবে।' : 'Book new cartons in booking entry portal to view customer cards.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODE 2: TABLE LIST VIEW (নরমালি লিস্ট আকারে) */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'list' && (
        <div
          className={`rounded-2xl border transition-all shadow-xs overflow-hidden ${
            isDark
              ? 'bg-[#1C1C1E] border-slate-800 text-white'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isBn ? 'সকল কার্টুনের বিবরণ (Central Cartons Inventory Table)' : 'Central Cartons Inventory List'}
            </h3>
            <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold">
              {filteredCartons.length} Cartons Total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse border border-slate-200 dark:border-slate-800 table-fixed min-w-[1200px]">
              <colgroup>
                <col style={{ width: '45px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '260px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '125px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '80px' }} />
              </colgroup>
              <thead className={`uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-medium ${
                isDark ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-700'
              }`}>
                <tr>
                  <th className="p-3 border border-slate-200 dark:border-slate-800 text-center font-medium">SL</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-800 font-medium">CTN NO</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-800 font-medium">MARK</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-800 font-medium">TRACKING NO</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-800 font-medium">PRODUCT (EN & CN)</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-800 text-center font-medium">QTY</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-800 text-center font-medium">N.WT</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-800 text-center font-medium">G.WT</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-800 text-center font-medium">CBM</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-800 font-medium">DESTINATION</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-800 text-center font-medium">STATUS</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-800 text-center font-medium">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredCartons.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="p-3 text-center font-mono text-slate-400 border border-slate-200 dark:border-slate-800">
                      {idx + 1}
                    </td>

                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800">
                      {c.ctn_no}
                    </td>

                    <td className="p-3 font-mono text-blue-600 dark:text-blue-400 font-bold border border-slate-200 dark:border-slate-800">
                      {c.shipping_mark}
                    </td>

                    <td className="p-3 font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 truncate">
                      {c.tracking_number}
                    </td>

                    <td className="p-3 border border-slate-200 dark:border-slate-800">
                      <div className="font-normal text-slate-900 dark:text-white truncate">{c.product_name_en}</div>
                      {c.product_name_cn && (
                        <div className="text-[10px] text-slate-500 truncate">{c.product_name_cn}</div>
                      )}
                    </td>

                    <td className="p-3 text-center font-mono border border-slate-200 dark:border-slate-800">
                      {c.quantity} pcs
                    </td>

                    <td className="p-3 text-center font-mono border border-slate-200 dark:border-slate-800 text-slate-500">
                      {c.net_weight} kg
                    </td>

                    <td className="p-3 text-center font-mono font-bold border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                      {c.gross_weight} kg
                    </td>

                    <td className="p-3 text-center font-mono border border-slate-200 dark:border-slate-800 text-purple-600 dark:text-purple-400">
                      {c.cbm}
                    </td>

                    <td className="p-3 border border-slate-200 dark:border-slate-800 truncate">
                      {c.destination_warehouse_name || warehouses.find((w) => w.id === c.destination_warehouse_id)?.name || 'Bangladesh Hub'}
                    </td>

                    <td className="p-3 text-center border border-slate-200 dark:border-slate-800">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                        c.status === 'booked'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20'
                          : c.status === 'in_transit'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20'
                          : c.status === 'received'
                          ? 'bg-teal-500/10 text-teal-600 dark:text-teal-300 border border-teal-500/20'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20'
                      }`}>
                        {c.status}
                      </span>
                    </td>

                    <td className="p-3 text-center border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-center space-x-1">
                        {c.photo_url && (
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoUrl(c.photo_url!)}
                            className="p-1 text-blue-500 hover:text-blue-700 cursor-pointer"
                            title="View Photo Proof"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingCarton(c)}
                          className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"
                          title="Edit Carton"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteCarton && (
                          <button
                            type="button"
                            onClick={() => onDeleteCarton(c.id)}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                            title="Delete Carton"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* EXPANDED CUSTOMER CARTONS MODAL VIEW */}
      {/* ------------------------------------------------------------- */}
      {activeCustomerModalMark && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`rounded-2xl max-w-4xl w-full p-6 space-y-5 border shadow-2xl ${
            isDark ? 'bg-slate-900 text-white border-slate-800' : 'bg-white text-slate-900 border-slate-200'
          }`}>
            <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold uppercase flex items-center space-x-2">
                  <span>Tracking ID: {activeCustomerCartons[0]?.tracking_number || activeCustomerModalMark}</span>
                  {activeCustomerCartons[0]?.shipping_mark && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20 font-normal">
                      Mark: {activeCustomerCartons[0]?.shipping_mark}
                    </span>
                  )}
                </div>
                <h3 className={`text-base font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {activeCustomerCartons[0]?.product_name_en || 'Customer Shipment Profile'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setActiveCustomerModalMark(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Batch Summary Badges */}
            <div className="grid grid-cols-3 gap-3">
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[10px] text-slate-500 font-mono">মোট কার্টুন সংখ্যা</div>
                <div className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono">{activeCustomerCartons.length} টি</div>
              </div>

              <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[10px] text-slate-500 font-mono">মোট ও গ্রস ওজন</div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {activeCustomerCartons.reduce((sum, c) => sum + (c.gross_weight || 0), 0).toFixed(1)} KG
                </div>
              </div>

              <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-[10px] text-slate-500 font-mono">মোট ভলিউম CBM</div>
                <div className="text-sm font-bold text-purple-600 dark:text-purple-400 font-mono">
                  {activeCustomerCartons.reduce((sum, c) => sum + (c.cbm || 0), 0).toFixed(2)} CBM
                </div>
              </div>
            </div>

            {/* Customer Cartons Detailed Table */}
            <div className="max-h-[50vh] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead className={`uppercase text-[10px] tracking-wider border-b font-medium ${
                  isDark ? 'bg-slate-950 text-slate-300 border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  <tr>
                    <th className="p-3">SL</th>
                    <th className="p-3">CTN NO</th>
                    <th className="p-3">SHIPPING MARK</th>
                    <th className="p-3">TRACKING NO</th>
                    <th className="p-3 font-medium">PRODUCT</th>
                    <th className="p-3 text-center">QTY / N.WT</th>
                    <th className="p-3 text-center">G.WEIGHT</th>
                    <th className="p-3 text-center">CBM</th>
                    <th className="p-3 text-center">PROOF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {activeCustomerCartons.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{c.ctn_no}</td>
                      <td className="p-3 font-mono text-blue-600 dark:text-blue-400 font-bold">{c.shipping_mark}</td>
                      <td className="p-3 font-mono text-slate-500">{c.tracking_number}</td>
                      <td className="p-3 font-sans truncate max-w-[160px]">
                        <div>{c.product_name_en}</div>
                        {c.product_name_cn && <div className="text-[10px] text-slate-400">{c.product_name_cn}</div>}
                      </td>
                      <td className="p-3 text-center font-mono">{c.quantity} pcs | {c.net_weight} kg</td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">{c.gross_weight} kg</td>
                      <td className="p-3 text-center font-mono text-purple-600 dark:text-purple-400">{c.cbm} CBM</td>
                      <td className="p-3 text-center">
                        {c.photo_url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoUrl(c.photo_url!)}
                            className="px-2 py-1 rounded text-[10px] font-mono bg-blue-500/10 text-blue-500 hover:underline cursor-pointer"
                          >
                            View Photo
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">No Photo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveCustomerModalMark(null)}
                className={`px-4 py-2 rounded-xl text-xs font-normal cursor-pointer ${
                  isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                }`}
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO PREVIEW MODAL */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-2xl max-w-xl w-full p-4 space-y-3 border border-slate-800">
            <div className="flex items-center justify-between border-b pb-2 border-slate-800">
              <span className="text-xs font-semibold">Proof Photo</span>
              <button onClick={() => setPreviewPhotoUrl(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-center bg-black rounded-xl p-2 max-h-[60vh]">
              <img src={previewPhotoUrl} alt="Proof" className="max-h-[55vh] object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}

      {/* EDIT CARTON MODAL */}
      {editingCarton && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveEditedCarton} className={`rounded-2xl max-w-md w-full p-6 space-y-4 border shadow-2xl ${
            isDark ? 'bg-slate-900 text-white border-slate-800' : 'bg-white text-slate-900 border-slate-200'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold">Edit Carton Specs ({editingCarton.ctn_no})</h3>
              <button type="button" onClick={() => setEditingCarton(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Gross Weight (KG)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editingCarton.gross_weight}
                  onChange={(e) => setEditingCarton({ ...editingCarton, gross_weight: parseFloat(e.target.value) || 0 })}
                  className={`w-full px-3 py-2 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`}
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">CBM</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingCarton.cbm}
                  onChange={(e) => setEditingCarton({ ...editingCarton, cbm: parseFloat(e.target.value) || 0 })}
                  className={`w-full px-3 py-2 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingCarton(null)}
                className={`px-4 py-2 rounded-xl text-xs ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
