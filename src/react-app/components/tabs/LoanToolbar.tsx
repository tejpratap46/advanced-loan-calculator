import { useState } from "react";
import {
  Edit2,
  Check,
  Copy,
  Share2,
  Download,
  RotateCcw,
  Sparkles,
  DollarSign,
  Percent,
  Calendar,
  Wallet,
} from "lucide-react";
import type { Loan, ScheduleRow } from "../../types";

interface LoanToolbarProps {
  activeLoan?: Loan;
  loansCount: number;
  activeLoanIndex: number;
  totals: {
    d: number;
    e: number;
    p: number;
    i: number;
    s: number;
    m: number;
  };
  schedule: ScheduleRow[];
  isDark: boolean;
  currency: string;
  locale: string;
  onRename: (newName: string) => void;
  onDuplicate: () => void;
  onShare: () => void;
  onExportCSV: () => void;
  onReset: () => void;
}

export function LoanToolbar({
  activeLoan,
  loansCount,
  activeLoanIndex,
  totals,
  schedule,
  isDark,
  currency,
  locale,
  onRename,
  onDuplicate,
  onShare,
  onExportCSV,
  onReset,
}: LoanToolbarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [nameVal, setNameVal] = useState(activeLoan?.name || "");

  const fmt = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  const startEdit = () => {
    setNameVal(activeLoan?.name || "");
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (nameVal.trim()) {
      onRename(nameVal.trim());
    }
    setIsEditing(false);
  };

  // Monthly EMI for current loan
  const monthlyEmi = schedule[0]?.emi || 0;
  const principal = activeLoan?.data.principal || 0;
  const rate = activeLoan?.data.rate || 0;
  const years = activeLoan?.data.years || 0;

  return (
    <div
      className={`px-4 sm:px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${
        isDark
          ? "border-slate-800 bg-slate-900/60"
          : "border-slate-200 bg-slate-50/60"
      }`}
    >
      {/* ── Left: Scenario Identity & Title ─────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
              isDark
                ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                : "bg-sky-50 text-sky-700 border-sky-200"
            }`}
          >
            Scenario {activeLoanIndex} of {loansCount}
          </span>

          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                type="text"
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setIsEditing(false);
                }}
                className={`text-sm font-bold px-2 py-0.5 rounded-lg border outline-none ${
                  isDark
                    ? "bg-slate-800 text-white border-sky-500"
                    : "bg-white text-slate-900 border-sky-500"
                }`}
              />
              <button
                type="button"
                onClick={saveEdit}
                className="p-1 rounded-md bg-emerald-500 text-white hover:bg-emerald-400 transition-colors"
              >
                <Check size={13} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <h2
                className={`text-sm sm:text-base font-extrabold tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {activeLoan?.name || "Loan Scenario"}
              </h2>
              <button
                type="button"
                onClick={startEdit}
                className={`p-1 rounded-md opacity-60 hover:opacity-100 transition-opacity ${
                  isDark
                    ? "hover:bg-slate-800 text-slate-400"
                    : "hover:bg-slate-200 text-slate-600"
                }`}
                title="Rename this scenario"
              >
                <Edit2 size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Middle: Omnibox Parameter Snapshot ─────────────────────────────── */}
      <div className="hidden xl:flex items-center gap-2">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border ${
            isDark
              ? "bg-slate-950/40 text-slate-300 border-slate-800"
              : "bg-white text-slate-700 border-slate-200"
          }`}
          title="Principal Loan Amount"
        >
          <DollarSign size={12} className="text-sky-400" />
          <span className="font-bold">{fmt(principal)}</span>
        </div>

        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border ${
            isDark
              ? "bg-slate-950/40 text-slate-300 border-slate-800"
              : "bg-white text-slate-700 border-slate-200"
          }`}
          title="Annual Interest Rate"
        >
          <Percent size={12} className="text-indigo-400" />
          <span className="font-bold">{rate.toFixed(2)}% p.a.</span>
        </div>

        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border ${
            isDark
              ? "bg-slate-950/40 text-slate-300 border-slate-800"
              : "bg-white text-slate-700 border-slate-200"
          }`}
          title="Loan Duration"
        >
          <Calendar size={12} className="text-emerald-400" />
          <span className="font-bold">{years} Years</span>
        </div>

        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border ${
            isDark
              ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
              : "bg-sky-50 text-sky-800 border-sky-200"
          }`}
          title="Monthly EMI Payment"
        >
          <Wallet size={12} className="text-sky-400" />
          <span>EMI:</span>
          <span className="font-bold">{fmt(monthlyEmi)}/mo</span>
        </div>

        {totals.s > 0 && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border ${
              isDark
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
            title="Interest saved through prepayment strategies"
          >
            <Sparkles size={12} className="text-emerald-400" />
            <span>Saved:</span>
            <span className="font-bold">{fmt(totals.s)}</span>
          </div>
        )}
      </div>

      {/* ── Right: Quick Action Buttons ────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDuplicate}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
            isDark
              ? "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700"
              : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs"
          }`}
          title="Clone this scenario for instant comparison"
        >
          <Copy size={13} />
          <span className="hidden sm:inline">Duplicate</span>
        </button>

        <button
          type="button"
          onClick={onShare}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
            isDark
              ? "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700"
              : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs"
          }`}
          title="Share loan scenario via URL"
        >
          <Share2 size={13} />
          <span className="hidden sm:inline">Share</span>
        </button>

        <button
          type="button"
          onClick={onExportCSV}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
            isDark
              ? "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700"
              : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs"
          }`}
          title="Download schedule CSV"
        >
          <Download size={13} />
          <span className="hidden sm:inline">CSV</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          className={`p-1.5 rounded-xl transition-all border cursor-pointer ${
            isDark
              ? "bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-amber-400 border-slate-700"
              : "bg-white hover:bg-slate-100 text-slate-500 hover:text-amber-600 border-slate-200 shadow-xs"
          }`}
          title="Reset parameters to defaults"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
}
