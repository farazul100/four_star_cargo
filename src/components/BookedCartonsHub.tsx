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
  Printer,
  GitFork,
} from 'lucide-react';
import { Carton, Warehouse, User as UserType, Language, Customer } from '../types';
import { useTheme } from '../context/ThemeContext';
import { getHostingerDbData, saveHostingerDbData, logSystemAuditAction, subscribeToDbUpdates } from '../lib/db';
import { CartonInvoicesModal } from './CartonInvoicesModal';

interface BookedCartonsHubProps {
  cartons: Carton[];
  warehouses: Warehouse[];
  currentUser: UserType;
  language: Language;
  onUpdateCarton?: (updatedCarton: Carton) => void;
  onDeleteCarton?: (cartonId: string) => void;
}

/**
 * Helper to extract numeric value from ctn_no string (e.g. CTN-01 -> 1, CTN-03 -> 3, GZAU-105 -> 105)
 */
export const extractCartonNumber = (ctnNo: string): number => {
  if (!ctnNo) return 999999;
  const match = ctnNo.match(/\d+/);
  return match ? parseInt(match[0], 10) : 999999;
};

/**
 * Natural carton comparator: Sorts by numeric carton number (CTN-01 -> CTN-02 -> CTN-03)
 * while preserving sub-item grouping for merged cartons.
 */
export const compareCartonsNaturally = (a: Carton, b: Carton): number => {
  const numA = extractCartonNumber(a.ctn_no);
  const numB = extractCartonNumber(b.ctn_no);

  // Primary: Sort by numeric carton number (1, 2, 3...)
  if (numA !== numB) {
    return numA - numB;
  }

  // Secondary: Sort by ctn_no string if numbers match
  const ctnComp = (a.ctn_no || '').localeCompare(b.ctn_no || '', undefined, { numeric: true });
  if (ctnComp !== 0) return ctnComp;

  // Tertiary: Keep cartons with same master_group_id together
  if (a.master_group_id && b.master_group_id && a.master_group_id !== b.master_group_id) {
    return a.master_group_id.localeCompare(b.master_group_id);
  }

  // Quaternary: Sort by shipping_mark
  return (a.shipping_mark || '').localeCompare(b.shipping_mark || '', undefined, { numeric: true });
};

/**
 * Helper to determine rowSpan and grouping for merged cartons in table displays.
 */
export const getCartonRowSpanInfo = (cartons: Carton[], index: number) => {
  const current = cartons[index];
  if (!current) return { isFirst: true, rowSpan: 1, isMerged: false };

  // Group key: master_group_id OR uppercase ctn_no
  const groupKey = current.master_group_id || (current.ctn_no ? current.ctn_no.trim().toUpperCase() : null);

  if (groupKey) {
    const matchingIndices: number[] = [];
    cartons.forEach((c, idx) => {
      const k = c.master_group_id || (c.ctn_no ? c.ctn_no.trim().toUpperCase() : null);
      if (k === groupKey) {
        matchingIndices.push(idx);
      }
    });

    if (matchingIndices.length > 1) {
      const firstIdx = matchingIndices[0];
      if (index === firstIdx) {
        return { isFirst: true, rowSpan: matchingIndices.length, isMerged: true };
      }
      return { isFirst: false, rowSpan: 0, isMerged: true };
    }
  }

  return { isFirst: true, rowSpan: 1, isMerged: false };
};

export const getSlNumberForCartonRow = (cartons: Carton[], index: number) => {
  let sl = 0;
  for (let i = 0; i <= index; i++) {
    const span = getCartonRowSpanInfo(cartons, i);
    if (span.isFirst) {
      sl++;
    }
  }
  return sl;
};

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
  const [selectedCartonsForInvoiceModal, setSelectedCartonsForInvoiceModal] = useState<Carton[] | null>(null);

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

  // CARTON BATCH & SINGLE CARTON DELETION HANDLERS
  const handleDeleteSingleCarton = (cartonId: string) => {
    if (!window.confirm(isBn ? 'আপনি কি নিশ্চিত যে এই কার্টুনটি ডিলিট করতে চান?' : 'Are you sure you want to delete this carton?')) {
      return;
    }

    const dbData = getHostingerDbData();
    const updatedCartons = (dbData.cartons || []).filter((c) => c.id !== cartonId);
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);
    setLiveRealtimeCartons(updatedCartons);

    if (onDeleteCarton) {
      onDeleteCarton(cartonId);
    }

    logSystemAuditAction(
      currentUser,
      'DELETE_CARTON',
      'carton',
      cartonId,
      `কার্টুন আইডি ${cartonId} মুছে ফেলা হয়েছে`
    );
  };

  const handleDeleteCartonGroup = (groupCartons: Carton[], groupName: string) => {
    if (!window.confirm(isBn ? `আপনি কি নিশ্চিত যে "${groupName}" এর সকল (${groupCartons.length}টি) কার্টুন সম্পূর্ণ ডিলিট করতে চান?` : `Are you sure you want to delete all ${groupCartons.length} cartons for "${groupName}"?`)) {
      return;
    }

    const idsToDelete = new Set(groupCartons.map((c) => c.id));
    const dbData = getHostingerDbData();
    const updatedCartons = (dbData.cartons || []).filter((c) => !idsToDelete.has(c.id));
    saveHostingerDbData('fsc_vps_cartons', updatedCartons);
    setLiveRealtimeCartons(updatedCartons);

    groupCartons.forEach((c) => {
      if (onDeleteCarton) onDeleteCarton(c.id);
    });

    if (activeCustomerModalMark === groupName) {
      setActiveCustomerModalMark(null);
    }

    logSystemAuditAction(
      currentUser,
      'DELETE_CARTON_BATCH',
      'carton',
      groupName,
      `কার্টুন ব্যাচ ${groupName} (${groupCartons.length}টি কার্টুন) মুছে ফেলা হয়েছে`
    );
  };

  // ADD SUB-SHIPPING MARK / MERGE CARTON IN HUB VIEW
  const handleAddSubItemToCarton = (targetCarton: Carton) => {
    const defaultMark = `${targetCarton.shipping_mark}-2`;
    const markInput = window.prompt(
      isBn
        ? `কার্টুন (${targetCarton.ctn_no}) এ মার্জ করার জন্য নতুন সাব-শিপিং মার্ক লিখুন:`
        : `Enter Sub-Shipping Mark to merge into carton (${targetCarton.ctn_no}):`,
      defaultMark
    );

    if (!markInput || !markInput.trim()) return;

    const masterGroupId = targetCarton.master_group_id || `grp-${targetCarton.ctn_no}-${Date.now()}`;

    const newSubCarton: Carton = {
      ...targetCarton,
      id: `fsc-carton-sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      shipping_mark: markInput.trim(),
      master_group_id: masterGroupId,
      is_merged: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const dbData = getHostingerDbData();
    const updatedCartons = (dbData.cartons || []).map((c) =>
      c.id === targetCarton.id || c.ctn_no === targetCarton.ctn_no
        ? { ...c, master_group_id: masterGroupId, is_merged: true }
        : c
    );

    const fullCartonsList = [newSubCarton, ...updatedCartons];
    saveHostingerDbData('fsc_vps_cartons', fullCartonsList);
    setLiveRealtimeCartons(fullCartonsList);

    if (onUpdateCarton) {
      onUpdateCarton({ ...targetCarton, master_group_id: masterGroupId, is_merged: true });
    }

    logSystemAuditAction(
      currentUser,
      'MERGE_CARTON_SUB_ITEM',
      'carton',
      targetCarton.ctn_no,
      `কার্টুন ${targetCarton.ctn_no} এ সাব-শিপিং মার্ক ${markInput.trim()} মার্জ করা হয়েছে`
    );
  };

  // Selected Cartons Checkbox State for Excel-style Bulk Merge/Unmerge
  const [selectedHubCartonIds, setSelectedHubCartonIds] = useState<string[]>([]);

  const handleToggleSelectCarton = (id: string) => {
    setSelectedHubCartonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllInModal = (modalCartons: Carton[]) => {
    const modalIds = modalCartons.map((c) => c.id);
    const allSelected = modalIds.length > 0 && modalIds.every((id) => selectedHubCartonIds.includes(id));

    if (allSelected) {
      setSelectedHubCartonIds((prev) => prev.filter((id) => !modalIds.includes(id)));
    } else {
      setSelectedHubCartonIds((prev) => Array.from(new Set([...prev, ...modalIds])));
    }
  };

  // BULK MERGE SELECTED CARTONS IN HUB
  const handleBulkMergeInHub = (targetCartonsList: Carton[]) => {
    const selectedCartons = targetCartonsList.filter((c) => selectedHubCartonIds.includes(c.id));
    if (selectedCartons.length < 2) {
      alert(isBn ? 'মার্জ করার জন্য অন্তত ২টি কার্টুন সিলেক্ট করুন!' : 'Select at least 2 cartons to merge!');
      return;
    }

    const masterCarton = selectedCartons[0];
    const groupId = masterCarton.master_group_id || `grp-hub-${masterCarton.ctn_no}-${Date.now()}`;
    const targetCtnNo = masterCarton.ctn_no;
    const targetPkgNo = masterCarton.packaging_number;

    const dbData = getHostingerDbData();
    const updatedCartons = (dbData.cartons || []).map((c) => {
      if (selectedHubCartonIds.includes(c.id)) {
        return {
          ...c,
          ctn_no: targetCtnNo,
          packaging_number: targetPkgNo,
          master_group_id: groupId,
          is_merged: true,
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    saveHostingerDbData('fsc_vps_cartons', updatedCartons);
    setLiveRealtimeCartons(updatedCartons);
    setSelectedHubCartonIds([]);

    logSystemAuditAction(
      currentUser,
      'BULK_MERGE_CARTONS',
      'carton',
      targetCtnNo,
      `${selectedCartons.length}টি কার্টুনকে ${targetCtnNo} তে মার্জ করা হয়েছে`
    );
  };

  // BULK UNMERGE SELECTED CARTONS IN HUB
  const handleBulkUnmergeInHub = (targetCartonsList: Carton[]) => {
    const selectedCartons = targetCartonsList.filter((c) => selectedHubCartonIds.includes(c.id));
    if (selectedCartons.length === 0) return;

    const dbData = getHostingerDbData();
    let unmergeCounter = 1;

    const updatedCartons = (dbData.cartons || []).map((c) => {
      if (selectedHubCartonIds.includes(c.id)) {
        const newCtnNo = `CTN-${unmergeCounter < 10 ? '0' : ''}${unmergeCounter++}`;
        return {
          ...c,
          ctn_no: newCtnNo,
          master_group_id: undefined,
          is_merged: false,
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    saveHostingerDbData('fsc_vps_cartons', updatedCartons);
    setLiveRealtimeCartons(updatedCartons);
    setSelectedHubCartonIds([]);

    logSystemAuditAction(
      currentUser,
      'BULK_UNMERGE_CARTONS',
      'carton',
      'UNMERGE',
      `${selectedCartons.length}টি কার্টুন আনমার্জ করা হয়েছে`
    );
  };

  // Check if current user is restricted to their assigned warehouse only (Warehouse Incharge)
  const isWarehouseIncharge =
    currentUser?.role === 'warehouse_incharge' ||
    (currentUser?.role !== 'super_admin' && currentUser?.role !== 'operation_director' && !!currentUser?.warehouse_id);

  const myWhId = currentUser?.warehouse_id;

  // Base cartons accessible by current user (Restricted for Warehouse Incharge to CURRENT physical warehouse stock)
  const accessibleCartons = React.useMemo(() => {
    if (isWarehouseIncharge) {
      return liveRealtimeCartons.filter(
        (c) =>
          c.current_warehouse_id === myWhId ||
          c.current_warehouse_id === currentUser?.warehouse_id ||
          c.booked_by === currentUser?.id
      );
    }
    return liveRealtimeCartons;
  }, [liveRealtimeCartons, isWarehouseIncharge, myWhId, currentUser]);

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

  // Active Customer in Modal (Sorted naturally by carton number: CTN-01, CTN-02...)
  const activeCustomerCartons = React.useMemo(() => {
    if (!activeCustomerModalMark) return [];
    const targetKey = activeCustomerModalMark.toLowerCase().trim();

    // 1. Initial list from customerGroupsMap or direct match
    let list = customerGroupsMap[activeCustomerModalMark] || [];

    if (list.length === 0) {
      list = accessibleCartons.filter((c) => {
        const trk = (c.tracking_number || '').toLowerCase().trim();
        const mark = (c.shipping_mark || '').toLowerCase().trim();
        const masterTrk = (c.master_tracking_number || '').toLowerCase().trim();
        const groupId = (c.master_group_id || '').toLowerCase().trim();

        return trk === targetKey || masterTrk === targetKey || mark === targetKey || groupId === targetKey;
      });
    }

    // 2. Expand list to include ALL cartons belonging to the same tracking batch or master group
    if (list.length > 0) {
      const firstTrk = (list[0].tracking_number || list[0].master_tracking_number || '').toLowerCase().trim();
      const firstGroupId = (list[0].master_group_id || '').toLowerCase().trim();

      if (firstTrk || firstGroupId) {
        const expanded = accessibleCartons.filter((c) => {
          const trk = (c.tracking_number || c.master_tracking_number || '').toLowerCase().trim();
          const groupId = (c.master_group_id || '').toLowerCase().trim();
          return (firstTrk && trk === firstTrk) || (firstGroupId && groupId === firstGroupId);
        });
        if (expanded.length > list.length) {
          list = expanded;
        }
      }
    }

    return [...list].sort(compareCartonsNaturally);
  }, [activeCustomerModalMark, customerGroupsMap, accessibleCartons]);

  // Filtered Cartons Sorted for List View
  const sortedFilteredCartons = React.useMemo(() => {
    return [...filteredCartons].sort(compareCartonsNaturally);
  }, [filteredCartons]);

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
        className={`p-5 rounded-2xl border transition-all shadow-xl space-y-4 ${
          isDark
            ? 'bg-[#1E293B] border-slate-700 text-white'
            : 'bg-white border-slate-200/90 text-slate-900'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 border-slate-200 dark:border-slate-700">
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
              <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-[#1E293B] px-3 py-1.5 rounded-none-none border border-slate-200 dark:border-slate-700 text-xs">
                <span className="text-[10px] text-slate-500 font-mono">{isBn ? 'গ্রুপ:' : 'Group:'}</span>
                <span className="px-2.5 py-0.5 rounded-none-none text-[11px] font-semibold bg-emerald-600 text-white shadow-2xs">
                  {isBn ? '📦 ট্র্যাকিং ID' : 'Tracking ID'}
                </span>
              </div>
            )}

            {/* VIEW MODE TOGGLE */}
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-[#1E293B] p-1 rounded-none-none border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-none-none text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-none-none text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
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
          <div className={`p-3 rounded-none-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-500 font-mono uppercase">{isBn ? 'মোট কাস্টমার' : 'Total Customers'}</div>
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5 font-mono">{customerGroupKeys.length} {isBn ? 'জন' : 'Customers'}</div>
          </div>

          <div className={`p-3 rounded-none-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-500 font-mono uppercase">{isBn ? 'মোট কার্টুন সংখ্যা' : 'Total Cartons'}</div>
            <div className={`text-sm font-bold mt-0.5 font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalCartonCount} {isBn ? 'টি' : 'Cartons'}</div>
          </div>

          <div className={`p-3 rounded-none-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-500 font-mono uppercase">{isBn ? 'মোট গ্রস ওজন' : 'Total Gross Weight'}</div>
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">{totalGrossWeight.toFixed(1)} KG</div>
          </div>

          <div className={`p-3 rounded-none-none border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
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
              className={`w-full pl-9 pr-3 py-2 rounded-none-none border text-xs font-normal focus:ring-2 focus:ring-blue-500 ${
                isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
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
              className={`w-full px-3 py-2 rounded-none-none border text-xs font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
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
                    {w.name} ({count} {isBn ? 'টি কার্টুন' : 'Cartons'})
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
              className={`w-full px-3 py-2 rounded-none-none border text-xs font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
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
                    {w.name} ({destCount} {isBn ? 'টি কার্টুন' : 'Cartons'})
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
              className={`w-full px-3 py-2 rounded-none-none border text-xs font-mono focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
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
                    className={`p-5 rounded-2xl border transition-all shadow-xl flex flex-col justify-between space-y-4 hover:shadow-2xl cursor-pointer ${
                      isDark
                        ? 'bg-[#1E293B] border-slate-700 hover:border-teal-500/50'
                        : 'bg-white border-slate-200 hover:border-blue-400'
                    }`}
                    onClick={() => setActiveCustomerModalMark(mark)}
                  >
                    <div>
                      {/* Customer Card Header */}
                      <div className="flex items-start justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
                        <div>
                          <div className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold">
                            {mark}
                          </div>
                          <h3 className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {firstCarton?.product_name_en || 'Customer Shipment'}
                          </h3>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            {groupCartons.length} Cartons
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCartonGroup(groupCartons, mark);
                            }}
                            className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 transition-all cursor-pointer"
                            title={isBn ? 'এই সম্পূর্ণ কার্টুন ব্যাচ ডিলেট করুন' : 'Delete Entire Carton Batch'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCartonsForInvoiceModal(groupCartons);
                          }}
                          className="px-2.5 py-1 bg-[#00897B] hover:bg-[#00796B] text-white text-[11px] font-bold rounded flex items-center space-x-1 cursor-pointer transition-all shadow-xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{isBn ? 'ইনভয়েস প্রিন্ট' : 'Print Invoices'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCartonGroup(groupCartons, mark);
                          }}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded flex items-center space-x-1 cursor-pointer transition-all shadow-xs"
                          title={isBn ? 'সম্পূর্ণ কার্টুন ব্যাচ ডিলেট করুন' : 'Delete Batch'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isBn ? 'ডিলেট' : 'Delete'}</span>
                        </button>
                      </div>

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
            <div className={`p-10 rounded-2xl border text-center space-y-3 shadow-xl ${
              isDark ? 'bg-[#1E293B] border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-500'
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
          className={`rounded-2xl border transition-all shadow-xl overflow-hidden ${
            isDark
              ? 'bg-[#1E293B] border-slate-700 text-white'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isBn ? 'সকল কার্টুনের বিবরণ (Central Cartons Inventory Table)' : 'Central Cartons Inventory List'}
            </h3>
            <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold">
              {filteredCartons.length} Cartons Total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse border border-slate-200 dark:border-slate-700 table-fixed min-w-[1200px]">
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
              <thead className={`uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700 font-medium ${
                isDark ? 'bg-[#1E293B] text-slate-300' : 'bg-slate-100 text-slate-700'
              }`}>
                <tr>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-center font-medium">SL</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 font-medium">CTN NO</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 font-medium">MARK</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 font-medium">TRACKING NO</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 font-medium">PRODUCT (EN & CN)</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-center font-medium">QTY</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-center font-medium">N.WT</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-center font-medium">G.WT</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-center font-medium">CBM</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 font-medium">DESTINATION</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-center font-medium">STATUS</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-center font-medium">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {sortedFilteredCartons.map((c, idx) => {
                  const spanInfo = getCartonRowSpanInfo(sortedFilteredCartons, idx);
                  const slNum = getSlNumberForCartonRow(sortedFilteredCartons, idx);

                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${
                        spanInfo.isMerged
                          ? isDark
                            ? 'bg-indigo-950/20 hover:bg-indigo-950/30'
                            : 'bg-indigo-50/40 hover:bg-indigo-50/70'
                          : isDark
                          ? 'hover:bg-slate-800/50'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* SL (RowSpanned if Merged) */}
                      {spanInfo.isFirst && (
                        <td
                          rowSpan={spanInfo.rowSpan}
                          className={`p-3 text-center font-mono align-middle font-bold border border-slate-200 dark:border-slate-700 ${
                            spanInfo.isMerged
                              ? isDark
                                ? 'bg-indigo-950/40 text-indigo-400 border-r-2 border-r-indigo-500'
                                : 'bg-indigo-50/80 text-indigo-700 border-r-2 border-r-indigo-500'
                              : 'text-slate-400'
                          }`}
                        >
                          {slNum}
                        </td>
                      )}

                      {/* CTN NO (RowSpanned if Merged) */}
                      {spanInfo.isFirst && (
                        <td
                          rowSpan={spanInfo.rowSpan}
                          className={`p-3 font-mono font-bold align-middle border border-slate-200 dark:border-slate-700 ${
                            spanInfo.isMerged
                              ? isDark
                                ? 'bg-indigo-950/40 text-indigo-300'
                                : 'bg-indigo-50/80 text-indigo-900'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          <div>{c.ctn_no}</div>
                          {spanInfo.isMerged && (
                            <span className="mt-0.5 inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                              🔗 MERGED ({spanInfo.rowSpan})
                            </span>
                          )}
                        </td>
                      )}

                      <td className="p-3 font-mono text-blue-600 dark:text-blue-400 font-bold border border-slate-200 dark:border-slate-700">
                        {c.shipping_mark}
                      </td>

                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 truncate">
                        {c.tracking_number}
                      </td>

                      <td className="p-3 border border-slate-200 dark:border-slate-700">
                        <div className="font-normal text-slate-900 dark:text-white truncate">{c.product_name_en}</div>
                        {c.product_name_cn && (
                          <div className="text-[10px] text-slate-500 truncate">{c.product_name_cn}</div>
                        )}
                      </td>

                      <td className="p-3 text-center font-mono border border-slate-200 dark:border-slate-700">
                        {c.quantity} pcs
                      </td>

                      <td className="p-3 text-center font-mono border border-slate-200 dark:border-slate-700 text-slate-500">
                        {c.net_weight} kg
                      </td>

                      <td className="p-3 text-center font-mono font-bold border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                        {c.gross_weight} kg
                      </td>

                      <td className="p-3 text-center font-mono border border-slate-200 dark:border-slate-700 text-purple-600 dark:text-purple-400">
                        {c.cbm}
                      </td>

                      <td className="p-3 border border-slate-200 dark:border-slate-700 truncate">
                        {c.destination_warehouse_name || warehouses.find((w) => w.id === c.destination_warehouse_id)?.name || 'Bangladesh Hub'}
                      </td>

                      <td className="p-3 text-center border border-slate-200 dark:border-slate-700">
                        <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold uppercase font-mono ${
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

                      <td className="p-3 text-center border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => setSelectedCartonsForInvoiceModal([c])}
                            className="p-1 text-[#00897B] hover:text-[#26A69A] cursor-pointer"
                            title={isBn ? 'কার্টুন ইনভয়েস প্রিন্ট করুন' : 'Print Carton Invoice'}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
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
                          <button
                            type="button"
                            onClick={() => handleAddSubItemToCarton(c)}
                            className="p-1 text-indigo-500 hover:text-indigo-700 cursor-pointer"
                            title={isBn ? 'এই কার্টুনে নতুন সাব-মার্ক যোগ/মার্জ করুন' : 'Add Sub-Mark / Merge Carton'}
                          >
                            <GitFork className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSingleCarton(c.id)}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                            title={isBn ? 'কার্টুন ডিলেট করুন' : 'Delete Carton'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* ------------------------------------------------------------- */}
      {/* EXPANDED CUSTOMER CARTONS MODAL VIEW (EXCEL SPREADSHEET UI) */}
      {/* ------------------------------------------------------------- */}
      {activeCustomerModalMark && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 md:p-6">
          <div className={`rounded-xl max-w-5xl w-full p-5 space-y-4 border shadow-2xl ${
            isDark ? 'bg-[#0F172A] text-white border-slate-700' : 'bg-white text-slate-900 border-slate-300'
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3 border-slate-300 dark:border-slate-700">
              <div>
                <div className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold uppercase flex items-center space-x-2">
                  <span>Tracking ID: {activeCustomerCartons[0]?.tracking_number || activeCustomerModalMark}</span>
                  {activeCustomerCartons[0]?.shipping_mark && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20 font-normal">
                      Mark: {activeCustomerCartons[0]?.shipping_mark}
                    </span>
                  )}
                </div>
                <h3 className={`text-base font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {activeCustomerCartons[0]?.product_name_en || 'Customer Shipment Profile'} (Excel Grid View)
                </h3>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleDeleteCartonGroup(activeCustomerCartons, activeCustomerModalMark)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded flex items-center space-x-1.5 cursor-pointer shadow-xs transition-all"
                  title={isBn ? 'এই সম্পূর্ণ কার্টুন ব্যাচ ডিলেট করুন' : 'Delete Entire Batch'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isBn ? 'ডিলেট ব্যাচ' : 'Delete Batch'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCustomerModalMark(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Excel Formula Summary Bar */}
            <div className="grid grid-cols-4 gap-3 text-xs font-mono">
              <div className={`p-2.5 rounded border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                <div className="text-[10px] text-slate-500 uppercase">{isBn ? 'মাস্টার কার্টুন' : 'Master Cartons'}</div>
                <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {new Set(activeCustomerCartons.map((c) => c.master_group_id || c.ctn_no)).size} Cartons
                </div>
              </div>

              <div className={`p-2.5 rounded border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                <div className="text-[10px] text-slate-500 uppercase">{isBn ? 'মোট সাব-আইটেম' : 'Sub-Items Rows'}</div>
                <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {activeCustomerCartons.length} Rows
                </div>
              </div>

              <div className={`p-2.5 rounded border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                <div className="text-[10px] text-slate-500 uppercase">{isBn ? 'মোট গ্রস ওজন' : 'Total Gross Weight'}</div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {activeCustomerCartons.reduce((sum, c) => sum + (c.gross_weight || 0), 0).toFixed(1)} KG
                </div>
              </div>

              <div className={`p-2.5 rounded border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                <div className="text-[10px] text-slate-500 uppercase">{isBn ? 'মোট ভলিউম CBM' : 'Total CBM Volume'}</div>
                <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                  {activeCustomerCartons.reduce((sum, c) => sum + (c.cbm || 0), 0).toFixed(2)} CBM
                </div>
              </div>
            </div>

            {/* Excel Quick Bulk Actions Bar */}
            <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-t-lg">
              <div className="flex items-center space-x-2 text-xs font-mono">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {isBn ? 'এক্সেল মার্জ টুলবার:' : 'Excel Merge Toolbar:'}
                </span>
                {selectedHubCartonIds.length > 0 && (
                  <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold">
                    {selectedHubCartonIds.length} Selected
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleBulkMergeInHub(activeCustomerCartons)}
                  disabled={selectedHubCartonIds.length < 2}
                  className={`px-3 py-1 text-xs font-bold rounded flex items-center space-x-1 transition-all cursor-pointer ${
                    selectedHubCartonIds.length >= 2
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                  }`}
                  title={isBn ? 'সিলেক্টকৃত রো মার্জ করে ১টি মাস্টার কার্টুন বানান' : 'Merge selected rows into 1 master carton'}
                >
                  <GitFork className="w-3.5 h-3.5" />
                  <span>{isBn ? '🔗 মার্জ করুন (Merge Selected)' : '🔗 Merge Selected'}</span>
                </button>

                {selectedHubCartonIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleBulkUnmergeInHub(activeCustomerCartons)}
                    className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded flex items-center space-x-1 shadow-xs cursor-pointer"
                    title={isBn ? 'সিলেক্টকৃত কার্টুন আলাদা/আনমার্জ করুন' : 'Unmerge selected cartons'}
                  >
                    <span>{isBn ? '🔓 আলাদা করুন (Unmerge)' : '🔓 Unmerge'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Excel Sheet Table Grid */}
            <div className="max-h-[50vh] overflow-y-auto border-x border-b border-slate-300 dark:border-slate-700 rounded-b-lg">
              <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                <thead className={`uppercase text-[10px] tracking-wider border-b font-mono font-bold ${
                  isDark ? 'bg-[#1E293B] text-slate-200 border-slate-700' : 'bg-slate-200 text-slate-800 border-slate-300'
                }`}>
                  <tr>
                    <th className="p-2.5 text-center border border-slate-300 dark:border-slate-700 w-10">
                      <input
                        type="checkbox"
                        checked={
                          activeCustomerCartons.length > 0 &&
                          activeCustomerCartons.every((c) => selectedHubCartonIds.includes(c.id))
                        }
                        onChange={() => handleToggleSelectAllInModal(activeCustomerCartons)}
                        className="rounded border-slate-400 cursor-pointer"
                      />
                    </th>
                    <th className="p-2.5 border border-slate-300 dark:border-slate-700 text-center w-12">SL</th>
                    <th className="p-2.5 border border-slate-300 dark:border-slate-700 w-32">CTN NO</th>
                    <th className="p-2.5 border border-slate-300 dark:border-slate-700">SHIPPING MARK</th>
                    <th className="p-2.5 border border-slate-300 dark:border-slate-700">TRACKING NO</th>
                    <th className="p-2.5 border border-slate-300 dark:border-slate-700 font-medium">PRODUCT</th>
                    <th className="p-2.5 border border-slate-300 dark:border-slate-700 text-center">QTY / N.WT</th>
                    <th className="p-2.5 border border-slate-300 dark:border-slate-700 text-center">G.WEIGHT</th>
                    <th className="p-2.5 border border-slate-300 dark:border-slate-700 text-center">CBM</th>
                    <th className="p-2.5 border border-slate-300 dark:border-slate-700 text-center">PROOF</th>
                    <th className="p-2.5 border border-slate-300 dark:border-slate-700 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
                  {activeCustomerCartons.map((c, idx) => {
                    const spanInfo = getCartonRowSpanInfo(activeCustomerCartons, idx);
                    const slNum = getSlNumberForCartonRow(activeCustomerCartons, idx);
                    const isSelected = selectedHubCartonIds.includes(c.id);

                    return (
                      <tr
                        key={c.id}
                        className={`transition-colors ${
                          isSelected
                            ? isDark
                              ? 'bg-blue-950/50'
                              : 'bg-blue-100/70'
                            : spanInfo.isMerged
                            ? isDark
                              ? 'bg-indigo-950/20 hover:bg-indigo-950/30'
                              : 'bg-indigo-50/50 hover:bg-indigo-50/80'
                            : isDark
                            ? 'hover:bg-slate-800/50'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Checkbox Column */}
                        <td className="p-2.5 text-center border border-slate-300 dark:border-slate-700">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectCarton(c.id)}
                            className="rounded border-slate-400 cursor-pointer"
                          />
                        </td>

                        {/* SL (RowSpanned if Merged) */}
                        {spanInfo.isFirst && (
                          <td
                            rowSpan={spanInfo.rowSpan}
                            className={`p-2.5 font-mono text-center align-middle font-bold border border-slate-300 dark:border-slate-700 ${
                              spanInfo.isMerged
                                ? isDark
                                  ? 'bg-indigo-950/50 text-indigo-300 border-r-2 border-r-indigo-500'
                                  : 'bg-indigo-100/80 text-indigo-900 border-r-2 border-r-indigo-500'
                                : 'text-slate-500'
                            }`}
                          >
                            {slNum}
                          </td>
                        )}

                        {/* CTN NO (RowSpanned if Merged) */}
                        {spanInfo.isFirst && (
                          <td
                            rowSpan={spanInfo.rowSpan}
                            className={`p-2.5 font-mono font-bold align-middle border border-slate-300 dark:border-slate-700 ${
                              spanInfo.isMerged
                                ? isDark
                                  ? 'bg-indigo-950/50 text-indigo-300'
                                  : 'bg-indigo-100/80 text-indigo-950'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            <div className="font-bold text-sm">{c.ctn_no}</div>
                            {spanInfo.isMerged && (
                              <span className="mt-1 inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-600 text-white shadow-2xs">
                                <span>🔗 MERGED ({spanInfo.rowSpan} Sub-Items)</span>
                              </span>
                            )}
                          </td>
                        )}

                        <td className="p-2.5 font-mono text-blue-600 dark:text-blue-400 font-bold border border-slate-300 dark:border-slate-700">
                          {c.shipping_mark}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">{c.tracking_number}</td>
                        <td className="p-2.5 font-sans truncate max-w-[160px] border border-slate-300 dark:border-slate-700">
                          <div className="font-semibold">{c.product_name_en}</div>
                          {c.product_name_cn && <div className="text-[10px] text-slate-400">{c.product_name_cn}</div>}
                        </td>
                        <td className="p-2.5 text-center font-mono border border-slate-300 dark:border-slate-700">{c.quantity} pcs | {c.net_weight} kg</td>
                        <td className="p-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400 border border-slate-300 dark:border-slate-700">{c.gross_weight} kg</td>
                        <td className="p-2.5 text-center font-mono text-purple-600 dark:text-purple-400 border border-slate-300 dark:border-slate-700">{c.cbm} CBM</td>
                        <td className="p-2.5 text-center border border-slate-300 dark:border-slate-700">
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
                        <td className="p-2.5 text-center border border-slate-300 dark:border-slate-700">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleAddSubItemToCarton(c)}
                              className="p-1 text-indigo-500 hover:text-indigo-700 cursor-pointer"
                              title={isBn ? 'এই কার্টুনে নতুন সাব-মার্ক যোগ/মার্জ করুন' : 'Add Sub-Mark / Merge Carton'}
                            >
                              <GitFork className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSingleCarton(c.id)}
                              className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                              title={isBn ? 'কার্টুন ডিলেট করুন' : 'Delete Carton'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => handleDeleteCartonGroup(activeCustomerCartons, activeCustomerModalMark)}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded flex items-center space-x-1 cursor-pointer transition-all shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isBn ? 'সম্পূর্ণ কার্টুন ব্যাচ ডিলেট করুন' : 'Delete Entire Batch'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCustomerModalMark(null)}
                className={`px-4 py-2 rounded text-xs font-normal cursor-pointer ${
                  isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {isBn ? 'বন্ধ করুন (Close)' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO PREVIEW MODAL */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1E293B] text-white rounded-none-none max-w-xl w-full p-4 space-y-3 border border-slate-700">
            <div className="flex items-center justify-between border-b pb-2 border-slate-700">
              <span className="text-xs font-semibold">Proof Photo</span>
              <button onClick={() => setPreviewPhotoUrl(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-center bg-black rounded-none-none p-2 max-h-[60vh]">
              <img src={previewPhotoUrl} alt="Proof" className="max-h-[55vh] object-contain rounded-none-none" />
            </div>
          </div>
        </div>
      )}

      {/* EDIT CARTON MODAL */}
      {editingCarton && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveEditedCarton} className={`rounded-none-none max-w-md w-full p-6 space-y-4 border shadow-2xl ${
            isDark ? 'bg-[#1E293B] text-white border-slate-700' : 'bg-white text-slate-900 border-slate-200'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
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
                  className={`w-full px-3 py-2 rounded-none-none border ${isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">CBM</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingCarton.cbm}
                  onChange={(e) => setEditingCarton({ ...editingCarton, cbm: parseFloat(e.target.value) || 0 })}
                  className={`w-full px-3 py-2 rounded-none-none border ${isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingCarton(null)}
                className={`px-4 py-2 rounded-none-none text-xs ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-none-none text-xs bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CARTON INVOICES & PRINT MODAL */}
      {selectedCartonsForInvoiceModal && (
        <CartonInvoicesModal
          cartons={selectedCartonsForInvoiceModal}
          onClose={() => setSelectedCartonsForInvoiceModal(null)}
          language={language}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
