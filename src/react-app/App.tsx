import { useState, useMemo, useEffect, Fragment } from "react";
import {
  Calculator,
  Sun,
  Moon,
  Share2,
  Download,
  X,
  Check,
  ChevronRight,
  ChevronDown,
  Wallet,
  Percent,
  DollarSign,
  PiggyBank,
  Receipt,
  CheckCircle2,
  Clock,
  Sparkles,
  Calendar,
  TrendingUp,
} from "lucide-react";

// Types
import type {
  Loan,
  LoanData,
  ScheduleRow,
  Toast,
} from "./types";

// Constants
import {
  STORAGE_KEY,
  THEME_KEY,
  FIREBASE_CONFIG_KEY,
  DEFAULT_DATA,
} from "./utils/constants";

// Utilities
import { getUserCurrency, getCurrencySymbol } from "./utils/currency";
import { migrateLoans } from "./utils/migrations";
import {
  calculateSchedule,
  calculateTotals,
  getCurrentMonth,
  getMonthCalendarInfo,
  formatDayDate,
} from "./utils/calculations";
import { generateCSV, generateDailyCSV, downloadFile } from "./utils/export";
import { decodeData, getShareUrl } from "./utils/share";

// UI Components
import { SliderInput } from "./components/ui/SliderInput";
import { MetricCard } from "./components/ui/MetricCard";
import {
  AdvancedStrategies,
  type StrategyTab,
} from "./components/strategies/AdvancedStrategies";

// Chart Components
import { LoanBreakdownDonut } from "./components/charts/LoanBreakdownDonut";
import { AmortizationAreaChart } from "./components/charts/AmortizationAreaChart";

// Schedule Components
import { YearlyScheduleTable } from "./components/schedule/YearlyScheduleTable";
import {
  ScheduleFilters,
  type ViewMode,
  type FilterMode,
} from "./components/schedule/ScheduleFilters";

// Chrome Tabs & Connected Container Components
import { ChromeLoanTabs } from "./components/tabs/ChromeLoanTabs";
import { LoanToolbar } from "./components/tabs/LoanToolbar";
import { LoanComparisonModal } from "./components/tabs/LoanComparisonModal";

export default function LoanCalculator() {
  const [currency] = useState(getUserCurrency());
  const [locale] = useState(navigator.language || "en-US");
  const [isDark, setIsDark] = useState(true);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved">("saved");
  const [toast, setToast] = useState<Toast | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncModalData, setSyncModalData] = useState<{
    serverLoans: Loan[];
    serverActiveId: string;
  } | null>(null);

  // View & Filter states for Schedule
  const [scheduleViewMode, setScheduleViewMode] = useState<ViewMode>("monthly");
  const [scheduleFilterMode, setScheduleFilterMode] = useState<FilterMode>("all");

  const [expandedMonths, setExpandedMonths] = useState<Record<number, boolean>>({});
  const [strategyTab, setStrategyTab] = useState<StrategyTab>("dispersals");

  const activeLoan = loans.find((l) => l.id === activeTabId);
  const data = activeLoan?.data || DEFAULT_DATA;

  const fmt = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  const showToast = (msg: string, type: Toast["type"] = "save") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const updateData = (u: Partial<LoanData>) => {
    if (!activeTabId) return;
    setLoans((p) =>
      p.map((l) =>
        l.id === activeTabId ? { ...l, data: { ...l.data, ...u } } : l,
      ),
    );
  };

  const addLoan = () => {
    const n: Loan = {
      id: Date.now().toString(),
      name: `Scenario ${loans.length + 1}`,
      data: { ...DEFAULT_DATA },
    };
    setLoans([...loans, n]);
    setActiveTabId(n.id);
  };

  const deleteLoan = (id: string) => {
    if (loans.length <= 1) {
      showToast("Cannot delete last loan scenario", "error");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this loan scenario?")) {
      return;
    }
    const i = loans.findIndex((l) => l.id === id);
    const n = loans.filter((l) => l.id !== id);
    setLoans(n);
    if (activeTabId === id) setActiveTabId(n[Math.max(0, i - 1)].id);
  };

  const duplicateLoan = (id: string) => {
    const src = loans.find((l) => l.id === id);
    if (!src) return;
    const n: Loan = {
      id: Date.now().toString(),
      name: `${src.name} (Copy)`,
      data: JSON.parse(JSON.stringify(src.data)),
    };
    setLoans((prev) => [...prev, n]);
    setActiveTabId(n.id);
    showToast(`Duplicated scenario "${src.name}"`, "success");
  };

  const resetLoan = () => {
    if (!activeLoan) return;
    if (window.confirm(`Reset "${activeLoan.name}" to default parameters?`)) {
      updateData(DEFAULT_DATA);
      showToast(`Reset "${activeLoan.name}" to defaults`, "reset");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        getShareUrl({ loans, activeId: activeTabId }),
      );
      setCopied(true);
      showToast("Link copied to clipboard!", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Failed to copy", "error");
    }
  };

  const share = async () => {
    const url = getShareUrl({ loans, activeId: activeTabId });
    if (navigator.share) {
      try {
        await navigator.share({ title: "Loan Calculator", url });
        showToast("Shared successfully!", "success");
      } catch (e: unknown) {
        if ((e as Error)?.name !== "AbortError") setShowShareModal(true);
      }
    } else setShowShareModal(true);
  };

  const loadFirebaseSdk = async () => {
    const ensureScript = (src: string) =>
      new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
      });
    await ensureScript(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
    );
    await ensureScript(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
    );
    await ensureScript(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js",
    );
  };

  interface FirebaseBridge {
    apps: unknown[];
    initializeApp: (cfg: unknown) => unknown;
    auth: {
      (): {
        signInWithPopup: (provider: unknown) => Promise<unknown>;
        signOut: () => Promise<void>;
        currentUser: { uid: string; email?: string | null } | null;
        onAuthStateChanged: (cb: (u: { email?: string | null } | null) => void) => () => void;
      };
      GoogleAuthProvider: new () => unknown;
    };
    firestore: () => {
      collection: (name: string) => {
        doc: (id: string) => {
          get: () => Promise<{ exists: boolean; data: () => { loans: Loan[]; activeId: string } | undefined }>;
          set: (data: unknown, opts: { merge: boolean }) => Promise<void>;
        };
      };
    };
  }

  const getFirebaseConfig = () => {
    const envCfg = (window as unknown as { __FIREBASE_CONFIG__?: unknown }).__FIREBASE_CONFIG__;
    if (envCfg) return envCfg;
    const stored = localStorage.getItem(FIREBASE_CONFIG_KEY);
    return stored ? JSON.parse(stored) : null;
  };

  const ensureFirebase = async (): Promise<FirebaseBridge> => {
    await loadFirebaseSdk();
    const cfg = getFirebaseConfig();
    if (!cfg) throw new Error("Missing Firebase config");
    const fb = (window as unknown as { firebase: FirebaseBridge }).firebase;
    if (!fb.apps.length) fb.initializeApp(cfg);
    return fb;
  };

  const signInWithGoogle = async () => {
    try {
      const fb = await ensureFirebase();
      const provider = new fb.auth.GoogleAuthProvider();
      await fb.auth().signInWithPopup(provider);
      showToast("Signed in with Google", "success");
    } catch (error: unknown) {
      console.error("Firebase Login Error:", error);
      showToast(`Login failed: ${(error as Error)?.message || "Unknown error"}`, "error");
    }
  };

  const signOut = async () => {
    try {
      const fb = await ensureFirebase();
      await fb.auth().signOut();
      showToast("Signed out", "success");
    } catch {
      showToast("Sign out failed", "error");
    }
  };

  const initiateSync = async () => {
    setSyncBusy(true);
    try {
      const fb = await ensureFirebase();
      const user = fb.auth().currentUser;
      if (!user) throw new Error("No user");

      const doc = await fb
        .firestore()
        .collection("loanCalculatorUsers")
        .doc(user.uid)
        .get();
      const d = doc.data();
      if (doc.exists && d && d.loans && d.loans.length > 0) {
        setSyncModalData({
          serverLoans: migrateLoans(d.loans),
          serverActiveId: d.activeId || "",
        });
      } else {
        await performSyncPush();
      }
    } catch {
      showToast("Sync check failed", "error");
    } finally {
      setSyncBusy(false);
    }
  };

  const performSyncPush = async (
    overrideLoans?: Loan[],
    overrideActiveId?: string,
  ) => {
    setSyncBusy(true);
    const lns = overrideLoans || loans;
    const actId = overrideActiveId || activeTabId;
    try {
      const fb = await ensureFirebase();
      const user = fb.auth().currentUser;
      if (!user) throw new Error("No user");
      await fb
        .firestore()
        .collection("loanCalculatorUsers")
        .doc(user.uid)
        .set(
          {
            loans: lns,
            activeId: actId,
            updatedAt: new Date().toISOString(),
            email: user.email || null,
          },
          { merge: true },
        );
      showToast("Synced to Cloud Firestore", "success");
    } catch {
      showToast("Sync failed", "error");
    } finally {
      setSyncBusy(false);
      setSyncModalData(null);
    }
  };

  const handleSyncChoice = async (choice: "local" | "server" | "both") => {
    if (!syncModalData) return;

    if (choice === "local") {
      await performSyncPush();
    } else if (choice === "server") {
      setLoans(syncModalData.serverLoans);
      setActiveTabId(
        syncModalData.serverActiveId || syncModalData.serverLoans[0]?.id || "",
      );
      setSyncModalData(null);
      showToast("Loaded from server", "success");
    } else if (choice === "both") {
      const mergedLoans = syncModalData.serverLoans.map((sl) => ({
        ...sl,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
        name: `${sl.name} (Cloud)`,
      }));
      const combined = [...loans, ...mergedLoans];
      setLoans(combined);
      await performSyncPush(combined, activeTabId);
    }
  };

  const downloadCSV = () => {
    try {
      const csv = generateCSV(schedule, totals, cm, data.miscExpenses || []);
      const filename = `loan-${activeLoan?.name.replace(/\s/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
      downloadFile(csv, filename);
      showToast("Downloaded Amortization CSV!", "success");
    } catch {
      showToast("Export failed", "error");
    }
  };

  useEffect(() => {
    try {
      const hash = window.location.hash.slice(1);
      if (hash) {
        const d = decodeData(hash);
        if (d?.loans?.length) {
          setLoans(migrateLoans(d.loans));
          setActiveTabId(d.activeId || d.loans[0].id);
          showToast("Loaded loan scenario", "success");
        }
      } else {
        const s = localStorage.getItem(STORAGE_KEY);
        if (s) {
          const p = JSON.parse(s);
          if (p.loans?.length) {
            setLoans(migrateLoans(p.loans));
            setActiveTabId(p.activeId || p.loans[0].id);
          } else {
            setLoans([{ id: "1", name: "Primary Mortgage", data: DEFAULT_DATA }]);
            setActiveTabId("1");
          }
        } else {
          setLoans([{ id: "1", name: "Primary Mortgage", data: DEFAULT_DATA }]);
          setActiveTabId("1");
        }
      }
      const theme = localStorage.getItem(THEME_KEY);
      const dark = theme !== "light";
      setIsDark(dark);
      document.documentElement.classList[dark ? "add" : "remove"]("dark");
    } catch {
      setLoans([{ id: "1", name: "Primary Mortgage", data: DEFAULT_DATA }]);
      setActiveTabId("1");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveStatus("saving");
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ loans, activeId: activeTabId }),
        );
        setSaveStatus("saved");
      } catch {
        setSaveStatus("saved");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [loans, activeTabId, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
      document.documentElement.classList[isDark ? "add" : "remove"]("dark");
    } catch {
      /* noop */
    }
  }, [isDark, loaded]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    const init = async () => {
      try {
        const fb = await ensureFirebase();
        unsub = fb.auth().onAuthStateChanged((u) => {
          setUserEmail(u?.email || null);
          setAuthReady(true);
        });
      } catch {
        setAuthReady(true);
      }
    };
    init();
    return () => {
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedule = useMemo<ScheduleRow[]>(() => {
    return calculateSchedule(data, locale);
  }, [data, locale]);

  const totals = useMemo(() => {
    return calculateTotals(schedule, data.miscExpenses || []);
  }, [schedule, data.miscExpenses]);

  const cm = getCurrentMonth(data.startDate);
  const hasOd = !!((data.baselineOd && data.baselineOd > 0) || (data.customOds && data.customOds.length > 0));
  const paidTill = schedule
    .slice(0, Math.min(cm, schedule.length))
    .reduce((s, r) => s + r.emi, 0);
  const pending =
    cm >= schedule.length
      ? 0
      : schedule.slice(cm).reduce((s, r) => s + r.emi, 0);

  // Payoff acceleration calculations
  const scheduledMonths = Math.max(1, (data.years || 1) * 12);
  const actualPayoffRow = schedule.find((r) => r.remaining <= 0);
  const actualPayoffMonth = actualPayoffRow ? actualPayoffRow.m : schedule.length;
  const monthsSaved = Math.max(0, scheduledMonths - actualPayoffMonth);
  const yearsSaved = (monthsSaved / 12).toFixed(1);

  // Standard benchmark EMI estimate
  const standardEmiEstimate = schedule[0]?.stdEmi || 0;
  const activeEmiEstimate = schedule.find((r) => r.emi > 0)?.emi || standardEmiEstimate;

  const toggleMonth = (m: number) => {
    setExpandedMonths((prev) => ({ ...prev, [m]: !prev[m] }));
  };

  const toggleAllMonths = () => {
    const allExpanded =
      schedule.length > 0 && schedule.every((r) => expandedMonths[r.m]);
    if (allExpanded) {
      setExpandedMonths({});
    } else {
      const next: Record<number, boolean> = {};
      schedule.forEach((r) => {
        next[r.m] = true;
      });
      setExpandedMonths(next);
    }
  };

  const getResolvedDate = (monthNum: number, dayNum: number) => {
    const info = getMonthCalendarInfo(data.startDate, Math.max(1, monthNum));
    const clampedDay = Math.min(info.daysInMonth, Math.max(1, dayNum || 1));
    return formatDayDate(info.year, info.monthIndex, clampedDay, locale).dateStr;
  };

  const exportDailyData = () => {
    const csv = generateDailyCSV(schedule);
    downloadFile(csv, `${activeLoan?.name || "loan"}-daily-schedule.csv`);
    showToast("Exported Granular Daily CSV", "success");
  };

  // Filtered rows for Monthly view
  const filteredSchedule = useMemo(() => {
    if (scheduleFilterMode === "all") return schedule;
    if (scheduleFilterMode === "prepayments") {
      return schedule.filter(
        (r) =>
          (r.lumpAmt || 0) > 0 ||
          r.payType === "custom" ||
          r.disbAmt > 0 ||
          r.interestSaved > 0,
      );
    }
    if (scheduleFilterMode === "pending") {
      return schedule.filter((r) => r.m >= cm && r.remaining > 0);
    }
    return schedule;
  }, [schedule, scheduleFilterMode, cm]);

  /* ── Dribbble Glass & Surface Styling Tokens ───────────────────────────── */
  const card = isDark
    ? "bg-slate-950/60 border border-slate-800/80 rounded-2xl backdrop-blur-md shadow-lg shadow-black/20"
    : "bg-slate-50/70 border border-slate-200/90 rounded-2xl shadow-sm";

  const surfaceInput = isDark
    ? "bg-slate-900/60 border border-slate-700/80 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 rounded-xl"
    : "bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 rounded-xl";

  const heading = isDark ? "text-white" : "text-slate-900";
  const subtext = isDark ? "text-slate-400" : "text-slate-500";
  const divider = isDark ? "border-slate-800/80" : "border-slate-200";
  const root = isDark
    ? "min-h-screen bg-[#0B0F19] text-slate-100"
    : "min-h-screen bg-[#F8FAFC] text-slate-900";

  // Daily breakdown sub-table renderer for expandable month rows (fully displayed without nested scroll)
  const renderDailyBreakdown = (r: ScheduleRow) => {
    if (!r.days || r.days.length === 0) return null;
    return (
      <div className={`p-3 border-y ${divider} ${isDark ? "bg-[#070A10]" : "bg-slate-50/80"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-sky-400">
              Month {r.m} ({r.date}) — Granular Day-Wise Calculation
            </span>
            <span className={`text-[10px] ${subtext}`}>
              ({r.days.length} days · {r.days.filter((d) => (d.events?.length || 0) > 0).length} active events)
            </span>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-[11px]">
            <thead className={isDark ? "bg-slate-900" : "bg-slate-100"}>
              <tr className={`border-b ${divider}`}>
                <th className={`px-2 py-1.5 text-left font-semibold text-[10px] ${subtext}`}>Day / Date</th>
                <th className={`px-2 py-1.5 text-left font-semibold text-[10px] ${subtext}`}>Events</th>
                <th className={`px-2 py-1.5 text-right font-semibold text-[10px] ${subtext}`}>Disbursement</th>
                <th className={`px-2 py-1.5 text-right font-semibold text-[10px] ${subtext}`}>Payment / EMI</th>
                <th className={`px-2 py-1.5 text-right font-semibold text-[10px] ${subtext}`}>Lump Sum</th>
                <th className={`px-2 py-1.5 text-right font-semibold text-[10px] ${subtext}`}>Prin Repaid</th>
                <th className={`px-2 py-1.5 text-right font-semibold text-[10px] ${subtext}`}>Daily Interest</th>
                <th className={`px-2 py-1.5 text-right font-semibold text-[10px] ${subtext}`}>Saved</th>
                {hasOd && <th className={`px-2 py-1.5 text-right font-semibold text-[10px] ${subtext}`}>OD Bal</th>}
                <th className={`px-2 py-1.5 text-right font-semibold text-[10px] ${subtext}`}>Net Balance</th>
                <th className={`px-2 py-1.5 text-right font-semibold text-[10px] ${subtext}`}>Closing Balance</th>
              </tr>
            </thead>
            <tbody>
              {r.days.map((d) => {
                const hasEvent = d.events && d.events.length > 0;
                return (
                  <tr
                    key={d.day}
                    className={`border-b transition-colors ${divider} ${
                      hasEvent
                        ? isDark
                          ? "bg-sky-500/10"
                          : "bg-sky-50/70"
                        : isDark
                        ? "hover:bg-slate-800/20"
                        : "hover:bg-slate-100/50"
                    }`}
                  >
                    <td className="px-2 py-1 whitespace-nowrap font-mono text-[10px]">
                      <span className="font-bold text-sky-400">D{d.day}</span>{" "}
                      <span className={subtext}>({d.date.split(",")[0]})</span>
                      {d.rate !== undefined && (
                        <span className="ml-1 text-[9px] text-indigo-400 font-medium">· {d.rate}%</span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {d.events && d.events.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {d.events.map((ev, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.2 rounded-md text-[9px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20"
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className={subtext}>—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-sky-400">
                      {d.disbAmt > 0 ? fmt(d.disbAmt) : <span className={subtext}>—</span>}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {d.emiAmt > 0 ? fmt(d.emiAmt) : <span className={subtext}>—</span>}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-amber-400">
                      {d.lumpAmt > 0 ? fmt(d.lumpAmt) : <span className={subtext}>—</span>}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-teal-400">
                      {d.prinPay > 0 ? fmt(d.prinPay) : <span className={subtext}>—</span>}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-amber-400">
                      {d.intPay > 0 ? fmt(d.intPay) : <span className={subtext}>—</span>}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-emerald-400">
                      {d.interestSaved > 0 ? fmt(d.interestSaved) : <span className={subtext}>—</span>}
                    </td>
                    {hasOd && (
                      <td className="px-2 py-1 text-right font-mono text-emerald-400">
                        {d.odBal > 0 ? fmt(d.odBal) : <span className={subtext}>—</span>}
                      </td>
                    )}
                    <td className="px-2 py-1 text-right font-mono">
                      {fmt(d.netPrincipal)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono font-bold">
                      {fmt(d.balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className={`font-semibold ${isDark ? "bg-slate-900/90" : "bg-slate-100"}`}>
              <tr className={`border-t ${divider}`}>
                <td className="px-2 py-1.5" colSpan={2}>
                  Month {r.m} Totals
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-sky-400">
                  {r.disbAmt > 0 ? fmt(r.disbAmt) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono">
                  {r.emi > 0 ? fmt(r.emi) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-amber-400">
                  {r.lumpAmt ? fmt(r.lumpAmt) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-teal-400">
                  {fmt(r.prinPay)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-amber-400">
                  {fmt(r.intPay)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-emerald-400">
                  {r.interestSaved > 0 ? fmt(r.interestSaved) : "—"}
                </td>
                {hasOd && (
                  <td className="px-2 py-1.5 text-right font-mono text-emerald-400">
                    {r.odBal > 0 ? fmt(r.odBal) : "—"}
                  </td>
                )}
                <td className="px-2 py-1.5 text-right font-mono">—</td>
                <td className="px-2 py-1.5 text-right font-mono font-bold">
                  {fmt(r.remaining)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  if (!loaded)
    return (
      <div className={`${root} flex items-center justify-center`}>
        <div className="flex items-center gap-3 text-sky-400">
          <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-20"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-80"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm font-semibold tracking-wide">
            Initializing Loan Engine…
          </span>
        </div>
      </div>
    );

  return (
    <div className={root}>
      {/* ── Toast Notification ────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xl animate-[slideIn_0.25s_ease-out] flex items-center gap-2 ${
            toast.type === "success"
              ? "bg-emerald-500 text-white shadow-emerald-500/25"
              : toast.type === "error"
              ? "bg-rose-500 text-white shadow-rose-500/25"
              : "bg-sky-500 text-white shadow-sky-500/25"
          }`}
        >
          <Sparkles size={14} />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ── Share Modal ───────────────────────────────────────────────────── */}
      {showShareModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className={`${card} max-w-md w-full p-6 animate-scaleUp`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                  <Share2 size={18} />
                </div>
                <h3 className={`text-base font-bold ${heading}`}>
                  Share Calculator
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className={`p-1.5 rounded-xl hover:bg-white/10 ${subtext}`}
              >
                <X size={16} />
              </button>
            </div>
            <p className={`text-xs mb-3 ${subtext}`}>
              Share this exact calculation scenario with teammates or clients via an encrypted URL link:
            </p>
            <div
              className={`rounded-xl p-3 mb-4 break-all text-xs font-mono select-all border ${
                isDark
                  ? "bg-slate-950 border-slate-800 text-slate-300"
                  : "bg-slate-100 border-slate-200 text-slate-700"
              }`}
            >
              {getShareUrl({ loans, activeId: activeTabId })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copy}
                className="flex-1 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 transition-all"
              >
                {copied ? (
                  <>
                    <Check size={14} /> Copied to Clipboard
                  </>
                ) : (
                  <>
                    <Share2 size={14} /> Copy Link
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  isDark
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sync Modal ────────────────────────────────────────────────────── */}
      {syncModalData && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setSyncModalData(null)}
        >
          <div
            className={`${card} max-w-md w-full p-6 animate-scaleUp`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-base font-bold ${heading}`}>
                Cloud Sync Conflict
              </h3>
              <button
                type="button"
                onClick={() => setSyncModalData(null)}
                className={`p-1.5 rounded-xl hover:bg-white/10 ${subtext}`}
              >
                <X size={16} />
              </button>
            </div>
            <p className={`text-xs mb-5 ${subtext}`}>
              Existing scenario data was found on Firestore Cloud. How would you like to reconcile?
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => handleSyncChoice("local")}
                className="w-full px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-500/20"
              >
                Use Local Data (Overwrite Cloud)
              </button>
              <button
                type="button"
                onClick={() => handleSyncChoice("server")}
                className="w-full px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
              >
                Use Cloud Data (Overwrite Local)
              </button>
              <button
                type="button"
                onClick={() => handleSyncChoice("both")}
                className="w-full px-4 py-2.5 bg-violet-500 hover:bg-violet-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-500/20"
              >
                Merge Both (Create New Scenario Tabs)
              </button>
              <button
                type="button"
                onClick={() => setSyncModalData(null)}
                className={`w-full px-4 py-2.5 mt-1 rounded-xl text-xs font-semibold border transition-all ${
                  isDark
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scenario Comparison Matrix Modal ──────────────────────────────── */}
      <LoanComparisonModal
        isOpen={showComparisonModal}
        onClose={() => setShowComparisonModal(false)}
        loans={loans}
        activeTabId={activeTabId}
        onSelectLoan={setActiveTabId}
        onDuplicateLoan={duplicateLoan}
        onDeleteLoan={deleteLoan}
        isDark={isDark}
        currency={currency}
        locale={locale}
      />

      {/* ── Main Container ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-6">
        {/* ── Header & Navigation Bar ─────────────────────────────────────── */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-white/5">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
              <Calculator size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-lg sm:text-xl font-extrabold tracking-tight ${heading}`}>
                  Amortize
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 tracking-wider">
                  PRO
                </span>
              </div>
              <p className={`text-xs ${subtext}`}>
                Interactive Amortization Engine & Strategy Planner
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Auto-save status */}
            <div
              className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border ${
                isDark
                  ? "bg-slate-900/60 border-slate-800/80"
                  : "bg-white border-slate-200 shadow-xs"
              } ${saveStatus === "saving" ? "text-sky-400" : "text-emerald-400"}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  saveStatus === "saving"
                    ? "bg-sky-400 animate-pulse"
                    : "bg-emerald-400"
                }`}
              />
              <span className="font-semibold text-[11px]">
                {saveStatus === "saving" ? "Saving…" : "Saved"}
              </span>
            </div>

            {/* Google Sync / Auth */}
            {authReady &&
              (userEmail ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={initiateSync}
                    disabled={syncBusy}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer border ${
                      isDark
                        ? "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border-indigo-500/30"
                        : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
                    }`}
                  >
                    {syncBusy ? "Syncing…" : "Cloud Sync"}
                  </button>
                  <button
                    type="button"
                    onClick={signOut}
                    title={`Sign out (${userEmail})`}
                    className={`max-w-[120px] sm:max-w-[160px] truncate px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      isDark
                        ? "bg-slate-900/60 hover:bg-slate-800 text-slate-300 border-slate-800"
                        : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs"
                    }`}
                  >
                    {userEmail.split("@")[0]}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer ${
                    isDark
                      ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border-emerald-500/30"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                  }`}
                >
                  Sign In
                </button>
              ))}

            {/* Export CSV button */}
            <button
              type="button"
              onClick={downloadCSV}
              className={`p-2 rounded-xl transition-all border cursor-pointer ${
                isDark
                  ? "bg-slate-900/60 hover:bg-slate-800 text-slate-300 border-slate-800"
                  : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs"
              }`}
              title="Download Amortization Schedule CSV"
            >
              <Download size={15} />
            </button>

            {/* Share button */}
            <button
              type="button"
              onClick={share}
              className={`p-2 rounded-xl transition-all border cursor-pointer ${
                isDark
                  ? "bg-slate-900/60 hover:bg-slate-800 text-slate-300 border-slate-800"
                  : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs"
              }`}
              title="Share Loan Scenario"
            >
              <Share2 size={15} />
            </button>

            {/* Theme Toggle button */}
            <button
              type="button"
              onClick={() => setIsDark((p) => !p)}
              className={`p-2 rounded-xl transition-all border cursor-pointer ${
                isDark
                  ? "bg-slate-900/60 hover:bg-slate-800 text-amber-400 border-slate-800"
                  : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs"
              }`}
              title="Toggle Light / Dark Theme"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>

        {/* ── Chrome Window & Multiple Loan Container ─────────────────────── */}
        <div className="w-full">
          {/* Chrome Tab Strip */}
          <ChromeLoanTabs
            loans={loans}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onAddTab={addLoan}
            onDeleteTab={deleteLoan}
            onRenameTab={(id, newName) => {
              setLoans((prev) =>
                prev.map((l) => (l.id === id ? { ...l, name: newName } : l)),
              );
            }}
            onDuplicateTab={duplicateLoan}
            onOpenComparison={() => setShowComparisonModal(true)}
            isDark={isDark}
            currency={currency}
            locale={locale}
          />

          {/* Unified Connected Loan Data Container */}
          <div
            className={`w-full ${
              isDark
                ? "bg-slate-900 border-x border-b border-slate-800"
                : "bg-white border-x border-b border-slate-200"
            } rounded-b-3xl shadow-2xl transition-colors duration-200`}
          >
            {/* Loan Context Toolbar / Omnibox */}
            <LoanToolbar
              activeLoan={activeLoan}
              loansCount={loans.length}
              activeLoanIndex={
                loans.findIndex((l) => l.id === activeTabId) + 1
              }
              totals={totals}
              schedule={schedule}
              isDark={isDark}
              currency={currency}
              locale={locale}
              onRename={(newName) => {
                if (!activeTabId) return;
                setLoans((prev) =>
                  prev.map((l) =>
                    l.id === activeTabId ? { ...l, name: newName } : l,
                  ),
                );
              }}
              onDuplicate={() => duplicateLoan(activeTabId)}
              onShare={share}
              onExportCSV={downloadCSV}
              onReset={resetLoan}
            />

            {/* Loan Workspace Inner Content */}
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
              {/* ── Hero Split-Grid: Parameters & Overview Card ──────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Interactive Loan Parameters Dual Sliders (5 cols) */}
          <div className={`${card} p-5 sm:p-6 lg:col-span-6 flex flex-col justify-between gap-6`}>
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                    <DollarSign size={16} />
                  </div>
                  <div>
                    <h2 className={`text-sm font-bold uppercase tracking-wider ${heading}`}>
                      Loan Parameters
                    </h2>
                    <p className={`text-[11px] ${subtext}`}>
                      Adjust key variables to recalculate instantly
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                {/* Principal Amount with Dual Slider & Presets */}
                <SliderInput
                  label="Loan Amount (Principal)"
                  value={data.principal}
                  min={10000}
                  max={2000000}
                  step={5000}
                  prefix={getCurrencySymbol(currency)}
                  presets={[
                    { label: "100k", value: 100000 },
                    { label: "250k", value: 250000 },
                    { label: "500k", value: 500000 },
                    { label: "750k", value: 750000 },
                    { label: "1M", value: 1000000 },
                  ]}
                  onChange={(v) => {
                    const ds = data.dispersals || [];
                    // Keep initial disbursement in sync if only 1 exists
                    let nextDs = ds;
                    if (ds.length <= 1) {
                      nextDs = [{ month: 1, day: 1, amount: v }];
                    }
                    updateData({ principal: v, dispersals: nextDs });
                  }}
                  isDark={isDark}
                  accentColor="sky"
                />

                {/* Interest Rate with Dual Slider & Presets */}
                <div className="space-y-1.5">
                  <SliderInput
                    label="Interest Rate (% p.a.)"
                    value={data.rate}
                    min={1.0}
                    max={25.0}
                    step={0.1}
                    suffix="%"
                    presets={[
                      { label: "5.5%", value: 5.5 },
                      { label: "6.5%", value: 6.5 },
                      { label: "7.5%", value: 7.5 },
                      { label: "8.5%", value: 8.5 },
                      { label: "10%", value: 10.0 },
                    ]}
                    onChange={(v) => updateData({ rate: v })}
                    isDark={isDark}
                    accentColor="amber"
                  />
                  <div className="flex items-center justify-between text-[11px] px-1 pt-0.5">
                    <span className={subtext}>
                      {data.customRates && data.customRates.length > 0 ? (
                        <span className="text-indigo-400 font-medium">
                          ⚡ Variable: {data.customRates.length} update{data.customRates.length > 1 ? "s" : ""} scheduled
                        </span>
                      ) : (
                        <span>Initial base rate from Month 1</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setStrategyTab("rates");
                        document.getElementById("advanced-strategies-section")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="text-indigo-400 hover:underline cursor-pointer font-semibold flex items-center gap-1"
                    >
                      <TrendingUp size={11} />
                      <span>{data.customRates && data.customRates.length > 0 ? "Manage Rates" : "+ Schedule Rate Change"}</span>
                    </button>
                  </div>
                </div>

                {/* Tenure in Years with Dual Slider & Presets */}
                <SliderInput
                  label="Loan Tenure (Duration)"
                  value={data.years}
                  min={1}
                  max={30}
                  step={1}
                  suffix="yrs"
                  presets={[
                    { label: "5y", value: 5 },
                    { label: "10y", value: 10 },
                    { label: "15y", value: 15 },
                    { label: "20y", value: 20 },
                    { label: "30y", value: 30 },
                  ]}
                  onChange={(v) => updateData({ years: Math.max(1, v) })}
                  isDark={isDark}
                  accentColor="indigo"
                />

                {/* Loan Start Date Picker */}
                <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-sky-400" />
                    <div>
                      <label className={`text-xs font-semibold uppercase tracking-wider block ${subtext}`}>
                        First Payment Date
                      </label>
                      <span className={`text-[11px] ${subtext}`}>
                        Calendar start for amortization
                      </span>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={data.startDate}
                    onChange={(e) => updateData({ startDate: e.target.value })}
                    className={`px-3 py-1.5 text-xs font-medium outline-none transition-all ${surfaceInput}`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Hero Monthly EMI & Donut Chart Breakdown (7 cols) */}
          <div className={`${card} p-5 sm:p-6 lg:col-span-6 flex flex-col justify-between gap-5`}>
            {/* Top row: Monthly EMI readout */}
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-white/5">
              <div>
                <span className={`text-xs font-bold uppercase tracking-wider ${subtext}`}>
                  Estimated Monthly Payment
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-sky-400">
                    {fmt(activeEmiEstimate)}
                  </span>
                  <span className={`text-xs font-medium ${subtext}`}>/ month</span>
                </div>
                {data.customEmis && data.customEmis.length > 0 && (
                  <span className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    ⚡ Custom EMI Rules Applied
                  </span>
                )}
              </div>

              {/* Payoff Acceleration Highlight */}
              {monthsSaved > 0 && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2.5 max-w-xs ${
                    isDark
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                      : "bg-emerald-50 border-emerald-200 text-emerald-800"
                  }`}
                >
                  <Sparkles size={18} className="shrink-0 text-emerald-400" />
                  <div className="text-xs">
                    <div className="font-bold">
                      Pay off {yearsSaved} years earlier!
                    </div>
                    <div className="text-[11px] opacity-80">
                      Paid in Month {actualPayoffMonth} instead of {scheduledMonths}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Donut Breakdown Chart */}
            <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-1">
              <LoanBreakdownDonut
                principal={totals.p || data.principal}
                interest={totals.i}
                misc={totals.m}
                currency={currency}
                locale={locale}
                isDark={isDark}
              />

              {/* Key Quick Breakdown Stats */}
              <div className="flex flex-col gap-2.5 w-full sm:w-auto">
                <div className={`p-3 rounded-xl border flex items-center justify-between gap-4 ${
                  isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}>
                  <span className={`text-xs font-medium ${subtext}`}>Total Interest</span>
                  <span className="text-xs font-bold font-mono text-amber-400">
                    {fmt(totals.i)}
                  </span>
                </div>
                <div className={`p-3 rounded-xl border flex items-center justify-between gap-4 ${
                  isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}>
                  <span className={`text-xs font-medium ${subtext}`}>Total Interest Saved</span>
                  <span className="text-xs font-bold font-mono text-emerald-400">
                    {fmt(totals.s)}
                  </span>
                </div>
                <div className={`p-3 rounded-xl border flex items-center justify-between gap-4 ${
                  isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}>
                  <span className={`text-xs font-medium ${subtext}`}>Total Loan Cost</span>
                  <span className={`text-xs font-bold font-mono ${heading}`}>
                    {fmt((totals.p || data.principal) + totals.i + (totals.m || 0))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── KPI Metric Cards Strip ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <MetricCard
            label="Disbursed"
            value={fmt(totals.d)}
            colorScheme="sky"
            isDark={isDark}
            icon={<Wallet size={14} />}
          />
          <MetricCard
            label="Total Interest"
            value={fmt(totals.i)}
            colorScheme="amber"
            isDark={isDark}
            icon={<Percent size={14} />}
          />
          <MetricCard
            label="Principal Paid"
            value={fmt(totals.p)}
            colorScheme="violet"
            isDark={isDark}
            icon={<DollarSign size={14} />}
          />
          <MetricCard
            label="Interest Saved"
            value={fmt(totals.s)}
            colorScheme="emerald"
            isDark={isDark}
            icon={<PiggyBank size={14} />}
          />
          <MetricCard
            label="Fees & Charges"
            value={fmt(totals.m || 0)}
            colorScheme="orange"
            isDark={isDark}
            icon={<Receipt size={14} />}
          />
          <MetricCard
            label="Paid to Date"
            value={fmt(paidTill)}
            colorScheme="teal"
            isDark={isDark}
            icon={<CheckCircle2 size={14} />}
          />
          <MetricCard
            label="Pending Balance"
            value={fmt(pending)}
            colorScheme="rose"
            isDark={isDark}
            icon={<Clock size={14} />}
          />
        </div>

        {/* ── Interactive Amortization Payoff Area Chart ───────────────────── */}
        <div className={`${card} p-5 sm:p-6`}>
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5">
            <div>
              <h2 className={`text-sm font-bold uppercase tracking-wider ${heading}`}>
                Amortization Payoff Trajectory
              </h2>
              <p className={`text-[11px] ${subtext}`}>
                Interactive balance decline over the loan tenure vs cumulative paid principal
              </p>
            </div>
          </div>
          <AmortizationAreaChart
            schedule={schedule}
            currency={currency}
            locale={locale}
            isDark={isDark}
          />
        </div>

        {/* ── Advanced Financial Adjustments (Horizontal Workbench & Grid) ── */}
        <div id="advanced-strategies-section" className={`${card} p-5 sm:p-6`}>
          <AdvancedStrategies
            data={data}
            updateData={updateData}
            currency={currency}
            locale={locale}
            isDark={isDark}
            getResolvedDate={getResolvedDate}
            externalActiveTab={strategyTab}
            onActiveTabChange={setStrategyTab}
          />
        </div>

        {/* ── Amortization Schedule Table ─────────────────────────────────── */}
        <div className={`${card} overflow-hidden`}>
          {/* Schedule Controls & Filters Header */}
          <ScheduleFilters
            viewMode={scheduleViewMode}
            onViewModeChange={setScheduleViewMode}
            filterMode={scheduleFilterMode}
            onFilterModeChange={setScheduleFilterMode}
            allExpanded={
              schedule.length > 0 && schedule.every((r) => expandedMonths[r.m])
            }
            onToggleAllMonths={toggleAllMonths}
            onExportDailyCSV={exportDailyData}
            onExportMonthlyCSV={downloadCSV}
            totalPaymentsCount={schedule.filter((r) => r.emi > 0).length}
            isDark={isDark}
          />

          {/* Conditional Rendering: Yearly View vs Monthly View */}
          {scheduleViewMode === "yearly" ? (
            <div className="p-3 sm:p-4">
              <YearlyScheduleTable
                schedule={schedule}
                currency={currency}
                locale={locale}
                isDark={isDark}
                hasOd={hasOd}
                cm={cm}
                expandedMonths={expandedMonths}
                toggleMonth={toggleMonth}
                renderDailyBreakdown={renderDailyBreakdown}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr
                    className={`border-b ${divider} ${
                      isDark ? "bg-slate-900/40" : "bg-slate-50/80"
                    }`}
                  >
                    {[
                      "Mo",
                      "Date",
                      "Rate",
                      "Status",
                      "Disbursement",
                      "Monthly EMI",
                      "Std EMI",
                      "Custom EMI",
                      "Lump Sum",
                      "Principal Paid",
                      "Interest Paid",
                      "Interest Saved",
                      ...(hasOd ? ["OD Balance"] : []),
                      "Closing Balance",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-[10px] ${subtext} whitespace-nowrap`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedule.map((r) => {
                    const isCur = r.m === cm;
                    const isPaid = r.m < cm;
                    const isExpanded = !!expandedMonths[r.m];

                    return (
                      <Fragment key={r.m}>
                        <tr
                          className={`border-b transition-colors ${divider} ${
                            isCur
                              ? isDark
                                ? "bg-sky-500/10 hover:bg-sky-500/15"
                                : "bg-sky-50 hover:bg-sky-100/70"
                              : r.payType === "lump"
                              ? isDark
                                ? "bg-amber-500/[0.06] hover:bg-amber-500/[0.1]"
                                : "bg-amber-50/70 hover:bg-amber-100/60"
                              : r.payType === "custom"
                              ? isDark
                                ? "bg-violet-500/[0.06] hover:bg-violet-500/[0.1]"
                                : "bg-violet-50/70 hover:bg-violet-100/60"
                              : isDark
                              ? "hover:bg-slate-800/30"
                              : "hover:bg-slate-100/60"
                          }`}
                        >
                          <td className={`px-3 py-2.5 font-bold ${heading} whitespace-nowrap`}>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleMonth(r.m)}
                                className={`p-1 rounded-md transition-colors cursor-pointer ${
                                  isDark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-200 text-slate-600"
                                }`}
                                title={
                                  isExpanded
                                    ? "Collapse day-wise details"
                                    : "Expand day-wise details"
                                }
                              >
                                {isExpanded ? (
                                  <ChevronDown size={14} className="text-sky-400" />
                                ) : (
                                  <ChevronRight size={14} className="opacity-60 hover:opacity-100" />
                                )}
                              </button>
                              <span>M{r.m}</span>
                              {isCur && (
                                <span className="ml-1 px-1.5 py-0.2 bg-sky-500 text-white rounded-full text-[8px] font-bold tracking-wide">
                                  NOW
                                </span>
                              )}
                            </div>
                          </td>

                          <td className={`px-3 py-2.5 ${subtext} whitespace-nowrap font-medium`}>
                            {r.date}
                          </td>

                          <td className="px-3 py-2.5 font-mono text-xs text-indigo-400 whitespace-nowrap font-medium">
                            {r.rate !== undefined ? `${r.rate}%` : "—"}
                          </td>

                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {r.emi > 0 ? (
                              isPaid ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  ✓ Paid
                                </span>
                              ) : isCur ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                  Current
                                </span>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    isDark
                                      ? "bg-slate-800/60 text-slate-400 border border-slate-700"
                                      : "bg-slate-100 text-slate-500 border border-slate-200"
                                  }`}
                                >
                                  Pending
                                </span>
                              )
                            ) : (
                              <span className={subtext}>—</span>
                            )}
                          </td>

                          <td className="px-3 py-2.5 text-sky-400 font-mono font-medium">
                            {r.disbAmt > 0 ? fmt(r.disbAmt) : <span className={subtext}>—</span>}
                          </td>

                          <td className={`px-3 py-2.5 font-mono font-bold ${heading}`}>
                            {r.emi > 0 ? fmt(r.emi) : <span className={subtext}>—</span>}
                          </td>

                          <td className={`px-3 py-2.5 font-mono ${subtext}`}>
                            {r.stdEmi > 0 ? fmt(r.stdEmi) : <span className={subtext}>—</span>}
                          </td>

                          <td className="px-3 py-2.5 text-violet-400 font-mono font-medium">
                            {r.customEmiAmt ? fmt(r.customEmiAmt) : <span className={subtext}>—</span>}
                          </td>

                          <td className="px-3 py-2.5 text-amber-400 font-mono font-medium">
                            {r.lumpAmt ? fmt(r.lumpAmt) : <span className={subtext}>—</span>}
                          </td>

                          <td className="px-3 py-2.5 text-teal-400 font-mono font-medium">
                            {r.prinPay > 0 ? fmt(r.prinPay) : <span className={subtext}>—</span>}
                          </td>

                          <td className="px-3 py-2.5 text-amber-400 font-mono font-medium">
                            {r.intPay > 0 ? fmt(r.intPay) : <span className={subtext}>—</span>}
                          </td>

                          <td className="px-3 py-2.5 text-emerald-400 font-mono font-bold">
                            {r.interestSaved > 0 ? fmt(r.interestSaved) : <span className={subtext}>—</span>}
                          </td>

                          {hasOd && (
                            <td className="px-3 py-2.5 text-emerald-400 font-mono">
                              {r.odBal > 0 ? fmt(r.odBal) : <span className={subtext}>—</span>}
                            </td>
                          )}

                          <td className={`px-3 py-2.5 font-mono font-bold ${heading}`}>
                            {fmt(r.remaining)}
                          </td>
                        </tr>

                        {/* Day-Wise Granular Breakdown Sub-Table */}
                        {isExpanded && renderDailyBreakdown(r)}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-scaleUp { animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
