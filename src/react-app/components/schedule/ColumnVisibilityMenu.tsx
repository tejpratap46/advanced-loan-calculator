import { useState, useRef, useEffect } from "react";
import {
  SlidersHorizontal,
  ChevronDown,
  Check,
  X,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  ALL_TABLE_COLUMNS,
  CUSTOM_ONLY_COLUMNS,
  type TableColumnId,
  type TableColumnDef,
} from "./tableColumns";

interface ColumnVisibilityMenuProps {
  visibleColumns: TableColumnId[];
  onToggleColumn: (id: TableColumnId) => void;
  onSelectAll: () => void;
  onSelectCustomOnly: () => void;
  onReset: () => void;
  isDark: boolean;
  hasDirectPayments?: boolean;
  hasOd?: boolean;
}

export function ColumnVisibilityMenu({
  visibleColumns,
  onToggleColumn,
  onSelectAll,
  onSelectCustomOnly,
  onReset,
  isDark,
  hasDirectPayments = false,
  hasOd = false,
}: ColumnVisibilityMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const isAllPresetActive =
    ALL_TABLE_COLUMNS.every((col) => visibleColumns.includes(col.id));

  const isCustomOnlyPresetActive =
    visibleColumns.length === CUSTOM_ONLY_COLUMNS.length &&
    CUSTOM_ONLY_COLUMNS.every((id) => visibleColumns.includes(id));

  const customColumns = ALL_TABLE_COLUMNS.filter((c) => c.category === "custom");
  const standardColumns = ALL_TABLE_COLUMNS.filter((c) => c.category === "standard");

  const customVisibleCount = customColumns.filter((c) =>
    visibleColumns.includes(c.id),
  ).length;
  const standardVisibleCount = standardColumns.filter((c) =>
    visibleColumns.includes(c.id),
  ).length;

  const divider = isDark ? "border-slate-800" : "border-slate-200";
  const subtext = isDark ? "text-slate-400" : "text-slate-500";
  const heading = isDark ? "text-white" : "text-slate-900";

  const renderColumnItem = (col: TableColumnDef) => {
    const isChecked = visibleColumns.includes(col.id);
    const isOnlyVisible = isChecked && visibleColumns.length === 1;
    const isInactiveInScenario =
      (col.id === "directPayAmt" && !hasDirectPayments) ||
      (col.id === "odBal" && !hasOd);

    return (
      <button
        key={col.id}
        type="button"
        disabled={isOnlyVisible}
        onClick={() => onToggleColumn(col.id)}
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer ${
          isOnlyVisible ? "opacity-60 cursor-not-allowed" : ""
        } ${
          isChecked
            ? isDark
              ? "bg-sky-500/10 hover:bg-sky-500/15"
              : "bg-sky-50/80 hover:bg-sky-100/70"
            : isDark
            ? "hover:bg-slate-800/60"
            : "hover:bg-slate-100"
        }`}
        title={isOnlyVisible ? "At least one column must be visible" : col.description}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Checkbox box */}
          <div
            className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
              isChecked
                ? "bg-sky-500 border-sky-500 text-white shadow-xs"
                : isDark
                ? "border-slate-600 bg-slate-800"
                : "border-slate-300 bg-white"
            }`}
          >
            {isChecked && <Check size={11} strokeWidth={3} />}
          </div>

          <div className="truncate">
            <div className="flex items-center gap-1.5 truncate">
              <span
                className={`text-xs font-medium truncate ${
                  isChecked ? heading : subtext
                }`}
              >
                {col.label}
              </span>
              {isInactiveInScenario && (
                <span className="text-[9px] px-1 py-0.2 rounded-sm bg-slate-700/40 text-slate-400 font-normal">
                  inactive
                </span>
              )}
            </div>
            <p className={`text-[10px] leading-tight truncate ${subtext}`}>
              {col.description}
            </p>
          </div>
        </div>

        {/* Category Pill */}
        <span
          className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
            col.category === "custom"
              ? isDark
                ? "bg-violet-500/15 text-violet-300 border border-violet-500/20"
                : "bg-violet-50 text-violet-700 border border-violet-200"
              : isDark
              ? "bg-slate-800 text-slate-400"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {col.category === "custom" ? "Custom" : "Std"}
        </span>
      </button>
    );
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-medium cursor-pointer transition-all border ${
          isCustomOnlyPresetActive
            ? isDark
              ? "bg-violet-500/15 border-violet-500/40 text-violet-300 shadow-xs"
              : "bg-violet-50 border-violet-300 text-violet-700 shadow-xs"
            : !isAllPresetActive
            ? isDark
              ? "bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-xs"
              : "bg-sky-50 border-sky-300 text-sky-700 shadow-xs"
            : isDark
            ? "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700"
            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
        }`}
        title="Customize visible columns in amortization table"
        aria-expanded={isOpen}
      >
        <SlidersHorizontal size={13} className="shrink-0" />
        <span>Columns</span>

        {isCustomOnlyPresetActive ? (
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-violet-500 text-white">
            Custom Only
          </span>
        ) : !isAllPresetActive ? (
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-sky-500 text-white">
            {visibleColumns.length}/{ALL_TABLE_COLUMNS.length}
          </span>
        ) : (
          <span className={`text-[10px] hidden sm:inline ${subtext}`}>All</span>
        )}

        <ChevronDown
          size={12}
          className={`shrink-0 opacity-60 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Floating Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute right-0 top-full mt-2 w-76 sm:w-84 rounded-2xl border p-3 z-50 shadow-2xl backdrop-blur-md animate-fadeIn ${
            isDark
              ? "bg-[#0F172A]/95 border-slate-700/80 text-slate-200 shadow-black/60"
              : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/60"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-inherit">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-sky-400" />
              <span className={`text-xs font-bold uppercase tracking-wider ${heading}`}>
                Table Columns
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                }`}
              >
                {visibleColumns.length} / {ALL_TABLE_COLUMNS.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                isDark ? "hover:bg-slate-800 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-black"
              }`}
              title="Close menu"
            >
              <X size={14} />
            </button>
          </div>

          {/* Quick Presets Toggle: All vs Only Custom */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${subtext}`}>
                Quick Presets
              </span>
              <span className={`text-[9px] ${subtext}`}>Saved in localStorage</span>
            </div>

            <div
              className={`grid grid-cols-2 gap-1.5 p-1 rounded-xl border ${
                isDark
                  ? "bg-slate-900/80 border-slate-800"
                  : "bg-slate-100/80 border-slate-200"
              }`}
            >
              <button
                type="button"
                onClick={onSelectAll}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  isAllPresetActive
                    ? "bg-sky-500 text-white shadow-xs"
                    : isDark
                    ? "text-slate-400 hover:text-white hover:bg-slate-800"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                }`}
              >
                <span>All Columns</span>
                <span className="text-[10px] opacity-80 font-mono">
                  ({ALL_TABLE_COLUMNS.length})
                </span>
              </button>

              <button
                type="button"
                onClick={onSelectCustomOnly}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  isCustomOnlyPresetActive
                    ? "bg-violet-500 text-white shadow-xs"
                    : isDark
                    ? "text-slate-400 hover:text-white hover:bg-slate-800"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                }`}
                title="Only show custom strategy columns (Disbursement, Custom EMI, Lump Sum, Direct Pay, OD Balance, Interest Saved)"
              >
                <Sparkles size={12} className={isCustomOnlyPresetActive ? "text-white" : "text-violet-400"} />
                <span>Only Custom</span>
                <span className="text-[10px] opacity-80 font-mono">
                  ({CUSTOM_ONLY_COLUMNS.length})
                </span>
              </button>
            </div>
          </div>

          {/* Scrollable Column List */}
          <div className="max-h-64 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            {/* Custom Adjustments Group */}
            <div>
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  Custom Adjustments
                </span>
                <span className={`text-[10px] font-mono ${subtext}`}>
                  {customVisibleCount}/{customColumns.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {customColumns.map(renderColumnItem)}
              </div>
            </div>

            {/* Standard Columns Group */}
            <div>
              <div className="flex items-center justify-between mb-1 px-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${subtext} flex items-center gap-1`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Standard Schedule
                </span>
                <span className={`text-[10px] font-mono ${subtext}`}>
                  {standardVisibleCount}/{standardColumns.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {standardColumns.map(renderColumnItem)}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-between pt-2.5 mt-2.5 border-t ${divider}`}>
            <button
              type="button"
              onClick={onReset}
              className={`text-[11px] flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                isDark
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              title="Reset visible columns to show all"
            >
              <RotateCcw size={11} />
              <span>Reset to Default</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs px-3 py-1 rounded-lg font-semibold bg-sky-500 hover:bg-sky-400 text-white shadow-xs cursor-pointer transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
