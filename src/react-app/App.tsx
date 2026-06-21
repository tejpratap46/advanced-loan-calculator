import { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";

// Types
import { Loan, LoanData, ScheduleRow, Toast } from "./types";

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
} from "./utils/calculations";
import { generateCSV, downloadFile } from "./utils/export";
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
    month: number;
    amount: number;
    originalMonth?: number;
  }>({ month: 1, amount: 0 });
  const [showDisp, setShowDisp] = useState(false);
  const [newEmi, setNewEmi] = useState<{
    fromMonth: number;
    amount: string;
    originalMonth?: number;
  }>({ fromMonth: 1, amount: "" });
  const [showEmi, setShowEmi] = useState(false);
  const [newLump, setNewLump] = useState<{
    month: number;
    amount: string;
    originalMonth?: number;
  }>({ month: 0, amount: "" });
  const [showLump, setShowLump] = useState(false);
  const [newOd, setNewOd] = useState<{
    fromMonth: number;
    amount: string;
    originalMonth?: number;
  }>({ fromMonth: 1, amount: "" });
  const [showOd, setShowOd] = useState(false);

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
      const csv = generateCSV(schedule, totals, cm);
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
    return calculateTotals(schedule);
  }, [schedule]);

  const cm = getCurrentMonth(data.startDate);
  const hasOd = !!((data.baselineOd && data.baselineOd > 0) || (data.customOds && data.customOds.length > 0));
  const paidTill = schedule
    .slice(0, Math.min(cm, schedule.length))
    .reduce((s, r) => s + r.emi, 0);
  const pending =
    cm >= schedule.length
      ? 0
      : schedule.slice(cm).reduce((s, r) => s + r.emi, 0);

  const addDisp = () => {
    if (
      newDisp.month < 1 ||
      newDisp.month > data.years * 12 ||
      newDisp.amount <= 0
    )
      return;
    const item = { month: newDisp.month, amount: newDisp.amount };
    updateData({
      dispersals: [
        ...data.dispersals.filter(
          (x) => x.month !== (newDisp.originalMonth ?? newDisp.month),
        ),
        item,
      ],
    });
    setNewDisp({ month: 1, amount: 0 });
    setShowDisp(false);
  };
  const addCEmi = () => {
    const a = parseFloat(newEmi.amount);
    if (!a || a <= 0) return;
    const item = { fromMonth: newEmi.fromMonth, amount: a };
    updateData({
      customEmis: [
        ...data.customEmis.filter(
          (e) => e.fromMonth !== (newEmi.originalMonth ?? newEmi.fromMonth),
        ),
        item,
      ].sort((a, b) => a.fromMonth - b.fromMonth),
    });
    setNewEmi({ fromMonth: 1, amount: "" });
    setShowEmi(false);
  };
  const addLS = () => {
    const a = parseFloat(newLump.amount);
    const m = newLump.month;
    if (!a || a <= 0 || m < 0) return;
    const item = { month: m, amount: a };
    updateData({
      lumpSums: [
        ...data.lumpSums.filter(
          (l) => l.month !== (newLump.originalMonth ?? m),
        ),
        item,
      ].sort((a, b) => a.month - b.month),
    });
    setNewLump({ month: 0, amount: "" });
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

  /* ── Theme-aware class helpers ────────────────────────────────────────── */
  const card = isDark
    ? "bg-white/[0.04] border border-white/[0.08] rounded-2xl backdrop-blur-sm"
    : "bg-white border border-gray-200 rounded-2xl shadow-sm";

  const surfaceInput = isDark
    ? "bg-white/[0.06] border border-white/10 text-gray-100 placeholder-gray-500 focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
    : "bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20";

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
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl animate-[slideIn_0.25s_ease-out] flex items-center gap-2 ${
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className={`${card} max-w-md w-full p-6`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-base font-semibold ${heading}`}>
                Share Calculator
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className={`p-1.5 rounded-lg hover:bg-white/10 ${subtext}`}
              >
                <X size={16} />
              </button>
            </div>
            <div
              className={`rounded-xl p-3 mb-4 break-all text-xs font-mono ${isDark ? "bg-white/[0.06] text-gray-400" : "bg-gray-100 text-gray-600"}`}
            >
              {getShareUrl({ loans, activeId: activeTabId })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={copy}
                className="flex-1 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={15} /> Copied
                  </>
                ) : (
                  "Copy link"
                )}
              </button>
              <button
                onClick={() => setShowShareModal(false)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isDark ? "bg-white/[0.06] hover:bg-white/10 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center">
              <Calculator size={18} className="text-sky-400" />
            </div>
            <div>
              <h1 className={`text-lg font-bold tracking-tight ${heading}`}>
                Loan Calculator
              </h1>
              <p className={`text-xs ${subtext}`}>
                Amortization & payoff planner
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {authReady &&
              (userEmail ? (
                <>
                  <button
                    onClick={initiateSync}
                    disabled={syncBusy}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${isDark ? "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"}`}
                  >
                    {syncBusy ? "Syncing…" : "Sync"}
                  </button>
                  <button
                    onClick={signOut}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${isDark ? "bg-white/[0.04] hover:bg-white/[0.08] text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
                  >
                    {userEmail}
                  </button>
                </>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${isDark ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
                >
                  Google Login
                </button>
              ))}
            {/* Save indicator */}
            <div
              className={`hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${isDark ? "bg-white/[0.04]" : "bg-gray-100"} ${saveStatus === "saving" ? "text-sky-400" : "text-emerald-400"}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${saveStatus === "saving" ? "bg-sky-400 animate-pulse" : "bg-emerald-400"}`}
              />
              {saveStatus === "saving" ? "Saving…" : "Saved"}
            </div>
            <button
              onClick={downloadCSV}
              className={`p-2 rounded-xl transition-colors ${isDark ? "bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800"}`}
              title="Export CSV"
            >
              <Download size={16} />
            </button>
            <button
              onClick={share}
              className={`p-2 rounded-xl transition-colors ${isDark ? "bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-gray-200" : "bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800"}`}
              title="Share"
            >
              <Share2 size={16} />
            </button>
            <button
              onClick={() => setIsDark((p) => !p)}
              className={`p-2 rounded-xl transition-colors ${isDark ? "bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-yellow-300" : "bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800"}`}
              title="Toggle theme"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide">
          {loans.map((l) => (
            <div
              key={l.id}
              className={`group flex items-center gap-1 pl-3 pr-2 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTabId === l.id
                  ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25"
                  : isDark
                    ? "bg-white/[0.04] text-gray-400 hover:bg-white/[0.07] hover:text-gray-200"
                    : "bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300"
              }`}
            >
              {editingTabId === l.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={renameLoan}
                  onKeyDown={(e) => e.key === "Enter" && renameLoan()}
                  className="bg-transparent outline-none w-24 text-sm"
                />
              ) : (
                <button onClick={() => setActiveTabId(l.id)}>{l.name}</button>
              )}
              <button
                onClick={() => {
                  setEditingTabId(l.id);
                  setEditingName(l.name);
                }}
                className={`p-1 rounded-lg ${activeTabId === l.id ? "hover:bg-white/20" : isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
              >
                <Edit2 size={11} />
              </button>
              {loans.length > 1 && (
                <button
                  onClick={() => deleteLoan(l.id)}
                  className={`p-1 rounded-lg ${activeTabId === l.id ? "hover:bg-white/20" : isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addLoan}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              isDark
                ? "bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 border border-white/[0.06] border-dashed"
                : "bg-white border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400"
            }`}
          >
            <Plus size={13} /> Add loan
          </button>
        </div>

        {/* ── Summary Cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
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
            <div key={l} className={`${card} p-4 flex flex-col gap-2`}>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                <span
                  className={`text-[11px] font-medium tracking-wide uppercase ${subtext}`}
                >
                  {l}
                </span>
              </div>
              <span
                className={`text-lg font-bold font-mono tabular-nums leading-none ${color}`}
              >
                {fmt(v)}
              </span>
            </div>
          ))}
        </div>

        {/* ── Inputs ──────────────────────────────────────────────────────── */}
        <div className={`${card} p-5 sm:p-6 mb-6`}>
          <h2 className={`text-sm font-semibold mb-4 ${heading}`}>
            Loan Parameters
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                  className={`block text-[11px] font-medium mb-1.5 uppercase tracking-wide ${label}`}
                >
                  {lbl}
                </label>
                <input
                  type={type}
                  className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all ${surfaceInput}`}
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
                .sort((a, b) => a.month - b.month)
                .map((d) => ({
                  label: `M${d.month}: ${fmt(d.amount)}`,
                  color: isDark
                    ? "bg-sky-500/10 text-sky-300 border-sky-500/20"
                    : "bg-sky-50 text-sky-700 border-sky-200",
                  onRemove: () =>
                    updateData({
                      dispersals: data.dispersals.filter(
                        (x) => x.month !== d.month,
                      ),
                    }),
                  onClick: () => {
                    setNewDisp({ ...d, originalMonth: d.month });
                    setShowDisp(true);
                  },
                }))}
              showForm={showDisp}
              onAdd={() => {
                setNewDisp({ month: 1, amount: 0 });
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
                  />
                  <NumInput
                    placeholder="Amount"
                    value={newDisp.amount}
                    onChange={(v) => setNewDisp({ ...newDisp, amount: v })}
                    onEnter={addDisp}
                    isDark={isDark}
                  />
                  <ActionBtn onClick={addDisp} color="sky" isDark={isDark}>
                    {newDisp.originalMonth !== undefined ? "Save" : "Add"}
                  </ActionBtn>
                  <CancelBtn
                    onClick={() => {
                      setShowDisp(false);
                      setNewDisp({ month: 1, amount: 0 });
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
              tags={data.customEmis.map((e) => ({
                label: `M${e.fromMonth}: ${fmt(e.amount)}`,
                color: isDark
                  ? "bg-violet-500/10 text-violet-300 border-violet-500/20"
                  : "bg-violet-50 text-violet-700 border-violet-200",
                onRemove: () =>
                  updateData({
                    customEmis: data.customEmis.filter(
                      (x) => x.fromMonth !== e.fromMonth,
                    ),
                  }),
                onClick: () => {
                  setNewEmi({
                    fromMonth: e.fromMonth,
                    amount: e.amount.toString(),
                    originalMonth: e.fromMonth,
                  });
                  setShowEmi(true);
                },
              }))}
              showForm={showEmi}
              onAdd={() => {
                setNewEmi({ fromMonth: 1, amount: "" });
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
                  />
                  <StrInput
                    placeholder="Amount"
                    value={newEmi.amount}
                    onChange={(v) => setNewEmi({ ...newEmi, amount: v })}
                    onEnter={addCEmi}
                    isDark={isDark}
                  />
                  <ActionBtn onClick={addCEmi} color="violet" isDark={isDark}>
                    {newEmi.originalMonth !== undefined ? "Save" : "Add"}
                  </ActionBtn>
                  <CancelBtn
                    onClick={() => {
                      setShowEmi(false);
                      setNewEmi({ fromMonth: 1, amount: "" });
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
              tags={data.lumpSums.map((l) => ({
                label:
                  l.month === 0
                    ? `Down: ${fmt(l.amount)}`
                    : `M${l.month}: ${fmt(l.amount)}`,
                color: isDark
                  ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                  : "bg-amber-50 text-amber-700 border-amber-200",
                onRemove: () =>
                  updateData({
                    lumpSums: data.lumpSums.filter((x) => x.month !== l.month),
                  }),
                onClick: () => {
                  setNewLump({
                    month: l.month,
                    amount: l.amount.toString(),
                    originalMonth: l.month,
                  });
                  setShowLump(true);
                },
              }))}
              showForm={showLump}
              onAdd={() => {
                setNewLump({ month: 0, amount: "" });
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
                  />
                  <StrInput
                    placeholder="Amount"
                    value={newLump.amount}
                    onChange={(v) => setNewLump({ ...newLump, amount: v })}
                    onEnter={addLS}
                    isDark={isDark}
                  />
                  <ActionBtn onClick={addLS} color="amber" isDark={isDark}>
                    {newLump.originalMonth !== undefined ? "Save" : "Add"}
                  </ActionBtn>
                  <CancelBtn
                    onClick={() => {
                      setShowLump(false);
                      setNewLump({ month: 0, amount: "" });
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
          </div>
        </div>

        {/* ── Schedule Table ───────────────────────────────────────────────── */}
        <div className={`${card} overflow-hidden`}>
          <div className="px-5 sm:px-6 py-4 flex items-center justify-between">
            <h2 className={`text-sm font-semibold ${heading}`}>
              Amortization Schedule
            </h2>
            <span className={`text-xs ${subtext}`}>
              {schedule.filter((r) => r.emi > 0).length} payments
            </span>
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
                      className={`px-3 py-3 text-left font-semibold uppercase tracking-wide text-[10px] ${subtext} whitespace-nowrap`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map((r) => {
                  const isCur = r.m === cm,
                    isPaid = r.m < cm;
                  return (
                    <tr
                      key={r.m}
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
                        className={`px-3 py-2.5 font-medium ${heading} whitespace-nowrap`}
                      >
                        {r.m}
                        {isCur && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-sky-500 text-white rounded-md text-[9px] font-bold tracking-wide">
                            NOW
                          </span>
                        )}
                      </td>
                      <td
                        className={`px-3 py-2.5 ${subtext} whitespace-nowrap`}
                      >
                        {r.date}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.emi > 0 ? (
                          isPaid ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              ✓ Paid
                            </span>
                          ) : isCur ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              Current
                            </span>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${isDark ? "bg-white/[0.04] text-gray-500 border border-white/[0.06]" : "bg-gray-100 text-gray-400 border border-gray-200"}`}
                            >
                              Pending
                            </span>
                          )
                        ) : (
                          <span className={subtext}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-sky-400 font-mono">
                        {r.disbAmt > 0 ? (
                          fmt(r.disbAmt)
                        ) : (
                          <span className={subtext}>—</span>
                        )}
                      </td>
                      <td
                        className={`px-3 py-2.5 font-mono font-semibold ${heading}`}
                      >
                        {r.emi > 0 ? (
                          fmt(r.emi)
                        ) : (
                          <span className={subtext}>—</span>
                        )}
                      </td>
                      <td className={`px-3 py-2.5 font-mono ${subtext}`}>
                        {r.stdEmi > 0 ? (
                          fmt(r.stdEmi)
                        ) : (
                          <span className={subtext}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-violet-400 font-mono">
                        {r.customEmiAmt ? (
                          fmt(r.customEmiAmt)
                        ) : (
                          <span className={subtext}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-amber-400 font-mono">
                        {r.lumpAmt ? (
                          fmt(r.lumpAmt)
                        ) : (
                          <span className={subtext}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-teal-400 font-mono">
                        {r.prinPay > 0 ? (
                          fmt(r.prinPay)
                        ) : (
                          <span className={subtext}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-amber-400 font-mono">
                        {r.intPay > 0 ? (
                          fmt(r.intPay)
                        ) : (
                          <span className={subtext}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-emerald-400 font-mono font-semibold">
                        {r.interestSaved > 0 ? (
                          fmt(r.interestSaved)
                        ) : (
                          <span className={subtext}>—</span>
                        )}
                      </td>
                      {hasOd && (
                        <td className="px-3 py-2.5 text-emerald-400 font-mono">
                          {r.odBal > 0 ? (
                            fmt(r.odBal)
                          ) : (
                            <span className={subtext}>—</span>
                          )}
                        </td>
                      )}
                      <td
                        className={`px-3 py-2.5 font-mono font-semibold ${heading}`}
                      >
                        {fmt(r.remaining)}
                      </td>
                    </tr>
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
