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
import { saveHostingerDbData, saveHostingerDbMultiData, getHostingerDbData, logSystemAuditAction, subscribeToDbUpdates } from '../lib/db';
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
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
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
          <div className="bg-white dark:bg-[#1E293B] rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
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
                <thead className="bg-slate-100 dark:bg-slate-900 uppercase text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
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
                        className={`hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer ${
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
          <div className="p-12 text-center bg-white dark:bg-[#1E293B] rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
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

  // TAB: FINAL FLYING LIST & HISTORICAL ARCHIVE
  if (activeTab === 'final_flying_list') {
    return <FinalFlyingListSection language={language} />;
  }

  // TAB: DAILY FLYING PROPOSAL CREATION
  if (activeTab === 'proposal_create') {
    // Only show available stock cartons that are NOT already in a finalized/dispatched flying list
    const stockBookedCartonsRaw = cartons.filter(
      (c: Carton) =>
        (c.current_warehouse_id === myWhId || c.destination_warehouse_id === myWhId) &&
        (c.status === 'booked' || c.status === 'received' || c.status === 'proposed') &&
        !c.flight_number
    );

    // 100% Unique Carton Map by ID & Composite Key (tracking_number + ctn_no + shipping_mark)
    const uniqueStockMap = new Map<string, Carton>();
    stockBookedCartonsRaw.forEach((c: Carton) => {
      if (c) {
        const comboKey = c.tracking_number && c.ctn_no
          ? `${c.tracking_number.toLowerCase().trim()}_${c.ctn_no.toLowerCase().trim()}_${(c.shipping_mark || '').toLowerCase().trim()}`
          : c.id;
        if (!uniqueStockMap.has(comboKey)) {
          uniqueStockMap.set(comboKey, c);
        }
      }
    });
    const stockBookedCartons: Carton[] = Array.from(uniqueStockMap.values());

    // Apply live search filter inside stock import modal
    const searchFilteredStockCartons = stockBookedCartons.filter((c: Carton) => {
      if (!proposalCartonSearch.trim()) return true;
      const q = proposalCartonSearch.toLowerCase().trim();
      return (
        c.ctn_no.toLowerCase().includes(q) ||
        c.shipping_mark.toLowerCase().includes(q) ||
        c.tracking_number.toLowerCase().includes(q) ||
        c.product_name_en.toLowerCase().includes(q) ||
        (c.product_name_cn && c.product_name_cn.toLowerCase().includes(q))
      );
    });

    const toggleSelectProposalCarton = (id: string) => {
      setSelectedProposalCartonIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    };

    const toggleSelectAll = () => {
      if (selectedProposalCartonIds.length === searchFilteredStockCartons.length) {
        setSelectedProposalCartonIds([]);
      } else {
        setSelectedProposalCartonIds(searchFilteredStockCartons.map((c: Carton) => c.id));
      }
    };

    const selectedCartonsList = stockBookedCartons.filter((c: Carton) => selectedProposalCartonIds.includes(c.id));
    const selectedGrossWeight = selectedCartonsList.reduce((sum: number, c: Carton) => sum + (c.gross_weight || 0), 0);
    const selectedCbm = selectedCartonsList.reduce((sum: number, c: Carton) => sum + (c.cbm || 0), 0);

    const handleCreateFlightBatch = (e: React.FormEvent) => {
      e.preventDefault();
      const name = flyingNameInput.trim() || `Flight Batch #${Math.floor(Math.random() * 800 + 100)}`;
      setActiveFlightBatch({
        name,
        destWhId: batchDestWhId,
        date: proposalDate,
      });
      setShowStockImportModal(true);
    };

    const handleRemoveImportedCarton = (id: string) => {
      setSelectedProposalCartonIds((prev) => prev.filter((x) => x !== id));
    };

    return (
      <div className="space-y-6 font-sans pb-16">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        {/* Page Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-none bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>{isBn ? 'ডেইলি ফ্লাইট প্রোপোজাল ম্যানেজার' : 'Daily Flight Proposal Hub'}</span>
                <span className="px-2 py-0.5 rounded-none text-[10px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 font-normal border border-blue-500/20">
                  Advanced Dispatcher
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                {isBn
                  ? 'প্রথমে এডভান্সড উপায়ে ফ্লাইট ব্যাচ প্রোপোজাল তৈরি করুন, এরপর স্টক থেকে কার্টুন ইম্পোর্ট করে সুপার এডমিন/অপারেশন ডিরেক্টরে পাঠান'
                  : 'Create flight proposal batch first, then select and import cartons from stock inventory to submit'}
              </p>
            </div>
          </div>
        </div>

        {/* STEP 1: ADVANCED FLIGHT CREATOR CARD */}
        {!activeFlightBatch ? (
          <form
            onSubmit={handleCreateFlightBatch}
            className={`p-6 rounded-none border shadow-2xs space-y-6 ${
              isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                <span className="w-6 h-6 rounded-none bg-blue-600 text-white flex items-center justify-center text-xs font-mono">1</span>
                <span>{isBn ? 'নতুন ফ্লাইট প্রোপোজাল ব্যাচ তৈরি করুন (Advanced Flight Creator)' : '1. Configure Flight Proposal Batch'}</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-normal">
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1.5 font-normal">
                  {isBn ? 'ফ্লাইং নাম / ব্যাচ নম্বর (Flight No)' : 'Flight No / Batch Name'}
                </label>
                <input
                  type="text"
                  placeholder={isBn ? 'যেমন: Flight BS-206' : 'e.g. Flight BS-206'}
                  value={flyingNameInput}
                  onChange={(e) => setFlyingNameInput(e.target.value)}
                  className={`w-full border rounded-none p-3 outline-none transition-all font-normal focus:ring-2 focus:ring-blue-500/20 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                />
              </div>

              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1.5 font-normal">
                  {isBn ? 'গন্তব্য ওয়্যারহাউজ (Destination Hub)' : 'Destination Warehouse Hub'}
                </label>
                <select
                  value={batchDestWhId}
                  onChange={(e) => setBatchDestWhId(e.target.value)}
                  className={`w-full border rounded-none p-3 outline-none transition-all font-normal focus:ring-2 focus:ring-blue-500/20 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1.5 font-normal">
                  {isBn ? 'ফ্লাইট প্রোপোজাল তারিখ (Flight Date)' : 'Flight Proposal Date'}
                </label>
                <input
                  type="date"
                  value={proposalDate}
                  onChange={(e) => setProposalDate(e.target.value)}
                  className={`w-full border rounded-none p-3 font-mono outline-none transition-all font-normal focus:ring-2 focus:ring-blue-500/20 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                className="py-3 px-8 rounded-none bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-md shadow-blue-500/20 transition-all flex items-center space-x-2 cursor-pointer border border-blue-600"
              >
                <Plus className="w-4 h-4" />
                <span>{isBn ? 'ফ্লাইট ব্যাচ তৈরি করে ডাটা ইম্পোর্ট করুন' : 'Create Flight Batch & Import Stock'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          /* STEP 2: ACTIVE FLIGHT BATCH WORKSPACE */
          <div className="space-y-6">
            {/* Active Flight Header Card */}
            <div className={`p-6 rounded-none border shadow-2xs space-y-6 ${
              isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-none text-[10px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold uppercase border border-blue-500/20">
                      Active Flight Batch
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Date: {activeFlightBatch.date}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1 flex items-center space-x-2">
                    <Plane className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span>{activeFlightBatch.name}</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-normal mt-0.5">
                    Destination: {warehouses.find((w) => w.id === activeFlightBatch.destWhId)?.name || 'Dhaka Central Hub'}
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowStockImportModal(true)}
                    className="py-2.5 px-5 rounded-none bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-medium text-xs transition-all flex items-center space-x-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isBn ? 'স্টক থেকে কার্টুন ইম্পোর্ট করুন' : 'Import Stock Cartons'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFlightBatch(null)}
                    className="py-2.5 px-4 rounded-none border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white font-medium text-xs transition-all cursor-pointer"
                  >
                    {isBn ? 'অন্য ফ্লাইট তৈরি করুন' : 'Change Flight'}
                  </button>
                </div>
              </div>

              {/* KPI STATS BAR FOR ACTIVE BATCH */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`p-4 rounded-none border transition-all ${
                  isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 block text-xs font-normal">{isBn ? 'ইম্পোর্টকৃত কার্টুন' : 'Imported Cartons'}</span>
                    <span className="px-2 py-0.5 rounded-none text-[10px] font-mono bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 font-medium">
                      Count
                    </span>
                  </div>
                  <strong className="text-xl font-mono text-blue-600 dark:text-blue-400 font-bold mt-2 block">
                    {selectedProposalCartonIds.length} CTNs
                  </strong>
                </div>

                <div className={`p-4 rounded-none border transition-all ${
                  isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 block text-xs font-normal">{isBn ? 'মোট গ্রস ওজন' : 'Total Gross Weight'}</span>
                    <span className="px-2 py-0.5 rounded-none text-[10px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                      Weight
                    </span>
                  </div>
                  <strong className="text-xl font-mono text-emerald-600 dark:text-emerald-400 font-bold mt-2 block">
                    {selectedGrossWeight.toFixed(1)} KG
                  </strong>
                </div>

                <div className={`p-4 rounded-none border transition-all ${
                  isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 block text-xs font-normal">{isBn ? 'মোট ভলিউমেট্রিক সিবিএম' : 'Total CBM Volume'}</span>
                    <span className="px-2 py-0.5 rounded-none text-[10px] font-mono bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 font-medium">
                      Volume
                    </span>
                  </div>
                  <strong className="text-xl font-mono text-purple-600 dark:text-purple-400 font-bold mt-2 block">
                    {selectedCbm.toFixed(2)} CBM
                  </strong>
                </div>
              </div>

              {/* IMPORTED CARTONS TABLE IN THIS FLIGHT BATCH */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Box className="w-4 h-4 text-blue-500" />
                  <span>{isBn ? 'ফ্লাইট ব্যাচে যুক্ত থাকা ইম্পোর্টকৃত কার্টুনসমূহ:' : 'Imported Cartons in Flight Batch:'}</span>
                </h4>

                {selectedCartonsList.length > 0 ? (
                  <div className="overflow-x-auto rounded-none border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs font-normal">
                      <thead className={`uppercase text-[10px] tracking-wider border-b ${
                        isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        <tr>
                          <th className="p-3 font-normal">CTN NO</th>
                          <th className="p-3 font-normal">SHIPPING MARK</th>
                          <th className="p-3 font-normal">PRODUCT NAME</th>
                          <th className="p-3 text-center font-normal">QTY / GROSS WT</th>
                          <th className="p-3 text-center font-normal">CBM</th>
                          <th className="p-3 text-center font-normal">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                        {selectedCartonsList.map((c: Carton) => (
                          <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                            <td className="p-3 font-mono font-medium text-slate-900 dark:text-white">
                              <span className="px-2 py-0.5 rounded-none bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] border border-slate-300 dark:border-slate-700">
                                {c.ctn_no}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-blue-600 dark:text-blue-400 font-medium">
                              <span className="px-2 py-0.5 rounded-none bg-blue-500/10 border border-blue-500/20 text-[11px]">
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
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveImportedCarton(c.id)}
                                className="p-1.5 rounded-none text-slate-400 hover:text-red-600 hover:bg-red-500/10 transition-all cursor-pointer"
                                title="Remove from flight"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-none space-y-3">
                    <div className="w-12 h-12 rounded-none bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-500/20">
                      <Download className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {isBn ? 'ফ্লাইটে কোনো কার্টুন যুক্ত করা হয়নি!' : 'No Cartons Imported Yet!'}
                      </h4>
                      <p className="text-xs text-slate-400 font-normal mt-1 max-w-sm mx-auto">
                        {isBn
                          ? "'স্টক থেকে কার্টুন ইম্পোর্ট করুন' বাটনে ক্লিক করে লভ্য অল বুকিং লিস্ট থেকে ডাটা ইম্পোর্ট করুন।"
                          : 'Click the button below to browse available stock cartons and import them into this flight batch.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowStockImportModal(true)}
                      className="py-2.5 px-6 rounded-none bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-md shadow-blue-500/20 transition-all inline-flex items-center space-x-2 cursor-pointer border border-blue-600"
                    >
                      <Download className="w-4 h-4" />
                      <span>{isBn ? 'স্টক থেকে ডাটা ইম্পোর্ট করুন' : 'Import Cartons from Stock'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* ACTION FOOTER */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 font-normal">
                  {isBn ? 'সকল প্রস্তুতকৃত ডাটা প্রোপোজাল হিসেবে সরাসরি ডিরেক্টর ও এডমিনের কাছে প্রেরিত হবে' : 'Submitting will immediately send this flight proposal batch to Director & Admin'}
                </div>

                <button
                  type="button"
                  onClick={handleSubmitProposal}
                  disabled={selectedProposalCartonIds.length === 0}
                  className="w-full sm:w-auto py-3 px-8 rounded-none bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 text-white font-medium text-xs shadow-md shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer border border-blue-600"
                >
                  <Plane className="w-4 h-4" />
                  <span>
                    {isBn
                      ? `অপারেশন ডিরেক্টর ও এডমিনকে প্রোপোজাল পাঠান (${selectedProposalCartonIds.length} Cartons)`
                      : `Submit Flight Proposal (${selectedProposalCartonIds.length} Cartons)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STOCK CARTONS SELECTION & IMPORT MODAL WINDOW (Zero Border-Radius & Clean White Theme Badges) */}
        {showStockImportModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
            <div className={`w-full max-w-6xl max-h-[92vh] flex flex-col rounded-none border shadow-2xl overflow-hidden font-sans ${
              isDark ? 'bg-[#0F172A] border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
            }`}>
              {/* Modal Header */}
              <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
                isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-none bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-300 dark:border-slate-700">
                    <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-normal tracking-wide text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                      <span>{isBn ? 'স্টক ইনভেন্টরি থেকে কার্টুন সিলেক্ট ও ইম্পোর্ট করুন' : 'Select & Import Cartons from Stock'}</span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-light">
                        Target Flight: <strong className="text-blue-600 dark:text-blue-400 font-mono font-normal">{activeFlightBatch?.name || 'Flight Batch'}</strong>
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="px-2 py-0.5 rounded-none text-[11px] font-mono font-light bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                        {isBn ? `মোট স্টক: ${stockBookedCartons.length} টি` : `Total Available: ${stockBookedCartons.length} CTNs`}
                      </span>
                      {proposalCartonSearch && (
                        <span className="px-2 py-0.5 rounded-none text-[11px] font-mono font-medium bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 border border-blue-500 dark:border-blue-700">
                          {isBn ? `ফিল্টারকৃত: ${searchFilteredStockCartons.length} টি` : `Filtered: ${searchFilteredStockCartons.length} Items`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowStockImportModal(false)}
                  className="p-2 rounded-none text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer border border-transparent hover:border-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Toolbar (Search & Select Controls) */}
              <div className={`p-3.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={isBn ? 'খুঁজুন: শিপিং মার্ক, কার্টুন নং, ট্র্যাকিং ID...' : 'Search by shipping mark, CTN no, tracking...'}
                    value={proposalCartonSearch}
                    onChange={(e) => setProposalCartonSearch(e.target.value)}
                    className={`w-full pl-8 pr-7 py-2 rounded-none border text-xs outline-none transition-all font-light ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500'
                    }`}
                  />
                  {proposalCartonSearch && (
                    <button
                      type="button"
                      onClick={() => setProposalCartonSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="px-3.5 py-2 rounded-none border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-light hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer text-xs"
                  >
                    <span>
                      {selectedProposalCartonIds.length === searchFilteredStockCartons.length && searchFilteredStockCartons.length > 0
                        ? (isBn ? 'সব আনসিলেক্ট করুন' : 'Deselect All')
                        : (isBn ? `সব সিলেক্ট করুন (${searchFilteredStockCartons.length} টি)` : `Select All (${searchFilteredStockCartons.length} CTNs)`)}
                    </span>
                  </button>
                  <span className="px-3.5 py-2 rounded-none text-xs font-mono font-medium bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 border border-blue-500 dark:border-blue-700">
                    {selectedProposalCartonIds.length} / {stockBookedCartons.length} {isBn ? 'টি সিলেক্টেড' : 'Selected'}
                  </span>
                </div>
              </div>

              {/* Modal Table Content (Full Complete Data Table with Pure White Badges) */}
              <div className="p-3 sm:p-4 overflow-y-auto max-h-[58vh] space-y-3">
                <div className="overflow-x-auto rounded-none border border-slate-200 dark:border-slate-800">
                  <table className="min-w-max w-full text-left text-xs font-light">
                    <thead className={`uppercase text-[10px] tracking-wider border-b ${
                      isDark ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-white text-slate-600 border-slate-200'
                    }`}>
                      <tr>
                        <th className="p-3 w-10 text-center font-normal">
                          <input
                            type="checkbox"
                            checked={selectedProposalCartonIds.length === searchFilteredStockCartons.length && searchFilteredStockCartons.length > 0}
                            onChange={toggleSelectAll}
                            className="w-3.5 h-3.5 rounded-none text-blue-600 border-slate-300 cursor-pointer accent-blue-600"
                          />
                        </th>
                        <th className="p-3 font-normal">CTN NO</th>
                        <th className="p-3 font-normal">TRACKING ID</th>
                        <th className="p-3 font-normal">SHIPPING MARK</th>
                        <th className="p-3 font-normal">PRODUCT NAME</th>
                        <th className="p-3 font-normal">DESTINATION HUB</th>
                        <th className="p-3 text-center font-normal">QTY (PCS)</th>
                        <th className="p-3 text-center font-normal">WEIGHT (GROSS / NET)</th>
                        <th className="p-3 text-center font-normal">CBM</th>
                        <th className="p-3 text-center font-normal">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-200 text-slate-700'}`}>
                      {searchFilteredStockCartons.map((c: Carton) => {
                        const isSelected = selectedProposalCartonIds.includes(c.id);
                        return (
                          <tr
                            key={c.id}
                            onClick={() => toggleSelectProposalCarton(c.id)}
                            className={`hover:bg-blue-50/40 dark:hover:bg-slate-900/60 cursor-pointer transition-colors ${
                              isSelected ? (isDark ? 'bg-blue-950/30' : 'bg-blue-50/70') : ''
                            }`}
                          >
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-3.5 h-3.5 rounded-none text-blue-600 border-slate-300 cursor-pointer accent-blue-600"
                              />
                            </td>
                            <td className="p-3 font-mono whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-[11px] font-normal border border-slate-300 dark:border-slate-700">
                                {c.ctn_no}
                              </span>
                            </td>
                            <td className="p-3 font-mono whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-none bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-mono text-[11px] border border-slate-300 dark:border-slate-700 font-light">
                                {c.tracking_number}
                              </span>
                            </td>
                            <td className="p-3 font-mono whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-none bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 font-mono text-[11px] font-medium border border-blue-500 dark:border-blue-700">
                                {c.shipping_mark}
                              </span>
                            </td>
                            <td className="p-3 font-sans min-w-[200px]">
                              <div className="font-normal text-slate-800 dark:text-slate-200">
                                {c.product_name_en}
                              </div>
                              {c.product_name_cn && (
                                <div className="text-[10px] text-slate-400 font-light mt-0.5">
                                  {c.product_name_cn}
                                </div>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap font-light">
                              <span className="px-2.5 py-1 rounded-none bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[11px] border border-slate-300 dark:border-slate-700">
                                {c.destination_warehouse_name || 'ঢাকা সেন্ট্রাল (DAC-01)'}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap font-light">
                              {c.quantity} Pcs
                            </td>
                            <td className="p-3 text-center font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap font-light">
                              <span>{c.gross_weight} kg</span>
                              {c.net_weight && <span className="text-slate-400 text-[10px] ml-1">(Net: {c.net_weight} kg)</span>}
                            </td>
                            <td className="p-3 text-center font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap font-light">
                              {c.cbm} CBM
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-none text-[10px] font-normal uppercase ${
                                c.status === 'booked'
                                  ? 'bg-white text-slate-700 border border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
                                  : c.status === 'received'
                                  ? 'bg-white text-emerald-700 border border-emerald-500 dark:bg-slate-900 dark:text-emerald-400 dark:border-emerald-700'
                                  : 'bg-white text-amber-700 border border-amber-500 dark:bg-slate-900 dark:text-amber-400 dark:border-amber-700'
                              }`}>
                                {c.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {searchFilteredStockCartons.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-none space-y-1.5 font-light">
                    <Box className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
                    <div>
                      {proposalCartonSearch
                        ? (isBn ? 'খুঁজে পাওয়া যায়নি! অন্য কিওয়ার্ড দিয়ে টাইপ করুন।' : 'No cartons found matching your search query.')
                        : (isBn ? 'প্রোপোজাল দেওয়ার মতো কোনো স্টক কার্টুন পাওয়া যায়নি!' : 'No stock cartons available.')}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Action (Clean White Theme Badges) */}
              <div className={`p-3.5 sm:p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
                isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-600 dark:text-slate-400 font-light">
                  <span className="px-2.5 py-1 rounded-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-normal border border-slate-300 dark:border-slate-700">
                    📦 {selectedProposalCartonIds.length} {isBn ? 'টি কার্টুন' : 'Cartons'}
                  </span>
                  <span>
                    ওজন: <strong className="text-slate-800 dark:text-slate-200 font-normal">{selectedGrossWeight.toFixed(1)} KG</strong>
                  </span>
                  <span>•</span>
                  <span>
                    ভলিউম: <strong className="text-slate-800 dark:text-slate-200 font-normal">{selectedCbm.toFixed(2)} CBM</strong>
                  </span>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowStockImportModal(false)}
                    className="flex-1 sm:flex-none py-2 px-4 rounded-none border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-light text-xs transition-all cursor-pointer"
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowStockImportModal(false)}
                    disabled={selectedProposalCartonIds.length === 0}
                    className="flex-1 sm:flex-none py-2 px-5 rounded-none bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-normal text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer border border-blue-600"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {isBn
                        ? `ইম্পোর্ট সম্পন্ন করুন (${selectedProposalCartonIds.length} CTNs)`
                        : `Complete Import (${selectedProposalCartonIds.length} CTNs)`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Read-Only Submitted Proposals History Table */}
        <div className={`p-6 rounded-none border shadow-2xs space-y-4 ${
          isDark ? 'bg-[#1E293B] border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'
        }`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{isBn ? 'আপনার ওয়্যারহাউজের পূর্বের প্রোপোজাল ইতিহাস (Submitted Proposals History)' : 'Submitted Proposals History'}</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400 font-normal">
              Total Proposals: {proposalHistory.length}
            </span>
          </div>

          <div className="overflow-x-auto rounded-none border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs font-normal">
              <thead className={`uppercase text-[10px] tracking-wider border-b ${
                isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                <tr>
                  <th className="p-3 font-normal">FLIGHT / BATCH NAME</th>
                  <th className="p-3 font-normal">PROPOSAL DATE</th>
                  <th className="p-3 font-normal text-center">ITEMS COUNT</th>
                  <th className="p-3 font-normal text-center">TOTAL WEIGHT</th>
                  <th className="p-3 font-normal text-center">TOTAL CBM</th>
                  <th className="p-3 font-normal text-center">STATUS</th>
                  <th className="p-3 font-normal text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-200' : 'divide-slate-200 text-slate-800'}`}>
                {proposalHistory.map((ph) => (
                  <tr key={ph.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="p-3 font-mono font-medium text-blue-600 dark:text-blue-400">{ph.flying_name || ph.flight_number || 'Flight Batch'}</td>
                    <td className="p-3 font-mono text-slate-500">{ph.date}</td>
                    <td className="p-3 text-center font-mono font-medium">{ph.items_count} Cartons</td>
                    <td className="p-3 text-center font-mono text-emerald-600 dark:text-emerald-400">{ph.total_weight} kg</td>
                    <td className="p-3 text-center font-mono text-purple-600 dark:text-purple-400">{ph.total_cbm} CBM</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          ph.status === 'finalized'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : ph.status === 'rejected'
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {ph.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        {ph.status === 'pending' ? (
                          <>
                            {/* Option 1: Edit Proposal */}
                            <button
                              type="button"
                              onClick={() => handleEditProposal(ph)}
                              title={isBn ? 'এই প্রোপোজালটি এডিট ও আপডেট করুন' : 'Edit & Update Proposal'}
                              className="py-1 px-2.5 rounded-none bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-normal flex items-center space-x-1 transition-all cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{isBn ? 'এডিট' : 'Edit'}</span>
                            </button>

                            {/* Option 2: Manage Cartons */}
                            <button
                              type="button"
                              onClick={() => {
                                handleEditProposal(ph);
                                setShowStockImportModal(true);
                              }}
                              title={isBn ? 'স্টক থেকে কার্টুন যোগ বা বাদ দিন' : 'Add/Remove Stock Cartons'}
                              className="py-1 px-2.5 rounded-none bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-normal flex items-center space-x-1 transition-all cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>{isBn ? 'কার্টুন' : 'Cartons'}</span>
                            </button>

                            {/* Option 3: Delete / Cancel */}
                            <button
                              type="button"
                              onClick={() => handleDeleteProposal(ph.id)}
                              title={isBn ? 'প্রস্তাবনা ডিলেট বা বাতিল করুন' : 'Cancel & Delete Proposal'}
                              className="py-1 px-2.5 rounded-none bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 text-[10px] font-normal flex items-center space-x-1 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>{isBn ? 'ডিলেট' : 'Delete'}</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">Locked</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {proposalHistory.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400 font-normal">
              {isBn ? 'এখনো কোনো ফ্লাইট প্রোপোজাল সাবমিট করা হয়নি!' : 'No flight proposals submitted yet!'}
            </div>
          )}
        </div>
      </div>
    );
  }

  // DEFAULT TAB: OWN WAREHOUSE INVENTORY PAGE (Strictly current physical warehouse stock)
  const myCartons = cartons.filter((c) => {
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
