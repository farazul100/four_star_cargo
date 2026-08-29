import React, { useState, useEffect } from 'react';
import {
  Package,
  Plane,
  CheckCircle2,
  Truck,
  Clock,
  Search,
  Filter,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Building2,
  Weight,
  Activity,
} from 'lucide-react';
import { Carton, FlyingProposal, Language } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../context/ThemeContext';
import { getHostingerDbData, subscribeToDbUpdates } from '../lib/db';

interface CargoLiveLifecycleMonitorProps {
  language?: Language;
  cartons?: Carton[];
  proposals?: FlyingProposal[];
}

export const CargoLiveLifecycleMonitor: React.FC<CargoLiveLifecycleMonitorProps> = ({
  language = 'en',
  cartons: propCartons,
  proposals: propProposals,
}) => {
  const { lang } = useTranslation();
  const isBn = (lang as any) === 'bn' || (language as any) === 'bn';
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [dbCartons, setDbCartons] = useState<Carton[]>([]);
  const [dbProposals, setDbProposals] = useState<FlyingProposal[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'booked' | 'flying' | 'received' | 'delivered'>('all');

  const loadData = () => {
    const fullDb = getHostingerDbData();
    setDbCartons(fullDb.cartons || []);
    setDbProposals(fullDb.proposals || []);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDbUpdates(loadData);
    return () => unsubscribe();
  }, []);

  const cartons = dbCartons.length > 0 ? dbCartons : (propCartons || []);
  const proposals = dbProposals.length > 0 ? dbProposals : (propProposals || []);

  // Summary counts
  const totalCount = cartons.length;
  const bookedCount = cartons.length; // All items originate from China booking
  const flyingCount = cartons.filter((c) => c.status === 'in_transit' || (c.status !== 'received' && c.status !== 'delivered' && c.flight_number)).length;
  const bdReceivedCount = cartons.filter((c) => c.status === 'received' || c.current_warehouse_id === 'wh-bd' || c.status === 'delivered').length;
  const deliveredCount = cartons.filter((c) => c.status === 'delivered').length;

  // Filtered cartons
  const filteredCartons = cartons.filter((c) => {
    // Stage filter
    if (activeFilter === 'booked' && !c.id) return false;
    if (activeFilter === 'flying' && c.status !== 'in_transit' && c.current_warehouse_id === 'wh-bd') return false;
    if (activeFilter === 'received' && (c.status !== 'received' && c.current_warehouse_id !== 'wh-bd' && c.status !== 'delivered')) return false;
    if (activeFilter === 'delivered' && c.status !== 'delivered') return false;

    // Search query filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.ctn_no?.toLowerCase().includes(q) ||
      c.shipping_mark?.toLowerCase().includes(q) ||
      c.tracking_number?.toLowerCase().includes(q) ||
      c.product_name_en?.toLowerCase().includes(q) ||
      c.product_name_cn?.toLowerCase().includes(q) ||
      c.flight_number?.toLowerCase().includes(q) ||
      c.awb_number?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className={`p-6 rounded-none border ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      } shadow-none flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-none">
            <Activity className="w-7 h-7 font-light" />
          </div>
          <div>
            <h1 className="text-xl font-normal tracking-wide flex items-center space-x-2">
              <span>⚡ কার্গো লাইফসাইকেল মনিটর ও রিয়েল-টাইম অপারেশনস ফিড</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-light mt-1">
              এক পলকে দেখে নিন কখন কোন প্রোডাক্ট বুকিং হয়েছে, ফ্লাইটে রয়েছে, বাংলাদেশ ওয়্যারহাউজে মেপে রিসিভ করা হয়েছে এবং কাস্টমারকে ডেলিভারি দেওয়া হয়েছে।
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 font-light bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-none border border-slate-300 dark:border-slate-700">
          <Clock className="w-4 h-4 text-emerald-500" />
          <span>অটোমেটিক রিয়েল-টাইম সিঙ্ক সক্রিয়</span>
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Booked */}
        <div className={`p-4 rounded-none border ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-light text-slate-500">📝 চীন বুকিং (Booked)</span>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-none border border-blue-500/20">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-normal text-slate-900 dark:text-white font-mono">{bookedCount}</span>
            <span className="text-[11px] text-slate-400 font-light">মোট কার্টুন</span>
          </div>
        </div>

        {/* Flying In Transit */}
        <div className={`p-4 rounded-none border ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-light text-slate-500">✈️ এয়ার ফ্লাইট (In Transit)</span>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-none border border-amber-500/20">
              <Plane className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-normal text-slate-900 dark:text-white font-mono">{flyingCount}</span>
            <span className="text-[11px] text-slate-400 font-light">আকাশপথে পরিবাহিত</span>
          </div>
        </div>

        {/* BD Warehouse Received */}
        <div className={`p-4 rounded-none border ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-light text-slate-500">📥 BD স্টক (Stock Received)</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-none border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-normal text-slate-900 dark:text-white font-mono">{bdReceivedCount}</span>
            <span className="text-[11px] text-slate-400 font-light">মেপে রিসিভড</span>
          </div>
        </div>

        {/* Delivered */}
        <div className={`p-4 rounded-none border ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-light text-slate-500">🚚 বিলিকৃত (Delivered)</span>
            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-none border border-purple-500/20">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-normal text-slate-900 dark:text-white font-mono">{deliveredCount}</span>
            <span className="text-[11px] text-slate-400 font-light">কাস্টমারকে হস্তান্তরিত</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className={`p-4 rounded-none border space-y-3 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Stage Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 text-xs font-light rounded-none border cursor-pointer transition-all ${
                activeFilter === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              📦 সকল অ্যাক্টিভিটি ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('booked')}
              className={`px-3 py-1.5 text-xs font-light rounded-none border cursor-pointer transition-all ${
                activeFilter === 'booked'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              📝 চীন বুকিং ({bookedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('flying')}
              className={`px-3 py-1.5 text-xs font-light rounded-none border cursor-pointer transition-all ${
                activeFilter === 'flying'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              ✈️ এয়ার ফ্লাইট ({flyingCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('received')}
              className={`px-3 py-1.5 text-xs font-light rounded-none border cursor-pointer transition-all ${
                activeFilter === 'received'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              📥 BD স্টক রিসিভ ({bdReceivedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('delivered')}
              className={`px-3 py-1.5 text-xs font-light rounded-none border cursor-pointer transition-all ${
                activeFilter === 'delivered'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              🚚 কাস্টমার ডেলিভারি ({deliveredCount})
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="CTN, Shipping Mark, Tracking..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-none border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-light"
            />
          </div>
        </div>
      </div>

      {/* Cargo Lifecycle Activity Cards Feed */}
      <div className="space-y-4">
        {filteredCartons.length === 0 ? (
          <div className={`p-12 text-center rounded-none border ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
          }`}>
            <Package className="w-10 h-10 mx-auto opacity-40 mb-2 font-light" />
            <p className="text-sm font-light">কোনো কার্টুন অ্যাক্টিভিটি ডাটা পাওয়া যায়নি</p>
          </div>
        ) : (
          filteredCartons.map((carton) => {
            const isBooked = true; // Always has booking stage
            const isFlying = carton.status === 'in_transit' || carton.status === 'received' || carton.status === 'delivered';
            const isBDReceived = carton.status === 'received' || carton.current_warehouse_id === 'wh-bd' || carton.status === 'delivered';
            const isDelivered = carton.status === 'delivered';

            return (
              <div
                key={carton.id}
                className={`p-5 rounded-none border space-y-4 transition-colors ${
                  isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header info */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-sm font-normal text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-none border border-slate-300 dark:border-slate-700">
                      {carton.ctn_no}
                    </span>
                    <div>
                      <span className="text-sm font-normal text-blue-600 dark:text-blue-400">
                        Mark: {carton.shipping_mark}
                      </span>
                      <span className="text-xs text-slate-400 font-mono ml-2">
                        Tracking: {carton.tracking_number}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-xs text-slate-800 dark:text-slate-200 font-normal">
                        {carton.product_name_en}
                      </div>
                      <div className="text-[11px] text-slate-400 font-light">
                        {carton.quantity || 1} Pcs • {carton.cbm || 0.15} CBM • <span className="text-emerald-600 dark:text-emerald-400 font-normal">{carton.gross_weight} KG</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4-Stage Visual Lifecycle Progress Bar */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                  {/* Stage 1: China Booking */}
                  <div className={`p-3 rounded-none border text-xs space-y-1 ${
                    isBooked
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300'
                      : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-normal flex items-center space-x-1">
                        <Package className="w-3.5 h-3.5" />
                        <span>১. চীন বুকিং</span>
                      </span>
                      <span className="text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded-none font-light">সম্পন্ন</span>
                    </div>
                    <div className="text-[11px] font-light text-slate-500 dark:text-slate-400">
                      উৎস: {carton.current_warehouse_name || 'গুয়াংজু ওয়্যারহাউজ'}
                    </div>
                    <div className="text-[10px] font-light text-slate-400">
                      তারিখ: {carton.created_at ? new Date(carton.created_at).toLocaleDateString('bn-BD') : 'N/A'}
                    </div>
                  </div>

                  {/* Stage 2: Flying In-Transit */}
                  <div className={`p-3 rounded-none border text-xs space-y-1 ${
                    isFlying
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                      : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-normal flex items-center space-x-1">
                        <Plane className="w-3.5 h-3.5" />
                        <span>২. এয়ার ফ্লাইট</span>
                      </span>
                      {isFlying ? (
                        <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded-none font-light">ফ্লাইটে আছে</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-light">অপেমান</span>
                      )}
                    </div>
                    <div className="text-[11px] font-light text-slate-500 dark:text-slate-400">
                      ফ্লাইট: {carton.flight_number || 'N/A'} (AWB: {carton.awb_number || 'N/A'})
                    </div>
                    <div className="text-[10px] font-light text-slate-400">
                      ফ্লাইং তারিখ: {carton.flying_date || 'N/A'}
                    </div>
                  </div>

                  {/* Stage 3: BD Warehouse Receiving */}
                  <div className={`p-3 rounded-none border text-xs space-y-1 ${
                    isBDReceived
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-normal flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>৩. BD মেপে রিসিভড</span>
                      </span>
                      {isBDReceived ? (
                        <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded-none font-light">স্টকে রিসিভড</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-light">অপেমান</span>
                      )}
                    </div>
                    <div className="text-[11px] font-light text-slate-500 dark:text-slate-400">
                      লোকেশন: ঢাকা সেন্ট্রাল Hub (wh-bd)
                    </div>
                    <div className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400">
                      চূড়ান্ত স্কেল ওজন: {carton.gross_weight} KG
                    </div>
                  </div>

                  {/* Stage 4: Customer Handover */}
                  <div className={`p-3 rounded-none border text-xs space-y-1 ${
                    isDelivered
                      ? 'bg-purple-500/10 border-purple-500/30 text-purple-800 dark:text-purple-300'
                      : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-normal flex items-center space-x-1">
                        <Truck className="w-3.5 h-3.5" />
                        <span>৪. কাস্টমার ডেলিভারি</span>
                      </span>
                      {isDelivered ? (
                        <span className="text-[10px] bg-purple-500/20 px-1.5 py-0.5 rounded-none font-light">ডেলিভারড</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-light">প্রসেসিং</span>
                      )}
                    </div>
                    <div className="text-[11px] font-light text-slate-500 dark:text-slate-400">
                      অবস্থা: {isDelivered ? 'কাস্টমারকে হস্তান্তরিত' : 'ওয়্যারহাউজে বিলির অপেক্ষায়'}
                    </div>
                    <div className="text-[10px] font-light text-slate-400">
                      স্ট্যাটাস: {isDelivered ? 'পরিশোধিত / হস্তান্তরিত' : 'প্রস্তুতgetStock'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
