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
  UserCheck,
  UserPlus,
  Plus,
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

  // Customer Assignment / Mapping Modal States
  const [mapCustomerModalMark, setMapCustomerModalMark] = useState<string | null>(null);
  const [mapSelectedCustomerId, setMapSelectedCustomerId] = useState<string>('');
  const [isNewCustMapping, setIsNewCustMapping] = useState(false);
  const [newCustMappingName, setNewCustMappingName] = useState('');
  const [newCustMappingPhone, setNewCustMappingPhone] = useState('');
  const [allDbCustomersList, setAllDbCustomersList] = useState<Customer[]>(() => {
    return getHostingerDbData().customers || [];
  });

  const handleOpenCustomerMapping = (shippingMark: string) => {
    const dbCusts = getHostingerDbData().customers || [];
    setAllDbCustomersList(dbCusts);
    setMapCustomerModalMark(shippingMark);
    setIsNewCustMapping(false);
    setNewCustMappingName('');
    setNewCustMappingPhone('');
    const matchingCust = dbCusts.find(
      (c) => c.shipping_mark && c.shipping_mark.toLowerCase() === shippingMark.toLowerCase()
    );
    if (matchingCust) {
      setMapSelectedCustomerId(matchingCust.id);
    } else if (dbCusts.length > 0) {
      setMapSelectedCustomerId(dbCusts[0].id);
    }
  };

  const handleSaveCustomerMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapCustomerModalMark) return;

    const dbData = getHostingerDbData();
    let currentCusts = dbData.customers || [];
    let targetCust: Customer | undefined;

    if (isNewCustMapping) {
      if (!newCustMappingName.trim()) return;
      targetCust = {
        id: `cust-${Date.now()}`,
        customer_code: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
        name: newCustMappingName.trim(),
        phone: newCustMappingPhone.trim() || '01700000000',
        shipping_mark: mapCustomerModalMark,
        address: 'Dhaka, Bangladesh',
        total_billed: 0,
        total_paid: 0,
        total_due: 0,
        created_at: new Date().toISOString(),
      };
      currentCusts = [targetCust, ...currentCusts];
    } else {
      targetCust = currentCusts.find((c) => c.id === mapSelectedCustomerId);
    }

    if (!targetCust) return;

    const updatedCusts = currentCusts.map((c) =>
      c.id === targetCust!.id ? { ...c, shipping_mark: mapCustomerModalMark } : c
    );
    saveHostingerDbData('fsc_vps_customers', updatedCusts);

    const currentCartons = dbData.cartons || [];
    const updatedCartons = currentCartons.map((c) => {
      if (c.shipping_mark && c.shipping_mark.toLowerCase() === mapCustomerModalMark.toLowerCase()) {
        return {
          ...c,
          customer_id: targetCust!.id,
          customer_code: targetCust!.customer_code,
          customer_name: targetCust!.name,
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    saveHostingerDbData('fsc_vps_cartons', updatedCartons);
    setLiveRealtimeCartons(updatedCartons);

    logSystemAuditAction(
      currentUser,
      'MAP_CUSTOMER_TO_MARK',
      'carton',
      mapCustomerModalMark,
      `অপারেশন টিম শিপিং মার্ক ${mapCustomerModalMark} এর সাথে কাস্টমার "${targetCust.name}" সফলভাবে ট্যাগ করেছেন`
    );

    setMapCustomerModalMark(null);
  };

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
          <div className="flex flex-wrap items-center gap-2.5">
            {/* GROUP BY BADGE */}
            {viewMode === 'cards' && (
              <div className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg border text-xs font-mono transition-colors shadow-2xs ${
                isDark ? 'bg-[#0F172A] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}>
                <span className={`font-extrabold text-xs uppercase tracking-wide ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {isBn ? 'গ্রুপ:' : 'Group:'}
                </span>
                <span className="px-3 py-1 rounded-md text-xs font-extrabold bg-emerald-600 text-white shadow-xs border border-emerald-500">
                  {isBn ? '📦 ট্র্যাকিং ID' : 'Tracking ID'}
                </span>
              </div>
            )}

            {/* VIEW MODE TOGGLE */}
            <div className={`flex items-center space-x-1.5 p-1.5 rounded-lg border transition-colors shadow-2xs ${
              isDark ? 'bg-[#0F172A] border-slate-700' : 'bg-white border-slate-300'
            }`}>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-blue-600 text-white shadow-md border border-blue-500'
                    : isDark
                    ? 'bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-white border border-slate-700'
                    : 'bg-slate-100 text-slate-800 hover:bg-slate-200 hover:text-slate-900 border border-slate-300'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{isBn ? '👤 কাস্টমার কার্ডস ভিউ' : 'Customer Cards'}</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white shadow-md border border-blue-500'
                    : isDark
                    ? 'bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-white border border-slate-700'
                    : 'bg-slate-100 text-slate-800 hover:bg-slate-200 hover:text-slate-900 border border-slate-300'
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
          <div className={`p-3.5 rounded-xl border transition-all ${isDark ? 'bg-[#0F172A] border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase font-bold tracking-wider">{isBn ? 'মোট কাস্টমার' : 'Total Customers'}</div>
            <div className="text-base font-extrabold text-blue-600 dark:text-blue-400 mt-1 font-mono">{customerGroupKeys.length} {isBn ? 'জন' : 'Customers'}</div>
          </div>

          <div className={`p-3.5 rounded-xl border transition-all ${isDark ? 'bg-[#0F172A] border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase font-bold tracking-wider">{isBn ? 'মোট কার্টুন সংখ্যা' : 'Total Cartons'}</div>
            <div className={`text-base font-extrabold mt-1 font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalCartonCount} {isBn ? 'টি' : 'Cartons'}</div>
          </div>

          <div className={`p-3.5 rounded-xl border transition-all ${isDark ? 'bg-[#0F172A] border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase font-bold tracking-wider">{isBn ? 'মোট গ্রস ওজন' : 'Total Gross Weight'}</div>
            <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{totalGrossWeight.toFixed(1)} KG</div>
          </div>

          <div className={`p-3.5 rounded-xl border transition-all ${isDark ? 'bg-[#0F172A] border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase font-bold tracking-wider">{isBn ? 'মোট সিবিএম ভলিউম' : 'Total CBM Volume'}</div>
            <div className="text-base font-extrabold text-purple-600 dark:text-purple-300 mt-1 font-mono">{totalCbmVolume.toFixed(2)} CBM</div>
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
              className={`w-full pl-9 pr-3 py-2 rounded-lg border text-xs font-semibold focus:ring-2 focus:ring-blue-500 ${
                isDark ? 'bg-[#0F172A] border-slate-600 text-white placeholder:text-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-500'
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
              className={`w-full px-3 py-2 rounded-lg border text-xs font-bold focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                isDark ? 'bg-[#0F172A] border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
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

          {/* Destination Country / Hub Filter */}
          <div>
            <select
              value={selectedDestinationFilter}
              onChange={(e) => setSelectedDestinationFilter(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-xs font-bold focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                isDark ? 'bg-[#0F172A] border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
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
              className={`w-full px-3 py-2 rounded-lg border text-xs font-bold font-mono focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                isDark ? 'bg-[#0F172A] border-slate-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
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
                            handleOpenCustomerMapping(mark);
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded flex items-center space-x-1 cursor-pointer transition-all shadow-xs"
                          title={isBn ? 'এই শিপিং মার্কের সাথে কাস্টমার ট্যাগ করুন' : 'Map Customer to Shipping Mark'}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>{isBn ? 'কাস্টমার ট্যাগ' : 'Map Customer'}</span>
                        </button>

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
          className={`rounded-2xl border transition-all shadow-lg overflow-hidden ${
            isDark
              ? 'bg-[#1E293B] border-slate-700 text-white'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className={`p-4 border-b flex items-center justify-between transition-colors ${
            isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center space-x-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-xs" />
              <h3 className={`text-xs font-extrabold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {isBn ? 'সকল কার্টুনের বিবরণ (Central Cartons Inventory Table)' : 'Central Cartons Inventory List'}
              </h3>
            </div>
            <span className="px-3.5 py-1 rounded-full text-xs font-mono font-extrabold bg-blue-600 text-white shadow-sm border border-blue-500">
              {filteredCartons.length} Cartons Total
            </span>
          </div>

          {/* Quick Bulk Merge Toolbar */}
          <div className={`flex items-center justify-between p-3 border-b text-xs font-mono transition-colors ${
            isDark ? 'bg-[#0F172A] border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center space-x-2">
              <span className={`font-extrabold uppercase tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {isBn ? 'মার্জ টুলবার (Merge Toolbar):' : 'Merge Toolbar:'}
              </span>
              {selectedHubCartonIds.length > 0 && (
                <span className="px-2.5 py-0.5 bg-[#00897B] text-white rounded-full text-[10px] font-extrabold shadow-2xs border border-[#00796B]">
                  {selectedHubCartonIds.length} Selected
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleBulkMergeInHub(sortedFilteredCartons)}
                disabled={selectedHubCartonIds.length < 2}
                className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer ${
                  selectedHubCartonIds.length >= 2
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                    : isDark ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed' : 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed'
                }`}
                title={isBn ? 'সিলেক্টকৃত কার্টুন মার্জ করে ১টি মাস্টার কার্টুন বানান' : 'Merge selected rows into 1 master carton'}
              >
                <GitFork className="w-3.5 h-3.5" />
                <span>{isBn ? '🔗 মার্জ করুন (Merge Selected)' : '🔗 Merge Selected'}</span>
              </button>

              {selectedHubCartonIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleBulkUnmergeInHub(sortedFilteredCartons)}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold rounded-lg flex items-center space-x-1 shadow-md cursor-pointer"
                  title={isBn ? 'সিলেক্টকৃত কার্টুন আলাদা/আনমার্জ করুন' : 'Unmerge selected cartons'}
                >
                  <span>{isBn ? '🔓 আলাদা করুন (Unmerge)' : '🔓 Unmerge'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1350px]">
              <colgroup>
                <col style={{ width: '40px' }} />  {/* Checkbox */}
                <col style={{ width: '45px' }} />  {/* SL */}
                <col style={{ width: '100px' }} /> {/* CTN NO */}
                <col style={{ width: '140px' }} /> {/* SHIPMENT CTN NO. */}
                <col style={{ width: '95px' }} />  {/* MARK */}
                <col style={{ width: '120px' }} /> {/* TRACKING NO */}
                <col style={{ width: '170px' }} /> {/* PRODUCT (EN & CN) */}
                <col style={{ width: '70px' }} />  {/* QTY */}
                <col style={{ width: '70px' }} />  {/* N.WT */}
                <col style={{ width: '75px' }} />  {/* G.WT */}
                <col style={{ width: '65px' }} />  {/* CBM */}
                <col style={{ width: '135px' }} /> {/* DESTINATION */}
                <col style={{ width: '95px' }} />  {/* STATUS */}
                <col style={{ width: '120px' }} /> {/* ACTION */}
              </colgroup>
              <thead className={`uppercase text-[11px] tracking-wider border-b font-mono font-extrabold ${
                isDark ? 'bg-[#0F172A] text-white border-slate-700' : 'bg-slate-100 text-slate-900 border-slate-300'
              }`}>
                <tr>
                  <th className="p-3 text-center border-r border-slate-200/60 dark:border-slate-700/50 w-10">
                    <input
                      type="checkbox"
                      checked={
                        sortedFilteredCartons.length > 0 &&
                        sortedFilteredCartons.every((c) => selectedHubCartonIds.includes(c.id))
                      }
                      onChange={() => handleToggleSelectAllInModal(sortedFilteredCartons)}
                      className="rounded border-slate-400 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className={`p-3 text-center border-r border-slate-200/60 dark:border-slate-700/50 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>SL</th>
                  <th className={`p-3 border-r border-slate-200/60 dark:border-slate-700/50 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>CTN NO</th>
                  <th className={`p-3 border-r border-slate-200/60 dark:border-slate-700/50 font-extrabold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>SHIPMENT CTN NO.</th>
                  <th className={`p-3 border-r border-slate-200/60 dark:border-slate-700/50 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>MARK</th>
                  <th className={`p-3 border-r border-slate-200/60 dark:border-slate-700/50 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>TRACKING NO</th>
                  <th className={`p-3 border-r border-slate-200/60 dark:border-slate-700/50 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>PRODUCT (EN & CN)</th>
                  <th className={`p-3 border-r border-slate-200/60 dark:border-slate-700/50 text-center font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>QTY</th>
                  <th className={`p-3 border-r border-slate-200/60 dark:border-slate-700/50 text-center font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>N.WT</th>
                  <th className={`p-3 border-r border-slate-200/60 dark:border-slate-700/50 text-center font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>G.WT</th>
                  <th className={`p-3 border-r border-slate-200/60 dark:border-slate-700/50 text-center font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>CBM</th>
                  <th className={`p-3 border-r border-slate-200/60 dark:border-slate-700/50 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>DESTINATION</th>
                  <th className={`p-3 border-r border-slate-200/60 dark:border-slate-700/50 text-center font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>STATUS</th>
                  <th className={`p-3 text-center font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {sortedFilteredCartons.map((c, idx) => {
                  const spanInfo = getCartonRowSpanInfo(sortedFilteredCartons, idx);
                  const slNum = getSlNumberForCartonRow(sortedFilteredCartons, idx);
                  const isSelected = selectedHubCartonIds.includes(c.id);

                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors duration-150 ${
                        isSelected
                          ? isDark
                            ? 'bg-[#00897B]/70 text-white font-extrabold border-l-4 border-l-[#26A69A]'
                            : 'bg-[#00897B]/20 text-slate-900 font-extrabold border-l-4 border-l-[#00897B]'
                          : spanInfo.isMerged
                          ? isDark
                            ? 'bg-[#1E1B4B]/80 hover:bg-[#2E2A72] text-white'
                            : 'bg-indigo-50/80 hover:bg-indigo-50 text-slate-900'
                          : isDark
                          ? 'bg-[#1E293B] hover:bg-[#283549] text-white'
                          : 'bg-white hover:bg-slate-50 text-slate-900'
                      }`}
                    >
                      {/* Checkbox Column */}
                      <td className="p-3 text-center border-r border-slate-200/60 dark:border-slate-700/50">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectCarton(c.id)}
                          className="rounded border-slate-400 cursor-pointer accent-blue-600"
                        />
                      </td>

                      {/* SL (RowSpanned if Merged) */}
                      {spanInfo.isFirst && (
                        <td
                          rowSpan={spanInfo.rowSpan}
                          className={`p-3 text-center font-mono align-middle font-bold border-r border-slate-200/60 dark:border-slate-700/50 ${
                            spanInfo.isMerged
                              ? isDark
                                ? 'bg-[#1E1B4B] text-indigo-200 border-r-2 border-r-indigo-400'
                                : 'bg-indigo-50/80 text-indigo-800 border-r-2 border-r-indigo-500'
                              : isDark ? 'text-white' : 'text-slate-800'
                          }`}
                        >
                          <span className={`font-mono text-xs font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {slNum}
                          </span>
                        </td>
                      )}

                      {/* CTN NO (RowSpanned if Merged) */}
                      {spanInfo.isFirst && (
                        <td
                          rowSpan={spanInfo.rowSpan}
                          className={`p-3 font-mono font-bold align-middle border-r border-slate-200/60 dark:border-slate-700/50 ${
                            spanInfo.isMerged
                              ? isDark
                                ? 'bg-[#1E1B4B] text-indigo-200'
                                : 'bg-indigo-50/80 text-indigo-900'
                              : isDark ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          <div className={`font-mono font-extrabold text-xs tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {c.ctn_no}
                          </div>
                          {spanInfo.isMerged && (
                            <span className={`mt-1 flex items-center space-x-1 text-[10px] font-mono font-extrabold ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                              <span>🔗 MERGED ({spanInfo.rowSpan})</span>
                            </span>
                          )}
                        </td>
                      )}

                      {/* SHIPMENT CTN NO. (RowSpanned if Merged) */}
                      {spanInfo.isFirst && (
                        <td
                          rowSpan={spanInfo.rowSpan}
                          className="p-3 font-mono font-bold align-middle border-r border-slate-200/60 dark:border-slate-700/50"
                        >
                          <span className={`font-mono font-extrabold text-xs tracking-wide ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                            {c.packaging_number || '-'}
                          </span>
                        </td>
                      )}

                      <td className="p-3 font-mono border-r border-slate-200/60 dark:border-slate-700/50">
                        <div className="flex items-center space-x-1">
                          {spanInfo.isMerged && !spanInfo.isFirst && (
                            <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-500'}`}>└</span>
                          )}
                          <span className={`font-mono font-extrabold text-xs tracking-wide ${isDark ? 'text-sky-300' : 'text-blue-700'}`}>
                            {c.shipping_mark}
                          </span>
                        </div>
                      </td>

                      <td className={`p-3 font-mono border-r truncate text-xs font-semibold ${
                        isDark ? 'text-slate-100 border-slate-700' : 'text-slate-800 border-slate-200'
                      }`}>
                        {c.tracking_number}
                      </td>

                      <td className="p-3 border-r border-slate-200/60 dark:border-slate-700/50">
                        <div className={`font-extrabold text-xs leading-snug truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{c.product_name_en}</div>
                        {c.product_name_cn && (
                          <div className={`text-[10px] font-medium truncate mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{c.product_name_cn}</div>
                        )}
                      </td>

                      <td className={`p-3 text-center font-mono border-r text-xs font-extrabold ${
                        isDark ? 'text-white border-slate-700' : 'text-slate-900 border-slate-200'
                      }`}>
                        {c.quantity} pcs
                      </td>

                      <td className={`p-3 text-center font-mono border-r text-xs font-semibold ${
                        isDark ? 'text-slate-100 border-slate-700' : 'text-slate-700 border-slate-200'
                      }`}>
                        {c.net_weight} kg
                      </td>

                      <td className="p-3 text-center font-mono border-r border-slate-200/60 dark:border-slate-700/50">
                        <span className={`font-mono text-xs font-extrabold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                          {c.gross_weight} kg
                        </span>
                      </td>

                      <td className="p-3 text-center font-mono border-r border-slate-200/60 dark:border-slate-700/50">
                        <span className={`font-mono text-xs font-extrabold ${isDark ? 'text-fuchsia-300' : 'text-purple-700'}`}>
                          {c.cbm}
                        </span>
                      </td>

                      <td className={`p-3 border-r text-xs font-semibold truncate ${
                        isDark ? 'text-slate-100 border-slate-700' : 'text-slate-800 border-slate-200'
                      }`}>
                        {c.destination_warehouse_name || warehouses.find((w) => w.id === c.destination_warehouse_id)?.name || 'Bangladesh Hub'}
                      </td>

                      <td className="p-3 text-center border-r border-slate-200/60 dark:border-slate-700/50">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold font-mono uppercase tracking-wider ${
                          c.status === 'booked'
                            ? isDark ? 'text-sky-300' : 'text-blue-700'
                            : c.status === 'in_transit'
                            ? isDark ? 'text-amber-300' : 'text-amber-700'
                            : c.status === 'received'
                            ? isDark ? 'text-teal-300' : 'text-teal-700'
                            : isDark ? 'text-emerald-300' : 'text-emerald-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            c.status === 'booked' ? 'bg-sky-400 animate-pulse' : c.status === 'in_transit' ? 'bg-amber-400' : c.status === 'received' ? 'bg-teal-400' : 'bg-emerald-400'
                          }`} />
                          {c.status}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCartonsForInvoiceModal([c])}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isDark ? 'text-teal-300 bg-teal-950/70 hover:bg-teal-900 border-teal-700' : 'text-teal-700 bg-teal-50 hover:bg-teal-100 border-teal-200'
                            }`}
                            title={isBn ? 'কার্টুন ইনভয়েস প্রিন্ট করুন' : 'Print Carton Invoice'}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {c.photo_url && (
                            <button
                              type="button"
                              onClick={() => setPreviewPhotoUrl(c.photo_url!)}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isDark ? 'text-sky-300 bg-sky-950/70 hover:bg-sky-900 border-sky-700' : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200'
                              }`}
                              title="View Photo Proof"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingCarton(c)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isDark ? 'text-slate-200 bg-slate-800 hover:bg-slate-700 border-slate-600' : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-300'
                            }`}
                            title="Edit Carton"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddSubItemToCarton(c)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isDark ? 'text-indigo-300 bg-indigo-950/70 hover:bg-indigo-900 border-indigo-700' : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
                            }`}
                            title={isBn ? 'এই কার্টুনে নতুন সাব-মার্ক যোগ/মার্জ করুন' : 'Add Sub-Mark / Merge Carton'}
                          >
                            <GitFork className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSingleCarton(c.id)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isDark ? 'text-red-400 bg-red-950/70 hover:bg-red-900 border-red-800' : 'text-red-700 bg-red-50 hover:bg-red-100 border-red-200'
                            }`}
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
                <div className={`text-xs font-mono font-extrabold uppercase flex items-center space-x-2 ${isDark ? 'text-sky-300' : 'text-blue-700'}`}>
                  <span>Tracking ID: {activeCustomerCartons[0]?.tracking_number || activeCustomerModalMark}</span>
                  {activeCustomerCartons[0]?.shipping_mark && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold border ${
                      isDark ? 'bg-blue-950 text-sky-300 border-blue-700' : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
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
                <div className={`text-[10px] uppercase font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{isBn ? 'মাস্টার কার্টুন' : 'Master Cartons'}</div>
                <div className={`text-sm font-extrabold ${isDark ? 'text-sky-300' : 'text-blue-700'}`}>
                  {new Set(activeCustomerCartons.map((c) => c.master_group_id || c.ctn_no)).size} Cartons
                </div>
              </div>

              <div className={`p-2.5 rounded border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                <div className={`text-[10px] uppercase font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{isBn ? 'মোট সাব-আইটেম' : 'Sub-Items Rows'}</div>
                <div className={`text-sm font-extrabold ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                  {activeCustomerCartons.length} Rows
                </div>
              </div>

              <div className={`p-2.5 rounded border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                <div className={`text-[10px] uppercase font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{isBn ? 'মোট গ্রস ওজন' : 'Total Gross Weight'}</div>
                <div className={`text-sm font-extrabold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  {activeCustomerCartons.reduce((sum, c) => sum + (c.gross_weight || 0), 0).toFixed(1)} KG
                </div>
              </div>

              <div className={`p-2.5 rounded border ${isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                <div className={`text-[10px] uppercase font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{isBn ? 'মোট ভলিউম CBM' : 'Total CBM Volume'}</div>
                <div className={`text-sm font-extrabold ${isDark ? 'text-fuchsia-300' : 'text-purple-700'}`}>
                  {activeCustomerCartons.reduce((sum, c) => sum + (c.cbm || 0), 0).toFixed(2)} CBM
                </div>
              </div>
            </div>

            {/* Excel Quick Bulk Actions Bar */}
            <div className={`flex items-center justify-between p-3 border text-xs font-mono transition-colors rounded-t-xl ${
              isDark ? 'bg-[#0F172A] border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}>
              <div className="flex items-center space-x-2 text-xs font-mono">
                <span className={`font-extrabold uppercase tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {isBn ? 'এক্সেল মার্জ টুলবার:' : 'Excel Merge Toolbar:'}
                </span>
                {selectedHubCartonIds.length > 0 && (
                  <span className="px-2.5 py-0.5 bg-[#00897B] text-white rounded-full text-[10px] font-extrabold shadow-2xs border border-[#00796B]">
                    {selectedHubCartonIds.length} Selected
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleBulkMergeInHub(activeCustomerCartons)}
                  disabled={selectedHubCartonIds.length < 2}
                  className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg flex items-center space-x-1 transition-all cursor-pointer ${
                    selectedHubCartonIds.length >= 2
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                      : isDark ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed' : 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed'
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
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold rounded-lg flex items-center space-x-1 shadow-md cursor-pointer"
                    title={isBn ? 'সিলেক্টকৃত কার্টুন আলাদা/আনমার্জ করুন' : 'Unmerge selected cartons'}
                  >
                    <span>{isBn ? '🔓 আলাদা করুন (Unmerge)' : '🔓 Unmerge'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Excel Sheet Table Grid */}
            <div className="max-h-[50vh] overflow-y-auto border-x border-b border-slate-200/80 dark:border-slate-700/80 rounded-b-xl shadow-inner">
              <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                <thead className={`uppercase text-[11px] tracking-wider border-b font-mono font-extrabold ${
                  isDark ? 'bg-[#0F172A] text-white border-slate-700' : 'bg-slate-100 text-slate-900 border-slate-300'
                }`}>
                  <tr>
                    <th className="p-2.5 text-center border-r border-slate-200/60 dark:border-slate-700/50 w-10">
                      <input
                        type="checkbox"
                        checked={
                          activeCustomerCartons.length > 0 &&
                          activeCustomerCartons.every((c) => selectedHubCartonIds.includes(c.id))
                        }
                        onChange={() => handleToggleSelectAllInModal(activeCustomerCartons)}
                        className="rounded border-slate-400 cursor-pointer accent-blue-600"
                      />
                    </th>
                    <th className={`p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 text-center w-12 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>SL</th>
                    <th className={`p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 w-32 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>CTN NO</th>
                    <th className={`p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 font-extrabold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>SHIPMENT CTN NO.</th>
                    <th className={`p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>SHIPPING MARK</th>
                    <th className={`p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>TRACKING NO</th>
                    <th className={`p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>PRODUCT</th>
                    <th className={`p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 text-center font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>QTY / N.WT</th>
                    <th className={`p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 text-center font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>G.WEIGHT</th>
                    <th className={`p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 text-center font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>CBM</th>
                    <th className={`p-2.5 border-r border-slate-200/60 dark:border-slate-700/50 text-center font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>PROOF</th>
                    <th className={`p-2.5 text-center font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {activeCustomerCartons.map((c, idx) => {
                    const spanInfo = getCartonRowSpanInfo(activeCustomerCartons, idx);
                    const slNum = getSlNumberForCartonRow(activeCustomerCartons, idx);
                    const isSelected = selectedHubCartonIds.includes(c.id);

                    return (
                      <tr
                        key={c.id}
                        className={`transition-colors duration-150 ${
                          isSelected
                            ? isDark
                              ? 'bg-[#00897B]/70 text-white font-extrabold border-l-4 border-l-[#26A69A]'
                              : 'bg-[#00897B]/20 text-slate-900 font-extrabold border-l-4 border-l-[#00897B]'
                            : spanInfo.isMerged
                            ? isDark
                              ? 'bg-[#1E1B4B]/80 hover:bg-[#2E2A72] text-white'
                              : 'bg-indigo-50/80 hover:bg-indigo-50 text-slate-900'
                            : isDark
                            ? 'bg-[#1E293B] hover:bg-[#283549] text-white'
                            : 'bg-white hover:bg-slate-50 text-slate-900'
                        }`}
                      >
                        {/* Checkbox Column */}
                        <td className="p-2.5 text-center border-r border-slate-200/60 dark:border-slate-700/50">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectCarton(c.id)}
                            className="rounded border-slate-400 cursor-pointer accent-blue-600"
                          />
                        </td>

                        {/* SL (RowSpanned if Merged) */}
                        {spanInfo.isFirst && (
                          <td
                            rowSpan={spanInfo.rowSpan}
                            className={`p-2.5 font-mono text-center align-middle font-bold border-r border-slate-200/60 dark:border-slate-700/50 ${
                              spanInfo.isMerged
                                ? isDark
                                  ? 'bg-[#1E1B4B] text-indigo-200 border-r-2 border-r-indigo-400'
                                  : 'bg-indigo-50/80 text-indigo-800 border-r-2 border-r-indigo-500'
                                : isDark ? 'text-white' : 'text-slate-800'
                            }`}
                          >
                            <span className={`font-mono text-xs font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {slNum}
                            </span>
                          </td>
                        )}

                        {/* CTN NO (RowSpanned if Merged) */}
                        {spanInfo.isFirst && (
                          <td
                            rowSpan={spanInfo.rowSpan}
                            className={`p-2.5 font-mono font-bold align-middle border-r border-slate-200/60 dark:border-slate-700/50 ${
                              spanInfo.isMerged
                                ? isDark
                                  ? 'bg-[#1E1B4B] text-indigo-200'
                                  : 'bg-indigo-50/80 text-indigo-900'
                                : isDark ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            <div className={`font-mono font-extrabold text-xs tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {c.ctn_no}
                            </div>
                            {spanInfo.isMerged && (
                              <span className={`mt-1 flex items-center space-x-1 text-[10px] font-mono font-extrabold ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                                <span>🔗 MERGED ({spanInfo.rowSpan} Sub-Items)</span>
                              </span>
                            )}
                          </td>
                        )}

                        {/* Packaging Slip Code (RowSpanned if Merged) */}
                        {spanInfo.isFirst && (
                          <td
                            rowSpan={spanInfo.rowSpan}
                            className="p-2.5 font-mono font-bold align-middle border-r border-slate-200/60 dark:border-slate-700/50"
                          >
                            <span className={`font-mono font-extrabold text-xs tracking-wide ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                              {c.packaging_number || '-'}
                            </span>
                          </td>
                        )}

                        <td className="p-2.5 font-mono border-r border-slate-200/60 dark:border-slate-700/50">
                          <span className={`font-mono font-extrabold text-xs tracking-wide ${isDark ? 'text-sky-300' : 'text-blue-700'}`}>
                            {c.shipping_mark}
                          </span>
                        </td>
                        <td className={`p-2.5 font-mono border-r font-semibold text-xs ${
                          isDark ? 'text-slate-100 border-slate-700' : 'text-slate-800 border-slate-200'
                        }`}>
                          {c.tracking_number}
                        </td>
                        <td className="p-2.5 font-sans truncate max-w-[160px] border-r border-slate-200/60 dark:border-slate-700/50">
                          <div className={`font-extrabold text-xs leading-snug truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{c.product_name_en}</div>
                          {c.product_name_cn && <div className={`text-[10px] font-medium truncate mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{c.product_name_cn}</div>}
                        </td>
                        <td className={`p-2.5 text-center font-mono border-r text-xs font-extrabold ${
                          isDark ? 'text-white border-slate-700' : 'text-slate-900 border-slate-200'
                        }`}>
                          {c.quantity} pcs | {c.net_weight} kg
                        </td>
                        <td className="p-2.5 text-center font-mono border-r border-slate-200/60 dark:border-slate-700/50">
                          <span className={`font-mono text-xs font-extrabold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                            {c.gross_weight} kg
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-mono border-r border-slate-200/60 dark:border-slate-700/50">
                          <span className={`font-mono text-xs font-extrabold ${isDark ? 'text-fuchsia-300' : 'text-purple-700'}`}>
                            {c.cbm} CBM
                          </span>
                        </td>
                        <td className="p-2.5 text-center border-r border-slate-200/60 dark:border-slate-700/50">
                          {c.photo_url ? (
                            <button
                              type="button"
                              onClick={() => setPreviewPhotoUrl(c.photo_url!)}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-extrabold border transition-colors cursor-pointer ${
                                isDark ? 'text-sky-300 bg-sky-950/70 hover:bg-sky-900 border-sky-700' : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200'
                              }`}
                            >
                              View Photo
                            </button>
                          ) : (
                            <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>No Photo</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleAddSubItemToCarton(c)}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isDark ? 'text-indigo-300 bg-indigo-950/70 hover:bg-indigo-900 border-indigo-700' : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
                              }`}
                              title={isBn ? 'এই কার্টুনে নতুন সাব-মার্ক যোগ/মার্জ করুন' : 'Add Sub-Mark / Merge Carton'}
                            >
                              <GitFork className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSingleCarton(c.id)}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isDark ? 'text-red-400 bg-red-950/70 hover:bg-red-900 border-red-800' : 'text-red-700 bg-red-50 hover:bg-red-100 border-red-200'
                              }`}
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

      {/* MAP CUSTOMER TO SHIPPING MARK MODAL */}
      {mapCustomerModalMark && (
        <div className="fixed inset-0 z-50 bg-[#1E293B]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCustomerMapping}
            className={`p-6 max-w-md w-full space-y-5 rounded-2xl border ${
              isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            } shadow-2xl animate-in zoom-in-95`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className={`text-sm font-extrabold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <UserCheck className="w-5 h-5 text-emerald-400" />
                <span>{isBn ? `কাস্টমার ট্যাগিং (${mapCustomerModalMark})` : `Map Customer (${mapCustomerModalMark})`}</span>
              </h3>
              <button
                type="button"
                onClick={() => setMapCustomerModalMark(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={`p-3 rounded-xl border text-xs space-y-1 font-semibold ${
              isDark ? 'bg-[#0F172A] border-slate-700 text-white' : 'bg-blue-50 border-blue-200 text-slate-800'
            }`}>
              <div>শিপিং মার্ক: <strong className="text-sky-300 font-mono font-extrabold">{mapCustomerModalMark}</strong></div>
              <div>অপারেটর: <strong className="text-emerald-400 font-extrabold">{currentUser.name} ({currentUser.role})</strong></div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <label className={`font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {isBn ? 'প্রকৃত কাস্টমার নির্বাচন করুন *' : 'Select Customer *'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsNewCustMapping(!isNewCustMapping)}
                  className="text-emerald-400 hover:underline text-xs flex items-center space-x-1 cursor-pointer font-extrabold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isNewCustMapping ? (isBn ? 'বিদ্যমান কাস্টমার সিলেক্ট' : 'Select Existing') : (isBn ? '+ নতুন কাস্টমার যোগ' : '+ Quick Add New')}</span>
                </button>
              </div>

              {!isNewCustMapping ? (
                <select
                  value={mapSelectedCustomerId}
                  onChange={(e) => setMapSelectedCustomerId(e.target.value)}
                  className={`w-full border rounded-xl p-2.5 outline-none font-extrabold text-xs cursor-pointer ${
                    isDark ? 'bg-[#0F172A] border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'
                  }`}
                >
                  {allDbCustomersList.map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {cust.name} ({cust.customer_code}) — {cust.phone}
                    </option>
                  ))}
                </select>
              ) : (
                <div className={`grid grid-cols-1 gap-3 p-3 rounded-xl border ${
                  isDark ? 'bg-[#0F172A] border-slate-700 text-white' : 'bg-slate-100 border-slate-200'
                }`}>
                  <div>
                    <label className={`block mb-1 font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{isBn ? 'গ্রাহকের নাম *' : 'Customer Name *'}</label>
                    <input
                      type="text"
                      required
                      value={newCustMappingName}
                      onChange={(e) => setNewCustMappingName(e.target.value)}
                      placeholder="e.g. Rahim Traders"
                      className={`w-full border rounded-xl p-2 outline-none font-semibold text-xs ${
                        isDark ? 'bg-[#1E293B] border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block mb-1 font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{isBn ? 'মোবাইল নম্বর' : 'Phone Number'}</label>
                    <input
                      type="text"
                      value={newCustMappingPhone}
                      onChange={(e) => setNewCustMappingPhone(e.target.value)}
                      placeholder="01700000000"
                      className={`w-full border rounded-xl p-2 font-mono font-extrabold outline-none text-xs ${
                        isDark ? 'bg-[#1E293B] border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setMapCustomerModalMark(null)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold border cursor-pointer ${
                  isDark ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all border border-emerald-500 cursor-pointer shadow-md"
              >
                {isBn ? 'কাস্টমার ট্যাগিং কনফার্ম করুন' : 'Confirm Customer Mapping'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
