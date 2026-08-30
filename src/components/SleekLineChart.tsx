import React, { useState } from 'react';

export interface ChartPoint {
  date: string;
  value: number;
}

interface SleekLineChartProps {
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  color?: string; // e.g. '#00A896' or '#1D4ED8'
  unit?: string;
  isDark?: boolean;
}

export const SleekLineChart: React.FC<SleekLineChartProps> = ({
  title,
  subtitle,
  data,
  color = '#00A896',
  unit = 'kg',
  isDark = false,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
  const chartId = React.useMemo(() => 'chart-grad-' + Math.random().toString(36).substring(2, 9), []);

  if (!data || data.length === 0) return null;

  // Calculate max Y value for grid ticks
  const rawMax = Math.max(...data.map((d) => d.value), 4);
  const maxValue = rawMax === 0 ? 4 : rawMax * 1.15;
  const minValue = 0;

  // 5 Horizontal Grid Y-Ticks
  const yTicks = [
    Math.round(maxValue),
    Math.round((maxValue * 3) / 4),
    Math.round((maxValue * 2) / 4),
    Math.round(maxValue / 4),
    0,
  ];

  // SVG Canvas dimensions & paddings
  const width = 720;
  const height = 260;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 45;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Calculate (x, y) coordinates for each data point
  const points = data.map((d, index) => {
    const x = paddingLeft + (index / (data.length - 1 || 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d.value - minValue) / (maxValue - minValue || 1)) * chartHeight;
    return { x, y, data: d };
  });

  // Generate SVG Path String for the continuous line
  const linePathD = points.reduce((path, pt, index) => {
    return index === 0 ? `M ${pt.x} ${pt.y}` : `${path} L ${pt.x} ${pt.y}`;
  }, '');

  // Generate Area Path String for background gradient under line
  const areaPathD = `${linePathD} L ${points[points.length - 1]?.x} ${paddingTop + chartHeight} L ${points[0]?.x} ${paddingTop + chartHeight} Z`;

  return (
    <div className={`p-6 rounded-3xl border transition-all ${
      isDark ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200/90 text-slate-900 shadow-2xs'
    }`}>
      {/* Title & Tooltip Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-slate-900 dark:text-white">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5 font-normal">{subtitle}</p>}
        </div>
        {hoveredPoint ? (
          <div className="px-3 py-1 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 font-mono text-xs font-normal dark:bg-teal-950/50 dark:border-teal-800 dark:text-teal-300">
            {hoveredPoint.date}: {hoveredPoint.value.toLocaleString()} {unit}
          </div>
        ) : (
          <div className="text-xs text-slate-400 font-mono font-normal">Last 30 Days</div>
        )}
      </div>

      {/* SVG Dotted Grid Line Chart */}
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
          <defs>
            <linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Dashed Gridlines & Y-Axis Labels */}
          {yTicks.map((tick, i) => {
            const y = paddingTop + (i / (yTicks.length - 1)) * chartHeight;
            return (
              <g key={`y-${i}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke={isDark ? '#334155' : '#CBD5E1'}
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fontFamily="monospace"
                  fill={isDark ? '#64748B' : '#64748B'}
                >
                  {tick.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Vertical Dashed Gridlines & X-Axis Date Labels */}
          {points.map((pt, i) => {
            // Show select dates to avoid overcrowding X-axis
            const step = Math.max(1, Math.floor(data.length / 10));
            const showLabel = i % step === 0 || i === data.length - 1;
            if (!showLabel) return null;

            return (
              <g key={`x-${i}`}>
                <line
                  x1={pt.x}
                  y1={paddingTop}
                  x2={pt.x}
                  y2={paddingTop + chartHeight}
                  stroke={isDark ? '#334155' : '#CBD5E1'}
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={pt.x}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="monospace"
                  fill={isDark ? '#64748B' : '#64748B'}
                >
                  {pt.data.date}
                </text>
              </g>
            );
          })}

          {/* Soft Gradient Fill area under curve */}
          <path d={areaPathD} fill={`url(#${chartId})`} />

          {/* Main Continuous Line Curve */}
          <path
            d={linePathD}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Data Points (Dots) */}
          {points.map((pt, i) => (
            <circle
              key={`dot-${i}`}
              cx={pt.x}
              cy={pt.y}
              r={hoveredPoint?.date === pt.data.date ? '5.5' : '3.5'}
              fill={color}
              stroke={isDark ? '#1E293B' : '#FFFFFF'}
              strokeWidth="2"
              className="cursor-pointer transition-all hover:r-6"
              onMouseEnter={() => setHoveredPoint(pt.data)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
};
