import React, { useState } from 'react';
import {
  Package,
  PlusCircle,
  Plane,
  Truck,
  CheckCircle2,
  Building2,
  DollarSign,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Layers,
  X,
  Scale,
  Box,
  Sparkles,
  Download,
  Trash2,
  Edit3,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { Carton, Warehouse, User, Language, LedgerEntry, FlyingProposal } from '../types';
import { BookingEntryForm } from './BookingEntryForm';
import { DeliveriesManagement } from './DeliveriesManagement';
import { FinalFlyingListSection } from './FinalFlyingListSection';
import { ReceiveFlyingSection } from './ReceiveFlyingSection';
import { DeliveredProductsSection } from './DeliveredProductsSection';
import { WarehouseAnalyticsDashboard } from './WarehouseAnalyticsDashboard';
import { BookedCartonsHub } from './BookedCartonsHub';
import { ToastContainer, ToastMessage } from './Toast';
import { saveHostingerDbData, saveHostingerDbMultiData, getHostingerDbData, logSystemAuditAction, subscribeToDbUpdates, formatWarehouseNameEn } from '../lib/db';
import { useTheme } from '../context/ThemeContext';
import { PublicTracking } from './PublicTracking';
import { CargoSearchTracker } from './CargoSearchTracker';

interface WarehouseInchargeDashboardProps {
  activeTab: string;
  cartons: Carton[];
  setCartons: React.Dispatch<React.SetStateAction<Carton[]>>;
  warehouses: Warehouse[];
  currentUser: User;
  setLedgerEntries: React.Dispatch<React.SetStateAction<LedgerEntry[]>>;
  language: Language;
}

export const WarehouseInchargeDashboard: React.FC<WarehouseInchargeDashboardProps> = ({
  activeTab,
  cartons,
  setCartons,
  warehouses,
  currentUser,
  setLedgerEntries,
  language,
}) => {
  const isBn = language === 'bn';
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const myWhId = currentUser.warehouse_id || 'wh-china';
  const myWh = warehouses.find((w) => w.id === myWhId);
  const isFinalDestination = myWh?.is_final_destination || false;

  // Toast feedback
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: `toast-${Date.now()}`, type, title, message }]);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Proposals History State (Pure real-time DB proposals without fake demo entries)
  const [proposalHistory, setProposalHistory] = useState<FlyingProposal[]>(() => {
    const dbData = getHostingerDbData();
    return dbData.proposals || [];
  });

  // Inventory Filters & Pagination
  const [invSearch, setInvSearch] = useState('');
  const [invStatusFilter, setInvStatusFilter] = useState('all');
  const [invPage, setInvPage] = useState(1);
  const itemsPerPage = 6;

  // Incoming Transit Bulk Selection & Confirmation Modal
  const [selectedReceivingIds, setSelectedReceivingIds] = useState<string[]>([]);
  const [showConfirmReceiveModal, setShowConfirmReceiveModal] = useState(false);

  // Daily Flying Proposal Selection
  const [selectedProposalCartonIds, setSelectedProposalCartonIds] = useState<string[]>([]);
  const [batchDestWhId, setBatchDestWhId] = useState('wh-bd');
  const [proposalDate, setProposalDate] = useState(new Date().toISOString().split('T')[0]);
  const [flyingNameInput, setFlyingNameInput] = useState('');
  const [proposalCartonSearch, setProposalCartonSearch] = useState('');
  const [showStockImportModal, setShowStockImportModal] = useState(false);
  const [activeFlightBatch, setActiveFlightBatch] = useState<{ name: string; destWhId: string; date: string } | null>(null);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);

  React.useEffect(() => {
    return subscribeToDbUpdates(() => {
      const dbData = getHostingerDbData();
      if (dbData.cartons) {
        setCartons(dbData.cartons);
      }
      if (dbData.proposals) {
        setProposalHistory(dbData.proposals);
      }
    });
  }, []);

  // Option 1: Edit Proposal (Loads proposal into active workspace for updating)
  const handleEditProposal = (ph: FlyingProposal) => {
    setEditingProposalId(ph.id);
    setFlyingNameInput(ph.flying_name || ph.flight_number || '');
    setProposalDate(ph.date);
    setBatchDestWhId(ph.destination_warehouse_id || 'wh-bd');
    setSelectedProposalCartonIds(ph.carton_ids || []);
    setActiveFlightBatch({
      name: ph.flying_name || ph.flight_number || 'Flight Batch',
      destWhId: ph.destination_warehouse_id || 'wh-bd',
      date: ph.date,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    addToast(
      'info',
      isBn ? 'প্রোপোজাল এডিট মোড চালু' : 'Editing Proposal Mode',
      isBn ? `প্রোপোজাল "${ph.flying_name || ph.flight_number}" এডিট করা হচ্ছে।` : `Editing proposal "${ph.flying_name || ph.flight_number}".`
    );
  };

  // Option 3: Cancel / Delete Proposal
  const handleDeleteProposal = (proposalId: string) => {
    const targetProp = proposalHistory.find((p) => p.id === proposalId);
    if (!targetProp) return;

    if (!window.confirm(isBn ? `আপনি কি নিশ্চিত যে প্রোপোজাল "${targetProp.flying_name || targetProp.flight_number}" ডিলেট করবেন?` : `Cancel proposal "${targetProp.flying_name || targetProp.flight_number}"?`)) {
      return;
    }

    const updatedProps = proposalHistory.filter((p) => p.id !== proposalId);
    setProposalHistory(updatedProps);
    saveHostingerDbData('fsc_vps_proposals', updatedProps);

    // Reset cartons attached to this proposal back to booked status
    const attachedCartonIds = targetProp.carton_ids || [];
    if (attachedCartonIds.length > 0) {
      const resetCartons = cartons.map((c) => {
        if (attachedCartonIds.includes(c.id)) {
          return { ...c, status: 'booked' as const, flight_number: undefined, updated_at: new Date().toISOString() };
        }
        return c;
      });
      setCartons(resetCartons);
      saveHostingerDbData('fsc_vps_cartons', resetCartons);
    }

    if (editingProposalId === proposalId) {
      setEditingProposalId(null);
      setSelectedProposalCartonIds([]);
      setActiveFlightBatch(null);
    }

    addToast(
      'info',
      isBn ? 'প্রোপোজাল বাতিল করা হয়েছে' : 'Proposal Cancelled',
      isBn ? `প্রোপোজাল "${targetProp.flying_name || targetProp.flight_number}" ডিলেট করা হয়েছে এবং কার্টুন ইনভেন্টরিতে ফেরত দেওয়া হয়েছে।` : `Proposal deleted and cartons returned to stock.`
    );
  };

  // Handle Save New Cartons
  const handleSaveNewCartons = (newCartons: Carton[]) => {
    const currentDbCartons = getHostingerDbData().cartons;
    const cartonMap = new Map<string, Carton>();
    [...newCartons, ...currentDbCartons].forEach((c) => {
      if (c && c.id) {
        cartonMap.set(c.id, c);
      }
    });
    const updated = Array.from(cartonMap.values());
    setCartons(updated);
    saveHostingerDbData('fsc_vps_cartons', updated);
    addToast(
      'success',
      isBn ? 'কার্টুন বুকিং সফল হয়েছে!' : 'Cartons Booked Successfully!',
      isBn ? `${newCartons.length} টি কার্টুন বুকড স্টকে যুক্ত হয়েছে` : `${newCartons.length} cartons added to stock`
    );
  };

  // Handle Mark Received
  const handleConfirmReceiveSubmit = () => {
    const updated = cartons.map((c) => {
      if (selectedReceivingIds.includes(c.id)) {
        return {
          ...c,
          status: 'received' as const,
          current_warehouse_id: myWhId,
          current_warehouse_name: myWh?.name,
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    setCartons(updated);
    saveHostingerDbData('fsc_vps_cartons', updated);

    addToast(
      'success',
      isBn ? 'ইনকামিং কার্গো গ্রহণ সম্পন্ন!' : 'Cargo Received Successfully!',
      isBn ? `${selectedReceivingIds.length} টি কার্টুন রিসিভড করা হয়েছে` : `${selectedReceivingIds.length} cartons marked received`
    );

    setSelectedReceivingIds([]);
    setShowConfirmReceiveModal(false);
  };

  // Submit or Update Daily Flying Proposal In-Place
  const handleSubmitProposal = (e: React.FormEvent) => {
    e.preventDefault();
    let targetCartonIds = [...selectedProposalCartonIds];

    if (targetCartonIds.length === 0) {
      const availableCartons = cartons.filter(
        (c) => c.current_warehouse_id === myWhId && (c.status === 'booked' || c.status === 'received' || !c.status)
      );
      if (availableCartons.length > 0) {
        targetCartonIds = availableCartons.map((c) => c.id);
        setSelectedProposalCartonIds(targetCartonIds);
      }
    }

    const selectedCartons = cartons.filter((c) => targetCartonIds.includes(c.id));
    const totalWeight = selectedCartons.reduce((acc, curr) => acc + (curr.gross_weight || 0), 0) || 267.0;
    const totalCbm = selectedCartons.reduce((acc, curr) => acc + (curr.cbm || 0), 0) || 2.4;

    const flightName = flyingNameInput.trim() || activeFlightBatch?.name || `${myWh?.name || 'অরিজিন ওয়্যারহাউজ'} Flying Batch #${Math.floor(Math.random() * 800 + 100)}`;

    const currentDbProposals = getHostingerDbData().proposals || proposalHistory;

    // Check if updating existing proposal (by editingProposalId OR matching flight_name in pending status)
    const existingIndex = currentDbProposals.findIndex(
      (p) => (editingProposalId && p.id === editingProposalId) ||
             (p.warehouse_id === myWhId && p.status === 'pending' && (p.flying_name || p.flight_number || '').toLowerCase().trim() === flightName.toLowerCase().trim())
    );

    let updatedProps: FlyingProposal[] = [];

    if (existingIndex !== -1) {
      // UPDATE EXISTING PROPOSAL IN-PLACE!
      const target = currentDbProposals[existingIndex];
      const previousCartonIds = target.carton_ids || [];
      const removedCartonIds = previousCartonIds.filter((id) => !selectedProposalCartonIds.includes(id));

      const updatedProp: FlyingProposal = {
        ...target,
        flying_name: flightName,
        destination_warehouse_id: batchDestWhId,
        destination_warehouse_name: warehouses.find((w) => w.id === batchDestWhId)?.name || 'ঢাকা সেন্ট্রাল (BD)',
        date: proposalDate,
        carton_ids: selectedProposalCartonIds,
        items_count: selectedProposalCartonIds.length,
        total_weight: Math.round(totalWeight * 10) / 10,
        total_cbm: Math.round(totalCbm * 100) / 100,
        status: 'pending',
      };

      updatedProps = [...currentDbProposals];
      updatedProps[existingIndex] = updatedProp;

      // Reset removed cartons
      if (removedCartonIds.length > 0) {
        const resetCartons = cartons.map((c) => {
          if (removedCartonIds.includes(c.id)) {
            return { ...c, status: 'booked' as const, flight_number: undefined, updated_at: new Date().toISOString() };
          }
          return c;
        });
        setCartons(resetCartons);
        saveHostingerDbData('fsc_vps_cartons', resetCartons);
      }
    } else {
      // CREATE NEW PROPOSAL
      const newProposal: FlyingProposal = {
        id: `prop-${Date.now()}`,
        flying_name: flightName,
        warehouse_id: myWhId,
        warehouse_name: myWh?.name || 'অরিজিন ওয়্যারহাউজ',
        destination_warehouse_id: batchDestWhId,
        destination_warehouse_name: warehouses.find((w) => w.id === batchDestWhId)?.name || 'ঢাকা সেন্ট্রাল (BD)',
        proposed_by: currentUser.id,
        proposed_by_name: currentUser.name,
        date: proposalDate,
        status: 'pending',
        carton_ids: selectedProposalCartonIds,
        items_count: selectedProposalCartonIds.length,
        total_weight: Math.round(totalWeight * 10) / 10,
        total_cbm: Math.round(totalCbm * 100) / 100,
      };
      updatedProps = [newProposal, ...currentDbProposals];
    }

    // Deduplicate proposal map
    const propMap = new Map<string, FlyingProposal>();
    updatedProps.forEach((p) => {
      if (p && p.id) propMap.set(p.id, p);
    });
    const finalProps = Array.from(propMap.values());

    const updatedCartons = cartons.map((c) => {
      if (selectedProposalCartonIds.includes(c.id)) {
        return {
          ...c,
          status: 'proposed' as const,
          flight_number: flightName,
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    setProposalHistory(finalProps);
    setCartons(updatedCartons);

    saveHostingerDbMultiData({
      fsc_vps_proposals: finalProps,
      fsc_vps_cartons: updatedCartons,
    });

    addToast(
      'success',
      existingIndex !== -1
        ? (isBn ? 'ফ্লাইট প্রোপোজাল সফলভাবে আপডেট করা হয়েছে!' : 'Flight Proposal Updated!')
        : (isBn ? 'ডেইলি ফ্লাইং প্রোপোজাল সাবমিট সফল!' : 'Flight Proposal Submitted!'),
      isBn
        ? `প্রোপোজাল "${flightName}"-এ ${selectedProposalCartonIds.length} টি কার্টুন আপডেট করে ডিরেক্টরে পাঠানো হয়েছে`
        : `Proposal "${flightName}" updated with ${selectedProposalCartonIds.length} cartons`
    );

    setEditingProposalId(null);
    setSelectedProposalCartonIds([]);
    setActiveFlightBatch(null);
  };

  // TAB: CARGO TRACKING SEARCH VIEW
  if (activeTab === 'cargo_search') {
    return (
      <CargoSearchTracker
        cartons={cartons}
        proposals={getHostingerDbData().proposals}
        language={language}
      />
    );
  }

  // TAB: WAREHOUSE ANALYTICS DASHBOARD
  if (activeTab === 'dashboard' || activeTab === 'analytics') {
    return (
      <div className="space-y-6">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <WarehouseAnalyticsDashboard
          cartons={cartons}
          warehouses={warehouses}
          currentUser={currentUser}
          language={language}
          onNavigateTab={(tabId) => {
            // Callback passed to dashboard buttons
          }}
        />
      </div>
    );
  }

  // TAB: DELIVERIES MANAGEMENT (Final Destination Warehouse Only)
  if (activeTab === 'delivery_cash') {
    return (
      <DeliveriesManagement
        cartons={cartons}
        setCartons={setCartons}
        setLedgerEntries={setLedgerEntries}
        currentUser={currentUser}
        language={language}
      />
    );
  }

  // TAB: BOOKING ENTRY FORM
  if (activeTab === 'booking_entry') {
    return (
      <div className="space-y-6">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <BookingEntryForm
          warehouses={warehouses}
          currentUser={currentUser}
          onSaveCartons={handleSaveNewCartons}
          language={language}
        />
      </div>
    );
  }

  // TAB: DELIVERED PRODUCTS (বিলিকৃত প্রোডাক্ট)
  if (activeTab === 'delivered_products') {
    return (
      <DeliveredProductsSection
        cartons={cartons}
        proposals={proposalHistory}
        currentUser={currentUser}
        language={language}
      />
    );
  }

  // TAB: RECEIVE FLYING (রিসিভ ফ্লাইং)
  if (activeTab === 'history') {
    return (
      <ReceiveFlyingSection
        cartons={cartons}
        setCartons={setCartons}
        currentUser={currentUser}
        language={language}
      />
    );
  }

  // TAB: INCOMING TRANSIT RECEIVING
  if (activeTab === 'receive_incoming') {
    const incomingCartons = cartons.filter(
      (c) => c.status === 'in_transit' && c.destination_warehouse_id === myWhId
    );

    const toggleSelectReceiving = (id: string) => {
      setSelectedReceivingIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    };

    const toggleSelectAllReceiving = () => {
      if (selectedReceivingIds.length === incomingCartons.length) {
        setSelectedReceivingIds([]);
      } else {
        setSelectedReceivingIds(incomingCartons.map((c) => c.id));
      }
    };

    return (
      <div className="space-y-6 font-sans">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
              <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>{isBn ? 'ইনকামিং ট্রানজিট শিপমেন্ট গ্রহণ' : 'Incoming Transit Receiving'}</span>
            </h2>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              {isBn
                ? 'অন্য ওয়্যারহাউজ থেকে আপনার ওয়্যারহাউজে আসা গাড়ি/কার্গোর মালপত্র রিসিভ করুন'
                : 'Confirm receipt of cargo dispatched from other origin hubs to your warehouse'}
            </p>
          </div>
          {selectedReceivingIds.length > 0 && (
            <button
              onClick={() => setShowConfirmReceiveModal(true)}
              className="py-2.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center space-x-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isBn
                  ? `সিলেক্টকৃত ${selectedReceivingIds.length} টি কার্টুন রিসিভড করুন`
                  : `Mark ${selectedReceivingIds.length} Cartons Received`}
              </span>
            </button>
          )}
        </div>

        {incomingCartons.length > 0 ? (
          <div className="bg-white dark:bg-[#1E293B] rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs">
            <div className="p-4 bg-slate-50 dark:bg-[#1E293B]/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <button
                onClick={toggleSelectAllReceiving}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {selectedReceivingIds.length === incomingCartons.length
                  ? (isBn ? 'সব আনসিলেক্ট করুন' : 'Deselect All')
                  : (isBn ? 'সব সিলেক্ট করুন' : 'Select All Incoming')}
              </button>
              <span className="text-xs text-slate-500 font-mono">
                {selectedReceivingIds.length} / {incomingCartons.length} Selected
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-normal">
                <thead className="bg-slate-100 dark:bg-[#1E293B] uppercase text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3 w-10 text-center font-normal">Select</th>
                    <th className="p-3 font-normal">CTN NO</th>
                    <th className="p-3 font-normal">TRACKING ID</th>
                    <th className="p-3 font-normal">SHIPPING MARK</th>
                    <th className="p-3 font-normal">PRODUCT NAME</th>
                    <th className="p-3 text-center font-normal">SPECIFICATIONS</th>
                    <th className="p-3 text-center font-normal">VOLUME</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {incomingCartons.map((c) => {
                    const isSel = selectedReceivingIds.includes(c.id);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => toggleSelectReceiving(c.id)}
                        className={`hover:bg-slate-50 dark:hover:bg-[#1E293B]/50 cursor-pointer ${
                          isSel ? 'bg-blue-500/10' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => {}}
                            className="w-4 h-4 rounded-md text-blue-600 border-slate-300 cursor-pointer accent-blue-600"
                          />
                        </td>
                        <td className="p-3 font-mono font-medium text-slate-900 dark:text-white">
                          {c.ctn_no}
                        </td>
                        <td className="p-3 font-mono text-slate-500 dark:text-slate-400">
                          {c.tracking_number}
                        </td>
                        <td className="p-3 font-mono text-blue-600 dark:text-blue-400 font-medium">
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[11px]">
                            {c.shipping_mark}
                          </span>
                        </td>
                        <td className="p-3 font-sans truncate max-w-[200px]">
                          <div className="font-medium text-slate-900 dark:text-white">{c.product_name_en}</div>
                          {c.product_name_cn && <div className="text-[10px] text-slate-400">{c.product_name_cn}</div>}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-300">
                          {c.quantity} Pcs | {c.gross_weight} kg
                        </td>
                        <td className="p-3 text-center font-mono text-purple-600 dark:text-purple-400 font-medium">
                          {c.cbm} CBM
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center bg-white dark:bg-[#1E293B] rounded-3xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-2xs">
            <Truck className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              {isBn ? 'বর্তমানে কোনো ইনকামিং ট্রানজিট শিপমেন্ট নেই' : 'No Incoming Transit Cargo At This Moment'}
            </h4>
            <p className="text-xs text-slate-400 font-normal max-w-sm mx-auto">
              {isBn
                ? 'অন্যান্য অরিজিন ওয়্যারহাউজ (যেমন: চায়না/দুবাই) থেকে পণ্য ট্রানজিটে পাঠানো হলে এখানে লাইভ প্রদর্শিত হবে।'
                : 'When origin hubs send cargo in transit to your warehouse, it will automatically populate here.'}
            </p>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmReceiveModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-[#1E293B] border border-[#1FB6A8]/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-[#1FB6A8]" />
                <span>{isBn ? 'পণ্য রিসিভড নিশ্চিতকরণ' : 'Confirm Receiving Cargo'}</span>
              </h3>

              <p className="text-xs text-[#8FA3AD] leading-relaxed">
                {isBn
                  ? `আপনি কি নিশ্চিত যে সিলেক্ট করা ${selectedReceivingIds.length} টি কার্টুন দৈহিকভাবে আপনার ওয়্যারহাউজে রিসিভ করা হয়েছে?`
                  : `Are you sure that ${selectedReceivingIds.length} selected cartons have physically arrived at your warehouse?`}
              </p>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowConfirmReceiveModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#0B1622] text-[#8FA3AD] text-xs font-semibold hover:text-white"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  onClick={handleConfirmReceiveSubmit}
                  className="px-4 py-2 rounded-xl bg-[#1FB6A8] text-[#0F2D52] font-bold text-xs hover:bg-[#22A6B3]"
                >
                  {isBn ? 'হ্যাঁ, রিসিভড চিহ্নিত করুন' : 'Yes, Mark Received'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // TAB: FINAL FLYING LIST & HISTORICAL ARCHIVE (Moved to Operations Director & Super Admin)
  if (activeTab === 'final_flying_list') {
    return (
      <div className="space-y-6 font-sans">
        <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
          <div className="flex items-center space-x-3 text-blue-500 mb-2">
            <Plane className="w-6 h-6" />
            <h2 className="text-base font-semibold">
              {isBn ? 'ফাইনাল ফ্লাইং ম্যানেজমেন্ট' : 'Final Flying Management'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-light">
            {isBn
              ? 'নিয়ম অনুসারে ফাইনাল ফ্লাইং লিস্ট ও ডেসপ্যাচ ম্যানেজমেন্ট অপারেশনস ডিরেক্টর ও সুপার এডমিন কর্তৃক পরিচালিত হয়। ওয়্যারহাউজ ইনচার্জ শুধু নতুন কার্টুন বুকিং এন্ট্রি ও আগত ফ্লাইটের রিসিভ গ্রহণ পরিচালনা করবেন।'
              : 'Final Flying List & Dispatch Release are managed exclusively by Operations Director & Super Admin. Warehouse Incharge handles New Carton Booking and Receive Flying.'}
          </p>
        </div>
        <BookingEntryForm
          warehouses={warehouses}
          currentUser={currentUser}
          language={language}
          onSaveCartons={(newCartons) => {
            const updated = [...cartons, ...newCartons];
            setCartons(updated);
            saveHostingerDbData('fsc_vps_cartons', updated);
          }}
        />
      </div>
    );
  }

  // TAB: DAILY FLYING PROPOSAL CREATION (Moved to Operations Director)
  if (activeTab === 'proposal_create') {
    return (
      <div className="space-y-6 font-sans">
        <div className={`p-6 rounded-none border ${isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
          <div className="flex items-center space-x-3 text-blue-500 mb-2">
            <Plane className="w-6 h-6" />
            <h2 className="text-base font-semibold">
              {isBn ? 'ফ্লাইং প্রোপোজাল তৈরি সেকশন' : 'Flying Proposal Creation Section'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-light">
            {isBn
              ? 'নিয়ম অনুসারে ওয়্যারহাউজ ইনচার্জ শুধু নতুন কার্টুন এন্ট্রি ও রিসিভ করবেন। এন্ট্রি করা কার্টুন থেকে ফ্লাইং প্রোপোজাল তৈরির কাজ অপারেশনস ডিরেক্টর পরিচালনা করবেন এবং সুপার এডমিন অনুমোদন করবেন।'
              : 'Warehouse Incharge enters booked cartons and receives incoming cargo. Flying proposal creation & flight dispatch are managed by Operations Director & approved by Super Admin.'}
          </p>
        </div>
        <BookingEntryForm
          warehouses={warehouses}
          currentUser={currentUser}
          language={language}
          onSaveCartons={(newCartons) => {
            const updated = [...cartons, ...newCartons];
            setCartons(updated);
            saveHostingerDbData('fsc_vps_cartons', updated);
          }}
        />
      </div>
    );
  }


  // DEFAULT TAB: OWN WAREHOUSE INVENTORY PAGE (Strictly current physical warehouse stock)
  const myCartons = cartons.filter((c) => {
    // Deduct stock automatically: cartons in flight (in_transit) or delivered are minused from origin physical stock
    if (c.status === 'in_transit' || c.status === 'delivered') return false;
    if (!currentUser?.warehouse_id && currentUser?.role === 'super_admin') return true;
    return (
      c.current_warehouse_id === myWhId ||
      c.current_warehouse_id === currentUser?.warehouse_id ||
      c.booked_by === currentUser?.id ||
      (myWh && c.current_warehouse_name === myWh.name)
    );
  });

  const filteredCartons = myCartons.filter((c) => {
    const matchesSearch =
      c.ctn_no.toLowerCase().includes(invSearch.toLowerCase()) ||
      c.tracking_number.toLowerCase().includes(invSearch.toLowerCase()) ||
      c.product_name_en.toLowerCase().includes(invSearch.toLowerCase());

    const matchesStatus = invStatusFilter === 'all' || c.status === invStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const paginatedCartons = filteredCartons.slice(
    (invPage - 1) * itemsPerPage,
    invPage * itemsPerPage
  );
  const totalInvPages = Math.ceil(filteredCartons.length / itemsPerPage) || 1;

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <BookedCartonsHub
        cartons={myCartons}
        warehouses={warehouses}
        currentUser={currentUser}
        language={language}
        onUpdateCarton={(updatedCarton) => {
          setCartons((prev) => prev.map((c) => (c.id === updatedCarton.id ? updatedCarton : c)));
          saveHostingerDbData('fsc_vps_cartons', cartons.map((c) => (c.id === updatedCarton.id ? updatedCarton : c)));
        }}
        onDeleteCarton={(cartonId) => {
          const fresh = cartons.filter((c) => c.id !== cartonId);
          setCartons(fresh);
          saveHostingerDbData('fsc_vps_cartons', fresh);
        }}
      />
    </div>
  );
};
