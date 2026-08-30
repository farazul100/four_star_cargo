import React, { useState, useMemo, useEffect } from 'react';
import {
  Plane,
  Building2,
  Calendar,
  Filter,
  Search,
  Package,
  Eye,
  X,
  Layers,
  UserCheck,
  Tag,
  Printer,
  Copy,
  Check,
  Grid,
  List,
  CheckCircle2,
  Send,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { FlyingProposal, Carton, Language, Theme } from '../types';
import { getHostingerDbData, saveHostingerDbData, subscribeToDbUpdates } from '../lib/db';
import { useTheme } from '../context/ThemeContext';

interface FinalFlyingListSectionProps {
  language: Language;
  theme?: Theme;
}

export const FinalFlyingListSection: React.FC<FinalFlyingListSectionProps> = ({
  language,
  theme: themeProp,
}) => {
  const { theme: contextTheme } = useTheme();
  const activeTheme = themeProp || contextTheme || 'light';
  const isDark = activeTheme === 'dark';
  const isBn = language === 'bn';

  // Live database state with real-time sync
  const [proposals, setProposals] = useState<FlyingProposal[]>(() => getHostingerDbData().proposals || []);
  const [cartons, setCartons] = useState<Carton[]>(() => getHostingerDbData().cartons || []);
  const [warehouses, setWarehouses] = useState(() => getHostingerDbData().warehouses || []);

  // Real-time DB Subscription
  useEffect(() => {
    return subscribeToDbUpdates(() => {
      const db = getHostingerDbData();
      setProposals(db.proposals || []);
      setCartons(db.cartons || []);
      setWarehouses(db.warehouses || []);
    });
  }, []);

  // Filter States
  const [dateFilter, setDateFilter] = useState<string>('');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [flightNoFilter, setFlightNoFilter] = useState<string>('all');
  const [destinationFilter, setDestinationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Carton Inspector, Manifest Print & Finish Success Modals
  const [selectedProposalForModal, setSelectedProposalForModal] = useState<FlyingProposal | null>(null);
  const [printManifestProposal, setPrintManifestProposal] = useState<FlyingProposal | null>(null);
  const [finishSuccessProposal, setFinishSuccessProposal] = useState<FlyingProposal | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Copy helper
  const handleCopyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1. ACTION: FINISH & LAUNCH FLIGHT (ফিনিশ ও ডিসপ্যাচ রিলিজ)
  const handleFinishAndDispatch = (proposal: FlyingProposal) => {
    const dispatchTime = new Date().toISOString();
    const flightDate = proposal.date || dispatchTime.split('T')[0];

    // Update proposal status to 'dispatched'
    const updatedProposals = proposals.map((p) => {
      if (p.id === proposal.id) {
        return {
          ...p,
          status: 'dispatched' as const,
          dispatched_at: dispatchTime,
        };
      }
      return p;
    });

    // Update all attached cartons to 'in_transit' with flight info
    const attachedIds = proposal.carton_ids || [];
    const updatedCartons = cartons.map((c) => {
      if (
        attachedIds.includes(c.id) ||
        (proposal.flight_number && c.flight_number === proposal.flight_number) ||
        (proposal.flying_name && c.flight_number === proposal.flying_name)
      ) {
        return {
          ...c,
          status: 'in_transit' as const,
          flying_date: flightDate,
          flight_number: proposal.flight_number || proposal.flying_name || 'BS-206',
        };
      }
      return c;
    });

    // Save to LocalStorage & Server DB
    saveHostingerDbData('fsc_vps_proposals', updatedProposals);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);

    setProposals(updatedProposals);
    setCartons(updatedCartons);

    // Trigger Finish Success Notification Modal
    setFinishSuccessProposal({
      ...proposal,
      status: 'dispatched',
      dispatched_at: dispatchTime,
    });
  };

  // Extract unique flight numbers for filter dropdown
  const uniqueFlightNumbers = useMemo(() => {
    const flights = new Set<string>();
    proposals.forEach((p) => {
      if (p.flight_number) flights.add(p.flight_number);
    });
    return Array.from(flights);
  }, [proposals]);

  // Filtered Flying List Proposals: ONLY APPROVED OR DISPATCHED PROPOSALS APPEAR HERE!
  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      // REQUIREMENT: Data ONLY appears here ONCE Operation Director / Admin APPROVES the proposal!
      const isApprovedOrDispatched =
        p.status === 'approved' ||
        p.status === 'finalized' ||
        p.status === 'dispatched' ||
        p.status === 'in_transit';

      if (!isApprovedOrDispatched) return false;

      // Search query (Flying Name, Flight No, AWB, Warehouse Name, Staff Name)
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (p.flying_name && p.flying_name.toLowerCase().includes(q)) ||
        (p.flight_number && p.flight_number.toLowerCase().includes(q)) ||
        (p.awb_number && p.awb_number.toLowerCase().includes(q)) ||
        p.warehouse_name.toLowerCase().includes(q) ||
        p.proposed_by_name.toLowerCase().includes(q);

      // Date Filter
      const matchesDate = !dateFilter || p.date === dateFilter;

      // Origin Warehouse Filter
      const matchesOrigin =
        originFilter === 'all' ||
        p.warehouse_id === originFilter ||
        (p.warehouse_name && p.warehouse_name.toLowerCase().includes(originFilter.toLowerCase())) ||
        (originFilter === 'wh-china' && (p.warehouse_id === 'wh-china' || p.warehouse_id === 'wh-gz' || (p.warehouse_name && (p.warehouse_name.toLowerCase().includes('guangzhou') || p.warehouse_name.toLowerCase().includes('গুয়াংজু')))));

      // Flight Number Filter
      const matchesFlight = flightNoFilter === 'all' || p.flight_number === flightNoFilter;

      // Destination Filter
      const matchesDestination =
        destinationFilter === 'all' ||
        p.destination_warehouse_id === destinationFilter ||
        !p.destination_warehouse_id;

      return matchesSearch && matchesDate && matchesOrigin && matchesFlight && matchesDestination;
    });
  }, [proposals, searchQuery, dateFilter, originFilter, flightNoFilter, destinationFilter]);

  // KPI Metrics Calculation for Approved & Dispatched Flights
  const totalFlights = filteredProposals.length;
  const totalCartons = filteredProposals.reduce((sum, p) => sum + (p.items_count || 0), 0);
  const totalWeight = filteredProposals.reduce((sum, p) => sum + (p.total_weight || 0), 0);
  const totalCbm = filteredProposals.reduce((sum, p) => sum + (p.total_cbm || 0), 0);

  // Cartons attached to the selected modal proposal
  const modalProposalCartons = useMemo(() => {
    if (!selectedProposalForModal) return [];
    const prop = selectedProposalForModal;
    const attachedIds = prop.carton_ids || [];

    const matched = cartons.filter((c) => {
      if (attachedIds.includes(c.id) || attachedIds.includes(c.ctn_no)) return true;
      if (prop.flight_number && (c.flight_number === prop.flight_number || c.flight_number === prop.flying_name)) return true;
      if (prop.flying_name && (c.flight_number === prop.flying_name || c.id.includes(prop.flying_name.replace('-', '')))) return true;
      return false;
    });

    if (matched.length > 0) return matched;
    return cartons.filter((c) => c.flight_number === 'BS-206' || c.flight_number === 'bs-02' || c.id.startsWith('ctn-bs02-'));
  }, [selectedProposalForModal, cartons]);

  // Cartons for print manifest proposal
  const printProposalCartons = useMemo(() => {
    if (!printManifestProposal) return [];
    const prop = printManifestProposal;
    const attachedIds = prop.carton_ids || [];

    const matched = cartons.filter((c) => {
      if (attachedIds.includes(c.id) || attachedIds.includes(c.ctn_no)) return true;
      if (prop.flight_number && (c.flight_number === prop.flight_number || c.flight_number === prop.flying_name)) return true;
      if (prop.flying_name && (c.flight_number === prop.flying_name || c.id.includes(prop.flying_name.replace('-', '')))) return true;
      return false;
    });

    if (matched.length > 0) return matched;
    return cartons.filter((c) => c.flight_number === 'BS-206' || c.flight_number === 'bs-02' || c.id.startsWith('ctn-bs02-'));
  }, [printManifestProposal, cartons]);

  return (
    <div className="space-y-6 font-sans text-slate-800 dark:text-slate-100 pb-12">
      {/* 1. Light Modern Header Bar (Zero Border Radius, Light Typography) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-none bg-blue-50 dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              <Plane className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-light tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
              <span>{isBn ? 'অনুমোদিত ফাইনাল ফ্লাইং লিস্ট' : 'Approved Final Flying List & Dispatch Release'}</span>
              <span className="px-2 py-0.5 rounded-none text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-normal uppercase">
                Op Approved
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-light mt-1">
            {isBn
              ? 'অপারেশন ডিরেক্টর দ্বারা অনুমোদিত ফ্লাইং লিস্টসমূহ এখান থেকে চেক করে ফিনিশ বা রিলিজ করুন। ফিনিশ করলে সকল গ্রাহকের কাছে আপডেট চলে যাবে এবং লাইভ ম্যাপে বিমান উড্ডয়ন শুরু করবে।'
              : 'Approved flight proposals appear here. Inspect & click Finish to launch flight, broadcast live status & trigger animated map radar.'}
          </p>
        </div>

        {/* Action Controls & Layout Toggle */}
        <div className="flex items-center space-x-2">
          {/* Layout View Mode Toggle */}
          <div className="flex items-center border border-slate-300 dark:border-slate-700 rounded-none bg-white dark:bg-slate-900 p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-none text-xs flex items-center space-x-1 transition-all ${
                viewMode === 'cards'
                  ? 'bg-blue-600 text-white font-normal'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-light'
              }`}
              title={isBn ? 'কার্ড ভিউ' : 'Cards View'}
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">{isBn ? 'কার্ড' : 'Cards'}</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-none text-xs flex items-center space-x-1 transition-all ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white font-normal'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-light'
              }`}
              title={isBn ? 'টেবিল ভিউ' : 'Table View'}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">{isBn ? 'টেবিল' : 'Table'}</span>
            </button>
          </div>

          {/* Quick Reset Filters Button */}
          {(dateFilter || originFilter !== 'all' || flightNoFilter !== 'all' || destinationFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setDateFilter('');
                setOriginFilter('all');
                setFlightNoFilter('all');
                setDestinationFilter('all');
                setSearchQuery('');
              }}
              className="text-xs px-3 py-1.5 rounded-none border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center space-x-1 font-light cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>{isBn ? 'রিসেট' : 'Reset'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Light Modern KPI Summary Cards (Zero Border-Radius, Light Font, Hairline Borders) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-none border transition-all ${
          isDark ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-300'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-light">{isBn ? 'অনুমোদিত ফ্লাইং ব্যাচ:' : 'Approved Flying Batches:'}</span>
            <span className="px-2 py-0.5 rounded-none text-[10px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-normal">
              Approved
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-light font-mono text-blue-600 dark:text-blue-400">{totalFlights}</span>
            <span className="text-xs text-slate-400 font-light">{isBn ? 'টি ব্যাচ' : 'batches'}</span>
          </div>
        </div>

        <div className={`p-4 rounded-none border transition-all ${
          isDark ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-300'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-light">{isBn ? 'মোট ফ্লাইং কার্টুন:' : 'Total Cartons Count:'}</span>
            <span className="px-2 py-0.5 rounded-none text-[10px] font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-normal">
              Cartons
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-light font-mono text-purple-600 dark:text-purple-400">{totalCartons}</span>
            <span className="text-xs text-slate-400 font-light">{isBn ? 'টি কার্টুন' : 'cartons'}</span>
          </div>
        </div>

        <div className={`p-4 rounded-none border transition-all ${
          isDark ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-300'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-light">{isBn ? 'মোট গ্রস ওজন:' : 'Total Gross Weight:'}</span>
            <span className="px-2 py-0.5 rounded-none text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-normal">
              Gross Weight
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-light font-mono text-emerald-600 dark:text-emerald-400">{totalWeight.toFixed(1)}</span>
            <span className="text-xs text-slate-400 font-light">kg</span>
          </div>
        </div>

        <div className={`p-4 rounded-none border transition-all ${
          isDark ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-300'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-light">{isBn ? 'মোট সিবিএম (CBM):' : 'Total Volume:'}</span>
            <span className="px-2 py-0.5 rounded-none text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-normal">
              Volume
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-light font-mono text-amber-600 dark:text-amber-400">{totalCbm.toFixed(2)}</span>
            <span className="text-xs text-slate-400 font-light">CBM</span>
          </div>
        </div>
      </div>

      {/* 3. Smart Multi-Filter Control Bar (Zero Border-Radius, Light Font) */}
      <div className={`p-4 rounded-none border space-y-3 ${isDark ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-300'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-normal text-slate-700 dark:text-slate-300">
            <Filter className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{isBn ? 'ফ্লাইং লিস্ট সার্চ ও ফিল্টারিং ফিল্ডসমূহ:' : 'Flying List Filter Controls:'}</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 font-light">
            Showing {filteredProposals.length} approved lists
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Date Filter */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-light text-slate-500 dark:text-slate-400 flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span>{isBn ? 'তারিখ (Date):' : 'Date:'}</span>
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className={`border rounded-none px-2.5 py-1.5 text-xs outline-none font-light transition-all focus:border-blue-500 ${
                isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          {/* Country / Origin Warehouse Filter */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-light text-slate-500 dark:text-slate-400 flex items-center space-x-1">
              <Building2 className="w-3 h-3" />
              <span>{isBn ? 'অরিজিন হাব:' : 'Origin Hub:'}</span>
            </label>
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className={`border rounded-none px-2.5 py-1.5 text-xs outline-none font-light cursor-pointer transition-all focus:border-blue-500 ${
                isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="all">{isBn ? 'সকল অরিজিন হাব' : 'All Origin Hubs'}</option>
              {warehouses
                .filter((w) => !w.is_final_destination)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Flight Number Filter */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-light text-slate-500 dark:text-slate-400 flex items-center space-x-1">
              <Plane className="w-3 h-3" />
              <span>{isBn ? 'ফ্লাইট নম্বর:' : 'Flight Number:'}</span>
            </label>
            <select
              value={flightNoFilter}
              onChange={(e) => setFlightNoFilter(e.target.value)}
              className={`border rounded-none px-2.5 py-1.5 text-xs outline-none font-light cursor-pointer transition-all focus:border-blue-500 ${
                isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="all">{isBn ? 'সকল ফ্লাইট নম্বর' : 'All Flight Numbers'}</option>
              {uniqueFlightNumbers.map((fl) => (
                <option key={fl} value={fl}>
                  {fl}
                </option>
              ))}
            </select>
          </div>

          {/* Destination Filter */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-light text-slate-500 dark:text-slate-400 flex items-center space-x-1">
              <Layers className="w-3 h-3" />
              <span>{isBn ? 'ডেস্টিনেশন:' : 'Destination:'}</span>
            </label>
            <select
              value={destinationFilter}
              onChange={(e) => setDestinationFilter(e.target.value)}
              className={`border rounded-none px-2.5 py-1.5 text-xs outline-none font-light cursor-pointer transition-all focus:border-blue-500 ${
                isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="all">{isBn ? 'সকল ডেস্টিনেশন' : 'All Destinations'}</option>
              <option value="wh-bd">ঢাকা সেন্ট্রাল (Bangladesh 🇧🇩)</option>
            </select>
          </div>

          {/* Search Bar */}
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-light text-slate-500 dark:text-slate-400 flex items-center space-x-1">
              <Search className="w-3 h-3" />
              <span>{isBn ? 'খুঁজুন (Search):' : 'Search Flying / AWB:'}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder={isBn ? 'ফ্লাইং নাম, ফ্লাইট বা AWB...' : 'Flying Name, Flight, AWB...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full border rounded-none py-1.5 pl-8 pr-3 text-xs outline-none font-light transition-all focus:border-blue-500 ${
                  isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
              <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Main Section: Cards View OR Table Grid View */}
      {filteredProposals.length === 0 ? (
        <div className={`p-12 text-center rounded-none border ${isDark ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-300'}`}>
          <Plane className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-normal text-slate-700 dark:text-slate-300">
            {isBn ? 'কোন অনুমোদিত ফাইনাল ফ্লাইং লিস্ট পাওয়া যায়নি' : 'No Approved Flying List Found'}
          </h3>
          <p className="text-xs text-slate-400 font-light mt-1 max-w-md mx-auto">
            {isBn
              ? 'অপারেশন ডিরেক্টর থেকে প্রোপোজাল অনুমোদন (Approve) পাওয়ার পর ডাটা এখানে সয়ংক্রিয়ভাবে ভেসে উঠবে।'
              : 'Flight proposals will automatically appear here once approved by the Operations Director.'}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* CARDS VIEW MODE */
        <div className="space-y-4">
          {filteredProposals.map((prop) => {
            const isDispatched = prop.status === 'dispatched' || prop.status === 'in_transit';

            return (
              <div
                key={prop.id}
                className={`p-5 rounded-none border transition-all space-y-4 ${
                  isDispatched
                    ? (isDark ? 'bg-[#0F172A] border-emerald-800/60' : 'bg-white border-emerald-300')
                    : (isDark ? 'bg-[#0F172A] border-blue-800/60' : 'bg-white border-blue-300')
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <h3 className="text-sm font-normal text-slate-900 dark:text-white">
                        {prop.flying_name || `${prop.warehouse_name} Flight Batch #${prop.flight_number || '101'}`}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-light">
                      <span className="flex items-center space-x-1">
                        <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                        <span>{isBn ? 'ইনচার্জ: ' : 'Staff: '}{prop.proposed_by_name}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-purple-500" />
                        <span>{prop.date}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isDispatched ? (
                      <span className="px-3 py-1 rounded-none text-xs font-mono font-normal uppercase tracking-wide bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        ✈️ DISPATCHED & FLYING MID-AIR
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-none text-xs font-mono font-normal uppercase tracking-wide bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        ✅ APPROVED — READY FOR LAUNCH
                      </span>
                    )}
                  </div>
                </div>

                {/* Grid Specifications Body */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs font-light">
                  <div className={`p-2.5 rounded-none border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-light">{isBn ? 'অরিজিন হাব' : 'Origin Hub'}</span>
                    <span className="font-normal text-slate-900 dark:text-slate-200 block truncate" title={prop.warehouse_name}>
                      {prop.warehouse_name}
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-none border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-light">{isBn ? 'ডেস্টিনেশন' : 'Destination'}</span>
                    <span className="font-normal text-emerald-600 dark:text-emerald-400 block truncate">
                      {prop.destination_warehouse_name || 'ঢাকা সেন্ট্রাল (BD)'}
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-none border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-light">{isBn ? 'ফ্লাইট নম্বর' : 'Flight No'}</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 block font-normal">
                      {prop.flight_number || 'N/A'}
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-none border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-light">{isBn ? 'এয়ারওয়ে বিল (AWB)' : 'AWB Number'}</span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-800 dark:text-slate-200 block font-normal truncate">
                        {prop.awb_number || '157-889120'}
                      </span>
                      <button
                        onClick={() => handleCopyCode(prop.awb_number || '157-889120', prop.id)}
                        className="text-slate-400 hover:text-blue-600 p-0.5 transition-colors cursor-pointer"
                        title="Copy AWB"
                      >
                        {copiedId === prop.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-none border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-light">{isBn ? 'মোট ওজন (KG)' : 'Total Weight'}</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 block font-normal">
                      {prop.total_weight} kg
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-none border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-light">{isBn ? 'মোট ভলিউম' : 'Total Volume'}</span>
                    <span className="font-mono text-purple-600 dark:text-purple-400 block font-normal">
                      {prop.total_cbm?.toFixed(2)} CBM
                    </span>
                  </div>
                </div>

                {/* Action Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="flex items-center space-x-2 text-xs font-light text-slate-500 dark:text-slate-400">
                    <Package className="w-4 h-4 text-purple-600" />
                    <span>{prop.items_count} {isBn ? 'টি কার্টুন সংযুক্ত' : 'Cartons Attached'}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setPrintManifestProposal(prop)}
                      className="px-3 py-1.5 rounded-none bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-light transition-colors flex items-center space-x-1.5 border border-slate-300 dark:border-slate-700 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>{isBn ? 'ম্যানিফেস্ট প্রিন্ট' : 'Print Manifest'}</span>
                    </button>

                    <button
                      onClick={() => setSelectedProposalForModal(prop)}
                      className="px-3.5 py-1.5 rounded-none bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 text-xs font-normal transition-colors flex items-center space-x-1.5 border border-blue-200 dark:border-blue-800 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isBn ? 'কার্টুন তালিকা দেখুন' : 'Inspect Cartons'}</span>
                    </button>

                    {/* FINISH & LAUNCH FLIGHT ACTION BUTTON */}
                    {!isDispatched ? (
                      <button
                        onClick={() => handleFinishAndDispatch(prop)}
                        className="px-4 py-1.5 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-normal transition-all flex items-center space-x-1.5 border border-emerald-600 cursor-pointer shadow-sm animate-pulse"
                        title={isBn ? 'ফ্লাইট রিলিজ ও ফিনিশ করুন' : 'Finish & Dispatch Flight'}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isBn ? '🚀 ফিনিশ ও ডেসপ্যাচ করুন' : 'Finish & Launch Flight'}</span>
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 rounded-none bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-normal border border-emerald-500/20 inline-flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{isBn ? 'ফিনিশড' : 'Finished'}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* COMPACT TABLE GRID VIEW MODE */
        <div className={`p-4 rounded-none border ${isDark ? 'bg-[#0F172A] border-slate-800' : 'bg-white border-slate-300'}`}>
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-none">
            <table className="w-full text-left text-xs font-light">
              <thead className={`uppercase text-[10px] tracking-wider border-b sticky top-0 ${
                isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                <tr>
                  <th className="p-3 font-normal">SL</th>
                  <th className="p-3 font-normal">DATE</th>
                  <th className="p-3 font-normal">FLYING BATCH NAME</th>
                  <th className="p-3 font-normal">FLIGHT NO</th>
                  <th className="p-3 font-normal">AWB NO</th>
                  <th className="p-3 font-normal">ORIGIN</th>
                  <th className="p-3 font-normal">DESTINATION</th>
                  <th className="p-3 text-center font-normal">CARTONS</th>
                  <th className="p-3 text-center font-normal">KG</th>
                  <th className="p-3 text-center font-normal">STATUS</th>
                  <th className="p-3 text-right font-normal">ACTIONS</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-200 text-slate-700'}`}>
                {filteredProposals.map((prop, idx) => {
                  const isDispatched = prop.status === 'dispatched' || prop.status === 'in_transit';

                  return (
                    <tr key={prop.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono whitespace-nowrap">{prop.date}</td>
                      <td className="p-3 font-normal font-mono text-slate-900 dark:text-white max-w-[180px] truncate">
                        {prop.flying_name || `Batch #${prop.flight_number}`}
                      </td>
                      <td className="p-3 font-mono text-blue-600 dark:text-blue-400 font-normal">{prop.flight_number || 'BS-206'}</td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{prop.awb_number || '157-889120'}</td>
                      <td className="p-3 font-normal text-slate-800 dark:text-slate-200">{prop.warehouse_name}</td>
                      <td className="p-3 font-normal text-emerald-600 dark:text-emerald-400">{prop.destination_warehouse_name || 'ঢাকা সেন্ট্রাল (BD)'}</td>
                      <td className="p-3 text-center font-mono font-normal">{prop.items_count}</td>
                      <td className="p-3 text-center font-mono text-emerald-600 dark:text-emerald-400 font-normal">{prop.total_weight} kg</td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {isDispatched ? (
                          <span className="px-2 py-0.5 rounded-none text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            ✈️ DISPATCHED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-none text-[9px] font-mono uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            ✅ APPROVED
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => setPrintManifestProposal(prop)}
                            className="p-1.5 rounded-none border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Print Manifest"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setSelectedProposalForModal(prop)}
                            className="px-2 py-1 rounded-none bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 text-[11px] font-normal hover:bg-blue-100 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                          >
                            Inspect
                          </button>
                          {!isDispatched && (
                            <button
                              onClick={() => handleFinishAndDispatch(prop)}
                              className="px-2.5 py-1 rounded-none bg-emerald-600 text-white text-[11px] font-normal hover:bg-emerald-700 transition-colors cursor-pointer border border-emerald-600"
                            >
                              🚀 Finish
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. FINISH & LAUNCH SUCCESS NOTIFICATION MODAL */}
      {finishSuccessProposal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-sans animate-backdrop-blur-fade">
          <div className="bg-white dark:bg-[#0F172A] text-slate-900 dark:text-white rounded-none max-w-lg w-full p-6 space-y-5 border border-emerald-500/50 shadow-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-none bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-normal text-slate-900 dark:text-white flex items-center space-x-2">
                  <span>{isBn ? '🚀 ফ্লাইট ফিনিশ ও ডেসপ্যাচ সফল!' : 'Flight Released & Dispatched Successfully!'}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-light">
                  Batch: <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-normal">{finishSuccessProposal.flying_name || finishSuccessProposal.flight_number}</strong>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-none bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-light text-slate-700 dark:text-slate-300">
              <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-normal">
                <Sparkles className="w-4 h-4" />
                <span>{isBn ? 'সকল সিস্টেম সিঙ্ক আপডেট কার্যকর হয়েছে:' : 'System-wide Sync Updates Applied:'}</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-[11px] pl-1 font-light">
                <li>{isBn ? 'সকল সংযুক্ত কার্টুনের স্ট্যাটাস "In-Transit Flying" এ রূপান্তরিত হয়েছে।' : 'All attached cartons status set to In-Transit Flying.'}</li>
                <li>{isBn ? 'কাস্টমার ট্র্যাকিং ও সুপার এডমিন ড্যাশবোর্ডে লাইভ স্ট্যাটাস আপডেট পাঠানো হয়েছে।' : 'Broadcasted live status update to customer tracker & admin dashboards.'}</li>
                <li>{isBn ? 'ইন্টারেক্টিভ রডার ম্যাপে গুয়াংজু (চীন) থেকে ঢাকা অভিমুখে বিমান চলাচল শুরু করেছে।' : 'Interactive map radar has launched airplane flight trajectory to Dhaka.'}</li>
              </ul>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setFinishSuccessProposal(null)}
                className="w-full sm:w-auto px-6 py-2 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-normal transition-all border border-emerald-600 cursor-pointer"
              >
                {isBn ? 'ঠিক আছে (Got it)' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. SUB-MODAL: CARTONS INSPECTOR FOR FLYING BATCH */}
      {selectedProposalForModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 font-sans">
          <div
            className={`w-full max-w-6xl max-h-[92vh] rounded-none p-5 overflow-hidden flex flex-col border shadow-2xl ${
              isDark ? 'bg-[#0F172A] text-white border-slate-800' : 'bg-white text-slate-900 border-slate-300'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-normal text-slate-900 dark:text-white flex items-center space-x-2">
                  <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{selectedProposalForModal.flying_name || `${selectedProposalForModal.warehouse_name} Batch`}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-light mt-1">
                  Flight: <span className="font-mono text-blue-600 dark:text-blue-400 font-normal">{selectedProposalForModal.flight_number}</span> | AWB: <span className="font-mono">{selectedProposalForModal.awb_number || '157-889120'}</span> | Staff: <span className="font-normal">{selectedProposalForModal.proposed_by_name}</span>
                </p>
              </div>

              <button
                onClick={() => setSelectedProposalForModal(null)}
                className="p-1.5 rounded-none border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content Table */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              <div className="overflow-x-auto rounded-none border border-slate-200 dark:border-slate-800">
                {/* Yellow Banner Row 1: Date, LOT No, AWB No */}
                <div className="bg-amber-400 text-slate-950 px-4 py-2 text-xs font-mono font-normal flex flex-wrap items-center justify-between gap-2 border-b border-amber-500">
                  <div className="flex items-center space-x-4">
                    <span>Date: <strong className="font-normal">{selectedProposalForModal.date || '8 AUG 26'}</strong></span>
                    <span>LOT: <strong className="font-normal">LOT-115</strong></span>
                  </div>
                  <div>
                    <span>AWB: <strong className="font-normal">{selectedProposalForModal.awb_number || '157-889120'}</strong></span>
                  </div>
                </div>

                {/* Blue Banner Row 2: Cargo Hub & Total Weight */}
                <div className="bg-blue-600 text-white px-4 py-2 text-xs font-mono font-normal flex flex-wrap items-center justify-between gap-2 border-b border-blue-700">
                  <div>
                    <span>FOUR STAR CARGO ({selectedProposalForModal.warehouse_name?.toUpperCase() || 'GUANGZHOU CHINA'})</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span>TOTAL WT: <strong className="font-normal">{selectedProposalForModal.total_weight || 0} KG</strong></span>
                    <span>TOTAL CBM: <strong className="font-normal">{selectedProposalForModal.total_cbm?.toFixed(2) || '0.00'} CBM</strong></span>
                  </div>
                </div>

                <table className="w-full text-left text-xs whitespace-nowrap border-collapse border border-slate-200 dark:border-slate-800 font-light">
                  <thead className={`uppercase text-[10px] tracking-wider ${isDark ? 'bg-slate-950 text-slate-400' : 'bg-slate-100 text-slate-700 font-normal'}`}>
                    <tr>
                      <th className="p-2.5 border border-slate-200 dark:border-slate-800">SL</th>
                      <th className="p-2.5 border border-slate-200 dark:border-slate-800">ENTRY DATE</th>
                      <th className="p-2.5 border border-slate-200 dark:border-slate-800">CTN NO</th>
                      <th className="p-2.5 border border-slate-200 dark:border-slate-800">SHIPPING MARK</th>
                      <th className="p-2.5 border border-slate-200 dark:border-slate-800">PRODUCT NAME</th>
                      <th className="p-2.5 border border-slate-200 dark:border-slate-800">QTY / N.WT</th>
                      <th className="p-2.5 border border-slate-200 dark:border-slate-800">G.WEIGHT</th>
                      <th className="p-2.5 border border-slate-200 dark:border-slate-800">CBM</th>
                      <th className="p-2.5 border border-slate-200 dark:border-slate-800">TRACKING NO</th>
                      <th className="p-2.5 border border-slate-200 dark:border-slate-800">PROOF</th>
                      <th className="p-2.5 border border-slate-200 dark:border-slate-800">DESTINATION</th>
                      <th className="p-2.5 border border-slate-200 dark:border-slate-800">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className={isDark ? 'text-slate-200' : 'text-slate-800'}>
                    {modalProposalCartons.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="p-8 text-center text-slate-400 border border-slate-200 dark:border-slate-800 font-light">
                          {isBn ? 'এই ফ্লাইটের অধীনে কোনো কার্টুন লিস্ট পাওয়া যায়নি।' : 'No cartons found attached to this flying batch.'}
                        </td>
                      </tr>
                    ) : (
                      modalProposalCartons.map((c, idx) => (
                        <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                          <td className="p-2.5 font-mono text-slate-400 border border-slate-200 dark:border-slate-800 text-center">{idx + 1}</td>
                          <td className="p-2.5 font-mono text-slate-500 border border-slate-200 dark:border-slate-800">{c.created_at ? c.created_at.split('T')[0] : '2026-08-15'}</td>
                          <td className="p-2.5 font-mono text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800">
                            <span className="px-2 py-0.5 rounded-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                              {c.ctn_no}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono font-normal text-purple-600 dark:text-purple-400 border border-slate-200 dark:border-slate-800">{c.shipping_mark || 'N/A'}</td>
                          <td className="p-2.5 font-normal border border-slate-200 dark:border-slate-800 max-w-[200px] truncate">{c.product_name_en}</td>
                          <td className="p-2.5 font-mono text-center border border-slate-200 dark:border-slate-800">{c.quantity || 1} pcs | {c.net_weight || 0} kg</td>
                          <td className="p-2.5 font-mono text-emerald-600 dark:text-emerald-400 font-normal border border-slate-200 dark:border-slate-800 text-center">{c.gross_weight} kg</td>
                          <td className="p-2.5 font-mono text-purple-600 dark:text-purple-400 font-normal border border-slate-200 dark:border-slate-800 text-center">{c.cbm} CBM</td>
                          <td className="p-2.5 font-mono text-slate-500 border border-slate-200 dark:border-slate-800">{c.tracking_number}</td>
                          
                          {/* Photo Proof Cell */}
                          <td className="p-2.5 border border-slate-200 dark:border-slate-800 text-center">
                            {c.photo_url || (c.photo_proofs && c.photo_proofs.length > 0) ? (
                              <button
                                type="button"
                                onClick={() => setPreviewPhotoUrl(c.photo_url || (c.photo_proofs ? c.photo_proofs[0] : null))}
                                className="px-2 py-0.5 rounded-none bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-mono text-[10px] border border-blue-200 dark:border-blue-800 cursor-pointer"
                              >
                                📷 Photo
                              </button>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">-</span>
                            )}
                          </td>

                          <td className="p-2.5 font-normal text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-800">{c.destination_warehouse_name || 'ঢাকা সেন্ট্রাল (BD)'}</td>
                          <td className="p-2.5 text-center border border-slate-200 dark:border-slate-800">
                            <span className="px-2 py-0.5 rounded-none text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              ✈️ FLYING
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t pt-3 border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedProposalForModal(null)}
                className="px-5 py-2 rounded-none bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-light transition-colors border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. PRINT MANIFEST PREVIEW MODAL */}
      {printManifestProposal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 font-sans">
          <div className="bg-white text-slate-900 rounded-none w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6 border border-slate-300 shadow-2xl">
            {/* Print Controls Header (Hidden during browser print) */}
            <div className="flex items-center justify-between border-b pb-4 border-slate-200 print:hidden">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-normal text-slate-900">
                  {isBn ? 'ফ্লাইট ম্যানিফেস্ট প্রিন্ট প্রিভিউ' : 'Flight Manifest Print Preview'}
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-none bg-blue-600 hover:bg-blue-700 text-white text-xs font-normal transition-colors flex items-center space-x-2 cursor-pointer border border-blue-600"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isBn ? 'প্রিন্ট করুন (Print)' : 'Print Manifest'}</span>
                </button>
                <button
                  onClick={() => setPrintManifestProposal(null)}
                  className="px-4 py-2 rounded-none border border-slate-300 hover:bg-slate-100 text-slate-600 text-xs font-light transition-colors cursor-pointer"
                >
                  {isBn ? 'বন্ধ করুন' : 'Close'}
                </button>
              </div>
            </div>

            {/* PRINTABLE MANIFEST DOCUMENT */}
            <div className="space-y-6">
              {/* Header Letterhead */}
              <div className="text-center border-b pb-4 border-slate-300 space-y-1">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                  M/S FOUR STAR CARGO & LOGISTICS
                </h1>
                <p className="text-xs font-mono text-slate-600">
                  INTERNATIONAL AIR CARGO DISPATCH MANIFEST
                </p>
                <p className="text-[11px] text-slate-500 font-light">
                  Origin Hub: {printManifestProposal.warehouse_name} | Destination: {printManifestProposal.destination_warehouse_name || 'Dhaka Central Hub'}
                </p>
              </div>

              {/* Manifest Info Table */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono border border-slate-300 p-3 bg-slate-50">
                <div>
                  <span className="text-slate-500 text-[10px] block">FLIGHT NO:</span>
                  <span className="font-bold text-blue-700">{printManifestProposal.flight_number || 'BS-206'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">MASTER AWB:</span>
                  <span className="font-bold text-slate-900">{printManifestProposal.awb_number || '157-889120'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">DISPATCH DATE:</span>
                  <span className="font-bold text-slate-900">{printManifestProposal.date}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">DISPATCHED BY:</span>
                  <span className="font-bold text-slate-900">{printManifestProposal.proposed_by_name}</span>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="flex items-center justify-between border-y border-slate-300 py-2 text-xs font-mono font-normal">
                <span>TOTAL CARTONS: <strong>{printManifestProposal.items_count} CTNs</strong></span>
                <span>TOTAL GROSS WEIGHT: <strong>{printManifestProposal.total_weight} KG</strong></span>
                <span>TOTAL CBM: <strong>{printManifestProposal.total_cbm?.toFixed(2)} CBM</strong></span>
              </div>

              {/* Cartons Breakdown Table */}
              <table className="w-full text-left text-xs border-collapse border border-slate-300 font-light">
                <thead className="bg-slate-100 text-slate-800 uppercase text-[10px] font-normal border-b border-slate-300">
                  <tr>
                    <th className="p-2 border border-slate-300">SL</th>
                    <th className="p-2 border border-slate-300">CTN NO</th>
                    <th className="p-2 border border-slate-300">SHIPPING MARK</th>
                    <th className="p-2 border border-slate-300">TRACKING NO</th>
                    <th className="p-2 border border-slate-300">PRODUCT NAME</th>
                    <th className="p-2 text-center border border-slate-300">QTY</th>
                    <th className="p-2 text-center border border-slate-300">G.WEIGHT</th>
                    <th className="p-2 text-center border border-slate-300">CBM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {printProposalCartons.map((c, idx) => (
                    <tr key={c.id}>
                      <td className="p-2 border border-slate-300 font-mono text-center">{idx + 1}</td>
                      <td className="p-2 border border-slate-300 font-mono font-normal">{c.ctn_no}</td>
                      <td className="p-2 border border-slate-300 font-mono">{c.shipping_mark || 'N/A'}</td>
                      <td className="p-2 border border-slate-300 font-mono">{c.tracking_number}</td>
                      <td className="p-2 border border-slate-300">{c.product_name_en}</td>
                      <td className="p-2 border border-slate-300 font-mono text-center">{c.quantity || 1} pcs</td>
                      <td className="p-2 border border-slate-300 font-mono text-center font-normal">{c.gross_weight} kg</td>
                      <td className="p-2 border border-slate-300 font-mono text-center font-normal">{c.cbm} CBM</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Footer Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-12 text-xs font-light text-slate-600">
                <div className="border-t border-slate-400 pt-2 text-center">
                  <p>Prepared By: {printManifestProposal.proposed_by_name}</p>
                  <p className="text-[10px] text-slate-400">Warehouse Incharge Signature</p>
                </div>
                <div className="border-t border-slate-400 pt-2 text-center">
                  <p>Approved By: Operations Director</p>
                  <p className="text-[10px] text-slate-400">Air Cargo Authorization Stamp</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. PROOF PHOTO MODAL */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white dark:bg-slate-900 rounded-none max-w-xl w-full p-5 space-y-4 border border-slate-300 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-normal text-slate-900 dark:text-white flex items-center space-x-2">
                <span>📸 প্যাকেজিং স্লিপ ও প্রোডাক্ট প্রমাণ ছবি</span>
              </h3>
              <button
                onClick={() => setPreviewPhotoUrl(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto flex items-center justify-center bg-slate-950 rounded-none p-2 border border-slate-800">
              <img
                src={previewPhotoUrl}
                alt="Parcel Proof Slip"
                className="max-h-[55vh] object-contain rounded-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewPhotoUrl(null)}
                className="px-4 py-2 rounded-none bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-light border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
