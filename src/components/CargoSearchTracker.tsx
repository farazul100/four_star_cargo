import React, { useState } from 'react';
import {
  Search,
  Package,
  Plane,
  CheckCircle2,
  Truck,
  Globe,
  Clock,
  ShieldCheck,
  MapPin,
  Printer,
  FileSpreadsheet,
  QrCode,
  Layers,
  Sparkles,
  Building2,
  Filter,
} from 'lucide-react';
import { Carton, FlyingProposal, Language } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../context/ThemeContext';
import { Logo } from './Logo';
import { getHostingerDbData } from '../lib/db';

interface CargoSearchTrackerProps {
  cartons?: Carton[];
  proposals?: FlyingProposal[];
  language?: Language;
}

interface GroupedTrackingShipment {
  trackingNumber: string;
  shippingMark: string;
  cartons: Carton[];
  totalCartons: number;
  totalGrossWeight: number;
  totalNetWeight: number;
  totalCbm: number;
  totalQty: number;
  flightNumber: string;
  airline: string;
  flyingDate: string;
  status: Carton['status'];
  originHub: string;
  destinationHub: string;
  proposalObj?: FlyingProposal;
}

export const CargoSearchTracker: React.FC<CargoSearchTrackerProps> = ({
  cartons = [],
  proposals = [],
  language = 'en',
}) => {
  const { lang } = useTranslation();
  const { theme } = useTheme();
  const isBn = language === 'bn' || (lang as any) === 'bn';
  const isDark = theme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [groupedShipments, setGroupedShipments] = useState<GroupedTrackingShipment[]>([]);
  const [printPassShipment, setPrintPassShipment] = useState<GroupedTrackingShipment | null>(null);
  const [locationFilter, setLocationFilter] = useState<'all' | 'china' | 'transit' | 'airport' | 'bd_hub' | 'delivered'>('all');

  // Read fresh DB items
  const dbData = getHostingerDbData();
  const liveProposals = Array.isArray(proposals) && proposals.length > 0 ? proposals : dbData.proposals;
  const liveCartons = Array.isArray(cartons) && cartons.length > 0 ? cartons : dbData.cartons;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();

    if (!query) return;

    // 1. Find matching cartons across Tracking Number, Master Tracking Number, CTN No, Shipping Mark, Product Name, and Flight Number
    const matchingCartons = liveCartons.filter((c) => {
      const tNo = (c.tracking_number || '').toLowerCase();
      const mNo = (c.master_tracking_number || '').toLowerCase();
      const ctn = (c.ctn_no || '').toLowerCase();
      const mark = (c.shipping_mark || '').toLowerCase();
      const prodEn = (c.product_name_en || '').toLowerCase();
      const prodCn = (c.product_name_cn || '').toLowerCase();
      const flt = (c.flight_number || '').toLowerCase();

      return (
        tNo.includes(query) ||
        mNo.includes(query) ||
        ctn.includes(query) ||
        mark.includes(query) ||
        prodEn.includes(query) ||
        prodCn.includes(query) ||
        flt.includes(query)
      );
    });

    if (matchingCartons.length === 0) {
      setGroupedShipments([]);
      setSearched(true);
      return;
    }

    // 2. Extract unique tracking keys (tracking_number || master_tracking_number || shipping_mark) from matching cartons
    const matchedKeys = new Set(
      matchingCartons.map((c) => c.tracking_number || c.master_tracking_number || c.shipping_mark).filter(Boolean)
    );

    // 3. Group ALL sister cartons belonging to the matched tracking keys
    const groupsMap = new Map<string, Carton[]>();
    liveCartons.forEach((c) => {
      const key = c.tracking_number || c.master_tracking_number || c.shipping_mark || 'UNASSIGNED';
      if (matchedKeys.has(key)) {
        if (!groupsMap.has(key)) {
          groupsMap.set(key, []);
        }
        groupsMap.get(key)!.push(c);
      }
    });

    // 5. Construct Grouped Tracking Shipment Objects
    const shipmentsList: GroupedTrackingShipment[] = [];

    groupsMap.forEach((cartonList, trackingKey) => {
      const sample = cartonList[0];
      const totalGrossWeight = cartonList.reduce((sum, item) => sum + (item.gross_weight || 0), 0);
      const totalNetWeight = cartonList.reduce((sum, item) => sum + (item.net_weight || 0), 0);
      const totalCbm = cartonList.reduce((sum, item) => sum + (item.cbm || 0), 0);
      const totalQty = cartonList.reduce((sum, item) => sum + (item.quantity || 0), 0);

      // Find matching proposal / flight batch
      const matchingProp = liveProposals.find(
        (p) =>
          (p.carton_ids || []).some((id) => cartonList.some((c) => c.id === id)) ||
          p.flight_number === sample.flight_number ||
          (sample.flight_number && p.id.toLowerCase() === sample.flight_number.toLowerCase())
      );

      // Determine flight status priority
      let effectiveStatus: Carton['status'] = sample.status || 'booked';
      if (matchingProp) {
        if (matchingProp.status === 'dispatched' || matchingProp.status === 'in_transit') {
          effectiveStatus = 'in_transit';
        } else if (matchingProp.status === 'received') {
          effectiveStatus = 'received';
        }
      }

      shipmentsList.push({
        trackingNumber: trackingKey,
        shippingMark: sample.shipping_mark || 'DEFAULT-MARK',
        cartons: cartonList,
        totalCartons: cartonList.length,
        totalGrossWeight,
        totalNetWeight,
        totalCbm,
        totalQty,
        flightNumber: sample.flight_number || matchingProp?.flight_number || matchingProp?.flying_name || 'BS-02',
        airline: matchingProp?.airline || 'US-Bangla Air Cargo',
        flyingDate: sample.flying_date || matchingProp?.date || '2026-08-15',
        status: effectiveStatus,
        originHub: sample.current_warehouse_name || 'Guangzhou Air Cargo Hub (China 🇨🇳)',
        destinationHub: sample.destination_warehouse_name || 'Dhaka Central Freight Hub (BD 🇧🇩)',
        proposalObj: matchingProp,
      });
    });

    setGroupedShipments(shipmentsList);
    setSearched(true);
  };

  const getStatusStage = (status: Carton['status']) => {
    switch (status) {
      case 'booked':
        return 1;
      case 'proposed':
        return 2;
      case 'in_transit':
        return 3;
      case 'received':
        return 4;
      case 'delivered':
        return 5;
      default:
        return 1;
    }
  };

  return (
    <div className="space-y-6">
      {/* Brand & Search Title Card */}
      <div className={`p-6 md:p-8 rounded-2xl border space-y-5 transition-all ${
        isDark ? 'bg-[#1E293B] border-slate-700 text-white shadow-xl' : 'bg-white border-slate-200 shadow-sm text-slate-900'
      }`}>
        <div className="text-center space-y-2.5">
          <div className="flex justify-center mb-1">
            <Logo size="md" />
          </div>
          <h2 className={`text-xl md:text-3xl font-extrabold font-poppins ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {isBn ? 'গ্লোবাল কার্গো ট্র্যাকিং সার্চ পোর্টাল' : 'Universal Cargo Search Portal'}
          </h2>
          <p className={`text-xs md:text-sm max-w-xl mx-auto font-normal leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {isBn
              ? 'আপনার ট্র্যাকিং নম্বর (Tracking ID) দিন — ওই আইডির অধীনে চায়না ওয়্যারহাউজ, ফ্লাইট ও বাংলাদেশ ওয়্যারহাউজে কোন কোন কার্টুন রয়েছে তা একসাথে স্পষ্ট ফুটে উঠবে।'
              : 'Enter your Tracking ID or Reference Number to track exact carton distribution across China Warehouse, In-Flight, and BD Hub.'}
          </p>
        </div>

        {/* Global Search Bar Form */}
        <form
          onSubmit={handleSearchSubmit}
          className={`border rounded-xl p-3 shadow-lg flex flex-col sm:flex-row items-center gap-3 ${
            isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-300 shadow-sm'
          }`}
        >
          <div className="relative flex-1 w-full">
            <Search className={`w-5 h-5 absolute left-4 top-3.5 ${isDark ? 'text-teal-400' : 'text-slate-400'}`} />
            <input
              type="text"
              required
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? 'উদাহরণ: TRK98421039 বা FSC-2026-0891 বা SM-DHAKA-88...' : 'e.g. TRK98421039 or FSC-2026-0891...'}
              className={`w-full border rounded-xl py-3 pl-12 pr-4 text-sm outline-none transition-all font-mono font-medium ${
                isDark
                  ? 'bg-slate-950 border-slate-600 focus:border-teal-400 text-white placeholder:text-slate-300'
                  : 'bg-white border-slate-300 focus:border-teal-600 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto py-3 px-8 rounded-xl bg-[#00897B] hover:bg-[#00796B] active:bg-[#00695C] text-white font-semibold text-xs shadow-md transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer border-0"
          >
            <Search className="w-4 h-4" />
            <span>{isBn ? 'ট্র্যাকিং সার্চ করুন' : 'Track Shipment'}</span>
          </button>
        </form>
      </div>

      {/* Multi-Carton Search Results Section */}
      {searched && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {groupedShipments.length > 0 ? (
            groupedShipments.map((shipment) => {
              const stage = getStatusStage(shipment.status);

              // Location Breakdown
              const chinaStockCartons = shipment.cartons.filter((c) => c.status === 'booked' || c.status === 'proposed');
              const inTransitCartons = shipment.cartons.filter((c) => c.status === 'in_transit');
              const bdHubCartons = shipment.cartons.filter((c) => c.status === 'received');
              const deliveredCartons = shipment.cartons.filter((c) => c.status === 'delivered');

              // Filtered cartons for itemized table
              const displayedCartons = shipment.cartons.filter((c) => {
                if (locationFilter === 'china') return c.status === 'booked' || c.status === 'proposed';
                if (locationFilter === 'transit') return c.status === 'in_transit';
                if (locationFilter === 'bd_hub') return c.status === 'received';
                if (locationFilter === 'delivered') return c.status === 'delivered';
                return true;
              });

              return (
                <div
                  key={shipment.trackingNumber}
                  className={`border rounded-2xl p-5 md:p-6 space-y-6 shadow-xl transition-all ${
                    isDark ? 'bg-[#1E293B] border-slate-700' : 'bg-white border-slate-300'
                  }`}
                >
                  {/* Master Tracking Header Card */}
                  <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="text-xs px-2 py-0.5 rounded-none bg-blue-600 text-white font-mono font-medium">
                          TRACKING ID
                        </span>
                        <h3 className={`text-xl font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {shipment.trackingNumber}
                        </h3>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-none border ${
                          isDark ? 'bg-teal-500/10 text-teal-300 border-teal-500/30' : 'bg-teal-50 text-teal-800 border-teal-300 font-semibold'
                        }`}>
                          Mark: {shipment.shippingMark}
                        </span>
                      </div>
                      <p className={`text-xs font-light ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {shipment.originHub} ➔ {shipment.destinationHub}
                      </p>
                    </div>

                    {/* Summary Metrics & Actions */}
                    <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                      <div className="text-right font-mono text-xs">
                        <span className={`block font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {shipment.totalCartons} {isBn ? 'টি কার্টুন' : 'Cartons'} ({shipment.totalQty} Pcs)
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-normal">
                          {shipment.totalGrossWeight.toFixed(1)} kg | {shipment.totalCbm.toFixed(2)} CBM
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPrintPassShipment(shipment)}
                        className="px-3.5 py-2 rounded-none bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer border-0"
                      >
                        <Printer className="w-4 h-4 text-slate-300" />
                        <span>{isBn ? 'ট্র্যাকিং পাস প্রিন্ট' : 'Print Pass'}</span>
                      </button>
                    </div>
                  </div>

                  {/* HIGHLY EXPLICIT LOCATION BREAKDOWN KPI DASHBOARD */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-800">
                      <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 ${
                        isDark ? 'text-teal-400' : 'text-[#00897B]'
                      }`}>
                        <Building2 className="w-4 h-4" />
                        <span>{isBn ? 'কার্টুন সমূহের রিয়েল-টাইম অবস্থান বিভাজন:' : 'Real-Time Carton Location Breakdown:'}</span>
                      </h4>
                      <span className="text-[11px] font-mono text-slate-500 font-normal">
                        Total {shipment.totalCartons} Cartons
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                      {/* 1. China Warehouse */}
                      <div
                        onClick={() => setLocationFilter('china')}
                        className={`p-3 border rounded-none cursor-pointer transition-all ${
                          locationFilter === 'china' ? 'ring-2 ring-amber-500 font-bold' : ''
                        } ${
                          chinaStockCartons.length > 0
                            ? isDark ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-900'
                            : isDark ? 'bg-slate-900 border-slate-700 text-slate-400 opacity-75' : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold">🇨🇳 চায়না ওয়্যারহাউজ</span>
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="mt-2">
                          <span className="text-2xl font-bold font-mono">{chinaStockCartons.length}</span>
                          <span className="text-[10px] block font-sans font-normal opacity-80">
                            {isBn ? 'টি কার্টুন গচ্ছিত' : 'Cartons in Stock'}
                          </span>
                        </div>
                      </div>

                      {/* 2. Flying In-Transit */}
                      <div
                        onClick={() => setLocationFilter('transit')}
                        className={`p-3 border rounded-xl cursor-pointer transition-all ${
                          locationFilter === 'transit' ? 'ring-2 ring-blue-500 font-bold' : ''
                        } ${
                          inTransitCartons.length > 0
                            ? isDark ? 'bg-blue-500/15 border-blue-500/40 text-blue-300' : 'bg-blue-50 border-blue-300 text-blue-900'
                            : isDark ? 'bg-slate-900 border-slate-700 text-slate-400 opacity-75' : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold">✈️ ইন-ফ্লাইট (Mid-Air)</span>
                          <Plane className="w-3.5 h-3.5" />
                        </div>
                        <div className="mt-2">
                          <span className="text-2xl font-bold font-mono">{inTransitCartons.length}</span>
                          <span className="text-[10px] block font-sans font-normal opacity-80">
                            {isBn ? 'টি কার্টুন আকাশে ভাসমান' : 'Cartons Flying'}
                          </span>
                        </div>
                      </div>

                      {/* 3. BD Hub Received */}
                      <div
                        onClick={() => setLocationFilter('bd_hub')}
                        className={`p-3 border rounded-xl cursor-pointer transition-all ${
                          locationFilter === 'bd_hub' ? 'ring-2 ring-teal-500 font-bold' : ''
                        } ${
                          bdHubCartons.length > 0
                            ? isDark ? 'bg-teal-500/15 border-teal-500/40 text-teal-300' : 'bg-teal-50 border-teal-300 text-teal-900'
                            : isDark ? 'bg-slate-900 border-slate-700 text-slate-400 opacity-75' : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold">🏢 বাংলাদেশ হাব</span>
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <div className="mt-2">
                          <span className="text-2xl font-bold font-mono">{bdHubCartons.length}</span>
                          <span className="text-[10px] block font-sans font-normal opacity-80">
                            {isBn ? 'টি কার্টুন হাবে রিসিভড' : 'Cartons Received BD'}
                          </span>
                        </div>
                      </div>

                      {/* 4. Delivered */}
                      <div
                        onClick={() => setLocationFilter('delivered')}
                        className={`p-3 border rounded-xl cursor-pointer transition-all ${
                          locationFilter === 'delivered' ? 'ring-2 ring-emerald-500 font-bold' : ''
                        } ${
                          deliveredCartons.length > 0
                            ? isDark ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : isDark ? 'bg-slate-900 border-slate-700 text-slate-400 opacity-75' : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold">✅ ডেলিভার্ড</span>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="mt-2">
                          <span className="text-2xl font-bold font-mono">{deliveredCartons.length}</span>
                          <span className="text-[10px] block font-sans font-normal opacity-80">
                            {isBn ? 'টি ডেলিভারি সম্পন্ন' : 'Cartons Delivered'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Itemized Linked Cartons Breakdown Table */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2 border-slate-200 dark:border-slate-800">
                      <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 ${
                        isDark ? 'text-slate-300' : 'text-slate-800'
                      }`}>
                        <Layers className="w-4 h-4 text-[#00897B]" />
                        <span>
                          {isBn
                            ? `কার্টুন তালিকা (${displayedCartons.length}/${shipment.totalCartons} টি কার্টুন প্রদর্শিত):`
                            : `Itemized Carton List (${displayedCartons.length}/${shipment.totalCartons} Cartons Shown):`}
                        </span>
                      </h4>

                      {/* Location Filter Tab Buttons */}
                      <div className="flex items-center space-x-1 flex-wrap gap-y-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setLocationFilter('all')}
                          className={`px-2.5 py-1 text-[11px] font-mono border transition-all cursor-pointer ${
                            locationFilter === 'all'
                              ? 'bg-[#00897B] text-white border-[#00897B] font-bold'
                              : isDark ? 'bg-[#1E293B] text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          সকল ({shipment.totalCartons})
                        </button>
                        <button
                          type="button"
                          onClick={() => setLocationFilter('china')}
                          className={`px-2.5 py-1 text-[11px] font-mono border transition-all cursor-pointer ${
                            locationFilter === 'china'
                              ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold'
                              : isDark ? 'bg-[#1E293B] text-amber-400 border-slate-800' : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          🇨🇳 চায়না ({chinaStockCartons.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setLocationFilter('transit')}
                          className={`px-2.5 py-1 text-[11px] font-mono border transition-all cursor-pointer ${
                            locationFilter === 'transit'
                              ? 'bg-blue-600 text-white border-blue-700 font-bold'
                              : isDark ? 'bg-[#1E293B] text-blue-400 border-slate-800' : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          ✈️ ফ্লাইটে ({inTransitCartons.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setLocationFilter('bd_hub')}
                          className={`px-2.5 py-1 text-[11px] font-mono border transition-all cursor-pointer ${
                            locationFilter === 'bd_hub'
                              ? 'bg-teal-600 text-white border-teal-700 font-bold'
                              : isDark ? 'bg-[#1E293B] text-teal-400 border-slate-800' : 'bg-teal-50 text-teal-800 border-teal-200'
                          }`}
                        >
                          🏢 বিডি হাব ({bdHubCartons.length})
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className={`border-b text-[11px] ${
                          isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                        }`}>
                          <tr>
                            <th className="p-2.5">#</th>
                            <th className="p-2.5">{isBn ? 'সিটিএন নম্বর' : 'CTN No'}</th>
                            <th className="p-2.5">{isBn ? 'শিপিং মার্ক' : 'Shipping Mark'}</th>
                            <th className="p-2.5">{isBn ? 'পণ্য বিবরণ' : 'Product Name'}</th>
                            <th className="p-2.5 text-center">{isBn ? 'পরিমাণ' : 'Qty'}</th>
                            <th className="p-2.5 text-right">{isBn ? 'গ্রস ওজন' : 'Gross Wt'}</th>
                            <th className="p-2.5 text-right">{isBn ? 'সিবিএম' : 'CBM'}</th>
                            <th className="p-2.5 text-center">{isBn ? 'বর্তমান অবস্থান ও স্ট্যাটাস' : 'Current Location & Status'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {displayedCartons.map((ctn, idx) => (
                            <tr
                              key={ctn.id}
                              className={`transition-colors ${
                                isDark ? 'hover:bg-slate-800/40 text-slate-200' : 'hover:bg-slate-50 text-slate-800'
                              }`}
                            >
                              <td className="p-2.5 font-bold text-slate-400">{idx + 1}</td>
                              <td className="p-2.5 font-bold text-teal-600 dark:text-teal-400">{ctn.ctn_no}</td>
                              <td className="p-2.5 text-slate-700 dark:text-slate-300">{ctn.shipping_mark}</td>
                              <td className="p-2.5">
                                <span className="block font-medium">{ctn.product_name_en}</span>
                                {ctn.product_name_cn && (
                                  <span className="text-[10px] text-slate-500 font-sans block">{ctn.product_name_cn}</span>
                                )}
                              </td>
                              <td className="p-2.5 text-center">{ctn.quantity} Pcs</td>
                              <td className="p-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400">{ctn.gross_weight} kg</td>
                              <td className="p-2.5 text-right text-purple-600 dark:text-purple-400">{ctn.cbm} CBM</td>
                              <td className="p-2.5 text-center">
                                {ctn.status === 'in_transit' ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="px-2 py-0.5 rounded-none text-[10px] font-bold bg-blue-600 text-white border border-blue-700 uppercase flex items-center space-x-1 shadow-xs">
                                      <Plane className="w-3 h-3 inline mr-1" />
                                      <span>{isBn ? 'আকাশে ফ্লাইটে রয়েছে' : 'In Flight (Mid-Air)'}</span>
                                    </span>
                                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono mt-0.5 font-bold">
                                      Flight: {ctn.flight_number || shipment.flightNumber}
                                    </span>
                                  </div>
                                ) : ctn.status === 'received' ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="px-2 py-0.5 rounded-none text-[10px] font-bold bg-[#00897B] text-white border border-teal-700 uppercase flex items-center space-x-1 shadow-xs">
                                      <MapPin className="w-3 h-3 inline mr-1" />
                                      <span>{isBn ? 'বাংলাদেশ হাবে প্রাপ্ত' : 'BD Hub Received'}</span>
                                    </span>
                                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-mono mt-0.5 font-bold">
                                      {ctn.destination_warehouse_name || 'Dhaka Central Hub'}
                                    </span>
                                  </div>
                                ) : ctn.status === 'delivered' ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="px-2 py-0.5 rounded-none text-[10px] font-bold bg-emerald-600 text-white border border-emerald-700 uppercase flex items-center space-x-1 shadow-xs">
                                      <CheckCircle2 className="w-3 h-3 inline mr-1" />
                                      <span>{isBn ? 'গ্রাহককে ডেলিভার্ড' : 'Delivered to Customer'}</span>
                                    </span>
                                  </div>
                                ) : (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="px-2 py-0.5 rounded-none text-[10px] font-bold bg-amber-500 text-slate-950 border border-amber-600 uppercase flex items-center space-x-1 shadow-xs">
                                      <Building2 className="w-3 h-3 inline mr-1" />
                                      <span>{isBn ? 'চায়না ওয়্যারহাউজে গচ্ছিত' : 'China Warehouse Stock'}</span>
                                    </span>
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-0.5 font-medium">
                                      Guangzhou Hub
                                    </span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            /* Graceful Empty State */
            <div className={`border rounded-none p-10 text-center space-y-3 ${
              isDark ? 'bg-[#1E293B] border-[#1E3247]' : 'bg-white border-slate-300'
            }`}>
              <Package className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {isBn ? 'কোনো শিপমেন্ট বা কার্টুন পাওয়া যায়নি' : 'No Shipment Found'}
              </h3>
              <p className={`text-xs max-w-md mx-auto font-light ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isBn
                  ? 'আপনার প্রদানকৃত ট্র্যাকিং আইডির সাথে কোনো ডাটা মেলেনি। সঠিক ট্র্যাকিং নম্বর দিয়ে পুনরায় চেষ্টা করুন।'
                  : 'The entered tracking ID did not match any active cargo record. Please verify your reference ID.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Printable Tracking Pass Modal */}
      {printPassShipment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white text-slate-900 max-w-2xl w-full p-6 space-y-6 shadow-2xl border border-slate-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4 border-slate-200">
              <div className="flex items-center space-x-3">
                <Logo size="md" />
                <div>
                  <h3 className="font-bold text-lg text-slate-900">M/S FOUR STAR CARGO PASS</h3>
                  <p className="text-xs text-slate-500 font-mono">Official Tracking Receipt & Manifest</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPrintPassShipment(null)}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-none cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Pass Content */}
            <div className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-100 border border-slate-300">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Tracking ID:</span>
                  <strong className="text-base text-blue-700 block">{printPassShipment.trackingNumber}</strong>
                  <span className="text-[11px] text-slate-700 block mt-1">Shipping Mark: {printPassShipment.shippingMark}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase">Flight & Airline:</span>
                  <strong className="text-sm text-slate-900 block">{printPassShipment.flightNumber}</strong>
                  <span className="text-[11px] text-slate-600 block">{printPassShipment.airline}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 border border-slate-300 bg-slate-50">
                  <span className="text-[10px] text-slate-500 block">TOTAL CARTONS</span>
                  <span className="font-bold text-slate-900">{printPassShipment.totalCartons} Cartons</span>
                </div>
                <div className="p-2 border border-slate-300 bg-slate-50">
                  <span className="text-[10px] text-slate-500 block">TOTAL GROSS WT</span>
                  <span className="font-bold text-emerald-700">{printPassShipment.totalGrossWeight.toFixed(1)} kg</span>
                </div>
                <div className="p-2 border border-slate-300 bg-slate-50">
                  <span className="text-[10px] text-slate-500 block">TOTAL VOLUME</span>
                  <span className="font-bold text-purple-700">{printPassShipment.totalCbm.toFixed(2)} CBM</span>
                </div>
              </div>

              {/* Itemized Cartons Table */}
              <div className="space-y-1">
                <span className="font-bold text-xs block text-slate-800">Attached Cartons Summary:</span>
                <table className="w-full text-left text-xs border border-slate-300">
                  <thead className="bg-slate-200 text-slate-800 border-b border-slate-300">
                    <tr>
                      <th className="p-2">CTN No</th>
                      <th className="p-2">Product Name</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-right">Gross Wt</th>
                      <th className="p-2 text-right">CBM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printPassShipment.cartons.map((c) => (
                      <tr key={c.id}>
                        <td className="p-2 font-bold">{c.ctn_no}</td>
                        <td className="p-2">{c.product_name_en}</td>
                        <td className="p-2 text-center">{c.quantity} Pcs</td>
                        <td className="p-2 text-right font-medium">{c.gross_weight} kg</td>
                        <td className="p-2 text-right">{c.cbm} CBM</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Print Action */}
            <div className="flex items-center justify-end space-x-3 border-t pt-4 border-slate-200">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-xs flex items-center space-x-2 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official Tracking Pass</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
