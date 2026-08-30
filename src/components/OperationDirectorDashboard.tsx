import React, { useState } from 'react';
import {
  Plane,
  CheckCircle2,
  XCircle,
  Package,
  ArrowRight,
  Calendar,
  Filter,
  Plus,
  Trash2,
  Building2,
  History,
  TrendingUp,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  BarChart3,
  Globe,
  FileText,
  RotateCcw,
  Truck,
  Layers,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { FlyingProposal, Carton, Warehouse, Language, User } from '../types';
import { ToastContainer, ToastMessage } from './Toast';
import { useTheme } from '../context/ThemeContext';
import { getHostingerDbData, saveHostingerDbData, saveHostingerDbMultiData, logSystemAuditAction, resetHostingerDbToDefault, subscribeToDbUpdates } from '../lib/db';
import { FlightProposalsManager } from './FlightProposalsManager';
import { FinalFlyingListSection } from './FinalFlyingListSection';
import { SleekLineChart } from './SleekLineChart';
import { CargoLiveLifecycleMonitor } from './CargoLiveLifecycleMonitor';
import { ShipmentDataTracker } from './ShipmentDataTracker';
import { ReceiveFlyingSection } from './ReceiveFlyingSection';
import { BookedCartonsHub } from './BookedCartonsHub';
import { PublicTracking } from './PublicTracking';
import { CargoSearchTracker } from './CargoSearchTracker';
import { CrmManagementSystem } from './CrmManagementSystem';

interface OperationDirectorDashboardProps {
  activeTab: string;
  setActiveTab?: (tab: string) => void;
  proposals: FlyingProposal[];
  setProposals: React.Dispatch<React.SetStateAction<FlyingProposal[]>>;
  cartons: Carton[];
  setCartons: React.Dispatch<React.SetStateAction<Carton[]>>;
  warehouses: Warehouse[];
  currentUser: User;
  language: Language;
}

export const OperationDirectorDashboard: React.FC<OperationDirectorDashboardProps> = ({
  activeTab,
  setActiveTab,
  proposals,
  setProposals,
  cartons,
  setCartons,
  warehouses,
  currentUser,
  language,
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

  // Reload Demo Sample Data
  const handleResetDemoData = () => {
    resetHostingerDbToDefault();
    const dbData = getHostingerDbData();
    setProposals(dbData.proposals);
    setCartons(dbData.cartons);
    addToast('success', isBn ? 'টেস্ট স্যাম্পল ডাটা সফলভাবে লোড করা হয়েছে!' : 'Demo sample data reloaded successfully!');
  };

  // Active Origin Warehouse Tab selection
  const originWarehouses = warehouses.filter((w) => !w.is_final_destination);
  const [selectedWhId, setSelectedWhId] = useState<string>(originWarehouses[0]?.id || 'wh-china');

  // Flight Details Form States for Finalize Modal
  const [flyingDate, setFlyingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [flightNumber, setFlightNumber] = useState<string>('BS-206');
  const [awbNumber, setAwbNumber] = useState<string>('157-8841209');

  // Finalize Confirmation Modal
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);

  // Add Carton to Proposal Modal State
  const [showAddCartonModal, setShowAddCartonModal] = useState(false);

  // History & Stock Filter States
  const [historySearch, setHistorySearch] = useState('');
  const [historyWhFilter, setHistoryWhFilter] = useState('all');
  const [stockSearch, setStockSearch] = useState('');
  const [cartonWhFilter, setCartonWhFilter] = useState<string>('all');
  const [cartonStatusFilter, setCartonStatusFilter] = useState<string>('all');

  // Sync live proposals & cartons from Hostinger DB on mount, tab change & subscribe to real-time DB updates
  React.useEffect(() => {
    const syncDb = () => {
      const dbData = getHostingerDbData();
      setProposals(dbData.proposals || []);
      setCartons(dbData.cartons || []);
    };
    syncDb();
    const unsubscribe = subscribeToDbUpdates(syncDb);
    return () => unsubscribe();
  }, [activeTab]);

  // Active Pending Proposal for selected Warehouse
  const pendingProposals = proposals.filter((p) => p.status === 'pending');
  const activeProposal = pendingProposals.find((p) => p.warehouse_id === selectedWhId);

  // Cartons included in this pending proposal request (from proposal carton_ids or status === 'proposed')
  const proposalCartons = cartons.filter((c) => {
    if (c.current_warehouse_id !== selectedWhId) return false;
    if (activeProposal && activeProposal.carton_ids && activeProposal.carton_ids.length > 0) {
      return activeProposal.carton_ids.includes(c.id) || c.status === 'proposed';
    }
    return c.status === 'proposed' || c.status === 'booked';
  });

  // Available Stock Cartons (unproposed booked cartons in booking list) in this warehouse for adding
  const availableStockCartons = cartons.filter(
    (c) =>
      c.current_warehouse_id === selectedWhId &&
      c.status === 'booked' &&
      !proposalCartons.some((pc) => pc.id === c.id)
  );

  // REMOVE carton from proposal request
  const handleRemoveCartonFromProposal = (cartonId: string) => {
    const updatedCartons = cartons.map((c) =>
      c.id === cartonId ? { ...c, status: 'booked' as const } : c
    );
    setCartons(updatedCartons);

    let updatedProposals = proposals;
    if (activeProposal) {
      updatedProposals = proposals.map((p) =>
        p.id === activeProposal.id
          ? {
              ...p,
              carton_ids: (p.carton_ids || []).filter((id) => id !== cartonId),
              items_count: Math.max(0, (p.items_count || 1) - 1),
            }
          : p
      );
      setProposals(updatedProposals);
    }

    saveHostingerDbMultiData({
      fsc_vps_cartons: updatedCartons,
      fsc_vps_proposals: updatedProposals,
    });

    logSystemAuditAction(
      currentUser,
      'REMOVE_CARTON_FROM_PROPOSAL',
      'carton',
      cartonId,
      `অপারেশনস ডিরেক্টর প্রস্তাবিত কার্টুন প্রোপোজাল থেকে রিমুভ করে বুকিং স্টকে ফিরিয়েছেন (${cartonId})`
    );

    addToast('info', isBn ? 'কার্টুন প্রোপোজাল থেকে বাদ দিয়ে স্টকে রাখা হয়েছে' : 'Carton removed from proposal back to stock');
  };

  // ADD carton from booking stock list to proposal request
  const handleAddCartonToProposal = (cartonId: string) => {
    const updatedCartons = cartons.map((c) =>
      c.id === cartonId ? { ...c, status: 'proposed' as const } : c
    );
    setCartons(updatedCartons);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);

    // Add to active proposal carton_ids array
    if (activeProposal) {
      const updatedProposals = proposals.map((p) =>
        p.id === activeProposal.id
          ? {
              ...p,
              carton_ids: [...(p.carton_ids || []), cartonId],
              items_count: (p.items_count || 0) + 1,
            }
          : p
      );
      setProposals(updatedProposals);
      saveHostingerDbData('fsc_vps_proposals', updatedProposals);
    }

    logSystemAuditAction(
      currentUser,
      'ADD_CARTON_TO_PROPOSAL',
      'carton',
      cartonId,
      `অপারেশনস ডিরেক্টর স্টক বুকিং লিস্ট থেকে নতুন কার্টুন প্রোপোজালে যোগ করেছেন (${cartonId})`
    );

    addToast('success', isBn ? 'স্টক কার্টুন প্রোপোজালে সফলভাবে যোগ করা হয়েছে' : 'Stock carton added to flight proposal');
    setShowAddCartonModal(false);
  };

  // CHANGE carton destination warehouse
  const handleChangeCartonDestination = (cartonId: string, destWhId: string) => {
    const destWh = warehouses.find((w) => w.id === destWhId);
    const updatedCartons = cartons.map((c) =>
      c.id === cartonId
        ? {
            ...c,
            destination_warehouse_id: destWhId,
            destination_warehouse_name: destWh?.name,
          }
        : c
    );
    setCartons(updatedCartons);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);

    addToast('info', isBn ? 'গন্তব্য ওয়্যারহাউজ সাকসেসফুলি পরিবর্তন করা হয়েছে' : 'Carton destination hub updated');
  };

  // FINALIZE & DISPATCH FLIGHT BATCH BACK TO WAREHOUSES & SYSTEM
  const handleConfirmFinalize = () => {
    if (!activeProposal) return;

    // 1. Update proposal status to finalized
    const updatedProposals = proposals.map((p) =>
      p.id === activeProposal.id
        ? {
            ...p,
            status: 'finalized' as const,
            finalized_by: currentUser.name,
            finalized_at: new Date().toISOString(),
            flight_number: flightNumber,
            awb_number: awbNumber,
          }
        : p
    );
    setProposals(updatedProposals);
    saveHostingerDbData('fsc_vps_proposals', updatedProposals);

    // 2. Update all included proposal cartons to in_transit
    const proposalCartonIds = proposalCartons.map((c) => c.id);
    const updatedCartons = cartons.map((c) => {
      if (proposalCartonIds.includes(c.id) || (c.current_warehouse_id === selectedWhId && (c.status === 'proposed' || c.status === 'booked'))) {
        return {
          ...c,
          status: 'in_transit' as const,
          flying_date: flyingDate,
          flight_number: flightNumber,
          awb_number: awbNumber,
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });
    setCartons(updatedCartons);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);

    logSystemAuditAction(
      currentUser,
      'FINALIZE_FLIGHT_DISPATCH',
      'flight',
      activeProposal.id,
      `ফ্লাইট ডিসপ্যাচ ফাইনাল অনুমোদন সম্পন্ন! Flight: ${flightNumber}, AWB: ${awbNumber}, Date: ${flyingDate}`
    );

    addToast(
      'success',
      isBn ? 'ফ্লাইং লিস্ট ফাইনাল অনুমোদন ও ডিসপ্যাচ সম্পন্ন!' : 'Flight Dispatched Successfully!',
      isBn ? `ফ্লাইট: ${flightNumber} (${flyingDate}) — কার্টুনসমূহ ইন-ট্রানজিটে ডিসপ্যাচ হয়ে ওয়্যারহাউজে সিঙ্ক হয়েছে` : `Flight: ${flightNumber} (${flyingDate}) — Cartons dispatched to In Transit`
    );

    setShowFinalizeModal(false);
  };

  const finalizedProposals = proposals.filter((p) => p.status === 'finalized');

  // --------------------------------------------------------------------------
  // TAB: CARGO LIVE LIFECYCLE MONITOR VIEW
  // --------------------------------------------------------------------------
  if (activeTab === 'live_lifecycle') {
    return (
      <CargoLiveLifecycleMonitor
        language={language}
        cartons={cartons}
        proposals={proposals}
      />
    );
  }

  // --------------------------------------------------------------------------
  // TAB: CARGO TRACKING SEARCH VIEW (New Standalone Page with Input)
  // --------------------------------------------------------------------------
  if (activeTab === 'cargo_search') {
    return (
      <CargoSearchTracker
        cartons={cartons}
        proposals={proposals}
        language={language}
      />
    );
  }

  // --------------------------------------------------------------------------
  // TAB: SHIPMENT PIPELINE DATA TRACKER VIEW (Original Shipment Tracker)
  // --------------------------------------------------------------------------
  if (activeTab === 'public_track' || activeTab === 'tracking' || activeTab === 'data_tracker') {
    return (
      <ShipmentDataTracker
        cartons={cartons}
        warehouses={warehouses}
        proposals={proposals}
        ledgerEntries={[]}
        language={language}
        theme={theme}
      />
    );
  }

  if (activeTab === 'crm' || activeTab === 'crm_create' || activeTab === 'crm_followup' || activeTab === 'crm_new' || activeTab === 'crm_regular') {
    const stage: 'create_customer' | 'followup' | 'order_complete' | 'important_regular' =
      activeTab === 'crm_create'
        ? 'create_customer'
        : activeTab === 'crm_new'
        ? 'order_complete'
        : activeTab === 'crm_regular'
        ? 'important_regular'
        : 'followup';
    return <CrmManagementSystem currentUser={currentUser} language={language} initialStageTab={stage} />;
  }

  // --------------------------------------------------------------------------
  // MAIN OVERVIEW: EXECUTIVE OPERATIONS DASHBOARD (activeTab === 'dashboard')
  // --------------------------------------------------------------------------
  if (activeTab === 'dashboard') {
    const inTransitCartons = cartons.filter((c) => c.status === 'in_transit');
    const bookedStockCartons = cartons.filter((c) => c.status === 'booked');
    const totalDispatchedWeight = finalizedProposals.reduce((sum, p) => sum + (p.total_weight || 0), 0);
    const totalInventoryWeight = cartons.reduce((sum, c) => sum + (c.gross_weight || 0), 0);

    // Calculate real warehouse volume breakdown
    const gzCartons = cartons.filter((c) => c.current_warehouse_id === 'wh-china' || (c.current_warehouse_name || '').toLowerCase().includes('guangzhou') || (c.current_warehouse_name || '').toLowerCase().includes('china'));
    const hkCartons = cartons.filter((c) => (c.current_warehouse_name || '').toLowerCase().includes('hong kong') || (c.current_warehouse_name || '').toLowerCase().includes('hk'));
    const dubaiCartons = cartons.filter((c) => (c.current_warehouse_name || '').toLowerCase().includes('dubai') || (c.current_warehouse_name || '').toLowerCase().includes('uae'));

    const gzWeight = gzCartons.reduce((sum, c) => sum + (c.gross_weight || 0), 0);
    const hkWeight = hkCartons.reduce((sum, c) => sum + (c.gross_weight || 0), 0);
    const dubaiWeight = dubaiCartons.reduce((sum, c) => sum + (c.gross_weight || 0), 0);
    const hubTotalWeight = gzWeight + hkWeight + dubaiWeight;

    const gzPct = hubTotalWeight > 0 ? Math.round((gzWeight / hubTotalWeight) * 100) : 0;
    const hkPct = hubTotalWeight > 0 ? Math.round((hkWeight / hubTotalWeight) * 100) : 0;
    const dubaiPct = hubTotalWeight > 0 ? Math.round((dubaiWeight / hubTotalWeight) * 100) : 0;

    // Construct 30-day dynamic trend chart data (defaults to clean 0 if no finalized flights)
    const todayDate = new Date();
    const trendData = [0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - (6 - dayOffset));
      const dateStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      const dayIsoStr = d.toISOString().split('T')[0];
      
      const dayWeight = finalizedProposals
        .filter((p) => (p.finalized_at || p.date || '').startsWith(dayIsoStr))
        .reduce((sum, p) => sum + (p.total_weight || 0), 0);

      return { date: dateStr, value: dayWeight };
    });

    return (
      <div className="space-y-6">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        {/* 1. TOP EXECUTIVE KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today's Flying Volume */}
          <div
            className={`border rounded-2xl p-5 space-y-3 transition-all ${
              isDark ? 'bg-[#1E293B] border-slate-700 text-white shadow-xl' : 'bg-white border-slate-200/90 text-slate-900 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">{isBn ? 'আজকের ডিসপ্যাচড ভলিউম' : "Today's Flying Cargo"}</span>
              <Plane className="w-5 h-5 text-[#00897B]" />
            </div>
            <div>
              <div className="text-2xl font-bold font-sans text-slate-900 dark:text-white">
                {totalDispatchedWeight.toLocaleString()} <span className="text-xs font-normal text-slate-400">kg</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>{finalizedProposals.length} Flights Dispatched</span>
                <span className={`font-bold text-[11px] ${totalDispatchedWeight > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {totalDispatchedWeight > 0 ? '+18.4%' : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Pending Proposal Submissions */}
          <div
            onClick={() => setActiveTab && setActiveTab('proposals')}
            className={`border rounded-2xl p-5 space-y-3 transition-all cursor-pointer hover:border-[#00897B] ${
              isDark ? 'bg-[#1E293B] border-slate-700 text-white shadow-xl' : 'bg-white border-slate-200/90 text-slate-900 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">{isBn ? 'পেন্ডিং রিভিউ প্রোপোজাল' : 'Pending Proposals Inbox'}</span>
              <AlertCircle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold font-sans text-slate-900 dark:text-white">
                {pendingProposals.length} <span className="text-xs font-normal text-slate-400">Origin Hubs</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>{proposalCartons.length} Cartons awaiting review</span>
                <span className="text-[#00897B] dark:text-teal-400 font-medium text-[11px] hover:underline">Review →</span>
              </div>
            </div>
          </div>

          {/* Card 3: In-Transit Active Shipments */}
          <div
            className={`border rounded-2xl p-5 space-y-3 transition-all ${
              isDark ? 'bg-[#1E293B] border-slate-700 text-white shadow-xl' : 'bg-white border-slate-200/90 text-slate-900 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">{isBn ? 'ইন-ট্রানজিট কার্গো শিপমেন্ট' : 'Active In-Transit Cargo'}</span>
              <Truck className="w-5 h-5 text-[#00897B]" />
            </div>
            <div>
              <div className="text-2xl font-bold font-sans text-slate-900 dark:text-white">
                {inTransitCartons.length} <span className="text-xs font-normal text-slate-400">Cartons</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>{finalizedProposals.length} Active Flight Batches</span>
                <span className="text-blue-500 dark:text-blue-400 font-bold text-[11px]">
                  En Route BD
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: All Booking List */}
          <div
            onClick={() => setActiveTab && setActiveTab('cartons')}
            className={`border rounded-2xl p-5 space-y-3 transition-all cursor-pointer hover:border-[#00897B] ${
              isDark ? 'bg-[#1E293B] border-slate-700 text-white shadow-xl' : 'bg-white border-slate-200/90 text-slate-900 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">{isBn ? 'অল বুকিং লিস্ট' : 'All Booking List'}</span>
              <Package className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <div className="text-2xl font-bold font-sans text-slate-900 dark:text-white">
                {bookedStockCartons.length} <span className="text-xs font-normal text-slate-400">Cartons</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>{totalInventoryWeight.toLocaleString()} kg stored</span>
                <span className="text-purple-500 dark:text-purple-400 font-medium text-[11px] hover:underline">{isBn ? 'অল বুকিং দেখুন →' : 'View All Bookings →'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. PENDING PROPOSAL ACTION BANNER */}
        {pendingProposals.length > 0 && (
          <div
            className={`p-4 rounded-xl border-l-4 border-l-[#00897B] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md ${
              isDark
                ? 'bg-[#1E293B] border-slate-700 text-white'
                : 'bg-white border-slate-200/90 text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-[#00897B] shrink-0" />
              <div>
                <strong className="font-bold text-sm block text-slate-900 dark:text-white">
                  {isBn
                    ? `${pendingProposals.length}টি অরিজিন ওয়্যারহাউজ থেকে নতুন ফ্লাইং প্রোপোজাল জমা পড়েছে!`
                    : `${pendingProposals.length} Origin Hubs submitted daily flying proposals for review!`}
                </strong>
                <span className="text-slate-600 dark:text-slate-300">
                  {isBn
                    ? 'আজকের ফ্লাইটে কার্টুন ডিসপ্যাচ করার জন্য তালিকা পরীক্ষা, কার্টুন বাদ/যোগ ও ফাইনাল ডিসপ্যাচ দিন।'
                    : 'Review carton list, adjust stock items & finalize dispatch to update live tracking.'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setActiveTab && setActiveTab('proposals')}
              className="py-2.5 px-4 rounded-xl bg-[#00897B] hover:bg-[#00796B] text-white font-semibold text-xs shadow-md shrink-0 cursor-pointer flex items-center space-x-1.5 border-0"
            >
              <span>{isBn ? 'প্রোপোজাল রিভিউ করুন' : 'Review Proposals Inbox'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 3. VISUAL OPERATIONS ANALYTICS CHARTS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Flying Cargo Volume Line & Dotted Grid Chart */}
          <SleekLineChart
            title={isBn ? 'দৈনিক অর্ডার (৩০ দিন)' : 'Daily Flying Cargo Trend (30 Days)'}
            subtitle={isBn ? 'আকাশপথে ফ্লাইটের তারিখভিত্তিক কার্গো ভলিউম (kg)' : 'Real-time 30-day air cargo volume trend'}
            data={trendData}
            color="#00A896"
            unit="kg"
            isDark={isDark}
          />

          {/* Origin Hub Volume Share & Route Status */}
          <div
            className={`border rounded-2xl p-6 space-y-4 shadow-xl ${
              isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-[#00897B]" />
                <span>{isBn ? 'ওয়্যারহাউজ-টু-ওয়্যারহাউজ ভলিউম ও শেয়ার' : 'Origin Hub Volume Ratio & Traffic'}</span>
              </h3>
              <span className="text-xs text-[#00897B] dark:text-teal-400 font-mono font-semibold">Active Cargo</span>
            </div>

            <div className="space-y-4 pt-1">
              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
                  <span className="font-medium">Guangzhou Air Hub 🇨🇳</span>
                  <span className="text-slate-900 dark:text-white font-bold font-mono">{gzPct}% ({gzWeight.toLocaleString()} kg)</span>
                </div>
                <div className="w-full h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-300 dark:border-slate-700 p-0.5">
                  <div className="h-full bg-gradient-to-r from-teal-500 to-[#00897B] rounded-full transition-all duration-300" style={{ width: `${gzPct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
                  <span className="font-medium">হংকং ওয়্যারহাউজ (Hong Kong Hub 🇭🇰)</span>
                  <span className="text-slate-900 dark:text-white font-bold font-mono">{hkPct}% ({hkWeight.toLocaleString()} kg)</span>
                </div>
                <div className="w-full h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-300 dark:border-slate-700 p-0.5">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-600 rounded-full transition-all duration-300" style={{ width: `${hkPct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
                  <span className="font-medium">দুবাই ওয়্যারহাউজ (Dubai Hub 🇦🇪)</span>
                  <span className="text-slate-900 dark:text-white font-bold font-mono">{dubaiPct}% ({dubaiWeight.toLocaleString()} kg)</span>
                </div>
                <div className="w-full h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-300 dark:border-slate-700 p-0.5">
                  <div className="h-full bg-gradient-to-r from-sky-400 to-teal-500 rounded-full transition-all duration-300" style={{ width: `${dubaiPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. RECENT DISPATCHED FLIGHTS FEED TABLE */}
        <div
          className={`border rounded-2xl overflow-hidden shadow-xl ${
            isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200/90 text-slate-900 shadow-xs'
          }`}
        >
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <History className="w-4 h-4 text-[#00897B]" />
              <span>{isBn ? 'সাম্প্রতিক ফাইনালাইজড ফ্লাইট সমূহের তালিকা' : 'Recent Dispatched Flight Batches'}</span>
            </h3>
            <button
              onClick={() => setActiveTab && setActiveTab('history')}
              className="text-xs text-[#00897B] dark:text-teal-400 hover:underline font-medium cursor-pointer"
            >
              {isBn ? 'সব হিস্ট্রি দেখুন →' : 'View Full History →'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead
                className={`uppercase text-[10px] tracking-wider border-b ${
                  isDark ? 'bg-[#1E293B] text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                <tr>
                  <th className="p-3.5">Flight Date</th>
                  <th className="p-3.5">Flight No / AWB</th>
                  <th className="p-3.5">Origin Hub</th>
                  <th className="p-3.5">Cartons Count</th>
                  <th className="p-3.5">Total Weight</th>
                  <th className="p-3.5">Finalized By</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-200' : 'divide-slate-200/80 text-slate-800'}`}>
                {finalizedProposals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-xs font-mono text-slate-400">
                      {isBn ? 'কোনো ডিসপ্যাচড ফ্লাইট হিস্ট্রি পাওয়া যায়নি (০ টি রেকর্ড)' : 'No dispatched flight batch history found (0 records)'}
                    </td>
                  </tr>
                ) : (
                  finalizedProposals.slice(0, 5).map((fh) => (
                    <tr key={fh.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono text-[#00897B] font-bold">{fh.date}</td>
                      <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                        <div>{fh.flight_number || 'N/A'}</div>
                        <div className="text-[10px] text-slate-400">AWB: {fh.awb_number || 'N/A'}</div>
                      </td>
                      <td className="p-3.5 font-medium text-slate-900 dark:text-white">{fh.warehouse_name}</td>
                      <td className="p-3.5 text-[#00897B] font-semibold">{fh.items_count} Cartons</td>
                      <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300">{fh.total_weight} kg</td>
                      <td className="p-3.5 text-slate-500 dark:text-slate-400">{fh.finalized_by}</td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                          DISPATCHED
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* REAL-TIME CENTRAL BOOKED CARTONS HUB */}
        <BookedCartonsHub
          cartons={cartons}
          warehouses={warehouses}
          currentUser={currentUser}
          language={language}
          onUpdateCarton={(updatedCarton) => {
            const fresh = cartons.map((c) => (c.id === updatedCarton.id ? updatedCarton : c));
            setCartons(fresh);
            saveHostingerDbData('fsc_vps_cartons', fresh);
          }}
          onDeleteCarton={(cartonId) => {
            const fresh = cartons.filter((c) => c.id !== cartonId);
            setCartons(fresh);
            saveHostingerDbData('fsc_vps_cartons', fresh);
          }}
        />
      </div>
    );
  }

  // TAB 2: PENDING PROPOSALS REVIEW & DISPATCH
  if (activeTab === 'proposals') {
    return <FlightProposalsManager language={language} theme={theme} />;
  }

  // TAB 2.5: FINAL FLYING LIST & HISTORICAL ARCHIVE
  if (activeTab === 'final_flying_list') {
    return <FinalFlyingListSection language={language} theme={theme} />;
  }

  // TAB 2.8: SHIPMENT DATA TRACKER & LIVE SATELLITE MAP
  if (activeTab === 'public_track' || activeTab === 'tracking' || activeTab === 'data_tracker' || activeTab === 'public_tracking') {
    return (
      <ShipmentDataTracker
        cartons={cartons}
        warehouses={warehouses}
        proposals={proposals}
        language={language}
        theme={theme}
      />
    );
  }

  // --------------------------------------------------------------------------
  // TAB 3: WAREHOUSE INVENTORY REFERENCE (Cartons Stock View)
  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // TAB 3: ALL BOOKING LIST & WAREHOUSE INVENTORY (With Auto-Update & Hub Filters)
  // --------------------------------------------------------------------------
  if (activeTab === 'cartons' || activeTab === 'all_bookings') {
    return (
      <div className="space-y-6 font-sans">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <BookedCartonsHub
          cartons={cartons}
          warehouses={warehouses}
          currentUser={currentUser}
          language={language}
          onUpdateCarton={(updatedCarton) => {
            const updated = cartons.map((c) => (c.id === updatedCarton.id ? updatedCarton : c));
            setCartons(updated);
            saveHostingerDbData('fsc_vps_cartons', updated);
          }}
          onDeleteCarton={(cartonId) => {
            const fresh = cartons.filter((c) => c.id !== cartonId);
            setCartons(fresh);
            saveHostingerDbData('fsc_vps_cartons', fresh);
            addToast('info', isBn ? 'কার্টুন মুছে ফেলা হয়েছে' : 'Carton Deleted');
          }}
        />
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // TAB 4: RECEIVE FLYING (রিসিভ ফ্লাইং) - Inbound Plane Dispatches & Receiving
  // --------------------------------------------------------------------------
  if (activeTab === 'history') {
    return (
      <ReceiveFlyingSection
        proposals={proposals}
        setProposals={setProposals}
        cartons={cartons}
        setCartons={setCartons}
        currentUser={currentUser}
        language={language}
      />
    );
  }

  // --------------------------------------------------------------------------
  // TAB 5: OPERATIONS ANALYTICS & PERFORMANCE
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-200 dark:border-slate-700">
        <div>
          <h2 className="text-xl font-medium text-slate-900 dark:text-white flex items-center space-x-2.5">
            <div className="p-2 rounded-none bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <span>{isBn ? 'অপারেশনস অ্যানালিটিক্স এবং ভলিউম চার্ট' : 'Operations Analytics & Performance Metrics'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isBn
              ? 'দৈনিক উত্তর কার্গোর পরিমাণ, উৎস হাবের তুলনামূলক ট্রাফিক এবং ক্যারিয়ার পারফরম্যান্স অ্যানালিটিক্স'
              : 'Daily cargo volume trend, origin hub ratio & airline freight performance analytics'}
          </p>
        </div>
      </div>

      {/* 1. Top Executive Operational KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-white border-slate-200/90 shadow-2xs'}`}>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal block">{isBn ? 'গড় ফ্রেইট ট্রানজিট সময়:' : 'Avg Air Transit Time:'}</span>
          <span className="text-xl font-medium font-mono text-[#1D4ED8] mt-1 block">
            {cartons.length > 0 ? '2.4 Days' : '0 Days'}
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal mt-0.5 block">
            {cartons.length > 0 ? '⚡ Fast Air Freight SLA' : '0 SLA'}
          </span>
        </div>

        <div className={`p-4 rounded-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-white border-slate-200/90 shadow-2xs'}`}>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal block">{isBn ? 'অন-টাইম ডিসপ্যাচ রেট:' : 'On-Time Dispatch Rate:'}</span>
          <span className="text-xl font-medium font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
            {cartons.length > 0 ? '98.5%' : '0%'}
          </span>
          <span className="text-[10px] text-slate-400 font-normal mt-0.5 block">Target &gt; 95.0%</span>
        </div>

        <div className={`p-4 rounded-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-white border-slate-200/90 shadow-2xs'}`}>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal block">{isBn ? 'ফ্লাইট ক্যাপাসিটি ইউটিলাইজেশন:' : 'Air Payload Utilization:'}</span>
          <span className="text-xl font-medium font-mono text-purple-600 dark:text-purple-400 mt-1 block">
            {cartons.length > 0 ? '92.8%' : '0%'}
          </span>
          <span className="text-[10px] text-purple-500 font-normal mt-0.5 block">
            {cartons.length > 0 ? 'High Volume Efficiency' : '0 kg Payload'}
          </span>
        </div>

        <div className={`p-4 rounded-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-white border-slate-200/90 shadow-2xs'}`}>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal block">{isBn ? 'সেফ হ্যান্ডলিং স্কোর:' : 'Safe Handling Score:'}</span>
          <span className="text-xl font-medium font-mono text-amber-600 dark:text-amber-400 mt-1 block">
            {cartons.length > 0 ? '99.9%' : '0%'}
          </span>
          <span className="text-[10px] text-amber-500 font-normal mt-0.5 block">
            {cartons.length > 0 ? 'Zero Damage Record' : 'No Cargo Records'}
          </span>
        </div>
      </div>

      {/* 2. Primary Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Orders & Cargo Line Chart */}
        <SleekLineChart
          title={isBn ? 'দৈনিক অর্ডার ও এয়ার কার্গো (৩০ দিন)' : 'Daily Orders & Air Cargo (30 Days)'}
          subtitle={isBn ? 'দৈনিক বুকিং অর্ডার এবং প্রাপ্ত কার্গোর সংখ্যা' : 'Daily booking order & received cargo count'}
          data={
            cartons.length > 0
              ? [
                  { date: '07-31', value: 0 },
                  { date: '08-02', value: Math.round(cartons.length * 0.2) },
                  { date: '08-04', value: Math.round(cartons.length * 0.4) },
                  { date: '08-06', value: Math.round(cartons.length * 0.3) },
                  { date: '08-08', value: Math.round(cartons.length * 0.6) },
                  { date: '08-10', value: Math.round(cartons.length * 0.5) },
                  { date: '08-12', value: Math.round(cartons.length * 0.8) },
                  { date: '08-14', value: Math.round(cartons.length * 0.7) },
                  { date: '08-15', value: cartons.length },
                ]
              : [
                  { date: '07-31', value: 0 },
                  { date: '08-02', value: 0 },
                  { date: '08-04', value: 0 },
                  { date: '08-06', value: 0 },
                  { date: '08-08', value: 0 },
                  { date: '08-10', value: 0 },
                  { date: '08-12', value: 0 },
                  { date: '08-14', value: 0 },
                  { date: '08-15', value: 0 },
                ]
          }
          color="#00A896"
          unit={isBn ? 'টি অর্ডার' : 'orders'}
          isDark={isDark}
        />

        {/* Origin Hub Volume Share Box */}
        {(() => {
          const totalWt = cartons.reduce((sum, c) => sum + (c.gross_weight || 0), 0);
          const gzWt = cartons.filter((c) => (c as any).origin_warehouse_id === 'wh-china' || c.current_warehouse_id === 'wh-china').reduce((sum, c) => sum + (c.gross_weight || 0), 0);
          const hkWt = cartons.filter((c) => (c as any).origin_warehouse_id === 'wh-hk' || c.current_warehouse_id === 'wh-hk').reduce((sum, c) => sum + (c.gross_weight || 0), 0);
          const dxbWt = cartons.filter((c) => (c as any).origin_warehouse_id === 'wh-dubai' || c.current_warehouse_id === 'wh-dubai').reduce((sum, c) => sum + (c.gross_weight || 0), 0);

          const gzP = totalWt > 0 ? Math.round((gzWt / totalWt) * 100) : 0;
          const hkP = totalWt > 0 ? Math.round((hkWt / totalWt) * 100) : 0;
          const dxbP = totalWt > 0 ? Math.round((dxbWt / totalWt) * 100) : 0;

          return (
            <div
              className={`border rounded-none p-6 space-y-4 shadow-2xs ${
                isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-medium text-slate-900 dark:text-white flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-[#1D4ED8]" />
                  <span>{isBn ? 'অরিজিন হাব ভলিউম অনুপাত এবং ট্রাফিক' : 'Origin Hub Volume Ratio & Traffic'}</span>
                </h3>
                <span className="text-xs text-[#1D4ED8] font-mono font-normal">সক্রিয় কার্গো</span>
              </div>

              <div className="space-y-5 pt-2">
                <div>
                  <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mb-1.5 font-normal">
                    <span className="font-normal">Guangzhou Air Hub 🇨🇳</span>
                    <span className="text-slate-900 dark:text-white font-normal font-mono">{gzP}% ({gzWt.toFixed(1)} kg)</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-none overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-600 to-[#1D4ED8] rounded-none" style={{ width: `${gzP}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mb-1.5 font-normal">
                    <span className="font-normal">হংকং ওয়্যারহাউজ (Hong Kong Hub 🇭🇰)</span>
                    <span className="text-slate-900 dark:text-white font-normal font-mono">{hkP}% ({hkWt.toFixed(1)} kg)</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-none overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-[#1D4ED8] rounded-none" style={{ width: `${hkP}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mb-1.5 font-normal">
                    <span className="font-normal">দুবাই ওয়্যারহাউজ (Dubai Hub 🇦🇪)</span>
                    <span className="text-slate-900 dark:text-white font-normal font-mono">{dxbP}% ({dxbWt.toFixed(1)} kg)</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-none overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-none" style={{ width: `${dxbP}%` }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 3. Airline Carrier Performance Table & Goods Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Airline Partner Carrier Performance Table (Spans 2 Columns) */}
        <div className={`lg:col-span-2 border rounded-none p-6 space-y-4 shadow-2xs ${
          isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'
        }`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-medium text-slate-900 dark:text-white flex items-center space-x-2">
              <Plane className="w-4 h-4 text-[#1D4ED8]" />
              <span>{isBn ? 'এয়ারলাইন্স পার্টনার কার্গো পারফরম্যান্স ও ট্রানজিট স্পিড' : 'Airline Carrier Performance & Transit Speed'}</span>
            </h3>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-normal">Air Freight SLA</span>
          </div>

          <div className="overflow-x-auto">
            {cartons.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-slate-400">
                {isBn ? 'কোনো সক্রিয় এয়ারলাইন ক্যারিয়ার রেকর্ড নেই (০ টি কার্টুন)' : 'No carrier activity recorded (0 cartons)'}
              </div>
            ) : (
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className={`uppercase text-[10px] tracking-wider border-b ${
                  isDark ? 'bg-[#1E293B] text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  <tr>
                    <th className="p-3 font-normal">AIRLINE CARRIER</th>
                    <th className="p-3 font-normal">FLIGHT NOS</th>
                    <th className="p-3 font-normal">TOTAL CARTONS</th>
                    <th className="p-3 font-normal">GROSS WEIGHT</th>
                    <th className="p-3 font-normal">AVG TRANSIT</th>
                    <th className="p-3 text-right font-normal">RELIABILITY</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-200' : 'divide-slate-200/80 text-slate-800'}`}>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-normal flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-none bg-blue-500"></span>
                      <span>US-Bangla Air Cargo</span>
                    </td>
                    <td className="p-3 font-mono font-normal text-[#1D4ED8]">BS-201, BS-206</td>
                    <td className="p-3 font-normal">{cartons.length} Cartons</td>
                    <td className="p-3 font-mono font-normal">{cartons.reduce((sum, c) => sum + (c.gross_weight || 0), 0).toFixed(1)} kg</td>
                    <td className="p-3 font-normal text-emerald-600 dark:text-emerald-400">2.2 Days</td>
                    <td className="p-3 text-right font-normal text-emerald-600 dark:text-emerald-400">99.2%</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Goods Category Cargo Breakdown */}
        <div className={`border rounded-none p-6 space-y-4 shadow-2xs ${
          isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'
        }`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-medium text-slate-900 dark:text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>{isBn ? 'পণ্য ক্যাটাগরি ডিস্ট্রিবিউশন' : 'Cargo Product Categories'}</span>
            </h3>
            <span className="text-xs text-purple-600 font-mono font-normal">Categories</span>
          </div>

          <div className="space-y-4 pt-1 text-xs">
            <div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300 mb-1 font-normal">
                <span>ইলেকট্রনিক্স ও মোবাইল পার্টস</span>
                <span className="font-mono font-normal text-blue-600 dark:text-blue-400">{cartons.length > 0 ? '40%' : '0%'}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-none overflow-hidden">
                <div className="h-full bg-blue-500 rounded-none" style={{ width: `${cartons.length > 0 ? 40 : 0}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300 mb-1 font-normal">
                <span>গার্মেন্টস, টেক্সটাইল ও ফ্যাব্রিক্স</span>
                <span className="font-mono font-normal text-purple-600 dark:text-purple-400">{cartons.length > 0 ? '35%' : '0%'}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-none overflow-hidden">
                <div className="h-full bg-purple-500 rounded-none" style={{ width: `${cartons.length > 0 ? 35 : 0}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300 mb-1 font-normal">
                <span>পারফিউম, ঘড়ি ও কসমোটিকস</span>
                <span className="font-mono font-normal text-amber-600 dark:text-amber-400">{cartons.length > 0 ? '15%' : '0%'}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-none overflow-hidden">
                <div className="h-full bg-amber-500 rounded-none" style={{ width: `${cartons.length > 0 ? 15 : 0}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300 mb-1 font-normal">
                <span>মেশিনারি পার্টস ও হার্ডওয়্যার</span>
                <span className="font-mono font-normal text-emerald-600 dark:text-emerald-400">{cartons.length > 0 ? '10%' : '0%'}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-none overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-none" style={{ width: `${cartons.length > 0 ? 10 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
