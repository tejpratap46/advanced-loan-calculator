import React from "react";

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  presets?: { label: string; value: number }[];
  onChange: (val: number) => void;
  isDark: boolean;
  accentColor?: "sky" | "indigo" | "emerald" | "amber";
}

export function SliderInput({
  label,
  value,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  presets,
  onChange,
  isDark,
  accentColor = "sky",
}: SliderInputProps) {
  // Track fill percentage for the range slider
  const percentage = Math.min(
    100,
    Math.max(0, ((value - min) / (max - min)) * 100),
  );

  const colors = {
    sky: {
      trackFill: "bg-sky-500",
      thumbColor: "#38bdf8",
      focusRing: "focus:border-sky-500 focus:ring-sky-500/20",
      presetActive: isDark
        ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
        : "bg-sky-100 text-sky-800 border-sky-300",
    },
    indigo: {
      trackFill: "bg-indigo-500",
      thumbColor: "#6366f1",
      focusRing: "focus:border-indigo-500 focus:ring-indigo-500/20",
      presetActive: isDark
        ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
        : "bg-indigo-100 text-indigo-800 border-indigo-300",
    },
    emerald: {
      trackFill: "bg-emerald-500",
      thumbColor: "#10b981",
      focusRing: "focus:border-emerald-500 focus:ring-emerald-500/20",
      presetActive: isDark
        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
        : "bg-emerald-100 text-emerald-800 border-emerald-300",
    },
    amber: {
      trackFill: "bg-amber-500",
      thumbColor: "#f59e0b",
      focusRing: "focus:border-amber-500 focus:ring-amber-500/20",
      presetActive: isDark
        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
        : "bg-amber-100 text-amber-800 border-amber-300",
    },
  }[accentColor];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseFloat(e.target.value);
    if (!isNaN(raw)) {
      onChange(Math.max(0, raw));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Label and Precision Input Row */}
      <div className="flex items-center justify-between gap-2">
        <label
          className={`text-xs font-semibold uppercase tracking-wider ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {label}
        </label>
        <div className="flex items-center relative">
          {prefix && (
            <span
              className={`absolute left-3 text-xs font-semibold select-none ${
                isDark ? "text-slate-400" : "text-slate-400"
              }`}
            >
              {prefix}
            </span>
          )}
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleInputChange}
            className={`w-32 py-1.5 text-right font-mono font-bold text-sm rounded-xl outline-none transition-all border ${
              prefix ? "pl-7" : "pl-3"
            } ${suffix ? "pr-8" : "pr-3"} ${
              isDark
                ? "bg-slate-900/60 border-slate-700/80 text-white placeholder-slate-500 focus:ring-2"
                : "bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-2"
            } ${colors.focusRing}`}
          />
          {suffix && (
            <span
              className={`absolute right-3 text-xs font-semibold select-none ${
                isDark ? "text-slate-400" : "text-slate-400"
              }`}
            >
              {suffix}
            </span>
          )}
        </div>
      </div>

      {/* Range Slider Row with Gradient Track */}
      <div className="relative flex items-center py-1">
        <div
          className={`absolute left-0 right-0 h-2 rounded-full overflow-hidden ${
            isDark ? "bg-slate-800" : "bg-slate-200"
          }`}
        >
          <div
            className={`h-full ${colors.trackFill} transition-all duration-75`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ "--slider-thumb-color": colors.thumbColor } as React.CSSProperties}
          className="w-full z-10"
        />
      </div>

      {/* Quick Presets (Optional) */}
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {presets.map((p) => {
            const isActive = Math.abs(value - p.value) < 0.001;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(p.value)}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border transition-all ${
                  isActive
                    ? colors.presetActive
                    : isDark
                    ? "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
