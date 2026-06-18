import React, { useState } from "react";
import { X } from "lucide-react";

interface AdvSectionProps {
  title: string;
  count: number;
  accentClass: string;
  isDark: boolean;
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
  tags,
  showForm,
  onAdd,
  formContent,
}: AdvSectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-2 text-xs font-semibold mb-2 ${isDark ? "text-gray-300 hover:text-gray-100" : "text-gray-600 hover:text-gray-900"} transition-colors`}
      >
        <span
          className={`transition-transform ${open ? "rotate-90" : ""} inline-block`}
        >
          ›
        </span>
        <span>{title}</span>
        {count > 0 && (
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${accentClass} ${isDark ? "bg-white/[0.06]" : "bg-gray-100"}`}
          >
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="pl-4">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <span
                  key={t.label}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border ${t.color}`}
                >
                  <span
                    className={
                      t.onClick ? "cursor-pointer hover:underline" : ""
                    }
                    onClick={t.onClick}
                  >
                    {t.label}
                  </span>
                  <button
                    onClick={t.onRemove}
                    className="hover:opacity-60 transition-opacity ml-0.5"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {!showForm ? (
            <button
              onClick={onAdd}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${isDark ? "bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 border border-white/[0.08]" : "bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"}`}
            >
              + Add
            </button>
          ) : (
            formContent
          )}
        </div>
      )}
    </div>
  );
}
