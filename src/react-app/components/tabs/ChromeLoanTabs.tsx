import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  X,
  Edit2,
  Check,
  Copy,
  GitCompare,
  Home,
  Car,
  GraduationCap,
  Building2,
  Wallet,
  Landmark,
} from "lucide-react";
import type { Loan } from "../../types";
import { getCurrencySymbol } from "../../utils/currency";

interface ChromeLoanTabsProps {
  loans: Loan[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onAddTab: () => void;
  onDeleteTab: (id: string) => void;
  onRenameTab: (id: string, newName: string) => void;
  onDuplicateTab: (id: string) => void;
  onOpenComparison: () => void;
  isDark: boolean;
  currency: string;
  locale: string;
}

/**
 * Returns a contextual icon for the loan based on its scenario name.
 */
function getLoanIcon(name: string) {
  const n = name.toLowerCase();
  if (
    n.includes("car") ||
    n.includes("auto") ||
    n.includes("vehicle") ||
    n.includes("bike") ||
    n.includes("tesla")
  ) {
    return Car;
  }
  if (
    n.includes("home") ||
    n.includes("mortgage") ||
    n.includes("house") ||
    n.includes("property") ||
    n.includes("condo") ||
    n.includes("flat")
  ) {
    return Home;
  }
  if (
    n.includes("student") ||
    n.includes("study") ||
    n.includes("college") ||
    n.includes("education") ||
    n.includes("uni")
  ) {
    return GraduationCap;
  }
  if (
    n.includes("biz") ||
    n.includes("business") ||
    n.includes("commercial") ||
    n.includes("corp")
  ) {
    return Building2;
  }
  if (
    n.includes("personal") ||
    n.includes("cash") ||
    n.includes("salary")
  ) {
    return Wallet;
  }
  return Landmark;
}

/**
 * Compact currency formatter for micro-pills (e.g. $450k, $1.2M)
 */
function formatCompactAmount(amt: number, curr: string): string {
  const sym = getCurrencySymbol(curr);
  if (amt >= 1_000_000) {
    return `${sym}${(amt / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (amt >= 1_000) {
    return `${sym}${(amt / 1_000).toFixed(0)}k`;
  }
  return `${sym}${amt}`;
}

export function ChromeLoanTabs({
  loans,
  activeTabId,
  onSelectTab,
  onAddTab,
  onDeleteTab,
  onRenameTab,
  onDuplicateTab,
  onOpenComparison,
  isDark,
  currency,
}: ChromeLoanTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const tabStripRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!tabStripRef.current) return;
    if (tabStripRef.current.scrollWidth > tabStripRef.current.clientWidth) {
      if (e.deltaY !== 0 && e.deltaX === 0) {
        tabStripRef.current.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }
  };

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startRename = (loan: Loan) => {
    setEditingId(loan.id);
    setEditingName(loan.name);
  };

  const commitRename = () => {
    if (editingId && editingName.trim()) {
      onRenameTab(editingId, editingName.trim());
    }
    setEditingId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
  };

  return (
    <div
      className={`relative flex items-end justify-between px-2 pt-2 border-t border-x border-b select-none transition-colors duration-200 ${
        isDark
          ? "bg-[#070b14] border-slate-800 text-slate-300"
          : "bg-slate-200/75 border-slate-200 text-slate-700"
      } rounded-t-2xl`}
    >
      {/* ── Tabs Strip List ───────────────────────────────────────────────── */}
      <div
        ref={tabStripRef}
        onWheel={handleWheel}
        className="flex items-end gap-0.5 overflow-x-auto overflow-y-hidden no-scrollbar flex-1 -mb-[1px] h-10 pr-2"
      >
        {loans.map((loan, idx) => {
          const isActive = loan.id === activeTabId;
          const isNextActive = loans[idx + 1]?.id === activeTabId;
          const LoanIcon = getLoanIcon(loan.name);
          const compactPrincipal = formatCompactAmount(
            loan.data.principal,
            currency,
          );

          if (isActive) {
            return (
              <div
                key={loan.id}
                className={`relative z-20 group flex items-center gap-2 pl-3.5 pr-2.5 h-10 rounded-t-xl transition-all cursor-pointer ${
                  isDark
                    ? "bg-slate-900 text-white border-t border-l border-r border-slate-800"
                    : "bg-white text-slate-900 border-t border-l border-r border-slate-200"
                }`}
                style={{ minWidth: "150px", maxWidth: "250px" }}
                onClick={() => onSelectTab(loan.id)}
              >
                {/* Top Glowing Accent Indicator */}
                <div className="absolute top-0 left-3 right-3 h-[2px] bg-gradient-to-r from-sky-400 via-sky-500 to-indigo-500 rounded-full" />

                {/* Left Chrome Fillet (Concave Flared Wing) */}
                <svg
                  className="absolute -left-[10px] bottom-0 w-[10px] h-[10px] pointer-events-none z-20"
                  viewBox="0 0 10 10"
                  fill="none"
                >
                  <path
                    d="M0 10 C5.523 10 10 5.523 10 0 L10 10 Z"
                    className={isDark ? "fill-slate-900" : "fill-white"}
                  />
                  <path
                    d="M0 10 C5.523 10 10 5.523 10 0"
                    className={isDark ? "stroke-slate-800" : "stroke-slate-200"}
                    strokeWidth="1"
                    fill="none"
                  />
                </svg>

                {/* Right Chrome Fillet (Concave Flared Wing) */}
                <svg
                  className="absolute -right-[10px] bottom-0 w-[10px] h-[10px] pointer-events-none z-20"
                  viewBox="0 0 10 10"
                  fill="none"
                >
                  <path
                    d="M0 0 C0 5.523 4.477 10 10 10 L0 10 Z"
                    className={isDark ? "fill-slate-900" : "fill-white"}
                  />
                  <path
                    d="M0 0 C0 5.523 4.477 10 10 10"
                    className={isDark ? "stroke-slate-800" : "stroke-slate-200"}
                    strokeWidth="1"
                    fill="none"
                  />
                </svg>

                {/* Bottom Bridge: Seamlessly covers the 1px baseline border under tab & fillets */}
                <div
                  className={`absolute bottom-0 -left-[10px] -right-[10px] h-[2px] pointer-events-none ${
                    isDark ? "bg-slate-900" : "bg-white"
                  }`}
                />

                {/* Loan Icon */}
                <div className="p-1 rounded-md bg-sky-500/15 text-sky-400 shrink-0">
                  <LoanIcon size={13} />
                </div>

                {/* Loan Title / Rename Input */}
                <div className="flex-1 min-w-0">
                  {editingId === loan.id ? (
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") cancelRename();
                        }}
                        className={`w-full text-xs font-bold outline-none rounded px-1 py-0.5 border ${
                          isDark
                            ? "bg-slate-800 text-white border-sky-500"
                            : "bg-slate-100 text-slate-900 border-sky-500"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={commitRename}
                        className="text-emerald-400 hover:text-emerald-300"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-1.5 cursor-pointer"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startRename(loan);
                      }}
                    >
                      <span className="text-xs font-bold truncate">
                        {loan.name}
                      </span>
                      {/* Compact parameter badge */}
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md shrink-0 ${
                          isDark
                            ? "bg-slate-800/80 text-slate-400 border border-slate-700/60"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {compactPrincipal} · {loan.data.rate}%
                        {loan.data.customRates && loan.data.customRates.length > 0 ? " (Var)" : ""}
                      </span>
                    </div>
                  )}
                </div>

                {/* Edit Button (Visible on hover if not editing) */}
                {editingId !== loan.id && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(loan);
                    }}
                    className={`p-1 rounded-md opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity ${
                      isDark
                        ? "hover:bg-slate-800 text-slate-400"
                        : "hover:bg-slate-100 text-slate-600"
                    }`}
                    title="Rename scenario"
                  >
                    <Edit2 size={11} />
                  </button>
                )}

                {/* Close Tab Button */}
                {loans.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTab(loan.id);
                    }}
                    className={`p-1 rounded-full opacity-60 hover:opacity-100 transition-all ${
                      isDark
                        ? "hover:bg-slate-800 text-slate-400 hover:text-rose-400"
                        : "hover:bg-slate-200 text-slate-500 hover:text-rose-600"
                    }`}
                    title="Close scenario"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          }

          // Inactive Tab
          return (
            <React.Fragment key={loan.id}>
              <div
                className={`group relative flex items-center gap-2 pl-3 pr-2 h-[34px] mb-0.5 rounded-lg transition-all cursor-pointer ${
                  isDark
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-300/60"
                }`}
                style={{ minWidth: "120px", maxWidth: "210px" }}
                onClick={() => onSelectTab(loan.id)}
              >
                {/* Loan Icon */}
                <div
                  className={`p-0.5 rounded text-current opacity-70 group-hover:opacity-100`}
                >
                  <LoanIcon size={12} />
                </div>

                {/* Loan Title */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">
                      {loan.name}
                    </span>
                    <span
                      className={`text-[9px] font-mono opacity-60 group-hover:opacity-90 shrink-0`}
                    >
                      {compactPrincipal}
                    </span>
                  </div>
                </div>

                {/* Close Tab Button (shows on hover) */}
                {loans.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTab(loan.id);
                    }}
                    className={`p-1 rounded-full opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity ${
                      isDark
                        ? "hover:bg-slate-700 text-slate-400 hover:text-rose-400"
                        : "hover:bg-slate-200 text-slate-600 hover:text-rose-600"
                    }`}
                    title="Close scenario"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Inactive Tab Separator Divider */}
              {!isNextActive && idx < loans.length - 1 && (
                <div
                  className={`w-[1px] h-3.5 my-auto shrink-0 ${
                    isDark ? "bg-slate-800" : "bg-slate-300"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* ── Chrome "+" New Tab Button ────────────────────────────────────── */}
        <button
          type="button"
          onClick={onAddTab}
          className={`flex items-center justify-center w-7 h-7 mb-1 ml-1 rounded-full transition-all cursor-pointer shrink-0 ${
            isDark
              ? "text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-300 active:scale-95"
          }`}
          title="New Loan Scenario"
        >
          <Plus size={15} />
        </button>
      </div>

      {/* ── Tab Strip Right Action Controls ───────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-1 shrink-0 pb-0.5">
        {/* Compare All Scenarios Button */}
        {loans.length > 1 && (
          <button
            type="button"
            onClick={onOpenComparison}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
              isDark
                ? "bg-slate-900/80 hover:bg-slate-800 text-sky-400 border-slate-700/80 hover:border-sky-500/50"
                : "bg-white hover:bg-slate-100 text-sky-600 border-slate-300 shadow-xs"
            }`}
            title="Compare all loan scenarios side-by-side"
          >
            <GitCompare size={12} />
            <span className="hidden sm:inline">Compare</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/20 font-bold">
              {loans.length}
            </span>
          </button>
        )}

        {/* Duplicate Active Scenario Button */}
        <button
          type="button"
          onClick={() => onDuplicateTab(activeTabId)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
            isDark
              ? "bg-slate-900/60 hover:bg-slate-800 text-slate-300 border-slate-700/80"
              : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-xs"
          }`}
          title="Duplicate active loan scenario"
        >
          <Copy size={12} />
          <span className="hidden md:inline">Clone</span>
        </button>
      </div>
    </div>
  );
}
