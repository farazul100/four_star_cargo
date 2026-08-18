import React, { useState, useEffect } from 'react';
import { Plane, Radio, Activity, RefreshCw, Compass, Check, ShieldCheck, ArrowRight, Layers } from 'lucide-react';
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

  const [selectedRoute, setSelectedRoute] = useState<string>('all');
  const [activeFlightPopup, setActiveFlightPopup] = useState<string>('BS-206');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Very gentle mid-air floating hover oscillation
  const [hoverPhase, setHoverPhase] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setHoverPhase((prev) => (prev + 0.08) % (Math.PI * 2));
    }, 150);
    return () => clearInterval(timer);
  }, []);

  const handleRefreshRadar = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

  // Derive real status from system database proposals & cartons props
  // Derive real status from system database proposals & cartons props
  const getSystemFlightStatus = (flightNo: string, originCode: string): 'in_transit' | 'received' | 'proposed' => {
    // 1. Match from real database proposals
    const matchProp = proposals.find(
      (p) =>
        p.id?.toLowerCase() === flightNo.toLowerCase() ||
        p.flight_number?.toLowerCase() === flightNo.toLowerCase() ||
        p.flying_name?.toLowerCase() === flightNo.toLowerCase() ||
        (p.flying_name && (p.flying_name.toLowerCase().includes(flightNo.toLowerCase()) || flightNo.toLowerCase().includes(p.flying_name.toLowerCase()))) ||
        (p.warehouse_name && p.warehouse_name.toLowerCase().includes(originCode.toLowerCase()))
    );

    if (matchProp) {
      const pStatus = matchProp.status as string;
      if (pStatus === 'received' || pStatus === 'delivered' || pStatus === 'arrived') {
        return 'received';
      }
      if (pStatus === 'dispatched' || pStatus === 'in_transit') {
        return 'in_transit';
      }
      // Pending or Approved (Before clicking Finish & Launch) = ON GROUND AT ORIGIN
      if (pStatus === 'proposed' || pStatus === 'pending' || pStatus === 'approved') {
        return 'proposed';
      }
    }

    // 2. Check cartons attached to flight
    const matchCartons = cartons.filter((c) => c.flight_number === flightNo);
    if (matchCartons.length > 0) {
      if (matchCartons.every((c) => c.status === 'received' || c.status === 'delivered')) {
        return 'received';
      }
      if (matchCartons.some((c) => c.status === 'in_transit')) {
        return 'in_transit';
      }
      if (matchCartons.some((c) => c.status === 'proposed' || c.status === 'booked')) {
        return 'proposed';
      }
    }

    // Default fallback: ON GROUND (Not flying until released by incharge)
    return 'proposed';
  };

  // SVG Coordinates for 800x360 Canvas:
  // Dhaka (DAC): x=380, y=210
  // Guangzhou (CAN): x=680, y=140
  // Hong Kong (HKG): x=710, y=175
  // Dubai (DXB): x=120, y=160

  // Dynamically map routes strictly based on active database proposals
  const activeProposals = React.useMemo(() => {
    const safeProps = Array.isArray(proposals) ? proposals : [];
    return safeProps.filter((p) => p && p.status !== 'rejected');
  }, [proposals]);

  const initialRoutes = React.useMemo(() => {
    if (activeProposals.length === 0) {
      return [];
    }

    return activeProposals.map((p, idx) => {
      const whName = (p.warehouse_name || '').toLowerCase();
      const isHongKong = whName.includes('hongkong') || whName.includes('hkg');
      const isDubai = whName.includes('dubai') || whName.includes('dxb') || whName.includes('uae');

      const originCoords = isHongKong
        ? { x: 710, y: 175 }
        : isDubai
        ? { x: 120, y: 160 }
        : { x: 680, y: 140 };

      const curveControl = isHongKong
        ? { x: 555, y: 145 }
        : isDubai
        ? { x: 250, y: 120 }
        : { x: 530, y: 100 };

      const color = isHongKong ? '#A855F7' : isDubai ? '#10B981' : '#3B82F6';

      // Extract exact flight batch name/number from proposal attributes
      const rawFlight = (p.flight_number || p.flying_name || p.id || `BS-0${idx + 1}`).trim();
      const flightNo = rawFlight.toUpperCase();

      return {
        id: p.id || `prop-${idx}`,
        name: `${p.warehouse_name || 'Guangzhou Hub'} 🇨🇳 ➔ ${p.destination_warehouse_name || (isBn ? 'বাংলাদেশ (ঢাকা)' : 'Bangladesh (DAC 🇧🇩)')}`,
        originName: p.warehouse_name || 'Guangzhou Hub',
        originCode: isHongKong ? 'HKG' : isDubai ? 'DXB' : 'CAN',
        flightNo,
        airline: p.airline || 'US-Bangla Air Cargo',
        awb: (p as any).awb || '157-889120',
        originCoords,
        destCoords: { x: 380, y: 210 },
        curveControl,
        midAirRatio: 0.58,
        weight: `${p.total_weight || 0} kg`,
        cartonsCount: p.items_count || (p.carton_ids || []).length,
        color,
      };
    });
  }, [activeProposals, isBn]);

  const routes = initialRoutes.map((r) => {
    const systemStatus = getSystemFlightStatus(r.flightNo, r.originCode);

    let progress = 0.0;
    let statusLabel = '';
    let altitude = '0 ft (Ground)';
    let speed = '0 km/h';
    let eta = isBn ? 'ফিনিশ ও ডেসপ্যাচ করলে উড্ডয়ন শুরু হবে' : 'Awaiting Incharge Release';

    if (systemStatus === 'received') {
      progress = 1.0;
      statusLabel = isBn ? '🛬 বাংলাদেশ ওয়্যারহাউজে প্রাপ্ত (Arrived BD)' : '🛬 Received at BD Warehouse';
      altitude = '0 ft (Landed at DAC)';
      speed = '0 km/h (Parked)';
      eta = isBn ? 'বাংলাদেশে পৌঁছেছে' : 'Landed in Bangladesh';
    } else if (systemStatus === 'proposed') {
      progress = 0.0;
      statusLabel = isBn
        ? '⏳ প্রস্তুত / ইনচার্জ ফিনিশ ও ডেসপ্যাচের অপেক্ষায় (Awaiting Release)'
        : '⏳ Origin Hub / Awaiting Incharge Release';
      altitude = '0 ft (On Ground)';
      speed = '0 km/h';
      eta = isBn ? 'ইনচার্জ ফিনিশ দিলে বিমান উড্ডয়ন করবে' : 'Launches when Incharge clicks Finish';
    } else {
      // systemStatus === 'in_transit' -> ACTIVE MID-AIR FLIGHT!
      const gentleFloat = Math.sin(hoverPhase + (r.id === 'hongkong' ? 1.5 : 0)) * 0.015;
      progress = Math.max(0.12, Math.min(0.88, r.midAirRatio + gentleFloat));
      statusLabel = isBn
        ? '✈️ আকাশে ফ্লাইটে চলমান (BD ইনচার্জ রিসিভ না করা পর্যন্ত আকাশে থাকবে)'
        : '✈️ Airborne Cruising (Mid-Air until BD Received)';
      altitude = '35,500 ft (Cruising)';
      speed = '850 km/h';
      eta = isBn ? 'বাংলাদেশ অভিমুখে অন-ফ্লাইট' : 'En-route to Bangladesh';
    }

    return {
      ...r,
      status: systemStatus,
      progress,
      statusLabel,
      altitude,
      speed,
      eta,
    };
  });

  const activeRouteObj = routes.find((r) => r.flightNo === activeFlightPopup) || routes[0];
  const isOriginOnLeft = activeRouteObj ? activeRouteObj.originCoords.x < 400 : false;
  const cardPositionClass = isOriginOnLeft ? 'bottom-3 right-3' : 'bottom-3 left-3';

  return (
    <div
      className={`border rounded-3xl overflow-hidden shadow-2xs transition-all ${
        isDark ? 'bg-[#0B132B] border-slate-800 text-white' : 'bg-slate-50 border-slate-200/90 text-slate-900'
      }`}
    >
      {/* Top Header Bar */}
      <div className={`p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isDark
          ? 'bg-[#0B132A] border-slate-800 text-white'
          : 'bg-white border-slate-200 text-slate-900 shadow-2xs'
      }`}>
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-medium text-slate-900 dark:text-white flex items-center space-x-2">
                <span>{isBn ? 'রুট-টু-রুট এয়ার কার্গো ফ্লাইট ট্র্যাকিং রাডার' : 'Route-to-Route Air Cargo Radar'}</span>
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-normal bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>SYSTEM STATUS SYNCED</span>
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
                {isBn
                  ? 'বাংলাদেশ ওয়্যারহাউজ ইনচার্জ রিসিভড না করা পর্যন্ত বিমান আকাশে ধীরে ধীরে ভেসে থাকবে, আপডেট দিলে বাংলাদেশে পৌঁছানো দেখাবে'
                  : 'Planes hover mid-air en-route until Bangladesh Warehouse Incharge updates shipment status as Received'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Route Selector */}
        <div className="flex items-center space-x-2">
          {/* Route Filter Selector Pills */}
          <div className={`flex items-center p-1 rounded-xl border text-xs font-normal ${
            isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-slate-100 border-slate-300/80'
          }`}>
            <button
              type="button"
              onClick={() => setSelectedRoute('all')}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium text-xs whitespace-nowrap cursor-pointer select-none hover:opacity-90 active:scale-95 ${
                selectedRoute === 'all'
                  ? 'bg-[#1D4ED8] text-white shadow-2xs'
                  : isDark
                  ? 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  : 'text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
              }`}
            >
              {isBn ? 'সকল রুট' : 'All Routes'}
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRoute('guangzhou');
                setActiveFlightPopup('BS-206');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium text-xs whitespace-nowrap cursor-pointer select-none hover:opacity-90 active:scale-95 ${
                selectedRoute === 'guangzhou'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : isDark
                  ? 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  : 'text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
              }`}
            >
              🇨🇳 {isBn ? 'চীন ➔ 🇧🇩' : 'China ➔ BD'}
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRoute('hongkong');
                setActiveFlightPopup('CX-008');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium text-xs whitespace-nowrap cursor-pointer select-none hover:opacity-90 active:scale-95 ${
                selectedRoute === 'hongkong'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : isDark
                  ? 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  : 'text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
              }`}
            >
              🇭🇰 {isBn ? 'হংকং ➔ 🇧🇩' : 'Hong Kong ➔ BD'}
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRoute('dubai');
                setActiveFlightPopup('EK-582');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium text-xs whitespace-nowrap cursor-pointer select-none hover:opacity-90 active:scale-95 ${
                selectedRoute === 'dubai'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : isDark
                  ? 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  : 'text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
              }`}
            >
              🇦🇪 {isBn ? 'দুবাই ➔ 🇧🇩' : 'Dubai ➔ BD'}
            </button>
          </div>

          {/* Refresh Radar Button */}
          <button
            type="button"
            onClick={handleRefreshRadar}
            className={`p-2 rounded-xl border transition-all text-xs font-normal cursor-pointer select-none hover:opacity-90 active:scale-95 flex items-center space-x-1 ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 shadow-2xs'
            }`}
            title={isBn ? 'রিফ্রেশ করুন' : 'Refresh Radar'}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#1D4ED8]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Futuristic Air Radar Canvas Container */}
      <div className={`relative w-full overflow-hidden min-h-[380px] p-4 flex flex-col justify-between select-none ${
        isDark ? 'bg-[#090F1E] text-white' : 'bg-slate-900 text-white'
      }`}>
        {/* Decorative Grid Overlay & Concentric Radar Rings */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />

        {/* Global Telemetry Overlay Bar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 text-xs font-normal text-slate-300 bg-slate-950/80 backdrop-blur-md p-3 rounded-2xl border border-slate-800">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1.5">
              <Compass className="w-4 h-4 text-blue-400 animate-spin" style={{ animationDuration: '12s' }} />
              <span className="text-slate-300 font-medium">{isBn ? 'এয়ার রুট কভারেজ মানচিত্র' : 'Air Cargo Radar Field'}</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center space-x-1 font-mono text-emerald-400">
              <Activity className="w-3.5 h-3.5" />
              <span>BD INCHARGE SYSTEM SYNC: OK</span>
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[11px] font-mono">
            <span className="text-slate-400">DHAKA HUB: <span className="text-white">DAC (Bangladesh 🇧🇩)</span></span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">SYSTEM LIVE</span>
          </div>
        </div>

        {/* Vector SVG World & Flight Route Canvas */}
        <div className="relative w-full h-[310px] my-2">
          <svg viewBox="0 0 800 340" className="w-full h-full overflow-visible">
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              <linearGradient id="grad-guangzhou" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.9" />
              </linearGradient>

              <linearGradient id="grad-hongkong" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A855F7" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.9" />
              </linearGradient>

              <linearGradient id="grad-dubai" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.9" />
              </linearGradient>
            </defs>

            {/* Concentric Radar Range Rings Centered around Dhaka (x=380, y=210) */}
            <circle cx="380" cy="210" r="80" fill="none" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            <circle cx="380" cy="210" r="160" fill="none" stroke="#1E293B" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
            <circle cx="380" cy="210" r="250" fill="none" stroke="#1E293B" strokeWidth="1" strokeDasharray="5 5" opacity="0.4" />

            {/* Smooth Continent Landmass Vector Outlines (Asia, Middle East, India) */}
            {/* Indian Subcontinent Outline */}
            <path
              d="M 330 140 L 360 160 L 410 170 L 440 190 L 420 230 L 385 265 L 360 250 L 340 210 L 310 180 L 315 150 Z"
              fill="#1E293B"
              fillOpacity="0.35"
              stroke="#334155"
              strokeWidth="1"
            />
            {/* Southeast Asia & China Landmass */}
            <path
              d="M 450 120 L 550 100 L 730 110 L 760 170 L 720 220 L 630 250 L 540 210 L 470 175 Z"
              fill="#1E293B"
              fillOpacity="0.3"
              stroke="#334155"
              strokeWidth="1"
            />
            {/* Middle East & Gulf Landmass */}
            <path
              d="M 60 120 L 150 110 L 220 140 L 200 200 L 140 230 L 80 190 Z"
              fill="#1E293B"
              fillOpacity="0.3"
              stroke="#334155"
              strokeWidth="1"
            />

            {/* Zero active flights empty state badge */}
            {routes.length === 0 && (
              <g className="animate-in fade-in duration-300">
                <rect x="200" y="140" width="400" height="60" rx="12" fill="#0F172A" fillOpacity="0.85" stroke="#334155" strokeWidth="1" />
                <text x="400" y="165" textAnchor="middle" fill="#94A3B8" fontSize="12" fontWeight="500">
                  {isBn ? 'বর্তমানে কোনো ফ্লাইট প্রস্তাবনা উড্ডয়ন অবস্থায় নেই' : 'No Active Air Cargo Flights in Transit'}
                </text>
                <text x="400" y="185" textAnchor="middle" fill="#64748B" fontSize="10">
                  {isBn ? 'ইনচার্জ প্রস্তাবনা তৈরি ও ডেসপ্যাচ করলে এখানে রিয়েল-টাইম উড্ডয়ন দেখা যাবে' : 'Live planes appear when Warehouse Incharge releases flight proposals'}
                </text>
              </g>
            )}

            {/* Flight Path Curves & Airplane Markers */}
            {routes.map((r) => {
              if (selectedRoute !== 'all' && selectedRoute !== r.id) return null;

              const pathD = `M ${r.originCoords.x} ${r.originCoords.y} Q ${r.curveControl.x} ${r.curveControl.y} ${r.destCoords.x} ${r.destCoords.y}`;

              const t = r.progress;
              const planeX = (1 - t) * (1 - t) * r.originCoords.x + 2 * (1 - t) * t * r.curveControl.x + t * t * r.destCoords.x;
              const planeY = (1 - t) * (1 - t) * r.originCoords.y + 2 * (1 - t) * t * r.curveControl.y + t * t * r.destCoords.y;

              // Explicit plane rotation ensuring nose points directly along flight path towards Bangladesh (Dhaka DAC 🇧🇩):
              // 1. Dubai (West of BD, x < 400): Flies East-Southeast towards Dhaka -> rotate(90deg)
              // 2. China & Hong Kong (East of BD, x >= 400): Fly West-Southwest towards Dhaka -> rotate(-180deg)
              const planeRotation = r.originCoords.x < 400 ? 90 : -180;

              const isSelected = activeFlightPopup === r.flightNo;
              const isLanded = r.status === 'received';

              return (
                <g key={r.id}>
                  {/* High-Tech Glowing Flight Trajectory Route Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={r.color || '#3B82F6'}
                    strokeWidth={isSelected ? '3.5' : '2.5'}
                    strokeDasharray={isLanded ? '3 3' : r.status === 'in_transit' ? '8 4' : '5 5'}
                    strokeOpacity={isLanded ? 0.45 : 0.85}
                    className={`transition-all duration-300 ${r.status === 'in_transit' ? 'animate-pulse' : ''}`}
                    filter="url(#glow)"
                  />
                  {/* Subtle Secondary Inner Core Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="1"
                    strokeDasharray={r.status === 'in_transit' ? '4 6' : '2 4'}
                    strokeOpacity={r.status === 'in_transit' ? 0.9 : 0.4}
                  />

                  {/* Origin Hub Circle */}
                  <g className="cursor-pointer" onClick={() => setActiveFlightPopup(r.flightNo)}>
                    <circle cx={r.originCoords.x} cy={r.originCoords.y} r="14" fill={r.color} fillOpacity="0.15" />
                    <circle cx={r.originCoords.x} cy={r.originCoords.y} r="6" fill={r.color} />
                    <text
                      x={r.originCoords.x}
                      y={r.originCoords.y - 12}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="10"
                      className="font-mono font-normal select-none"
                    >
                      {r.originCode}
                    </text>
                  </g>

                  {/* Airplane Marker */}
                  <g
                    transform={`translate(${planeX}, ${planeY})`}
                    className="cursor-pointer transition-transform duration-300 hover:scale-125"
                    onClick={() => setActiveFlightPopup(r.flightNo)}
                  >
                    <circle
                      cx="0"
                      cy="0"
                      r="16"
                      fill={isLanded ? '#10B981' : r.color}
                      fillOpacity="0.25"
                      className={isLanded ? '' : 'animate-ping'}
                    />
                    <circle
                      cx="0"
                      cy="0"
                      r="10"
                      fill="#0F172A"
                      stroke={isLanded ? '#10B981' : r.color}
                      strokeWidth="2"
                    />
                    <foreignObject x="-8" y="-8" width="16" height="16">
                      <div className="w-full h-full flex items-center justify-center text-blue-400">
                        {isLanded ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Plane
                            className="w-3.5 h-3.5 text-blue-400"
                            style={{ transform: `rotate(${planeRotation}deg)` }}
                          />
                        )}
                      </div>
                    </foreignObject>

                    {/* Flight Badge Label */}
                    <rect
                      x="12"
                      y="-10"
                      width="62"
                      height="18"
                      rx="9"
                      fill="#0F172A"
                      stroke={isLanded ? '#10B981' : r.color}
                      strokeWidth="1"
                    />
                    <text x="43" y="3" textAnchor="middle" fill="#FFFFFF" fontSize="9" className="font-mono font-normal">
                      {isLanded ? `${r.flightNo} 🛬` : r.flightNo}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Destination Hub: Dhaka Central Airport (DAC 🇧🇩) */}
            <g className="cursor-pointer">
              <circle cx="380" cy="210" r="22" fill="#10B981" fillOpacity="0.2" className="animate-pulse" />
              <circle cx="380" cy="210" r="12" fill="#10B981" fillOpacity="0.4" />
              <circle cx="380" cy="210" r="6" fill="#10B981" />
              <text x="380" y="244" textAnchor="middle" fill="#10B981" fontSize="11" className="font-mono font-normal tracking-wide">
                DAC (Dhaka Central 🇧🇩)
              </text>
            </g>
          </svg>

          {/* Floating Detail Card (Placed dynamically on OPPOSITE side of active flight route) */}
          {activeRouteObj && (
            <div className={`absolute ${cardPositionClass} max-w-sm w-full backdrop-blur-xl border rounded-none p-4 text-xs font-normal shadow-2xl space-y-3 z-20 transition-all duration-300 ${
              isDark
                ? 'bg-[#141416]/95 border-[#2C2C2E] text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)]'
                : 'bg-white/95 border-slate-300 text-slate-900 shadow-xl'
            }`}>
              <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 dark:border-[#2C2C2E]">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-none bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <Plane className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={`font-medium flex items-center space-x-1.5 ${isDark ? 'text-white' : 'text-slate-900 font-semibold'}`}>
                      <span>{activeRouteObj.flightNo}</span>
                      <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-600 font-normal'}`}>({activeRouteObj.airline})</span>
                    </h4>
                    <p className={`text-[10px] font-mono mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>{activeRouteObj.name}</p>
                  </div>
                </div>

                <span className={`px-2.5 py-0.5 rounded-none text-[10px] font-mono border ${
                  activeRouteObj.status === 'received'
                    ? isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                    : activeRouteObj.status === 'in_transit'
                    ? isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-800 border-blue-300 font-bold'
                    : isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-800 border-amber-300 font-bold'
                }`}>
                  {activeRouteObj.status === 'received'
                    ? isBn ? '🛬 বাংলাদেশ ওয়্যারহাউজে প্রাপ্ত' : '🛬 Received in BD'
                    : activeRouteObj.status === 'in_transit'
                    ? isBn ? '✈️ মিড-এয়ার ফ্লাইটে চলমান' : '✈️ Cruising Mid-Air'
                    : isBn ? '⏳ রিলিজের অপেক্ষায় (Awaiting Release)' : '⏳ Awaiting Launch'}
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono">
                <div className={`p-2 rounded-none border ${isDark ? 'bg-[#0E0E10] border-[#2C2C2E]' : 'bg-slate-100 border-slate-300'}`}>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 block">{isBn ? 'উচ্চতা' : 'ALTITUDE'}</span>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">{activeRouteObj.altitude}</span>
                </div>
                <div className={`p-2 rounded-none border ${isDark ? 'bg-[#0E0E10] border-[#2C2C2E]' : 'bg-slate-100 border-slate-300'}`}>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 block">{isBn ? 'গতিবেগ' : 'SPEED'}</span>
                  <span className="text-purple-600 dark:text-purple-400 font-medium">{activeRouteObj.speed}</span>
                </div>
                <div className={`p-2 rounded-none border ${isDark ? 'bg-[#0E0E10] border-[#2C2C2E]' : 'bg-slate-100 border-slate-300'}`}>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 block">{isBn ? 'অবস্থা' : 'STATUS'}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{activeRouteObj.eta}</span>
                </div>
              </div>

              {/* Notice */}
              <div className={`p-2 rounded-none border text-[10px] font-normal leading-relaxed ${
                isDark ? 'bg-[#0E0E10] border-[#2C2C2E] text-slate-400' : 'bg-slate-50 border-slate-300 text-slate-700'
              }`}>
                {isBn
                  ? '💡 নোট: বাংলাদেশ ওয়্যারহাউজ ইনচার্জ কার্গো রিসিভড মার্ক না করা পর্যন্ত বিমানটি আন্তর্জাতিক আকাশে ভাসমান থাকবে।'
                  : '💡 Note: Airplane stays cruising in mid-air until BD Warehouse Incharge updates status as Received.'}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Legend Cards */}
        <div className={`relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t text-xs font-normal ${
          isDark ? 'border-[#2C2C2E] text-slate-300' : 'border-slate-300 text-slate-800'
        }`}>
          {routes.map((r) => (
            <div
              key={r.id}
              onClick={() => setActiveFlightPopup(r.flightNo)}
              className={`flex items-center justify-between p-2.5 rounded-none transition-all cursor-pointer border ${
                activeFlightPopup === r.flightNo
                  ? isDark
                    ? 'bg-[#242426] border-blue-500/80 shadow-2xs'
                    : 'bg-blue-50/90 border-blue-500 shadow-2xs text-slate-900'
                  : isDark
                  ? 'bg-[#18181A] border-[#2C2C2E] hover:bg-[#202023] text-slate-200'
                  : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-900 shadow-xs'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-none shrink-0" style={{ backgroundColor: r.color }}></span>
                <div className="min-w-0">
                  <span className={`block font-normal text-[11px] truncate ${isDark ? 'text-white' : 'text-slate-900 font-semibold'}`}>
                    {r.name}
                  </span>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>
                    {r.flightNo} • {r.weight}
                  </span>
                </div>
              </div>

              <span className={`text-[10px] px-2 py-0.5 rounded-none border font-mono shrink-0 ml-2 ${
                r.status === 'received'
                  ? isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                  : r.status === 'in_transit'
                  ? isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-800 border-blue-300 font-bold'
                  : isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-800 border-amber-300 font-bold'
              }`}>
                {r.status === 'received' ? '🛬 BD Arrived' : r.status === 'in_transit' ? '✈️ Mid-Air' : '⏳ Awaiting Launch'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
