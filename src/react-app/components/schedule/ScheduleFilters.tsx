import { Download } from "lucide-react";
import { ColumnVisibilityMenu } from "./ColumnVisibilityMenu";
import type { TableColumnId } from "./tableColumns";

export type ViewMode = "monthly" | "yearly";
export type FilterMode = "all" | "prepayments" | "pending";

interface ScheduleFiltersProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  filterMode: FilterMode;
  onFilterModeChange: (filter: FilterMode) => void;
  allExpanded: boolean;
  onToggleAllMonths: () => void;
  onExportDailyCSV: () => void;
  onExportMonthlyCSV: () => void;
  totalPaymentsCount: number;
  isDark: boolean;
  visibleColumns: TableColumnId[];
  onToggleColumn: (id: TableColumnId) => void;
  onSelectAllColumns: () => void;
  onSelectCustomColumnsOnly: () => void;
  onResetColumns: () => void;
  hasDirectPayments?: boolean;
  hasOd?: boolean;
}

export function ScheduleFilters({
  viewMode,
  onViewModeChange,
  filterMode,
  onFilterModeChange,
  allExpanded,
  onToggleAllMonths,
  onExportDailyCSV,
  onExportMonthlyCSV,
  totalPaymentsCount,
  isDark,
  visibleColumns,
  onToggleColumn,
  onSelectAllColumns,
  onSelectCustomColumnsOnly,
  onResetColumns,
  hasDirectPayments,
  hasOd,
}: ScheduleFiltersProps) {
  const subtext = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 border-b border-white/5">
      {/* Left: View Mode Toggle & Title */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <h2 className={`text-xs sm:text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
          Amortization Schedule
        </h2>

        {/* View Mode Toggle (Monthly vs Yearly) */}
        <div
          className={`flex items-center p-0.5 rounded-xl border ${
            isDark
              ? "bg-slate-900/80 border-slate-700/80"
              : "bg-slate-100 border-slate-200"
          }`}
        >
          <button
            type="button"
            onClick={() => onViewModeChange("monthly")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === "monthly"
                ? "bg-sky-500 text-white shadow-xs"
                : isDark
                ? "text-slate-400 hover:text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("yearly")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === "yearly"
                ? "bg-sky-500 text-white shadow-xs"
                : isDark
                ? "text-slate-400 hover:text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Yearly Roll-Up
          </button>
        </div>

        {/* Payments count badge */}
        <span className={`text-[11px] font-medium hidden md:inline ${subtext}`}>
          {totalPaymentsCount} total payments
        </span>
      </div>

      {/* Right: Filters & Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Filter Chips (Active only in Monthly view) */}
        {viewMode === "monthly" && (
          <div
            className={`flex items-center p-0.5 rounded-xl border ${
              isDark
                ? "bg-slate-900/80 border-slate-700/80"
                : "bg-slate-100 border-slate-200"
            }`}
          >
            <button
              type="button"
              onClick={() => onFilterModeChange("all")}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                filterMode === "all"
                  ? isDark
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-900 shadow-xs"
                  : subtext
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => onFilterModeChange("prepayments")}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                filterMode === "prepayments"
                  ? isDark
                    ? "bg-slate-800 text-amber-300"
                    : "bg-white text-amber-700 shadow-xs"
                  : subtext
              }`}
            >
              Prepayments
            </button>
            <button
              type="button"
              onClick={() => onFilterModeChange("pending")}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                filterMode === "pending"
                  ? isDark
                    ? "bg-slate-800 text-sky-300"
                    : "bg-white text-sky-700 shadow-xs"
                  : subtext
              }`}
            >
              Pending
            </button>
          </div>
        )}

        {/* Day-Wise Expand Toggle (Monthly view) */}
        {viewMode === "monthly" && (
          <button
            type="button"
            onClick={onToggleAllMonths}
            className={`text-xs px-2.5 py-1 rounded-xl font-medium cursor-pointer transition-all border ${
              isDark
                ? "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
            }`}
          >
            {allExpanded ? "Collapse Days" : "Expand Days"}
          </button>
        )}

        {/* Column Visibility Selector Menu */}
        <ColumnVisibilityMenu
          visibleColumns={visibleColumns}
          onToggleColumn={onToggleColumn}
          onSelectAll={onSelectAllColumns}
          onSelectCustomOnly={onSelectCustomColumnsOnly}
          onReset={onResetColumns}
          isDark={isDark}
          hasDirectPayments={hasDirectPayments}
          hasOd={hasOd}
        />

        {/* CSV Export Dropdown / Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onExportMonthlyCSV}
            className={`text-xs flex items-center gap-1 px-2.5 py-1 rounded-xl font-medium cursor-pointer transition-all border ${
              isDark
                ? "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
            }`}
            title="Download Monthly Amortization Schedule CSV"
          >
            <Download size={13} />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={onExportDailyCSV}
            className={`text-xs flex items-center gap-1 px-2.5 py-1 rounded-xl font-semibold cursor-pointer transition-all border ${
              isDark
                ? "bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border-sky-500/30"
                : "bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200"
            }`}
            title="Download Granular Day-Wise Schedule CSV"
          >
            <Download size={13} />
            <span>Daily CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
}
