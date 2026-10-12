import { X } from "lucide-react";

interface CancelBtnProps {
  onClick: () => void;
  isDark: boolean;
}

export function CancelBtn({
  onClick,
  isDark,
}: CancelBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
        isDark
          ? "bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 border-slate-700"
          : "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 border-slate-200"
      }`}
      title="Cancel"
    >
      <X size={14} />
    </button>
  );
}
