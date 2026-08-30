import React, { useState } from 'react';
import {
  Activity,
  Package,
  Plane,
  Truck,
  Building2,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  ArrowRight,
  Eye,
  Calendar,
  FileSpreadsheet,
  Wallet,
  Globe,
  X,
  AlertTriangle,
  UserCheck,
  ShieldCheck,
  PlusCircle,
  Check,
  Send,
  Download,
  Printer,
  Sparkles,
  Layers,
  MapPin,
  Scale,
  Box,
  Share2,
  RotateCcw,
} from 'lucide-react';
import { Carton, Warehouse, FlyingProposal, LedgerEntry, Language, Theme } from '../types';
import { useTheme } from '../context/ThemeContext';
import { LiveCargoTrackingMap } from './LiveCargoTrackingMap';
import { getHostingerDbData } from '../lib/db';

interface ShipmentDataTrackerProps {
  cartons?: Carton[];
  warehouses?: Warehouse[];
  proposals?: FlyingProposal[];
  ledgerEntries?: LedgerEntry[];
  language?: Language;
  theme?: Theme;
}

export const ShipmentDataTracker: React.FC<ShipmentDataTrackerProps> = ({
  cartons = [],
  warehouses = [],
  proposals = [],
  ledgerEntries = [],
  language = 'en',
  theme: themeProp,
}) => {
  const { theme: contextTheme } = useTheme();
  const activeTheme = contextTheme || themeProp || 'light';
  const isBn = language === 'bn';
  const isDark = activeTheme === 'dark';

  const safeCartons = Array.isArray(cartons) ? cartons : [];
  const safeWarehouses = Array.isArray(warehouses) ? warehouses : [];

  // Helper for safe date string formatting
  const formatDateStr = (dateStr?: string) => {
    if (!dateStr) return '2026-08-15';
    return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  };

  // Filters
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [whFilter, setWhFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCartonTimeline, setSelectedCartonTimeline] = useState<Carton | null>(null);
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null);
  const [isFlying, setIsFlying] = useState<boolean>(false);
  const [viewLayout, setViewLayout] = useState<'cards' | 'table'>('cards');
  const [selectedProposalModal, setSelectedProposalModal] = useState<FlyingProposal | null>(null);
  const [printManifestProposal, setPrintManifestProposal] = useState<FlyingProposal | null>(null);

  // Always fallback to live DB proposals if prop is empty
  const safeProposals = React.useMemo(() => {
    if (Array.isArray(proposals) && proposals.length > 0) return proposals;
    return getHostingerDbData().proposals;
  }, [proposals]);

  // Operation Director Approved / Finalized Flying Batches ONLY
  const approvedProposals = React.useMemo(() => {
    return safeProposals.filter(
      (p: FlyingProposal) =>
        p.status === 'approved' ||
        p.status === 'dispatched' ||
        p.status === 'in_transit' ||
        p.status === 'received' ||
        p.status === 'finalized'
    );
  }, [safeProposals]);

  // Smart Date Filter States
  type DateFilterMode = 'all' | 'date_range' | 'single_date' | 'single_month' | 'month_range' | 'single_year' | 'year_range';
  const [dateFilterType, setDateFilterType] = useState<DateFilterMode>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [singleDate, setSingleDate] = useState<string>('');
  const [singleMonth, setSingleMonth] = useState<string>('');
  const [startMonth, setStartMonth] = useState<string>('');
  const [endMonth, setEndMonth] = useState<string>('');
  const [singleYear, setSingleYear] = useState<string>('');
  const [startYear, setStartYear] = useState<string>('');
  const [endYear, setEndYear] = useState<string>('');

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

  // Pipeline Stage Calculations
  const bookingCount = safeCartons.filter((c) => c && c.status === 'booked').length;
  const proposalCount = safeCartons.filter((c) => c && c.status === 'proposed').length;
  const transitCount = safeCartons.filter((c) => c && c.status === 'in_transit').length;
  const receivedBdCount = safeCartons.filter((c) => c && c.status === 'received').length;
  const deliveredCount = safeCartons.filter((c) => c && c.status === 'delivered').length;
  const totalCount = safeCartons.length;

  const totalGrossWeight = safeCartons.reduce((acc, c) => acc + (c?.gross_weight || 0), 0);
  const totalNetWeight = safeCartons.reduce((acc, c) => acc + (c?.net_weight || (c?.gross_weight || 0) * 0.95), 0);
  const totalCbm = safeCartons.reduce((acc, c) => acc + (c?.cbm || 0), 0);

  // Filtered Cargo Data with Smart Date Filter Logic
  const filteredCartons = safeCartons.filter((c) => {
    if (!c) return false;
    if (stageFilter === 'booking' && c.status !== 'booked') return false;
    if (stageFilter === 'proposal' && c.status !== 'proposed') return false;
    if (stageFilter === 'transit' && c.status !== 'in_transit') return false;
    if (stageFilter === 'received' && c.status !== 'received') return false;
    if (stageFilter === 'delivered' && c.status !== 'delivered') return false;

    if (whFilter !== 'all' && c.current_warehouse_id !== whFilter && c.destination_warehouse_id !== whFilter) {
      return false;
    }

    // Smart Date Filter Logic
    if (dateFilterType !== 'all') {
      const dateVal = c.created_at || '2026-08-15';
      const itemDateStr = dateVal.includes('T') ? dateVal.split('T')[0] : dateVal;
      const itemMonthStr = itemDateStr.substring(0, 7); // e.g. "2026-08"
      const itemYearStr = itemDateStr.substring(0, 4); // e.g. "2026"

      if (dateFilterType === 'single_date' && singleDate) {
        if (itemDateStr !== singleDate) return false;
      } else if (dateFilterType === 'date_range') {
        if (startDate && itemDateStr < startDate) return false;
        if (endDate && itemDateStr > endDate) return false;
      } else if (dateFilterType === 'single_month' && singleMonth) {
        if (itemMonthStr !== singleMonth) return false;
      } else if (dateFilterType === 'month_range') {
        if (startMonth && itemMonthStr < startMonth) return false;
        if (endMonth && itemMonthStr > endMonth) return false;
      } else if (dateFilterType === 'single_year' && singleYear) {
        if (itemYearStr !== singleYear) return false;
      } else if (dateFilterType === 'year_range') {
        if (startYear && itemYearStr < startYear) return false;
        if (endYear && itemYearStr > endYear) return false;
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesCtn = (c.ctn_no || '').toLowerCase().includes(q);
      const matchesMark = (c.shipping_mark || '').toLowerCase().includes(q);
      const matchesTrack = (c.tracking_number || '').toLowerCase().includes(q);
      const matchesEn = (c.product_name_en || '').toLowerCase().includes(q);
      const matchesCn = (c.product_name_cn || '').toLowerCase().includes(q);
      const matchesBookedBy = (c.booked_by || '').toLowerCase().includes(q);
      if (!matchesCtn && !matchesMark && !matchesTrack && !matchesEn && !matchesCn && !matchesBookedBy) {
        return false;
      }
    }

    return true;
  });

  const getStatusBadge = (status?: Carton['status']) => {
    switch (status) {
      case 'booked':
        return {
          label: isBn ? 'অরিজিন বুকিং এন্ট্রি' : 'Origin Booking Entry',
          bg: isDark ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'proposed':
        return {
          label: isBn ? 'ফ্লাইং প্রস্তাবনা' : 'Flying Proposal',
          bg: isDark ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200',
        };
      case 'in_transit':
        return {
          label: isBn ? 'ফ্লাইটে ট্রানজিট' : 'In-Transit Flight',
          bg: isDark ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' : 'bg-purple-50 text-purple-700 border-purple-200',
        };
      case 'received':
        return {
          label: isBn ? 'বিডি ওয়্যারহাউজ রিসিভড' : 'Received BD Hub',
          bg: isDark ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'delivered':
        return {
          label: isBn ? 'ডেলিভারড ও ক্যাশ সেটেলড' : 'Delivered & Settled',
          bg: isDark ? 'bg-teal-500/15 text-teal-400 border-teal-500/30' : 'bg-teal-50 text-teal-700 border-teal-200',
        };
      default:
        return {
          label: status || 'booked',
          bg: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
        };
    }
  };

  return (
    <div className="space-y-5 font-sans -mt-2">
      {/* 1. Page Title & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl md:text-2xl font-medium flex items-center space-x-2.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Activity className="w-6 h-6 text-[#00897B]" />
            <span>{isBn ? 'ডাটা ট্র্যাকার (Official Booking Sheet & Live Map)' : 'Data Tracker & Live Cargo Map'}</span>
          </h1>
          <p className={`text-xs mt-1 font-normal ${isDark ? 'text-[#9E9E9E]' : 'text-gray-500'}`}>
            {isBn
              ? 'আন্তর্জাতিক হাব লাইভ ফ্লাইট ম্যাপ এবং ১২ কলাম বুকিং মাস্টার শীট ট্র্যাকিং — রিয়েল-টাইম লাইভ আপডেটস'
              : 'Interactive international hub satellite flight tracking map & 12-column booking master sheet'}
          </p>
        </div>

        {/* Top Quick Summary Badges */}
        <div className="flex items-center space-x-2 text-xs font-normal">
          <div className={`px-3 py-1.5 rounded-xl border flex items-center space-x-1.5 ${isDark ? 'bg-[#1E293B] border-[#2C2C2E]' : 'bg-white border-gray-200 text-gray-800 shadow-xs'}`}>
            <Package className="w-3.5 h-3.5 text-[#00897B]" />
            <span className="font-normal">{totalCount} {isBn ? 'টি কার্টুন' : 'Cartons'}</span>
          </div>
          <div className={`px-3 py-1.5 rounded-xl border flex items-center space-x-1.5 ${isDark ? 'bg-[#1E293B] border-[#2C2C2E]' : 'bg-white border-gray-200 text-gray-800 shadow-xs'}`}>
            <Globe className="w-3.5 h-3.5 text-[#1E88E5]" />
            <span className="font-normal">N.Wt: {totalNetWeight.toFixed(1)}kg | G.Wt: {totalGrossWeight.toFixed(1)}kg | {totalCbm.toFixed(2)} CBM</span>
          </div>
        </div>
      </div>

      {/* Live Interactive Flight Route Tracking Satellite Map Component */}
      <LiveCargoTrackingMap cartons={safeCartons} proposals={safeProposals} language={language} theme={activeTheme} />

      {/* 2. Top Filter Selectors Bar */}
      <div className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${isDark ? 'bg-[#1E293B] border-[#2C2C2E]' : 'bg-white border-gray-200 shadow-xs text-gray-900'}`}>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Warehouse Selector */}
          <div className={`flex items-center space-x-2 border rounded-xl px-3 py-1.5 ${isDark ? 'bg-[#1E293B] border-[#2C2C2E] text-white' : 'bg-white border-gray-200 text-gray-900 shadow-xs'}`}>
            <Filter className="w-3.5 h-3.5 opacity-60" />
            <select
              value={whFilter}
              onChange={(e) => setWhFilter(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-xs dark:bg-[#1E293B] dark:text-white"
            >
              <option value="all" className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">{isBn ? 'সব ওয়্যারহাউজ হাব (All Hubs)' : 'All Warehouse Hubs'}</option>
              {safeWarehouses.map((w) => (
                <option key={w.id} value={w.id} className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Shipment Mode Selector */}
          <div className={`flex items-center space-x-2 border rounded-xl px-3 py-1.5 ${isDark ? 'bg-[#1E293B] border-[#2C2C2E] text-white' : 'bg-white border-gray-200 text-gray-900 shadow-xs'}`}>
            <Plane className="w-3.5 h-3.5 opacity-60" />
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-xs dark:bg-[#1E293B] dark:text-white"
            >
              <option value="all" className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">{isBn ? 'সব মোড (Air & Sea)' : 'All Modes (Air & Sea)'}</option>
              <option value="air" className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">Air Freight (এয়ার কার্গো)</option>
              <option value="sea" className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">Sea Freight (সি কার্গো)</option>
            </select>
          </div>

          <div className={`w-px h-5 mx-0.5 hidden md:block ${isDark ? 'bg-[#2C2C2E]' : 'bg-gray-200'}`} />

          {/* 📅 Smart Date Filter Selector */}
          <div className={`flex items-center space-x-2 border rounded-xl px-3 py-1.5 ${isDark ? 'bg-[#1E293B] border-[#2C2C2E] text-white' : 'bg-white border-gray-200 text-gray-900 shadow-xs'}`}>
            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            <select
              value={dateFilterType}
              onChange={(e) => setDateFilterType(e.target.value as DateFilterMode)}
              className="bg-transparent outline-none cursor-pointer text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            >
              <option value="all" className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">{isBn ? '📅 সব সময় (All Time)' : '📅 All Time'}</option>
              <option value="single_date" className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">{isBn ? '📅 নির্দিষ্ট তারিখ (Specific Date)' : '📅 Specific Date'}</option>
              <option value="date_range" className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">{isBn ? '📆 তারিখ থেকে তারিখ (Date Range)' : '📆 Date Range'}</option>
              <option value="single_month" className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">{isBn ? '🗓️ নির্দিষ্ট মাস (Specific Month)' : '🗓️ Specific Month'}</option>
              <option value="month_range" className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">{isBn ? '🗓️ মাস থেকে মাস (Month Range)' : '🗓️ Month Range'}</option>
              <option value="single_year" className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">{isBn ? '📊 নির্দিষ্ট বছর (Specific Year)' : '📊 Specific Year'}</option>
              <option value="year_range" className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">{isBn ? '📊 বছর থেকে বছর (Year Range)' : '📊 Year Range'}</option>
            </select>
          </div>

          {/* Dynamic Input Controls Based on Date Filter Type */}
          {dateFilterType === 'single_date' && (
            <div className={`flex items-center space-x-2 border rounded-xl px-3 py-1.5 ${isDark ? 'bg-[#1E293B] border-[#2C2C2E] text-white' : 'bg-white border-gray-200 text-gray-900 shadow-xs'}`}>
              <span className="text-[11px] font-medium opacity-80">{isBn ? 'তারিখ:' : 'Date:'}</span>
              <input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="bg-transparent outline-none text-xs font-mono cursor-pointer dark:bg-[#1E293B] dark:text-white"
              />
            </div>
          )}

          {dateFilterType === 'date_range' && (
            <div className="flex items-center space-x-2">
              <div className={`flex items-center space-x-2 border rounded-xl px-3 py-1.5 ${isDark ? 'bg-[#1E293B] border-[#2C2C2E] text-white' : 'bg-white border-gray-200 text-gray-900 shadow-xs'}`}>
                <span className="text-[11px] font-medium opacity-80">{isBn ? 'হতে:' : 'From:'}</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent outline-none text-xs font-mono cursor-pointer dark:bg-[#1E293B] dark:text-white"
                />
              </div>
              <div className={`flex items-center space-x-2 border rounded-xl px-3 py-1.5 ${isDark ? 'bg-[#1E293B] border-[#2C2C2E] text-white' : 'bg-white border-gray-200 text-gray-900 shadow-xs'}`}>
                <span className="text-[11px] font-medium opacity-80">{isBn ? 'পর্যন্ত:' : 'To:'}</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent outline-none text-xs font-mono cursor-pointer dark:bg-[#1E293B] dark:text-white"
                />
              </div>
            </div>
          )}

          {dateFilterType === 'single_month' && (
            <div className={`flex items-center space-x-2 border rounded-xl px-3 py-1.5 ${isDark ? 'bg-[#1E293B] border-[#2C2C2E] text-white' : 'bg-white border-gray-200 text-gray-900 shadow-xs'}`}>
              <span className="text-[11px] font-medium opacity-80">{isBn ? 'মাস:' : 'Month:'}</span>
              <input
                type="month"
                value={singleMonth}
                onChange={(e) => setSingleMonth(e.target.value)}
                className="bg-transparent outline-none text-xs font-mono cursor-pointer dark:bg-[#1E293B] dark:text-white"
              />
            </div>
          )}

          {dateFilterType === 'month_range' && (
            <div className="flex items-center space-x-2">
              <div className={`flex items-center space-x-2 border rounded-xl px-3 py-1.5 ${isDark ? 'bg-[#1E293B] border-[#2C2C2E] text-white' : 'bg-white border-gray-200 text-gray-900 shadow-xs'}`}>
                <span className="text-[11px] font-medium opacity-80">{isBn ? 'শুরু মাস:' : 'Start Mth:'}</span>
                <input
                  type="month"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="bg-transparent outline-none text-xs font-mono cursor-pointer dark:bg-[#1E293B] dark:text-white"
                />
              </div>
              <div className={`flex items-center space-x-2 border rounded-xl px-3 py-1.5 ${isDark ? 'bg-[#1E293B] border-[#2C2C2E] text-white' : 'bg-white border-gray-200 text-gray-900 shadow-xs'}`}>
                <span className="text-[11px] font-medium opacity-80">{isBn ? 'শেষ মাস:' : 'End Mth:'}</span>
                <input
                  type="month"
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className="bg-transparent outline-none text-xs font-mono cursor-pointer dark:bg-[#1E293B] dark:text-white"
                />
              </div>
            </div>
          )}

          {dateFilterType === 'single_year' && (
            <div className={`flex items-center space-x-2 border rounded-xl px-3 py-1.5 ${isDark ? 'bg-[#1E293B] border-[#2C2C2E] text-white' : 'bg-white border-gray-200 text-gray-900 shadow-xs'}`}>
              <span className="text-[11px] font-medium opacity-80">{isBn ? 'বছর:' : 'Year:'}</span>
              <select
                value={singleYear}
                onChange={(e) => setSingleYear(e.target.value)}
                className="bg-transparent outline-none text-xs font-mono cursor-pointer dark:bg-[#1E293B] dark:text-white"
              >
                <option value="" className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">বছর নির্বাচন</option>
                {['2026', '2025', '2024', '2023', '2022'].map((yr) => (
                  <option key={yr} value={yr} className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">{yr}</option>
                ))}
              </select>
            </div>
          )}

          {dateFilterType === 'year_range' && (
            <div className="flex items-center space-x-2">
              <div className={`flex items-center space-x-2 border rounded-xl px-3 py-1.5 ${isDark ? 'bg-[#1E293B] border-[#2C2C2E] text-white' : 'bg-white border-gray-200 text-gray-900 shadow-xs'}`}>
                <span className="text-[11px] font-medium opacity-80">{isBn ? 'হতে বছর:' : 'From Yr:'}</span>
                <select
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  className="bg-transparent outline-none text-xs font-mono cursor-pointer dark:bg-[#1E293B] dark:text-white"
                >
                  <option value="" className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">শুরু</option>
                  {['2022', '2023', '2024', '2025', '2026'].map((yr) => (
                    <option key={yr} value={yr} className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">{yr}</option>
                  ))}
                </select>
              </div>
              <div className={`flex items-center space-x-2 border rounded-xl px-3 py-1.5 ${isDark ? 'bg-[#1E293B] border-[#2C2C2E] text-white' : 'bg-white border-gray-200 text-gray-900 shadow-xs'}`}>
                <span className="text-[11px] font-medium opacity-80">{isBn ? 'পর্যন্ত বছর:' : 'To Yr:'}</span>
                <select
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value)}
                  className="bg-transparent outline-none text-xs font-mono cursor-pointer dark:bg-[#1E293B] dark:text-white"
                >
                  <option value="" className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">শেষ</option>
                  {['2022', '2023', '2024', '2025', '2026'].map((yr) => (
                    <option key={yr} value={yr} className="bg-white text-gray-900 dark:bg-[#1E293B] dark:text-white">{yr}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Reset Date Filter Button */}
          {dateFilterType !== 'all' && (
            <button
              onClick={resetDateFilters}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 cursor-pointer outline-none transition-all ${
                isDark
                  ? 'bg-[#1E293B] hover:bg-[#2C2C2E] border-[#2C2C2E] text-rose-400'
                  : 'bg-white hover:bg-slate-50 border-gray-200 text-rose-600 shadow-xs'
              }`}
              title={isBn ? 'তারিখ ফিল্টার রিসেট' : 'Reset Date Filter'}
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
              <span>{isBn ? 'রিসেট' : 'Reset'}</span>
            </button>
          )}
        </div>

        {/* Search Field */}
        <div className={`flex items-center space-x-2 border rounded-xl px-3 py-1.5 min-w-[280px] ${isDark ? 'bg-[#1E293B] border-[#2C2C2E] text-white' : 'bg-white border-gray-200 text-gray-900 shadow-xs'}`}>
          <Search className="w-4 h-4 opacity-50 shrink-0" />
          <input
            type="text"
            placeholder={isBn ? 'সিটিএন, ট্র্যাকিং, শিপিং মার্ক বা পণ্য (EN/CN) দিয়ে খুঁজুন...' : 'Search CTN, tracking, mark or product (EN/CN)...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent outline-none text-xs w-full"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-900 dark:hover:text-white bg-transparent border-0 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Horizontal Live Pipeline Stage Stepper */}
      <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#1E293B] border-[#2C2C2E]' : 'bg-white border-gray-200 shadow-xs'}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#00897B] flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5" />
            <span>{isBn ? 'পাইপলাইন অবস্থান সারাংশ — সব সংখ্যা রিয়েলটাইম' : 'Pipeline Stage Summary — Real-time Live Counters'}</span>
          </span>
          <span className={`text-[11px] ${isDark ? 'text-[#9E9E9E]' : 'text-gray-500'}`}>
            {isBn ? 'স্টেজ কার্ডে ক্লিক করে ফিল্টার করুন' : 'Click stage card to filter table'}
          </span>
        </div>

        {/* Stage Stepper Horizontal Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 items-center">
          {/* Stage 1: Origin Booking */}
          <button
            onClick={() => setStageFilter(stageFilter === 'booking' ? 'all' : 'booking')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer relative ${
              stageFilter === 'booking'
                ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20'
                : isDark
                ? 'bg-[#1E293B] border-[#2C2C2E] hover:border-amber-500/50 text-white'
                : 'bg-white border-gray-200 hover:border-amber-400 text-gray-900 shadow-xs'
            }`}
          >
            <div className="w-7 h-7 mx-auto mb-1.5 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-500">
              <PlusCircle className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold font-mono text-amber-500">{bookingCount}</p>
            <p className={`text-[10px] font-medium mt-0.5 truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{isBn ? 'অরিজিন বুকিং' : 'Origin Booking'}</p>
          </button>

          {/* Stage 2: Flying Proposal */}
          <button
            onClick={() => setStageFilter(stageFilter === 'proposal' ? 'all' : 'proposal')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer relative ${
              stageFilter === 'proposal'
                ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20'
                : isDark
                ? 'bg-[#1E293B] border-[#2C2C2E] hover:border-blue-500/50 text-white'
                : 'bg-white border-gray-200 hover:border-blue-400 text-gray-900 shadow-xs'
            }`}
          >
            <div className="w-7 h-7 mx-auto mb-1.5 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-500">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold font-mono text-blue-500">{proposalCount}</p>
            <p className={`text-[10px] font-medium mt-0.5 truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{isBn ? 'ফ্লাইং প্রস্তাবনা' : 'Proposal Submitted'}</p>
          </button>

          {/* Stage 3: In Transit */}
          <button
            onClick={() => setStageFilter(stageFilter === 'transit' ? 'all' : 'transit')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer relative ${
              stageFilter === 'transit'
                ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/20'
                : isDark
                ? 'bg-[#1E293B] border-[#2C2C2E] hover:border-purple-500/50 text-white'
                : 'bg-white border-gray-200 hover:border-purple-400 text-gray-900 shadow-xs'
            }`}
          >
            <div className="w-7 h-7 mx-auto mb-1.5 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-500">
              <Plane className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold font-mono text-purple-500">{transitCount}</p>
            <p className={`text-[10px] font-medium mt-0.5 truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{isBn ? 'ফ্লাইটে ট্রানজিট' : 'In-Transit Flight'}</p>
          </button>

          {/* Stage 4: BD Received */}
          <button
            onClick={() => setStageFilter(stageFilter === 'received' ? 'all' : 'received')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer relative ${
              stageFilter === 'received'
                ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                : isDark
                ? 'bg-[#1E293B] border-[#2C2C2E] hover:border-emerald-500/50 text-white'
                : 'bg-white border-gray-200 hover:border-emerald-400 text-gray-900 shadow-xs'
            }`}
          >
            <div className="w-7 h-7 mx-auto mb-1.5 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-500">
              <Building2 className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold font-mono text-emerald-500">{receivedBdCount}</p>
            <p className={`text-[10px] font-medium mt-0.5 truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{isBn ? 'বিডি ওয়্যারহাউজ' : 'BD Hub Received'}</p>
          </button>

          {/* Stage 5: Delivered & Settled */}
          <button
            onClick={() => setStageFilter(stageFilter === 'delivered' ? 'all' : 'delivered')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer relative ${
              stageFilter === 'delivered'
                ? 'border-teal-500 bg-teal-500/10 ring-2 ring-teal-500/20'
                : isDark
                ? 'bg-[#1E293B] border-[#2C2C2E] hover:border-teal-500/50 text-white'
                : 'bg-white border-gray-200 hover:border-teal-400 text-gray-900 shadow-xs'
            }`}
          >
            <div className="w-7 h-7 mx-auto mb-1.5 rounded-lg bg-teal-500/15 flex items-center justify-center text-[#00897B]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold font-mono text-[#00897B]">{deliveredCount}</p>
            <p className={`text-[10px] font-medium mt-0.5 truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{isBn ? 'ডেলিভারড ও সেটেলড' : 'Delivered Settled'}</p>
          </button>

          {/* Stage 6: Total Shipments */}
          <button
            onClick={() => setStageFilter('all')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer relative ${
              stageFilter === 'all'
                ? 'border-[#00897B] bg-[#00897B]/10 ring-2 ring-[#00897B]/20'
                : isDark
                ? 'bg-[#1E293B] border-[#2C2C2E] hover:border-[#00897B]/50 text-white'
                : 'bg-white border-gray-200 hover:border-[#00897B] text-gray-900 shadow-xs'
            }`}
          >
            <div className="w-7 h-7 mx-auto mb-1.5 rounded-lg bg-[#00897B]/15 flex items-center justify-center text-[#00897B]">
              <Package className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold font-mono text-[#00897B]">{totalCount}</p>
            <p className={`text-[10px] font-medium mt-0.5 truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{isBn ? 'সব কার্গো ডাটা' : 'All Cargo Data'}</p>
          </button>
        </div>
      </div>

      {/* 4. Operation Director Approved Final Flying Lists (Cards View Default OR Table View) */}
      <div className="space-y-4">
        {/* Header Bar & View Switcher */}
        <div className={`p-4 rounded-none border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-xs'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-none bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium tracking-tight flex items-center space-x-2">
                <span>{isBn ? 'অপারেশন ডিরেক্টর অনুমোদিত ফাইনাল ফ্লাইং ডাটা কার্ড' : 'Operation Director Approved Final Flying List Cards'}</span>
                <span className="px-2 py-0.5 rounded-none text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-normal uppercase">
                  {approvedProposals.length} {isBn ? 'টি ফাইনাল লিস্ট' : 'Batches'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-light mt-0.5">
                {isBn ? 'অপারেশন ডিরেক্টর যেসকল রিকোয়েস্ট অনুমোদন বা ফাইনাল লিস্ট করেছেন শুধুমাত্র সেগুলোর আসল ডাটা কার্ড আকারে প্রদর্শিত হচ্ছে।' : 'Only proposals finalized & approved by Operation Director are tracked here.'}
              </p>
            </div>
          </div>

          {/* View Mode Toggle Buttons */}
          <div className={`flex items-center border rounded-none p-0.5 ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-100 border-slate-300'}`}>
            <button
              type="button"
              onClick={() => setViewLayout('cards')}
              className={`px-3 py-1.5 rounded-none text-xs font-normal transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewLayout === 'cards'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>{isBn ? '🎴 কার্ড ভিউ' : 'Cards View'}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewLayout('table')}
              className={`px-3 py-1.5 rounded-none text-xs font-normal transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewLayout === 'table'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isBn ? '📋 মাস্টার শিট টেবিল' : 'Master Table'}</span>
            </button>
          </div>
        </div>

        {/* VIEW MODE 1: CARDS VIEW (DEFAULT) */}
        {viewLayout === 'cards' && (
          <div className="space-y-4">
            {approvedProposals.length === 0 ? (
              <div className={`p-10 text-center rounded-none border text-xs ${isDark ? 'bg-[#1E293B] border-slate-700 text-slate-400' : 'bg-white border-slate-300 text-slate-600'}`}>
                <Plane className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {isBn ? 'কোনো অনুমোদিত ফাইনাল ফ্লাইং ডাটা পাওয়া যায়নি' : 'No Approved Final Flying List Found'}
                </p>
                <p className="mt-1 font-light text-slate-500 dark:text-slate-400">
                  {isBn
                    ? 'অপারেশন ডিরেক্টর থেকে প্রস্তাবনা অনুমোদন (Approve) পাওয়ার পর প্রকৃত ফাইনাল ডাটা কার্ড আকারে এখানে দেখাবে।'
                    : 'Final flight batch cards will appear here once approved by Operation Director.'}
                </p>
              </div>
            ) : (
              approvedProposals.map((prop: FlyingProposal) => {
                const isDispatched = prop.status === 'dispatched' || prop.status === 'in_transit';
                const isArrived = (prop.status as string) === 'received' || (prop.status as string) === 'delivered' || (prop.status as string) === 'arrived';
                const propCartons = safeCartons.filter((c) => (prop.carton_ids || []).includes(c.id) || c.flight_number === prop.flight_number);

                return (
                  <div
                    key={prop.id}
                    className={`p-5 rounded-none border transition-all space-y-4 ${
                      isArrived
                        ? isDark ? 'bg-[#1E293B] border-emerald-800/60 text-white' : 'bg-white border-emerald-300 text-slate-900 shadow-xs'
                        : isDispatched
                        ? isDark ? 'bg-[#1E293B] border-blue-800/60 text-white' : 'bg-white border-blue-300 text-slate-900 shadow-xs'
                        : isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-xs'
                    }`}
                  >
                    {/* Card Top Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-200 dark:border-slate-700">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-none bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          <Plane className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-medium text-sm text-blue-600 dark:text-blue-400">#{prop.id.toUpperCase()}</span>
                            {prop.flight_number && (
                              <span className="px-2 py-0.5 rounded-none text-[10px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20">
                                ✈️ {prop.flight_number} ({prop.airline || 'Air Cargo'})
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-1 flex items-center space-x-2 font-light text-slate-600 dark:text-slate-300">
                            <Building2 className="w-3.5 h-3.5 text-blue-500" />
                            <span>{prop.warehouse_name} 🇨🇳</span>
                            <span>➔</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-normal">{prop.destination_warehouse_name || 'ঢাকা সেন্ট্রাল (BD 🇧🇩)'}</span>
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-none text-xs font-mono font-normal uppercase tracking-wide border ${
                          isArrived
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : isDispatched
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}>
                          {isArrived
                            ? '🛬 RECEIVED AT BD WAREHOUSE'
                            : isDispatched
                            ? '✈️ DISPATCHED & FLYING MID-AIR'
                            : '✅ OP DIRECTOR APPROVED — READY FOR LAUNCH'}
                        </span>
                      </div>
                    </div>

                    {/* Card Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-light">
                      <div className={`p-3 rounded-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase">{isBn ? 'মোট কার্টুন:' : 'Total Cartons:'}</span>
                        <span className="font-mono font-medium text-sm text-slate-900 dark:text-white block mt-0.5">{prop.items_count} {isBn ? 'টি কার্টুন' : 'cartons'}</span>
                      </div>

                      <div className={`p-3 rounded-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase">{isBn ? 'মোট গ্রস ওজন:' : 'Gross Weight:'}</span>
                        <span className="font-mono font-medium text-sm text-emerald-600 dark:text-emerald-400 block mt-0.5">{prop.total_weight.toFixed(1)} kg</span>
                      </div>

                      <div className={`p-3 rounded-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase">{isBn ? 'মোট সিবিএম ভলিউম:' : 'Total Volume:'}</span>
                        <span className="font-mono font-medium text-sm text-purple-600 dark:text-purple-400 block mt-0.5">{prop.total_cbm.toFixed(2)} CBM</span>
                      </div>

                      <div className={`p-3 rounded-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase">{isBn ? 'অনুমোদন তারিখ ও এডমিন:' : 'Approval & Admin:'}</span>
                        <span className="font-mono text-xs text-slate-800 dark:text-slate-200 block mt-0.5">{prop.date}</span>
                        <span className="text-[10px] text-slate-500 block truncate">{prop.finalized_by || 'Tanvir Ahmed (Super Admin)'}</span>
                      </div>
                    </div>

                    {/* Attached Cartons Preview Bar */}
                    <div className="pt-1 flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div className="flex items-center space-x-2 overflow-x-auto py-0.5">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-light">{isBn ? 'সংযুক্ত কার্টুন:' : 'Attached Cartons:'}</span>
                        {propCartons.slice(0, 5).map((c) => (
                          <span
                            key={c.id}
                            className={`px-2 py-0.5 rounded-none text-[10px] font-mono border ${
                              isDark ? 'bg-slate-900 text-teal-400 border-slate-700' : 'bg-slate-100 text-teal-700 border-slate-200'
                            }`}
                          >
                            {c.ctn_no} ({c.gross_weight}kg)
                          </span>
                        ))}
                        {propCartons.length > 5 && (
                          <span className="text-[11px] font-mono text-slate-400">+{propCartons.length - 5} {isBn ? 'টি অতিরিক্ত' : 'more'}</span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setPrintManifestProposal(prop)}
                          className="px-3.5 py-1.5 rounded-none bg-slate-800 hover:bg-slate-900 active:bg-slate-900 text-white text-xs font-medium transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs border-0 outline-none"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-300" />
                          <span>{isBn ? 'ম্যানিফেস্ট প্রিন্ট' : 'Print Manifest'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedProposalModal(prop)}
                          className="px-3.5 py-1.5 rounded-none bg-[#00897B] hover:bg-[#00796B] active:bg-[#00695C] text-white text-xs font-medium transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer border-0 outline-none"
                        >
                          <Eye className="w-3.5 h-3.5 text-white" />
                          <span>{isBn ? 'কার্টুন তালিকা ইন্সপেক্ট' : 'Inspect Cartons'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* VIEW MODE 2: TABLE VIEW */}
        {viewLayout === 'table' && (
          <div className={`rounded-none border overflow-hidden shadow-xl ${isDark ? 'bg-[#1E293B] border-[#2C2C2E]' : 'bg-white border-gray-200 shadow-md'}`}>
            <div className="p-3.5 border-b flex items-center justify-between flex-wrap gap-2 bg-emerald-500/5 border-emerald-500/20">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span className="font-bold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {isBn ? 'অফিসিয়াল বুকিং শীট ডাটা টেবিল (sample-booking-sheet.xlsx Standard)' : 'Official Booking Master Sheet Table (sample-booking-sheet.xlsx Standard)'}
                </span>
              </div>
              <span className="text-[11px] opacity-75 font-mono">
                {filteredCartons.length} {isBn ? 'টি এন্ট্রি ডাটা' : 'Entries'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
            <thead className={`uppercase text-[10px] tracking-wider font-semibold border-b ${isDark ? 'bg-[#1E293B] text-[#9E9E9E] border-[#2C2C2E]' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
              <tr>
                <th className="p-3 text-center border-r border-gray-200 dark:border-[#2C2C2E]/60 w-12">SL/NO</th>
                <th className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 whitespace-nowrap">ENTRY DATE</th>
                <th className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 whitespace-nowrap text-[#00897B]">CTN NO</th>
                <th className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 whitespace-nowrap text-amber-500">SHIPPING MARK</th>
                <th className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60">PRODUCT NAME (EN / CN)</th>
                <th className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 text-center whitespace-nowrap">QTY/CTN</th>
                <th className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 text-right whitespace-nowrap">N.WT(KG)</th>
                <th className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 text-right whitespace-nowrap text-emerald-500">G.WT(KG)</th>
                <th className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 text-right whitespace-nowrap text-amber-500">CBM/CTN</th>
                <th className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 whitespace-nowrap">TRACKING NUM</th>
                <th className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 whitespace-nowrap text-[#1E88E5]">DESTINATION</th>
                <th className="p-3 whitespace-nowrap">PIPELINE STAGE</th>
                <th className="p-3 text-right whitespace-nowrap">ACTION</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#2C2C2E]/70 text-gray-200' : 'divide-gray-100 text-gray-800'}`}>
              {filteredCartons.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-12 text-center text-xs opacity-60 font-medium">
                    {isBn ? 'কোনো শিপমেন্ট ডাটা পাওয়া যায়নি — সব ডাটা প্রসেসিংয়ে আছে' : 'No shipment data found in this pipeline stage'}
                  </td>
                </tr>
              ) : (
                filteredCartons.map((c, idx) => {
                  if (!c) return null;
                  const badge = getStatusBadge(c.status);
                  const destWh = safeWarehouses.find((w) => w && w.id === c.destination_warehouse_id);

                  const netWeight = c.net_weight || parseFloat(((c.gross_weight || 10) * 0.94).toFixed(2));
                  const productCn = c.product_name_cn || '百雅 / 手机壳 / 零部件';

                  return (
                    <tr
                      key={c.id || `ctn-${idx}`}
                      className={`transition-colors font-mono ${
                        isDark ? 'hover:bg-[#242426]' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* 1. SL/NO */}
                      <td className="p-3 text-center border-r border-gray-200 dark:border-[#2C2C2E]/60 font-bold opacity-75">
                        {idx + 1}
                      </td>

                      {/* 2. ENTRY DATE */}
                      <td className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 whitespace-nowrap font-medium text-xs">
                        {formatDateStr(c.created_at)}
                      </td>

                      {/* 3. CTN NO */}
                      <td className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 whitespace-nowrap font-bold text-sm text-[#00897B]">
                        {c.ctn_no || '2440'}
                      </td>

                      {/* 4. Shipping Mark */}
                      <td className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 whitespace-nowrap font-bold text-xs text-amber-500">
                        {c.shipping_mark || 'ASI/BURHAM-35'}
                      </td>

                      {/* 5 & 6. Product Name (EN / CN) */}
                      <td
                        title={`${c.product_name_en || 'Face mask 5g'} ${productCn ? `(${productCn})` : ''}`}
                        className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 font-sans group cursor-pointer"
                      >
                        <span className="font-semibold text-xs block truncate max-w-[170px] text-emerald-600 dark:text-emerald-400 group-hover:whitespace-normal group-hover:overflow-visible group-hover:max-w-none group-hover:break-words">
                          {c.product_name_en || 'Face mask 5g'}
                        </span>
                        <span className="text-[10px] opacity-60 block truncate max-w-[170px] mt-0.5 group-hover:whitespace-normal group-hover:overflow-visible group-hover:max-w-none group-hover:break-words">
                          {productCn}
                        </span>
                      </td>

                      {/* 7. Quantity/CTN */}
                      <td className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 text-center font-bold">
                        {c.quantity || 300}
                      </td>

                      {/* 8. N.Weight(KG) */}
                      <td className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 text-right opacity-80">
                        {netWeight}
                      </td>

                      {/* 9. G.Weight(KG) */}
                      <td className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 text-right font-bold text-emerald-500">
                        {c.gross_weight || 28.05}
                      </td>

                      {/* 10. CBM/CTN */}
                      <td className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 text-right font-bold text-amber-500">
                        {c.cbm || 0.04}
                      </td>

                      {/* 11. TRACKING NUM */}
                      <td className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 whitespace-nowrap text-[11px] opacity-90">
                        {c.tracking_number || '7345680'}
                      </td>

                      {/* 12. DESTINATION */}
                      <td className="p-3 border-r border-gray-200 dark:border-[#2C2C2E]/60 whitespace-nowrap font-sans">
                        <span className="font-semibold text-xs text-[#1E88E5] block">
                          {destWh?.name || (c.shipping_mark.includes('CHITTAGONG') ? 'চট্টগ্রাম ওয়্যারহাউজ' : c.shipping_mark.includes('SYLHET') ? 'সিলেট হাব' : 'ঢাকা সেন্ট্রাল হাব')}
                        </span>
                        <span className="text-[10px] opacity-60 block">Bangladesh 🇧🇩</span>
                      </td>

                      {/* Pipeline Stage Badge */}
                      <td className="p-3 whitespace-nowrap font-sans">
                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${badge.bg}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Action Timeline Button */}
                      <td className="p-3 text-right whitespace-nowrap font-sans">
                        <button
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setClickPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                            setIsFlying(true);

                            // Wait 1800ms for plane to take off, loop 360° at relaxed speed, and hover at center before opening modal
                            setTimeout(() => {
                              setSelectedCartonTimeline(c);
                              setIsFlying(false);
                            }, 1800);
                          }}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#00897B]/15 hover:bg-[#00897B]/30 text-[#00897B] hover:scale-105 transition-all border border-[#00897B]/20 outline-none cursor-pointer shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isBn ? 'টাইমলাইন' : 'Timeline'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>

      {/* 360° Pure Standalone Plane Sky Loop Takeoff Overlay (Zero Background under Plane) */}
      {isFlying && clickPos && (
        <div className="fixed inset-0 pointer-events-none z-[70] overflow-hidden bg-black/25 backdrop-blur-xs animate-backdrop-apple">
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 animate-plane-sky-loop"
            style={{
              left: `${clickPos.x}px`,
              top: `${clickPos.y}px`,
              '--start-x': `${clickPos.x}px`,
              '--start-y': `${clickPos.y}px`,
            } as React.CSSProperties}
          >
            <div className="relative flex items-center justify-center">
              <Plane className="w-12 h-12 text-[#00897B] dark:text-emerald-400 drop-shadow-[0_0_25px_rgba(0,137,123,1)] filter transform -rotate-45" />
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Inspect Cartons in Proposal Batch */}
      {selectedProposalModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-3xl rounded-none border p-6 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl ${
            isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-blue-500" />
                <h3 className="font-medium text-base">
                  {isBn ? 'ফ্লাইং প্রোপোজাল কার্টুন ইন্সপেকশন — ' : 'Flight Proposal Cartons Inspection — '}
                  <span className="font-mono text-blue-600 dark:text-blue-400">#{selectedProposalModal.id.toUpperCase()}</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedProposalModal(null)}
                className="p-1.5 rounded-none hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-light">
              <div className={`p-3 rounded-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-slate-500 block">{isBn ? 'এয়ারলাইন / ফ্লাইট:' : 'Airline / Flight:'}</span>
                <span className="font-mono font-medium text-blue-500 text-sm block mt-0.5">{selectedProposalModal.flight_number || 'N/A'}</span>
              </div>
              <div className={`p-3 rounded-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-slate-500 block">{isBn ? 'মোট কার্টুন:' : 'Total Cartons:'}</span>
                <span className="font-mono font-medium text-emerald-500 text-sm block mt-0.5">{selectedProposalModal.items_count} cartons</span>
              </div>
              <div className={`p-3 rounded-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-slate-500 block">{isBn ? 'মোট গ্রস ওজন:' : 'Total Gross Wt:'}</span>
                <span className="font-mono font-medium text-emerald-500 text-sm block mt-0.5">{selectedProposalModal.total_weight} kg</span>
              </div>
              <div className={`p-3 rounded-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-slate-500 block">{isBn ? 'মোট ভলিউম:' : 'Total Volume:'}</span>
                <span className="font-mono font-medium text-purple-500 text-sm block mt-0.5">{selectedProposalModal.total_cbm} CBM</span>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className={`uppercase text-[10px] border-b ${isDark ? 'bg-[#1E293B] text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                  <tr>
                    <th className="p-2.5">CTN NO</th>
                    <th className="p-2.5">SHIPPING MARK</th>
                    <th className="p-2.5">PRODUCT NAME</th>
                    <th className="p-2.5 text-right">G.WT (KG)</th>
                    <th className="p-2.5 text-right">CBM</th>
                    <th className="p-2.5">TRACKING</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {safeCartons
                    .filter((c) => (selectedProposalModal.carton_ids || []).includes(c.id) || c.flight_number === selectedProposalModal.flight_number)
                    .map((c) => (
                      <tr key={c.id} className={isDark ? 'hover:bg-[#202023]' : 'hover:bg-slate-50'}>
                        <td className="p-2.5 font-bold text-teal-500">{c.ctn_no}</td>
                        <td className="p-2.5 font-bold text-amber-500">{c.shipping_mark}</td>
                        <td className="p-2.5 font-sans">{c.product_name_en || 'Face mask 5g'}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-500">{c.gross_weight} kg</td>
                        <td className="p-2.5 text-right text-purple-500">{c.cbm} CBM</td>
                        <td className="p-2.5 text-slate-400">{c.tracking_number}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedProposalModal(null)}
                className="px-4 py-1.5 rounded-none bg-blue-600 hover:bg-blue-700 text-white text-xs font-normal cursor-pointer"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Print Flight Manifest Report */}
      {printManifestProposal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-white text-slate-900 rounded-none p-6 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl font-mono text-xs">
            <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold uppercase tracking-tight text-slate-900">FOUR STAR CARGO LOGISTICS</h2>
                <p className="text-[11px] text-slate-600">OFFICIAL AIR FREIGHT FLIGHT MANIFEST REPORT</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-blue-700">MANIFEST #{printManifestProposal.id.toUpperCase()}</span>
                <p className="text-[10px] text-slate-500">DATE: {printManifestProposal.date}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-100 border border-slate-300 text-[11px]">
              <div>
                <span className="text-[9px] text-slate-500 block">ORIGIN HUB:</span>
                <span className="font-bold">{printManifestProposal.warehouse_name}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">DESTINATION:</span>
                <span className="font-bold">{printManifestProposal.destination_warehouse_name || 'Dhaka Central Hub 🇧🇩'}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block">CARRIER / FLIGHT:</span>
                <span className="font-bold">{printManifestProposal.flight_number || 'BS-206'}</span>
              </div>
            </div>

            <table className="w-full text-left border-collapse border border-slate-300">
              <thead className="bg-slate-200 text-[10px] border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300">CTN NO</th>
                  <th className="p-2 border-r border-slate-300">SHIPPING MARK</th>
                  <th className="p-2 border-r border-slate-300">PRODUCT</th>
                  <th className="p-2 border-r border-slate-300 text-right">WEIGHT</th>
                  <th className="p-2 text-right">CBM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {safeCartons
                  .filter((c) => (printManifestProposal.carton_ids || []).includes(c.id) || c.flight_number === printManifestProposal.flight_number)
                  .map((c) => (
                    <tr key={c.id}>
                      <td className="p-2 border-r border-slate-300 font-bold">{c.ctn_no}</td>
                      <td className="p-2 border-r border-slate-300">{c.shipping_mark}</td>
                      <td className="p-2 border-r border-slate-300 font-sans">{c.product_name_en}</td>
                      <td className="p-2 border-r border-slate-300 text-right font-bold">{c.gross_weight} kg</td>
                      <td className="p-2 text-right">{c.cbm}</td>
                    </tr>
                  ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center pt-4 border-t border-slate-300">
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-xs font-medium cursor-pointer"
              >
                🖨️ Print Manifest PDF
              </button>
              <button
                onClick={() => setPrintManifestProposal(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-sans text-xs cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Sleek Fast Animated High-Tech Shipment Journey Modal */}
      {selectedCartonTimeline && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50 animate-backdrop-apple">
          <div
            className={`w-full max-w-2xl rounded-3xl border shadow-2xl relative overflow-hidden transform animate-modal-apple ${
              isDark
                ? 'bg-[#141416]/95 border-[#2C2C2E] text-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] ring-1 ring-white/10'
                : 'bg-white/95 border-gray-200 text-gray-900 shadow-2xl backdrop-blur-xl ring-1 ring-black/5'
            }`}
          >
            {/* Top Glowing Ambient Aura Bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 shadow-lg shadow-emerald-500/50" />
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-48 bg-gradient-to-b from-[#00897B]/35 via-emerald-500/15 to-transparent blur-3xl pointer-events-none" />

            {/* Modal Header (Cascading Item 1) */}
            <div className="relative px-6 pt-6 pb-4 border-b border-gray-200/80 dark:border-[#2C2C2E] flex items-start justify-between gap-4 animate-cascade-1">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#00897B]/15 text-[#00897B] border border-[#00897B]/30 flex items-center space-x-1.5 animate-pulse">
                    <Sparkles className="w-3 h-3 text-[#00897B]" />
                    <span>{isBn ? 'মাল্টি-কান্ট্রি শিপমেন্ট লাইফসাইকেল' : 'Multi-Country Shipment Lifecycle Audit'}</span>
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black font-mono tracking-tight mt-1.5 text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500">
                  {selectedCartonTimeline.ctn_no} <span className="text-gray-400 font-normal">|</span> <span className="text-amber-500 font-bold">{selectedCartonTimeline.shipping_mark}</span>
                </h2>
                <p className={`text-xs mt-0.5 font-mono ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                  {isBn ? 'সাপ্লায়ার ট্র্যাকিং নং:' : 'Supplier Tracking:'} <span className={`font-bold ${isDark ? 'text-gray-100' : 'text-slate-900'}`}>{selectedCartonTimeline.tracking_number || 'TRK98421039'}</span>
                </p>
              </div>

              <button
                onClick={() => setSelectedCartonTimeline(null)}
                className="p-2 rounded-2xl hover:bg-gray-200/50 dark:hover:bg-[#2C2C2E] text-gray-400 hover:text-white transition-all transform hover:rotate-90 hover:scale-110 active:scale-95 bg-transparent border-0 outline-none cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Glass Stat Cards Grid (Top-to-Bottom Cascading Items 2-5) */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {/* Stat 1: Product EN/CN */}
                <div
                  title={`${selectedCartonTimeline.product_name_en || 'Face mask 5g'} ${selectedCartonTimeline.product_name_cn ? `(${selectedCartonTimeline.product_name_cn})` : ''}`}
                  className={`p-3 rounded-2xl border transition-all animate-cascade-2 group cursor-pointer ${
                    isDark ? 'bg-[#1E293B]/90 border-[#2C2C2E] hover:border-[#00897B]/50' : 'bg-white border-slate-200/90 shadow-xs hover:border-emerald-400'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 mb-1">
                    <Package className="w-3.5 h-3.5 text-[#00897B]" />
                    <span className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{isBn ? 'পণ্য' : 'Product'}</span>
                  </div>
                  <span className={`font-bold block text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'} truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:break-words`}>
                    {selectedCartonTimeline.product_name_en || 'Face mask 5g'}
                  </span>
                  <span className={`text-[10px] block mt-0.5 ${isDark ? 'text-gray-300' : 'text-slate-600 font-medium'} truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:break-words`}>
                    {selectedCartonTimeline.product_name_cn || '百雅 5g'}
                  </span>
                </div>

                {/* Stat 2: Gross & Net Weight */}
                <div className={`p-3 rounded-2xl border transition-all animate-cascade-3 ${isDark ? 'bg-[#1E293B]/90 border-[#2C2C2E] hover:border-emerald-500/50' : 'bg-white border-slate-200/90 shadow-xs'}`}>
                  <div className="flex items-center space-x-1.5 mb-1">
                    <Scale className="w-3.5 h-3.5 text-emerald-500" />
                    <span className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{isBn ? 'ওজন (N.WT / G.WT)' : 'Weight'}</span>
                  </div>
                  <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 font-mono block">{selectedCartonTimeline.gross_weight} kg</span>
                  <span className={`text-[10px] block font-mono ${isDark ? 'text-gray-300' : 'text-slate-700 font-semibold'}`}>Net: {(selectedCartonTimeline.net_weight || selectedCartonTimeline.gross_weight * 0.94).toFixed(1)} kg</span>
                </div>

                {/* Stat 3: CBM Volume */}
                <div className={`p-3 rounded-2xl border transition-all animate-cascade-4 ${isDark ? 'bg-[#1E293B]/90 border-[#2C2C2E] hover:border-amber-500/50' : 'bg-white border-slate-200/90 shadow-xs'}`}>
                  <div className="flex items-center space-x-1.5 mb-1">
                    <Box className="w-3.5 h-3.5 text-amber-500" />
                    <span className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{isBn ? 'সিবিএম ভলিউম' : 'Volume CBM'}</span>
                  </div>
                  <span className="font-extrabold text-sm text-amber-600 dark:text-amber-500 font-mono block">{selectedCartonTimeline.cbm} CBM</span>
                  <span className={`text-[10px] block ${isDark ? 'text-gray-300' : 'text-slate-700 font-semibold'}`}>QTY: {selectedCartonTimeline.quantity} Pcs</span>
                </div>

                {/* Stat 4: Destination Hub */}
                <div
                  title={selectedCartonTimeline.shipping_mark.includes('CHITTAGONG') ? 'চট্টগ্রাম ওয়্যারহাউজ' : selectedCartonTimeline.shipping_mark.includes('SYLHET') ? 'সিলেট হাব' : 'ঢাকা সেন্ট্রাল হাব (Dhaka Central Hub)'}
                  className={`p-3 rounded-2xl border transition-all animate-cascade-5 group cursor-pointer ${
                    isDark ? 'bg-[#1E293B]/90 border-[#2C2C2E] hover:border-[#1E88E5]/50' : 'bg-white border-slate-200/90 shadow-xs hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-[#1E88E5]" />
                    <span className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>{isBn ? 'গন্তব্য হাব' : 'Destination'}</span>
                  </div>
                  <span className="font-extrabold text-xs text-[#1E88E5] block truncate group-hover:whitespace-normal group-hover:overflow-visible">
                    {selectedCartonTimeline.shipping_mark.includes('CHITTAGONG') ? 'চট্টগ্রাম ওয়্যারহাউজ' : selectedCartonTimeline.shipping_mark.includes('SYLHET') ? 'সিলেট হাব' : 'ঢাকা সেন্ট্রাল হাব'}
                  </span>
                  <span className={`text-[10px] block mt-0.5 ${isDark ? 'text-gray-300' : 'text-slate-700 font-semibold'}`}>Bangladesh 🇧🇩</span>
                </div>
              </div>

              {/* Multi-Country Animated Stepper Timeline (Cascading Items 6-11) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between animate-cascade-6">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#00897B] flex items-center space-x-2">
                    <Layers className="w-4 h-4" />
                    <span>{isBn ? 'অপারেশনাল টাইমলাইন ও লাইফসাইকেল ট্র্যাকিং' : 'Operational Lifecycle & Audit Trail'}</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-semibold border border-emerald-500/20">
                    Live Verified
                  </span>
                </div>

                {/* Vertical Stepper Container */}
                <div className="relative pl-7 space-y-7 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-1 before:bg-gradient-to-b before:from-amber-500 via-blue-500 to-emerald-500 before:rounded-full">
                  {/* Step 1: Origin Entry */}
                  <div className="relative flex items-start space-x-3.5 group animate-cascade-7">
                    <div className="absolute -left-[35px] top-0.5 w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-amber-500/30 animate-pulse-ripple">
                      1
                    </div>
                    <div className={`flex-1 p-3.5 rounded-2xl border transition-all ${isDark ? 'bg-[#1E293B]/90 border-[#2C2C2E]' : 'bg-white border-slate-200 shadow-xs'}`}>
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <h4 className="text-xs font-bold text-amber-600 dark:text-amber-500 flex items-center space-x-1.5">
                          <span>{isBn ? 'অরিজিন ওয়্যারহাউজ বুকিং এন্ট্রি (China 🇨🇳 / Thailand 🇹🇭)' : 'Origin Warehouse Booking Sheet Entry'}</span>
                        </h4>
                        <span className={`text-[10px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-600 font-semibold'}`}>{formatDateStr(selectedCartonTimeline.created_at)}</span>
                      </div>
                      <p className={`text-[11px] mt-1 ${isDark ? 'text-gray-300' : 'text-slate-800 font-medium'}`}>
                        {isBn
                          ? `বহির্বিশ্বের ওয়্যারহাউজ ইনচার্জ বুকিং ফাইল তৈরি করেছেন। এন্ট্রি তারিখ: ${formatDateStr(selectedCartonTimeline.created_at)}`
                          : `Overseas Warehouse Incharge (Chen Wei) created booking entry.`}
                      </p>
                      <div className={`mt-2 pt-2 border-t flex items-center justify-between text-[10px] font-mono ${isDark ? 'border-[#2C2C2E] text-gray-400' : 'border-slate-100 text-slate-700 font-semibold'}`}>
                        <span>Actor: Overseas Incharge</span>
                        <span className="text-amber-600 dark:text-amber-400 font-bold">Status: Booked</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Proposal & BD Ops Approval */}
                  <div className="relative flex items-start space-x-3.5 group animate-cascade-8">
                    <div className={`absolute -left-[35px] top-0.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-lg transition-all ${
                      selectedCartonTimeline.status !== 'booked'
                        ? 'bg-blue-500 text-white shadow-blue-500/30 animate-pulse-ripple'
                        : 'bg-gray-400 text-white dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      2
                    </div>
                    <div className={`flex-1 p-3.5 rounded-2xl border transition-all ${
                      selectedCartonTimeline.status !== 'booked'
                        ? isDark ? 'bg-[#1E293B]/90 border-blue-500/40' : 'bg-white border-blue-200 shadow-xs'
                        : isDark ? 'bg-[#1E293B]/50 border-[#2C2C2E] opacity-60' : 'bg-slate-50 border-gray-200 opacity-60'
                    }`}>
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <h4 className={`text-xs font-bold ${selectedCartonTimeline.status !== 'booked' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                          {isBn ? 'ফ্লাইং প্রোপোজাল সাবমিট ➔ বিডি অপারেশনস ম্যানেজার অনুমোদিত' : 'Proposal Submitted ➔ Approved by BD Operations Manager'}
                        </h4>
                        <span className={`text-[10px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-600 font-semibold'}`}>2026-08-14 18:30</span>
                      </div>
                      <p className={`text-[11px] mt-1 ${isDark ? 'text-gray-300' : 'text-slate-800 font-medium'}`}>
                        {selectedCartonTimeline.status !== 'booked'
                          ? (isBn ? 'বাংলাদেশের অপারেশনস ম্যানেজার শিডিউল অনুমোদন করে ফাইনাল করেছেন।' : 'BD Operations Manager reviewed & approved proposal schedule.')
                          : (isBn ? 'বিডি অপারেশনস ম্যানেজার অনুমোদনের অপেক্ষায়' : 'Awaiting BD Operations Manager final approval')}
                      </p>
                      <div className={`mt-2 pt-2 border-t flex items-center justify-between text-[10px] font-mono ${isDark ? 'border-[#2C2C2E] text-gray-400' : 'border-slate-100 text-slate-700 font-semibold'}`}>
                        <span>Actor: Tanvir Ahmed (BD Ops Manager)</span>
                        <span className={selectedCartonTimeline.status !== 'booked' ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-400'}>Status: Finalized</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Flight Transit */}
                  <div className="relative flex items-start space-x-3.5 group animate-cascade-9">
                    <div className={`absolute -left-[35px] top-0.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-lg transition-all ${
                      selectedCartonTimeline.status === 'in_transit' || selectedCartonTimeline.status === 'received' || selectedCartonTimeline.status === 'delivered'
                        ? 'bg-purple-500 text-white shadow-purple-500/30 animate-pulse-ripple'
                        : 'bg-gray-400 text-white dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      <Plane className="w-3.5 h-3.5 animate-float-plane" />
                    </div>
                    <div className={`flex-1 p-3.5 rounded-2xl border transition-all ${
                      selectedCartonTimeline.status === 'in_transit' || selectedCartonTimeline.status === 'received' || selectedCartonTimeline.status === 'delivered'
                        ? isDark ? 'bg-[#1E293B]/90 border-purple-500/40' : 'bg-white border-purple-200 shadow-xs'
                        : isDark ? 'bg-[#1E293B]/50 border-[#2C2C2E] opacity-60' : 'bg-slate-50 border-gray-200 opacity-60'
                    }`}>
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <h4 className={`text-xs font-bold ${
                          selectedCartonTimeline.status === 'in_transit' || selectedCartonTimeline.status === 'received' || selectedCartonTimeline.status === 'delivered'
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-gray-500'
                        }`}>
                          {isBn ? 'আন্তর্জাতিক ফ্লাইট ট্রানজিট (Air Freight CZ-304 ✈️)' : 'International Flight Dispatch'}
                        </h4>
                        <span className={`text-[10px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-600 font-semibold'}`}>{selectedCartonTimeline.flying_date || '2026-08-14'}</span>
                      </div>
                      <p className={`text-[11px] mt-1 ${isDark ? 'text-gray-300' : 'text-slate-800 font-medium'}`}>
                        {selectedCartonTimeline.flying_date ? `Flight dispatched on ${selectedCartonTimeline.flying_date}` : 'Scheduled for upcoming flight'}
                      </p>
                      <div className={`mt-2 pt-2 border-t flex items-center justify-between text-[10px] font-mono ${isDark ? 'border-[#2C2C2E] text-gray-400' : 'border-slate-100 text-slate-700 font-semibold'}`}>
                        <span>Carrier: China Southern CZ-304</span>
                        <span className={selectedCartonTimeline.status === 'in_transit' ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-gray-400'}>Status: In-Flight</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 4: BD Hub Arrival */}
                  <div className="relative flex items-start space-x-3.5 group animate-cascade-10">
                    <div className={`absolute -left-[35px] top-0.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-lg transition-all ${
                      selectedCartonTimeline.status === 'received' || selectedCartonTimeline.status === 'delivered'
                        ? 'bg-emerald-500 text-white shadow-emerald-500/30 animate-pulse-ripple'
                        : 'bg-gray-400 text-white dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      4
                    </div>
                    <div className={`flex-1 p-3.5 rounded-2xl border transition-all ${
                      selectedCartonTimeline.status === 'received' || selectedCartonTimeline.status === 'delivered'
                        ? isDark ? 'bg-[#1E293B]/90 border-emerald-500/40' : 'bg-white border-emerald-200 shadow-xs'
                        : isDark ? 'bg-[#1E293B]/50 border-[#2C2C2E] opacity-60' : 'bg-slate-50 border-gray-200 opacity-60'
                    }`}>
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <h4 className={`text-xs font-bold ${
                          selectedCartonTimeline.status === 'received' || selectedCartonTimeline.status === 'delivered'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-500'
                        }`}>
                          {isBn ? 'ঢাকা ওয়্যারহাউজ রিসিভড (BD Airport Arrival 🇧🇩)' : 'Dhaka Central Warehouse Arrival'}
                        </h4>
                        <span className={`text-[10px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-600 font-semibold'}`}>2026-08-15 11:20</span>
                      </div>
                      <p className={`text-[11px] mt-1 ${isDark ? 'text-gray-300' : 'text-slate-800 font-medium'}`}>
                        {selectedCartonTimeline.status === 'received' || selectedCartonTimeline.status === 'delivered'
                          ? (isBn ? 'ঢাকা সেন্ট্রাল ইনচার্জ রিসিভ সম্পন্ন করেছেন।' : 'Package received & scanned at Dhaka Central Hub.')
                          : (isBn ? 'ট্রানজিট চলছে' : 'Awaiting BD arrival')}
                      </p>
                      <div className={`mt-2 pt-2 border-t flex items-center justify-between text-[10px] font-mono ${isDark ? 'border-[#2C2C2E] text-gray-400' : 'border-slate-100 text-slate-700 font-semibold'}`}>
                        <span>Actor: Rafiqul Islam (BD Incharge)</span>
                        <span className={selectedCartonTimeline.status === 'received' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400'}>Status: BD Hub Stock</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 5: Delivered & Settled */}
                  <div className="relative flex items-start space-x-3.5 group animate-cascade-11">
                    <div className={`absolute -left-[35px] top-0.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-lg transition-all ${
                      selectedCartonTimeline.status === 'delivered'
                        ? 'bg-teal-500 text-white shadow-teal-500/30 ring-4 ring-teal-500/20 animate-pulse'
                        : 'bg-gray-400 text-white dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div className={`flex-1 p-3.5 rounded-2xl border transition-all ${
                      selectedCartonTimeline.status === 'delivered'
                        ? isDark ? 'bg-[#1E293B]/90 border-teal-500/40' : 'bg-white border-teal-200 shadow-xs'
                        : isDark ? 'bg-[#1E293B]/50 border-[#2C2C2E] opacity-60' : 'bg-slate-50 border-gray-200 opacity-60'
                    }`}>
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <h4 className={`text-xs font-bold ${selectedCartonTimeline.status === 'delivered' ? 'text-teal-600 dark:text-teal-400' : 'text-gray-500'}`}>
                          {isBn ? 'কাস্টমার ডেলিভারি ও ক্যাশ আদায় (Accounts Ledger Synced)' : 'Customer Delivery & Accounts Settlement'}
                        </h4>
                        <span className={`text-[10px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-600 font-semibold'}`}>2026-08-15 14:00</span>
                      </div>
                      <p className={`text-[11px] mt-1 ${isDark ? 'text-gray-300' : 'text-slate-800 font-medium'}`}>
                        {selectedCartonTimeline.status === 'delivered'
                          ? (isBn ? 'পণ্য ক্লায়েন্টকে হস্তান্তর ও নগদ টাকা আদায় সম্পন্ন।' : 'Delivered to customer & cash collection recorded in Ledger.')
                          : (isBn ? 'ডেলিভারির অপেক্ষায়' : 'Awaiting final delivery & cash settlement')}
                      </p>
                      <div className={`mt-2 pt-2 border-t flex items-center justify-between text-[10px] font-mono ${isDark ? 'border-[#2C2C2E] text-gray-400' : 'border-slate-100 text-slate-700 font-semibold'}`}>
                        <span>Actor: Accounts Department</span>
                        <span className={selectedCartonTimeline.status === 'delivered' ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-gray-400'}>Status: Settled</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Controls (Cascading Item 12) */}
            <div className="p-4 px-6 border-t border-gray-200/80 dark:border-[#2C2C2E] flex items-center justify-between flex-wrap gap-3 bg-slate-50 dark:bg-[#1E293B]/80 animate-cascade-12">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-emerald-500/30 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 hover:scale-105 transition-all flex items-center space-x-1.5 cursor-pointer outline-none"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-500" />
                <span>{isBn ? 'প্রিন্ট অডিট পাস' : 'Print Audit Pass'}</span>
              </button>

              <button
                onClick={() => setSelectedCartonTimeline(null)}
                className="px-6 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#00897B] to-teal-600 hover:from-[#00796B] hover:to-teal-700 text-white shadow-lg shadow-[#00897B]/25 hover:shadow-teal-500/40 hover:scale-105 transition-all border-0 outline-none cursor-pointer"
              >
                {isBn ? 'বন্ধ করুন' : 'Close Audit View'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
