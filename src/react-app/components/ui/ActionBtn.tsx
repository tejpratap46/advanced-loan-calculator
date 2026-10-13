import React from "react";

interface ActionBtnProps {
  onClick: () => void;
  color: "sky" | "violet" | "amber" | "emerald" | "orange" | "indigo" | "teal";
  isDark: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

export function ActionBtn({
  onClick,
  color,
  disabled,
  children,
}: ActionBtnProps) {
  const colors = {
    sky: "bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/20",
    violet: "bg-violet-500 hover:bg-violet-400 text-white shadow-violet-500/20",
    amber: "bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/20",
    emerald: "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20",
    orange: "bg-orange-500 hover:bg-orange-400 text-white shadow-orange-500/20",
    indigo: "bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-500/20",
    teal: "bg-teal-500 hover:bg-teal-400 text-white shadow-teal-500/20",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer ${
        disabled
          ? "opacity-50 cursor-not-allowed shadow-none active:scale-100 bg-slate-500/40 text-slate-400"
          : colors[color]
      }`}
    >
      {children}
    </button>
  );
}
