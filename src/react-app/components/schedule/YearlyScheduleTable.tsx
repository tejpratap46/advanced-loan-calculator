import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ScheduleRow } from "../../types";
import type { TableColumnId } from "./tableColumns";

interface YearlyScheduleTableProps {
  schedule: ScheduleRow[];
  currency: string;
  locale?: string;
  isDark: boolean;
  hasOd: boolean;
  hasDirectPay?: boolean;
  cm: number;
  expandedMonths: Record<number, boolean>;
  toggleMonth: (m: number) => void;
  renderDailyBreakdown: (r: ScheduleRow) => React.ReactNode;
  visibleColumns?: TableColumnId[];
}

export function YearlyScheduleTable({
  schedule,
  currency,
  locale = "en-US",
  isDark,
  hasOd,
  hasDirectPay = false,
  cm,
  expandedMonths,
  toggleMonth,
  renderDailyBreakdown,
  visibleColumns,
}: YearlyScheduleTableProps) {
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({});

  const fmt = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  // Group schedule into yearly buckets
  const yearlyData = useMemo(() => {
    if (!schedule || schedule.length === 0) return [];

    const yearsMap: Record<
      number,
      {
        yearNum: number;
        label: string;
        months: ScheduleRow[];
        annualDisb: number;
        annualDirectPay: number;
        annualEmi: number;
        annualPrin: number;
        annualInt: number;
        annualSaved: number;
        yearEndBalance: number;
        isCurrent: boolean;
        isPaid: boolean;
        hasEvents: boolean;
      }
    > = {};

    schedule.forEach((row) => {
      const yearNum = Math.ceil(row.m / 12);
      if (!yearsMap[yearNum]) {
        yearsMap[yearNum] = {
          yearNum,
          label: `Year ${yearNum}`,
          months: [],
          annualDisb: 0,
          annualDirectPay: 0,
          annualEmi: 0,
          annualPrin: 0,
          annualInt: 0,
          annualSaved: 0,
          yearEndBalance: 0,
          isCurrent: false,
          isPaid: true,
          hasEvents: false,
        };
      }

      const y = yearsMap[yearNum];
      y.months.push(row);
      y.annualDisb += row.disbAmt || 0;
      y.annualDirectPay += row.directPayAmt || 0;
      y.annualEmi += row.emi || 0;
      y.annualPrin += row.prinPay || 0;
      y.annualInt += row.intPay || 0;
      y.annualSaved += row.interestSaved || 0;
      y.yearEndBalance = row.remaining;

      if (row.m === cm) y.isCurrent = true;
      if (row.m >= cm) y.isPaid = false;
      if (
        row.disbAmt > 0 ||
        (row.lumpAmt || 0) > 0 ||
        (row.directPayAmt || 0) > 0 ||
        row.payType === "custom"
      ) {
        y.hasEvents = true;
      }
    });

    return Object.values(yearsMap);
  }, [schedule, cm]);

  const toggleYear = (y: number) => {
    setExpandedYears((p) => ({ ...p, [y]: !p[y] }));
  };

  const toggleAllYears = () => {
    const allExp = yearlyData.every((y) => expandedYears[y.yearNum]);
    if (allExp) {
      setExpandedYears({});
    } else {
      const next: Record<number, boolean> = {};
      yearlyData.forEach((y) => {
        next[y.yearNum] = true;
      });
      setExpandedYears(next);
    }
  };

  const divider = isDark ? "border-slate-800/80" : "border-slate-200";
  const subtext = isDark ? "text-slate-400" : "text-slate-500";
  const heading = isDark ? "text-white" : "text-slate-900";

  const isColVisible = (id: TableColumnId) => {
    if (!visibleColumns) return true;
    return visibleColumns.includes(id);
  };

  const yearlyHeaders = useMemo(() => {
    const all = [
      { id: "m" as TableColumnId, label: "Year / Period" },
      { id: "status" as TableColumnId, label: "Status" },
      { id: "disbAmt" as TableColumnId, label: "Annual Disb" },
      ...(hasDirectPay ? [{ id: "directPayAmt" as TableColumnId, label: "Annual Direct Pay" }] : []),
      { id: "emi" as TableColumnId, label: "Annual EMI" },
      { id: "prinPay" as TableColumnId, label: "Annual Principal" },
      { id: "intPay" as TableColumnId, label: "Annual Interest" },
      { id: "interestSaved" as TableColumnId, label: "Interest Saved" },
      { id: "remaining" as TableColumnId, label: "Year-End Balance" },
    ];
    if (!visibleColumns) return all;
    return all.filter((col) => visibleColumns.includes(col.id));
  }, [visibleColumns, hasDirectPay]);

  const monthHeaders = useMemo(() => {
    const all = [
      { id: "m" as TableColumnId, label: "Mo" },
      { id: "date" as TableColumnId, label: "Date" },
      { id: "rate" as TableColumnId, label: "Rate" },
      { id: "disbAmt" as TableColumnId, label: "Disb" },
      ...(hasDirectPay ? [{ id: "directPayAmt" as TableColumnId, label: "Direct Pay" }] : []),
      { id: "emi" as TableColumnId, label: "EMI" },
      { id: "prinPay" as TableColumnId, label: "Principal" },
      { id: "intPay" as TableColumnId, label: "Interest" },
      { id: "interestSaved" as TableColumnId, label: "Saved" },
      ...(hasOd ? [{ id: "odBal" as TableColumnId, label: "OD Bal" }] : []),
      { id: "remaining" as TableColumnId, label: "Balance" },
    ];
    if (!visibleColumns) return all;
    return all.filter((col) => visibleColumns.includes(col.id));
  }, [visibleColumns, hasDirectPay, hasOd]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/5">
        <span className={`text-xs font-semibold ${subtext}`}>
          {yearlyData.length} Loan Years ({schedule.length} Months Total)
        </span>
        <button
          type="button"
          onClick={toggleAllYears}
          className={`text-xs px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-all border ${
            isDark
              ? "bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
          }`}
        >
          {yearlyData.every((y) => expandedYears[y.yearNum])
            ? "Collapse All Years"
            : "Expand All Years"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr
              className={`border-b ${divider} ${
                isDark ? "bg-slate-900/40" : "bg-slate-50/80"
              }`}
            >
              {yearlyHeaders.map((h) => (
                <th
                  key={h.id}
                  className={`px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-[10px] ${subtext} whitespace-nowrap`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yearlyData.map((y) => {
              const isYearExpanded = !!expandedYears[y.yearNum];
              const firstMonthDate = y.months[0]?.date || "";
              const lastMonthDate = y.months[y.months.length - 1]?.date || "";

              return (
                <React.Fragment key={y.yearNum}>
                  {/* Summary Year Row */}
                  <tr
                    className={`border-b transition-colors cursor-pointer ${divider} ${
                      y.isCurrent
                        ? isDark
                          ? "bg-sky-500/10 hover:bg-sky-500/15"
                          : "bg-sky-50 hover:bg-sky-100/70"
                        : isDark
                        ? "hover:bg-slate-800/40"
                        : "hover:bg-slate-100/60"
                    }`}
                    onClick={() => toggleYear(y.yearNum)}
                  >
                    {isColVisible("m") && (
                      <td className={`px-3 py-2.5 font-bold ${heading} whitespace-nowrap`}>
                        <div className="flex items-center gap-2">
                          <span
                            className={`p-1 rounded-md transition-colors ${
                              isDark ? "bg-slate-800 text-slate-300" : "bg-white text-slate-600 shadow-xs"
                            }`}
                          >
                            {isYearExpanded ? (
                              <ChevronDown size={14} className="text-sky-400" />
                            ) : (
                              <ChevronRight size={14} />
                            )}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span>{y.label}</span>
                              {y.isCurrent && (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-sky-500 text-white tracking-wide">
                                  CURRENT
                                </span>
                              )}
                              {y.hasEvents && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Includes Prepayments or Adjustments" />
                              )}
                            </div>
                            <span className={`text-[10px] font-normal ${subtext}`}>
                              {firstMonthDate} – {lastMonthDate}
                            </span>
                          </div>
                        </div>
                      </td>
                    )}

                    {isColVisible("status") && (
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {y.isPaid ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ✓ Completed
                          </span>
                        ) : y.isCurrent ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            In Progress
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isDark
                              ? "bg-slate-800/60 text-slate-400 border border-slate-700"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}>
                            Upcoming
                          </span>
                        )}
                      </td>
                    )}

                    {isColVisible("disbAmt") && (
                      <td className="px-3 py-2.5 text-sky-400 font-mono font-medium">
                        {y.annualDisb > 0 ? fmt(y.annualDisb) : "—"}
                      </td>
                    )}

                    {hasDirectPay && isColVisible("directPayAmt") && (
                      <td className="px-3 py-2.5 text-teal-400 font-mono font-medium">
                        {y.annualDirectPay > 0 ? fmt(y.annualDirectPay) : "—"}
                      </td>
                    )}

                    {isColVisible("emi") && (
                      <td className={`px-3 py-2.5 font-mono font-bold ${heading}`}>
                        {fmt(y.annualEmi)}
                      </td>
                    )}

                    {isColVisible("prinPay") && (
                      <td className="px-3 py-2.5 text-teal-400 font-mono font-medium">
                        {fmt(y.annualPrin)}
                      </td>
                    )}

                    {isColVisible("intPay") && (
                      <td className="px-3 py-2.5 text-amber-400 font-mono font-medium">
                        {fmt(y.annualInt)}
                      </td>
                    )}

                    {isColVisible("interestSaved") && (
                      <td className="px-3 py-2.5 text-emerald-400 font-mono font-semibold">
                        {y.annualSaved > 0 ? fmt(y.annualSaved) : "—"}
                      </td>
                    )}

                    {isColVisible("remaining") && (
                      <td className={`px-3 py-2.5 font-mono font-bold ${heading}`}>
                        {fmt(y.yearEndBalance)}
                      </td>
                    )}
                  </tr>

                  {/* Expanded Months for this Year */}
                  {isYearExpanded && (
                    <tr>
                      <td colSpan={yearlyHeaders.length} className="p-0">
                        <div
                          className={`p-3 pl-8 border-b ${
                            isDark ? "bg-slate-950/50" : "bg-slate-50/60"
                          } ${divider}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
                              Months in {y.label} ({firstMonthDate} – {lastMonthDate})
                            </span>
                            <span className={`text-[10px] ${subtext}`}>
                              Click month chevron for day-wise breakdown
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-white/5">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className={isDark ? "bg-slate-900/80" : "bg-white"}>
                                  {monthHeaders.map((h) => (
                                    <th key={h.id} className={`px-2 py-1.5 text-left text-[10px] ${subtext}`}>
                                      {h.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {y.months.map((r) => {
                                  const isCur = r.m === cm;
                                  const isMonthExpanded = !!expandedMonths[r.m];
                                  return (
                                    <React.Fragment key={r.m}>
                                      <tr
                                        className={`border-t ${divider} ${
                                          isCur
                                            ? isDark
                                              ? "bg-sky-500/10"
                                              : "bg-sky-50"
                                            : isDark
                                            ? "hover:bg-slate-800/30"
                                            : "hover:bg-slate-100/50"
                                        }`}
                                      >
                                        {isColVisible("m") && (
                                          <td className="px-2 py-1.5 font-medium whitespace-nowrap">
                                            <div className="flex items-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() => toggleMonth(r.m)}
                                                className={`p-0.5 rounded cursor-pointer ${
                                                  isDark ? "hover:bg-slate-700" : "hover:bg-slate-200"
                                                }`}
                                              >
                                                {isMonthExpanded ? (
                                                  <ChevronDown size={12} className="text-sky-400" />
                                                ) : (
                                                  <ChevronRight size={12} className="opacity-60" />
                                                )}
                                              </button>
                                              <span>M{r.m}</span>
                                              {isCur && (
                                                <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-sky-500 text-white">
                                                  NOW
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                        )}
                                        {isColVisible("date") && (
                                          <td className={`px-2 py-1.5 ${subtext}`}>{r.date}</td>
                                        )}
                                        {isColVisible("rate") && (
                                          <td className="px-2 py-1.5 text-indigo-400 font-mono text-[11px]">
                                            {r.rate !== undefined ? `${r.rate}%` : "—"}
                                          </td>
                                        )}
                                        {isColVisible("disbAmt") && (
                                          <td className="px-2 py-1.5 text-sky-400 font-mono">
                                            {r.disbAmt > 0 ? fmt(r.disbAmt) : "—"}
                                          </td>
                                        )}
                                        {hasDirectPay && isColVisible("directPayAmt") && (
                                          <td className="px-2 py-1.5 text-teal-400 font-mono">
                                            {(r.directPayAmt || 0) > 0 ? fmt(r.directPayAmt!) : "—"}
                                          </td>
                                        )}
                                        {isColVisible("emi") && (
                                          <td className={`px-2 py-1.5 font-mono font-semibold ${heading}`}>
                                            {r.emi > 0 ? fmt(r.emi) : "—"}
                                          </td>
                                        )}
                                        {isColVisible("prinPay") && (
                                          <td className="px-2 py-1.5 text-teal-400 font-mono">
                                            {r.prinPay > 0 ? fmt(r.prinPay) : "—"}
                                          </td>
                                        )}
                                        {isColVisible("intPay") && (
                                          <td className="px-2 py-1.5 text-amber-400 font-mono">
                                            {r.intPay > 0 ? fmt(r.intPay) : "—"}
                                          </td>
                                        )}
                                        {isColVisible("interestSaved") && (
                                          <td className="px-2 py-1.5 text-emerald-400 font-mono font-medium">
                                            {r.interestSaved > 0 ? fmt(r.interestSaved) : "—"}
                                          </td>
                                        )}
                                        {hasOd && isColVisible("odBal") && (
                                          <td className="px-2 py-1.5 text-emerald-400 font-mono">
                                            {r.odBal > 0 ? fmt(r.odBal) : "—"}
                                          </td>
                                        )}
                                        {isColVisible("remaining") && (
                                          <td className={`px-2 py-1.5 font-mono font-bold ${heading}`}>
                                            {fmt(r.remaining)}
                                          </td>
                                        )}
                                      </tr>

                                      {/* Day-Wise Breakdown if expanded */}
                                      {isMonthExpanded && (
                                        <tr>
                                          <td colSpan={monthHeaders.length} className="p-0">
                                            {renderDailyBreakdown(r)}
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
