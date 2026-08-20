import React, { useState, useEffect, useMemo } from 'react';
import { Plane, RefreshCw, Layers, MapPin, CheckCircle2, PackageCheck, ArrowRight } from 'lucide-react';
import { Carton, FlyingProposal, Language, Theme } from '../types';
import { useTheme } from '../context/ThemeContext';
import { CARGO_PLANE_BASE64 } from './cargoPlaneData';

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

  // Exact 1-to-1 pixel-locked coordinates on 1024x682 satellite_china_bd_map.png
  // China Red Pin on map: x=785, y=305
  // Bangladesh Green Pin on map: x=264, y=321
  // Bezier Arc Control Point (Arcing gracefully over Asia): x=525, y=140
  const originPos = { x: 785, y: 305 };
  const destPos = { x: 264, y: 321 };
  const controlPos = { x: 525, y: 140 };

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
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="text-lg md:text-xl font-black tracking-wider uppercase text-white">
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

      {/* Main Map Container locked to exact 1024/682 aspect ratio */}
      <div className="relative w-full aspect-[1024/682] min-h-[360px] md:min-h-[460px] bg-[#071526] overflow-hidden select-none flex items-center justify-center">
        {/* User's Exact Satellite Map Background Image */}
        <img
          src="/images/satellite_china_bd_map.png"
          alt="Satellite China to Bangladesh Air Cargo Map"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* SVG Overlay for Dynamic Flight Arc, Pins, and Animated Plane */}
        <svg
          viewBox="0 0 1024 682"
          className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="flightArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>

            <filter id="arcGlow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* CURVED FLIGHT TRAJECTORY ARC (China -> Bangladesh Directly Over Pins) */}
          <g filter="url(#arcGlow)">
            <path
              d={`M ${originPos.x} ${originPos.y} Q ${controlPos.x} ${controlPos.y} ${destPos.x} ${destPos.y}`}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="5"
              strokeDasharray="9 7"
              opacity="0.9"
            />
            <path
              d={`M ${originPos.x} ${originPos.y} Q ${controlPos.x} ${controlPos.y} ${destPos.x} ${destPos.y}`}
              fill="none"
              stroke="url(#flightArcGrad)"
              strokeWidth="3.5"
            />
          </g>

          {/* China Origin Pulse Marker (Directly over China Red Pin at 785, 305) */}
          <g transform={`translate(${originPos.x}, ${originPos.y})`}>
            <circle r="16" fill="#EF4444" fillOpacity="0.4" className="animate-ping" />
            <circle r="10" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2.5" />
            <circle r="4" fill="#FFFFFF" />
          </g>

          {/* Bangladesh Destination Pulse Marker (Directly over BD Green Pin at 264, 321) */}
          <g transform={`translate(${destPos.x}, ${destPos.y})`}>
            <circle r="18" fill="#10B981" fillOpacity="0.4" className="animate-ping" />
            <circle r="11" fill="#10B981" stroke="#FFFFFF" strokeWidth="2.5" />
            <circle r="4.5" fill="#FFFFFF" />
          </g>

          {/* ANIMATED AIRPLANE FLYING ALONG THE ARC (User's HD Transparent PNG Airplane + Glowing Aura) */}
          <g transform={`translate(${planePos.x}, ${planePos.y}) rotate(${planePos.angle + 180})`}>
            {/* Glowing Amber Pulse Aura */}
            <circle r="36" fill="#F59E0B" fillOpacity="0.3" className="animate-pulse" />
            <circle r="22" fill="#F59E0B" fillOpacity="0.5" />

            {/* Embedded High-Res Transparent Cutout Airplane PNG Image */}
            <image
              href={CARGO_PLANE_BASE64}
              xlinkHref={CARGO_PLANE_BASE64}
              x="-55"
              y="-19"
              width="110"
              height="38"
            />
          </g>
        </svg>

        {/* FLOATING DETAIL CARD 1: ORIGIN CHINA (Top Right Overlay) */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 w-56 sm:w-64 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl text-white">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Origin
            </span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded-full border border-red-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              China 🇨🇳
            </span>
          </div>

          <div className="mt-2">
            <div className="text-sm font-black text-white flex items-center justify-between">
              <span>China Cargo Hub</span>
              <span className="text-[11px] font-semibold text-slate-400">CAN / PVG</span>
            </div>
            <p className="text-[11px] font-medium text-slate-300 mt-0.5">
              Airport: <span className="text-amber-400 font-bold">Guangzhou / Shanghai PVG</span>
            </p>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300">
            <div>
              <span className="text-slate-400 block text-[9px]">Flight No:</span>
              <span className="font-bold text-white">#{flightName}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[9px]">Total Cargo:</span>
              <span className="font-bold text-amber-400">{cartonsCount} CTNs ({totalWeight}kg)</span>
            </div>
          </div>
        </div>

        {/* FLOATING DETAIL CARD 2: DESTINATION BANGLADESH (Top Left Overlay) */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 w-56 sm:w-64 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl text-white">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Destination
            </span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Bangladesh 🇧🇩
            </span>
          </div>

          <div className="mt-2">
            <div className="text-sm font-black text-white flex items-center justify-between">
              <span>Bangladesh Hub</span>
              <span className="text-[11px] font-semibold text-emerald-400">DAC</span>
            </div>
            <p className="text-[11px] font-medium text-slate-300 mt-0.5">
              Airport: <span className="text-emerald-400 font-bold">Hazrat Shahjalal Intl. (DAC)</span>
            </p>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300">
            <div>
              <span className="text-slate-400 block text-[9px]">Status:</span>
              <span className={`font-bold capitalize ${flightStatus === 'received' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {flightStatus === 'received' ? '✅ Landed at DAC' : '✈️ In-Transit Flying'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[9px]">AWB No:</span>
              <span className="font-bold text-slate-200">{awb}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: SHIPMENT FLOW BY AIR (6-Step Flow Bar) */}
      <div className="p-4 md:p-5 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md">
        <div className="text-center mb-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
            SHIPMENT FLOW BY AIR
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 md:gap-4 relative">
          {/* Step 1: Pickup */}
          <div className={`flex flex-col items-center text-center p-2.5 rounded-xl border transition-all ${currentStepIndex >= 1 ? 'bg-amber-950/30 border-amber-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-1.5 border ${currentStepIndex >= 1 ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <MapPin className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold block text-white">1. Pickup</span>
            <span className="text-[10px] text-slate-400 leading-tight mt-0.5">Supplier picks up in China</span>
          </div>

          {/* Step 2: Warehouse */}
          <div className={`flex flex-col items-center text-center p-2.5 rounded-xl border transition-all ${currentStepIndex >= 2 ? 'bg-amber-950/30 border-amber-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-1.5 border ${currentStepIndex >= 2 ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <PackageCheck className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold block text-white">2. Warehouse</span>
            <span className="text-[10px] text-slate-400 leading-tight mt-0.5">China Warehouse received</span>
          </div>

          {/* Step 3: Documentation */}
          <div className={`flex flex-col items-center text-center p-2.5 rounded-xl border transition-all ${currentStepIndex >= 3 ? 'bg-amber-950/30 border-amber-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-1.5 border ${currentStepIndex >= 3 ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold block text-white">3. Documentation</span>
            <span className="text-[10px] text-slate-400 leading-tight mt-0.5">Export customs cleared</span>
          </div>

          {/* Step 4: Air Transit */}
          <div className={`flex flex-col items-center text-center p-2.5 rounded-xl border transition-all ${currentStepIndex >= 4 ? 'bg-amber-950/30 border-amber-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-1.5 border ${currentStepIndex >= 4 ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 animate-pulse' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <Plane className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold block text-white">4. Air Transit</span>
            <span className="text-[10px] text-slate-400 leading-tight mt-0.5">Shipment in transit by air</span>
          </div>

          {/* Step 5: Customs Clearance */}
          <div className={`flex flex-col items-center text-center p-2.5 rounded-xl border transition-all ${currentStepIndex >= 5 ? 'bg-emerald-950/30 border-emerald-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-1.5 border ${currentStepIndex >= 5 ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold block text-white">5. Customs Clearance</span>
            <span className="text-[10px] text-slate-400 leading-tight mt-0.5">Import cleared in BD</span>
          </div>

          {/* Step 6: Final Delivery */}
          <div className={`flex flex-col items-center text-center p-2.5 rounded-xl border transition-all ${currentStepIndex >= 6 ? 'bg-emerald-950/30 border-emerald-500/50 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-400'}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-1.5 border ${currentStepIndex >= 6 ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <ArrowRight className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold block text-white">6. Final Delivery</span>
            <span className="text-[10px] text-slate-400 leading-tight mt-0.5">Delivered to doorstep</span>
          </div>
        </div>
      </div>
    </div>
  );
};
