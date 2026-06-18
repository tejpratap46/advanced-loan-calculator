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
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${isDark ? "bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600"}`}
    >
      <X size={12} />
    </button>
  );
}
