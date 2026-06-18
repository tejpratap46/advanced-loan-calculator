import React from "react";

interface ActionBtnProps {
  onClick: () => void;
  color: "sky" | "violet" | "amber";
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
  };
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${colors[color]}`}
    >
      {children}
    </button>
  );
}
