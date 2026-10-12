import React, { useState } from "react";
import { X, ChevronDown, ChevronRight, Plus } from "lucide-react";

interface AdvSectionProps {
  title: string;
  count: number;
  accentClass: string;
  isDark: boolean;
  icon?: React.ReactNode;
  tags: {
    label: string;
    color: string;
    onRemove: () => void;
    onClick?: () => void;
  }[];
  showForm: boolean;
  onAdd: () => void;
  onClose: () => void;
  formContent: React.ReactNode;
}

export function AdvSection({
  title,
  count,
  accentClass,
  isDark,
  icon,
  tags,
  showForm,
  onAdd,
  formContent,
}: AdvSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        isDark
          ? "bg-slate-900/40 border-slate-800/80 hover:border-slate-700/80"
          : "bg-slate-50/70 border-slate-200/80 hover:border-slate-300"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between p-3 cursor-pointer text-left transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`p-1 rounded-md transition-colors ${
              isDark ? "bg-slate-800 text-slate-300" : "bg-white text-slate-600 shadow-sm"
            }`}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          {icon && <span className="opacity-80">{icon}</span>}
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              isDark ? "text-slate-200" : "text-slate-800"
            }`}
          >
            {title}
          </span>
          {count > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${accentClass} ${
                isDark ? "bg-white/[0.05]" : "bg-white shadow-xs"
              }`}
            >
              {count} {count === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!open && tags.length > 0 && (
            <span className={`text-[11px] truncate max-w-[200px] hidden sm:inline ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {tags[0].label} {tags.length > 1 ? `+${tags.length - 1} more` : ""}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div
          className={`p-3 pt-0 border-t ${
            isDark ? "border-slate-800/80" : "border-slate-200/80"
          }`}
        >
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 my-2.5">
              {tags.map((t) => (
                <span
                  key={t.label}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-xs transition-all ${t.color}`}
                >
                  <span
                    className={
                      t.onClick
                        ? "cursor-pointer hover:underline underline-offset-2"
                        : ""
                    }
                    onClick={t.onClick}
                  >
                    {t.label}
                  </span>
                  <button
                    type="button"
                    onClick={t.onRemove}
                    className="hover:opacity-70 transition-opacity p-0.5 rounded"
                    title="Remove entry"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {!showForm ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={onAdd}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs border ${
                  isDark
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-600"
                    : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300 hover:border-slate-400"
                }`}
              >
                <Plus size={13} />
                <span>Add {title.slice(0, 15)}</span>
              </button>
            </div>
          ) : (
            <div
              className={`mt-2 p-3 rounded-xl border ${
                isDark
                  ? "bg-slate-900/80 border-slate-800"
                  : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              {formContent}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
