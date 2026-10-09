import { useState, useMemo, useEffect, Fragment } from "react";
import {
  Calculator,
  Sun,
  Moon,
  Share2,
  Download,
  Plus,
  X,
  Edit2,
  Check,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

// Types
import {
  Loan,
  LoanData,
  ScheduleRow,
  Toast,
  MiscExpense,
  Dispersal,
  CustomEmi,
  LumpSum,
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

// Components
import { AdvSection } from "./components/ui/AdvSection";
import { NumInput } from "./components/ui/NumInput";
import { StrInput } from "./components/ui/StrInput";
import { ActionBtn } from "./components/ui/ActionBtn";
import { CancelBtn } from "./components/ui/CancelBtn";

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
  const [copied, setCopied] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncModalData, setSyncModalData] = useState<{
    serverLoans: Loan[];
    serverActiveId: string;
  } | null>(null);

  const [newDisp, setNewDisp] = useState<{
    id?: string;
    month: number;
    day: number;
    amount: number;
    originalId?: string;
  }>({ month: 1, day: 1, amount: 0 });
  const [showDisp, setShowDisp] = useState(false);
  const [newEmi, setNewEmi] = useState<{
    id?: string;
    fromMonth: number;
    day: number;
    amount: string;
    originalId?: string;
  }>({ fromMonth: 1, day: 1, amount: "" });
  const [showEmi, setShowEmi] = useState(false);
  const [newLump, setNewLump] = useState<{
    id?: string;
    month: number;
    day: number;
    amount: string;
    originalId?: string;
  }>({ month: 0, day: 1, amount: "" });
  const [showLump, setShowLump] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Record<number, boolean>>({});
  const [newOd, setNewOd] = useState<{
    fromMonth: number;
    amount: string;
    originalMonth?: number;
  }>({ fromMonth: 1, amount: "" });
  const [showOd, setShowOd] = useState(false);
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
  const [showMisc, setShowMisc] = useState(false);

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
      name: `Loan ${loans.length + 1}`,
      data: { ...DEFAULT_DATA },
    };
    setLoans([...loans, n]);
    setActiveTabId(n.id);
  };

  const deleteLoan = (id: string) => {
    if (loans.length <= 1) {
      showToast("Cannot delete last loan", "error");
      return;
    }
    if (!window.confirm("Are you sure you want to close this loan tab?")) {
      return;
    }
    const i = loans.findIndex((l) => l.id === id);
    const n = loans.filter((l) => l.id !== id);
    setLoans(n);
    if (activeTabId === id) setActiveTabId(n[Math.max(0, i - 1)].id);
  };

  const renameLoan = () => {
    if (editingTabId && editingName.trim())
      setLoans((p) =>
        p.map((l) =>
          l.id === editingTabId ? { ...l, name: editingName.trim() } : l,
        ),
      );
    setEditingTabId(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        getShareUrl({ loans, activeId: activeTabId }),
      );
      setCopied(true);
      showToast("Copied!", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Failed", "error");
    }
  };

  const share = async () => {
    const url = getShareUrl({ loans, activeId: activeTabId });
    if (navigator.share) {
      try {
        await navigator.share({ title: "Loan Calculator", url });
        showToast("Shared!", "success");
      } catch (e: any) {
        if (e.name !== "AbortError") setShowShareModal(true);
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

  const getFirebaseConfig = () => {
    const envCfg = (window as any).__FIREBASE_CONFIG__;
    if (envCfg) return envCfg;
    const stored = localStorage.getItem(FIREBASE_CONFIG_KEY);
    return stored ? JSON.parse(stored) : null;
  };

  const ensureFirebase = async () => {
    await loadFirebaseSdk();
    const cfg = getFirebaseConfig();
    if (!cfg) throw new Error("Missing Firebase config");
    const fb = (window as any).firebase;
    if (!fb.apps.length) fb.initializeApp(cfg);
    return fb;
  };

  const signInWithGoogle = async () => {
    try {
      const fb = await ensureFirebase();
      const provider = new fb.auth.GoogleAuthProvider();
      await fb.auth().signInWithPopup(provider);
      showToast("Signed in", "success");
    } catch (error: any) {
      console.error("Firebase Login Error:", error);
      showToast(`Login failed: ${error.message || "Unknown error"}`, "error");
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
      if (doc.exists && doc.data()?.loans?.length > 0) {
        const d = doc.data();
        setSyncModalData({
          serverLoans: migrateLoans(d.loans),
          serverActiveId: d.activeId,
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
      showToast("Synced to Firestore", "success");
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
        name: `${sl.name} (Server)`,
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
      showToast("Downloaded!", "success");
    } catch {
      showToast("Failed", "error");
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
          showToast("Loaded", "success");
        }
      } else {
        const s = localStorage.getItem(STORAGE_KEY);
        if (s) {
          const p = JSON.parse(s);
          if (p.loans?.length) {
            setLoans(migrateLoans(p.loans));
            setActiveTabId(p.activeId || p.loans[0].id);
          } else {
            setLoans([{ id: "1", name: "My Loan", data: DEFAULT_DATA }]);
            setActiveTabId("1");
          }
        } else {
          setLoans([{ id: "1", name: "My Loan", data: DEFAULT_DATA }]);
          setActiveTabId("1");
        }
      }
      const theme = localStorage.getItem(THEME_KEY);
      const dark = theme !== "light";
      setIsDark(dark);
      document.documentElement.classList[dark ? "add" : "remove"]("dark");
    } catch {
      setLoans([{ id: "1", name: "My Loan", data: DEFAULT_DATA }]);
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
        unsub = fb.auth().onAuthStateChanged((u: any) => {
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
    showToast("Exported Daily CSV", "success");
  };

  const addDisp = () => {
    if (
      newDisp.month < 1 ||
      newDisp.month > data.years * 12 ||
      newDisp.amount <= 0
    )
      return;
    const day = Math.min(31, Math.max(1, newDisp.day || 1));
    const currentDispersals = data.dispersals || [];
    let updated: Dispersal[];
    if (newDisp.originalId) {
      updated = currentDispersals.map((d) =>
        (d.id && d.id === newDisp.originalId) || (!d.id && `${d.month}-${d.day || 1}` === newDisp.originalId)
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
      updated = [...currentDispersals, newItem];
    }
    updateData({
      dispersals: updated.sort(
        (a, b) => a.month - b.month || (a.day || 1) - (b.day || 1),
      ),
    });
    setNewDisp({ month: 1, day: 1, amount: 0 });
    setShowDisp(false);
  };

  const addCEmi = () => {
    const a = parseFloat(newEmi.amount);
    if (!a || a <= 0 || newEmi.fromMonth < 1) return;
    const day = Math.min(31, Math.max(1, newEmi.day || 1));
    const currentCustomEmis = data.customEmis || [];
    let updated: CustomEmi[];
    if (newEmi.originalId) {
      updated = currentCustomEmis.map((e) =>
        (e.id && e.id === newEmi.originalId) || (!e.id && `${e.fromMonth}-${e.day || 1}` === newEmi.originalId)
          ? {
              id: e.id || newEmi.originalId,
              fromMonth: newEmi.fromMonth,
              day,
              amount: a,
            }
          : e,
      );
    } else {
      const newItem: CustomEmi = {
        id: `emi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fromMonth: newEmi.fromMonth,
        day,
        amount: a,
      };
      updated = [...currentCustomEmis, newItem];
    }
    updateData({
      customEmis: updated.sort(
        (a, b) => a.fromMonth - b.fromMonth || (a.day || 1) - (b.day || 1),
      ),
    });
    setNewEmi({ fromMonth: 1, day: 1, amount: "" });
    setShowEmi(false);
  };

  const addLS = () => {
    const a = parseFloat(newLump.amount);
    const m = newLump.month;
    if (!a || a <= 0 || m < 0) return;
    const day = Math.min(31, Math.max(1, newLump.day || 1));
    const currentLumpSums = data.lumpSums || [];
    let updated: LumpSum[];
    if (newLump.originalId) {
      updated = currentLumpSums.map((l) =>
        (l.id && l.id === newLump.originalId) || (!l.id && `${l.month}-${l.day || 1}` === newLump.originalId)
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
      updated = [...currentLumpSums, newItem];
    }
    updateData({
      lumpSums: updated.sort(
        (a, b) => a.month - b.month || (a.day || 1) - (b.day || 1),
      ),
    });
    setNewLump({ month: 0, day: 1, amount: "" });
    setShowLump(false);
  };

  const addOd = () => {
    const a = parseFloat(newOd.amount);
    if (isNaN(a) || a < 0) return;
    const item = { fromMonth: newOd.fromMonth, amount: a };
    const currentCustomOds = data.customOds || [];
    updateData({
      customOds: [
        ...currentCustomOds.filter(
          (o) => o.fromMonth !== (newOd.originalMonth ?? newOd.fromMonth),
        ),
        item,
      ].sort((a, b) => a.fromMonth - b.fromMonth),
    });
    setNewOd({ fromMonth: 1, amount: "" });
    setShowOd(false);
  };

  const addMisc = () => {
    const amt = parseFloat(newMisc.amount);
    if (isNaN(amt) || amt <= 0 || !newMisc.date) return;
    const currentMisc = data.miscExpenses || [];
    let updated: MiscExpense[];
    if (newMisc.originalId) {
      updated = currentMisc.map((m) =>
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
      updated = [...currentMisc, newItem];
    }
    updateData({ miscExpenses: updated });
    setShowMisc(false);
    setNewMisc({
      date: new Date().toISOString().split("T")[0],
      amount: "",
      comments: "",
    });
  };

  /* ── Theme-aware class helpers ────────────────────────────────────────── */
  const card = isDark
    ? "bg-white/[0.04] border border-white/[0.1] rounded-sm backdrop-blur-sm shadow-none"
    : "bg-white border border-gray-200 rounded-sm shadow-none";

  const surfaceInput = isDark
    ? "bg-white/[0.06] border border-white/10 text-gray-100 placeholder-gray-500 focus:border-sky-400/70 focus:ring-1 focus:ring-sky-400/20 rounded-sm"
    : "bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 rounded-sm";

  const label = isDark ? "text-gray-400" : "text-gray-500";
  const heading = isDark ? "text-gray-100" : "text-gray-900";
  const subtext = isDark ? "text-gray-400" : "text-gray-500";
  const divider = isDark ? "border-white/[0.06]" : "border-gray-100";
  const root = isDark
    ? "min-h-screen bg-[#0d0f14] text-gray-100"
    : "min-h-screen bg-gray-50 text-gray-900";

  if (!loaded)
    return (
      <div className={`${root} flex items-center justify-center`}>
        <div className="flex items-center gap-3 text-sky-400">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
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
          <span className="text-sm font-medium tracking-wide">Loading…</span>
        </div>
      </div>
    );

  return (
    <div className={root}>
      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-3 py-2 rounded-sm text-xs font-semibold shadow-lg animate-[slideIn_0.25s_ease-out] flex items-center gap-2 ${
            toast.type === "success"
              ? "bg-emerald-500 text-white"
              : toast.type === "error"
                ? "bg-rose-500 text-white"
                : "bg-sky-500 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Share Modal ───────────────────────────────────────────────────── */}
      {showShareModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className={`${card} max-w-md w-full p-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-semibold ${heading}`}>
                Share Calculator
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className={`p-1 rounded-sm hover:bg-white/10 ${subtext}`}
              >
                <X size={14} />
              </button>
            </div>
            <div
              className={`rounded-sm p-2 mb-3 break-all text-xs font-mono ${isDark ? "bg-white/[0.06] text-gray-400" : "bg-gray-100 text-gray-600"}`}
            >
              {getShareUrl({ loans, activeId: activeTabId })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={copy}
                className="flex-1 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={13} /> Copied
                  </>
                ) : (
                  "Copy link"
                )}
              </button>
              <button
                onClick={() => setShowShareModal(false)}
                className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors ${isDark ? "bg-white/[0.06] hover:bg-white/10 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSyncModalData(null)}
        >
          <div
            className={`${card} max-w-md w-full p-6`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-base font-semibold ${heading}`}>
                Sync Conflict
              </h3>
              <button
                onClick={() => setSyncModalData(null)}
                className={`p-1.5 rounded-lg hover:bg-white/10 ${subtext}`}
              >
                <X size={16} />
              </button>
            </div>
            <p className={`text-sm mb-6 ${subtext}`}>
              Server data exists. How would you like to resolve the sync?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleSyncChoice("local")}
                className="w-full px-4 py-3 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Use Local Data (Overwrite Server)
              </button>
              <button
                onClick={() => handleSyncChoice("server")}
                className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Use Server Data (Overwrite Local)
              </button>
              <button
                onClick={() => handleSyncChoice("both")}
                className="w-full px-4 py-3 bg-violet-500 hover:bg-violet-400 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Keep Both (Merge as new tabs)
              </button>
              <button
                onClick={() => setSyncModalData(null)}
                className={`w-full px-4 py-3 mt-2 rounded-xl text-sm font-semibold transition-colors ${isDark ? "bg-white/[0.06] hover:bg-white/10 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-5">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-sky-500/20 flex items-center justify-center border border-sky-500/30">
              <Calculator size={16} className="text-sky-400" />
            </div>
            <div>
              <h1 className={`text-base font-bold tracking-tight ${heading}`}>
                Loan Calculator
              </h1>
              <p className={`text-[11px] ${subtext}`}>
                Amortization & payoff planner
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {authReady &&
              (userEmail ? (
                <>
                  <button
                    onClick={initiateSync}
                    disabled={syncBusy}
                    className={`px-2.5 py-1 rounded-sm text-xs font-semibold transition-colors ${isDark ? "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"}`}
                  >
                    {syncBusy ? "Syncing…" : "Sync"}
                  </button>
                  <button
                    onClick={signOut}
                    title={`Sign out (${userEmail})`}
                    className={`max-w-[85px] xs:max-w-[120px] sm:max-w-[180px] truncate px-2 py-1 rounded-sm text-[11px] sm:text-xs font-semibold transition-colors ${isDark ? "bg-white/[0.04] hover:bg-white/[0.08] text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
                  >
                    <span className="sm:hidden">{userEmail.split("@")[0]}</span>
                    <span className="hidden sm:inline">{userEmail}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className={`px-2.5 py-1 rounded-sm text-xs font-semibold transition-colors ${isDark ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
                >
                  Google Login
                </button>
              ))}
            {/* Save indicator */}
            <div
              className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm ${isDark ? "bg-white/[0.04]" : "bg-gray-100"} ${saveStatus === "saving" ? "text-sky-400" : "text-emerald-400"}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${saveStatus === "saving" ? "bg-sky-400 animate-pulse" : "bg-emerald-400"}`}
              />
              {saveStatus === "saving" ? "Saving…" : "Saved"}
            </div>
            <button
              onClick={downloadCSV}
              className={`p-1.5 rounded-sm transition-colors ${isDark ? "bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800"}`}
              title="Export CSV"
            >
              <Download size={14} />
            </button>
            <button
              onClick={share}
              className={`p-1.5 rounded-sm transition-colors ${isDark ? "bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800"}`}
              title="Share"
            >
              <Share2 size={14} />
            </button>
            <button
              onClick={() => setIsDark((p) => !p)}
              className={`p-1.5 rounded-sm transition-colors ${isDark ? "bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-yellow-300" : "bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800"}`}
              title="Toggle theme"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-hide">
          {loans.map((l) => (
            <div
              key={l.id}
              className={`group flex items-center gap-1 pl-2.5 pr-1.5 py-1.5 rounded-sm text-xs font-medium whitespace-nowrap transition-all border ${
                activeTabId === l.id
                  ? "bg-sky-500 text-white border-sky-400"
                  : isDark
                    ? "bg-white/[0.04] text-gray-400 border-white/10 hover:bg-white/[0.07] hover:text-gray-200"
                    : "bg-white border-gray-200 text-gray-600 hover:text-gray-800 hover:border-gray-300"
              }`}
            >
              {editingTabId === l.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={renameLoan}
                  onKeyDown={(e) => e.key === "Enter" && renameLoan()}
                  className="bg-transparent outline-none w-20 text-xs"
                />
              ) : (
                <button onClick={() => setActiveTabId(l.id)}>{l.name}</button>
              )}
              <button
                onClick={() => {
                  setEditingTabId(l.id);
                  setEditingName(l.name);
                }}
                className={`p-0.5 rounded-sm ${activeTabId === l.id ? "hover:bg-white/20" : isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
              >
                <Edit2 size={10} />
              </button>
              {loans.length > 1 && (
                <button
                  onClick={() => deleteLoan(l.id)}
                  className={`p-0.5 rounded-sm ${activeTabId === l.id ? "hover:bg-white/20" : isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addLoan}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-xs font-medium whitespace-nowrap transition-colors border ${
              isDark
                ? "bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 border-white/10 border-dashed"
                : "bg-white border-dashed border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400"
            }`}
          >
            <Plus size={12} /> Add loan
          </button>
        </div>

        {/* ── Summary Cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
          {[
            {
              label: "Disbursed",
              value: totals.d,
              color: "text-sky-400",
              dot: "bg-sky-400",
            },
            {
              label: "Interest",
              value: totals.i,
              color: "text-amber-400",
              dot: "bg-amber-400",
            },
            {
              label: "Principal",
              value: totals.p,
              color: "text-violet-400",
              dot: "bg-violet-400",
            },
            {
              label: "Saved",
              value: totals.s,
              color: "text-emerald-400",
              dot: "bg-emerald-400",
            },
            {
              label: "Misc Charges",
              value: totals.m || 0,
              color: "text-orange-400",
              dot: "bg-orange-400",
            },
            {
              label: "Paid",
              value: paidTill,
              color: "text-teal-400",
              dot: "bg-teal-400",
            },
            {
              label: "Pending",
              value: pending,
              color: "text-rose-400",
              dot: "bg-rose-400",
            },
          ].map(({ label: l, value: v, color, dot }) => (
            <div key={l} className={`${card} p-2.5 flex flex-col gap-1`}>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                <span
                  className={`text-[10px] font-medium tracking-wide uppercase ${subtext}`}
                >
                  {l}
                </span>
              </div>
              <span
                className={`text-sm sm:text-base font-bold font-mono tabular-nums leading-none ${color}`}
              >
                {fmt(v)}
              </span>
            </div>
          ))}
        </div>

        {/* ── Inputs ──────────────────────────────────────────────────────── */}
        <div className={`${card} p-3 sm:p-4 mb-4`}>
          <h2 className={`text-xs font-semibold mb-3 uppercase tracking-wide ${heading}`}>
            Loan Parameters
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
            {[
              {
                lbl: `Principal (${getCurrencySymbol(currency)})`,
                key: "principal",
                type: "number",
                min: 1000,
                step: 1000,
              },
              {
                lbl: "Interest rate (% p.a.)",
                key: "rate",
                type: "number",
                min: 0,
                max: 50,
                step: 0.1,
              },
              {
                lbl: "Tenure (years)",
                key: "years",
                type: "number",
                min: 1,
                max: 30,
              },
              { lbl: "Start date", key: "startDate", type: "date" },
            ].map(({ lbl, key, type, ...rest }) => (
              <div key={key}>
                <label
                  className={`block text-[10px] font-medium mb-1 uppercase tracking-wide ${label}`}
                >
                  {lbl}
                </label>
                <input
                  type={type}
                  className={`w-full px-2.5 py-1.5 text-xs outline-none transition-all ${surfaceInput}`}
                  value={(data as any)[key]}
                  onChange={(e) =>
                    updateData({
                      [key]:
                        type === "number" ? +e.target.value : e.target.value,
                    } as Partial<LoanData>)
                  }
                  {...rest}
                />
              </div>
            ))}
          </div>

          {/* Advanced sections */}
          <div className={`border-t ${divider} pt-4 space-y-4`}>
            {/* Disbursements */}
            <AdvSection
              title="Disbursements"
              count={data.dispersals.length}
              accentClass="text-sky-400"
              isDark={isDark}
              tags={data.dispersals
                .sort(
                  (a, b) =>
                    a.month - b.month || (a.day || 1) - (b.day || 1),
                )
                .map((d) => ({
                  label: `M${d.month} · D${d.day || 1} (${getResolvedDate(d.month, d.day || 1)}): ${fmt(d.amount)}`,
                  color: isDark
                    ? "bg-sky-500/10 text-sky-300 border-sky-500/20"
                    : "bg-sky-50 text-sky-700 border-sky-200",
                  onRemove: () =>
                    updateData({
                      dispersals: data.dispersals.filter((x) =>
                        d.id ? x.id !== d.id : (x.month !== d.month || (x.day || 1) !== (d.day || 1)),
                      ),
                    }),
                  onClick: () => {
                    setNewDisp({
                      id: d.id,
                      month: d.month,
                      day: d.day || 1,
                      amount: d.amount,
                      originalId: d.id || `${d.month}-${d.day || 1}`,
                    });
                    setShowDisp(true);
                  },
                }))}
              showForm={showDisp}
              onAdd={() => {
                setNewDisp({ month: 1, day: 1, amount: 0 });
                setShowDisp(true);
              }}
              onClose={() => setShowDisp(false)}
              formContent={
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
                      setNewDisp({
                        ...newDisp,
                        day: Math.min(31, Math.max(1, v)),
                      })
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
                  <span
                    className={`text-[11px] px-2 py-1 rounded font-mono ${
                      isDark
                        ? "bg-sky-500/10 text-sky-300 border border-sky-500/20"
                        : "bg-sky-50 text-sky-700 border border-sky-200"
                    }`}
                  >
                    📅 {getResolvedDate(newDisp.month, newDisp.day)}
                  </span>
                  <ActionBtn onClick={addDisp} color="sky" isDark={isDark}>
                    {newDisp.originalId !== undefined ? "Save" : "Add"}
                  </ActionBtn>
                  <CancelBtn
                    onClick={() => {
                      setShowDisp(false);
                      setNewDisp({ month: 1, day: 1, amount: 0 });
                    }}
                    isDark={isDark}
                  />
                </div>
              }
            />
            {/* Custom EMI */}
            <AdvSection
              title="Custom EMI"
              count={data.customEmis.length}
              accentClass="text-violet-400"
              isDark={isDark}
              tags={data.customEmis
                .sort(
                  (a, b) =>
                    a.fromMonth - b.fromMonth || (a.day || 1) - (b.day || 1),
                )
                .map((e) => ({
                  label: `M${e.fromMonth} · D${e.day || 1} (${getResolvedDate(e.fromMonth, e.day || 1)}): ${fmt(e.amount)}`,
                  color: isDark
                    ? "bg-violet-500/10 text-violet-300 border-violet-500/20"
                    : "bg-violet-50 text-violet-700 border-violet-200",
                  onRemove: () =>
                    updateData({
                      customEmis: data.customEmis.filter((x) =>
                        e.id ? x.id !== e.id : (x.fromMonth !== e.fromMonth || (x.day || 1) !== (e.day || 1)),
                      ),
                    }),
                  onClick: () => {
                    setNewEmi({
                      id: e.id,
                      fromMonth: e.fromMonth,
                      day: e.day || 1,
                      amount: e.amount.toString(),
                      originalId: e.id || `${e.fromMonth}-${e.day || 1}`,
                    });
                    setShowEmi(true);
                  },
                }))}
              showForm={showEmi}
              onAdd={() => {
                setNewEmi({ fromMonth: 1, day: 1, amount: "" });
                setShowEmi(true);
              }}
              onClose={() => setShowEmi(false)}
              formContent={
                <div className="flex flex-wrap gap-2 items-center">
                  <NumInput
                    placeholder="From month"
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
                      setNewEmi({
                        ...newEmi,
                        day: Math.min(31, Math.max(1, v)),
                      })
                    }
                    onEnter={addCEmi}
                    isDark={isDark}
                    min={1}
                    max={31}
                  />
                  <StrInput
                    placeholder="Amount"
                    value={newEmi.amount}
                    onChange={(v) => setNewEmi({ ...newEmi, amount: v })}
                    onEnter={addCEmi}
                    isDark={isDark}
                  />
                  <span
                    className={`text-[11px] px-2 py-1 rounded font-mono ${
                      isDark
                        ? "bg-violet-500/10 text-violet-300 border border-violet-500/20"
                        : "bg-violet-50 text-violet-700 border border-violet-200"
                    }`}
                  >
                    📅 {getResolvedDate(newEmi.fromMonth, newEmi.day)}
                  </span>
                  <ActionBtn onClick={addCEmi} color="violet" isDark={isDark}>
                    {newEmi.originalId !== undefined ? "Save" : "Add"}
                  </ActionBtn>
                  <CancelBtn
                    onClick={() => {
                      setShowEmi(false);
                      setNewEmi({ fromMonth: 1, day: 1, amount: "" });
                    }}
                    isDark={isDark}
                  />
                </div>
              }
            />
            {/* Lump Sum */}
            <AdvSection
              title="Lump Sum"
              count={data.lumpSums.length}
              accentClass="text-amber-400"
              isDark={isDark}
              tags={data.lumpSums
                .sort(
                  (a, b) =>
                    a.month - b.month || (a.day || 1) - (b.day || 1),
                )
                .map((l) => ({
                  label:
                    l.month === 0
                      ? `Down · D${l.day || 1} (${getResolvedDate(1, l.day || 1)}): ${fmt(l.amount)}`
                      : `M${l.month} · D${l.day || 1} (${getResolvedDate(l.month, l.day || 1)}): ${fmt(l.amount)}`,
                  color: isDark
                    ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                    : "bg-amber-50 text-amber-700 border-amber-200",
                  onRemove: () =>
                    updateData({
                      lumpSums: data.lumpSums.filter((x) =>
                        l.id ? x.id !== l.id : (x.month !== l.month || (x.day || 1) !== (l.day || 1)),
                      ),
                    }),
                  onClick: () => {
                    setNewLump({
                      id: l.id,
                      month: l.month,
                      day: l.day || 1,
                      amount: l.amount.toString(),
                      originalId: l.id || `${l.month}-${l.day || 1}`,
                    });
                    setShowLump(true);
                  },
                }))}
              showForm={showLump}
              onAdd={() => {
                setNewLump({ month: 0, day: 1, amount: "" });
                setShowLump(true);
              }}
              onClose={() => setShowLump(false)}
              formContent={
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
                      setNewLump({
                        ...newLump,
                        day: Math.min(31, Math.max(1, v)),
                      })
                    }
                    onEnter={addLS}
                    isDark={isDark}
                    min={1}
                    max={31}
                  />
                  <StrInput
                    placeholder="Amount"
                    value={newLump.amount}
                    onChange={(v) => setNewLump({ ...newLump, amount: v })}
                    onEnter={addLS}
                    isDark={isDark}
                  />
                  <span
                    className={`text-[11px] px-2 py-1 rounded font-mono ${
                      isDark
                        ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    📅 {getResolvedDate(Math.max(1, newLump.month), newLump.day)}
                  </span>
                  <ActionBtn onClick={addLS} color="amber" isDark={isDark}>
                    {newLump.originalId !== undefined ? "Save" : "Add"}
                  </ActionBtn>
                  <CancelBtn
                    onClick={() => {
                      setShowLump(false);
                      setNewLump({ month: 0, day: 1, amount: "" });
                    }}
                    isDark={isDark}
                  />
                </div>
              }
            />
            {/* Overdraft / Offset Account */}
            <AdvSection
              title="Overdraft / Offset"
              count={(data.baselineOd ? 1 : 0) + (data.customOds?.length || 0)}
              accentClass="text-emerald-400"
              isDark={isDark}
              tags={[
                ...(data.baselineOd
                  ? [
                      {
                        label: `Baseline OD: ${fmt(data.baselineOd)}`,
                        color: isDark
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200",
                        onRemove: () => updateData({ baselineOd: 0 }),
                      },
                    ]
                  : []),
                ...(data.customOds || []).map((o) => ({
                  label: `M${o.fromMonth} OD: ${fmt(o.amount)}`,
                  color: isDark
                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200",
                  onRemove: () =>
                    updateData({
                      customOds: (data.customOds || []).filter(
                        (x) => x.fromMonth !== o.fromMonth,
                      ),
                    }),
                  onClick: () => {
                    setNewOd({
                      fromMonth: o.fromMonth,
                      amount: o.amount.toString(),
                      originalMonth: o.fromMonth,
                    });
                    setShowOd(true);
                  },
                })),
              ]}
              showForm={showOd}
              onAdd={() => {
                setNewOd({ fromMonth: 1, amount: "" });
                setShowOd(true);
              }}
              onClose={() => setShowOd(false)}
              formContent={
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`text-xs ${subtext}`}>Baseline OD Balance:</span>
                    <NumInput
                      placeholder="Baseline OD Balance"
                      value={data.baselineOd || 0}
                      onChange={(v) => updateData({ baselineOd: v })}
                      onEnter={() => {}}
                      isDark={isDark}
                      min={0}
                    />
                  </div>
                  <div className={`border-t ${divider} my-1`} />
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`text-xs ${subtext}`}>Add Monthly OD Balance:</span>
                    <NumInput
                      placeholder="From Month"
                      value={newOd.fromMonth}
                      onChange={(v) => setNewOd({ ...newOd, fromMonth: v })}
                      onEnter={addOd}
                      isDark={isDark}
                      min={1}
                    />
                    <StrInput
                      placeholder="OD Balance Amount"
                      value={newOd.amount}
                      onChange={(v) => setNewOd({ ...newOd, amount: v })}
                      onEnter={addOd}
                      isDark={isDark}
                    />
                    <ActionBtn onClick={addOd} color="emerald" isDark={isDark}>
                      {newOd.originalMonth !== undefined ? "Save" : "Add"}
                    </ActionBtn>
                    <CancelBtn
                      onClick={() => {
                        setShowOd(false);
                        setNewOd({ fromMonth: 1, amount: "" });
                      }}
                      isDark={isDark}
                    />
                  </div>
                </div>
              }
            />
            {/* Misc Expenses & Charges */}
            <AdvSection
              title="Misc Expenses & Charges"
              count={data.miscExpenses?.length || 0}
              accentClass="text-orange-400"
              isDark={isDark}
              tags={(data.miscExpenses || []).map((m) => ({
                label: `${m.date}: ${fmt(m.amount)}${m.comments ? ` (${m.comments})` : ""}`,
                color: isDark
                  ? "bg-orange-500/10 text-orange-300 border-orange-500/20"
                  : "bg-orange-50 text-orange-700 border-orange-200",
                onRemove: () =>
                  updateData({
                    miscExpenses: (data.miscExpenses || []).filter(
                      (x) => x.id !== m.id,
                    ),
                  }),
                onClick: () => {
                  setNewMisc({
                    id: m.id,
                    date: m.date,
                    amount: m.amount.toString(),
                    comments: m.comments,
                    originalId: m.id,
                  });
                  setShowMisc(true);
                },
              }))}
              showForm={showMisc}
              onAdd={() => {
                setNewMisc({
                  date: new Date().toISOString().split("T")[0],
                  amount: "",
                  comments: "",
                });
                setShowMisc(true);
              }}
              onClose={() => setShowMisc(false)}
              formContent={
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="date"
                    value={newMisc.date}
                    onChange={(e) =>
                      setNewMisc({ ...newMisc, date: e.target.value })
                    }
                    className={`px-2 py-1 text-xs rounded-sm border outline-none transition-colors ${
                      isDark
                        ? "bg-gray-800 border-gray-700 text-gray-200 focus:border-orange-500"
                        : "bg-white border-gray-300 text-gray-800 focus:border-orange-500"
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
                    placeholder="Comments / Description"
                    value={newMisc.comments}
                    onChange={(v) => setNewMisc({ ...newMisc, comments: v })}
                    onEnter={addMisc}
                    isDark={isDark}
                  />
                  <ActionBtn onClick={addMisc} color="orange" isDark={isDark}>
                    {newMisc.originalId !== undefined ? "Save" : "Add"}
                  </ActionBtn>
                  <CancelBtn
                    onClick={() => {
                      setShowMisc(false);
                      setNewMisc({
                        date: new Date().toISOString().split("T")[0],
                        amount: "",
                        comments: "",
                      });
                    }}
                    isDark={isDark}
                  />
                </div>
              }
            />
          </div>
        </div>

        {/* ── Schedule Table ───────────────────────────────────────────────── */}
        <div className={`${card} overflow-hidden`}>
          <div className="px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 sm:gap-3">
              <h2 className={`text-xs font-semibold uppercase tracking-wide ${heading}`}>
                Amortization Schedule
              </h2>
              <button
                type="button"
                onClick={toggleAllMonths}
                className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  isDark
                    ? "bg-white/10 hover:bg-white/20 text-gray-200"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                }`}
                title="Expand or collapse all months to see day-wise calculations"
              >
                {schedule.length > 0 && schedule.every((r) => expandedMonths[r.m])
                  ? "Collapse All"
                  : "Expand All Days"}
              </button>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className={`text-[11px] ${subtext}`}>
                {schedule.filter((r) => r.emi > 0).length} payments
              </span>
              <button
                type="button"
                onClick={exportDailyData}
                className={`text-[10px] flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  isDark
                    ? "bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30"
                    : "bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200"
                }`}
                title="Export complete Day-Wise Granular Schedule CSV"
              >
                <Download className="w-3 h-3" /> Daily CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr
                  className={`border-t ${divider} ${isDark ? "bg-white/[0.02]" : "bg-gray-50"}`}
                >
                  {[
                    "Mo",
                    "Date",
                    "Status",
                    "Disb",
                    "EMI",
                    "Std EMI",
                    "Custom EMI",
                    "Lump",
                    "Principal",
                    "Interest",
                    "Saved",
                    ...(hasOd ? ["OD Bal"] : []),
                    "Balance",
                  ].map((h) => (
                    <th
                      key={h}
                      className={`px-2 py-2 text-left font-semibold uppercase tracking-wide text-[10px] ${subtext} whitespace-nowrap`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map((r) => {
                  const isCur = r.m === cm,
                    isPaid = r.m < cm,
                    isExpanded = !!expandedMonths[r.m];
                  return (
                    <Fragment key={r.m}>
                      <tr
                        className={`border-t transition-colors ${divider} ${
                          isCur
                            ? isDark
                              ? "bg-sky-500/[0.08]"
                              : "bg-sky-50"
                            : r.payType === "lump"
                              ? isDark
                                ? "bg-amber-500/[0.04]"
                                : "bg-amber-50/60"
                              : r.payType === "custom"
                                ? isDark
                                  ? "bg-violet-500/[0.04]"
                                  : "bg-violet-50/60"
                                : isDark
                                  ? "hover:bg-white/[0.02]"
                                  : "hover:bg-gray-50"
                        }`}
                      >
                        <td
                          className={`px-2 py-1.5 font-medium ${heading} whitespace-nowrap`}
                        >
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleMonth(r.m)}
                              className={`p-0.5 rounded cursor-pointer transition-colors ${
                                isDark
                                  ? "hover:bg-white/10 text-gray-300"
                                  : "hover:bg-gray-200 text-gray-600"
                              }`}
                              title={isExpanded ? "Collapse day-wise details" : "Expand day-wise details"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
                              )}
                            </button>
                            <span>{r.m}</span>
                            {isCur && (
                              <span className="ml-1 px-1 py-0.2 bg-sky-500 text-white rounded-sm text-[8px] font-bold tracking-wide">
                                NOW
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className={`px-2 py-1.5 ${subtext} whitespace-nowrap`}
                        >
                          {r.date}
                        </td>
                        <td className="px-2 py-1.5">
                          {r.emi > 0 ? (
                            isPaid ? (
                              <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                ✓ Paid
                              </span>
                            ) : isCur ? (
                              <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                Current
                              </span>
                            ) : (
                              <span
                                className={`px-1.5 py-0.5 rounded-sm text-[9px] font-semibold ${isDark ? "bg-white/[0.04] text-gray-500 border border-white/[0.06]" : "bg-gray-100 text-gray-400 border border-gray-200"}`}
                              >
                                Pending
                              </span>
                            )
                          ) : (
                            <span className={subtext}>—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-sky-400 font-mono">
                          {r.disbAmt > 0 ? (
                            fmt(r.disbAmt)
                          ) : (
                            <span className={subtext}>—</span>
                          )}
                        </td>
                        <td
                          className={`px-2 py-1.5 font-mono font-semibold ${heading}`}
                        >
                          {r.emi > 0 ? (
                            fmt(r.emi)
                          ) : (
                            <span className={subtext}>—</span>
                          )}
                        </td>
                        <td className={`px-2 py-1.5 font-mono ${subtext}`}>
                          {r.stdEmi > 0 ? (
                            fmt(r.stdEmi)
                          ) : (
                            <span className={subtext}>—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-violet-400 font-mono">
                          {r.customEmiAmt ? (
                            fmt(r.customEmiAmt)
                          ) : (
                            <span className={subtext}>—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-amber-400 font-mono">
                          {r.lumpAmt ? (
                            fmt(r.lumpAmt)
                          ) : (
                            <span className={subtext}>—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-teal-400 font-mono">
                          {r.prinPay > 0 ? (
                            fmt(r.prinPay)
                          ) : (
                            <span className={subtext}>—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-amber-400 font-mono">
                          {r.intPay > 0 ? (
                            fmt(r.intPay)
                          ) : (
                            <span className={subtext}>—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-emerald-400 font-mono font-semibold">
                          {r.interestSaved > 0 ? (
                            fmt(r.interestSaved)
                          ) : (
                            <span className={subtext}>—</span>
                          )}
                        </td>
                        {hasOd && (
                          <td className="px-2 py-1.5 text-emerald-400 font-mono">
                            {r.odBal > 0 ? (
                              fmt(r.odBal)
                            ) : (
                              <span className={subtext}>—</span>
                            )}
                          </td>
                        )}
                        <td
                          className={`px-2 py-1.5 font-mono font-semibold ${heading}`}
                        >
                          {fmt(r.remaining)}
                        </td>
                      </tr>

                      {/* Day-Wise Granular Breakdown Sub-Table */}
                      {isExpanded && r.days && r.days.length > 0 && (
                        <tr className={`${isDark ? "bg-[#090b0e]" : "bg-gray-50/70"}`}>
                          <td colSpan={hasOd ? 13 : 12} className="p-0">
                            <div className={`p-3 border-y ${divider}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold tracking-wide uppercase text-sky-400">
                                    Month {r.m} ({r.date}) — Day-Wise Granular Breakdown
                                  </span>
                                  <span className={`text-[10px] ${subtext}`}>
                                    ({r.days.length} days · {r.days.filter((d) => (d.events?.length || 0) > 0).length} active events)
                                  </span>
                                </div>
                              </div>
                              <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded border border-white/5 shadow-inner">
                                <table className="w-full text-[11px]">
                                  <thead className={`sticky top-0 ${isDark ? "bg-gray-900" : "bg-gray-100"} shadow-sm`}>
                                    <tr className={`border-b ${divider}`}>
                                      <th className={`px-2 py-1.5 text-left font-semibold text-[10px] ${subtext}`}>Day / Date</th>
                                      <th className={`px-2 py-1.5 text-left font-semibold text-[10px] ${subtext}`}>Events</th>
                                      <th className={`px-2 py-1.5 text-right font-semibold text-[10px] ${subtext}`}>Disb</th>
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
                                                ? "bg-sky-500/[0.07]"
                                                : "bg-sky-50/50"
                                              : isDark
                                                ? "hover:bg-white/[0.02]"
                                                : "hover:bg-gray-100/50"
                                          }`}
                                        >
                                          <td className="px-2 py-1 whitespace-nowrap font-mono text-[10px]">
                                            <span className="font-semibold text-sky-400">D{d.day}</span>{" "}
                                            <span className={subtext}>({d.date.split(",")[0]})</span>
                                          </td>
                                          <td className="px-2 py-1">
                                            {d.events && d.events.length > 0 ? (
                                              <div className="flex flex-wrap gap-1">
                                                {d.events.map((ev, i) => (
                                                  <span
                                                    key={i}
                                                    className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-sky-500/10 text-sky-300 border border-sky-500/20"
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
                                          <td className="px-2 py-1 text-right font-mono font-semibold">
                                            {fmt(d.balance)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot className={`font-semibold ${isDark ? "bg-white/[0.03]" : "bg-gray-100"}`}>
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
                                      <td className="px-2 py-1.5 text-right font-mono">
                                        —
                                      </td>
                                      <td className="px-2 py-1.5 text-right font-mono font-bold">
                                        {fmt(r.remaining)}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
