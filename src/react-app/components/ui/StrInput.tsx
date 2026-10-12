interface StrInputProps {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  isDark: boolean;
}

export function StrInput({
  placeholder,
  value,
  onChange,
  onEnter,
  isDark,
}: StrInputProps) {
  const cls = isDark
    ? "w-32 px-3 py-1.5 rounded-xl text-xs font-mono outline-none bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
    : "w-32 px-3 py-1.5 rounded-xl text-xs font-mono outline-none bg-white border border-slate-300 text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all shadow-xs";
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onEnter()}
      className={cls}
    />
  );
}
