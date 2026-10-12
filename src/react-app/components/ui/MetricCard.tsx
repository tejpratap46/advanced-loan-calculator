import React from "react";

interface MetricCardProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  colorScheme?: "sky" | "amber" | "violet" | "emerald" | "orange" | "teal" | "rose" | "indigo";
  isDark: boolean;
  subtitle?: string;
  trend?: string;
}

export function MetricCard({
  label,
  value,
  icon,
  colorScheme = "sky",
  isDark,
  subtitle,
  trend,
}: MetricCardProps) {
  const styles = {
    sky: {
      text: "text-sky-400",
      dot: "bg-sky-400",
      badge: isDark ? "bg-sky-500/10 text-sky-400 border-sky-500/20" : "bg-sky-50 text-sky-700 border-sky-200",
    },
    amber: {
      text: "text-amber-400",
      dot: "bg-amber-400",
      badge: isDark ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-700 border-amber-200",
    },
    violet: {
      text: "text-violet-400",
      dot: "bg-violet-400",
      badge: isDark ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-violet-50 text-violet-700 border-violet-200",
    },
    emerald: {
      text: "text-emerald-400",
      dot: "bg-emerald-400",
      badge: isDark ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    orange: {
      text: "text-orange-400",
      dot: "bg-orange-400",
      badge: isDark ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-orange-50 text-orange-700 border-orange-200",
    },
    teal: {
      text: "text-teal-400",
      dot: "bg-teal-400",
      badge: isDark ? "bg-teal-500/10 text-teal-400 border-teal-500/20" : "bg-teal-50 text-teal-700 border-teal-200",
    },
    rose: {
      text: "text-rose-400",
      dot: "bg-rose-400",
      badge: isDark ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-rose-50 text-rose-700 border-rose-200",
    },
    indigo: {
      text: "text-indigo-400",
      dot: "bg-indigo-400",
      badge: isDark ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : "bg-indigo-50 text-indigo-700 border-indigo-200",
    },
  }[colorScheme];

  return (
    <div
      className={`p-3.5 rounded-2xl transition-all duration-200 flex flex-col justify-between border ${
        isDark
          ? "bg-slate-900/60 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/90 shadow-lg shadow-black/20"
          : "bg-white border-slate-200/90 hover:border-slate-300 shadow-sm hover:shadow-md shadow-slate-200/50"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
          <span
            className={`text-[11px] font-semibold tracking-wider uppercase ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {label}
          </span>
        </div>
        {icon && (
          <div className={`p-1.5 rounded-lg border text-xs ${styles.badge}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex flex-col">
        <span
          className={`text-base sm:text-lg font-bold font-mono tracking-tight tabular-nums ${styles.text}`}
        >
          {value}
        </span>
        {(subtitle || trend) && (
          <div className="flex items-center justify-between mt-1 text-[11px]">
            {subtitle && (
              <span className={isDark ? "text-slate-500" : "text-slate-400"}>
                {subtitle}
              </span>
            )}
            {trend && (
              <span className={`font-semibold ${styles.text}`}>{trend}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
