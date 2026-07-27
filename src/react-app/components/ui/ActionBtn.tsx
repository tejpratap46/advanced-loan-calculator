import React from "react";

interface ActionBtnProps {
  onClick: () => void;
  color: "sky" | "violet" | "amber" | "emerald" | "orange";
  isDark: boolean;
  children: React.ReactNode;
}

export function ActionBtn({
  onClick,
  color,
  children,
}: ActionBtnProps) {
  const colors = {
    sky: "bg-sky-500 hover:bg-sky-400 text-white",
    violet: "bg-violet-500 hover:bg-violet-400 text-white",
    amber: "bg-amber-500 hover:bg-amber-400 text-white",
    emerald: "bg-emerald-500 hover:bg-emerald-400 text-white",
    orange: "bg-orange-500 hover:bg-orange-400 text-white",
  };
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-sm text-[11px] font-semibold transition-colors ${colors[color]}`}
    >
      {children}
    </button>
  );
}
