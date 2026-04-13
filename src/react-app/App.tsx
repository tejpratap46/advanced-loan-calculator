import { useState, useMemo, useEffect } from 'react';
import { Calculator, Sun, Moon, Share2, Download, Plus, X, Edit2, Check } from 'lucide-react';

const STORAGE_KEY = 'loan-calc-loans';
const THEME_KEY = 'loan-calc-theme';

interface Dispersal { month: number; pct: number; }
interface CustomEmi { fromMonth: number; amount: number; }
interface LumpSum { month: number; amount: number; }

interface LoanData {
  principal: number;
  rate: number;
  years: number;
  startDate: string;
  dispersals: Dispersal[];
  customEmis: CustomEmi[];
  lumpSums: LumpSum[];
}

interface Loan {
  id: string;
  name: string;
  data: LoanData;
}

interface ScheduleRow {
  m: number;
  date: string;
  disbAmt: number;
  disbPct: number;
  emi: number;
  prinPay: number;
  intPay: number;
  remaining: number;
  cumDisbursed: number;
  payType: 'none' | 'std' | 'custom' | 'lump';
  stdEmi: number;
  customEmiAmt: number | null;
  lumpAmt: number | null;
  interestSaved: number;
}

interface Toast {
  msg: string;
  type: 'save' | 'reset' | 'success' | 'error';
}

const DEFAULT_DATA: LoanData = {
  principal: 100000,
  rate: 7.5,
  years: 20,
  startDate: new Date().toISOString().split('T')[0],
  dispersals: [],
  customEmis: [],
  lumpSums: []
};

const getUserCurrency = (): string => {
  const locale = navigator.language || 'en-US';
  const map: { [key: string]: string } = {
    'en-US': 'USD', 'en-GB': 'GBP', 'en-IN': 'INR', 'en-AU': 'AUD', 'en-CA': 'CAD',
    'de-DE': 'EUR', 'fr-FR': 'EUR', 'es-ES': 'EUR', 'ja-JP': 'JPY', 'zh-CN': 'CNY',
  };
  if (map[locale]) return map[locale];
  const lang = locale.split('-')[0];
  const match = Object.keys(map).find(k => k.startsWith(lang));
  return match ? map[match] : 'USD';
};

const getCurrencySymbol = (c: string): string => {
  const s: { [k: string]: string } = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹', AUD: 'A$', CAD: 'C$', CNY: '¥' };
  return s[c] || c;
};

/* ── Shared input class ─────────────────────────────────────────────────── */

export default function LoanCalculator() {
  const [currency] = useState(getUserCurrency());
  const [locale] = useState(navigator.language || 'en-US');
  const [isDark, setIsDark] = useState(true);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [activeTabId, setActiveTabId] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved'>('saved');
  const [toast, setToast] = useState<Toast | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [newDisp, setNewDisp] = useState({ month: 1, pct: 100 });
  const [showDisp, setShowDisp] = useState(false);
  const [newEmi, setNewEmi] = useState({ fromMonth: 1, amount: '' });
  const [showEmi, setShowEmi] = useState(false);
  const [newLump, setNewLump] = useState({ month: 0, amount: '' });
  const [showLump, setShowLump] = useState(false);

  const activeLoan = loans.find(l => l.id === activeTabId);
  const data = activeLoan?.data || DEFAULT_DATA;

  const fmt = (v: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  const showToast = (msg: string, type: Toast['type'] = 'save') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const updateData = (u: Partial<LoanData>) => {
    if (!activeTabId) return;
    setLoans(p => p.map(l => l.id === activeTabId ? { ...l, data: { ...l.data, ...u } } : l));
  };

  const addLoan = () => {
    const n: Loan = { id: Date.now().toString(), name: `Loan ${loans.length + 1}`, data: { ...DEFAULT_DATA } };
    setLoans([...loans, n]);
    setActiveTabId(n.id);
  };

  const deleteLoan = (id: string) => {
    if (loans.length <= 1) { showToast('Cannot delete last loan', 'error'); return; }
    const i = loans.findIndex(l => l.id === id);
    const n = loans.filter(l => l.id !== id);
    setLoans(n);
    if (activeTabId === id) setActiveTabId(n[Math.max(0, i - 1)].id);
  };

  const renameLoan = () => {
    if (editingTabId && editingName.trim())
      setLoans(p => p.map(l => l.id === editingTabId ? { ...l, name: editingName.trim() } : l));
    setEditingTabId(null);
  };

  const encode = () => btoa(encodeURIComponent(JSON.stringify({ loans, activeId: activeTabId })));
  const decode = (h: string) => { try { return JSON.parse(decodeURIComponent(atob(h))); } catch { return null; } };
  const getShareUrl = () => `${window.location.origin}${window.location.pathname}#${encode()}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true); showToast('Copied!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch { showToast('Failed', 'error'); }
  };

  const share = async () => {
    const url = getShareUrl();
    if (navigator.share) {
      try { await navigator.share({ title: 'Loan Calculator', url }); showToast('Shared!', 'success'); }
      catch (e: any) { if (e.name !== 'AbortError') setShowShareModal(true); }
    } else setShowShareModal(true);
  };

  const downloadCSV = () => {
    try {
      const h = ['Month', 'Date', 'Status', 'Disbursement', 'Disb %', 'EMI', 'Std EMI', 'Custom EMI', 'Lump', 'Principal', 'Interest', 'Int Saved', 'Balance'];
      const cm = getCurrentMonth();
      const r = schedule.map(r => {
        const s = r.emi === 0 ? '-' : r.m < cm ? 'Paid' : r.m === cm ? 'Current' : 'Pending';
        return [r.m, r.date, s, r.disbAmt || '', r.disbPct || '', r.emi || '', r.stdEmi || '', r.customEmiAmt || '', r.lumpAmt || '', r.prinPay || '', r.intPay || '', r.interestSaved || '', r.remaining];
      });
      const tot = ['TOTALS', '', '', totals.d, '', totals.e, '', '', '', totals.p, totals.i, totals.s, ''];
      const csv = [['Loan:', activeLoan?.name], ['Generated:', new Date().toLocaleDateString()], ['Currency:', currency], [], h, ...r, tot]
        .map(row => row.map(c => { const s = String(c); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `loan-${activeLoan?.name.replace(/\s/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      showToast('Downloaded!', 'success');
    } catch { showToast('Failed', 'error'); }
  };

  useEffect(() => {
    try {
      const hash = window.location.hash.slice(1);
      if (hash) {
        const d = decode(hash);
        if (d?.loans?.length) { setLoans(d.loans); setActiveTabId(d.activeId || d.loans[0].id); showToast('Loaded', 'success'); }
      } else {
        const s = localStorage.getItem(STORAGE_KEY);
        if (s) {
          const p = JSON.parse(s);
          if (p.loans?.length) { setLoans(p.loans); setActiveTabId(p.activeId || p.loans[0].id); }
          else { setLoans([{ id: '1', name: 'My Loan', data: DEFAULT_DATA }]); setActiveTabId('1'); }
        } else { setLoans([{ id: '1', name: 'My Loan', data: DEFAULT_DATA }]); setActiveTabId('1'); }
      }
      const theme = localStorage.getItem(THEME_KEY);
      const dark = theme !== 'light';
      setIsDark(dark);
      document.documentElement.classList[dark ? 'add' : 'remove']('dark');
    } catch {
      setLoans([{ id: '1', name: 'My Loan', data: DEFAULT_DATA }]); setActiveTabId('1');
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveStatus('saving');
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ loans, activeId: activeTabId })); setSaveStatus('saved'); }
      catch { setSaveStatus('saved'); }
    }, 400);
    return () => clearTimeout(t);
  }, [loans, activeTabId, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
      document.documentElement.classList[isDark ? 'add' : 'remove']('dark');
    } catch { /* noop */ }
  }, [isDark, loaded]);

  const getCurrentMonth = () => {
    const s = new Date(data.startDate), n = new Date();
    return Math.max(1, (n.getFullYear() - s.getFullYear()) * 12 + n.getMonth() - s.getMonth() + 1);
  };

  const schedule = useMemo<ScheduleRow[]>(() => {
    const { principal: totalPrincipal, rate, years: y, startDate: sd, dispersals: ds, customEmis: ces, lumpSums: ls } = data;
    const downPayment = ls.filter(l => l.month === 0).reduce((sum, l) => sum + l.amount, 0);
    const loanPrincipal = Math.max(0, totalPrincipal - downPayment);
    const mr = rate / 100 / 12, tm = y * 12;
    const rows: ScheduleRow[] = [], sds = [...ds].sort((a, b) => a.month - b.month);
    let di = 0, rem = 0, cd = 0;

    const getCE = (m: number) => ces.filter(e => e.fromMonth <= m).sort((a, b) => b.fromMonth - a.fromMonth)[0]?.amount || null;
    const getLS = (m: number) => ls.find(l => l.month === m)?.amount ?? null;

    const std: { rem: number; int: number }[] = [];
    let sr = 0, sdi = 0;
    for (let m = 1; m <= tm; m++) {
      let da = 0;
      if (sdi < sds.length && sds[sdi].month === m) { da = loanPrincipal * sds[sdi].pct / 100; sr += da; sdi++; }
      if (sr <= 0) { std.push({ rem: 0, int: 0 }); continue; }
      const rm = tm - m + 1, se = mr === 0 ? sr / rm : sr * mr * Math.pow(1 + mr, rm) / (Math.pow(1 + mr, rm) - 1);
      const ip = sr * mr; let pp = se - ip; if (pp > sr) pp = sr; sr = Math.max(0, sr - pp);
      std.push({ rem: sr, int: ip });
      if (sr <= 0.01) { for (let r = m + 1; r <= tm; r++) std.push({ rem: 0, int: 0 }); break; }
    }

    for (let m = 1; m <= tm; m++) {
      const d = new Date(sd); d.setMonth(d.getMonth() + m - 1);
      let da = 0, dp = 0;
      if (di < sds.length && sds[di].month === m) { dp = sds[di].pct; da = loanPrincipal * dp / 100; rem += da; cd += da; di++; }
      if (rem <= 0) {
        rows.push({ m, date: d.toLocaleDateString(locale, { year: 'numeric', month: 'short' }), disbAmt: da, disbPct: dp, emi: 0, prinPay: 0, intPay: 0, remaining: 0, cumDisbursed: cd, payType: 'none', stdEmi: 0, customEmiAmt: null, lumpAmt: null, interestSaved: 0 });
        continue;
      }
      const rm = tm - m + 1, se = mr === 0 ? rem / rm : rem * mr * Math.pow(1 + mr, rm) / (Math.pow(1 + mr, rm) - 1);
      const cea = getCE(m), la = getLS(m), ae = Math.max(se, cea ?? 0, la ?? 0);
      let pt: ScheduleRow['payType'] = 'std';
      if (la && ae === la && la > se) pt = 'lump'; else if (cea && ae > se) pt = 'custom';
      const ip = rem * mr; let pp = ae - ip; if (pp > rem) pp = rem; const emi = ip + pp; rem = Math.max(0, rem - pp);
      const si = std[m - 1]?.int || 0, isv = pt === 'std' ? 0 : Math.max(0, si - ip);
      rows.push({ m, date: d.toLocaleDateString(locale, { year: 'numeric', month: 'short' }), disbAmt: da, disbPct: dp, emi, prinPay: pp, intPay: ip, remaining: rem, cumDisbursed: cd, payType: pt, stdEmi: se, customEmiAmt: cea, lumpAmt: la, interestSaved: isv });
      if (rem <= 0.01) {
        for (let r = m + 1; r <= tm; r++) {
          const rd = new Date(sd); rd.setMonth(rd.getMonth() + r - 1);
          rows.push({ m: r, date: rd.toLocaleDateString(locale, { year: 'numeric', month: 'short' }), disbAmt: 0, disbPct: 0, emi: 0, prinPay: 0, intPay: 0, remaining: 0, cumDisbursed: cd, payType: 'none', stdEmi: 0, customEmiAmt: null, lumpAmt: null, interestSaved: 0 });
        }
        break;
      }
    }
    return rows;
  }, [data, locale]);

  const totals = useMemo(() =>
    schedule.reduce((a, r) => ({ d: Math.max(a.d, r.cumDisbursed), e: a.e + r.emi, p: a.p + r.prinPay, i: a.i + r.intPay, s: a.s + r.interestSaved }), { d: 0, e: 0, p: 0, i: 0, s: 0 }),
    [schedule]);

  const cm = getCurrentMonth();
  const paidTill = schedule.slice(0, Math.min(cm, schedule.length)).reduce((s, r) => s + r.emi, 0);
  const pending = cm >= schedule.length ? 0 : schedule.slice(cm).reduce((s, r) => s + r.emi, 0);

  const addDisp = () => {
    if (newDisp.month < 1 || newDisp.month > data.years * 12 || newDisp.pct <= 0) return;
    updateData({ dispersals: [...data.dispersals.filter(x => x.month !== newDisp.month), newDisp] });
    setNewDisp({ month: 1, pct: 100 }); setShowDisp(false);
  };
  const addCEmi = () => {
    const a = parseFloat(newEmi.amount); if (!a || a <= 0) return;
    updateData({ customEmis: [...data.customEmis.filter(e => e.fromMonth !== newEmi.fromMonth), { fromMonth: newEmi.fromMonth, amount: a }].sort((a, b) => a.fromMonth - b.fromMonth) });
    setNewEmi({ fromMonth: 1, amount: '' }); setShowEmi(false);
  };
  const addLS = () => {
    const a = parseFloat(newLump.amount); const m = newLump.month;
    if (!a || a <= 0 || m < 0) return;
    updateData({ lumpSums: [...data.lumpSums.filter(l => l.month !== m), { month: m, amount: a }].sort((a, b) => a.month - b.month) });
    setNewLump({ month: 0, amount: '' }); setShowLump(false);
  };

  /* ── Theme-aware class helpers ────────────────────────────────────────── */
  const card = isDark
    ? 'bg-white/[0.04] border border-white/[0.08] rounded-2xl backdrop-blur-sm'
    : 'bg-white border border-gray-200 rounded-2xl shadow-sm';

  const surfaceInput = isDark
    ? 'bg-white/[0.06] border border-white/10 text-gray-100 placeholder-gray-500 focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20'
    : 'bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20';

  const label = isDark ? 'text-gray-400' : 'text-gray-500';
  const heading = isDark ? 'text-gray-100' : 'text-gray-900';
  const subtext = isDark ? 'text-gray-400' : 'text-gray-500';
  const divider = isDark ? 'border-white/[0.06]' : 'border-gray-100';
  const root = isDark
    ? 'min-h-screen bg-[#0d0f14] text-gray-100'
    : 'min-h-screen bg-gray-50 text-gray-900';

  if (!loaded) return (
    <div className={`${root} flex items-center justify-center`}>
      <div className="flex items-center gap-3 text-sky-400">
        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-medium tracking-wide">Loading…</span>
      </div>
    </div>
  );

  return (
    <div className={root}>
      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl animate-[slideIn_0.25s_ease-out] flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' :
          toast.type === 'error'   ? 'bg-rose-500 text-white' :
          'bg-sky-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ── Share Modal ───────────────────────────────────────────────────── */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
          <div className={`${card} max-w-md w-full p-6`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-base font-semibold ${heading}`}>Share Calculator</h3>
              <button onClick={() => setShowShareModal(false)} className={`p-1.5 rounded-lg hover:bg-white/10 ${subtext}`}><X size={16} /></button>
            </div>
            <div className={`rounded-xl p-3 mb-4 break-all text-xs font-mono ${isDark ? 'bg-white/[0.06] text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
              {getShareUrl()}
            </div>
            <div className="flex gap-2">
              <button onClick={copy} className="flex-1 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                {copied ? <><Check size={15} /> Copied</> : 'Copy link'}
              </button>
              <button onClick={() => setShowShareModal(false)} className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isDark ? 'bg-white/[0.06] hover:bg-white/10 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                Close
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
              <h1 className={`text-lg font-bold tracking-tight ${heading}`}>Loan Calculator</h1>
              <p className={`text-xs ${subtext}`}>Amortization & payoff planner</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Save indicator */}
            <div className={`hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-white/[0.04]' : 'bg-gray-100'} ${saveStatus === 'saving' ? 'text-sky-400' : 'text-emerald-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saving' ? 'bg-sky-400 animate-pulse' : 'bg-emerald-400'}`} />
              {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
            </div>
            <button onClick={downloadCSV} className={`p-2 rounded-xl transition-colors ${isDark ? 'bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800'}`} title="Export CSV">
              <Download size={16} />
            </button>
            <button onClick={share} className={`p-2 rounded-xl transition-colors ${isDark ? 'bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800'}`} title="Share">
              <Share2 size={16} />
            </button>
            <button onClick={() => setIsDark(p => !p)} className={`p-2 rounded-xl transition-colors ${isDark ? 'bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-yellow-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800'}`} title="Toggle theme">
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide">
          {loans.map(l => (
            <div key={l.id} className={`group flex items-center gap-1 pl-3 pr-2 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTabId === l.id
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                : isDark
                  ? 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.07] hover:text-gray-200'
                  : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}>
              {editingTabId === l.id ? (
                <input autoFocus value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onBlur={renameLoan}
                  onKeyDown={e => e.key === 'Enter' && renameLoan()}
                  className="bg-transparent outline-none w-24 text-sm" />
              ) : (
                <button onClick={() => setActiveTabId(l.id)}>{l.name}</button>
              )}
              <button onClick={() => { setEditingTabId(l.id); setEditingName(l.name); }}
                className={`p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${activeTabId === l.id ? 'hover:bg-white/20' : isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                <Edit2 size={11} />
              </button>
              {loans.length > 1 && (
                <button onClick={() => deleteLoan(l.id)}
                  className={`p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${activeTabId === l.id ? 'hover:bg-white/20' : isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
          <button onClick={addLoan} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
            isDark ? 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 border border-white/[0.06] border-dashed'
                   : 'bg-white border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400'}`}>
            <Plus size={13} /> Add loan
          </button>
        </div>

        {/* ── Summary Cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Disbursed',  value: totals.d,  color: 'text-sky-400',     dot: 'bg-sky-400' },
            { label: 'Interest',   value: totals.i,  color: 'text-amber-400',   dot: 'bg-amber-400' },
            { label: 'Principal',  value: totals.p,  color: 'text-violet-400',  dot: 'bg-violet-400' },
            { label: 'Saved',      value: totals.s,  color: 'text-emerald-400', dot: 'bg-emerald-400' },
            { label: 'Paid',       value: paidTill,  color: 'text-teal-400',    dot: 'bg-teal-400' },
            { label: 'Pending',    value: pending,   color: 'text-rose-400',    dot: 'bg-rose-400' },
          ].map(({ label: l, value: v, color, dot }) => (
            <div key={l} className={`${card} p-4 flex flex-col gap-2`}>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                <span className={`text-[11px] font-medium tracking-wide uppercase ${subtext}`}>{l}</span>
              </div>
              <span className={`text-lg font-bold font-mono tabular-nums leading-none ${color}`}>{fmt(v)}</span>
            </div>
          ))}
        </div>

        {/* ── Inputs ──────────────────────────────────────────────────────── */}
        <div className={`${card} p-5 sm:p-6 mb-6`}>
          <h2 className={`text-sm font-semibold mb-4 ${heading}`}>Loan Parameters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { lbl: `Principal (${getCurrencySymbol(currency)})`, key: 'principal', type: 'number', min: 1000, step: 1000 },
              { lbl: 'Interest rate (% p.a.)', key: 'rate', type: 'number', min: 0, max: 50, step: 0.1 },
              { lbl: 'Tenure (years)', key: 'years', type: 'number', min: 1, max: 30 },
              { lbl: 'Start date', key: 'startDate', type: 'date' },
            ].map(({ lbl, key, type, ...rest }) => (
              <div key={key}>
                <label className={`block text-[11px] font-medium mb-1.5 uppercase tracking-wide ${label}`}>{lbl}</label>
                <input
                  type={type}
                  className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all ${surfaceInput}`}
                  value={(data as any)[key]}
                  onChange={e => updateData({ [key]: type === 'number' ? +e.target.value : e.target.value } as Partial<LoanData>)}
                  {...rest}
                />
              </div>
            ))}
          </div>

          {/* Advanced sections */}
          <div className={`border-t ${divider} pt-4 space-y-4`}>
            {/* Disbursements */}
            <AdvSection
              title="Disbursements" count={data.dispersals.length}
              accentClass="text-sky-400" isDark={isDark}
              tags={data.dispersals.sort((a, b) => a.month - b.month).map(d => ({
                label: `M${d.month}: ${d.pct}%`,
                color: isDark ? 'bg-sky-500/10 text-sky-300 border-sky-500/20' : 'bg-sky-50 text-sky-700 border-sky-200',
                onRemove: () => updateData({ dispersals: data.dispersals.filter(x => x.month !== d.month) })
              }))}
              showForm={showDisp}
              onAdd={() => setShowDisp(true)}
              onClose={() => setShowDisp(false)}
              formContent={
                <div className="flex flex-wrap gap-2 items-center">
                  <NumInput placeholder="Month" value={newDisp.month} onChange={v => setNewDisp({ ...newDisp, month: v })} onEnter={addDisp} isDark={isDark} />
                  <NumInput placeholder="%" value={newDisp.pct} onChange={v => setNewDisp({ ...newDisp, pct: v })} onEnter={addDisp} isDark={isDark} />
                  <ActionBtn onClick={addDisp} color="sky" isDark={isDark}>Add</ActionBtn>
                  <CancelBtn onClick={() => setShowDisp(false)} isDark={isDark} />
                </div>
              }
            />
            {/* Custom EMI */}
            <AdvSection
              title="Custom EMI" count={data.customEmis.length}
              accentClass="text-violet-400" isDark={isDark}
              tags={data.customEmis.map(e => ({
                label: `M${e.fromMonth}: ${fmt(e.amount)}`,
                color: isDark ? 'bg-violet-500/10 text-violet-300 border-violet-500/20' : 'bg-violet-50 text-violet-700 border-violet-200',
                onRemove: () => updateData({ customEmis: data.customEmis.filter(x => x.fromMonth !== e.fromMonth) })
              }))}
              showForm={showEmi}
              onAdd={() => setShowEmi(true)}
              onClose={() => setShowEmi(false)}
              formContent={
                <div className="flex flex-wrap gap-2 items-center">
                  <NumInput placeholder="From month" value={newEmi.fromMonth} onChange={v => setNewEmi({ ...newEmi, fromMonth: v })} onEnter={addCEmi} isDark={isDark} />
                  <StrInput placeholder="Amount" value={newEmi.amount} onChange={v => setNewEmi({ ...newEmi, amount: v })} onEnter={addCEmi} isDark={isDark} />
                  <ActionBtn onClick={addCEmi} color="violet" isDark={isDark}>Add</ActionBtn>
                  <CancelBtn onClick={() => setShowEmi(false)} isDark={isDark} />
                </div>
              }
            />
            {/* Lump Sum */}
            <AdvSection
              title="Lump Sum" count={data.lumpSums.length}
              accentClass="text-amber-400" isDark={isDark}
              tags={data.lumpSums.map(l => ({
                label: l.month === 0 ? `Down: ${fmt(l.amount)}` : `M${l.month}: ${fmt(l.amount)}`,
                color: isDark ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200',
                onRemove: () => updateData({ lumpSums: data.lumpSums.filter(x => x.month !== l.month) })
              }))}
              showForm={showLump}
              onAdd={() => setShowLump(true)}
              onClose={() => setShowLump(false)}
              formContent={
                <div className="flex flex-wrap gap-2 items-center">
                  <NumInput placeholder="Month (0=down)" value={newLump.month} onChange={v => setNewLump({ ...newLump, month: v })} onEnter={addLS} isDark={isDark} min={0} />
                  <StrInput placeholder="Amount" value={newLump.amount} onChange={v => setNewLump({ ...newLump, amount: v })} onEnter={addLS} isDark={isDark} />
                  <ActionBtn onClick={addLS} color="amber" isDark={isDark}>Add</ActionBtn>
                  <CancelBtn onClick={() => setShowLump(false)} isDark={isDark} />
                </div>
              }
            />
          </div>
        </div>

        {/* ── Schedule Table ───────────────────────────────────────────────── */}
        <div className={`${card} overflow-hidden`}>
          <div className="px-5 sm:px-6 py-4 flex items-center justify-between">
            <h2 className={`text-sm font-semibold ${heading}`}>Amortization Schedule</h2>
            <span className={`text-xs ${subtext}`}>{schedule.filter(r => r.emi > 0).length} payments</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className={`border-t ${divider} ${isDark ? 'bg-white/[0.02]' : 'bg-gray-50'}`}>
                  {['Mo', 'Date', 'Status', 'Disb', 'EMI', 'Std EMI', 'Custom EMI', 'Lump', 'Principal', 'Interest', 'Saved', 'Balance'].map(h => (
                    <th key={h} className={`px-3 py-3 text-left font-semibold uppercase tracking-wide text-[10px] ${subtext} whitespace-nowrap`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map(r => {
                  const isCur = r.m === cm, isPaid = r.m < cm;
                  return (
                    <tr key={r.m} className={`border-t transition-colors ${divider} ${
                      isCur
                        ? isDark ? 'bg-sky-500/[0.08]' : 'bg-sky-50'
                        : r.payType === 'lump'
                          ? isDark ? 'bg-amber-500/[0.04]' : 'bg-amber-50/60'
                          : r.payType === 'custom'
                            ? isDark ? 'bg-violet-500/[0.04]' : 'bg-violet-50/60'
                            : isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'
                    }`}>
                      <td className={`px-3 py-2.5 font-medium ${heading} whitespace-nowrap`}>
                        {r.m}
                        {isCur && <span className="ml-1.5 px-1.5 py-0.5 bg-sky-500 text-white rounded-md text-[9px] font-bold tracking-wide">NOW</span>}
                      </td>
                      <td className={`px-3 py-2.5 ${subtext} whitespace-nowrap`}>{r.date}</td>
                      <td className="px-3 py-2.5">
                        {r.emi > 0
                          ? isPaid
                            ? <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ Paid</span>
                            : isCur
                              ? <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">Current</span>
                              : <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-gray-500 border border-white/[0.06]' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>Pending</span>
                          : <span className={subtext}>—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-sky-400 font-mono">{r.disbAmt > 0 ? fmt(r.disbAmt) : <span className={subtext}>—</span>}</td>
                      <td className={`px-3 py-2.5 font-mono font-semibold ${heading}`}>{r.emi > 0 ? fmt(r.emi) : <span className={subtext}>—</span>}</td>
                      <td className={`px-3 py-2.5 font-mono ${subtext}`}>{r.stdEmi > 0 ? fmt(r.stdEmi) : <span className={subtext}>—</span>}</td>
                      <td className="px-3 py-2.5 text-violet-400 font-mono">{r.customEmiAmt ? fmt(r.customEmiAmt) : <span className={subtext}>—</span>}</td>
                      <td className="px-3 py-2.5 text-amber-400 font-mono">{r.lumpAmt ? fmt(r.lumpAmt) : <span className={subtext}>—</span>}</td>
                      <td className="px-3 py-2.5 text-teal-400 font-mono">{r.prinPay > 0 ? fmt(r.prinPay) : <span className={subtext}>—</span>}</td>
                      <td className="px-3 py-2.5 text-amber-400 font-mono">{r.intPay > 0 ? fmt(r.intPay) : <span className={subtext}>—</span>}</td>
                      <td className="px-3 py-2.5 text-emerald-400 font-mono font-semibold">{r.interestSaved > 0 ? fmt(r.interestSaved) : <span className={subtext}>—</span>}</td>
                      <td className={`px-3 py-2.5 font-mono font-semibold ${heading}`}>{fmt(r.remaining)}</td>
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

/* ── Sub-components ─────────────────────────────────────────────────────── */

function AdvSection({ title, count, accentClass, isDark, tags, showForm, onAdd, formContent }: {
  title: string; count: number; accentClass: string; isDark: boolean;
  tags: { label: string; color: string; onRemove: () => void }[];
  showForm: boolean; onAdd: () => void; onClose: () => void;
  formContent: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-2 text-xs font-semibold mb-2 ${isDark ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-900'} transition-colors`}>
        <span className={`transition-transform ${open ? 'rotate-90' : ''} inline-block`}>›</span>
        <span>{title}</span>
        {count > 0 && <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${accentClass} ${isDark ? 'bg-white/[0.06]' : 'bg-gray-100'}`}>{count}</span>}
      </button>
      {open && (
        <div className="pl-4">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(t => (
                <span key={t.label} className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border ${t.color}`}>
                  {t.label}
                  <button onClick={t.onRemove} className="hover:opacity-60 transition-opacity ml-0.5">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {!showForm
            ? <button onClick={onAdd} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${isDark ? 'bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 border border-white/[0.08]' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200'}`}>
                + Add
              </button>
            : formContent}
        </div>
      )}
    </div>
  );
}

function NumInput({ placeholder, value, onChange, onEnter, isDark, min }: {
  placeholder: string; value: number; onChange: (v: number) => void;
  onEnter: () => void; isDark: boolean; min?: number;
}) {
  const cls = isDark
    ? 'w-24 px-2.5 py-1.5 rounded-lg text-xs outline-none bg-white/[0.06] border border-white/10 text-gray-100 placeholder-gray-600 focus:border-sky-400/60 focus:ring-1 focus:ring-sky-400/20'
    : 'w-24 px-2.5 py-1.5 rounded-lg text-xs outline-none bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/20';
  return <input type="number" placeholder={placeholder} value={value} min={min} onChange={e => onChange(+e.target.value)} onKeyDown={e => e.key === 'Enter' && onEnter()} className={cls} />;
}

function StrInput({ placeholder, value, onChange, onEnter, isDark }: {
  placeholder: string; value: string; onChange: (v: string) => void;
  onEnter: () => void; isDark: boolean;
}) {
  const cls = isDark
    ? 'w-28 px-2.5 py-1.5 rounded-lg text-xs outline-none bg-white/[0.06] border border-white/10 text-gray-100 placeholder-gray-600 focus:border-sky-400/60 focus:ring-1 focus:ring-sky-400/20'
    : 'w-28 px-2.5 py-1.5 rounded-lg text-xs outline-none bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/20';
  return <input type="number" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && onEnter()} className={cls} />;
}

function ActionBtn({ onClick, color, children }: {
  onClick: () => void; color: 'sky' | 'violet' | 'amber'; isDark: boolean; children: React.ReactNode;
}) {
  const colors = {
    sky:    'bg-sky-500 hover:bg-sky-400 text-white',
    violet: 'bg-violet-500 hover:bg-violet-400 text-white',
    amber:  'bg-amber-500 hover:bg-amber-400 text-white',
  };
  return <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${colors[color]}`}>{children}</button>;
}

function CancelBtn({ onClick, isDark }: { onClick: () => void; isDark: boolean }) {
  return (
    <button onClick={onClick} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600'}`}>
      <X size={12} />
    </button>
  );
}