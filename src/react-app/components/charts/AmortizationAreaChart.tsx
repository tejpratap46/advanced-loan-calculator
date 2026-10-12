import React, { useState, useRef, useMemo } from "react";
import type { ScheduleRow } from "../../types";

interface AmortizationAreaChartProps {
  schedule: ScheduleRow[];
  currency: string;
  locale?: string;
  isDark: boolean;
}

export function AmortizationAreaChart({
  schedule,
  currency,
  locale = "en-US",
  isDark,
}: AmortizationAreaChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const fmt = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  // SVG Dimensions & Padding
  const width = 800;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 40, left: 65 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Filter or sample data points for smooth responsive curve
  const data = useMemo(() => {
    if (!schedule || schedule.length === 0) return [];
    // Include month 0 (initial point) if possible
    const initialPeak = Math.max(
      schedule[0]?.cumDisbursed || 0,
      schedule[0]?.remaining || 0,
    );
    const startPoint = {
      m: 0,
      date: "Start",
      remaining: initialPeak,
      intPay: 0,
      prinPay: 0,
      cumInt: 0,
      cumPrin: 0,
    };

    let cumInt = 0;
    let cumPrin = 0;
    const points = [
      startPoint,
      ...schedule.map((r) => {
        cumInt += r.intPay || 0;
        cumPrin += r.prinPay || 0;
        return {
          m: r.m,
          date: r.date,
          remaining: Math.max(0, r.remaining || 0),
          intPay: r.intPay || 0,
          prinPay: r.prinPay || 0,
          cumInt,
          cumPrin,
        };
      }),
    ];
    return points;
  }, [schedule]);

  const maxVal = useMemo(() => {
    if (data.length === 0) return 100000;
    const maxBal = Math.max(...data.map((d) => d.remaining));
    const maxCumPrin = Math.max(...data.map((d) => d.cumPrin));
    return Math.max(maxBal, maxCumPrin, 1000);
  }, [data]);

  // Scale functions
  const getX = (idx: number) =>
    padding.left + (idx / Math.max(1, data.length - 1)) * chartW;
  const getY = (val: number) =>
    padding.top + chartH - (Math.max(0, val) / maxVal) * chartH;

  // SVG Path generation
  const balancePoints = data.map((d, i) => `${getX(i)},${getY(d.remaining)}`);
  const balancePath = `M ${balancePoints.join(" L ")}`;
  const balanceAreaPath = `${balancePath} L ${getX(data.length - 1)},${
    padding.top + chartH
  } L ${getX(0)},${padding.top + chartH} Z`;

  // Paid principal path
  const prinPoints = data.map((d, i) => `${getX(i)},${getY(d.cumPrin)}`);
  const prinPath = `M ${prinPoints.join(" L ")}`;

  // Find payoff index (first point after start where balance drops to 0)
  const payoffIndex = data.findIndex((d, i) => i > 0 && d.remaining <= 0);

  // Mouse move handler
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || data.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * width;

    if (svgX < padding.left || svgX > width - padding.right) {
      setHoverIndex(null);
      return;
    }

    const relativeX = svgX - padding.left;
    const ratio = relativeX / chartW;
    const index = Math.round(ratio * (data.length - 1));
    const clampedIndex = Math.max(0, Math.min(data.length - 1, index));
    setHoverIndex(clampedIndex);
  };

  const activePoint = hoverIndex !== null ? data[hoverIndex] : null;

  // X Axis ticks (e.g. 5 ticks)
  const xTicks = useMemo(() => {
    if (data.length === 0) return [];
    const ticksCount = Math.min(6, data.length);
    const step = Math.floor((data.length - 1) / (ticksCount - 1));
    const ticks: { index: number; label: string }[] = [];
    for (let i = 0; i < ticksCount; i++) {
      const idx = Math.min(data.length - 1, i * step);
      ticks.push({
        index: idx,
        label: data[idx].m === 0 ? "Start" : data[idx].date,
      });
    }
    return ticks;
  }, [data]);

  // Y Axis ticks (4 ticks)
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => ({
    val: maxVal * pct,
    y: padding.top + chartH - pct * chartH,
  }));

  if (data.length === 0) return null;

  return (
    <div className="w-full select-none">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-sky-400 rounded-full" />
            <span className={isDark ? "text-slate-300" : "text-slate-600"}>
              Remaining Balance
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-400 rounded-full" />
            <span className={isDark ? "text-slate-300" : "text-slate-600"}>
              Cumulative Principal Paid
            </span>
          </div>
        </div>

        {payoffIndex > 0 && (
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 ${
              isDark
                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}
          >
            <span>🎉 Paid Off in Month {data[payoffIndex].m}</span>
            <span className="opacity-75">({data[payoffIndex].date})</span>
          </span>
        )}
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            {/* Balance gradient */}
            <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={isDark ? 0.35 : 0.25} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>

            {/* Filter for glowing cursor point */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Horizontal gridlines */}
          {yTicks.map((t, idx) => (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={t.y}
                x2={width - padding.right}
                y2={t.y}
                stroke={isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)"}
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 8}
                y={t.y + 3}
                textAnchor="end"
                className={`text-[10px] font-mono fill-current ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                {fmt(t.val)}
              </text>
            </g>
          ))}

          {/* Balance Area Fill */}
          <path d={balanceAreaPath} fill="url(#balanceGrad)" />

          {/* Cumulative Principal Line */}
          <path
            d={prinPath}
            fill="none"
            stroke="#34d399"
            strokeWidth="2"
            strokeDasharray="3 3"
            opacity="0.85"
          />

          {/* Balance Curve Line */}
          <path
            d={balancePath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Payoff Milestone Marker */}
          {payoffIndex > 0 && (
            <g transform={`translate(${getX(payoffIndex)}, ${getY(0)})`}>
              <circle
                r="5"
                fill="#10b981"
                stroke={isDark ? "#0f172a" : "#ffffff"}
                strokeWidth="2"
              />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="-24"
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              <text
                x="0"
                y="-28"
                textAnchor="middle"
                className="text-[9px] font-bold fill-emerald-400"
              >
                PAYOFF
              </text>
            </g>
          )}

          {/* X Axis Labels */}
          {xTicks.map((t, idx) => {
            const x = getX(t.index);
            return (
              <text
                key={idx}
                x={x}
                y={height - 12}
                textAnchor="middle"
                className={`text-[10px] font-medium fill-current ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                {t.label}
              </text>
            );
          })}

          {/* Interactive Hover Guide & Dots */}
          {activePoint && hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={padding.top}
                x2={getX(hoverIndex)}
                y2={padding.top + chartH}
                stroke={isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.3)"}
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              {/* Point on Balance curve */}
              <circle
                cx={getX(hoverIndex)}
                cy={getY(activePoint.remaining)}
                r="6"
                fill="#38bdf8"
                stroke={isDark ? "#0b0f19" : "#ffffff"}
                strokeWidth="2.5"
                filter="url(#glow)"
              />
              {/* Point on Principal curve */}
              <circle
                cx={getX(hoverIndex)}
                cy={getY(activePoint.cumPrin)}
                r="4.5"
                fill="#34d399"
                stroke={isDark ? "#0b0f19" : "#ffffff"}
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {activePoint && hoverIndex !== null && (
          <div
            className={`pointer-events-none absolute z-20 py-2 px-3 rounded-xl shadow-2xl backdrop-blur-md border text-xs transition-all duration-75 ${
              isDark
                ? "bg-slate-900/90 border-slate-700/80 text-white"
                : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-200"
            }`}
            style={{
              left: `${Math.min(
                85,
                Math.max(15, (getX(hoverIndex) / width) * 100),
              )}%`,
              top: "10px",
              transform: "translateX(-50%)",
            }}
          >
            <div className="flex items-center justify-between gap-3 font-semibold pb-1 mb-1 border-b border-white/10">
              <span className="text-sky-400">
                {activePoint.m === 0
                  ? "Start of Loan"
                  : `Month ${activePoint.m} (${activePoint.date})`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">
                  Remaining
                </span>
                <span className="font-bold text-sky-400">
                  {fmt(activePoint.remaining)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">
                  Principal Paid
                </span>
                <span className="font-bold text-emerald-400">
                  {fmt(activePoint.cumPrin)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">
                  Interest Paid
                </span>
                <span className="font-bold text-amber-400">
                  {fmt(activePoint.cumInt)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
