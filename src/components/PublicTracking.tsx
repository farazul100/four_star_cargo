import React, { useState } from 'react';
import { Search, Package, Plane, CheckCircle2, Truck, ArrowLeft, Sun, Moon, Globe, Clock, ShieldCheck, MapPin } from 'lucide-react';
import { Carton, FlyingProposal, Language } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../context/ThemeContext';
import { Logo } from './Logo';
import { LiveCargoTrackingMap } from './LiveCargoTrackingMap';

interface PublicTrackingProps {
  cartons: Carton[];
  proposals?: FlyingProposal[];
  language: Language;
  onBackToPortal: () => void;
}

export const PublicTracking: React.FC<PublicTrackingProps> = ({
  cartons,
  proposals,
  language,
  onBackToPortal,
}) => {
  const { t, lang, setLang } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isBn = language === 'bn';

  const [searchQuery, setSearchQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [matchedCartons, setMatchedCartons] = useState<Carton[]>([]);

  /*
   * SECURITY BOUNDARY & PRIVACY GUARANTEE COMMENT (PRD Section 8.3):
   * This public endpoint strictly strips out sensitive data before rendering.
   * Exposed: status, ctn_no, tracking_number, product_name_en/cn, quantity, gross_weight, cbm, origin, destination, flying_date, status timeline.
   * REDACTED / NEVER EXPOSED: Pricing, ledger entries, customer dues, internal staff notes, booked_by user IDs, or unrelated cartons.
   */
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();

    if (!query) return;

    // Exact or near-exact search matching Tracking Number, CTN No, or Customer Code
    const results = cartons.filter((c) => {
      const matchTracking = c.tracking_number.toLowerCase() === query || c.tracking_number.toLowerCase().includes(query);
      const matchCtn = c.ctn_no.toLowerCase() === query || c.ctn_no.toLowerCase().includes(query);
      const matchShippingMark = c.shipping_mark.toLowerCase().includes(query);

      return matchTracking || matchCtn || matchShippingMark;
    });

    setMatchedCartons(results);
    setSearched(true);
  };

  const getStatusStage = (status: Carton['status']) => {
    switch (status) {
      case 'booked':
        return 1;
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

  const statusBadgeColors = {
    booked: 'bg-[#F5A623]/20 text-[#F5A623] border-[#F5A623]/30',
    proposed: 'bg-[#F5A623]/20 text-[#F5A623] border-[#F5A623]/30',
    in_transit: 'bg-[#1B4F91]/20 text-blue-400 border-[#1B4F91]/40',
    received: 'bg-[#1FB6A8]/20 text-[#1FB6A8] border-[#1FB6A8]/40',
    delivered: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };

  return (
    <div className="min-h-screen bg-[#0B1622] text-[#EAF2F5] flex flex-col justify-between p-4 md:p-8 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#1FB6A8]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between z-10 py-4 border-b border-[#1E3247]">
        <button
          onClick={onBackToPortal}
          className="flex items-center space-x-2 text-xs font-semibold text-[#8FA3AD] hover:text-[#1FB6A8] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isBn ? 'মূল পোর্টালে যান' : 'Back to Portal'}</span>
        </button>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#11202F] hover:bg-[#1E3247] text-xs font-semibold text-white border border-[#1E3247]"
          >
            <Globe className="w-3.5 h-3.5 text-[#1FB6A8]" />
            <span>{lang === 'bn' ? 'অ বাংলা' : '🇬🇧 English'}</span>
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-[#11202F] hover:bg-[#1E3247] text-white border border-[#1E3247]"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#1FB6A8]" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full z-10 my-8 space-y-8">
        {/* Brand & Search Title */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-2">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-white font-poppins">
            {isBn ? 'শিপমেন্ট ট্র্যাকিং পোর্টাল' : 'Public Cargo Tracking Portal'}
          </h1>
          <p className="text-xs md:text-sm text-[#8FA3AD] max-w-lg mx-auto">
            {isBn
              ? 'আপনার সিটিএন নম্বর (CTN No) বা ট্র্যাকিং নম্বর দিয়ে রিয়েল-টাইম গতিপথ দেখুন'
              : 'Enter your Tracking Number or CTN No to check current cargo flight status'}
          </p>
        </div>

        {/* Search Input Card */}
        <form
          onSubmit={handleSearchSubmit}
          className="bg-[#11202F] border border-[#1FB6A8]/30 rounded-3xl p-3 md:p-4 shadow-2xl flex flex-col sm:flex-row items-center gap-3"
        >
          <div className="relative flex-1 w-full">
            <Search className="w-5 h-5 text-[#8FA3AD] absolute left-4 top-3.5" />
            <input
              type="text"
              required
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? 'উদাহরণ: FSC-2026-8841 বা TRK9842...' : 'e.g. FSC-2026-8841 or TRK9842...'}
              className="w-full bg-[#0B1622] border border-[#1E3247] focus:border-[#1FB6A8] rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder-[#8FA3AD] outline-none transition-all font-mono"
            />
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto py-3.5 px-8 rounded-2xl bg-gradient-to-r from-[#1B4F91] to-[#1FB6A8] hover:from-[#1FB6A8] hover:to-[#22A6B3] text-white font-bold text-xs shadow-lg shadow-[#1FB6A8]/20 transition-all flex items-center justify-center space-x-2 shrink-0"
          >
            <Search className="w-4 h-4" />
            <span>{isBn ? 'ট্র্যাক করুন' : 'Track Shipment'}</span>
          </button>
        </form>

        {/* Live Satellite Air Cargo Route Tracking Map */}
        <div className="my-6">
          <LiveCargoTrackingMap cartons={cartons} proposals={proposals} language={language} theme="dark" />
        </div>

        {/* Tracking Results View */}
        {searched && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {matchedCartons.length > 0 ? (
              matchedCartons.map((carton) => {
                const stage = getStatusStage(carton.status);
                const badgeClass = statusBadgeColors[carton.status] || statusBadgeColors.booked;

                return (
                  <div
                    key={carton.id}
                    className="bg-[#11202F] border border-[#1E3247] rounded-3xl p-6 space-y-6 shadow-2xl"
                  >
                    {/* Header: CTN No & Status Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E3247] pb-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-bold font-mono text-white">{carton.ctn_no}</span>
                          <span className="text-xs text-[#1FB6A8] font-mono">({carton.shipping_mark})</span>
                        </div>
                        <div className="text-xs text-[#8FA3AD] font-mono mt-0.5">
                          Tracking: <strong className="text-white">{carton.tracking_number}</strong>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border uppercase ${badgeClass}`}
                        >
                          {carton.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Visual 4-Stage Timeline Progress Tracker */}
                    <div className="py-4">
                      <div className="grid grid-cols-4 gap-2 relative">
                        {/* Connecting Line */}
                        <div className="absolute top-4 left-[12%] right-[12%] h-1 bg-[#1E3247] -z-0" />
                        <div
                          className="absolute top-4 left-[12%] h-1 bg-[#1FB6A8] transition-all duration-500 -z-0"
                          style={{ width: `${((stage - 1) / 3) * 76}%` }}
                        />

                        {/* Stage 1: Booked */}
                        <div className="flex flex-col items-center text-center space-y-2 z-10">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                              stage >= 1
                                ? 'bg-[#1FB6A8] text-[#0F2D52] shadow-lg shadow-[#1FB6A8]/30'
                                : 'bg-[#0B1622] text-[#8FA3AD] border border-[#1E3247]'
                            }`}
                          >
                            1
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{isBn ? 'বুকড' : 'Booked'}</div>
                            <div className="text-[10px] text-[#8FA3AD]">Origin Hub</div>
                          </div>
                        </div>

                        {/* Stage 2: Flying (In Transit) */}
                        <div className="flex flex-col items-center text-center space-y-2 z-10">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                              stage >= 2
                                ? 'bg-[#1FB6A8] text-[#0F2D52] shadow-lg shadow-[#1FB6A8]/30'
                                : 'bg-[#0B1622] text-[#8FA3AD] border border-[#1E3247]'
                            }`}
                          >
                            <Plane className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{isBn ? 'ইন-ট্রানজিট' : 'In Transit'}</div>
                            {carton.flying_date && (
                              <div className="text-[10px] text-amber-400 font-mono">Flight: {carton.flying_date}</div>
                            )}
                          </div>
                        </div>

                        {/* Stage 3: Received */}
                        <div className="flex flex-col items-center text-center space-y-2 z-10">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                              stage >= 3
                                ? 'bg-[#1FB6A8] text-[#0F2D52] shadow-lg shadow-[#1FB6A8]/30'
                                : 'bg-[#0B1622] text-[#8FA3AD] border border-[#1E3247]'
                            }`}
                          >
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{isBn ? 'রিসিভড' : 'Arrived Hub'}</div>
                            <div className="text-[10px] text-[#8FA3AD]">Destination</div>
                          </div>
                        </div>

                        {/* Stage 4: Delivered */}
                        <div className="flex flex-col items-center text-center space-y-2 z-10">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                              stage >= 4
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                : 'bg-[#0B1622] text-[#8FA3AD] border border-[#1E3247]'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{isBn ? 'ডেলিভার্ড' : 'Delivered'}</div>
                            <div className="text-[10px] text-[#8FA3AD]">Handed Off</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Non-Sensitive Operational Details */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-[#0B1622] text-xs">
                      <div>
                        <span className="text-[#8FA3AD] block">{isBn ? 'পণ্য' : 'Product'}</span>
                        <strong className="text-white font-medium block truncate">{carton.product_name_en}</strong>
                        {carton.product_name_cn && (
                          <span className="text-[10px] text-[#8FA3AD] block truncate font-sans">{carton.product_name_cn}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[#8FA3AD] block">{isBn ? 'পরিমাণ ও ওজন' : 'Qty & Weight'}</span>
                        <strong className="text-white font-mono">{carton.quantity} Pcs | {carton.gross_weight} kg</strong>
                      </div>

                      <div>
                        <span className="text-[#8FA3AD] block">{isBn ? 'অরিজিন হাব' : 'Origin Hub'}</span>
                        <strong className="text-white">{carton.current_warehouse_name || 'Guangzhou'}</strong>
                      </div>

                      <div>
                        <span className="text-[#8FA3AD] block">{isBn ? 'গন্তব্য হাব' : 'Destination Hub'}</span>
                        <strong className="text-emerald-400">{carton.destination_warehouse_name || 'Dhaka Hub'}</strong>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              /* Graceful Not Found State (No enumeration leaks) */
              <div className="bg-[#11202F] border border-[#1E3247] rounded-3xl p-10 text-center space-y-3">
                <Package className="w-10 h-10 text-[#8FA3AD] mx-auto opacity-40" />
                <h3 className="text-base font-bold text-white">
                  {isBn ? 'কোন শিপমেন্ট ডাটা পাওয়া যায়নি' : 'No Shipment Found'}
                </h3>
                <p className="text-xs text-[#8FA3AD] max-w-md mx-auto">
                  {isBn
                    ? 'আপনার প্রদানকৃত ট্র্যাকিং নম্বর বা সিটিএন নম্বরটির সাথে কোন তথ্য মেলেনি। সঠিক নম্বর দিয়ে পুনরায় চেষ্টা করুন।'
                    : 'The entered reference number did not match any active cargo record. Please verify your tracking number.'}
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center text-xs text-[#8FA3AD] py-4 z-10 border-t border-[#1E3247]">
        M/S Four Star Cargo Tracking System — Powered by Hostinger VPS
      </footer>
    </div>
  );
};
