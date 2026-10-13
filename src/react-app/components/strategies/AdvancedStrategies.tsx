import { useState } from "react";
import {
  Wallet,
  Percent,
  PiggyBank,
  TrendingUp,
  DollarSign,
  Receipt,
  Building2,
  X,
  LayoutGrid,
  Columns,
} from "lucide-react";
import type {
  LoanData,
  Dispersal,
  CustomEmi,
  CustomEmiType,
  ScheduleRow,
  LumpSum,
  CustomRate,
  DirectPayment,
  MiscExpense,
} from "../../types";
import { NumInput } from "../ui/NumInput";
import { StrInput } from "../ui/StrInput";
import { ActionBtn } from "../ui/ActionBtn";
import { CancelBtn } from "../ui/CancelBtn";

interface AdvancedStrategiesProps {
  data: LoanData;
  updateData: (u: Partial<LoanData>) => void;
  currency: string;
  locale?: string;
  isDark: boolean;
  getResolvedDate: (monthNum: number, dayNum: number) => string;
  externalActiveTab?: StrategyTab;
  onActiveTabChange?: (tab: StrategyTab) => void;
  schedule?: ScheduleRow[];
}

export type StrategyTab =
  | "dispersals"
  | "customEmis"
  | "lumpSums"
  | "rates"
  | "overdraft"
  | "directPayments"
  | "misc";

export function AdvancedStrategies({
  data,
  updateData,
  currency,
  locale = "en-US",
  isDark,
  getResolvedDate,
  externalActiveTab,
  onActiveTabChange,
  schedule,
}: AdvancedStrategiesProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<StrategyTab>("dispersals");
  const [layoutMode, setLayoutMode] = useState<"workbench" | "grid">("workbench");

  const activeTab = externalActiveTab ?? internalActiveTab;

  const setActiveTab = (tab: StrategyTab) => {
    setInternalActiveTab(tab);
    if (onActiveTabChange) onActiveTabChange(tab);
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  const getCalculatedPI = (m: number): number => {
    if (schedule && schedule.length > 0) {
      const r = schedule.find((row) => row.m === m);
      if (r) {
        return Math.round(r.stdEmi || (r.prinPay + r.intPay) || r.emi);
      }
    }
    const y = data.years || 1;
    const tm = y * 12;
    const rm = Math.max(1, tm - m + 1);
    const monthlyRate = (data.rate || 0) / 100 / 12;
    const p = data.principal || 0;
    if (p <= 0 || rm <= 0) return 0;
    if (monthlyRate === 0) return Math.round(p / rm);
    return Math.round(
      (p * monthlyRate * Math.pow(1 + monthlyRate, rm)) /
        (Math.pow(1 + monthlyRate, rm) - 1),
    );
  };

  // ── Sub-form states ────────────────────────────────────────────────────────
  const [newDisp, setNewDisp] = useState<{
    id?: string;
    month: number;
    day: number;
    amount: number;
    originalId?: string;
  }>({ month: 1, day: 1, amount: 0 });

  const [newEmi, setNewEmi] = useState<{
    id?: string;
    fromMonth: number;
    day: number;
    type: CustomEmiType;
    amount: string;
    originalId?: string;
  }>({ fromMonth: 1, day: 1, type: "interest_only", amount: "" });

  const [newLump, setNewLump] = useState<{
    id?: string;
    month: number;
    day: number;
    amount: string;
    originalId?: string;
  }>({ month: 0, day: 1, amount: "" });

  const [newRate, setNewRate] = useState<{
    id?: string;
    fromMonth: number;
    day: number;
    rate: string;
    originalId?: string;
  }>({ fromMonth: 1, day: 1, rate: "" });

  const [newOd, setNewOd] = useState<{
    fromMonth: number;
    amount: string;
    originalMonth?: number;
  }>({ fromMonth: 1, amount: "" });

  const [newMisc, setNewMisc] = useState<{
    id?: string;
    date: string;
    amount: string;
    comments: string;
    originalId?: string;
  }>({
    date: new Date().toISOString().split("T")[0],
    amount: "",
    comments: "",
  });

  const [newDirectPay, setNewDirectPay] = useState<{
    id?: string;
    month: number;
    day: number;
    amount: string;
    recipient: string;
    originalId?: string;
  }>({
    month: 1,
    day: 1,
    amount: "",
    recipient: "",
  });

  // ── Strategy action handlers ───────────────────────────────────────────────
  const addDisp = () => {
    if (newDisp.month < 1 || newDisp.month > data.years * 12 || newDisp.amount <= 0)
      return;
    const day = Math.min(31, Math.max(1, newDisp.day || 1));
    const current = data.dispersals || [];
    let updated: Dispersal[];
    if (newDisp.originalId) {
      updated = current.map((d) =>
        (d.id && d.id === newDisp.originalId) ||
        (!d.id && `${d.month}-${d.day || 1}` === newDisp.originalId)
          ? {
              id: d.id || newDisp.originalId,
              month: newDisp.month,
              day,
              amount: newDisp.amount,
            }
          : d,
      );
    } else {
      const newItem: Dispersal = {
        id: `disp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        month: newDisp.month,
        day,
        amount: newDisp.amount,
      };
      updated = [...current, newItem];
    }
    updateData({
      dispersals: updated.sort(
        (a, b) => a.month - b.month || (a.day || 1) - (b.day || 1),
      ),
    });
    setNewDisp({ month: 1, day: 1, amount: 0 });
  };

  const addCEmi = () => {
    if (newEmi.fromMonth < 1) return;
    const day = Math.min(31, Math.max(1, newEmi.day || 1));
    const current = data.customEmis || [];
    const minPI = getCalculatedPI(newEmi.fromMonth);

    let finalAmount: number | undefined = undefined;
    if (newEmi.type === "custom") {
      const a = parseFloat(newEmi.amount);
      if (!a || a <= 0) return;
      if (minPI > 0 && a <= minPI) return;
      finalAmount = a;
    }

    let updated: CustomEmi[];
    if (newEmi.originalId) {
      updated = current.map((e) =>
        (e.id && e.id === newEmi.originalId) ||
        (!e.id && `${e.fromMonth}-${e.day || 1}` === newEmi.originalId)
          ? {
              id: e.id || newEmi.originalId,
              fromMonth: newEmi.fromMonth,
              day,
              type: newEmi.type,
              amount: finalAmount,
            }
          : e,
      );
    } else {
      const newItem: CustomEmi = {
        id: `emi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fromMonth: newEmi.fromMonth,
        day,
        type: newEmi.type,
        amount: finalAmount,
      };
      updated = [...current, newItem];
    }
    updateData({
      customEmis: updated.sort(
        (a, b) => a.fromMonth - b.fromMonth || (a.day || 1) - (b.day || 1),
      ),
    });
    setNewEmi({ fromMonth: 1, day: 1, type: "interest_only", amount: "" });
  };

  const addLS = () => {
    const a = parseFloat(newLump.amount);
    const m = newLump.month;
    if (!a || a <= 0 || m < 0) return;
    const day = Math.min(31, Math.max(1, newLump.day || 1));
    const current = data.lumpSums || [];
    let updated: LumpSum[];
    if (newLump.originalId) {
      updated = current.map((l) =>
        (l.id && l.id === newLump.originalId) ||
        (!l.id && `${l.month}-${l.day || 1}` === newLump.originalId)
          ? {
              id: l.id || newLump.originalId,
              month: m,
              day,
              amount: a,
            }
          : l,
      );
    } else {
      const newItem: LumpSum = {
        id: `lump-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        month: m,
        day,
        amount: a,
      };
      updated = [...current, newItem];
    }
    updateData({
      lumpSums: updated.sort(
        (a, b) => a.month - b.month || (a.day || 1) - (b.day || 1),
      ),
    });
    setNewLump({ month: 0, day: 1, amount: "" });
  };

  const addRate = () => {
    const r = parseFloat(newRate.rate);
    if (isNaN(r) || r <= 0 || newRate.fromMonth < 1) return;
    const day = Math.min(31, Math.max(1, newRate.day || 1));
    const current = data.customRates || [];
    let updated: CustomRate[];
    if (newRate.originalId) {
      updated = current.map((item) =>
        (item.id && item.id === newRate.originalId) ||
        (!item.id && `${item.fromMonth}-${item.day || 1}` === newRate.originalId)
          ? {
              id: item.id || newRate.originalId,
              fromMonth: newRate.fromMonth,
              day,
              rate: r,
            }
          : item,
      );
    } else {
      const newItem: CustomRate = {
        id: `rate-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fromMonth: newRate.fromMonth,
        day,
        rate: r,
      };
      updated = [...current, newItem];
    }
    updateData({
      customRates: updated.sort(
        (a, b) => a.fromMonth - b.fromMonth || (a.day || 1) - (b.day || 1),
      ),
    });
    setNewRate({ fromMonth: 1, day: 1, rate: "" });
  };

  const addOd = () => {
    const a = parseFloat(newOd.amount);
    if (isNaN(a) || a < 0) return;
    const item = { fromMonth: newOd.fromMonth, amount: a };
    const current = data.customOds || [];
    updateData({
      customOds: [
        ...current.filter(
          (o) => o.fromMonth !== (newOd.originalMonth ?? newOd.fromMonth),
        ),
        item,
      ].sort((a, b) => a.fromMonth - b.fromMonth),
    });
    setNewOd({ fromMonth: 1, amount: "" });
  };

  const addMisc = () => {
    const amt = parseFloat(newMisc.amount);
    if (isNaN(amt) || amt <= 0 || !newMisc.date) return;
    const current = data.miscExpenses || [];
    let updated: MiscExpense[];
    if (newMisc.originalId) {
      updated = current.map((m) =>
        m.id === newMisc.originalId
          ? {
              id: m.id,
              date: newMisc.date,
              amount: amt,
              comments: newMisc.comments || "",
            }
          : m,
      );
    } else {
      const newItem: MiscExpense = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
        date: newMisc.date,
        amount: amt,
        comments: newMisc.comments || "",
      };
      updated = [...current, newItem];
    }
    updateData({ miscExpenses: updated });
    setNewMisc({
      date: new Date().toISOString().split("T")[0],
      amount: "",
      comments: "",
    });
  };

  const addDirectPay = () => {
    const a = parseFloat(newDirectPay.amount);
    if (isNaN(a) || a <= 0 || newDirectPay.month < 1 || newDirectPay.month > data.years * 12)
      return;
    const day = Math.min(31, Math.max(1, newDirectPay.day || 1));
    const current = data.directPayments || [];
    let updated: DirectPayment[];
    if (newDirectPay.originalId) {
      updated = current.map((dp) =>
        (dp.id && dp.id === newDirectPay.originalId) ||
        (!dp.id && `${dp.month}-${dp.day || 1}` === newDirectPay.originalId)
          ? {
              id: dp.id || newDirectPay.originalId,
              month: newDirectPay.month,
              day,
              amount: a,
              recipient: newDirectPay.recipient.trim() || undefined,
            }
          : dp,
      );
    } else {
      const newItem: DirectPayment = {
        id: `direct-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        month: newDirectPay.month,
        day,
        amount: a,
        recipient: newDirectPay.recipient.trim() || undefined,
      };
      updated = [...current, newItem];
    }
    updateData({
      directPayments: updated.sort(
        (a, b) => a.month - b.month || (a.day || 1) - (b.day || 1),
      ),
    });
    setNewDirectPay({ month: 1, day: 1, amount: "", recipient: "" });
  };

  // ── Tokens & Styling ───────────────────────────────────────────────────────
  const subtext = isDark ? "text-slate-400" : "text-slate-500";
  const heading = isDark ? "text-white" : "text-slate-900";
  const divider = isDark ? "border-slate-800/80" : "border-slate-200";

  // Strategy tabs metadata
  const tabs = [
    {
      id: "dispersals" as StrategyTab,
      label: "Disbursements",
      shortLabel: "Disb",
      icon: <Wallet size={14} />,
      count: data.dispersals.length,
      accentColor: "sky",
      badgeClass: isDark
        ? "bg-sky-500/10 text-sky-300 border-sky-500/20"
        : "bg-sky-50 text-sky-700 border-sky-200",
      activeTabStyle: isDark
        ? "bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-xs"
        : "bg-sky-50 text-sky-800 border-sky-300 shadow-xs",
    },
    {
      id: "customEmis" as StrategyTab,
      label: "Custom EMI",
      shortLabel: "EMI",
      icon: <Percent size={14} />,
      count: data.customEmis.length,
      accentColor: "violet",
      badgeClass: isDark
        ? "bg-violet-500/10 text-violet-300 border-violet-500/20"
        : "bg-violet-50 text-violet-700 border-violet-200",
      activeTabStyle: isDark
        ? "bg-violet-500/20 text-violet-300 border-violet-500/40 shadow-xs"
        : "bg-violet-50 text-violet-800 border-violet-300 shadow-xs",
    },
    {
      id: "lumpSums" as StrategyTab,
      label: "Lump Sum Prepayments",
      shortLabel: "Lump",
      icon: <PiggyBank size={14} />,
      count: data.lumpSums.length,
      accentColor: "amber",
      badgeClass: isDark
        ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
        : "bg-amber-50 text-amber-700 border-amber-200",
      activeTabStyle: isDark
        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs"
        : "bg-amber-50 text-amber-800 border-amber-300 shadow-xs",
    },
    {
      id: "rates" as StrategyTab,
      label: "Interest Rates",
      shortLabel: "Rates",
      icon: <TrendingUp size={14} />,
      count: data.customRates?.length || 0,
      accentColor: "indigo",
      badgeClass: isDark
        ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
        : "bg-indigo-50 text-indigo-700 border-indigo-200",
      activeTabStyle: isDark
        ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-xs"
        : "bg-indigo-50 text-indigo-800 border-indigo-300 shadow-xs",
    },
    {
      id: "overdraft" as StrategyTab,
      label: "Offset / Overdraft",
      shortLabel: "Offset",
      icon: <DollarSign size={14} />,
      count: (data.baselineOd ? 1 : 0) + (data.customOds?.length || 0),
      accentColor: "emerald",
      badgeClass: isDark
        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
        : "bg-emerald-50 text-emerald-700 border-emerald-200",
      activeTabStyle: isDark
        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs"
        : "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs",
    },
    {
      id: "directPayments" as StrategyTab,
      label: "Direct Payments",
      shortLabel: "Direct",
      icon: <Building2 size={14} />,
      count: data.directPayments?.length || 0,
      accentColor: "teal",
      badgeClass: isDark
        ? "bg-teal-500/10 text-teal-300 border-teal-500/20"
        : "bg-teal-50 text-teal-700 border-teal-200",
      activeTabStyle: isDark
        ? "bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-xs"
        : "bg-teal-50 text-teal-800 border-teal-300 shadow-xs",
    },
    {
      id: "misc" as StrategyTab,
      label: "Fees & Charges",
      shortLabel: "Fees",
      icon: <Receipt size={14} />,
      count: data.miscExpenses?.length || 0,
      accentColor: "orange",
      badgeClass: isDark
        ? "bg-orange-500/10 text-orange-300 border-orange-500/20"
        : "bg-orange-50 text-orange-700 border-orange-200",
      activeTabStyle: isDark
        ? "bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-xs"
        : "bg-orange-50 text-orange-800 border-orange-300 shadow-xs",
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header: Title & Layout Switcher ──────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div>
          <h2 className={`text-sm font-bold uppercase tracking-wider ${heading}`}>
            Advanced Financial Strategies
          </h2>
          <p className={`text-[11px] ${subtext}`}>
            Configure staggered disbursements, custom EMI step-ups, prepayments, and offset savings
          </p>
        </div>

        {/* View Layout Toggle: Horizontal Workbench vs Multi-column Grid */}
        <div
          className={`flex items-center p-0.5 rounded-xl border ${
            isDark ? "bg-slate-900/80 border-slate-700/80" : "bg-slate-100 border-slate-200"
          }`}
        >
          <button
            type="button"
            onClick={() => setLayoutMode("workbench")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              layoutMode === "workbench"
                ? "bg-sky-500 text-white shadow-xs"
                : isDark
                ? "text-slate-400 hover:text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Compact horizontal workbench (Side-by-side active items & form)"
          >
            <Columns size={13} />
            <span>Horizontal Workbench</span>
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode("grid")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              layoutMode === "grid"
                ? "bg-sky-500 text-white shadow-xs"
                : isDark
                ? "text-slate-400 hover:text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Multi-column side-by-side grid"
          >
            <LayoutGrid size={13} />
            <span>Side-by-Side Grid</span>
          </button>
        </div>
      </div>

      {/* ── MODE 1: HORIZONTAL WORKBENCH (Compact, High-Density) ──────────── */}
      {layoutMode === "workbench" && (
        <div className="space-y-4">
          {/* Horizontal Segmented Tabs Navigation Bar */}
          <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden py-1 no-scrollbar">
            {tabs.map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                    isActive
                      ? t.activeTabStyle
                      : isDark
                      ? "bg-slate-900/40 text-slate-400 border-slate-800/80 hover:bg-slate-800 hover:text-slate-200"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900 shadow-xs"
                  }`}
                >
                  <span className="opacity-80">{t.icon}</span>
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold border ${t.badgeClass}`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Tab: 2-Column Horizontal Workbench (Left: Entries; Right: Inline Form) */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isDark
                ? "bg-slate-900/40 border-slate-800/80"
                : "bg-slate-50/70 border-slate-200/80"
            }`}
          >
            {/* 1. DISBURSEMENTS TAB */}
            {activeTab === "dispersals" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left: Active Entries (5 cols) */}
                <div className="lg:col-span-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wider ${heading}`}>
                      Scheduled Disbursements ({data.dispersals.length})
                    </span>
                    <span className="text-xs font-mono font-bold text-sky-400">
                      Total: {fmt(data.dispersals.reduce((s, d) => s + (d.amount || 0), 0))}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {data.dispersals.length === 0 ? (
                      <span className={`text-xs italic ${subtext}`}>
                        No staggered disbursements configured.
                      </span>
                    ) : (
                      data.dispersals
                        .sort((a, b) => a.month - b.month || (a.day || 1) - (b.day || 1))
                        .map((d) => (
                          <span
                            key={d.id || `${d.month}-${d.day}`}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-xs ${
                              isDark
                                ? "bg-sky-500/10 text-sky-300 border-sky-500/20"
                                : "bg-sky-50 text-sky-700 border-sky-200"
                            }`}
                          >
                            <span
                              className="cursor-pointer hover:underline"
                              onClick={() => {
                                setNewDisp({
                                  id: d.id,
                                  month: d.month,
                                  day: d.day || 1,
                                  amount: d.amount,
                                  originalId: d.id || `${d.month}-${d.day || 1}`,
                                });
                              }}
                              title="Click to edit"
                            >
                              M{d.month} · D{d.day || 1}: {fmt(d.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateData({
                                  dispersals: data.dispersals.filter((x) =>
                                    d.id
                                      ? x.id !== d.id
                                      : x.month !== d.month || (x.day || 1) !== (d.day || 1),
                                  ),
                                })
                              }
                              className="hover:opacity-60 transition-opacity p-0.5 rounded cursor-pointer"
                              title="Remove"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))
                    )}
                  </div>
                </div>

                {/* Right: Inline Add / Edit Form (7 cols) */}
                <div
                  className={`lg:col-span-7 p-3.5 rounded-xl border ${
                    isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold ${subtext}`}>
                      {newDisp.originalId ? "Edit Disbursement" : "Add Staggered Tranche"}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-lg font-mono border ${
                        isDark
                          ? "bg-sky-500/10 text-sky-300 border-sky-500/20"
                          : "bg-sky-50 text-sky-700 border-sky-200"
                      }`}
                    >
                      📅 {getResolvedDate(newDisp.month, newDisp.day)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <NumInput
                      placeholder="Month"
                      value={newDisp.month}
                      onChange={(v) => setNewDisp({ ...newDisp, month: v })}
                      onEnter={addDisp}
                      isDark={isDark}
                      min={1}
                      max={data.years * 12}
                    />
                    <NumInput
                      placeholder="Day (1-31)"
                      value={newDisp.day}
                      onChange={(v) =>
                        setNewDisp({ ...newDisp, day: Math.min(31, Math.max(1, v)) })
                      }
                      onEnter={addDisp}
                      isDark={isDark}
                      min={1}
                      max={31}
                    />
                    <NumInput
                      placeholder="Amount"
                      value={newDisp.amount}
                      onChange={(v) => setNewDisp({ ...newDisp, amount: v })}
                      onEnter={addDisp}
                      isDark={isDark}
                    />
                    <ActionBtn onClick={addDisp} color="sky" isDark={isDark}>
                      {newDisp.originalId ? "Save" : "Add Disbursement"}
                    </ActionBtn>
                    {newDisp.originalId && (
                      <CancelBtn
                        onClick={() => setNewDisp({ month: 1, day: 1, amount: 0 })}
                        isDark={isDark}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. CUSTOM EMI TAB */}
            {activeTab === "customEmis" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wider ${heading}`}>
                      Custom EMI Overrides ({data.customEmis.length})
                    </span>
                    <span className={`text-xs ${subtext}`}>
                      Step-up, interest-only, or recalculated payments
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {data.customEmis.length === 0 ? (
                      <span className={`text-xs italic ${subtext}`}>
                        Standard EMI applies every month. Add overrides below.
                      </span>
                    ) : (
                      data.customEmis
                        .sort((a, b) => a.fromMonth - b.fromMonth || (a.day || 1) - (b.day || 1))
                        .map((e) => {
                          const eType =
                            e.type || (e.amount !== undefined && e.amount > 0 ? "custom" : "interest_only");
                          const label =
                            eType === "interest_only"
                              ? `From M${e.fromMonth} · D${e.day || 1}: Only Interest`
                              : eType === "recalculated"
                              ? `From M${e.fromMonth} · D${e.day || 1}: Recalculated EMI`
                              : `From M${e.fromMonth} · D${e.day || 1}: ${fmt(e.amount || 0)}`;

                          return (
                            <span
                              key={e.id || `${e.fromMonth}-${e.day}`}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-xs ${
                                isDark
                                  ? "bg-violet-500/10 text-violet-300 border-violet-500/20"
                                  : "bg-violet-50 text-violet-700 border-violet-200"
                              }`}
                            >
                              <span
                                className="cursor-pointer hover:underline"
                                onClick={() => {
                                  setNewEmi({
                                    id: e.id,
                                    fromMonth: e.fromMonth,
                                    day: e.day || 1,
                                    type: eType,
                                    amount: e.amount ? e.amount.toString() : "",
                                    originalId: e.id || `${e.fromMonth}-${e.day || 1}`,
                                  });
                                }}
                                title="Click to edit"
                              >
                                {label}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateData({
                                    customEmis: data.customEmis.filter((x) =>
                                      e.id
                                        ? x.id !== e.id
                                        : x.fromMonth !== e.fromMonth ||
                                          (x.day || 1) !== (e.day || 1),
                                    ),
                                  })
                                }
                                className="hover:opacity-60 transition-opacity p-0.5 rounded cursor-pointer"
                                title="Remove"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          );
                        })
                    )}
                  </div>
                </div>

                <div
                  className={`lg:col-span-7 p-3.5 rounded-xl border ${
                    isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold ${subtext}`}>
                      {newEmi.originalId ? "Edit Custom EMI Rule" : "Configure Custom EMI Rule"}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-lg font-mono border ${
                        isDark
                          ? "bg-violet-500/10 text-violet-300 border-violet-500/20"
                          : "bg-violet-50 text-violet-700 border-violet-200"
                      }`}
                    >
                      📅 {getResolvedDate(newEmi.fromMonth, newEmi.day)}
                    </span>
                  </div>

                  {/* Month & Day Inputs */}
                  <div className="flex flex-wrap gap-2 items-center mb-3">
                    <NumInput
                      placeholder="From Month"
                      value={newEmi.fromMonth}
                      onChange={(v) => setNewEmi({ ...newEmi, fromMonth: v })}
                      onEnter={addCEmi}
                      isDark={isDark}
                      min={1}
                      max={data.years * 12}
                    />
                    <NumInput
                      placeholder="Day (1-31)"
                      value={newEmi.day}
                      onChange={(v) =>
                        setNewEmi({ ...newEmi, day: Math.min(31, Math.max(1, v)) })
                      }
                      onEnter={addCEmi}
                      isDark={isDark}
                      min={1}
                      max={31}
                    />
                  </div>

                  {/* 3-Option Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setNewEmi({ ...newEmi, type: "interest_only" })}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        newEmi.type === "interest_only"
                          ? isDark
                            ? "bg-violet-500/20 border-violet-500 text-violet-200 ring-1 ring-violet-500/50"
                            : "bg-violet-50 border-violet-500 text-violet-900 ring-1 ring-violet-500/40"
                          : isDark
                          ? "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-violet-500/20 text-violet-400">
                          1
                        </span>
                        <span>Only Interest</span>
                      </div>
                      <p className={`text-[10px] mt-0.5 ${subtext}`}>
                        No Principal paid; only monthly interest is paid.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewEmi({ ...newEmi, type: "recalculated" })}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        newEmi.type === "recalculated"
                          ? isDark
                            ? "bg-violet-500/20 border-violet-500 text-violet-200 ring-1 ring-violet-500/50"
                            : "bg-violet-50 border-violet-500 text-violet-900 ring-1 ring-violet-500/40"
                          : isDark
                          ? "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-violet-500/20 text-violet-400">
                          2
                        </span>
                        <span>Calculated P + I</span>
                      </div>
                      <p className={`text-[10px] mt-0.5 ${subtext}`}>
                        Recalculate exact P + I for remaining balance.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewEmi({ ...newEmi, type: "custom" })}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        newEmi.type === "custom"
                          ? isDark
                            ? "bg-violet-500/20 border-violet-500 text-violet-200 ring-1 ring-violet-500/50"
                            : "bg-violet-50 border-violet-500 text-violet-900 ring-1 ring-violet-500/40"
                          : isDark
                          ? "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-violet-500/20 text-violet-400">
                          3
                        </span>
                        <span>Custom Higher</span>
                      </div>
                      <p className={`text-[10px] mt-0.5 ${subtext}`}>
                        Custom payment higher than calculated P + I.
                      </p>
                    </button>
                  </div>

                  {/* Mode-Specific Details & Inputs */}
                  {(() => {
                    const minPIForMonth = getCalculatedPI(newEmi.fromMonth);
                    const customAmtNum = parseFloat(newEmi.amount) || 0;
                    const isCustomInvalid =
                      newEmi.type === "custom" &&
                      (customAmtNum <= 0 || (minPIForMonth > 0 && customAmtNum <= minPIForMonth));

                    return (
                      <div>
                        {newEmi.type === "interest_only" && (
                          <div
                            className={`p-2.5 rounded-lg border text-xs mb-3 flex items-center gap-2 ${
                              isDark
                                ? "bg-violet-500/10 border-violet-500/20 text-violet-300"
                                : "bg-violet-50 border-violet-200 text-violet-800"
                            }`}
                          >
                            <span>💡</span>
                            <span>
                              Starting from Month {newEmi.fromMonth}, <strong>zero principal</strong> will be deducted. Only the monthly interest on outstanding balance will be charged.
                            </span>
                          </div>
                        )}

                        {newEmi.type === "recalculated" && (
                          <div
                            className={`p-2.5 rounded-lg border text-xs mb-3 flex items-center gap-2 ${
                              isDark
                                ? "bg-violet-500/10 border-violet-500/20 text-violet-300"
                                : "bg-violet-50 border-violet-200 text-violet-800"
                            }`}
                          >
                            <span>💡</span>
                            <span>
                              Starting from Month {newEmi.fromMonth}, EMI will be automatically recalculated to{" "}
                              <strong>{minPIForMonth > 0 ? fmt(minPIForMonth) : "standard amortization"}</strong> for the remaining principal and tenure.
                            </span>
                          </div>
                        )}

                        {newEmi.type === "custom" && (
                          <div className="space-y-2 mb-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <StrInput
                                placeholder="Custom EMI Amount"
                                value={newEmi.amount}
                                onChange={(v) => setNewEmi({ ...newEmi, amount: v })}
                                onEnter={addCEmi}
                                isDark={isDark}
                              />
                              {minPIForMonth > 0 && (
                                <span
                                  className={`text-[11px] font-mono px-2 py-1 rounded-md border ${
                                    isDark
                                      ? "bg-slate-800 text-slate-300 border-slate-700"
                                      : "bg-slate-100 text-slate-700 border-slate-200"
                                  }`}
                                >
                                  Calculated P+I: {fmt(minPIForMonth)}
                                </span>
                              )}
                            </div>
                            {newEmi.amount && customAmtNum > 0 && minPIForMonth > 0 && customAmtNum <= minPIForMonth && (
                              <p className="text-[11px] text-rose-400 font-medium">
                                ⚠️ Custom amount must be higher than current calculated Principal & Interest ({fmt(minPIForMonth)}).
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <ActionBtn
                            onClick={addCEmi}
                            color="violet"
                            isDark={isDark}
                            disabled={newEmi.type === "custom" ? isCustomInvalid : false}
                          >
                            {newEmi.originalId ? "Save" : "Set Custom EMI"}
                          </ActionBtn>
                          {newEmi.originalId && (
                            <CancelBtn
                              onClick={() =>
                                setNewEmi({
                                  fromMonth: 1,
                                  day: 1,
                                  type: "interest_only",
                                  amount: "",
                                })
                              }
                              isDark={isDark}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* 3. LUMP SUM TAB */}
            {activeTab === "lumpSums" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wider ${heading}`}>
                      Prepayments & Down Payments ({data.lumpSums.length})
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      Total: {fmt(data.lumpSums.reduce((s, l) => s + (l.amount || 0), 0))}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {data.lumpSums.length === 0 ? (
                      <span className={`text-xs italic ${subtext}`}>
                        No prepayments configured. Add one to accelerate loan payoff!
                      </span>
                    ) : (
                      data.lumpSums
                        .sort((a, b) => a.month - b.month || (a.day || 1) - (b.day || 1))
                        .map((l) => (
                          <span
                            key={l.id || `${l.month}-${l.day}`}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-xs ${
                              isDark
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            <span
                              className="cursor-pointer hover:underline"
                              onClick={() => {
                                setNewLump({
                                  id: l.id,
                                  month: l.month,
                                  day: l.day || 1,
                                  amount: l.amount.toString(),
                                  originalId: l.id || `${l.month}-${l.day || 1}`,
                                });
                              }}
                              title="Click to edit"
                            >
                              {l.month === 0 ? "Down Payment" : `M${l.month} · D${l.day || 1}`}: {fmt(l.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateData({
                                  lumpSums: data.lumpSums.filter((x) =>
                                    l.id
                                      ? x.id !== l.id
                                      : x.month !== l.month || (x.day || 1) !== (l.day || 1),
                                  ),
                                })
                              }
                              className="hover:opacity-60 transition-opacity p-0.5 rounded cursor-pointer"
                              title="Remove"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))
                    )}
                  </div>
                </div>

                <div
                  className={`lg:col-span-7 p-3.5 rounded-xl border ${
                    isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold ${subtext}`}>
                      {newLump.originalId ? "Edit Prepayment" : "Add Lump Sum / Down Payment"}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-lg font-mono border ${
                        isDark
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      📅 {getResolvedDate(Math.max(1, newLump.month), newLump.day)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <NumInput
                      placeholder="Month (0=down)"
                      value={newLump.month}
                      onChange={(v) => setNewLump({ ...newLump, month: v })}
                      onEnter={addLS}
                      isDark={isDark}
                      min={0}
                      max={data.years * 12}
                    />
                    <NumInput
                      placeholder="Day (1-31)"
                      value={newLump.day}
                      onChange={(v) =>
                        setNewLump({ ...newLump, day: Math.min(31, Math.max(1, v)) })
                      }
                      onEnter={addLS}
                      isDark={isDark}
                      min={1}
                      max={31}
                    />
                    <StrInput
                      placeholder="Prepayment Amount"
                      value={newLump.amount}
                      onChange={(v) => setNewLump({ ...newLump, amount: v })}
                      onEnter={addLS}
                      isDark={isDark}
                    />
                    <ActionBtn onClick={addLS} color="amber" isDark={isDark}>
                      {newLump.originalId ? "Save" : "Add Prepayment"}
                    </ActionBtn>
                    {newLump.originalId && (
                      <CancelBtn
                        onClick={() => setNewLump({ month: 0, day: 1, amount: "" })}
                        isDark={isDark}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 4. INTEREST RATES TAB */}
            {activeTab === "rates" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wider ${heading}`}>
                      Interest Rate Schedule ({(data.customRates?.length || 0) + 1})
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      Initial: {data.rate}% p.a.
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {/* Baseline / Initial rate badge */}
                    <span
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-xs ${
                        isDark
                          ? "bg-slate-800/80 text-slate-300 border-slate-700/80"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                      title="Initial loan interest rate from first payment date"
                    >
                      <span>M1 · D1: {data.rate}% p.a. (Initial)</span>
                    </span>

                    {/* Configured custom rate revisions */}
                    {(data.customRates || [])
                      .slice()
                      .sort((a, b) => a.fromMonth - b.fromMonth || (a.day || 1) - (b.day || 1))
                      .map((r) => (
                        <span
                          key={r.id || `${r.fromMonth}-${r.day}`}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-xs ${
                            isDark
                              ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                              : "bg-indigo-50 text-indigo-700 border-indigo-200"
                          }`}
                        >
                          <span
                            className="cursor-pointer hover:underline"
                            onClick={() => {
                              setNewRate({
                                id: r.id,
                                fromMonth: r.fromMonth,
                                day: r.day || 1,
                                rate: r.rate.toString(),
                                originalId: r.id || `${r.fromMonth}-${r.day || 1}`,
                              });
                            }}
                            title="Click to edit rate change"
                          >
                            From M{r.fromMonth} · D{r.day || 1}: {r.rate}% p.a.
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateData({
                                customRates: (data.customRates || []).filter((x) =>
                                  r.id
                                    ? x.id !== r.id
                                    : x.fromMonth !== r.fromMonth ||
                                      (x.day || 1) !== (r.day || 1),
                                ),
                              })
                            }
                            className="hover:opacity-60 transition-opacity p-0.5 rounded cursor-pointer"
                            title="Remove rate revision"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}

                    {(!data.customRates || data.customRates.length === 0) && (
                      <span className={`text-xs italic ${subtext}`}>
                        Fixed {data.rate}% p.a. applies for entire loan. Add variable rate changes below.
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className={`lg:col-span-7 p-3.5 rounded-xl border ${
                    isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold ${subtext}`}>
                      {newRate.originalId ? "Edit Rate Revision" : "Add Variable Rate Revision"}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-lg font-mono border ${
                        isDark
                          ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                          : "bg-indigo-50 text-indigo-700 border-indigo-200"
                      }`}
                    >
                      📅 {getResolvedDate(newRate.fromMonth, newRate.day)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <NumInput
                      placeholder="From Month"
                      value={newRate.fromMonth}
                      onChange={(v) => setNewRate({ ...newRate, fromMonth: v })}
                      onEnter={addRate}
                      isDark={isDark}
                      min={1}
                      max={data.years * 12}
                    />
                    <NumInput
                      placeholder="Day (1-31)"
                      value={newRate.day}
                      onChange={(v) =>
                        setNewRate({ ...newRate, day: Math.min(31, Math.max(1, v)) })
                      }
                      onEnter={addRate}
                      isDark={isDark}
                      min={1}
                      max={31}
                    />
                    <StrInput
                      placeholder="New Rate (%)"
                      value={newRate.rate}
                      onChange={(v) => setNewRate({ ...newRate, rate: v })}
                      onEnter={addRate}
                      isDark={isDark}
                    />
                    <ActionBtn onClick={addRate} color="indigo" isDark={isDark}>
                      {newRate.originalId ? "Save" : "Add Rate Revision"}
                    </ActionBtn>
                    {newRate.originalId && (
                      <CancelBtn
                        onClick={() => setNewRate({ fromMonth: 1, day: 1, rate: "" })}
                        isDark={isDark}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 5. OVERDRAFT / OFFSET TAB */}
            {activeTab === "overdraft" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wider ${heading}`}>
                      Offset Account Balances
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      Baseline: {fmt(data.baselineOd || 0)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {data.baselineOd ? (
                      <span
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-xs ${
                          isDark
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        <span>Fixed Baseline: {fmt(data.baselineOd)}</span>
                        <button
                          type="button"
                          onClick={() => updateData({ baselineOd: 0 })}
                          className="hover:opacity-60 transition-opacity p-0.5 rounded cursor-pointer"
                          title="Clear baseline"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ) : null}
                    {(data.customOds || []).map((o) => (
                      <span
                        key={o.fromMonth}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-xs ${
                          isDark
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        <span
                          className="cursor-pointer hover:underline"
                          onClick={() => {
                            setNewOd({
                              fromMonth: o.fromMonth,
                              amount: o.amount.toString(),
                              originalMonth: o.fromMonth,
                            });
                          }}
                          title="Click to edit"
                        >
                          From M{o.fromMonth}: {fmt(o.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateData({
                              customOds: (data.customOds || []).filter(
                                (x) => x.fromMonth !== o.fromMonth,
                              ),
                            })
                          }
                          className="hover:opacity-60 transition-opacity p-0.5 rounded cursor-pointer"
                          title="Remove"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {!data.baselineOd && (!data.customOds || data.customOds.length === 0) && (
                      <span className={`text-xs italic ${subtext}`}>
                        No offset balance configured. Funds in offset reduce daily interest.
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className={`lg:col-span-7 p-3.5 rounded-xl border space-y-3 ${
                    isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`text-xs font-semibold ${subtext}`}>Fixed Baseline Offset:</span>
                    <div className="flex items-center gap-2">
                      <NumInput
                        placeholder="Baseline OD"
                        value={data.baselineOd || 0}
                        onChange={(v) => updateData({ baselineOd: v })}
                        onEnter={() => {}}
                        isDark={isDark}
                        min={0}
                      />
                    </div>
                  </div>
                  <div className={`border-t ${divider}`} />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-semibold ${subtext}`}>Stepped Offset Tier:</span>
                    <NumInput
                      placeholder="From Month"
                      value={newOd.fromMonth}
                      onChange={(v) => setNewOd({ ...newOd, fromMonth: v })}
                      onEnter={addOd}
                      isDark={isDark}
                      min={1}
                    />
                    <StrInput
                      placeholder="Balance Amount"
                      value={newOd.amount}
                      onChange={(v) => setNewOd({ ...newOd, amount: v })}
                      onEnter={addOd}
                      isDark={isDark}
                    />
                    <ActionBtn onClick={addOd} color="emerald" isDark={isDark}>
                      {newOd.originalMonth !== undefined ? "Save" : "Add Tier"}
                    </ActionBtn>
                    {newOd.originalMonth !== undefined && (
                      <CancelBtn
                        onClick={() => setNewOd({ fromMonth: 1, amount: "" })}
                        isDark={isDark}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 5. MISC EXPENSES TAB */}
            {activeTab === "misc" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wider ${heading}`}>
                      Fees, Legal & Insurance ({data.miscExpenses?.length || 0})
                    </span>
                    <span className="text-xs font-mono font-bold text-orange-400">
                      Total: {fmt((data.miscExpenses || []).reduce((s, m) => s + (m.amount || 0), 0))}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {!data.miscExpenses || data.miscExpenses.length === 0 ? (
                      <span className={`text-xs italic ${subtext}`}>
                        No fees or one-time expenses recorded.
                      </span>
                    ) : (
                      data.miscExpenses.map((m) => (
                        <span
                          key={m.id}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-xs ${
                            isDark
                              ? "bg-orange-500/10 text-orange-300 border-orange-500/20"
                              : "bg-orange-50 text-orange-700 border-orange-200"
                          }`}
                        >
                          <span
                            className="cursor-pointer hover:underline"
                            onClick={() => {
                              setNewMisc({
                                id: m.id,
                                date: m.date,
                                amount: m.amount.toString(),
                                comments: m.comments,
                                originalId: m.id,
                              });
                            }}
                            title="Click to edit"
                          >
                            {m.date}: {fmt(m.amount)}{m.comments ? ` (${m.comments})` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateData({
                                miscExpenses: (data.miscExpenses || []).filter(
                                  (x) => x.id !== m.id,
                                ),
                              })
                            }
                            className="hover:opacity-60 transition-opacity p-0.5 rounded cursor-pointer"
                            title="Remove"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div
                  className={`lg:col-span-7 p-3.5 rounded-xl border ${
                    isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold ${subtext}`}>
                      {newMisc.originalId ? "Edit Fee / Charge" : "Add Fee or Expense"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="date"
                      value={newMisc.date}
                      onChange={(e) => setNewMisc({ ...newMisc, date: e.target.value })}
                      className={`px-3 py-1.5 text-xs font-mono rounded-xl border outline-none transition-all ${
                        isDark
                          ? "bg-slate-900 border-slate-700 text-white focus:border-orange-500"
                          : "bg-white border-slate-300 text-slate-800 focus:border-orange-500 shadow-xs"
                      }`}
                    />
                    <StrInput
                      placeholder="Amount"
                      value={newMisc.amount}
                      onChange={(v) => setNewMisc({ ...newMisc, amount: v })}
                      onEnter={addMisc}
                      isDark={isDark}
                    />
                    <StrInput
                      placeholder="Tag / Comments"
                      value={newMisc.comments}
                      onChange={(v) => setNewMisc({ ...newMisc, comments: v })}
                      onEnter={addMisc}
                      isDark={isDark}
                    />
                    <ActionBtn onClick={addMisc} color="orange" isDark={isDark}>
                      {newMisc.originalId ? "Save" : "Add Fee"}
                    </ActionBtn>
                    {newMisc.originalId && (
                      <CancelBtn
                        onClick={() =>
                          setNewMisc({
                            date: new Date().toISOString().split("T")[0],
                            amount: "",
                            comments: "",
                          })
                        }
                        isDark={isDark}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 6. DIRECT PAYMENTS TAB */}
            {activeTab === "directPayments" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wider ${heading}`}>
                      Direct Payments to Third Party ({data.directPayments?.length || 0})
                    </span>
                    <span className="text-xs font-mono font-bold text-teal-400">
                      Total: {fmt((data.directPayments || []).reduce((s, dp) => s + (dp.amount || 0), 0))}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {!data.directPayments || data.directPayments.length === 0 ? (
                      <span className={`text-xs italic ${subtext}`}>
                        No direct payments configured. Add payments made to builder or institution below.
                      </span>
                    ) : (
                      data.directPayments
                        .slice()
                        .sort((a, b) => a.month - b.month || (a.day || 1) - (b.day || 1))
                        .map((dp) => (
                          <span
                            key={dp.id || `${dp.month}-${dp.day}`}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-xs ${
                              isDark
                                ? "bg-teal-500/10 text-teal-300 border-teal-500/20"
                                : "bg-teal-50 text-teal-700 border-teal-200"
                            }`}
                          >
                            <span
                              className="cursor-pointer hover:underline"
                              onClick={() => {
                                setNewDirectPay({
                                  id: dp.id,
                                  month: dp.month,
                                  day: dp.day || 1,
                                  amount: dp.amount.toString(),
                                  recipient: dp.recipient || "",
                                  originalId: dp.id || `${dp.month}-${dp.day || 1}`,
                                });
                              }}
                              title="Click to edit direct payment"
                            >
                              M{dp.month} · D{dp.day || 1}: {fmt(dp.amount)}
                              {dp.recipient ? ` (${dp.recipient})` : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateData({
                                  directPayments: (data.directPayments || []).filter((x) =>
                                    dp.id
                                      ? x.id !== dp.id
                                      : x.month !== dp.month || (x.day || 1) !== (dp.day || 1),
                                  ),
                                })
                              }
                              className="hover:opacity-60 transition-opacity p-0.5 rounded cursor-pointer"
                              title="Remove direct payment"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))
                    )}
                  </div>
                </div>

                <div
                  className={`lg:col-span-7 p-3.5 rounded-xl border ${
                    isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold ${subtext}`}>
                      {newDirectPay.originalId
                        ? "Edit Direct Payment"
                        : "Add Direct Payment to Third Party (Builder / Institution)"}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-lg font-mono border ${
                        isDark
                          ? "bg-teal-500/10 text-teal-300 border-teal-500/20"
                          : "bg-teal-50 text-teal-700 border-teal-200"
                      }`}
                    >
                      📅 {getResolvedDate(newDirectPay.month, newDirectPay.day)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <NumInput
                      placeholder="Month"
                      value={newDirectPay.month}
                      onChange={(v) => setNewDirectPay({ ...newDirectPay, month: v })}
                      onEnter={addDirectPay}
                      isDark={isDark}
                      min={1}
                      max={data.years * 12}
                    />
                    <NumInput
                      placeholder="Day (1-31)"
                      value={newDirectPay.day}
                      onChange={(v) =>
                        setNewDirectPay({
                          ...newDirectPay,
                          day: Math.min(31, Math.max(1, v)),
                        })
                      }
                      onEnter={addDirectPay}
                      isDark={isDark}
                      min={1}
                      max={31}
                    />
                    <StrInput
                      placeholder="Amount"
                      value={newDirectPay.amount}
                      onChange={(v) => setNewDirectPay({ ...newDirectPay, amount: v })}
                      onEnter={addDirectPay}
                      isDark={isDark}
                    />
                    <StrInput
                      placeholder="Recipient (e.g. Builder, Institution)"
                      value={newDirectPay.recipient}
                      onChange={(v) => setNewDirectPay({ ...newDirectPay, recipient: v })}
                      onEnter={addDirectPay}
                      isDark={isDark}
                    />
                    <ActionBtn onClick={addDirectPay} color="teal" isDark={isDark}>
                      {newDirectPay.originalId ? "Save" : "Add Direct Payment"}
                    </ActionBtn>
                    {newDirectPay.originalId && (
                      <CancelBtn
                        onClick={() =>
                          setNewDirectPay({
                            month: 1,
                            day: 1,
                            amount: "",
                            recipient: "",
                          })
                        }
                        isDark={isDark}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODE 2: MULTI-COLUMN SIDE-BY-SIDE GRID ───────────────────────── */}
      {layoutMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Card 1: Disbursements */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between ${
              isDark ? "bg-slate-900/40 border-slate-800" : "bg-slate-50/80 border-slate-200"
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <Wallet size={14} className="text-sky-400" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${heading}`}>
                    Disbursements
                  </span>
                </div>
                <span className="text-xs font-bold font-mono text-sky-400">
                  {fmt(data.dispersals.reduce((s, d) => s + (d.amount || 0), 0))}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3 min-h-[42px]">
                {data.dispersals.map((d) => (
                  <span
                    key={d.id || `${d.month}-${d.day}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                      isDark ? "bg-sky-500/10 text-sky-300 border-sky-500/20" : "bg-sky-50 text-sky-700 border-sky-200"
                    }`}
                  >
                    <span>M{d.month}: {fmt(d.amount)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateData({
                          dispersals: data.dispersals.filter((x) =>
                            d.id ? x.id !== d.id : x.month !== d.month,
                          ),
                        })
                      }
                      className="hover:opacity-70"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab("dispersals");
                setLayoutMode("workbench");
              }}
              className="w-full py-1.5 rounded-xl text-xs font-semibold text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 transition-all cursor-pointer"
            >
              + Configure Disbursements
            </button>
          </div>

          {/* Card 2: Custom EMI */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between ${
              isDark ? "bg-slate-900/40 border-slate-800" : "bg-slate-50/80 border-slate-200"
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <Percent size={14} className="text-violet-400" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${heading}`}>
                    Custom EMI
                  </span>
                </div>
                <span className="text-xs font-bold font-mono text-violet-400">
                  {data.customEmis.length} rules
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3 min-h-[42px]">
                {data.customEmis.map((e) => {
                  const eType =
                    e.type || (e.amount !== undefined && e.amount > 0 ? "custom" : "interest_only");
                  const shortLabel =
                    eType === "interest_only"
                      ? `M${e.fromMonth}: Only Interest`
                      : eType === "recalculated"
                      ? `M${e.fromMonth}: Recalculated`
                      : `M${e.fromMonth}: ${fmt(e.amount || 0)}`;

                  return (
                    <span
                      key={e.id || `${e.fromMonth}-${e.day}`}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                        isDark
                          ? "bg-violet-500/10 text-violet-300 border-violet-500/20"
                          : "bg-violet-50 text-violet-700 border-violet-200"
                      }`}
                    >
                      <span>{shortLabel}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateData({
                            customEmis: data.customEmis.filter((x) =>
                              e.id
                                ? x.id !== e.id
                                : x.fromMonth !== e.fromMonth ||
                                  (x.day || 1) !== (e.day || 1),
                            ),
                          })
                        }
                        className="hover:opacity-70 cursor-pointer"
                        title="Remove"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab("customEmis");
                setLayoutMode("workbench");
              }}
              className="w-full py-1.5 rounded-xl text-xs font-semibold text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-all cursor-pointer"
            >
              + Configure Custom EMI
            </button>
          </div>

          {/* Card 3: Lump Sum Prepayments */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between ${
              isDark ? "bg-slate-900/40 border-slate-800" : "bg-slate-50/80 border-slate-200"
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <PiggyBank size={14} className="text-amber-400" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${heading}`}>
                    Lump Sums
                  </span>
                </div>
                <span className="text-xs font-bold font-mono text-amber-400">
                  {fmt(data.lumpSums.reduce((s, l) => s + (l.amount || 0), 0))}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3 min-h-[42px]">
                {data.lumpSums.map((l) => (
                  <span
                    key={l.id || `${l.month}-${l.day}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                      isDark ? "bg-amber-500/10 text-amber-300 border-amber-500/20" : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    <span>M{l.month}: {fmt(l.amount)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateData({
                          lumpSums: data.lumpSums.filter((x) =>
                            l.id ? x.id !== l.id : x.month !== l.month,
                          ),
                        })
                      }
                      className="hover:opacity-70"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab("lumpSums");
                setLayoutMode("workbench");
              }}
              className="w-full py-1.5 rounded-xl text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all cursor-pointer"
            >
              + Configure Prepayments
            </button>
          </div>

          {/* Card 4: Interest Rates */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between ${
              isDark ? "bg-slate-900/40 border-slate-800" : "bg-slate-50/80 border-slate-200"
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-indigo-400" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${heading}`}>
                    Interest Rates
                  </span>
                </div>
                <span className="text-xs font-bold font-mono text-indigo-400">
                  {data.customRates && data.customRates.length > 0
                    ? `${data.customRates.length} updates`
                    : `${data.rate}% fixed`}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3 min-h-[42px]">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                    isDark ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                  title="Initial rate from start of loan"
                >
                  <span>M1: {data.rate}%</span>
                </span>
                {(data.customRates || []).map((r) => (
                  <span
                    key={r.id || `${r.fromMonth}-${r.day}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                      isDark ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                    }`}
                  >
                    <span>M{r.fromMonth}: {r.rate}%</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateData({
                          customRates: (data.customRates || []).filter((x) =>
                            r.id
                              ? x.id !== r.id
                              : x.fromMonth !== r.fromMonth ||
                                (x.day || 1) !== (r.day || 1),
                          ),
                        })
                      }
                      className="hover:opacity-70 cursor-pointer"
                      title="Remove"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab("rates");
                setLayoutMode("workbench");
              }}
              className="w-full py-1.5 rounded-xl text-xs font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all cursor-pointer"
            >
              + Configure Rates
            </button>
          </div>

          {/* Card 5: Overdraft / Offset */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between ${
              isDark ? "bg-slate-900/40 border-slate-800" : "bg-slate-50/80 border-slate-200"
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <DollarSign size={14} className="text-emerald-400" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${heading}`}>
                    Offset Account
                  </span>
                </div>
                <span className="text-xs font-bold font-mono text-emerald-400">
                  {fmt(data.baselineOd || 0)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3 min-h-[42px]">
                {data.baselineOd ? (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                      isDark ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    <span>Baseline: {fmt(data.baselineOd)}</span>
                  </span>
                ) : null}
                {(data.customOds || []).map((o) => (
                  <span
                    key={o.fromMonth}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                      isDark ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    <span>M{o.fromMonth}: {fmt(o.amount)}</span>
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab("overdraft");
                setLayoutMode("workbench");
              }}
              className="w-full py-1.5 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all cursor-pointer"
            >
              + Configure Offset
            </button>
          </div>

          {/* Card: Direct Payments */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between ${
              isDark ? "bg-slate-900/40 border-slate-800" : "bg-slate-50/80 border-slate-200"
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <Building2 size={14} className="text-teal-400" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${heading}`}>
                    Direct Payments
                  </span>
                </div>
                <span className="text-xs font-bold font-mono text-teal-400">
                  {fmt((data.directPayments || []).reduce((s, dp) => s + (dp.amount || 0), 0))}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3 min-h-[42px]">
                {(data.directPayments || []).map((dp) => (
                  <span
                    key={dp.id || `${dp.month}-${dp.day}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                      isDark ? "bg-teal-500/10 text-teal-300 border-teal-500/20" : "bg-teal-50 text-teal-700 border-teal-200"
                    }`}
                  >
                    <span>M{dp.month}: {fmt(dp.amount)}{dp.recipient ? ` (${dp.recipient})` : ""}</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateData({
                          directPayments: (data.directPayments || []).filter((x) =>
                            dp.id
                              ? x.id !== dp.id
                              : x.month !== dp.month || (x.day || 1) !== (dp.day || 1),
                          ),
                        })
                      }
                      className="hover:opacity-70 cursor-pointer"
                      title="Remove"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {(!data.directPayments || data.directPayments.length === 0) && (
                  <span className={`text-[11px] italic ${subtext}`}>
                    No direct payments recorded.
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab("directPayments");
                setLayoutMode("workbench");
              }}
              className="w-full py-1.5 rounded-xl text-xs font-semibold text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 transition-all cursor-pointer"
            >
              + Configure Direct Payments
            </button>
          </div>

          {/* Card 7: Fees & Charges */}
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between ${
              isDark ? "bg-slate-900/40 border-slate-800" : "bg-slate-50/80 border-slate-200"
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <Receipt size={14} className="text-orange-400" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${heading}`}>
                    Fees & Expenses
                  </span>
                </div>
                <span className="text-xs font-bold font-mono text-orange-400">
                  {fmt((data.miscExpenses || []).reduce((s, m) => s + (m.amount || 0), 0))}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3 min-h-[42px]">
                {(data.miscExpenses || []).map((m) => (
                  <span
                    key={m.id}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                      isDark ? "bg-orange-500/10 text-orange-300 border-orange-500/20" : "bg-orange-50 text-orange-700 border-orange-200"
                    }`}
                  >
                    <span>{m.comments || m.date}: {fmt(m.amount)}</span>
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab("misc");
                setLayoutMode("workbench");
              }}
              className="w-full py-1.5 rounded-xl text-xs font-semibold text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 transition-all cursor-pointer"
            >
              + Configure Fees
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
