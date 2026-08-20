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
      setAnimProgress(0.08); // At China hub
      return;
    }
    if (flightStatus === 'received') {
      setAnimProgress(0.92); // Landed at DAC Hub
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

  // Coordinates on 1000x520 World Satellite Map View
  // China (Guangzhou / Shanghai): x=780, y=230
  // Bangladesh (Dhaka DAC): x=280, y=310
  // Curve control point: x=510, y=120
  const originPos = { x: 780, y: 230 };
  const destPos = { x: 280, y: 310 };
  const controlPos = { x: 510, y: 120 };

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
    <div className={`relative overflow-hidden rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-900 border-slate-800 text-white'} shadow-2xl font-sans`}>
      {/* Top Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 md:p-6 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="text-xl md:text-2xl font-black tracking-wider uppercase text-white">
              SHIPMENT VISUALIZATION
            </h2>
          </div>
          <p className="text-xs md:text-sm font-semibold text-slate-400 mt-0.5">
            China To Bangladesh <span className="text-amber-400 font-bold uppercase tracking-wider">By Air</span>
          </p>
        </div>

        {/* Dynamic Flight Selector & System Badge */}
        <div className="flex flex-wrap items-center gap-3">
          {activeProposals.length > 0 && (
            <select
              value={selectedFlightId}
              onChange={(e) => setSelectedFlightId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs md:text-sm font-medium text-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
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
            className={`p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
            title={isBn ? 'রিফ্রেশ লাইভ ডাটা' : 'Refresh Live Radar'}
          >
            <RefreshCw className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Main Map Container (Pure Satellite Map matching 1st screenshot exactly) */}
      <div className="relative w-full aspect-[16/9] min-h-[380px] md:min-h-[480px] bg-[#091526] overflow-hidden select-none">
        {/* World Satellite View Canvas SVG */}
        <svg
          viewBox="0 0 1000 520"
          className="w-full h-full object-cover"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="oceanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0B1A30" />
              <stop offset="50%" stopColor="#091526" />
              <stop offset="100%" stopColor="#050C18" />
            </linearGradient>

            <linearGradient id="flightArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>

            <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id="arcGlow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Ocean Base */}
          <rect width="1000" height="520" fill="url(#oceanGrad)" />

          {/* Grid Gridlines (Subtle Satellite Coordinate Lines) */}
          <g opacity="0.12" stroke="#38BDF8" strokeWidth="0.5" strokeDasharray="4 6">
            <line x1="0" y1="130" x2="1000" y2="130" />
            <line x1="0" y1="260" x2="1000" y2="260" />
            <line x1="0" y1="390" x2="1000" y2="390" />
            <line x1="250" y1="0" x2="250" y2="520" />
            <line x1="500" y1="0" x2="500" y2="520" />
            <line x1="750" y1="0" x2="750" y2="520" />
          </g>

          {/* World Continents Rough SVG Paths */}
          <g fill="#1E293B" stroke="#334155" strokeWidth="0.8" opacity="0.65">
            {/* Africa */}
            <path d="M 120 220 Q 150 250 170 320 Q 150 380 120 420 Q 90 350 70 280 Z" />
            {/* Europe */}
            <path d="M 100 80 Q 180 90 220 120 Q 160 140 100 80 Z" />
            {/* Middle East & Central Asia */}
            <path d="M 230 140 Q 340 120 440 150 Q 380 200 230 180 Z" stroke="#475569" />
            {/* India Subcontinent */}
            <path d="M 240 210 Q 300 220 320 290 Q 260 320 220 260 Z" fill="#1E293B" />
            {/* Southeast Asia */}
            <path d="M 720 270 Q 780 290 820 350 Q 740 370 700 300 Z" />
            {/* Russia / North Asia */}
            <path d="M 380 40 Q 700 30 920 60 Q 800 120 380 100 Z" opacity="0.4" />
          </g>

          {/* 🇨🇳 CHINA REGION HIGHLIGHT (Vibrant Red Overlay matching Screenshot 1) */}
          <g filter="url(#glowRed)">
            <path
              d="M 680 130 Q 780 120 890 160 Q 880 250 760 270 Q 720 210 680 130 Z"
              fill="#EF4444"
              fillOpacity="0.75"
              stroke="#F87171"
              strokeWidth="2"
            />
            <text x="785" y="185" fill="#FFFFFF" fontSize="22" fontWeight="900" textAnchor="middle" letterSpacing="2">
              CHINA
            </text>
          </g>

          {/* 🇧🇩 BANGLADESH REGION HIGHLIGHT (Vibrant Green Overlay matching Screenshot 1) */}
          <g filter="url(#glowGreen)">
            <path
              d="M 265 285 Q 295 275 305 315 Q 285 335 260 320 Z"
              fill="#10B981"
              fillOpacity="0.85"
              stroke="#34D399"
              strokeWidth="2.5"
            />
            <text x="275" y="260" fill="#FFFFFF" fontSize="16" fontWeight="900" textAnchor="middle" letterSpacing="1.5">
              BANGLADESH
            </text>
          </g>

          {/* CURVED FLIGHT TRAJECTORY ARC */}
          <g filter="url(#arcGlow)">
            <path
              d={`M ${originPos.x} ${originPos.y} Q ${controlPos.x} ${controlPos.y} ${destPos.x} ${destPos.y}`}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="4"
              strokeDasharray="8 6"
              opacity="0.8"
            />
            <path
              d={`M ${originPos.x} ${originPos.y} Q ${controlPos.x} ${controlPos.y} ${destPos.x} ${destPos.y}`}
              fill="none"
              stroke="url(#flightArcGrad)"
              strokeWidth="3"
            />
          </g>

          {/* China Origin Pin Marker */}
          <g transform={`translate(${originPos.x}, ${originPos.y})`}>
            <circle r="16" fill="#EF4444" fillOpacity="0.3" className="animate-ping" />
            <circle r="10" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2.5" />
            <circle r="4" fill="#FFFFFF" />
          </g>

          {/* Bangladesh Destination Pin Marker */}
          <g transform={`translate(${destPos.x}, ${destPos.y})`}>
            <circle r="18" fill="#10B981" fillOpacity="0.3" className="animate-ping" />
            <circle r="11" fill="#10B981" stroke="#FFFFFF" strokeWidth="2.5" />
            <circle r="4.5" fill="#FFFFFF" />
          </g>

          {/* ANIMATED AIRPLANE FLYING ALONG THE ARC */}
          <g transform={`translate(${planePos.x}, ${planePos.y}) rotate(${planePos.angle + 180})`}>
            <g transform="translate(0, 12) scale(0.9)" opacity="0.3">
              <path
                d="M 0 -18 L 8 4 L 20 10 L 8 12 L 5 20 L 0 17 L -5 20 L -8 12 L -20 10 L -8 4 Z"
                fill="#000000"
              />
            </g>
            <g transform="scale(1.35)">
              <circle r="18" fill="#F59E0B" fillOpacity="0.25" className="animate-pulse" />
              <path
                d="M 0 -16 L 6 4 L 18 10 L 6 12 L 4 19 L 0 16 L -4 19 L -6 12 L -18 10 L -6 4 Z"
                fill="#FFFFFF"
                stroke="#D97706"
                strokeWidth="1.5"
              />
            </g>
          </g>
        </svg>

        {/* FLOATING DETAIL CARD 1: ORIGIN CHINA (Top Right matching Screenshot 1) */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6 w-64 md:w-72 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-white">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
              Origin
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded-full border border-red-800/60">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              China 🇨🇳
            </span>
          </div>

          <div className="mt-2.5">
            <div className="text-base font-black text-white flex items-center justify-between">
              <span>China Cargo Hub</span>
              <span className="text-xs font-semibold text-slate-400">CAN / PVG</span>
            </div>
            <p className="text-xs font-medium text-slate-300 mt-1">
              Departure Airport: <span className="text-amber-400 font-bold">Guangzhou / Shanghai PVG</span>
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
            <div>
              <span className="text-slate-400 block text-[10px]">Flight No:</span>
              <span className="font-bold text-white">#{flightName}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px]">Total Cargo:</span>
              <span className="font-bold text-amber-400">{cartonsCount} CTNs ({totalWeight}kg)</span>
            </div>
          </div>
        </div>

        {/* FLOATING DETAIL CARD 2: DESTINATION BANGLADESH (Bottom Left matching Screenshot 1) */}
        <div className="absolute bottom-6 left-4 md:bottom-8 md:left-6 w-64 md:w-72 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-white">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
              Destination
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Bangladesh 🇧🇩
            </span>
          </div>

          <div className="mt-2.5">
            <div className="text-base font-black text-white flex items-center justify-between">
              <span>Bangladesh Hub</span>
              <span className="text-xs font-semibold text-emerald-400">DAC</span>
            </div>
            <p className="text-xs font-medium text-slate-300 mt-1">
              Arrival Airport: <span className="text-emerald-400 font-bold">Hazrat Shahjalal Intl. (DAC)</span>
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
            <div>
              <span className="text-slate-400 block text-[10px]">Current Status:</span>
              <span className={`font-bold capitalize ${flightStatus === 'received' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {flightStatus === 'received' ? '✅ Landed & Received at DAC' : '✈️ In-Transit Flying'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px]">AWB No:</span>
              <span className="font-bold text-slate-200">{awb}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: SHIPMENT FLOW BY AIR (6-Step Flow Bar) */}
      <div className="p-5 md:p-6 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md">
        <div className="text-center mb-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
            SHIPMENT FLOW BY AIR
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 md:gap-4 relative">
          {/* Step 1: Pickup */}
          <div className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${currentStepIndex >= 1 ? 'bg-amber-950/30 border-amber-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border ${currentStepIndex >= 1 ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold block text-white">1. Pickup</span>
            <span className="text-[10px] text-slate-400 mt-1 leading-tight">Supplier picks up the goods in China</span>
          </div>

          {/* Step 2: Warehouse */}
          <div className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${currentStepIndex >= 2 ? 'bg-amber-950/30 border-amber-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border ${currentStepIndex >= 2 ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <PackageCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold block text-white">2. Warehouse</span>
            <span className="text-[10px] text-slate-400 mt-1 leading-tight">Goods received at China Warehouse</span>
          </div>

          {/* Step 3: Documentation */}
          <div className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${currentStepIndex >= 3 ? 'bg-amber-950/30 border-amber-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border ${currentStepIndex >= 3 ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold block text-white">3. Documentation</span>
            <span className="text-[10px] text-slate-400 mt-1 leading-tight">Export documentation & customs</span>
          </div>

          {/* Step 4: Air Transit */}
          <div className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${currentStepIndex >= 4 ? 'bg-amber-950/30 border-amber-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border ${currentStepIndex >= 4 ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 animate-pulse' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <Plane className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold block text-white">4. Air Transit</span>
            <span className="text-[10px] text-slate-400 mt-1 leading-tight">Shipment in transit by air</span>
          </div>

          {/* Step 5: Customs Clearance */}
          <div className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${currentStepIndex >= 5 ? 'bg-emerald-950/30 border-emerald-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border ${currentStepIndex >= 5 ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold block text-white">5. Customs Clearance</span>
            <span className="text-[10px] text-slate-400 mt-1 leading-tight">Import clearance in Bangladesh</span>
          </div>

          {/* Step 6: Final Delivery */}
          <div className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${currentStepIndex >= 6 ? 'bg-emerald-950/30 border-emerald-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border ${currentStepIndex >= 6 ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <ArrowRight className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold block text-white">6. Final Delivery</span>
            <span className="text-[10px] text-slate-400 mt-1 leading-tight">Delivered to doorstep in BD</span>
          </div>
        </div>
      </div>
    </div>
  );
};
