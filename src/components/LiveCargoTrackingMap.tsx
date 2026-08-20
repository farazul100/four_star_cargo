import React, { useState, useEffect, useMemo } from 'react';
import { Plane, RefreshCw, Layers, MapPin, CheckCircle2, PackageCheck, ArrowRight } from 'lucide-react';
import { Carton, FlyingProposal, Language, Theme } from '../types';
import { useTheme } from '../context/ThemeContext';

interface LiveCargoTrackingMapProps {
  cartons?: Carton[];
  proposals?: FlyingProposal[];
  language?: Language;
  theme?: Theme;
  onSelectCarton?: (carton: Carton) => void;
}

export const LiveCargoTrackingMap: React.FC<LiveCargoTrackingMapProps> = ({
  cartons = [],
  proposals = [],
  language = 'en',
  theme: themeProp,
  onSelectCarton,
}) => {
  const { theme: contextTheme } = useTheme();
  const activeTheme = contextTheme || themeProp || 'light';
  const isBn = language === 'bn';
  const isDark = activeTheme === 'dark';

  const [selectedFlightId, setSelectedFlightId] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [animProgress, setAnimProgress] = useState<number>(0.55); // 0 to 1 along flight arc

  // Map active database proposals
  const activeProposals = useMemo(() => {
    const safeProps = Array.isArray(proposals) ? proposals : [];
    return safeProps.filter((p) => p && p.status !== 'rejected');
  }, [proposals]);

  // Selected proposal or active flight default
  const currentProposal = useMemo(() => {
    if (selectedFlightId !== 'all') {
      const match = activeProposals.find((p) => p.id === selectedFlightId || p.flight_number === selectedFlightId);
      if (match) return match;
    }
    return activeProposals[0] || null;
  }, [selectedFlightId, activeProposals]);

  // Calculate live flight status based on system data
  const flightStatus = useMemo(() => {
    if (!currentProposal) return 'in_transit';
    const st = (currentProposal.status || '').toLowerCase();
    if (st === 'received' || st === 'delivered' || st === 'arrived') return 'received';
    if (st === 'dispatched' || st === 'in_transit') return 'in_transit';
    return 'proposed';
  }, [currentProposal]);

  // Animate plane along curve when in-transit
  useEffect(() => {
    if (flightStatus === 'proposed') {
      setAnimProgress(0.12); // At China hub
      return;
    }
    if (flightStatus === 'received') {
      setAnimProgress(0.88); // Landed at DAC Hub
      return;
    }

    // Flying in mid-air
    const interval = setInterval(() => {
      setAnimProgress((prev) => (prev >= 0.85 ? 0.15 : prev + 0.006));
    }, 80);

    return () => clearInterval(interval);
  }, [flightStatus]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 700);
  };

  // Coordinates mapped over the contained China-Bangladesh map graphic (1000x420)
  // China (Red region): x=240, y=170
  // Bangladesh (Green region): x=760, y=200
  // Arc control point: x=500, y=80
  const originPos = { x: 240, y: 170 };
  const destPos = { x: 760, y: 200 };
  const controlPos = { x: 500, y: 80 };

  // Calculate quadratic Bezier point at ratio t (0 <= t <= 1)
  const getBezierPoint = (t: number) => {
    const invT = 1 - t;
    const x = invT * invT * originPos.x + 2 * invT * t * controlPos.x + t * t * destPos.x;
    const y = invT * invT * originPos.y + 2 * invT * t * controlPos.y + t * t * destPos.y;

    // Calculate tangent angle for smooth plane rotation
    const dx = 2 * (1 - t) * (controlPos.x - originPos.x) + 2 * t * (destPos.x - controlPos.x);
    const dy = 2 * (1 - t) * (controlPos.y - originPos.y) + 2 * t * (destPos.y - controlPos.y);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    return { x, y, angle };
  };

  const planePos = getBezierPoint(animProgress);

  // Active step flow index (1 to 6) based on real flight status
  const currentStepIndex = useMemo(() => {
    if (flightStatus === 'proposed') return 2; // Warehouse
    if (flightStatus === 'received') return 5; // Customs Clearance / DAC Hub
    return 4; // Air Transit
  }, [flightStatus]);

  const totalWeight = currentProposal?.total_weight || 1280;
  const cartonsCount = currentProposal?.items_count || (currentProposal?.carton_ids || []).length || 45;
  const flightName = currentProposal?.flying_name || currentProposal?.flight_number || 'BS-206';
  const awb = currentProposal?.awb_number || '157-889120';

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-900 border-slate-800 text-white'} shadow-xl font-sans`}>
      {/* Compact Top Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="text-base md:text-lg font-black tracking-wider uppercase text-white">
              SHIPMENT VISUALIZATION
            </h2>
          </div>
          <p className="text-xs font-semibold text-slate-400">
            China To Bangladesh <span className="text-amber-400 font-bold uppercase tracking-wider">By Air</span>
          </p>
        </div>

        {/* Dynamic Flight Selector & Refresh */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeProposals.length > 0 && (
            <select
              value={selectedFlightId}
              onChange={(e) => setSelectedFlightId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="all">
                {isBn ? '✈️ প্রধান সক্রিয় এয়ার ফ্লাইট' : '✈️ Active Flight Batches'} ({activeProposals.length})
              </option>
              {activeProposals.map((p, idx) => (
                <option key={p.id || idx} value={p.id}>
                  {p.flying_name || p.flight_number || `Flight #${idx + 1}`} ({p.total_weight || 0}kg)
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleRefresh}
            className={`p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
            title={isBn ? 'রিফ্রেশ লাইভ ডাটা' : 'Refresh Live Radar'}
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Compact Main Map Container */}
      <div className="relative w-full h-[260px] sm:h-[300px] md:h-[340px] bg-[#f5f5f7] dark:bg-slate-950 overflow-hidden select-none flex items-center justify-center p-2">
        {/* Background Custom China-Bangladesh Route Graphic - Contained Comfortably */}
        <img
          src="/images/china_bd_map_bg.png"
          alt="China to Bangladesh Air Cargo Map"
          className="w-full h-full object-contain max-h-[320px] transition-all duration-300"
          onError={(e) => {
            (e.target as HTMLElement).style.opacity = '0.3';
          }}
        />

        {/* SVG Overlay for Dynamic Flight Arc, Pins, and Animated Plane */}
        <svg
          viewBox="0 0 1000 420"
          className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="flightArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>

            <filter id="arcGlow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* CURVED FLIGHT TRAJECTORY ARC */}
          <g filter="url(#arcGlow)">
            <path
              d={`M ${originPos.x} ${originPos.y} Q ${controlPos.x} ${controlPos.y} ${destPos.x} ${destPos.y}`}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="3.5"
              strokeDasharray="6 5"
              opacity="0.8"
            />
            <path
              d={`M ${originPos.x} ${originPos.y} Q ${controlPos.x} ${controlPos.y} ${destPos.x} ${destPos.y}`}
              fill="none"
              stroke="url(#flightArcGrad)"
              strokeWidth="2.5"
            />
          </g>

          {/* China Origin Pin Marker */}
          <g transform={`translate(${originPos.x}, ${originPos.y})`}>
            <circle r="12" fill="#EF4444" fillOpacity="0.35" className="animate-ping" />
            <circle r="8" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />
            <circle r="3" fill="#FFFFFF" />
          </g>

          {/* Bangladesh Destination Pin Marker */}
          <g transform={`translate(${destPos.x}, ${destPos.y})`}>
            <circle r="14" fill="#10B981" fillOpacity="0.35" className="animate-ping" />
            <circle r="9" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
            <circle r="3" fill="#FFFFFF" />
          </g>

          {/* ANIMATED AIRPLANE FLYING ALONG THE ARC */}
          <g transform={`translate(${planePos.x}, ${planePos.y}) rotate(${planePos.angle})`}>
            <g transform="scale(1.15)">
              <circle r="14" fill="#F59E0B" fillOpacity="0.25" className="animate-pulse" />
              <path
                d="M 0 -14 L 5 3 L 15 8 L 5 10 L 3 16 L 0 13 L -3 16 L -5 10 L -15 8 L -5 3 Z"
                fill="#0F172A"
                stroke="#F59E0B"
                strokeWidth="1.5"
              />
            </g>
          </g>
        </svg>

        {/* FLOATING DETAIL CARD 1: ORIGIN CHINA (Top Left Compact Overlay) */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-20 w-48 sm:w-56 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 shadow-lg text-white">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Origin
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded-full border border-red-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              China 🇨🇳
            </span>
          </div>

          <div className="mt-1.5">
            <div className="text-xs font-black text-white flex items-center justify-between">
              <span>China Cargo Hub</span>
              <span className="text-[10px] font-semibold text-slate-400">CAN / PVG</span>
            </div>
            <p className="text-[10px] font-medium text-slate-300 mt-0.5">
              Airport: <span className="text-amber-400 font-bold">Guangzhou / PVG</span>
            </p>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-300">
            <div>
              <span className="text-slate-400 block text-[9px]">Flight:</span>
              <span className="font-bold text-white">#{flightName}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[9px]">Cargo:</span>
              <span className="font-bold text-amber-400">{cartonsCount} CTNs ({totalWeight}kg)</span>
            </div>
          </div>
        </div>

        {/* FLOATING DETAIL CARD 2: DESTINATION BANGLADESH (Top Right Compact Overlay) */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 w-48 sm:w-56 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-2.5 shadow-lg text-white">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Destination
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Bangladesh 🇧🇩
            </span>
          </div>

          <div className="mt-1.5">
            <div className="text-xs font-black text-white flex items-center justify-between">
              <span>Bangladesh Hub</span>
              <span className="text-[10px] font-semibold text-emerald-400">DAC</span>
            </div>
            <p className="text-[10px] font-medium text-slate-300 mt-0.5">
              Airport: <span className="text-emerald-400 font-bold">Shahjalal Intl. (DAC)</span>
            </p>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-300">
            <div>
              <span className="text-slate-400 block text-[9px]">Status:</span>
              <span className={`font-bold capitalize ${flightStatus === 'received' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {flightStatus === 'received' ? '✅ Landed at DAC' : '✈️ In-Transit'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[9px]">AWB:</span>
              <span className="font-bold text-slate-200">{awb}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: SHIPMENT FLOW BY AIR (Compact 6-Step Flow Bar) */}
      <div className="p-4 md:p-5 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md">
        <div className="text-center mb-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            SHIPMENT FLOW BY AIR
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 md:gap-3 relative">
          {/* Step 1: Pickup */}
          <div className={`flex flex-col items-center text-center p-2 rounded-xl border transition-all ${currentStepIndex >= 1 ? 'bg-amber-950/30 border-amber-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 border ${currentStepIndex >= 1 ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <MapPin className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold block text-white">1. Pickup</span>
            <span className="text-[9px] text-slate-400 leading-tight mt-0.5">Supplier picks up in China</span>
          </div>

          {/* Step 2: Warehouse */}
          <div className={`flex flex-col items-center text-center p-2 rounded-xl border transition-all ${currentStepIndex >= 2 ? 'bg-amber-950/30 border-amber-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 border ${currentStepIndex >= 2 ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <PackageCheck className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold block text-white">2. Warehouse</span>
            <span className="text-[9px] text-slate-400 leading-tight mt-0.5">China Warehouse received</span>
          </div>

          {/* Step 3: Documentation */}
          <div className={`flex flex-col items-center text-center p-2 rounded-xl border transition-all ${currentStepIndex >= 3 ? 'bg-amber-950/30 border-amber-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 border ${currentStepIndex >= 3 ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold block text-white">3. Documentation</span>
            <span className="text-[9px] text-slate-400 leading-tight mt-0.5">Export customs cleared</span>
          </div>

          {/* Step 4: Air Transit */}
          <div className={`flex flex-col items-center text-center p-2 rounded-xl border transition-all ${currentStepIndex >= 4 ? 'bg-amber-950/30 border-amber-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 border ${currentStepIndex >= 4 ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 animate-pulse' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <Plane className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold block text-white">4. Air Transit</span>
            <span className="text-[9px] text-slate-400 leading-tight mt-0.5">Shipment in transit by air</span>
          </div>

          {/* Step 5: Customs Clearance */}
          <div className={`flex flex-col items-center text-center p-2 rounded-xl border transition-all ${currentStepIndex >= 5 ? 'bg-emerald-950/30 border-emerald-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 border ${currentStepIndex >= 5 ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold block text-white">5. Customs Clearance</span>
            <span className="text-[9px] text-slate-400 leading-tight mt-0.5">Import cleared in BD</span>
          </div>

          {/* Step 6: Final Delivery */}
          <div className={`flex flex-col items-center text-center p-2 rounded-xl border transition-all ${currentStepIndex >= 6 ? 'bg-emerald-950/30 border-emerald-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 border ${currentStepIndex >= 6 ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <ArrowRight className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold block text-white">6. Final Delivery</span>
            <span className="text-[9px] text-slate-400 leading-tight mt-0.5">Delivered to doorstep</span>
          </div>
        </div>
      </div>
    </div>
  );
};
