import { useState } from "react";

interface LoanBreakdownDonutProps {
  principal: number;
  interest: number;
  misc?: number;
  currency: string;
  locale?: string;
  isDark: boolean;
}

export function LoanBreakdownDonut({
  principal,
  interest,
  misc = 0,
  currency,
  locale = "en-US",
  isDark,
}: LoanBreakdownDonutProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const fmt = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  const safePrincipal = Math.max(0, principal || 0);
  const safeInterest = Math.max(0, interest || 0);
  const safeMisc = Math.max(0, misc || 0);
  const total = safePrincipal + safeInterest + safeMisc;

  const segments = [
    {
      id: "principal",
      label: "Principal",
      value: safePrincipal,
      color: "#38bdf8", // Sky 400
      glowColor: "rgba(56, 189, 248, 0.4)",
      badgeClass: isDark
        ? "bg-sky-500/10 text-sky-300 border-sky-500/20"
        : "bg-sky-50 text-sky-700 border-sky-200",
    },
    {
      id: "interest",
      label: "Interest",
      value: safeInterest,
      color: "#fbbf24", // Amber 400
      glowColor: "rgba(251, 191, 36, 0.4)",
      badgeClass: isDark
        ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
        : "bg-amber-50 text-amber-700 border-amber-200",
    },
    ...(safeMisc > 0
      ? [
          {
            id: "misc",
            label: "Fees & Misc",
            value: safeMisc,
            color: "#fb923c", // Orange 400
            glowColor: "rgba(251, 146, 60, 0.4)",
            badgeClass: isDark
              ? "bg-orange-500/10 text-orange-300 border-orange-500/20"
              : "bg-orange-50 text-orange-700 border-orange-200",
          },
        ]
      : []),
  ];

  // SVG Geometry constants
  const size = 180;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Compute strokeDasharrays and strokeDashoffsets
  let accumulatedPercent = 0;
  const slices = segments.map((seg) => {
    const percent = total > 0 ? seg.value / total : 0;
    const dashLength = percent * circumference;
    const offset = -(accumulatedPercent * circumference);
    accumulatedPercent += percent;
    return {
      ...seg,
      percent: Math.round(percent * 100),
      percentExact: (percent * 100).toFixed(1),
      dashLength,
      offset,
    };
  });

  const activeSegment = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div className="flex flex-col items-center">
      {/* Donut Container with Hover Center Content */}
      <div className="relative w-[180px] h-[180px] flex items-center justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 origin-center"
        >
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)"}
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {slices.map((slice, i) => {
            if (slice.value <= 0) return null;
            const isHovered = hoveredIdx === i;
            return (
              <circle
                key={slice.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${slice.dashLength} ${circumference}`}
                strokeDashoffset={slice.offset}
                strokeLinecap="round"
                className="transition-all duration-300 cursor-pointer"
                style={{
                  filter: isHovered
                    ? `drop-shadow(0 0 8px ${slice.glowColor})`
                    : "none",
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-2">
          {activeSegment ? (
            <>
              <span
                className="text-[10px] font-semibold tracking-wider uppercase transition-colors"
                style={{ color: activeSegment.color }}
              >
                {activeSegment.label}
              </span>
              <span
                className={`text-sm sm:text-base font-bold font-mono tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {fmt(activeSegment.value)}
              </span>
              <span className={`text-[10px] font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {activeSegment.percentExact}%
              </span>
            </>
          ) : (
            <>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Total Loan Cost
              </span>
              <span
                className={`text-sm sm:text-base font-bold font-mono tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {fmt(total)}
              </span>
              <span className={`text-[9px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Hover for split
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend below donut */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-3 w-full">
        {slices.map((slice, i) => (
          <button
            key={slice.id}
            type="button"
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all border ${
              slice.badgeClass
            } ${
              hoveredIdx === i
                ? "scale-105 shadow-md"
                : hoveredIdx !== null
                ? "opacity-50"
                : "opacity-100"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: slice.color }}
            />
            <span className="font-medium text-[11px]">{slice.label}</span>
            <span className="font-mono font-bold text-[11px] ml-0.5">
              {slice.percent}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
