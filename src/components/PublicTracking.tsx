import React, { useState } from 'react';
import { Search, Package, Plane, CheckCircle2, Truck, Sun, Moon, Globe, ShieldCheck, MapPin, Box, ArrowRight, Zap, Sparkles } from 'lucide-react';
import { Carton, FlyingProposal, Language } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../context/ThemeContext';
import { Logo } from './Logo';
import { LanguageSelector } from './LanguageSelector';
import { PublicCustomerChatWidget } from './PublicCustomerChatWidget';

interface PublicTrackingProps {
  cartons: Carton[];
  proposals?: FlyingProposal[];
  language: Language;
  onBackToPortal?: () => void;
}

export const PublicTracking: React.FC<PublicTrackingProps> = ({
  cartons,
  language,
}) => {
  const { lang, setLang } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const isBn = language === 'bn';

  const [searchQuery, setSearchQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [matchedCartons, setMatchedCartons] = useState<Carton[]>([]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();

    if (!query) return;

    // Search matching Master Tracking Number, CTN No, or Shipping Mark
    const results = cartons.filter((c) => {
      const matchTracking = (c.tracking_number || '').toLowerCase().includes(query) || (c.master_tracking_number || '').toLowerCase().includes(query);
      const matchCtn = (c.ctn_no || '').toLowerCase().includes(query);
      const matchShippingMark = (c.shipping_mark || '').toLowerCase().includes(query);
      const matchPkg = (c.packaging_number || '').toLowerCase().includes(query);

      return matchTracking || matchCtn || matchShippingMark || matchPkg;
    });

    setMatchedCartons(results);
    setSearched(true);
  };

  const getStatusStage = (status: Carton['status']) => {
    switch (status) {
      case 'booked':
      case 'proposed':
        return 1;
      case 'in_transit':
        return 2;
      case 'received':
        return 3;
      case 'delivered':
        return 4;
      default:
        return 1;
    }
  };

  return (
    <div className={`min-h-screen w-full flex flex-col justify-between relative overflow-x-hidden font-sans transition-colors duration-300 ${
      isDark ? 'bg-[#080E17] text-[#E2E8F0]' : 'bg-[#F4F8FA] text-[#0F2D52]'
    }`}>
      {/* Background Animated Gradient Glow Orbs */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-[#00897B]/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] bg-[#1E88E5]/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header Bar (Full Width across viewport) */}
      <header className={`w-full px-6 md:px-12 py-5 z-20 border-b flex items-center justify-between backdrop-blur-md transition-colors ${
        isDark ? 'bg-[#080E17]/80 border-slate-700' : 'bg-white/80 border-slate-200 shadow-xs'
      }`}>
        {/* Company Brand Logo & Title */}
        <div className="flex items-center space-x-3">
          <Logo size="md" />
          <div>
            <h1 className={`text-base md:text-lg font-black tracking-wider uppercase font-poppins flex items-center space-x-2 ${
              isDark ? 'text-white' : 'text-[#0F2D52]'
            }`}>
              <span>FOUR STAR</span>
              <span className="text-[#00897B]">CARGO</span>
            </h1>
            <p className="text-[10px] text-[#00897B] font-bold font-mono tracking-widest uppercase">
              Global Cargo Shipment Tracking Portal
            </p>
          </div>
        </div>

        {/* Right Corner: Controls (Language & Theme Switcher) */}
        <div className="flex items-center space-x-3">
          <LanguageSelector onLanguageChange={(code) => setLang(code as any)} />

          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full border transition-all cursor-pointer ${
              isDark
                ? 'bg-[#1E293B] border-slate-700 text-amber-400 hover:border-amber-400'
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:border-[#00897B]'
            }`}
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-[#00897B]" />}
          </button>
        </div>
      </header>

      {/* Main Content Body (Full Width Container) */}
      <main className="w-full px-4 md:px-12 lg:px-20 z-10 py-10 space-y-10 flex-1 max-w-[1600px] mx-auto">
        {/* Hero Section Banner */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-[#00897B]/10 border border-[#00897B]/30 text-[#00897B] text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isBn ? 'রিয়েল-টাইম এয়ার কার্গো ট্র্যাকিং' : 'Real-Time Air Freight Shipment Tracking'}</span>
          </div>

          <h2 className={`text-3xl md:text-5xl font-black font-poppins tracking-tight leading-tight ${
            isDark ? 'text-white' : 'text-[#0F2D52]'
          }`}>
            {isBn ? 'আপনার কার্গো প্রোডাক্ট ট্র্যাক করুন' : 'Track Your Express Shipment'}
          </h2>

          <p className={`text-xs md:text-sm font-light leading-relaxed ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>
            {isBn
              ? 'মাস্টার ট্র্যাকিং আইডি (Master Tracking ID), সিটিএন নাম্বার (CTN No) অথবা শিপিং মার্ক দিয়ে আপনার প্রোডাক্টের বর্তমান অবস্থান জানুন।'
              : 'Enter your Master Tracking Number, CTN Code, or Shipping Mark to view real-time location and status.'}
          </p>
        </div>

        {/* Search Bar Card (Full Width responsive) */}
        <form
          onSubmit={handleSearchSubmit}
          className={`w-full max-w-4xl mx-auto p-2.5 sm:p-4 rounded-3xl border-2 shadow-2xl transition-all ${
            isDark
              ? 'bg-[#0E1726]/90 border-[#00897B]/40 shadow-[#00897B]/10'
              : 'bg-white border-[#00897B]/40 shadow-slate-200/80'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-5 h-5 text-[#00897B] absolute left-4 top-3.5" />
              <input
                type="text"
                required
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isBn ? 'ট্র্যাকিং আইডি দিন (যেমন: EXP-994801, CTN-01, SM-DHAKA-88...)' : 'Type Tracking ID (e.g. EXP-994801, CTN-01, SM-DHAKA-88...)'}
                className={`w-full rounded-2xl py-3 pl-12 pr-4 text-xs md:text-sm outline-none transition-all font-mono font-medium ${
                  isDark
                    ? 'bg-[#080E17] border border-slate-700 text-white placeholder-slate-500 focus:border-[#00897B]'
                    : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#00897B]'
                }`}
              />
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto py-3.5 px-8 bg-gradient-to-r from-[#00897B] to-[#1FB6A8] hover:from-[#1FB6A8] hover:to-[#00796B] text-white font-bold text-xs rounded-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2 shrink-0 transform active:scale-98"
            >
              <Search className="w-4 h-4" />
              <span>{isBn ? 'ট্র্যাক করুন' : 'Track Shipment'}</span>
            </button>
          </div>
        </form>

        {/* Tracking Search Results Section */}
        {searched && (
          <div className="w-full space-y-6 animate-in fade-in zoom-in-95 duration-300 pt-4">
            {matchedCartons.length > 0 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-700/40 pb-2">
                  <h3 className={`text-sm font-bold font-mono ${isDark ? 'text-[#00897B]' : 'text-[#00897B]'}`}>
                    {isBn ? `মোট ${matchedCartons.length}টি কার্টুন ডাটা পাওয়া গেছে` : `Found ${matchedCartons.length} Carton Records`}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">Query: {searchQuery}</span>
                </div>

                {/* Shipment Location Breakdown Summary Box */}
                {(() => {
                  const bookedCount = matchedCartons.filter((c) => c.status === 'booked' || c.status === 'proposed').length;
                  const transitCount = matchedCartons.filter((c) => c.status === 'in_transit').length;
                  const receivedCount = matchedCartons.filter((c) => c.status === 'received').length;
                  const deliveredCount = matchedCartons.filter((c) => c.status === 'delivered').length;

                  return (
                    <div className={`w-full rounded-3xl p-5 sm:p-6 border-2 shadow-xl backdrop-blur-md transition-all ${
                      isDark
                        ? 'bg-[#1E293B]/90 border-[#00897B]/40 text-white'
                        : 'bg-white border-[#00897B]/30 text-slate-900 shadow-teal-500/5'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-700/30 pb-3 mb-4 gap-2">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-2 rounded-xl bg-[#00897B]/15 text-[#00897B]">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black uppercase font-poppins tracking-wider flex items-center space-x-2">
                              <span>{isBn ? 'শিপমেন্টের বর্তমান অবস্থান ওভারভিউ' : 'Shipment Location Overview'}</span>
                            </h4>
                            <p className="text-[11px] text-slate-400">
                              {isBn ? `একনজরে কার্টুনগুলোর বর্তমান অবস্থান এর বিবরণ` : `Location breakdown summary of all searched cartons`}
                            </p>
                          </div>
                        </div>

                        <div className="px-3.5 py-1 rounded-full bg-[#00897B]/10 text-[#00897B] border border-[#00897B]/30 text-xs font-mono font-bold self-start sm:self-auto">
                          {isBn ? `মোট সার্চড কার্টুন: ${matchedCartons.length} টি` : `Total Cartons: ${matchedCartons.length}`}
                        </div>
                      </div>

                      {/* 4 Location Breakdown Badges */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                        {/* 1. Guangzhou Hub (Booked) */}
                        <div className={`p-4 rounded-2xl border transition-all flex items-center space-x-3 ${
                          bookedCount > 0
                            ? isDark ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-900'
                            : isDark ? 'bg-slate-800/40 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                            bookedCount > 0 ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-700/40 text-slate-400'
                          }`}>
                            <Box className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                              {isBn ? 'গুয়াংজু হাব (চীন)' : 'Guangzhou Hub'}
                            </div>
                            <div className="text-lg font-black font-mono">
                              {bookedCount} <span className="text-xs font-normal">{isBn ? 'টি' : 'CTNs'}</span>
                            </div>
                          </div>
                        </div>

                        {/* 2. In-Transit (Flying) */}
                        <div className={`p-4 rounded-2xl border transition-all flex items-center space-x-3 ${
                          transitCount > 0
                            ? isDark ? 'bg-blue-500/10 border-blue-500/40 text-blue-300' : 'bg-blue-50 border-blue-300 text-blue-900'
                            : isDark ? 'bg-slate-800/40 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                            transitCount > 0 ? 'bg-blue-500 text-white shadow-md animate-pulse' : 'bg-slate-700/40 text-slate-400'
                          }`}>
                            <Plane className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                              {isBn ? 'ফ্লাইটে (ইন-ট্রানজিট)' : 'In-Transit (Flying)'}
                            </div>
                            <div className="text-lg font-black font-mono">
                              {transitCount} <span className="text-xs font-normal">{isBn ? 'টি' : 'CTNs'}</span>
                            </div>
                          </div>
                        </div>

                        {/* 3. Dhaka Hub (Received) */}
                        <div className={`p-4 rounded-2xl border transition-all flex items-center space-x-3 ${
                          receivedCount > 0
                            ? isDark ? 'bg-teal-500/10 border-teal-500/40 text-teal-300' : 'bg-teal-50 border-teal-300 text-teal-900'
                            : isDark ? 'bg-slate-800/40 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                            receivedCount > 0 ? 'bg-[#00897B] text-white shadow-md' : 'bg-slate-700/40 text-slate-400'
                          }`}>
                            <MapPin className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                              {isBn ? 'ঢাকা হাব (রিসিভড)' : 'Dhaka Hub'}
                            </div>
                            <div className="text-lg font-black font-mono">
                              {receivedCount} <span className="text-xs font-normal">{isBn ? 'টি' : 'CTNs'}</span>
                            </div>
                          </div>
                        </div>

                        {/* 4. Delivered */}
                        <div className={`p-4 rounded-2xl border transition-all flex items-center space-x-3 ${
                          deliveredCount > 0
                            ? isDark ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : isDark ? 'bg-slate-800/40 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                            deliveredCount > 0 ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-700/40 text-slate-400'
                          }`}>
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                              {isBn ? 'ডেলিভারি সম্পন্ন' : 'Delivered'}
                            </div>
                            <div className="text-lg font-black font-mono">
                              {deliveredCount} <span className="text-xs font-normal">{isBn ? 'টি' : 'CTNs'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 gap-6">
                  {matchedCartons.map((carton) => {
                    const stage = getStatusStage(carton.status);

                    return (
                      <div
                        key={carton.id}
                        className={`w-full rounded-3xl p-6 sm:p-8 border-2 shadow-xl space-y-8 transition-all ${
                          isDark
                            ? 'bg-[#0E1726] border-slate-700 text-white'
                            : 'bg-white border-slate-200 text-slate-900 shadow-slate-200/60'
                        }`}
                      >
                        {/* Header Details: CTN, Mark & Master Tracking */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/30 pb-5">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-3">
                              <span className="text-xl sm:text-2xl font-black font-mono text-[#00897B]">
                                {carton.ctn_no}
                              </span>
                              <span className="px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-mono font-bold rounded-full">
                                {carton.shipping_mark}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono">
                              Master Tracking: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{carton.master_tracking_number || carton.tracking_number}</strong>
                              {carton.packaging_number && <span className="ml-3">Shipment Ctn NO.: {carton.packaging_number}</span>}
                            </p>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className={`px-4 py-1.5 rounded-full text-xs font-extrabold uppercase font-mono tracking-wider ${
                              carton.status === 'booked'
                                ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
                                : carton.status === 'in_transit'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                : carton.status === 'received'
                                ? 'bg-[#00897B]/20 text-[#00897B] border border-[#00897B]/40'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            }`}>
                              {carton.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        {/* Full-Width 4-Stage Progress Timeline */}
                        <div className="py-4">
                          <div className="grid grid-cols-4 gap-2 relative">
                            {/* Connector Line */}
                            <div className="absolute top-5 left-[12%] right-[12%] h-1.5 bg-slate-700/40 -z-0 rounded-full" />
                            <div
                              className="absolute top-5 left-[12%] h-1.5 bg-gradient-to-r from-[#00897B] to-[#1FB6A8] transition-all duration-500 -z-0 rounded-full"
                              style={{ width: `${((stage - 1) / 3) * 76}%` }}
                            />

                            {/* Stage 1: Booked */}
                            <div className="flex flex-col items-center text-center space-y-2 z-10">
                              <div
                                className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                                  stage >= 1
                                    ? 'bg-[#00897B] text-white shadow-lg shadow-[#00897B]/40 ring-4 ring-[#00897B]/20'
                                    : isDark ? 'bg-[#080E17] text-slate-500 border border-slate-700' : 'bg-slate-100 text-slate-400 border border-slate-300'
                                }`}
                              >
                                <Box className="w-5 h-5" />
                              </div>
                              <div>
                                <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{isBn ? 'বুকিং সম্পন্ন' : 'Booked'}</div>
                                <div className="text-[10px] text-slate-400">Guangzhou Hub</div>
                              </div>
                            </div>

                            {/* Stage 2: Flight Transit */}
                            <div className="flex flex-col items-center text-center space-y-2 z-10">
                              <div
                                className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                                  stage >= 2
                                    ? 'bg-[#00897B] text-white shadow-lg shadow-[#00897B]/40 ring-4 ring-[#00897B]/20'
                                    : isDark ? 'bg-[#080E17] text-slate-500 border border-slate-700' : 'bg-slate-100 text-slate-400 border border-slate-300'
                                }`}
                              >
                                <Plane className="w-5 h-5" />
                              </div>
                              <div>
                                <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{isBn ? 'ফ্লাইট ট্রানজিট' : 'In Transit'}</div>
                                {carton.flying_date && (
                                  <div className="text-[10px] text-amber-400 font-mono">Flight: {carton.flying_date}</div>
                                )}
                              </div>
                            </div>

                            {/* Stage 3: Arrived Hub */}
                            <div className="flex flex-col items-center text-center space-y-2 z-10">
                              <div
                                className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                                  stage >= 3
                                    ? 'bg-[#00897B] text-white shadow-lg shadow-[#00897B]/40 ring-4 ring-[#00897B]/20'
                                    : isDark ? 'bg-[#080E17] text-slate-500 border border-slate-700' : 'bg-slate-100 text-slate-400 border border-slate-300'
                                }`}
                              >
                                <MapPin className="w-5 h-5" />
                              </div>
                              <div>
                                <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{isBn ? 'ঢাকা হাব চেক-ইন' : 'Arrived Hub'}</div>
                                <div className="text-[10px] text-slate-400">Dhaka Central Hub</div>
                              </div>
                            </div>

                            {/* Stage 4: Delivered */}
                            <div className="flex flex-col items-center text-center space-y-2 z-10">
                              <div
                                className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                                  stage >= 4
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 ring-4 ring-emerald-500/20'
                                    : isDark ? 'bg-[#080E17] text-slate-500 border border-slate-700' : 'bg-slate-100 text-slate-400 border border-slate-300'
                                }`}
                              >
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                              <div>
                                <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{isBn ? 'ডেলিভার্ড' : 'Delivered'}</div>
                                <div className="text-[10px] text-slate-400">Handed Over</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Non-Sensitive Specifications Grid */}
                        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl text-xs border ${
                          isDark ? 'bg-[#080E17] border-slate-700' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div>
                            <span className="text-slate-400 block text-[11px] uppercase font-bold">{isBn ? 'পণ্য (Product)' : 'Product Name'}</span>
                            <strong className={`font-bold block truncate mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {carton.product_name_en}
                            </strong>
                            {carton.product_name_cn && (
                              <span className="text-[10px] text-slate-400 block truncate">{carton.product_name_cn}</span>
                            )}
                          </div>

                          <div>
                            <span className="text-slate-400 block text-[11px] uppercase font-bold">{isBn ? 'পরিমাণ ও গ্রস ওজন' : 'Quantity & Weight'}</span>
                            <strong className={`font-mono block mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {carton.quantity} PCS | {carton.gross_weight} KG
                            </strong>
                          </div>

                          <div>
                            <span className="text-slate-400 block text-[11px] uppercase font-bold">{isBn ? 'অরিজিন হাব' : 'Origin Hub'}</span>
                            <strong className={`block mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {carton.current_warehouse_name || 'Guangzhou Hub (China)'}
                            </strong>
                          </div>

                          <div>
                            <span className="text-slate-400 block text-[11px] uppercase font-bold">{isBn ? 'গন্তব্য হাব' : 'Destination Hub'}</span>
                            <strong className="text-[#00897B] block mt-0.5">
                              {carton.destination_warehouse_name || 'Dhaka Central Hub (BD)'}
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Graceful Not Found State */
              <div className={`w-full rounded-3xl p-12 text-center space-y-4 border ${
                isDark ? 'bg-[#0E1726] border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
              }`}>
                <Package className="w-12 h-12 text-slate-400 mx-auto opacity-40" />
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {isBn ? 'কোনো শিপমেন্ট ডাটা পাওয়া যায়নি' : 'No Active Shipment Found'}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {isBn
                    ? 'আপনার প্রদানকৃত নম্বরের সাথে কোনো রেকর্ড মেলেনি। সঠিক ট্র্যাকিং বা সিটিএন নম্বর দিয়ে আবার চেষ্টা করুন।'
                    : 'The reference code entered did not match any active cargo records. Please verify your tracking ID.'}
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer (Full Width) */}
      <footer className={`w-full text-center text-xs py-5 z-10 border-t ${
        isDark ? 'bg-[#080E17] border-slate-700 text-slate-500' : 'bg-white border-slate-200 text-slate-500'
      }`}>
        © 2026 M/S Four Star Cargo Express Tracking System — All Rights Reserved.
      </footer>

      {/* Floating Public Customer Live Support Chat Widget */}
      <PublicCustomerChatWidget language={language} />
    </div>
  );
};
