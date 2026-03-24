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

export default function LoanCalculator() {
  const [currency] = useState(getUserCurrency());
  const [locale] = useState(navigator.language || 'en-US');
  const [isDark, setIsDark] = useState(false);
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
  const [newLump, setNewLump] = useState({ month: 1, amount: '' });
  const [showLump, setShowLump] = useState(false);

  const activeLoan = loans.find(l => l.id === activeTabId);
  const data = activeLoan?.data || DEFAULT_DATA;

  const fmt = (v: number) => new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  const showToast = (msg: string, type: Toast['type'] = 'save') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  const updateData = (u: Partial<LoanData>) => {
    if (!activeTabId) return;
    setLoans(p => p.map(l => l.id === activeTabId ? { ...l, data: { ...l.data, ...u } } : l));
  };

  const addLoan = () => {
    const n: Loan = { id: Date.now().toString(), name: `Loan ${loans.length + 1}`, data: DEFAULT_DATA };
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
    if (editingTabId && editingName.trim()) {
      setLoans(p => p.map(l => l.id === editingTabId ? { ...l, name: editingName.trim() } : l));
    }
    setEditingTabId(null);
  };

  const encode = () => btoa(encodeURIComponent(JSON.stringify({ loans, activeId: activeTabId })));
  const decode = (h: string) => { try { return JSON.parse(decodeURIComponent(atob(h))); } catch {
        return null; } };
  const getShareUrl = () => `${window.location.origin}${window.location.pathname}#${encode()}`;
  
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      showToast('Copied!', 'success');
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
      const h = ['Month','Date','Status','Disbursement','Disb %','EMI','Std EMI','Custom EMI','Lump','Principal','Interest','Int Saved','Balance'];
      const cm = getCurrentMonth();
      const r = schedule.map(r => {
        const s = r.emi === 0 ? '-' : r.m < cm ? 'Paid' : r.m === cm ? 'Current' : 'Pending';
        return [r.m, r.date, s, r.disbAmt||'', r.disbPct||'', r.emi||'', r.stdEmi||'', r.customEmiAmt||'', r.lumpAmt||'', r.prinPay||'', r.intPay||'', r.interestSaved||'', r.remaining];
      });
      const tot = ['TOTALS','','',totals.d,'',totals.e,'','','',totals.p,totals.i,totals.s,''];
      const csv = [['Loan:',activeLoan?.name],['Generated:',new Date().toLocaleDateString()],['Currency:',currency],[],h,...r,tot]
        .map(row => row.map(c => {const s=String(c); return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`:s;}).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `loan-${activeLoan?.name.replace(/\s/g,'-')}-${new Date().toISOString().split('T')[0]}.csv`;
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
      if (localStorage.getItem(THEME_KEY) === 'dark') { setIsDark(true); document.documentElement.classList.add('dark'); }
    } catch {
      setLoans([{ id: '1', name: 'My Loan', data: DEFAULT_DATA }]); setActiveTabId('1'); }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveStatus('saving');
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ loans, activeId: activeTabId })); setSaveStatus('saved'); }
      catch {
        setSaveStatus('saved'); }
    }, 400);
    return () => clearTimeout(t);
  }, [loans, activeTabId, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
      document.documentElement.classList[isDark ? 'add' : 'remove']('dark');
    } catch {
      // Ignore storage errors (e.g., private browsing mode)
    }
  }, [isDark, loaded]);

  const getCurrentMonth = () => {
    const s = new Date(data.startDate), n = new Date();
    return Math.max(1, (n.getFullYear() - s.getFullYear()) * 12 + n.getMonth() - s.getMonth() + 1);
  };

  const schedule = useMemo<ScheduleRow[]>(() => {
    const { principal: p, rate, years: y, startDate: sd, dispersals: ds, customEmis: ces, lumpSums: ls } = data;
    const mr = rate / 100 / 12, tm = y * 12;
    const rows: ScheduleRow[] = [], sds = [...ds].sort((a,b) => a.month - b.month);
    let di = 0, rem = 0, cd = 0;

    const getCE = (m: number) => ces.filter(e => e.fromMonth <= m).sort((a,b) => b.fromMonth - a.fromMonth)[0]?.amount || null;
    const getLS = (m: number) => ls.find(l => l.month === m)?.amount ?? null;

    const std: { rem: number; int: number }[] = [];
    let sr = 0, sdi = 0;
    for (let m = 1; m <= tm; m++) {
      let da = 0;
      if (sdi < sds.length && sds[sdi].month === m) { da = p * sds[sdi].pct / 100; sr += da; sdi++; }
      if (sr <= 0) { std.push({ rem: 0, int: 0 }); continue; }
      const rm = tm - m + 1, se = mr === 0 ? sr / rm : sr * mr * Math.pow(1+mr,rm) / (Math.pow(1+mr,rm)-1);
      const ip = sr * mr; let pp = se - ip; if (pp > sr) pp = sr; sr = Math.max(0, sr - pp);
      std.push({ rem: sr, int: ip });
      if (sr <= 0.01) { for (let r = m+1; r <= tm; r++) std.push({ rem: 0, int: 0 }); break; }
    }

    for (let m = 1; m <= tm; m++) {
      const d = new Date(sd); d.setMonth(d.getMonth() + m - 1);
      let da = 0, dp = 0;
      if (di < sds.length && sds[di].month === m) { dp = sds[di].pct; da = p * dp / 100; rem += da; cd += da; di++; }
      if (rem <= 0) { rows.push({ m, date: d.toLocaleDateString(locale, { year: 'numeric', month: 'short' }), disbAmt: da, disbPct: dp, emi: 0, prinPay: 0, intPay: 0, remaining: 0, cumDisbursed: cd, payType: 'none', stdEmi: 0, customEmiAmt: null, lumpAmt: null, interestSaved: 0 }); continue; }

      const rm = tm - m + 1, se = mr === 0 ? rem / rm : rem * mr * Math.pow(1+mr,rm) / (Math.pow(1+mr,rm)-1);
      const cea = getCE(m), la = getLS(m), ae = Math.max(se, cea ?? 0, la ?? 0);
      let pt: ScheduleRow['payType'] = 'std';
      if (la && ae === la && la > se) pt = 'lump'; else if (cea && ae > se) pt = 'custom';

      const ip = rem * mr; let pp = ae - ip; if (pp > rem) pp = rem; const emi = ip + pp; rem = Math.max(0, rem - pp);
      const si = std[m-1]?.int || 0, isv = pt === 'std' ? 0 : Math.max(0, si - ip);
      rows.push({ m, date: d.toLocaleDateString(locale, { year: 'numeric', month: 'short' }), disbAmt: da, disbPct: dp, emi, prinPay: pp, intPay: ip, remaining: rem, cumDisbursed: cd, payType: pt, stdEmi: se, customEmiAmt: cea, lumpAmt: la, interestSaved: isv });

      if (rem <= 0.01) { for (let r = m+1; r <= tm; r++) { const rd = new Date(sd); rd.setMonth(rd.getMonth() + r - 1); rows.push({ m: r, date: rd.toLocaleDateString(locale, { year: 'numeric', month: 'short' }), disbAmt: 0, disbPct: 0, emi: 0, prinPay: 0, intPay: 0, remaining: 0, cumDisbursed: cd, payType: 'none', stdEmi: 0, customEmiAmt: null, lumpAmt: null, interestSaved: 0 }); } break; }
    }
    return rows;
  }, [data, locale]);

  const totals = useMemo(() => schedule.reduce((a,r) => ({ d: Math.max(a.d, r.cumDisbursed), e: a.e+r.emi, p: a.p+r.prinPay, i: a.i+r.intPay, s: a.s+r.interestSaved }), { d:0,e:0,p:0,i:0,s:0 }), [schedule]);
  const cm = getCurrentMonth(), paidTill = schedule.slice(0,Math.min(cm,schedule.length)).reduce((s,r)=>s+r.emi,0), pending = cm>=schedule.length?0:schedule.slice(cm).reduce((s,r)=>s+r.emi,0);

  const addDisp = () => { if (newDisp.month<1||newDisp.month>data.years*12||newDisp.pct<=0) return; updateData({ dispersals: [...data.dispersals.filter(x=>x.month!==newDisp.month), newDisp] }); setNewDisp({ month:1, pct:100 }); setShowDisp(false); };
  const addCEmi = () => { const a=parseFloat(newEmi.amount); if (!a||a<=0) return; updateData({ customEmis: [...data.customEmis.filter(e=>e.fromMonth!==newEmi.fromMonth), { fromMonth:newEmi.fromMonth, amount:a }].sort((a,b)=>a.fromMonth-b.fromMonth) }); setNewEmi({ fromMonth:1, amount:'' }); setShowEmi(false); };
  const addLS = () => { const a=parseFloat(newLump.amount); if (!a||a<=0) return; updateData({ lumpSums: [...data.lumpSums.filter(l=>l.month!==newLump.month), { month:newLump.month, amount:a }].sort((a,b)=>a.month-b.month) }); setNewLump({ month:1, amount:'' }); setShowLump(false); };

  if (!loaded) return <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center"><div className="text-blue-500 text-lg">Loading...</div></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-colors duration-300">
      {toast && <div className={`fixed top-4 right-4 px-5 py-3 rounded-xl font-semibold z-50 shadow-2xl animate-[slideIn_0.3s] ${toast.type==='success'?'bg-green-600 text-white':toast.type==='error'?'bg-red-600 text-white':'bg-blue-700 text-white'}`}>{toast.msg}</div>}

      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setShowShareModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">Share</h3>
            <div className="bg-gray-100 dark:bg-slate-700 rounded-lg p-3 mb-4 break-all text-sm text-gray-700 dark:text-gray-300">{getShareUrl()}</div>
            <div className="flex gap-3">
              <button onClick={copy} className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2">{copied?<><Check size={16}/>Copied</>:<>Copy</>}</button>
              <button onClick={()=>setShowShareModal(false)} className="px-4 py-2.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold">Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="px-3 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Calculator className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-400 dark:to-blue-500 bg-clip-text text-transparent">Loan Calculator</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {loans.map(l => (
              <div key={l.id} className={`flex items-center gap-1 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${activeTabId===l.id?'bg-blue-500 text-white shadow-lg':'bg-white/90 dark:bg-slate-800/50 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-800'}`}>
                {editingTabId===l.id ? (
                  <input autoFocus value={editingName} onChange={e=>setEditingName(e.target.value)} onBlur={renameLoan} onKeyDown={e=>e.key==='Enter'&&renameLoan()} className="bg-white/20 dark:bg-slate-600 px-2 py-1 rounded text-sm outline-none w-24 text-gray-900 dark:text-gray-100" />
                ) : (
                  <button onClick={()=>setActiveTabId(l.id)} className="text-sm font-medium">{l.name}</button>
                )}
                <button onClick={()=>{setEditingTabId(l.id); setEditingName(l.name);}} className="p-1 hover:bg-white/20 dark:hover:bg-slate-600 rounded text-gray-500 dark:text-gray-400"><Edit2 size={12}/></button>
                {loans.length>1 && <button onClick={()=>deleteLoan(l.id)} className="p-1 hover:bg-red-500/20 rounded text-gray-500 dark:text-gray-400"><X size={12}/></button>}
              </div>
            ))}
            <button onClick={addLoan} className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-1 text-sm font-medium whitespace-nowrap"><Plus size={14}/>Add Loan</button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <button onClick={downloadCSV} className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm flex items-center gap-1"><Download size={14}/>CSV</button>
            <button onClick={share} className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1"><Share2 size={14}/>Share</button>
            <button onClick={()=>setIsDark(p=>!p)} className="p-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg text-gray-600 dark:text-gray-300">{isDark?<Sun size={16} className="text-yellow-400"/>:<Moon size={16} className="text-gray-600 dark:text-gray-300"/>}</button>
          </div>
          <div className={`text-xs flex items-center gap-2 ${saveStatus==='saving'?'text-blue-500':'text-green-500'} dark:text-gray-400`}>
            <span className={`w-2 h-2 rounded-full ${saveStatus==='saving'?'bg-blue-500 animate-pulse':'bg-green-500'}`}/>
            {saveStatus==='saving'?'Saving...':'Saved'}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
          {[
            { l:'Disbursed', v:totals.d, c:'blue' },
            { l:'Interest', v:totals.i, c:'amber' },
            { l:'Principal', v:totals.p, c:'green' },
            { l:'Saved', v:totals.s, c:'emerald' },
            { l:'Paid', v:paidTill, c:'cyan' },
            { l:'Pending', v:pending, c:'rose' },
          ].map(({l,v,c})=>(
            <div key={l} className="bg-white/90 dark:bg-slate-800/50 rounded-xl p-3 sm:p-4 border-t-2 border-blue-500">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{l}</div>
              <div className={`text-lg sm:text-2xl font-bold font-mono ${c === 'blue' ? 'text-blue-600 dark:text-blue-400' : c === 'amber' ? 'text-amber-600 dark:text-amber-400' : c === 'green' ? 'text-green-600 dark:text-green-400' : c === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : c === 'cyan' ? 'text-cyan-600 dark:text-cyan-400' : 'text-rose-600 dark:text-rose-400'}`}>{fmt(v)}</div>
            </div>
          ))}
        </div>

        {/* Inputs */}
        <div className="bg-white/90 dark:bg-slate-800/50 rounded-2xl p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div><label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Principal ({getCurrencySymbol(currency)})</label><input type="number" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" value={data.principal} onChange={e=>updateData({principal:+e.target.value})} min={1000} step={1000}/></div>
            <div><label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Rate (% p.a.)</label><input type="number" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" value={data.rate} onChange={e=>updateData({rate:+e.target.value})} min={0} max={50} step={0.1}/></div>
            <div><label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Years</label><input type="number" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" value={data.years} onChange={e=>updateData({years:+e.target.value})} min={1} max={30}/></div>
            <div><label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label><input type="date" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" value={data.startDate} onChange={e=>updateData({startDate:e.target.value})}/></div>
          </div>

          {/* Disbursements / Custom EMI / Lump Sum - Collapsible on mobile */}
          <details className="mb-3" open>
            <summary className="cursor-pointer text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Disbursements ({data.dispersals.length})</summary>
            <div className="flex flex-wrap gap-2 mb-2">{data.dispersals.sort((a,b)=>a.month-b.month).map(d=><span key={d.month} className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-full text-xs">M{d.month}: {d.pct}%<button onClick={()=>updateData({dispersals:data.dispersals.filter(x=>x.month!==d.month)})} className="ml-1 hover:text-red-600">×</button></span>)}</div>
            {!showDisp?<button onClick={()=>setShowDisp(true)} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs">+ Add</button>:
            <div className="flex gap-2"><input type="number" className="w-20 px-2 py-1 bg-white dark:bg-slate-700 border rounded text-sm" placeholder="Month" value={newDisp.month} onChange={e=>setNewDisp({...newDisp,month:+e.target.value})}/><input type="number" className="w-20 px-2 py-1 bg-white dark:bg-slate-700 border rounded text-sm" placeholder="%" value={newDisp.pct} onChange={e=>setNewDisp({...newDisp,pct:+e.target.value})}/><button onClick={addDisp} className="px-3 py-1 bg-blue-500 text-white rounded text-xs">Add</button><button onClick={()=>setShowDisp(false)} className="px-2 py-1 bg-red-500/20 text-red-600 rounded text-xs">✕</button></div>}
          </details>

          <details className="mb-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Custom EMI ({data.customEmis.length})</summary>
            <div className="flex flex-wrap gap-2 mb-2">{data.customEmis.map(e=><span key={e.fromMonth} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full text-xs">M{e.fromMonth}: {fmt(e.amount)}<button onClick={()=>updateData({customEmis:data.customEmis.filter(x=>x.fromMonth!==e.fromMonth)})} className="ml-1 hover:text-red-600">×</button></span>)}</div>
            {!showEmi?<button onClick={()=>setShowEmi(true)} className="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-xs">+ Add</button>:
            <div className="flex gap-2"><input type="number" className="w-20 px-2 py-1 bg-white dark:bg-slate-700 border rounded text-sm" placeholder="Month" value={newEmi.fromMonth} onChange={e=>setNewEmi({...newEmi,fromMonth:+e.target.value})}/><input type="number" className="w-24 px-2 py-1 bg-white dark:bg-slate-700 border rounded text-sm" placeholder="Amount" value={newEmi.amount} onChange={e=>setNewEmi({...newEmi,amount:e.target.value})}/><button onClick={addCEmi} className="px-3 py-1 bg-purple-500 text-white rounded text-xs">Add</button><button onClick={()=>setShowEmi(false)} className="px-2 py-1 bg-red-500/20 text-red-600 rounded text-xs">✕</button></div>}
          </details>

          <details>
            <summary className="cursor-pointer text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Lump Sum ({data.lumpSums.length})</summary>
            <div className="flex flex-wrap gap-2 mb-2">{data.lumpSums.map(l=><span key={l.month} className="px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full text-xs">M{l.month}: {fmt(l.amount)}<button onClick={()=>updateData({lumpSums:data.lumpSums.filter(x=>x.month!==l.month)})} className="ml-1 hover:text-red-600">×</button></span>)}</div>
            {!showLump?<button onClick={()=>setShowLump(true)} className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs">+ Add</button>:
            <div className="flex gap-2"><input type="number" className="w-20 px-2 py-1 bg-white dark:bg-slate-700 border rounded text-sm" placeholder="Month" value={newLump.month} onChange={e=>setNewLump({...newLump,month:+e.target.value})}/><input type="number" className="w-24 px-2 py-1 bg-white dark:bg-slate-700 border rounded text-sm" placeholder="Amount" value={newLump.amount} onChange={e=>setNewLump({...newLump,amount:e.target.value})}/><button onClick={addLS} className="px-3 py-1 bg-amber-500 text-white rounded text-xs">Add</button><button onClick={()=>setShowLump(false)} className="px-2 py-1 bg-red-500/20 text-red-600 rounded text-xs">✕</button></div>}
          </details>
        </div>

        {/* Table */}
        <div className="bg-white/90 dark:bg-slate-800/50 rounded-2xl p-4 sm:p-6 overflow-hidden">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">Schedule</h3>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-blue-50 dark:bg-blue-900/30 sticky top-0">
                <tr>{['Mo','Date','Status','Disb','EMI','StdEMI','CEmi','Lump','Prin','Int','Saved','Bal'].map(h=><th key={h} className="px-2 py-2 text-left text-blue-700 dark:text-blue-300 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {schedule.map(r=>{const isCur=r.m===cm,isPaid=r.m<cm; return(
                <tr key={r.m} className={`border-b border-gray-100 dark:border-slate-700/50 ${isCur?'bg-blue-100 dark:bg-blue-900/30 ring-1 ring-blue-400':r.payType==='lump'?'bg-amber-50/50 dark:bg-amber-900/10':r.payType==='custom'?'bg-purple-50/50 dark:bg-purple-900/10':''}`}>
                  <td className="px-2 py-2 text-gray-900 dark:text-gray-100 font-medium">{r.m}{isCur&&<span className="ml-1 px-1 bg-blue-500 text-white rounded text-[9px]">NOW</span>}</td>
                  <td className="px-2 py-2 text-gray-600 dark:text-gray-400">{r.date}</td>
                  <td className="px-2 py-2">{r.emi>0?isPaid?<span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded text-[10px]">✓</span>:isCur?<span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-[10px]">◉</span>:<span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded text-[10px]">⧗</span>:'—'}</td>
                  <td className="px-2 py-2 text-green-600 dark:text-green-400">{r.disbAmt>0?fmt(r.disbAmt):'—'}</td>
                  <td className="px-2 py-2 text-gray-900 dark:text-gray-100">{r.emi>0?fmt(r.emi):'—'}</td>
                  <td className="px-2 py-2 text-gray-500 dark:text-gray-400">{r.stdEmi>0?fmt(r.stdEmi):'—'}</td>
                  <td className="px-2 py-2 text-purple-600 dark:text-purple-400">{r.customEmiAmt?fmt(r.customEmiAmt):'—'}</td>
                  <td className="px-2 py-2 text-amber-600 dark:text-amber-400">{r.lumpAmt?fmt(r.lumpAmt):'—'}</td>
                  <td className="px-2 py-2 text-green-600 dark:text-green-400">{r.prinPay>0?fmt(r.prinPay):'—'}</td>
                  <td className="px-2 py-2 text-amber-600 dark:text-amber-400">{r.intPay>0?fmt(r.intPay):'—'}</td>
                  <td className="px-2 py-2 text-emerald-600 dark:text-emerald-400 font-semibold">{r.interestSaved>0?fmt(r.interestSaved):'—'}</td>
                  <td className="px-2 py-2 text-gray-900 dark:text-gray-100 font-medium">{fmt(r.remaining)}</td>
                </tr>)})}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(100px)}to{opacity:1;transform:translateX(0)}}.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </div>
  );
}