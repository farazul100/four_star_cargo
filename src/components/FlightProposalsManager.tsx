import React, { useState, useEffect } from 'react';
import {
  Plane,
  Warehouse as WarehouseIcon,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  PlusCircle,
  Trash2,
  Eye,
  Package,
  ShieldCheck,
  History,
  FileText,
  Printer,
  Calendar,
  Filter,
  Check,
  Building,
  RotateCcw,
  X,
  Box,
} from 'lucide-react';
import { FlyingProposal, Carton, Language, Theme, AuditLog } from '../types';
import { getHostingerDbData, saveHostingerDbData, subscribeToDbUpdates } from '../lib/db';
import { useTheme } from '../context/ThemeContext';
import { ToastContainer, ToastMessage } from './Toast';

interface FlightProposalsManagerProps {
  language: Language;
  theme?: Theme;
}

const DB_KEYS = {
  PROPOSALS: 'fsc_vps_proposals',
  CARTONS: 'fsc_vps_cartons',
  AUDIT: 'fsc_vps_audit',
};

export const FlightProposalsManager: React.FC<FlightProposalsManagerProps> = ({
  language,
  theme: themeProp,
}) => {
  const { theme: contextTheme } = useTheme();
  const activeTheme = contextTheme || themeProp || 'light';
  const isDark = activeTheme === 'dark';
  const isBn = language === 'bn';

  // Active View Mode: 'active' (Pending & Active) vs 'history' (Historical Proposals & Archives)
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');

  // Live persistent data from db.ts
  const [proposals, setProposals] = useState<FlyingProposal[]>([]);
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'dispatched' | 'rejected'>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'dispatched' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Date Range Filters for History
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Inspector & Print Modal State
  const [activeModalProposal, setActiveModalProposal] = useState<FlyingProposal | null>(null);
  const [showAddCartonModal, setShowAddCartonModal] = useState<boolean>(false);
  const [selectedUnassignedCartonIds, setSelectedUnassignedCartonIds] = useState<string[]>([]);
  const [addCartonSearch, setAddCartonSearch] = useState<string>('');
  const [attachedCartonSearch, setAttachedCartonSearch] = useState<string>('');
  const [printManifestProposal, setPrintManifestProposal] = useState<FlyingProposal | null>(null);

  // Toast Helper
  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: `toast-${Date.now()}`, type, title, message }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync state from db.ts on mount and subscribe to real-time cross-tab updates
  useEffect(() => {
    const data = getHostingerDbData();
    setProposals(data.proposals || []);
    setCartons(data.cartons || []);

    const unsubscribe = subscribeToDbUpdates(() => {
      const freshData = getHostingerDbData();
      setProposals(freshData.proposals || []);
      setCartons(freshData.cartons || []);
    });

    return () => unsubscribe();
  }, []);

  // Save proposals & cartons helper
  const syncAndSave = (updatedProposals: FlyingProposal[], updatedCartons: Carton[], auditMsg?: string) => {
    setProposals(updatedProposals);
    setCartons(updatedCartons);
    saveHostingerDbData(DB_KEYS.PROPOSALS, updatedProposals);
    saveHostingerDbData(DB_KEYS.CARTONS, updatedCartons);

    if (auditMsg) {
      const data = getHostingerDbData();
      const newAudit: AuditLog = {
        id: `log-${Date.now()}`,
        user_id: 'usr-1',
        user_name: 'তানভীর আহমেদ (Super Admin)',
        user_role: 'super_admin',
        action: 'proposal_update',
        entity_type: 'flying_proposal',
        entity_id: 'prop-sync',
        details: auditMsg,
        created_at: new Date().toISOString(),
      };
      const newAuditLogs = [newAudit, ...(data.auditLogs || [])];
      saveHostingerDbData(DB_KEYS.AUDIT, newAuditLogs);
    }
  };

  // Apply Quick Date Presets
  const applyDatePreset = (preset: 'all' | 'today' | 'this_month' | 'last_30_days') => {
    const today = new Date().toISOString().split('T')[0];
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'this_month') {
      const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(today);
    } else if (preset === 'last_30_days') {
      const past30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setStartDate(past30);
      setEndDate(today);
    }
  };

  // Active Proposals Filter (Pending list tab shows all pending & active proposals)
  const activeProposals = proposals.filter((p) => {
    if (statusFilter === 'all') return p.status === 'pending' || p.status === 'approved' || p.status === 'dispatched';
    return p.status === statusFilter;
  });
  const filteredActiveProposals = activeProposals.filter((prop) => {
    if (warehouseFilter !== 'all') {
      const matchesWhId = prop.warehouse_id === warehouseFilter;
      const matchesWhName = (prop.warehouse_name || '').toLowerCase().includes(warehouseFilter.toLowerCase());
      if (!matchesWhId && !matchesWhName) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = prop.id.toLowerCase().includes(q);
      const matchWh = (prop.warehouse_name || '').toLowerCase().includes(q);
      const matchFlight = (prop.flight_number || prop.flying_name || '').toLowerCase().includes(q);
      const matchAirline = (prop.airline || '').toLowerCase().includes(q);
      if (!matchId && !matchWh && !matchFlight && !matchAirline) return false;
    }
    return true;
  });

  // Historical Proposals Filter
  const historicalProposals = proposals.filter((p) => p.status === 'dispatched' || p.status === 'rejected' || p.status === 'approved');
  const filteredHistoricalProposals = historicalProposals.filter((prop) => {
    if (historyStatusFilter !== 'all' && prop.status !== historyStatusFilter) return false;
    if (warehouseFilter !== 'all' && prop.warehouse_id !== warehouseFilter) return false;
    
    // Date Range Filtering
    if (startDate && prop.date < startDate) return false;
    if (endDate && prop.date > endDate) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = prop.id.toLowerCase().includes(q);
      const matchWh = (prop.warehouse_name || '').toLowerCase().includes(q);
      const matchFlight = (prop.flight_number || prop.flying_name || '').toLowerCase().includes(q);
      const matchAirline = (prop.airline || '').toLowerCase().includes(q);
      if (!matchId && !matchWh && !matchFlight && !matchAirline) return false;
    }
    return true;
  });

  // Calculate Active KPIs
  const pendingCount = proposals.filter((p) => p.status === 'pending').length;
  const approvedCount = proposals.filter((p) => p.status === 'approved').length;
  const dispatchedCount = proposals.filter((p) => p.status === 'dispatched').length;
  const totalProposedWeight = proposals.reduce((acc, p) => acc + p.total_weight, 0);

  // Calculate History KPIs (Dynamically calculated based on filtered date & parameters)
  const totalHistoryCount = filteredHistoricalProposals.length;
  const totalDispatchedWeight = filteredHistoricalProposals
    .filter((p) => p.status === 'dispatched')
    .reduce((acc, p) => acc + p.total_weight, 0);
  const totalDispatchedCbm = filteredHistoricalProposals
    .filter((p) => p.status === 'dispatched')
    .reduce((acc, p) => acc + p.total_cbm, 0);

  // ACTION: REMOVE CARTON FROM PROPOSAL
  const handleRemoveCartonFromProposal = (proposalId: string, cartonId: string) => {
    const targetProp = proposals.find((p) => p.id === proposalId);
    if (!targetProp) return;

    const updatedCartonIds = (targetProp.carton_ids || []).filter((id) => id !== cartonId);

    const attachedCartons = cartons.filter((c) => updatedCartonIds.includes(c.id));
    const newCount = attachedCartons.length;
    const newWeight = attachedCartons.reduce((acc, c) => acc + c.gross_weight, 0);
    const newCbm = attachedCartons.reduce((acc, c) => acc + c.cbm, 0);

    const updatedProposals = proposals.map((p) => {
      if (p.id === proposalId) {
        return {
          ...p,
          carton_ids: updatedCartonIds,
          items_count: newCount,
          total_weight: newWeight,
          total_cbm: newCbm,
        };
      }
      return p;
    });

    const updatedCartons = cartons.map((c) => {
      if (c.id === cartonId) {
        return { ...c, status: 'received' as const };
      }
      return c;
    });

    syncAndSave(
      updatedProposals,
      updatedCartons,
      `Super Admin removed Carton #${cartonId} from Proposal #${proposalId}. Weight updated to ${newWeight} kg.`
    );

    if (activeModalProposal && activeModalProposal.id === proposalId) {
      setActiveModalProposal({
        ...activeModalProposal,
        carton_ids: updatedCartonIds,
        items_count: newCount,
        total_weight: newWeight,
        total_cbm: newCbm,
      });
    }

    addToast(
      'info',
      isBn ? 'কার্টুন অপসারণ করা হয়েছে' : 'Carton Removed',
      isBn ? `কার্টুন #${cartonId} ফ্লাইং রিকোয়েস্ট থেকে রিমুভ করে ইনভেন্টরিতে ব্যাক করা হয়েছে।` : `Carton #${cartonId} unassigned & returned to inventory.`
    );
  };

  // ACTION: ADD CARTONS TO PROPOSAL
  const handleAddCartonsToProposal = (proposalId: string) => {
    if (selectedUnassignedCartonIds.length === 0) {
      addToast('error', isBn ? 'কোনো কার্টুন নির্বাচন করা হয়নি' : 'No Cartons Selected');
      return;
    }

    const targetProp = proposals.find((p) => p.id === proposalId);
    if (!targetProp) return;

    const existingIds = targetProp.carton_ids || [];
    const updatedCartonIds = Array.from(new Set([...existingIds, ...selectedUnassignedCartonIds]));

    const attachedCartons = cartons.filter((c) => updatedCartonIds.includes(c.id));
    const newCount = attachedCartons.length;
    const newWeight = attachedCartons.reduce((acc, c) => acc + c.gross_weight, 0);
    const newCbm = attachedCartons.reduce((acc, c) => acc + c.cbm, 0);

    const updatedProposals = proposals.map((p) => {
      if (p.id === proposalId) {
        return {
          ...p,
          carton_ids: updatedCartonIds,
          items_count: newCount,
          total_weight: newWeight,
          total_cbm: newCbm,
        };
      }
      return p;
    });

    const updatedCartons = cartons.map((c) => {
      if (selectedUnassignedCartonIds.includes(c.id)) {
        return { ...c, status: 'proposed' as const };
      }
      return c;
    });

    syncAndSave(
      updatedProposals,
      updatedCartons,
      `Super Admin added ${selectedUnassignedCartonIds.length} cartons to Proposal #${proposalId}.`
    );

    if (activeModalProposal && activeModalProposal.id === proposalId) {
      setActiveModalProposal({
        ...activeModalProposal,
        carton_ids: updatedCartonIds,
        items_count: newCount,
        total_weight: newWeight,
        total_cbm: newCbm,
      });
    }

    setShowAddCartonModal(false);
    setSelectedUnassignedCartonIds([]);
    addToast(
      'success',
      isBn ? 'নতুন কার্টুন যোগ সফল' : 'Cartons Added Successfully',
      isBn ? `${selectedUnassignedCartonIds.length} টি নতুন কার্টুন রিকোয়েস্টে সংযুক্ত করা হয়েছে।` : `${selectedUnassignedCartonIds.length} cartons attached to proposal.`
    );
  };

  // ACTION: CHANGE PROPOSAL STATUS
  const handleUpdateProposalStatus = (
    proposalId: string,
    newStatus: 'approved' | 'dispatched' | 'rejected' | 'pending',
    note?: string
  ) => {
    const updatedProposals = proposals.map((p) => {
      if (p.id === proposalId) {
        return {
          ...p,
          status: newStatus,
          rejection_note: note || p.rejection_note,
          finalized_by: newStatus !== 'pending' ? 'usr-1 (Tanvir Ahmed)' : undefined,
          finalized_at: newStatus !== 'pending' ? new Date().toISOString() : undefined,
        };
      }
      return p;
    });

    const targetProp = proposals.find((p) => p.id === proposalId);
    const targetCartonIds = targetProp?.carton_ids || [];

    const updatedCartons = cartons.map((c) => {
      if (targetCartonIds.includes(c.id)) {
        if (newStatus === 'approved') return { ...c, status: 'proposed' as const };
        if (newStatus === 'dispatched') return { ...c, status: 'in_transit' as const, flying_date: new Date().toISOString().split('T')[0] };
        if (newStatus === 'rejected') return { ...c, status: 'received' as const };
      }
      return c;
    });

    const statusLabel =
      newStatus === 'approved'
        ? 'অনুমোদন'
        : newStatus === 'dispatched'
        ? 'ফ্লাইটে ডেসপ্যাচ'
        : newStatus === 'rejected'
        ? 'বাতিল/পুনর্বিবেচনা'
        : 'পেন্ডিং';

    syncAndSave(
      updatedProposals,
      updatedCartons,
      `Super Admin changed Proposal #${proposalId} status to ${newStatus}.`
    );

    setActiveModalProposal(null);
    addToast(
      'success',
      isBn ? `প্রস্তাবনা ${statusLabel} হয়েছে` : `Proposal ${newStatus.toUpperCase()}`,
      isBn ? `প্রস্তাবনা #${proposalId} এর আপডেট স্টেটাস সরাসরি ওয়্যারহাউজ প্যানেলে সিঙ্ক করা হয়েছে।` : `Proposal #${proposalId} updated and synced with warehouse.`
    );
  };

  // Helper: Get attached cartons for a proposal
  const getProposalCartons = (proposal: FlyingProposal): Carton[] => {
    if (proposal.carton_ids && proposal.carton_ids.length > 0) {
      return cartons.filter((c) => proposal.carton_ids?.includes(c.id));
    }
    return cartons.filter((c) => c.current_warehouse_id === proposal.warehouse_id).slice(0, proposal.items_count);
  };

  // Unassigned cartons in proposal's origin warehouse
  const unassignedCartonsInWh = activeModalProposal
    ? cartons.filter(
        (c) =>
          c.current_warehouse_id === activeModalProposal.warehouse_id &&
          (!activeModalProposal.carton_ids || !activeModalProposal.carton_ids.includes(c.id))
      )
    : [];

  return (
    <div className="space-y-5 font-sans">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 1. Header Navigation & View Mode Switcher */}
      <div className={`p-4 rounded-none border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isDark ? 'bg-[#1C1C1E] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
      }`}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-none bg-teal-50 border border-teal-200 text-[#00897B] dark:bg-teal-950/60 dark:border-teal-800 dark:text-teal-400 flex items-center justify-center">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <h1 className={`text-base md:text-lg font-medium flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <span>{isBn ? 'ফ্লাইং প্রস্তাবনা ও হিস্টোরি পোর্টাল' : 'Flying Proposals & Flight History Portal'}</span>
            </h1>
            <p className={`text-xs mt-0.5 font-normal ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              {isBn
                ? 'ওয়্যারহাউজ ফ্লাইট রিকোয়েস্ট অডিট, সিবিএম হিসাব, তারিখ অনুযায়ী হিস্টোরি ফিল্টার ও ফাইল সিঙ্ক'
                : 'Audit flying requests, filter history by date, manage carton payload & print manifests'}
            </p>
          </div>
        </div>

        {/* View Mode Switcher: Active Proposals vs History Log */}
        <div className={`flex rounded-none p-1 border ${isDark ? 'bg-[#121214] border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
          <button
            onClick={() => setViewMode('active')}
            className={`px-4 py-1.5 rounded-none text-xs font-normal transition-all cursor-pointer flex items-center space-x-2 ${
              viewMode === 'active'
                ? 'bg-[#00897B] text-white shadow-xs'
                : isDark
                ? 'text-gray-400 hover:text-white'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{isBn ? 'চলতি প্রস্তাবনাসমূহ' : 'Active Proposals'}</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-none text-[10px] bg-amber-400 text-slate-900 font-mono font-medium">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setViewMode('history')}
            className={`px-4 py-1.5 rounded-none text-xs font-normal transition-all cursor-pointer flex items-center space-x-2 ${
              viewMode === 'history'
                ? 'bg-[#00897B] text-white shadow-xs'
                : isDark
                ? 'text-gray-400 hover:text-white'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{isBn ? 'ফ্লাইং ইতিহাস (History Log)' : 'Proposal History'}</span>
            <span className="px-1.5 py-0.2 rounded-none text-[10px] bg-slate-300 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-mono font-normal">
              {totalHistoryCount}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW MODE 1: ACTIVE PROPOSALS (RUNNING & PENDING REQUESTS) */}
      {/* ========================================================================= */}
      {viewMode === 'active' && (
        <>
          {/* Active Proposals Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className={`p-4 rounded-none border ${isDark ? 'bg-[#1C1C1E] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-normal ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{isBn ? 'অপেক্ষমান রিকোয়েস্ট' : 'Pending Requests'}</span>
                <div className="text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-semibold font-mono mt-2 text-amber-600 dark:text-amber-400">{pendingCount} {isBn ? 'টি প্রস্তাবনা' : 'Proposals'}</p>
              <p className={`text-[11px] mt-0.5 font-normal ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{isBn ? 'অনুমোদনের জন্য প্রস্তুত' : 'Awaiting admin review'}</p>
            </div>

            <div className={`p-4 rounded-none border ${isDark ? 'bg-[#1C1C1E] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-normal ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{isBn ? 'অনুমোদিত প্রস্তাবনা' : 'Approved Proposals'}</span>
                <div className="text-teal-600 dark:text-teal-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-semibold font-mono mt-2 text-teal-600 dark:text-teal-400">{approvedCount} {isBn ? 'টি অনুমোদিত' : 'Approved'}</p>
              <p className={`text-[11px] mt-0.5 font-normal ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{isBn ? 'ফ্লাইট বুকিং কনফার্মড' : 'Confirmed for flight'}</p>
            </div>

            <div className={`p-4 rounded-none border ${isDark ? 'bg-[#1C1C1E] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-normal ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{isBn ? 'ফ্লাইটে রওনা শিপমেন্ট' : 'Dispatched Flights'}</span>
                <div className="text-blue-600 dark:text-blue-400">
                  <Plane className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-semibold font-mono mt-2 text-blue-600 dark:text-blue-400">{dispatchedCount} {isBn ? 'টি ফ্লাইট' : 'Flights'}</p>
              <p className={`text-[11px] mt-0.5 font-normal ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{isBn ? 'আকাশপথে ফ্লাইটে চলমান' : 'In-transit to Dhaka'}</p>
            </div>

            <div className={`p-4 rounded-none border ${isDark ? 'bg-[#1C1C1E] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-normal ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{isBn ? 'মোট প্রস্তাবিত ওজন' : 'Total Proposed Weight'}</span>
                <div className="text-purple-600 dark:text-purple-400">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-semibold font-mono mt-2 text-purple-600 dark:text-purple-400">{totalProposedWeight.toFixed(1)} kg</p>
              <p className={`text-[11px] mt-0.5 font-normal ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{isBn ? 'সকল রিকোয়েস্টের ওজন' : 'Sum of proposal gross weight'}</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className={`p-3.5 rounded-none border flex flex-wrap items-center justify-between gap-3 text-xs ${
            isDark ? 'bg-[#1C1C1E] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
          }`}>
            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex rounded-none p-0.5 border ${isDark ? 'bg-[#121214] border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1 rounded-none text-xs font-normal transition-all cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-[#00897B] text-white shadow-xs'
                      : isDark
                      ? 'text-gray-400 hover:text-white'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {isBn ? 'সব রিকোয়েস্ট' : 'All Requests'}
                </button>
                <button
                  onClick={() => setStatusFilter('pending')}
                  className={`px-3 py-1 rounded-none text-xs font-normal transition-all cursor-pointer ${
                    statusFilter === 'pending'
                      ? 'bg-[#00897B] text-white shadow-xs'
                      : isDark
                      ? 'text-gray-400 hover:text-white'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {isBn ? 'অপেক্ষমান (Pending)' : 'Pending'}
                </button>
                <button
                  onClick={() => setStatusFilter('approved')}
                  className={`px-3 py-1 rounded-none text-xs font-normal transition-all cursor-pointer ${
                    statusFilter === 'approved'
                      ? 'bg-[#00897B] text-white shadow-xs'
                      : isDark
                      ? 'text-gray-400 hover:text-white'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {isBn ? 'অনুমোদিত' : 'Approved'}
                </button>
              </div>

              <div className={`w-px h-4 mx-0.5 hidden md:block ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

              <div className={`flex items-center space-x-2 border rounded-none px-2.5 py-1.5 ${isDark ? 'bg-[#121214] border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
                <WarehouseIcon className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                  className="bg-transparent outline-none cursor-pointer text-xs font-normal dark:bg-[#121214] dark:text-white"
                >
                  <option value="all" className="bg-white text-gray-900 dark:bg-[#1C1C1E] dark:text-white">{isBn ? 'সব ওয়্যারহাউজ (All Origin Hubs)' : 'All Origin Hubs'}</option>
                  <option value="wh-china" className="bg-white text-gray-900 dark:bg-[#1C1C1E] dark:text-white">গুয়াংজু ওয়্যারহাউজ (China)</option>
                  <option value="wh-hk" className="bg-white text-gray-900 dark:bg-[#1C1C1E] dark:text-white">হংকং ওয়্যারহাউজ (Hong Kong)</option>
                </select>
              </div>
            </div>

            <div className="relative min-w-[220px]">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDark ? 'text-gray-400' : 'text-slate-400'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isBn ? 'প্রস্তাবনা ID, ফ্লাইট বা কার্টুন নং খুঁজুন...' : 'Search proposal, flight no...'}
                className={`w-full border rounded-none py-1.5 pl-8 pr-3 text-xs outline-none font-normal ${
                  isDark ? 'bg-[#121214] border-slate-700 text-white placeholder-gray-400' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Active Proposal Cards List */}
          <div className="space-y-4">
            {filteredActiveProposals.length === 0 ? (
              <div className={`p-10 rounded-none border text-center text-xs ${isDark ? 'bg-[#1C1C1E] border-slate-700 text-gray-400' : 'bg-white border-slate-200 text-slate-700'}`}>
                <Plane className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
                <p className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{isBn ? 'কোনো সক্রিয় ফ্লাইং প্রস্তাবনা পাওয়া যায়নি' : 'No active flight proposals found'}</p>
                <p className="mt-1 font-normal">{isBn ? 'আপনার নির্বাচিত ফিল্টার বা সার্চ দিয়ে কোনো রিকোয়েস্ট মেলেনি।' : 'Try resetting your filter or search query.'}</p>
              </div>
            ) : (
              filteredActiveProposals.map((prop) => {
                const propCartons = getProposalCartons(prop);
                const capacityRatio = Math.min(Math.round((prop.total_weight / 1000) * 100), 100);

                return (
                  <div
                    key={prop.id}
                    className={`p-5 rounded-none border transition-all ${
                      isDark ? 'bg-[#1C1C1E] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs hover:shadow-sm'
                    }`}
                  >
                    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3 ${
                      isDark ? 'border-slate-700' : 'border-slate-200'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className={`flex items-center justify-center font-normal ${
                          isDark ? 'text-teal-400' : 'text-[#00897B]'
                        }`}>
                          <Plane className="w-5 h-5" />
                        </div>

                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`font-mono font-medium text-sm ${isDark ? 'text-teal-400' : 'text-[#00897B]'}`}>#{prop.id.toUpperCase()}</span>
                            {prop.flight_number && (
                              <span className={`px-2 py-0.5 rounded-none text-[10px] font-normal border font-mono ${
                                isDark ? 'bg-blue-950/60 text-blue-300 border-blue-800' : 'bg-blue-50 text-blue-900 border-blue-200'
                              }`}>
                                ✈️ {prop.flight_number} ({prop.airline || 'Air Freight'})
                              </span>
                            )}
                          </div>
                          <p className={`text-xs mt-1 flex items-center space-x-1.5 font-normal ${
                            isDark ? 'text-slate-200' : 'text-slate-800'
                          }`}>
                            <WarehouseIcon className="w-3.5 h-3.5 text-[#00897B]" />
                            <span className="font-medium">{prop.warehouse_name}</span>
                            <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>•</span>
                            <span className={isDark ? 'text-slate-400 font-normal' : 'text-slate-600 font-normal'}>{isBn ? 'প্রস্তাবক:' : 'Requested by:'} {prop.proposed_by_name}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-3 py-0.5 rounded-none text-xs font-normal border ${
                            prop.status === 'approved'
                              ? isDark
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isDark
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {prop.status === 'approved'
                            ? isBn
                              ? '✅ অনুমোদিত'
                              : 'Approved'
                            : isBn
                            ? '⏳ অপেক্ষমান'
                            : 'Pending Review'}
                        </span>

                        <button
                          onClick={() => setActiveModalProposal(prop)}
                          className="px-3.5 py-1.5 rounded-none text-xs font-normal bg-[#00897B] hover:bg-[#00796B] text-white transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isBn ? 'কার্টুন অডিট ও সংশোধন' : 'Audit & Modify'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3.5 text-xs">
                      <div className={`p-2.5 rounded-none border ${isDark ? 'bg-[#121214] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`font-normal text-[11px] block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{isBn ? 'মোট কার্টুন সংখ্যা:' : 'Total Cartons:'}</span>
                        <span className={`font-mono font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{prop.items_count} {isBn ? 'টি কার্টুন' : 'cartons'}</span>
                      </div>

                      <div className={`p-2.5 rounded-none border ${isDark ? 'bg-[#121214] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`font-normal text-[11px] block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{isBn ? 'মোট ওজন (Weight):' : 'Gross Weight:'}</span>
                        <span className={`font-mono font-medium text-sm ${isDark ? 'text-teal-400' : 'text-[#00897B]'}`}>{prop.total_weight.toFixed(1)} kg</span>
                      </div>

                      <div className={`p-2.5 rounded-none border ${isDark ? 'bg-[#121214] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`font-normal text-[11px] block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{isBn ? 'মোট ভলিউম (Volume):' : 'Volume (CBM):'}</span>
                        <span className={`font-mono font-medium text-sm ${isDark ? 'text-purple-400' : 'text-purple-900'}`}>{prop.total_cbm.toFixed(2)} CBM</span>
                      </div>

                      <div className={`p-2.5 rounded-none border ${isDark ? 'bg-[#121214] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`font-normal text-[11px] block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{isBn ? 'রিকোয়েস্ট তারিখ:' : 'Request Date:'}</span>
                        <span className={`font-mono font-medium text-xs ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{prop.date}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className={`flex justify-between text-[11px] font-normal ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                        <span>{isBn ? 'ফ্লাইট পেলোড ক্যাপাসিটি ফিল' : 'Flight Payload Utilization'}</span>
                        <span className="font-mono font-medium">{prop.total_weight.toFixed(1)} kg / 1,000 kg ({capacityRatio}%)</span>
                      </div>
                      <div className={`w-full h-2 rounded-none border overflow-hidden ${
                        isDark ? 'bg-gray-800 border-slate-700' : 'bg-slate-100 border-slate-200'
                      }`}>
                        <div className="h-full bg-[#00897B] rounded-none transition-all duration-300" style={{ width: `${capacityRatio}%` }} />
                      </div>
                    </div>

                    <div className={`mt-3.5 pt-3 border-t flex items-center justify-between flex-wrap gap-2 text-xs ${
                      isDark ? 'border-slate-700' : 'border-slate-200'
                    }`}>
                      <div className="flex items-center space-x-2 overflow-x-auto py-0.5">
                        <span className={`text-[11px] font-normal ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>{isBn ? 'সংযুক্ত কার্টুন:' : 'Attached:'}</span>
                        {propCartons.slice(0, 4).map((c) => (
                          <span
                            key={c.id}
                            className={`px-2 py-0.5 rounded-none text-[10px] font-mono font-normal border ${
                              isDark ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            {c.ctn_no} ({c.gross_weight}kg)
                          </span>
                        ))}
                        {propCartons.length > 4 && (
                          <span className={`text-[11px] font-mono font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>+{propCartons.length - 4} {isBn ? 'টি অতিরিক্ত' : 'more'}</span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {prop.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleUpdateProposalStatus(prop.id, 'approved')}
                              className="px-3 py-1 rounded-none text-xs font-normal bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer flex items-center space-x-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isBn ? 'অনুমোদন' : 'Approve'}</span>
                            </button>
                            <button
                              onClick={() => handleUpdateProposalStatus(prop.id, 'rejected')}
                              className="px-3 py-1 rounded-none text-xs font-normal bg-rose-600 hover:bg-rose-700 text-white transition-all cursor-pointer flex items-center space-x-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>{isBn ? 'বাতিল' : 'Reject'}</span>
                            </button>
                          </>
                        )}

                        {prop.status === 'approved' && (
                          <button
                            onClick={() => handleUpdateProposalStatus(prop.id, 'dispatched')}
                            className="px-3.5 py-1 rounded-none text-xs font-normal bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
                          >
                            <Plane className="w-3.5 h-3.5" />
                            <span>{isBn ? 'ফ্লাইটে ডেসপ্যাচ করুন' : 'Dispatch Flight'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE 2: PROPOSAL HISTORY & ARCHIVES LOG WITH DATE FILTER */}
      {/* ========================================================================= */}
      {viewMode === 'history' && (
        <div className="space-y-4">
          {/* History Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className={`p-4 rounded-none border ${isDark ? 'bg-[#1C1C1E] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-normal ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{isBn ? 'মোট ফিল্টারকৃত ইতিহাস' : 'Filtered Flights History'}</span>
                <div className="text-blue-600 dark:text-blue-400">
                  <History className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-semibold font-mono mt-2 text-blue-600 dark:text-blue-400">{totalHistoryCount} {isBn ? 'টি ইতিহাস রেকর্ড' : 'Records'}</p>
              <p className={`text-[11px] mt-0.5 font-normal ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{isBn ? 'অনুমোদিত, ডেসপ্যাচড ও ড্রপ রিকোয়েস্ট' : 'Finalized proposals log'}</p>
            </div>

            <div className={`p-4 rounded-none border ${isDark ? 'bg-[#1C1C1E] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-normal ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{isBn ? 'ফিল্টার সময়ে মোট ডেসপ্যাচড ওজন' : 'Period Dispatched Freight Weight'}</span>
                <div className="text-teal-600 dark:text-teal-400">
                  <Plane className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-semibold font-mono mt-2 text-teal-600 dark:text-teal-400">{totalDispatchedWeight.toFixed(1)} kg</p>
              <p className={`text-[11px] mt-0.5 font-normal ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{isBn ? 'সফলভাবে আকাশপথে প্রেরিত' : 'Air cargo weight shipped'}</p>
            </div>

            <div className={`p-4 rounded-none border ${isDark ? 'bg-[#1C1C1E] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-normal ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{isBn ? 'ফিল্টার সময়ে মোট ডেসপ্যাচড CBM' : 'Period Dispatched Volume'}</span>
                <div className="text-purple-600 dark:text-purple-400">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-semibold font-mono mt-2 text-purple-600 dark:text-purple-400">{totalDispatchedCbm.toFixed(2)} CBM</p>
              <p className={`text-[11px] mt-0.5 font-normal ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{isBn ? 'মোট দখলকৃত বিমান ভলিউম' : 'Air container volume'}</p>
            </div>
          </div>

          {/* Advanced Date Range & Filter Bar */}
          <div className={`p-4 rounded-none border space-y-3 text-xs ${
            isDark ? 'bg-[#1C1C1E] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
          }`}>
            {/* Top Row: Date Presets & Date Range Inputs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3.5 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-normal flex items-center space-x-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  <Calendar className="w-3.5 h-3.5 text-[#00897B]" />
                  <span>{isBn ? 'তারিখ ফিল্টার:' : 'Date Filter:'}</span>
                </span>

                {/* Quick Date Range Preset Buttons */}
                <div className={`flex rounded-none p-0.5 border ${isDark ? 'bg-[#121214] border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                  <button
                    onClick={() => applyDatePreset('all')}
                    className={`px-2.5 py-1 rounded-none text-[11px] font-normal transition-all cursor-pointer ${
                      !startDate && !endDate
                        ? 'bg-[#00897B] text-white shadow-xs'
                        : isDark
                        ? 'text-gray-400 hover:text-white'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {isBn ? 'সব সময় (All)' : 'All Time'}
                  </button>
                  <button
                    onClick={() => applyDatePreset('today')}
                    className={`px-2.5 py-1 rounded-none text-[11px] font-normal transition-all cursor-pointer ${
                      startDate && startDate === endDate
                        ? 'bg-[#00897B] text-white shadow-xs'
                        : isDark
                        ? 'text-gray-400 hover:text-white'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {isBn ? 'আজকে' : 'Today'}
                  </button>
                  <button
                    onClick={() => applyDatePreset('this_month')}
                    className={`px-2.5 py-1 rounded-none text-[11px] font-normal transition-all cursor-pointer ${
                      startDate && startDate.endsWith('-01')
                        ? 'bg-[#00897B] text-white shadow-xs'
                        : isDark
                        ? 'text-gray-400 hover:text-white'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {isBn ? 'চলতি মাস' : 'This Month'}
                  </button>
                  <button
                    onClick={() => applyDatePreset('last_30_days')}
                    className={`px-2.5 py-1 rounded-none text-[11px] font-normal transition-all cursor-pointer ${
                      startDate && !startDate.endsWith('-01') && startDate !== endDate
                        ? 'bg-[#00897B] text-white shadow-xs'
                        : isDark
                        ? 'text-gray-400 hover:text-white'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {isBn ? 'গত ৩০ দিন' : 'Last 30 Days'}
                  </button>
                </div>
              </div>

              {/* Precise Date Pickers (From / To) */}
              <div className="flex items-center space-x-2">
                <div className={`flex items-center space-x-1.5 border rounded-none px-2.5 py-1 text-xs ${
                  isDark ? 'bg-[#121214] border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}>
                  <span className="text-[10px] text-slate-500 font-normal">{isBn ? 'হতে:' : 'From:'}</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent outline-none cursor-pointer text-xs font-mono dark:text-white"
                  />
                </div>

                <span className="text-slate-400 text-xs">-</span>

                <div className={`flex items-center space-x-1.5 border rounded-none px-2.5 py-1 text-xs ${
                  isDark ? 'bg-[#121214] border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}>
                  <span className="text-[10px] text-slate-500 font-normal">{isBn ? 'পর্যন্ত:' : 'To:'}</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent outline-none cursor-pointer text-xs font-mono dark:text-white"
                  />
                </div>

                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="p-1.5 rounded-none text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                    title={isBn ? 'তারিখ ফিল্টার রিমুভ করুন' : 'Clear date filter'}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Row: Status Tabs, Warehouse & Search */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className={`flex rounded-none p-0.5 border ${isDark ? 'bg-[#121214] border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                  <button
                    onClick={() => setHistoryStatusFilter('all')}
                    className={`px-3 py-1 rounded-none text-xs font-normal transition-all cursor-pointer ${
                      historyStatusFilter === 'all'
                        ? 'bg-[#00897B] text-white shadow-xs'
                        : isDark
                        ? 'text-gray-400 hover:text-white'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {isBn ? 'সব ইতিহাস (All)' : 'All History'}
                  </button>
                  <button
                    onClick={() => setHistoryStatusFilter('dispatched')}
                    className={`px-3 py-1 rounded-none text-xs font-normal transition-all cursor-pointer ${
                      historyStatusFilter === 'dispatched'
                        ? 'bg-[#00897B] text-white shadow-xs'
                        : isDark
                        ? 'text-gray-400 hover:text-white'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {isBn ? '✈️ ডেসপ্যাচড (Dispatched)' : 'Dispatched'}
                  </button>
                  <button
                    onClick={() => setHistoryStatusFilter('approved')}
                    className={`px-3 py-1 rounded-none text-xs font-normal transition-all cursor-pointer ${
                      historyStatusFilter === 'approved'
                        ? 'bg-[#00897B] text-white shadow-xs'
                        : isDark
                        ? 'text-gray-400 hover:text-white'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {isBn ? '✅ অনুমোদিত' : 'Approved'}
                  </button>
                  <button
                    onClick={() => setHistoryStatusFilter('rejected')}
                    className={`px-3 py-1 rounded-none text-xs font-normal transition-all cursor-pointer ${
                      historyStatusFilter === 'rejected'
                        ? 'bg-[#00897B] text-white shadow-xs'
                        : isDark
                        ? 'text-gray-400 hover:text-white'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {isBn ? '❌ বাতিলকৃত (Rejected)' : 'Rejected'}
                  </button>
                </div>

                <div className={`w-px h-4 mx-0.5 hidden md:block ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

                <div className={`flex items-center space-x-2 border rounded-none px-2.5 py-1.5 ${isDark ? 'bg-[#121214] border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
                  <WarehouseIcon className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={warehouseFilter}
                    onChange={(e) => setWarehouseFilter(e.target.value)}
                    className="bg-transparent outline-none cursor-pointer text-xs font-normal dark:bg-[#121214] dark:text-white"
                  >
                    <option value="all" className="bg-white text-gray-900 dark:bg-[#1C1C1E] dark:text-white">{isBn ? 'সব ওয়্যারহাউজ (All Origin Hubs)' : 'All Origin Hubs'}</option>
                    <option value="wh-china" className="bg-white text-gray-900 dark:bg-[#1C1C1E] dark:text-white">গুয়াংজু ওয়্যারহাউজ (China)</option>
                    <option value="wh-hk" className="bg-white text-gray-900 dark:bg-[#1C1C1E] dark:text-white">হংকং ওয়্যারহাউজ (Hong Kong)</option>
                  </select>
                </div>
              </div>

              <div className="relative min-w-[220px]">
                <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDark ? 'text-gray-400' : 'text-slate-400'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isBn ? 'ইতিহাস সার্চ: ID, ফ্লাইট নং...' : 'Search proposal history...'}
                  className={`w-full border rounded-none py-1.5 pl-8 pr-3 text-xs outline-none font-normal ${
                    isDark ? 'bg-[#121214] border-slate-700 text-white placeholder-gray-400' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Historical Proposals Table / Logs List */}
          <div className="overflow-x-auto border rounded-none shadow-xs">
            <table className={`w-full text-left text-xs ${isDark ? 'bg-[#1C1C1E] text-white' : 'bg-white text-slate-900'}`}>
              <thead className={`uppercase text-[10px] tracking-wider border-b ${
                isDark ? 'bg-[#121214] text-gray-400 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200 font-normal'
              }`}>
                <tr>
                  <th className="p-3">প্রস্তাবনা ID ও ফ্লাইট</th>
                  <th className="p-3">ওয়্যারহাউজ হাব</th>
                  <th className="p-3">রিকোয়েস্ট তারিখ</th>
                  <th className="p-3">কার্টুন ও গ্রস লোড</th>
                  <th className="p-3">চূড়ান্ত স্টেটাস</th>
                  <th className="p-3">চূড়ান্ত সিদ্ধান্তকারী</th>
                  <th className="p-3 text-right">ম্যানিফেস্ট ও অডিট</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-200'}`}>
                {filteredHistoricalProposals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-xs font-normal text-slate-500">
                      {isBn ? 'নির্বাচিত তারিখ ফিল্টারে কোনো ইতিহাস রেকর্ড পাওয়া যায়নি।' : 'No proposal history found for selected date range.'}
                    </td>
                  </tr>
                ) : (
                  filteredHistoricalProposals.map((prop) => (
                    <tr key={prop.id} className={isDark ? 'hover:bg-[#222224]' : 'hover:bg-slate-50'}>
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <span className={`font-mono font-medium ${isDark ? 'text-teal-400' : 'text-[#00897B]'}`}>#{prop.id.toUpperCase()}</span>
                          {prop.flight_number && (
                            <span className={`px-2 py-0.5 rounded-none text-[10px] font-mono font-normal border ${
                              isDark ? 'bg-blue-950/60 text-blue-300 border-blue-800' : 'bg-blue-50 text-blue-900 border-blue-200'
                            }`}>
                              ✈️ {prop.flight_number}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal mt-0.5">{prop.airline || 'Air Freight Service'}</p>
                      </td>

                      <td className="p-3">
                        <span className="font-normal block text-slate-800 dark:text-slate-200">{prop.warehouse_name}</span>
                        <span className="text-[10px] text-slate-500 block font-normal">{isBn ? 'প্রস্তাবক:' : 'Requested:'} {prop.proposed_by_name}</span>
                      </td>

                      <td className="p-3 font-mono font-normal text-slate-700 dark:text-slate-300">
                        {prop.date}
                      </td>

                      <td className="p-3 font-mono">
                        <span className="font-medium text-slate-900 dark:text-white block">{prop.items_count} {isBn ? 'টি কার্টুন' : 'cartons'} • {prop.total_weight.toFixed(1)} kg</span>
                        <span className="text-[10px] text-purple-700 dark:text-purple-400 font-normal block">{prop.total_cbm.toFixed(2)} CBM (৳{(prop.total_weight * 320).toLocaleString()})</span>
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-none text-[11px] font-normal border inline-flex items-center space-x-1 ${
                            prop.status === 'dispatched'
                              ? isDark
                                ? 'bg-blue-950/60 text-blue-300 border-blue-800'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                              : prop.status === 'approved'
                              ? isDark
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isDark
                              ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {prop.status === 'dispatched'
                            ? '✈️ ডেসপ্যাচড'
                            : prop.status === 'approved'
                            ? '✅ অনুমোদিত'
                            : '❌ বাতিল'}
                        </span>
                        {prop.rejection_note && (
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 max-w-xs line-clamp-1 font-normal">
                            {prop.rejection_note}
                          </p>
                        )}
                      </td>

                      <td className="p-3">
                        <span className="font-normal block text-slate-800 dark:text-slate-200">{prop.finalized_by || 'তানভীর আহমেদ (Super Admin)'}</span>
                        <span className="text-[10px] text-slate-500 block font-mono font-normal">
                          {prop.finalized_at ? new Date(prop.finalized_at).toLocaleDateString() : prop.date}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => setPrintManifestProposal(prop)}
                            className="px-2.5 py-1 rounded-none text-[11px] font-normal bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer inline-flex items-center space-x-1"
                            title={isBn ? 'ম্যানিফেস্ট প্রিন্ট রিপোর্ট' : 'Print Flight Manifest'}
                          >
                            <Printer className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                            <span>{isBn ? 'প্রিন্ট' : 'Print'}</span>
                          </button>

                          <button
                            onClick={() => setActiveModalProposal(prop)}
                            className="px-2.5 py-1 rounded-none text-[11px] font-normal bg-[#00897B]/10 text-[#00897B] hover:bg-[#00897B]/20 border border-[#00897B]/30 transition-all cursor-pointer inline-flex items-center space-x-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{isBn ? 'অডিট' : 'Audit'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE CARTON AUDIT & MODIFICATION INSPECTOR MODAL */}
      {/* ========================================================================= */}
      {activeModalProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-backdrop-blur-fade">
          <div className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-none border p-6 space-y-5 shadow-2xl animate-modal-pop-bounce ${
            isDark ? 'bg-[#1C1C1E] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3.5 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className={`text-base font-normal flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <Plane className="w-5 h-5 text-[#00897B]" />
                    <span>{isBn ? 'ফ্লাইট প্রস্তাবনা অডিট ও কার্টুন কনফিগারেশন' : 'Flight Proposal Audit & Carton Payload Config'}</span>
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-none text-xs font-mono font-normal border ${
                    isDark ? 'bg-teal-950/60 text-teal-300 border-teal-800' : 'bg-teal-50 text-teal-900 border-teal-200'
                  }`}>
                    #{activeModalProposal.id.toUpperCase()}
                  </span>
                </div>
                <p className={`text-xs mt-1 font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {activeModalProposal.warehouse_name} • {isBn ? 'প্রস্তাবক:' : 'Requested by:'} {activeModalProposal.proposed_by_name} ({activeModalProposal.date})
                </p>
              </div>

              <button
                onClick={() => setActiveModalProposal(null)}
                className={`p-1.5 rounded-none transition-all cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className={`p-4 rounded-none border grid grid-cols-2 sm:grid-cols-4 gap-3 text-center ${
              isDark ? 'bg-[#121214] border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <span className={`text-[11px] font-normal uppercase block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{isBn ? 'মোট কার্টুন' : 'Carton Count'}</span>
                <span className={`font-mono font-medium text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>{activeModalProposal.items_count} {isBn ? 'টি' : 'units'}</span>
              </div>
              <div>
                <span className={`text-[11px] font-normal uppercase block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{isBn ? 'মোট গ্রস ওজন (KG)' : 'Gross Weight'}</span>
                <span className={`font-mono font-medium text-base ${isDark ? 'text-teal-400' : 'text-[#00897B]'}`}>{activeModalProposal.total_weight.toFixed(1)} kg</span>
              </div>
              <div>
                <span className={`text-[11px] font-normal uppercase block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{isBn ? 'মোট ভলিউম (CBM)' : 'Total Volume'}</span>
                <span className={`font-mono font-medium text-base ${isDark ? 'text-purple-400' : 'text-purple-900'}`}>{activeModalProposal.total_cbm.toFixed(2)} CBM</span>
              </div>
              <div>
                <span className={`text-[11px] font-normal uppercase block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{isBn ? 'আনুমানিক এয়ার ফ্রেইট' : 'Est. Air Freight'}</span>
                <span className={`font-mono font-medium text-base ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>৳{(activeModalProposal.total_weight * 320).toLocaleString()}</span>
              </div>
            </div>

            <div className={`flex items-center justify-between border-b pb-2 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <h3 className={`text-xs font-normal uppercase tracking-wider flex items-center space-x-2 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                <Package className="w-4 h-4 text-[#00897B]" />
                <span>{isBn ? 'ফ্লাইটে প্রস্তাবিত কার্টুন তালিকা (Attached Cartons)' : 'Attached Cartons Payload List'}</span>
              </h3>

              {activeModalProposal.status !== 'dispatched' && (
                <button
                  onClick={() => setShowAddCartonModal(true)}
                  className="px-3 py-1.5 rounded-none text-xs font-normal bg-[#00897B] hover:bg-[#00796B] text-white transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{isBn ? '+ ইনভেন্টরি থেকে কার্টুন যোগ করুন' : '+ Add Cartons from Wh'}</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto border rounded-none">
              <table className={`w-full text-left text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <thead className={`uppercase text-[10px] tracking-wider border-b ${
                  isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-200 font-medium'
                }`}>
                  <tr>
                    <th className="p-2.5 w-8 text-center font-normal">SL</th>
                    <th className="p-2.5 font-normal whitespace-nowrap">CTN NO</th>
                    <th className="p-2.5 font-normal whitespace-nowrap">SHIPPING MARK</th>
                    <th className="p-2.5 font-normal whitespace-nowrap">TRACKING NO</th>
                    <th className="p-2.5 font-normal whitespace-nowrap">PRODUCT</th>
                    <th className="p-2.5 text-center font-normal whitespace-nowrap">QTY / N.WT</th>
                    <th className="p-2.5 text-center font-normal whitespace-nowrap">G.WEIGHT</th>
                    <th className="p-2.5 text-center font-normal whitespace-nowrap">CBM</th>
                    <th className="p-2.5 text-center font-normal whitespace-nowrap">PROOF</th>
                    <th className="p-2.5 text-right font-normal whitespace-nowrap">ACTION</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                  {getProposalCartons(activeModalProposal).length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-xs font-normal text-slate-500">
                        {isBn ? 'এই প্রস্তাবনায় কোনো কার্টুন যুক্ত নেই। "+ ইনভেন্টরি থেকে যোগ করুন" ক্লিক করুন।' : 'No cartons attached. Click Add Cartons to attach.'}
                      </td>
                    </tr>
                  ) : (
                    getProposalCartons(activeModalProposal).map((ctn, idx) => (
                      <tr key={ctn.id} className={isDark ? 'hover:bg-slate-900/60' : 'hover:bg-slate-50'}>
                        <td className="p-2.5 text-center font-mono text-slate-500 text-[11px]">{idx + 1}</td>
                        <td className="p-2.5 font-mono whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-none font-mono text-[11px] font-medium border ${
                            isDark ? 'bg-slate-900 text-teal-400 border-slate-700' : 'bg-slate-50 text-[#00897B] border-slate-300'
                          }`}>
                            {ctn.ctn_no}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono font-semibold text-slate-800 dark:text-slate-200 text-[11px] whitespace-nowrap">
                          {ctn.shipping_mark || 'N/A'}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap">
                          {ctn.tracking_number}
                        </td>
                        <td className="p-2.5 font-normal text-slate-700 dark:text-slate-300 text-[11px]">
                          <p className="font-medium text-slate-800 dark:text-slate-200">{ctn.product_name_en || 'Product'}</p>
                          {ctn.product_name_cn && <p className="text-[10px] text-slate-400">{ctn.product_name_cn}</p>}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap">
                          {ctn.quantity || 1} pcs | {ctn.net_weight || 0} kg
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-900 dark:text-white text-[11px] whitespace-nowrap">
                          {ctn.gross_weight} kg
                        </td>
                        <td className="p-2.5 text-center font-mono font-medium text-purple-700 dark:text-purple-400 text-[11px] whitespace-nowrap">
                          {ctn.cbm} CBM
                        </td>
                        <td className="p-2.5 text-center text-[11px] whitespace-nowrap">
                          {ctn.photo_url || (ctn.photo_proofs && ctn.photo_proofs.length > 0) ? (
                            <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <span>📷 Photo</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-light">No Photo</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right whitespace-nowrap">
                          {activeModalProposal.status !== 'dispatched' ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveCartonFromProposal(activeModalProposal.id, ctn.id)}
                              className="px-2.5 py-1 rounded-none text-[11px] font-normal bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer inline-flex items-center space-x-1"
                              title={isBn ? 'প্রস্তাবনা থেকে কার্টুন রিমুভ করুন' : 'Remove carton from proposal'}
                            >
                              <Trash2 className="w-3 h-3 text-rose-600" />
                              <span>{isBn ? 'রিমুভ' : 'Remove'}</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-normal text-slate-400">{isBn ? 'লকড' : 'Locked'}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setActiveModalProposal(null)}
                className={`px-4 py-2 rounded-none text-xs font-normal border transition-all cursor-pointer ${
                  isDark ? 'bg-[#121214] border-slate-700 text-gray-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>

              <div className="flex items-center space-x-2">
                {activeModalProposal.status !== 'rejected' && (
                  <button
                    onClick={() => handleUpdateProposalStatus(activeModalProposal.id, 'rejected')}
                    className="px-4 py-2 rounded-none text-xs font-normal bg-rose-600 hover:bg-rose-700 text-white transition-all cursor-pointer flex items-center space-x-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{isBn ? 'প্রস্তাবনা বাতিল করুন' : 'Reject Proposal'}</span>
                  </button>
                )}

                {activeModalProposal.status !== 'approved' && activeModalProposal.status !== 'dispatched' && (
                  <button
                    onClick={() => handleUpdateProposalStatus(activeModalProposal.id, 'approved')}
                    className="px-5 py-2 rounded-none text-xs font-normal bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isBn ? 'প্রস্তাবনা অনুমোদন করুন' : 'Approve Proposal'}</span>
                  </button>
                )}

                {activeModalProposal.status === 'approved' && (
                  <button
                    onClick={() => handleUpdateProposalStatus(activeModalProposal.id, 'dispatched')}
                    className="px-5 py-2 rounded-none text-xs font-normal bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
                  >
                    <Plane className="w-4 h-4" />
                    <span>{isBn ? 'ফ্লাইটে রওয়ানা নিশ্চিত করুন' : 'Confirm Flight Dispatch'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SUB-MODAL: SIDE-BY-SIDE 2-COLUMN ATTACH & PREVIEW WORKSPACE */}
      {/* ========================================================================= */}
      {showAddCartonModal && activeModalProposal && (() => {
        // Current attached cartons in this proposal
        const currentAttachedCartons = cartons.filter(
          (c) => (activeModalProposal.carton_ids || []).includes(c.id) || c.flight_number === (activeModalProposal.flying_name || activeModalProposal.flight_number)
        );

        // Available unassigned cartons in origin warehouse
        const unassignedCartonsInWh = cartons.filter(
          (c) => c.current_warehouse_id === activeModalProposal.warehouse_id &&
                 (c.status === 'booked' || c.status === 'received') &&
                 !(activeModalProposal.carton_ids || []).includes(c.id)
        );

        const filteredUnassignedCartons = unassignedCartonsInWh.filter((c) => {
          if (!addCartonSearch.trim()) return true;
          const q = addCartonSearch.toLowerCase().trim();
          return (
            c.ctn_no.toLowerCase().includes(q) ||
            c.tracking_number.toLowerCase().includes(q) ||
            (c.shipping_mark || '').toLowerCase().includes(q) ||
            (c.product_name_en || '').toLowerCase().includes(q)
          );
        });

        const allFilteredSelected = filteredUnassignedCartons.length > 0 && filteredUnassignedCartons.every((c) => selectedUnassignedCartonIds.includes(c.id));

        const toggleSelectAllUnassigned = () => {
          if (allFilteredSelected) {
            const filteredIds = new Set(filteredUnassignedCartons.map((c) => c.id));
            setSelectedUnassignedCartonIds(selectedUnassignedCartonIds.filter((id) => !filteredIds.has(id)));
          } else {
            const updated = Array.from(new Set([...selectedUnassignedCartonIds, ...filteredUnassignedCartons.map((c) => c.id)]));
            setSelectedUnassignedCartonIds(updated);
          }
        };

        // Cartons selected from stock to be added
        const newlySelectedCartons = cartons.filter((c) => selectedUnassignedCartonIds.includes(c.id));

        // Combined payload preview (existing attached + newly selected)
        const combinedPayloadPreview = [...currentAttachedCartons, ...newlySelectedCartons];
        const previewTotalCount = combinedPayloadPreview.length;
        const previewTotalWeight = combinedPayloadPreview.reduce((acc, c) => acc + c.gross_weight, 0);
        const previewTotalCbm = combinedPayloadPreview.reduce((acc, c) => acc + c.cbm, 0);

        const filteredAttachedPayloadPreview = combinedPayloadPreview.filter((c) => {
          if (!attachedCartonSearch.trim()) return true;
          const q = attachedCartonSearch.toLowerCase().trim();
          return (
            c.ctn_no.toLowerCase().includes(q) ||
            c.tracking_number.toLowerCase().includes(q) ||
            (c.shipping_mark || '').toLowerCase().includes(q) ||
            (c.product_name_en || '').toLowerCase().includes(q)
          );
        });

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-sans animate-backdrop-blur-fade">
            <div className={`w-full max-w-7xl max-h-[92vh] flex flex-col rounded-none border shadow-2xl overflow-hidden font-sans ${
              isDark ? 'bg-[#18181B] border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
            }`}>
              {/* Modal Header */}
              <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
                isDark ? 'bg-[#18181B] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-none bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-600/20">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                      <span>{isBn ? 'প্রস্তাবনা কার্টুন কনফিগারেশন ও সাইড-বাই-সাইড প্রিভিউ' : 'Flight Proposal Payload Config & Side-by-Side Preview'}</span>
                      <span className="px-2 py-0.5 rounded-none text-[10px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 font-normal border border-blue-500/20">
                        {activeModalProposal.flying_name || activeModalProposal.flight_number}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                      {activeModalProposal.warehouse_name} {isBn ? 'হাব থেকে স্টক কার্টুন যোগ বা বাদ দিয়ে লাইভ প্রিভিউ দেখুন' : 'Manage cartons with real-time payload preview'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddCartonModal(false)}
                  className="p-2 rounded-none text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer border border-transparent hover:border-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* SIDE-BY-SIDE SPLIT BODY (Left: Available Stock, Right: Proposal Payload Preview) */}
              <div className="grid grid-cols-1 xl:grid-cols-12 flex-1 min-h-0 divide-y xl:divide-y-0 xl:divide-x divide-slate-200 dark:divide-slate-800 overflow-hidden">

                {/* LEFT PANEL (6 cols / 50% Width): Available Stock Cartons */}
                <div className="xl:col-span-6 flex flex-col min-h-0 p-3 sm:p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                      <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>{isBn ? '১. আন-অ্যাসাইন্ড স্টক কার্টুনসমূহ (Available Stock)' : '1. Available Stock Cartons'}</span>
                      <span className="text-[11px] font-mono text-slate-400 font-normal">({unassignedCartonsInWh.length})</span>
                    </h4>

                    <button
                      type="button"
                      onClick={toggleSelectAllUnassigned}
                      disabled={filteredUnassignedCartons.length === 0}
                      className="py-1 px-3 rounded-none border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-normal text-xs transition-all cursor-pointer disabled:opacity-40"
                    >
                      {allFilteredSelected ? (isBn ? 'সব আনসিলেক্ট' : 'Deselect All') : (isBn ? 'সব সিলেক্ট করুন' : 'Select All')}
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={isBn ? 'কার্টুন নম্বর, ট্র্যাকিং আইডি, শিপিং মার্ক দিয়ে খুঁজুন...' : 'Search Stock CTN, Tracking ID, Mark...'}
                      value={addCartonSearch}
                      onChange={(e) => setAddCartonSearch(e.target.value)}
                      className={`w-full pl-8 pr-3 py-1.5 rounded-none border text-xs outline-none transition-all font-normal focus:ring-1 focus:ring-blue-500 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                      }`}
                    />
                  </div>

                  <div className={`flex-1 overflow-x-auto overflow-y-auto max-h-[52vh] rounded-none border ${isDark ? "bg-[#0E0E10] border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"}`}>
                    <table className="min-w-max w-full text-left text-xs font-light">
                      <thead className={`uppercase text-[10px] tracking-wider border-b sticky top-0 z-10 ${
                        isDark ? 'bg-[#18181B] text-slate-300 border-slate-800 font-medium' : 'bg-slate-100 text-slate-700 border-slate-200 font-medium'
                      }`}>
                        <tr>
                          <th className="p-2.5 w-8 text-center font-normal">
                            <input
                              type="checkbox"
                              checked={allFilteredSelected}
                              onChange={toggleSelectAllUnassigned}
                              className="w-3.5 h-3.5 rounded-none text-blue-600 border-slate-300 cursor-pointer accent-blue-600"
                            />
                          </th>
                          <th className="p-2.5 w-8 text-center font-normal">SL</th>
                          <th className="p-2.5 font-normal whitespace-nowrap">CTN NO</th>
                          <th className="p-2.5 font-normal whitespace-nowrap">SHIPPING MARK</th>
                          <th className="p-2.5 font-normal whitespace-nowrap">TRACKING NO</th>
                          <th className="p-2.5 font-normal whitespace-nowrap">PRODUCT</th>
                          <th className="p-2.5 text-center font-normal whitespace-nowrap">QTY / N.WT</th>
                          <th className="p-2.5 text-center font-normal whitespace-nowrap">G.WEIGHT</th>
                          <th className="p-2.5 text-center font-normal whitespace-nowrap">CBM</th>
                          <th className="p-2.5 text-center font-normal whitespace-nowrap">PROOF</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-200 text-slate-700'}`}>
                        {filteredUnassignedCartons.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="p-6 text-center text-xs text-slate-400 font-light">
                              {isBn ? 'যুক্ত করার মতো কোনো অন-হোল্ড কার্টুন পাওয়া যায়নি' : 'No available cartons found.'}
                            </td>
                          </tr>
                        ) : (
                          filteredUnassignedCartons.map((c, idx) => {
                            const isChecked = selectedUnassignedCartonIds.includes(c.id);
                            return (
                              <tr
                                key={c.id}
                                onClick={() => {
                                  if (isChecked) {
                                    setSelectedUnassignedCartonIds(selectedUnassignedCartonIds.filter((id) => id !== c.id));
                                  } else {
                                    setSelectedUnassignedCartonIds([...selectedUnassignedCartonIds, c.id]);
                                  }
                                }}
                                className={`hover:bg-blue-50/40 dark:hover:bg-slate-900/60 cursor-pointer transition-colors ${
                                  isChecked ? (isDark ? 'bg-blue-950/30' : 'bg-blue-50/70') : ''
                                }`}
                              >
                                <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setSelectedUnassignedCartonIds(selectedUnassignedCartonIds.filter((id) => id !== c.id));
                                      } else {
                                        setSelectedUnassignedCartonIds([...selectedUnassignedCartonIds, c.id]);
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded-none text-blue-600 border-slate-300 cursor-pointer accent-blue-600"
                                  />
                                </td>
                                <td className="p-2.5 text-center font-mono text-slate-500 text-[11px]">{idx + 1}</td>
                                <td className="p-2.5 font-mono whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded-none bg-slate-100 dark:bg-[#18181B] text-teal-700 dark:text-teal-400 font-mono text-[11px] font-medium border border-slate-300 dark:border-slate-700">
                                    {c.ctn_no}
                                  </span>
                                </td>
                                <td className="p-2.5 font-mono font-semibold text-slate-800 dark:text-slate-200 text-[11px] whitespace-nowrap">
                                  {c.shipping_mark || 'N/A'}
                                </td>
                                <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                  {c.tracking_number}
                                </td>
                                <td className="p-2.5 font-normal text-slate-700 dark:text-slate-300 text-[11px]">
                                  <p className="font-medium text-slate-800 dark:text-slate-200">{c.product_name_en || 'Product'}</p>
                                  {c.product_name_cn && <p className="text-[10px] text-slate-400">{c.product_name_cn}</p>}
                                </td>
                                <td className="p-2.5 text-center font-mono text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                  {c.quantity || 1} pcs | {c.net_weight || 0} kg
                                </td>
                                <td className="p-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[11px] whitespace-nowrap">
                                  {c.gross_weight} kg
                                </td>
                                <td className="p-2.5 text-center font-mono font-medium text-purple-600 dark:text-purple-400 text-[11px] whitespace-nowrap">
                                  {c.cbm} CBM
                                </td>
                                <td className="p-2.5 text-center text-[11px] whitespace-nowrap">
                                  {c.photo_url || (c.photo_proofs && c.photo_proofs.length > 0) ? (
                                    <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                      <span>📷 Photo</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-light">No Photo</span>
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

                {/* RIGHT PANEL (6 cols / 50% Width): Attached Proposal Payload Live Preview Table */}
                <div className={`xl:col-span-6 flex flex-col min-h-0 p-3 sm:p-4 space-y-3 ${isDark ? "bg-[#121214]" : "bg-slate-50/70"}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                      <Plane className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{isBn ? '২. প্রস্তাবনায় যুক্ত কার্টুন লাইভ প্রিভিউ' : '2. Attached Proposal Payload Preview'}</span>
                    </h4>
                    <span className="px-2 py-0.5 rounded-none text-[11px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                      {previewTotalCount} {isBn ? 'টি কার্টুন' : 'Cartons'}
                    </span>
                  </div>

                  {/* SYMMETRIC SEARCH INPUT MATCHING LEFT PANEL POSITION */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={isBn ? 'কার্টুন নম্বর, ট্র্যাকিং আইডি, শিপিং মার্ক দিয়ে খুঁজুন...' : 'Search Attached CTN, Tracking ID, Mark...'}
                      value={attachedCartonSearch}
                      onChange={(e) => setAttachedCartonSearch(e.target.value)}
                      className={`w-full pl-8 pr-3 py-1.5 rounded-none border text-xs outline-none transition-all font-normal focus:ring-1 focus:ring-blue-500 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                      }`}
                    />
                  </div>

                  <div className={`flex-1 overflow-x-auto overflow-y-auto max-h-[52vh] rounded-none border ${isDark ? "bg-[#0E0E10] border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"}`}>
                    <table className="min-w-max w-full text-left text-xs font-light">
                      <thead className={`uppercase text-[10px] tracking-wider border-b sticky top-0 z-10 ${
                        isDark ? 'bg-[#18181B] text-slate-300 border-slate-800 font-medium' : 'bg-slate-100 text-slate-700 border-slate-200 font-medium'
                      }`}>
                        <tr>
                          <th className="p-2.5 w-8 text-center font-normal">SL</th>
                          <th className="p-2.5 font-normal whitespace-nowrap">CTN NO</th>
                          <th className="p-2.5 font-normal whitespace-nowrap">SHIPPING MARK</th>
                          <th className="p-2.5 font-normal whitespace-nowrap">TRACKING NO</th>
                          <th className="p-2.5 font-normal whitespace-nowrap">PRODUCT</th>
                          <th className="p-2.5 text-center font-normal whitespace-nowrap">QTY / N.WT</th>
                          <th className="p-2.5 text-center font-normal whitespace-nowrap">G.WEIGHT</th>
                          <th className="p-2.5 text-center font-normal whitespace-nowrap">CBM</th>
                          <th className="p-2.5 text-center font-normal whitespace-nowrap">PROOF</th>
                          <th className="p-2.5 text-right font-normal whitespace-nowrap">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-200 text-slate-700'}`}>
                        {filteredAttachedPayloadPreview.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-none">
                              {attachedCartonSearch
                                ? (isBn ? 'খুঁজে পাওয়া যায়নি! অন্য কিওয়ার্ড দিয়ে টাইপ করুন।' : 'No attached cartons matching search query.')
                                : (isBn ? 'এই প্রস্তাবনায় এখনো কোনো কার্টুন যুক্ত নেই।' : 'No cartons attached to this proposal yet.')}
                            </td>
                          </tr>
                        ) : (
                          filteredAttachedPayloadPreview.map((ctn, idx) => {
                            const isNewlySelected = selectedUnassignedCartonIds.includes(ctn.id);
                            return (
                              <tr
                                key={ctn.id}
                                className={`hover:bg-slate-100/50 dark:hover:bg-slate-900/60 transition-colors ${
                                  isNewlySelected ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''
                                }`}
                              >
                                <td className="p-2.5 text-center font-mono text-slate-500 text-[11px]">{idx + 1}</td>
                                <td className="p-2.5 font-mono whitespace-nowrap flex items-center space-x-1">
                                  <span className="px-2 py-0.5 rounded-none bg-blue-50 dark:bg-[#18181B] text-blue-700 dark:text-blue-400 font-mono text-[11px] font-medium border border-blue-300 dark:border-blue-700">
                                    {ctn.ctn_no}
                                  </span>
                                  {isNewlySelected && (
                                    <span className="px-1 py-0.2 rounded-none text-[8px] font-mono bg-blue-600 text-white">NEW</span>
                                  )}
                                </td>
                                <td className="p-2.5 font-mono font-semibold text-slate-800 dark:text-slate-200 text-[11px] whitespace-nowrap">
                                  {ctn.shipping_mark || 'N/A'}
                                </td>
                                <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                  {ctn.tracking_number}
                                </td>
                                <td className="p-2.5 font-normal text-slate-700 dark:text-slate-300 text-[11px]">
                                  <p className="font-medium text-slate-800 dark:text-slate-200">{ctn.product_name_en || 'Product'}</p>
                                  {ctn.product_name_cn && <p className="text-[10px] text-slate-400">{ctn.product_name_cn}</p>}
                                </td>
                                <td className="p-2.5 text-center font-mono text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                  {ctn.quantity || 1} pcs | {ctn.net_weight || 0} kg
                                </td>
                                <td className="p-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[11px] whitespace-nowrap">
                                  {ctn.gross_weight} kg
                                </td>
                                <td className="p-2.5 text-center font-mono font-medium text-purple-600 dark:text-purple-400 text-[11px] whitespace-nowrap">
                                  {ctn.cbm} CBM
                                </td>
                                <td className="p-2.5 text-center text-[11px] whitespace-nowrap">
                                  {ctn.photo_url || (ctn.photo_proofs && ctn.photo_proofs.length > 0) ? (
                                    <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                      <span>📷 Photo</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-light">No Photo</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isNewlySelected) {
                                        setSelectedUnassignedCartonIds(selectedUnassignedCartonIds.filter((id) => id !== ctn.id));
                                      } else {
                                        handleRemoveCartonFromProposal(activeModalProposal.id, ctn.id);
                                      }
                                    }}
                                    className="p-1 rounded-none text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 border border-transparent hover:border-red-300 transition-all cursor-pointer"
                                    title={isBn ? 'প্রস্তাবনা থেকে রিমুভ করুন' : 'Remove from proposal'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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
              </div>

              {/* Modal Summary & Action Footer */}
              <div className={`p-3.5 sm:p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
                isDark ? 'bg-[#18181B] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-600 dark:text-slate-400 font-light">
                  <span className="px-2.5 py-1 rounded-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-normal border border-slate-300 dark:border-slate-700">
                    📦 {previewTotalCount} {isBn ? 'টি কার্টুন' : 'Cartons Total'}
                  </span>
                  <span>
                    মোট ওজন: <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">{previewTotalWeight.toFixed(1)} KG</strong>
                  </span>
                  <span>•</span>
                  <span>
                    মোট ভলিউম: <strong className="text-purple-600 dark:text-purple-400 font-mono font-medium">{previewTotalCbm.toFixed(2)} CBM</strong>
                  </span>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowAddCartonModal(false)}
                    className="flex-1 sm:flex-none py-2 px-4 rounded-none border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-light text-xs transition-all cursor-pointer"
                  >
                    {isBn ? 'বন্ধ করুন' : 'Close'}
                  </button>

                  {selectedUnassignedCartonIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        handleAddCartonsToProposal(activeModalProposal.id);
                        setShowAddCartonModal(false);
                      }}
                      className="flex-1 sm:flex-none py-2 px-5 rounded-none bg-blue-600 hover:bg-blue-700 text-white font-normal text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer border border-blue-600"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>
                        {isBn
                          ? `প্রস্তাবনায় ${selectedUnassignedCartonIds.length} টি নতুন কার্টুন সেভ করুন`
                          : `Save & Attach ${selectedUnassignedCartonIds.length} Cartons`}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 7. PRINTABLE FLIGHT MANIFEST REPORT MODAL */}
      {/* ========================================================================= */}
      {printManifestProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-none bg-white border border-slate-300 p-8 text-slate-900 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-none bg-teal-800 text-white flex items-center justify-center">
                  <Plane className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-slate-900">M/S FOUR STAR CARGO SYSTEM</h2>
                  <p className="text-xs text-slate-500 font-mono">OFFICIAL AIR FREIGHT MANIFEST REPORT</p>
                </div>
              </div>

              <div className="text-right">
                <span className="px-3 py-1 rounded-none text-xs font-mono font-medium bg-teal-100 text-teal-900 border border-teal-300">
                  MANIFEST #{printManifestProposal.id.toUpperCase()}
                </span>
                <p className="text-xs font-mono text-slate-500 mt-1">Date: {printManifestProposal.date}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-none bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 block uppercase font-normal">Flight No / Airline</span>
                <span className="font-mono font-medium text-slate-900">{printManifestProposal.flight_number || 'N/A'} ({printManifestProposal.airline || 'Air Freight'})</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block uppercase font-normal">Origin Hub</span>
                <span className="font-medium text-slate-900">{printManifestProposal.warehouse_name}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block uppercase font-normal">Total Payload</span>
                <span className="font-mono font-medium text-teal-800">{printManifestProposal.total_weight.toFixed(1)} kg / {printManifestProposal.total_cbm.toFixed(2)} CBM</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block uppercase font-normal">Final Status</span>
                <span className="font-mono font-medium text-emerald-800 uppercase">{printManifestProposal.status}</span>
              </div>
            </div>

            <div className="border rounded-none overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-normal uppercase text-[10px]">
                  <tr>
                    <th className="p-3"># Carton No</th>
                    <th className="p-3">Tracking Code</th>
                    <th className="p-3">Product Description</th>
                    <th className="p-3">Weight (KG)</th>
                    <th className="p-3">CBM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {getProposalCartons(printManifestProposal).map((c, i) => (
                    <tr key={c.id}>
                      <td className="p-3 font-mono font-medium text-teal-800">{c.ctn_no}</td>
                      <td className="p-3 font-mono text-slate-800">{c.tracking_number}</td>
                      <td className="p-3 font-normal">{c.product_name_en}</td>
                      <td className="p-3 font-mono font-medium">{c.gross_weight} kg</td>
                      <td className="p-3 font-mono">{c.cbm} CBM</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-center">
              <div>
                <div className="h-10 border-b border-dashed border-slate-400 mb-1" />
                <p className="font-normal text-slate-700">Prepared by Warehouse Incharge</p>
                <p className="text-[10px] text-slate-400 font-mono">{printManifestProposal.proposed_by_name}</p>
              </div>

              <div>
                <div className="h-10 border-b border-dashed border-slate-400 mb-1" />
                <p className="font-normal text-slate-700">Approved by Operations Director / Super Admin</p>
                <p className="text-[10px] text-slate-400 font-mono">{printManifestProposal.finalized_by || 'Tanvir Ahmed (Super Admin)'}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between no-print">
              <button
                onClick={() => setPrintManifestProposal(null)}
                className="px-4 py-2 rounded-none text-xs font-normal bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
              >
                Close Report
              </button>

              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-none text-xs font-normal bg-[#00897B] hover:bg-[#00796B] text-white shadow-sm flex items-center space-x-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official Manifest</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
