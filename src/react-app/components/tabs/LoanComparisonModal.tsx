import { useMemo } from "react";
import {
  X,
  Copy,
  Trash2,
  GitCompare,
  ArrowRight,
  TrendingDown,
  Sparkles,
} from "lucide-react";
import type { Loan } from "../../types";
import { calculateSchedule, calculateTotals } from "../../utils/calculations";

interface LoanComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  loans: Loan[];
  activeTabId: string;
  onSelectLoan: (id: string) => void;
  onDuplicateLoan: (id: string) => void;
  onDeleteLoan: (id: string) => void;
  isDark: boolean;
  currency: string;
  locale: string;
}

export function LoanComparisonModal({
  isOpen,
  onClose,
  loans,
  activeTabId,
  onSelectLoan,
  onDuplicateLoan,
  onDeleteLoan,
  isDark,
  currency,
  locale,
}: LoanComparisonModalProps) {
  const fmt = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  // Pre-calculate full metrics for all open loan scenarios
  const comparisons = useMemo(() => {
    return loans.map((l) => {
      const schedule = calculateSchedule(l.data, locale);
      const totals = calculateTotals(schedule, l.data.miscExpenses || []);

      const monthlyEmi = schedule[0]?.emi || 0;
      const totalPaidMonths = schedule.filter(
        (r) => r.remaining > 0 || r.emi > 0,
      ).length;
      const payoffYears = (totalPaidMonths / 12).toFixed(1);

      const totalCost = l.data.principal + totals.i + totals.m;

      const strategiesCount =
        (l.data.dispersals?.length || 0) +
        (l.data.customEmis?.length || 0) +
        (l.data.lumpSums?.length || 0) +
        (l.data.customRates?.length || 0) +
        (l.data.baselineOd ? 1 : 0);

      return {
        loan: l,
        schedule,
        totals,
        monthlyEmi,
        totalPaidMonths,
        payoffYears,
        totalCost,
        strategiesCount,
      };
    });
  }, [loans, locale]);

  // Find optimal scenarios
  const lowestInterestLoanId = useMemo(() => {
    if (comparisons.length === 0) return null;
    let min = comparisons[0];
    for (const c of comparisons) {
      if (c.totals.i < min.totals.i) {
        min = c;
      }
    }
    return min.loan.id;
  }, [comparisons]);

  const lowestEmiLoanId = useMemo(() => {
    if (comparisons.length === 0) return null;
    let min = comparisons[0];
    for (const c of comparisons) {
      if (c.monthlyEmi < min.monthlyEmi) {
        min = c;
      }
    }
    return min.loan.id;
  }, [comparisons]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-6xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden animate-scaleUp ${
          isDark
            ? "bg-[#0B0F19] border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ──────────────────────────────────────────────────── */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDark ? "border-slate-800/80 bg-slate-900/50" : "border-slate-200 bg-slate-50/80"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/15 text-sky-400">
              <GitCompare size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight">
                Scenario Comparison Matrix
              </h3>
              <p
                className={`text-xs ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Side-by-side analysis of all {loans.length} open loan tabs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl hover:bg-white/10 transition-colors ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Modal Body: Side-by-Side Comparison Cards ─────────────────────── */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {comparisons.map((c) => {
              const isCurrent = c.loan.id === activeTabId;
              const isLowestInterest = c.loan.id === lowestInterestLoanId && comparisons.length > 1;
              const isLowestEmi = c.loan.id === lowestEmiLoanId && comparisons.length > 1;

              return (
                <div
                  key={c.loan.id}
                  className={`flex flex-col justify-between rounded-2xl p-5 border transition-all ${
                    isCurrent
                      ? isDark
                        ? "bg-slate-900 border-sky-500/60 ring-2 ring-sky-500/20 shadow-xl"
                        : "bg-white border-sky-400 ring-2 ring-sky-400/20 shadow-xl"
                      : isDark
                      ? "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-bold truncate">
                            {c.loan.name}
                          </h4>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-500 text-white">
                              Active Tab
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-xs font-mono mt-0.5 ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          {fmt(c.loan.data.principal)} @ {c.loan.data.rate}%{c.loan.data.customRates && c.loan.data.customRates.length > 0 ? " (Var)" : ""} ·{" "}
                          {c.loan.data.years}y
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onDuplicateLoan(c.loan.id)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isDark
                              ? "border-slate-800 hover:bg-slate-800 text-slate-400"
                              : "border-slate-200 hover:bg-slate-100 text-slate-600"
                          }`}
                          title="Clone scenario"
                        >
                          <Copy size={12} />
                        </button>
                        {loans.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteLoan(c.loan.id)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isDark
                                ? "border-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                                : "border-slate-200 hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                            }`}
                            title="Delete scenario"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Special Highlights Badges */}
                    <div className="flex flex-wrap gap-1.5 mb-4 min-h-[22px]">
                      {isLowestInterest && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <TrendingDown size={11} /> Lowest Total Interest
                        </span>
                      )}
                      {isLowestEmi && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                          <Sparkles size={11} /> Lowest Monthly EMI
                        </span>
                      )}
                    </div>

                    {/* Metric Rows */}
                    <div className="space-y-2.5 mb-5 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-white/5">
                        <span
                          className={
                            isDark ? "text-slate-400" : "text-slate-500"
                          }
                        >
                          Monthly Payment (EMI)
                        </span>
                        <span className="font-mono font-bold text-sky-400 text-sm">
                          {fmt(c.monthlyEmi)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-white/5">
                        <span
                          className={
                            isDark ? "text-slate-400" : "text-slate-500"
                          }
                        >
                          Total Interest Payable
                        </span>
                        <span className="font-mono font-bold text-amber-400">
                          {fmt(c.totals.i)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-white/5">
                        <span
                          className={
                            isDark ? "text-slate-400" : "text-slate-500"
                          }
                        >
                          Interest Saved
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          {c.totals.s > 0 ? fmt(c.totals.s) : "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-white/5">
                        <span
                          className={
                            isDark ? "text-slate-400" : "text-slate-500"
                          }
                        >
                          Estimated Payoff
                        </span>
                        <span className="font-mono font-semibold">
                          {c.payoffYears} Years ({c.totalPaidMonths} mo)
                        </span>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-white/5">
                        <span
                          className={
                            isDark ? "text-slate-400" : "text-slate-500"
                          }
                        >
                          Total Loan Cost
                        </span>
                        <span className="font-mono font-bold">
                          {fmt(c.totalCost)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span
                          className={
                            isDark ? "text-slate-400" : "text-slate-500"
                          }
                        >
                          Active Strategies
                        </span>
                        <span className="font-mono font-medium">
                          {c.strategiesCount > 0 ? (
                            <span className="text-sky-400 font-semibold">
                              {c.strategiesCount} active
                            </span>
                          ) : (
                            <span
                              className={
                                isDark ? "text-slate-500" : "text-slate-400"
                              }
                            >
                              Standard
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Switch to this scenario button */}
                  <div>
                    {!isCurrent ? (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectLoan(c.loan.id);
                          onClose();
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                          isDark
                            ? "bg-slate-800 hover:bg-sky-500 hover:text-white border-slate-700 text-slate-200"
                            : "bg-white hover:bg-sky-500 hover:text-white border-slate-200 text-slate-800 shadow-xs"
                        }`}
                      >
                        <span>Switch to this Scenario</span>
                        <ArrowRight size={13} />
                      </button>
                    ) : (
                      <div
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold text-center border ${
                          isDark
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                            : "bg-sky-50 text-sky-700 border-sky-200"
                        }`}
                      >
                        ✓ Currently Viewing
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Modal Footer ──────────────────────────────────────────────────── */}
        <div
          className={`flex items-center justify-end px-6 py-3.5 border-t ${
            isDark ? "border-slate-800/80 bg-slate-900/50" : "border-slate-200 bg-slate-50/80"
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isDark
                ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                : "bg-white hover:bg-slate-100 text-slate-800 border-slate-200 shadow-xs"
            }`}
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>
  );
}
