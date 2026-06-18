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
    ? "w-28 px-2.5 py-1.5 rounded-lg text-xs outline-none bg-white/[0.06] border border-white/10 text-gray-100 placeholder-gray-600 focus:border-sky-400/60 focus:ring-1 focus:ring-sky-400/20"
    : "w-28 px-2.5 py-1.5 rounded-lg text-xs outline-none bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/20";
  return (
    <input
      type="number"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onEnter()}
      className={cls}
    />
  );
}
