interface NumInputProps {
  placeholder: string;
  value: number;
  onChange: (v: number) => void;
  onEnter: () => void;
  isDark: boolean;
  min?: number;
  max?: number;
}

export function NumInput({
  placeholder,
  value,
  onChange,
  onEnter,
  isDark,
  min,
  max,
}: NumInputProps) {
  const cls = isDark
    ? "w-28 px-3 py-1.5 rounded-xl text-xs font-mono outline-none bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
    : "w-28 px-3 py-1.5 rounded-xl text-xs font-mono outline-none bg-white border border-slate-300 text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all shadow-xs";
  return (
    <input
      type="number"
      placeholder={placeholder}
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(+e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onEnter()}
      className={cls}
    />
  );
}
