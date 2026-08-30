import React, { useState } from 'react';
import {
  Truck,
  Plane,
  CheckCircle2,
  Search,
  Filter,
  Package,
  Calendar,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { FlyingProposal, Carton, Warehouse, User, Language } from '../types';
import { useTheme } from '../context/ThemeContext';
import { ToastContainer, ToastMessage } from './Toast';
import { getHostingerDbData, saveHostingerDbData, saveHostingerDbMultiData, logSystemAuditAction } from '../lib/db';

interface ReceiveFlyingSectionProps {
  proposals?: FlyingProposal[];
  setProposals?: React.Dispatch<React.SetStateAction<FlyingProposal[]>>;
  cartons: Carton[];
  setCartons: React.Dispatch<React.SetStateAction<Carton[]>>;
  currentUser: User;
  language: Language;
}

export const ReceiveFlyingSection: React.FC<ReceiveFlyingSectionProps> = ({
  proposals: initialProposals,
  setProposals: parentSetProposals,
  cartons,
  setCartons,
  currentUser,
  language,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isBn = language === 'bn';

  const dbData = getHostingerDbData();
  const [localProposals, setLocalProposals] = useState<FlyingProposal[]>(
    initialProposals && initialProposals.length > 0 ? initialProposals : dbData.proposals
  );

  const proposals = initialProposals && initialProposals.length > 0 ? initialProposals : localProposals;
  const updateProposals = parentSetProposals || setLocalProposals;

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_transit' | 'received'>('all');
  const [localWeights, setLocalWeights] = useState<Record<string, string>>({});

  const addToast = (title: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, title, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Handler: Mark Flight Received at Bangladesh Airport (By Operations Director)
  const handleMarkReceivedAtBdAirport = (proposalIds: string[], flightNo: string, cartonIds: string[]) => {
    const isBdWarehouseStaff = currentUser?.role === 'warehouse_incharge';

    // 1. Update proposal status to 'arrived_bd' so it unlocks for Warehouse Incharge
    const updatedProposals: FlyingProposal[] = proposals.map((p) => {
      if (proposalIds.includes(p.id) || (flightNo && (p.flight_number === flightNo || p.flying_name === flightNo))) {
        return { ...p, status: isBdWarehouseStaff ? ('received' as const) : ('arrived_bd' as any) };
      }
      return p;
    });
    updateProposals(updatedProposals);

    // 2. Update attached cartons status
    const targetFlightNo = flightNo;
    const updatedCartons: Carton[] = cartons.map((c) => {
      if (cartonIds.includes(c.id) || (targetFlightNo && c.flight_number === targetFlightNo)) {
        return {
          ...c,
          status: isBdWarehouseStaff ? ('received' as const) : ('in_transit' as const),
          current_warehouse_id: isBdWarehouseStaff ? 'wh-bd' : (c.current_warehouse_id || 'wh-china'),
          destination_warehouse_id: 'wh-bd',
        };
      }
      return c;
    });
    setCartons(updatedCartons);

    saveHostingerDbMultiData({
      fsc_vps_proposals: updatedProposals,
      fsc_vps_cartons: updatedCartons,
    });

    logSystemAuditAction(
      currentUser,
      'RECEIVE_FLYING_FLIGHT',
      'flying_proposal',
      flightNo || 'flight-batch',
      `ফ্লাইট ${flightNo || ''} বাংলাদেশ ওয়্যারহাউজে রিসিভ সম্পন্ন (${cartonIds.length}টি কার্টন রিসিভড)`
    );

    // 4. Success Feedback
    addToast(
      isBn
        ? isBdWarehouseStaff
          ? `✅ ফ্লাইট ${flightNo || ''} বাংলাদেশ ওয়্যারহাউজে সফলভাবে স্টক যুক্ত করা হয়েছে!`
          : `✅ ফ্লাইট ${flightNo || ''} বাংলাদেশ এয়ারপোর্টে প্রাপ্ত মার্ক করা হয়েছে! (ওয়্যারহাউজে রিসিভিং ডাটা উন্মুক্ত করা হয়েছে)`
        : `✅ Flight ${flightNo || ''} marked as Arrived at BD Airport!`,
      'success'
    );
  };

  // Filtered proposals list
  const userWhId = currentUser?.warehouse_id || 'wh-bd';
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isWarehouseStaff = currentUser?.role === 'warehouse_incharge';
  const isBdWarehouseStaff = isWarehouseStaff;

  const filteredProposals = proposals.filter((p) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      (p.flying_name || '').toLowerCase().includes(search) ||
      (p.flight_number || '').toLowerCase().includes(search) ||
      (p.awb_number || '').toLowerCase().includes(search) ||
      (p.warehouse_name || '').toLowerCase().includes(search);

    // STRICT DESTINATION SCOPING: A warehouse ONLY receives incoming flights destined for ITSELF!
    if (!isSuperAdmin) {
      const isDestinationMatch =
        p.destination_warehouse_id === userWhId ||
        (p as any).destination_warehouse_name?.toLowerCase().includes((currentUser.warehouse_name || '').toLowerCase());
      if (!isDestinationMatch) return false;
    }

    // CRITICAL REQUIREMENT: If user is Warehouse Incharge, ONLY show flights where Operations has clicked "arrived_bd" or "received"!
    if (isWarehouseStaff && (p.status === 'in_transit' || p.status === 'approved' || p.status === 'pending')) {
      return false;
    }

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'received'
        ? (p.status === 'received' || p.status === ('arrived_bd' as any))
        : p.status === 'in_transit';

    return matchesSearch && matchesStatus;
  });

  // Group filtered proposals into unified Flight Batch rows
  interface GroupedFlightProposal {
    groupKey: string;
    flying_name: string;
    flight_number: string;
    awb_number: string;
    date: string;
    warehouse_name: string;
    destination_warehouse_name: string;
    status: FlyingProposal['status'];
    proposal_ids: string[];
    carton_ids: string[];
    total_cartons: number;
    total_weight: number;
    total_cbm: number;
    sampleProposal: FlyingProposal;
  }

  const groupedFlightsMap = new Map<string, GroupedFlightProposal>();

  filteredProposals.forEach((p) => {
    const key = (p.flight_number || p.flying_name || p.id).toLowerCase().trim();

    if (!groupedFlightsMap.has(key)) {
      groupedFlightsMap.set(key, {
        groupKey: key,
        flying_name: p.flying_name || p.flight_number || 'Flight Batch',
        flight_number: p.flight_number || p.flying_name || 'BS-206',
        awb_number: p.awb_number || '157-884120',
        date: p.date,
        warehouse_name: p.warehouse_name || 'গুয়াংজু ওয়্যারহাউজ',
        destination_warehouse_name: p.destination_warehouse_name || 'ঢাকা সেন্ট্রাল',
        status: p.status,
        proposal_ids: [p.id],
        carton_ids: p.carton_ids ? [...p.carton_ids] : [],
        total_cartons: p.items_count || (p.carton_ids ? p.carton_ids.length : 0),
        total_weight: p.total_weight || 0,
        total_cbm: p.total_cbm || 0,
        sampleProposal: p,
      });
    } else {
      const existing = groupedFlightsMap.get(key)!;
      if (!existing.proposal_ids.includes(p.id)) {
        existing.proposal_ids.push(p.id);
      }

      const newCartonIds = p.carton_ids || [];
      newCartonIds.forEach((id) => {
        if (!existing.carton_ids.includes(id)) {
          existing.carton_ids.push(id);
        }
      });

      existing.total_cartons += (p.items_count || (p.carton_ids ? p.carton_ids.length : 0));
      existing.total_weight += (p.total_weight || 0);
      existing.total_cbm += (p.total_cbm || 0);

      if (p.status === ('arrived_bd' as any) && existing.status !== 'received') {
        existing.status = 'arrived_bd' as any;
      } else if (p.status === 'received') {
        existing.status = 'received';
      }
    }
  });

  const groupedFlightList = Array.from(groupedFlightsMap.values());

  // Flight Carton Scan & Receive Modal state
  const [selectedFlightForCartonReceive, setSelectedFlightForCartonReceive] = useState<any | null>(null);
  const [selectedCartonIdsInModal, setSelectedCartonIdsInModal] = useState<string[]>([]);

  // Handler: Realtime BD Weight Calibration per Carton
  const handleUpdateCartonWeight = (cartonId: string, newWeight: number) => {
    if (isNaN(newWeight) || newWeight < 0) return;

    const updatedCartons = cartons.map((c) => {
      if (c.id === cartonId || c.ctn_no === cartonId) {
        const origWt = c.origin_weight !== undefined ? c.origin_weight : (c.gross_weight || newWeight);
        return {
          ...c,
          gross_weight: newWeight,
          bd_calibrated_weight: newWeight,
          origin_weight: origWt,
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    setCartons(updatedCartons);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);

    // Sync flight proposal total weight with Hostinger DB immediately
    const targetCarton = updatedCartons.find((c) => c.id === cartonId || c.ctn_no === cartonId);
    if (targetCarton && targetCarton.flight_number) {
      const flightNo = targetCarton.flight_number;
      const flightCartons = updatedCartons.filter((c) => c.flight_number === flightNo);
      const newTotalWeight = flightCartons.reduce((acc, c) => acc + (c.gross_weight || 0), 0);

      const updatedProposals = proposals.map((p) => {
        if (p.flight_number === flightNo || p.flying_name === flightNo) {
          return { ...p, total_weight: newTotalWeight };
        }
        return p;
      });
      updateProposals(updatedProposals);
      saveHostingerDbData('fsc_vps_proposals', updatedProposals);
    }
  };

  // Individual Carton Receive Handler
  const handleReceiveSingleCarton = (target: Carton | string) => {
    const cartonId = typeof target === 'string' ? target : target.id;
    const ctnNo = typeof target === 'object' ? target.ctn_no : target;
    const shippingMark = typeof target === 'object' ? target.shipping_mark : undefined;

    const norm = (s?: string) => (s ? s.trim().toLowerCase() : '');

    // Check if user entered a custom weight in local weights
    const localWtStr =
      (cartonId && localWeights[cartonId]) ||
      (ctnNo && localWeights[ctnNo]) ||
      (cartonId && localWeights[norm(cartonId)]) ||
      (ctnNo && localWeights[norm(ctnNo)]);
    const parsedLocalWt = localWtStr !== undefined ? parseFloat(localWtStr) : NaN;

    let targetMatched = false;

    const updatedCartons = cartons.map((c) => {
      const matches =
        (c.id && cartonId && norm(c.id) === norm(cartonId)) ||
        (c.ctn_no && cartonId && norm(c.ctn_no) === norm(cartonId)) ||
        (ctnNo && c.ctn_no && norm(c.ctn_no) === norm(ctnNo)) ||
        (ctnNo && c.id && norm(c.id) === norm(ctnNo)) ||
        (shippingMark && c.shipping_mark && norm(c.shipping_mark) === norm(shippingMark));

      if (matches) {
        targetMatched = true;
        const origWt = c.origin_weight !== undefined ? c.origin_weight : (c.gross_weight || 0);
        const finalWt = !isNaN(parsedLocalWt) && parsedLocalWt >= 0 ? parsedLocalWt : (c.bd_calibrated_weight !== undefined ? c.bd_calibrated_weight : (c.gross_weight || 0));

        return {
          ...c,
          status: 'received' as const,
          gross_weight: finalWt,
          bd_calibrated_weight: finalWt,
          origin_weight: origWt,
          current_warehouse_id: 'wh-bd',
          destination_warehouse_id: 'wh-bd',
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    if (!targetMatched) {
      console.warn('Carton match failed for receive target:', target);
    }

    setCartons(updatedCartons);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);

    // Find the carton's flight number and update the proposal's total_weight in Super Admin DB
    const targetCartonObj = updatedCartons.find(
      (c) =>
        (c.id && cartonId && norm(c.id) === norm(cartonId)) ||
        (c.ctn_no && cartonId && norm(c.ctn_no) === norm(cartonId)) ||
        (ctnNo && c.ctn_no && norm(c.ctn_no) === norm(ctnNo))
    );
    if (targetCartonObj && targetCartonObj.flight_number) {
      const flightNo = targetCartonObj.flight_number;
      const flightCartons = updatedCartons.filter((c) => norm(c.flight_number) === norm(flightNo));
      const newTotalWeight = flightCartons.reduce((acc, c) => acc + (c.gross_weight || 0), 0);

      const updatedProposals = proposals.map((p) => {
        if (norm(p.flight_number) === norm(flightNo) || norm(p.flying_name) === norm(flightNo)) {
          return { ...p, total_weight: newTotalWeight };
        }
        return p;
      });
      updateProposals(updatedProposals);
      saveHostingerDbData('fsc_vps_proposals', updatedProposals);
    }

    logSystemAuditAction(
      currentUser,
      'carton_received_bd',
      'carton',
      cartonId,
      `Carton ${ctnNo || cartonId} received at BD Warehouse stock by ${currentUser.name}`
    );

    addToast(
      isBn ? '✅ কার্টুনটি মেপে বুঝে পেয়েছি! স্টক ইনভেন্টরি ও বিলিকৃত প্রোডাক্ট সেকশনে স্থানান্তরিত করা হয়েছে।' : '✅ Carton weight saved and received into Delivered Products stock!',
      'success'
    );
  };

  // Bulk Cartons Receive Handler
  const handleReceiveBulkCartons = (cartonIdsToReceive: string[], flightNo: string, proposalIds: string[]) => {
    if (!cartonIdsToReceive || cartonIdsToReceive.length === 0) {
      addToast(isBn ? 'কমপক্ষে একটি কার্টুন নির্বাচন করুন!' : 'Select at least one carton!', 'error');
      return;
    }

    const updatedCartons = cartons.map((c) => {
      if (cartonIdsToReceive.includes(c.id) || cartonIdsToReceive.includes(c.ctn_no) || (flightNo && c.flight_number === flightNo)) {
        const localWtStr = localWeights[c.id] || localWeights[c.ctn_no];
        const parsedLocalWt = localWtStr !== undefined ? parseFloat(localWtStr) : NaN;
        const finalWt = !isNaN(parsedLocalWt) && parsedLocalWt >= 0 ? parsedLocalWt : (c.bd_calibrated_weight || c.gross_weight || 0);

        return {
          ...c,
          status: 'received' as const,
          gross_weight: finalWt,
          bd_calibrated_weight: finalWt,
          current_warehouse_id: 'wh-bd',
          destination_warehouse_id: 'wh-bd',
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    setCartons(updatedCartons);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);

    // Check if all flight cartons are received
    const flightCartons = updatedCartons.filter(
      (c) => cartonIdsToReceive.includes(c.id) || (flightNo && c.flight_number === flightNo)
    );
    const allReceived = flightCartons.every((c) => c.status === 'received' && c.current_warehouse_id === 'wh-bd');

    if (allReceived) {
      const updatedProposals = proposals.map((p) => {
        if (proposalIds.includes(p.id) || (flightNo && (p.flight_number === flightNo || p.flying_name === flightNo))) {
          return { ...p, status: 'received' as const };
        }
        return p;
      });
      updateProposals(updatedProposals);
      saveHostingerDbData('fsc_vps_proposals', updatedProposals);
    }

    addToast(
      isBn
        ? `✅ ${cartonIdsToReceive.length} টি কার্টুন সফলভাবে বাংলাদেশ ওয়্যারহাউজ স্টকে স্থানান্তরিত করা হয়েছে!`
        : `✅ ${cartonIdsToReceive.length} cartons received into BD Warehouse stock!`,
      'success'
    );
  };

  // Weight calibration modal state
  const [selectedProposalForWeightCalib, setSelectedProposalForWeightCalib] = useState<FlyingProposal | null>(null);
  const [calibratedWeightInput, setCalibratedWeightInput] = useState<number>(0);

  const handleOpenWeightCalibModal = (p: FlyingProposal) => {
    setSelectedProposalForWeightCalib(p);
    setCalibratedWeightInput(p.total_weight || 450);
  };

  const handleSaveBdWeightCalibration = () => {
    if (!selectedProposalForWeightCalib) return;

    const proposalId = selectedProposalForWeightCalib.id;
    const newWeight = Number(calibratedWeightInput);

    if (isNaN(newWeight) || newWeight <= 0) {
      addToast(isBn ? '⚠️ অনুগ্রহ করে সঠিক ওজন (কেজি) প্রবেশ করান' : '⚠️ Please enter a valid weight in kg', 'error');
      return;
    }

    // 1. Update proposal total weight
    const updatedProposals = proposals.map((p) => {
      if (p.id === proposalId) {
        return { ...p, total_weight: newWeight };
      }
      return p;
    });
    updateProposals(updatedProposals);

    // 2. Update attached cartons weight proportionally
    const targetCartonIds = selectedProposalForWeightCalib.carton_ids || [];
    const targetFlightNo = selectedProposalForWeightCalib.flight_number;
    const attachedCartonsCount = cartons.filter(
      (c) => targetCartonIds.includes(c.id) || (targetFlightNo && c.flight_number === targetFlightNo)
    ).length || 1;

    const perCartonWeight = Number((newWeight / attachedCartonsCount).toFixed(2));

    const updatedCartons = cartons.map((c) => {
      if (targetCartonIds.includes(c.id) || (targetFlightNo && c.flight_number === targetFlightNo)) {
        return { ...c, gross_weight: perCartonWeight };
      }
      return c;
    });
    setCartons(updatedCartons);

    // 3. Save to Hostinger DB
    saveHostingerDbData('fsc_vps_proposals', updatedProposals);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);

    addToast(
      isBn
        ? `⚖️ বাংলাদেশে পরিমাপকৃত সঠিক ওজন ${newWeight} kg সফলভাবে আপডেট করা হয়েছে!`
        : `⚖️ BD Calibrated official weight updated to ${newWeight} kg successfully!`,
      'success'
    );

    setSelectedProposalForWeightCalib(null);
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-medium text-slate-900 dark:text-white flex items-center space-x-2.5">
            <div className="p-2 rounded-none bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <Truck className="w-5 h-5" />
            </div>
            <span>{isBn ? 'রিসিভ ফ্লাইং (ইনকামিং কার্গো বিমান তালিকা)' : 'Receive Flying (Inbound Flight Dispatches)'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-normal">
            {isBn
              ? 'উৎস হাব (চীন, হংকং, দুবাই) থেকে রিলিজ হওয়া সকল ফ্লাইটের তথ্য। এখান থেকে ওজন এডিট ও "বাংলাদেশ এয়ারপোর্টে প্রাপ্ত" মার্ক করলে পণ্য বাংলাদেশ ওয়্যারহাউজে যুক্ত হবে।'
              : 'Inbound flight dispatches from origin hubs (China, Hong Kong, Dubai). Calibrate BD weight & mark "Received at BD Airport" to transfer cargo to BD stock.'}
          </p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className={`p-4 rounded-none border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        isDark ? 'bg-[#1E293B] border-slate-800' : 'bg-white border-slate-200/90 shadow-2xs'
      }`}>
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isBn ? 'ফ্লাইং নাম, ফ্লাইট নং, AWB বা উৎস হাব দিয়ে খুঁজুন...' : 'Search by Flying Name, Flight No, AWB or Origin...'}
            className={`w-full pl-10 pr-4 py-2 rounded-none text-xs font-normal border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
              isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        {/* Status Filter Pills */}
        <div className={`flex items-center p-1 rounded-none border text-xs font-normal ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300/80'
        }`}>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-none transition-all font-medium text-xs whitespace-nowrap cursor-pointer select-none ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : isDark
                ? 'text-slate-300 hover:text-white'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            {isBn ? 'সকল ফ্লাইট' : 'All Flights'} ({proposals.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('in_transit')}
            className={`px-3 py-1.5 rounded-none transition-all font-medium text-xs whitespace-nowrap cursor-pointer select-none ${
              statusFilter === 'in_transit'
                ? 'bg-blue-600 text-white shadow-2xs'
                : isDark
                ? 'text-slate-300 hover:text-white'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            ✈️ {isBn ? 'মিড-এিয়ার ফ্লাইটে চলমান' : 'Cruising Mid-Air'}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('received')}
            className={`px-3 py-1.5 rounded-none transition-all font-medium text-xs whitespace-nowrap cursor-pointer select-none ${
              statusFilter === 'received'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : isDark
                ? 'text-slate-300 hover:text-white'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            🛬 {isBn ? 'বাংলাদেশ এয়ারপোর্টে প্রাপ্ত' : 'Received at BD'}
          </button>
        </div>
      </div>

      {/* Main Flights Table */}
      <div
        className={`border rounded-none overflow-hidden shadow-2xs ${
          isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'
        }`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-900 dark:text-white flex items-center space-x-2">
            <Plane className="w-4 h-4 text-blue-500" />
            <span>{isBn ? 'ইনকামিং ফ্লাইং ও ডিসপ্যাচ তালিকা' : 'Inbound Flights List'}</span>
          </h3>
          <span className="text-xs text-blue-600 dark:text-blue-400 font-mono font-normal">
            {groupedFlightList.length} {isBn ? 'টি ফ্লাইট ব্যাচ' : 'Batches Found'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-normal border-collapse">
            <thead
              className={`uppercase text-[10px] tracking-wider border-b font-medium ${
                isDark ? 'bg-slate-900/60 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <tr>
                <th className="p-3.5 border-r border-slate-200 dark:border-slate-800 font-medium">ফ্লাইট তারিখ (DATE)</th>
                <th className="p-3.5 border-r border-slate-200 dark:border-slate-800 font-medium">ফ্লাইং নাম / ব্যাচ টাইটেল</th>
                <th className="p-3.5 border-r border-slate-200 dark:border-slate-800 font-medium">ফ্লাইট নম্বর / AWB</th>
                <th className="p-3.5 border-r border-slate-200 dark:border-slate-800 font-medium">উৎস হাব (ORIGIN)</th>
                <th className="p-3.5 border-r border-slate-200 dark:border-slate-800 font-medium">কার্টুন সংখ্যা</th>
                <th className="p-3.5 border-r border-slate-200 dark:border-slate-800 font-medium">বাংলাদেশে মেপে পাওয়া ওজন</th>
                <th className="p-3.5 border-r border-slate-200 dark:border-slate-800 font-medium">বর্তমান অবস্থা (STATUS)</th>
                <th className="p-3.5 text-right font-medium">অ্যাকশন (BD RECEIVING & CALIBRATION)</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${
                isDark ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'
              }`}
            >
              {groupedFlightList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 text-xs font-normal border-b border-slate-200 dark:border-slate-800">
                    {isBn ? 'কোনো ফ্লাইং ডাটা পাওয়া যায়নি' : 'No flying flight batches found'}
                  </td>
                </tr>
              ) : (
                groupedFlightList.map((gf) => {
                  const isReceived = gf.status === 'received';
                  const isArrivedBd = gf.status === ('arrived_bd' as any) || isReceived || isBdWarehouseStaff;

                  return (
                    <tr key={gf.groupKey} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono text-blue-600 dark:text-blue-400 font-normal border-r border-b border-slate-200 dark:border-slate-800">
                        {gf.date || '2026-08-16'}
                      </td>
                      <td className="p-3.5 font-normal text-slate-900 dark:text-white border-r border-b border-slate-200 dark:border-slate-800">
                        <div className="font-semibold text-slate-900 dark:text-white text-sm">{gf.flying_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">Flight Group: {gf.flight_number}</div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300 border-r border-b border-slate-200 dark:border-slate-800">
                        <div className="font-semibold text-blue-600 dark:text-blue-400">{gf.flight_number}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">AWB: {gf.awb_number}</div>
                      </td>
                      <td className="p-3.5 font-normal border-r border-b border-slate-200 dark:border-slate-800">
                        <span className="inline-flex items-center space-x-1.5">
                          <span>{gf.warehouse_name}</span>
                          <span className="text-slate-400 text-[10px]">➔ 🇧🇩 DAC</span>
                        </span>
                      </td>
                      <td className="p-3.5 text-blue-600 dark:text-blue-400 font-normal border-r border-b border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-sm">{gf.total_cartons}</span> Cartons
                      </td>
                      <td className="p-3.5 font-mono text-slate-900 dark:text-white font-normal border-r border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-sm">{gf.total_weight} kg</span>
                          <button
                            type="button"
                            onClick={() => handleOpenWeightCalibModal(gf.sampleProposal)}
                            className="p-1 px-1.5 rounded-none bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 cursor-pointer transition-colors text-[10px] font-normal border border-blue-500/20"
                            title={isBn ? 'বাংলাদেশে মেপে পাওয়া ওজন টিউন/এডিট করুন' : 'Calibrate Official BD Weight'}
                          >
                            ⚖️ এডিট
                          </button>
                        </div>
                      </td>
                      <td className="p-3.5 border-r border-b border-slate-200 dark:border-slate-800">
                        {isArrivedBd ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-none bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium border border-emerald-500/20">
                            <span>🛬 বাংলাদেশ এয়ারপোর্টে প্রাপ্ত</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-none bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-medium border border-blue-500/20">
                            <span className="w-1.5 h-1.5 rounded-none bg-blue-500 animate-ping"></span>
                            <span>✈️ মিড-এিয়ার ফ্লাইটে চলমান</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => handleOpenWeightCalibModal(gf.sampleProposal)}
                            className={`px-3 py-1.5 rounded-none font-normal text-xs transition-all border cursor-pointer select-none ${
                              isDark
                                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 shadow-2xs'
                            }`}
                          >
                            ⚖️ {isBn ? 'ওজন পুনর্নির্ধারণ' : 'Calibrate Weight'}
                          </button>

                          {isReceived ? (
                            <span
                              className={`text-[11px] font-normal inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-none border ${
                                isDark
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>{isBn ? 'ওয়্যারহাউজে স্থানান্তরিত' : 'Transferred to BD Warehouse'}</span>
                            </span>
                          ) : isArrivedBd ? (
                            isBdWarehouseStaff ? (
                              <button
                                type="button"
                                onClick={() => setSelectedFlightForCartonReceive(gf)}
                                className="px-3.5 py-2 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md flex items-center space-x-1.5 cursor-pointer select-none hover:scale-105 active:scale-95"
                              >
                                <Package className="w-4 h-4" />
                                <span>{isBn ? '📦 কার্টুন লিস্ট ও রিসিভ করুন' : 'View Cartons & Receive'}</span>
                              </button>
                            ) : (
                              <span
                                className={`text-[11px] font-normal inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-none border ${
                                  isDark
                                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>{isBn ? 'বাংলাদেশ এয়ারপোর্টে রিসিভড' : 'Received at BD Airport'}</span>
                              </span>
                            )
                          ) : isBdWarehouseStaff ? (
                            <button
                              type="button"
                              onClick={() => setSelectedFlightForCartonReceive(gf)}
                              className="px-3.5 py-2 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md flex items-center space-x-1.5 cursor-pointer select-none"
                            >
                              <Package className="w-4 h-4" />
                              <span>{isBn ? '📦 কার্টুন লিস্ট ও রিসিভ করুন' : 'View Cartons & Receive'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleMarkReceivedAtBdAirport(gf.proposal_ids, gf.flight_number, gf.carton_ids)}
                              className="px-3.5 py-2 rounded-none bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-md flex items-center space-x-1.5 cursor-pointer select-none hover:scale-105 active:scale-95 border border-blue-700"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{isBn ? '🛬 এয়ারপোর্টে পুরো ফ্লাইট প্রাপ্ত (একবারে রিসিভ)' : 'Mark BD Airport Received (All Flight)'}</span>
                            </button>
                          )}
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

      {/* BD Weight Calibration Modal */}
      {selectedProposalForWeightCalib && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`max-w-md w-full rounded-none p-6 shadow-2xl border space-y-5 animate-in fade-in zoom-in-95 duration-200 ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-none bg-blue-500/10 text-blue-500">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-medium text-slate-900 dark:text-white">
                    {isBn ? '⚖️ বাংলাদেশে মেপে পাওয়া সঠিক ওজন পুনর্নির্ধারণ' : 'Official BD Weight Calibration'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {selectedProposalForWeightCalib.flight_number} • {selectedProposalForWeightCalib.flying_name || selectedProposalForWeightCalib.warehouse_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProposalForWeightCalib(null)}
                className="p-1 rounded-none text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-normal">
              <div className="p-3 rounded-none bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 leading-relaxed">
                💡 {isBn
                  ? 'নোট: বাংলাদেশে আসার পর প্রোডাক্টের যে ওজন পরিমাপ করা হবে, সেটিই চূড়ান্ত সত্য ওজন হিসেবে গণ্য হবে এবং গ্রাহকের বিলে হিসাব হবে।'
                  : 'Note: Official gross weight measured upon arrival in Bangladesh is the final billable weight.'}
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">
                  {isBn ? 'বাংলাদেশে মেপে পাওয়া সঠিক মোট গ্রস ওজন (KG):' : 'Official BD Calibrated Gross Weight (KG):'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={calibratedWeightInput}
                  onChange={(e) => setCalibratedWeightInput(Number(e.target.value))}
                  className={`w-full px-4 py-2.5 rounded-none text-sm font-mono border focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedProposalForWeightCalib(null)}
                className="px-4 py-2 rounded-none text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveBdWeightCalibration}
                className="px-4 py-2 rounded-none text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
              >
                {isBn ? 'সেভ করুন ও ওজন আপডেট করুন' : 'Save BD Weight'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flight Carton Scan & Receive Modal */}
      {selectedFlightForCartonReceive && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div
            className={`max-w-5xl w-full rounded-none p-6 shadow-none border space-y-4 max-h-[90vh] flex flex-col ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3.5 border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-none bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                  <Package className="w-5 h-5 font-light" />
                </div>
                <div>
                  <h3 className="text-base font-normal text-slate-900 dark:text-white flex items-center space-x-2">
                    <span>ফ্লাইট {selectedFlightForCartonReceive.flying_name || selectedFlightForCartonReceive.flight_number} কার্টুন তালিকা ও স্টক রিসিভিং</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-light">
                    AWB: {selectedFlightForCartonReceive.awb_number || 'N/A'} • উৎস: {selectedFlightForCartonReceive.warehouse_name} ➔ ঢাকা সেন্ট্রাল Hub
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFlightForCartonReceive(null)}
                className="p-1.5 rounded-none text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer text-sm font-light"
              >
                ✕
              </button>
            </div>

            {/* Quick Bulk Action Bar */}
            {(() => {
              const flightCartons = cartons.filter((c) =>
                (selectedFlightForCartonReceive.carton_ids && selectedFlightForCartonReceive.carton_ids.includes(c.id)) ||
                (selectedFlightForCartonReceive.flight_number && c.flight_number === selectedFlightForCartonReceive.flight_number) ||
                (selectedFlightForCartonReceive.flying_name && c.flight_number === selectedFlightForCartonReceive.flying_name)
              );
              const pendingCartons = flightCartons.filter((c) => c.status !== 'received' || c.current_warehouse_id !== 'wh-bd');
              const receivedCartonsCount = flightCartons.filter((c) => c.status === 'received' && c.current_warehouse_id === 'wh-bd').length;

              const toggleSelectAllInModal = () => {
                if (selectedCartonIdsInModal.length === pendingCartons.length) {
                  setSelectedCartonIdsInModal([]);
                } else {
                  setSelectedCartonIdsInModal(pendingCartons.map((c) => c.id));
                }
              };

              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-none border border-slate-200 dark:border-slate-800 font-light">
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-light text-slate-600 dark:text-slate-300">
                        রিসিভিং প্রোগ্রেস: <span className="text-emerald-600 dark:text-emerald-400 font-normal">{receivedCartonsCount} / {flightCartons.length}</span> কার্টুন রিসিভড
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={toggleSelectAllInModal}
                        className="px-3 py-1.5 rounded-none bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-light cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-600 transition-all border border-slate-300 dark:border-slate-600"
                      >
                        {selectedCartonIdsInModal.length === pendingCartons.length ? 'আন-সিলেক্ট' : 'সব সিলেক্ট'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleReceiveBulkCartons(
                            selectedCartonIdsInModal.length > 0 ? selectedCartonIdsInModal : pendingCartons.map((c) => c.id),
                            selectedFlightForCartonReceive.flight_number,
                            selectedFlightForCartonReceive.proposal_ids
                          )
                        }
                        className="px-4 py-1.5 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-light text-xs transition-all flex items-center space-x-1.5 cursor-pointer border border-emerald-700"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>একত্রে সব রিসিভ করুন ({selectedCartonIdsInModal.length || pendingCartons.length} Cartons)</span>
                      </button>
                    </div>
                  </div>

                  {/* Cartons List Table */}
                  <div className="overflow-y-auto max-h-[52vh] border border-slate-200 dark:border-slate-800 rounded-none">
                    <table className="w-full text-left text-xs font-light">
                      <thead className="bg-slate-100 dark:bg-slate-950 text-slate-500 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-200 dark:border-slate-800 font-normal">
                        <tr>
                          <th className="p-2.5 font-normal">#</th>
                          <th className="p-2.5 font-normal">CTN No</th>
                          <th className="p-2.5 font-normal">Shipping Mark</th>
                          <th className="p-2.5 font-normal">Tracking No</th>
                          <th className="p-2.5 font-normal">Product Name</th>
                          <th className="p-2.5 font-normal">Qty / CBM</th>
                          <th className="p-2.5 font-normal">BD Calibrated Weight (কেজি)</th>
                          <th className="p-2.5 font-normal">Status</th>
                          <th className="p-2.5 text-right font-normal">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {flightCartons.map((c) => {
                          const isCartonReceived = c.status === 'received' || c.current_warehouse_id === 'wh-bd' || c.status === 'delivered';
                          const isChecked = selectedCartonIdsInModal.includes(c.id);

                          return (
                            <tr
                              key={c.id}
                              className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                                isCartonReceived ? 'bg-emerald-500/5' : ''
                              }`}
                            >
                              <td className="p-2.5">
                                {!isCartonReceived && (
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() =>
                                      setSelectedCartonIdsInModal((prev) =>
                                        prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                      )
                                    }
                                    className="w-3.5 h-3.5 accent-emerald-600 rounded-none cursor-pointer"
                                  />
                                )}
                              </td>
                              <td className="p-2.5 font-normal font-mono text-slate-800 dark:text-slate-200">{c.ctn_no}</td>
                              <td className="p-2.5 text-blue-600 dark:text-blue-400 font-normal">{c.shipping_mark}</td>
                              <td className="p-2.5 font-mono text-slate-500 font-light">{c.tracking_number}</td>
                              <td className="p-2.5 font-light">
                                <div className="font-normal text-slate-800 dark:text-slate-200">{c.product_name_en}</div>
                                {c.product_name_cn && (
                                  <div className="text-[10px] text-slate-400 font-light">{c.product_name_cn}</div>
                                )}
                              </td>
                              <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400 font-light">
                                <div>{c.quantity || 1} Pcs</div>
                                <div className="text-[10px] text-slate-400">{c.cbm || 0.15} CBM</div>
                              </td>
                              <td className="p-2.5">
                                <div className="flex items-center space-x-1">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={
                                      localWeights[c.id] !== undefined
                                        ? localWeights[c.id]
                                        : (c.bd_calibrated_weight !== undefined
                                          ? String(c.bd_calibrated_weight)
                                          : String(c.gross_weight || ''))
                                    }
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setLocalWeights((prev) => ({ ...prev, [c.id]: val }));
                                    }}
                                    onBlur={(e) => {
                                      const parsed = parseFloat(e.target.value);
                                      if (!isNaN(parsed) && parsed >= 0) {
                                        handleUpdateCartonWeight(c.id, parsed);
                                      }
                                    }}
                                    className={`w-20 px-2 py-1 text-xs font-bold text-center rounded-none border transition-all ${
                                      isCartonReceived
                                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500'
                                        : 'bg-white dark:bg-slate-800 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                    }`}
                                    title="বাংলাদেশে মেপে পাওয়া ওজন টিউন/এডিট করুন"
                                  />
                                  <span className="text-[10px] font-light text-slate-400">KG</span>
                                </div>
                              </td>
                              <td className="p-2.5">
                                {isCartonReceived ? (
                                  <span className="px-2 py-0.5 rounded-none bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-light border border-emerald-500/20">
                                    BD রিসিভড
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-none bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-light border border-amber-500/20">
                                    ইন-ট্রানজিট
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-right">
                                {isCartonReceived ? (
                                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-light px-2 py-0.5 rounded-none bg-emerald-500/10 border border-emerald-500/20">
                                    ইনভেন্টরিতে যুক্ত
                                  </span>
                                ) : isBdWarehouseStaff ? (
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleReceiveSingleCarton(c)}
                                    className="px-2.5 py-1 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-light text-xs transition-all inline-flex items-center space-x-1 cursor-pointer border border-emerald-700 shadow-xs"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>বুঝে পেয়েছি (রিসিভড)</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-light px-2 py-0.5 rounded-none bg-blue-500/10 border border-blue-500/20">
                                    অপারেশনস ফ্লাইট রিসিভিং
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
