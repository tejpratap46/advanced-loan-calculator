import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, Calendar, TrendingUp, DollarSign, RotateCcw, Sun, Moon, Share2, Copy, Check, Download } from 'lucide-react';

const STORAGE_KEY = 'loan-calc-data';
const THEME_KEY = 'loan-calc-theme';

interface Dispersal {
  month: number;
  pct: number;
}

interface CustomEmi {
  fromMonth: number;
  amount: number;
}

interface LumpSum {
  month: number;
  amount: number;
}

interface LoanData {
  principal: number;
  rate: number;
  years: number;
  startDate: string;
  dispersals: Dispersal[];
  customEmis: CustomEmi[];
  lumpSums: LumpSum[];
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
}

interface Toast {
  msg: string;
  type: 'save' | 'reset' | 'success' | 'error';
}

interface SmallInpProps {
  val: number | string;
  onChange: (val: string) => void;
  [key: string]: any;
}

const DEFAULTS: LoanData = { 
  principal: 100000, 
  rate: 7.5, 
  years: 20, 
  startDate: new Date().toISOString().split('T')[0], 
  dispersals: [], 
  customEmis: [], 
  lumpSums: [] 
};

// Detect user's locale and currency
const getUserLocale = (): string => {
  return navigator.language || 'en-US';
};

const getUserCurrency = (): string => {
  const locale = getUserLocale();
  const currencyMap: { [key: string]: string } = {
    'en-US': 'USD',
    'en-GB': 'GBP',
    'en-IN': 'INR',
    'en-AU': 'AUD',
    'en-CA': 'CAD',
    'de-DE': 'EUR',
    'fr-FR': 'EUR',
    'es-ES': 'EUR',
    'it-IT': 'EUR',
    'ja-JP': 'JPY',
    'zh-CN': 'CNY',
    'ko-KR': 'KRW',
    'pt-BR': 'BRL',
    'ru-RU': 'RUB',
    'ar-SA': 'SAR',
  };
  
  // Check exact match first
  if (currencyMap[locale]) return currencyMap[locale];
  
  // Check language prefix
  const lang = locale.split('-')[0];
  const prefixMatch = Object.keys(currencyMap).find(k => k.startsWith(lang + '-'));
  if (prefixMatch) return currencyMap[prefixMatch];
  
  // Default to USD
  return 'USD';
};

const getCurrencySymbol = (currency: string): string => {
  const symbols: { [key: string]: string } = {
    'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'INR': '₹',
    'AUD': 'A$', 'CAD': 'C$', 'CNY': '¥', 'KRW': '₩', 'BRL': 'R$',
    'RUB': '₽', 'SAR': 'SR',
  };
  return symbols[currency] || currency;
};

const SmallInp: React.FC<SmallInpProps> = ({ val, onChange, ...rest }) => (
  <input 
    type="number" 
    className="w-full px-3 py-2.5 bg-white/50 dark:bg-white/10 border border-gray-300 dark:border-white/20 rounded-lg text-gray-900 dark:text-gray-100 text-sm transition-all focus:bg-white dark:focus:bg-white/15 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500" 
    value={val} 
    onChange={e => onChange(e.target.value)} 
    {...rest} 
  />
);

export default function LoanCalculator() {
  const [currency] = useState(getUserCurrency());
  const [locale] = useState(getUserLocale());
  const [isDark, setIsDark] = useState(false);
  const [data, setData] = useState<LoanData>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved'>('saved');
  const [toast, setToast] = useState<Toast | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const [newDisp, setNewDisp] = useState({ month: 1, pct: 100 });
  const [showDisp, setShowDisp] = useState(false);
  const [newEmi, setNewEmi] = useState({ fromMonth: 1, amount: '' });
  const [showEmi, setShowEmi] = useState(false);
  const [newLump, setNewLump] = useState({ month: 1, amount: '' });
  const [showLump, setShowLump] = useState(false);

  const fmt = (v: number): string => new Intl.NumberFormat(locale, { 
    style: 'currency', 
    currency: currency,
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(v);

  const showToast = (msg: string, type: 'save' | 'reset' | 'success' | 'error' = 'save') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // Encode data to base64 for URL sharing
  const encodeData = (data: LoanData): string => {
    try {
      const json = JSON.stringify(data);
      return btoa(encodeURIComponent(json));
    } catch (e) {
      console.error('Error encoding data:', e);
      return '';
    }
  };

  // Decode data from base64 URL
  const decodeData = (hash: string): LoanData | null => {
    try {
      const decoded = decodeURIComponent(atob(hash));
      const parsed = JSON.parse(decoded);
      return { ...DEFAULTS, ...parsed };
    } catch (e) {
      console.error('Error decoding data:', e);
      return null;
    }
  };

  // Generate shareable URL
  const getShareUrl = (): string => {
    const encoded = encodeData(data);
    return `${window.location.origin}${window.location.pathname}#${encoded}`;
  };

  // Copy URL to clipboard
  const copyToClipboard = async () => {
    try {
      const url = getShareUrl();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast('Link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      showToast('Failed to copy link', 'error');
    }
  };

  // Handle share - use native share if available, otherwise show modal
  const handleShare = async () => {
    const url = getShareUrl();
    
    // Check if Web Share API is available (mobile devices)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Loan Amortization Calculator',
          text: 'Check out my loan calculation',
          url: url,
        });
        showToast('Shared successfully!', 'success');
      } catch (err: any) {
        // User cancelled share or error occurred
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
          setShowShareModal(true); // Fallback to modal
        }
      }
    } else {
      // Fallback to modal for desktop
      setShowShareModal(true);
    }
  };

  // Download as CSV
  const downloadCSV = () => {
    try {
      // CSV Header
      const headers = [
        'Month',
        'Date',
        'Status',
        'Disbursement',
        'Disbursement %',
        'EMI Paid',
        'Standard EMI',
        'Custom EMI',
        'Lump Sum',
        'Principal',
        'Interest',
        'Balance'
      ];

      // CSV Rows
      const rows = schedule.map(r => {
        const isCurrent = r.m === currentMonth;
        const isPaid = r.m < currentMonth;
        const status = r.emi === 0 ? '-' : isPaid ? 'Paid' : isCurrent ? 'Current' : 'Pending';

        return [
          r.m,
          r.date,
          status,
          r.disbAmt > 0 ? r.disbAmt.toFixed(2) : '',
          r.disbPct > 0 ? r.disbPct : '',
          r.emi > 0 ? r.emi.toFixed(2) : '',
          r.stdEmi > 0 ? r.stdEmi.toFixed(2) : '',
          r.customEmiAmt ? r.customEmiAmt.toFixed(2) : '',
          r.lumpAmt ? r.lumpAmt.toFixed(2) : '',
          r.prinPay > 0 ? r.prinPay.toFixed(2) : '',
          r.intPay > 0 ? r.intPay.toFixed(2) : '',
          r.remaining.toFixed(2)
        ];
      });

      // Summary row
      const summaryRow = [
        'TOTALS',
        '',
        '',
        totals.disbursed.toFixed(2),
        '',
        totals.emi.toFixed(2),
        '',
        '',
        '',
        totals.prin.toFixed(2),
        totals.int.toFixed(2),
        ''
      ];

      // Build CSV content
      const csvContent = [
        // Metadata
        ['Loan Amortization Schedule'],
        ['Generated on', new Date().toLocaleDateString(locale)],
        ['Currency', currency],
        ['Principal', data.principal],
        ['Interest Rate (%)', data.rate],
        ['Tenure (Years)', data.years],
        ['Start Date', data.startDate],
        [],
        headers,
        ...rows,
        summaryRow
      ].map(row => row.map(cell => {
        // Escape cells containing commas or quotes
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')).join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `loan-amortization-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast('CSV downloaded successfully!', 'success');
    } catch (e) {
      console.error('Download failed:', e);
      showToast('Failed to download CSV', 'error');
    }
  };

  // Load theme and data on mount
  useEffect(() => {
    try {
      // Check URL hash first
      const hash = window.location.hash.slice(1);
      let loadedFromUrl = false;
      
      if (hash) {
        const urlData = decodeData(hash);
        if (urlData) {
          setData(urlData);
          loadedFromUrl = true;
          showToast('Loaded data from shared link', 'success');
        }
      }
      
      // Load from localStorage if not loaded from URL
      if (!loadedFromUrl) {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) setData({ ...DEFAULTS, ...JSON.parse(savedData) });
      }
      
      // Load theme
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === 'dark') {
        setIsDark(true);
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.error('Error loading data:', e);
    }
    setLoaded(true);
  }, []);

  // Listen for URL hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash) {
        const urlData = decodeData(hash);
        if (urlData) {
          setData(urlData);
          showToast('Loaded data from shared link', 'success');
        }
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Auto-save data
  useEffect(() => {
    if (!loaded) return;
    setSaveStatus('saving');
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setSaveStatus('saved');
      } catch (e) {
        console.error('Error saving data:', e);
        setSaveStatus('saved');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [data, loaded]);

  // Save and apply theme
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.error('Error saving theme:', e);
    }
  }, [isDark, loaded]);

  const toggleTheme = () => setIsDark(prev => !prev);

  // Calculate current month relative to start date
  const getCurrentMonth = (): number => {
    const start = new Date(data.startDate);
    const now = new Date();
    const diffMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
    return Math.max(1, diffMonths);
  };

  const schedule = useMemo<ScheduleRow[]>(() => {
    const { principal, rate, years, startDate, dispersals, customEmis, lumpSums } = data;
    const mRate = rate / 100 / 12;
    const totalMonths = years * 12;
    const rows: ScheduleRow[] = [];
    const sortedDisp = [...dispersals].sort((a, b) => a.month - b.month);
    let dispIdx = 0, remaining = 0, cumDisbursed = 0;

    const getCE = (m: number): number | null => { 
      const a = customEmis.filter(e => e.fromMonth <= m).sort((a, b) => b.fromMonth - a.fromMonth)[0]; 
      return a ? a.amount : null; 
    };
    const getLS = (m: number): number | null => lumpSums.find(l => l.month === m)?.amount ?? null;

    for (let m = 1; m <= totalMonths; m++) {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + m - 1);
      let disbAmt = 0, disbPct = 0;
      if (dispIdx < sortedDisp.length && sortedDisp[dispIdx].month === m) {
        disbPct = sortedDisp[dispIdx].pct;
        disbAmt = (principal * disbPct) / 100;
        remaining += disbAmt; cumDisbursed += disbAmt; dispIdx++;
      }
      if (remaining <= 0) { 
        rows.push({ m, date: d.toLocaleDateString(locale, { year: 'numeric', month: 'short' }), disbAmt, disbPct, emi: 0, prinPay: 0, intPay: 0, remaining: 0, cumDisbursed, payType: 'none', stdEmi: 0, customEmiAmt: null, lumpAmt: null }); 
        continue; 
      }

      const remMonths = totalMonths - m + 1;
      const stdEmi = mRate === 0 ? remaining / remMonths : remaining * mRate * Math.pow(1 + mRate, remMonths) / (Math.pow(1 + mRate, remMonths) - 1);
      const customEmiAmt = getCE(m), lumpAmt = getLS(m);
      const actualEmi = Math.max(stdEmi, customEmiAmt ?? 0, lumpAmt ?? 0);
      let payType: ScheduleRow['payType'] = 'std';
      if (lumpAmt !== null && actualEmi === lumpAmt && lumpAmt > stdEmi) payType = 'lump';
      else if (customEmiAmt !== null && actualEmi > stdEmi) payType = 'custom';

      const intPay = remaining * mRate;
      let prinPay = actualEmi - intPay;
      if (prinPay > remaining) prinPay = remaining;
      const emi = intPay + prinPay;
      remaining = Math.max(0, remaining - prinPay);
      rows.push({ m, date: d.toLocaleDateString(locale, { year: 'numeric', month: 'short' }), disbAmt, disbPct, emi, prinPay, intPay, remaining, cumDisbursed, payType, stdEmi, customEmiAmt, lumpAmt });

      if (remaining <= 0.01) {
        for (let rest = m + 1; rest <= totalMonths; rest++) {
          const rd = new Date(startDate); rd.setMonth(rd.getMonth() + rest - 1);
          rows.push({ m: rest, date: rd.toLocaleDateString(locale, { year: 'numeric', month: 'short' }), disbAmt: 0, disbPct: 0, emi: 0, prinPay: 0, intPay: 0, remaining: 0, cumDisbursed, payType: 'none', stdEmi: 0, customEmiAmt: null, lumpAmt: null });
        }
        break;
      }
    }
    return rows;
  }, [data, locale]);

  const totals = useMemo(() => schedule.reduce((a, r) => ({ 
    disbursed: Math.max(a.disbursed, r.cumDisbursed), 
    emi: a.emi + r.emi, 
    prin: a.prin + r.prinPay, 
    int: a.int + r.intPay 
  }), { disbursed: 0, emi: 0, prin: 0, int: 0 }), [schedule]);
  
  const paidOffMonth = schedule.find(r => r.remaining <= 0.01 && r.emi > 0)?.m;
  const currentMonth = getCurrentMonth();
  
  // Calculate paid and pending amounts
  const paidTillNow = useMemo(() => {
    const tillMonth = Math.min(currentMonth, schedule.length);
    return schedule.slice(0, tillMonth).reduce((sum, r) => sum + r.emi, 0);
  }, [schedule, currentMonth]);
  
  const pendingAmount = useMemo(() => {
    const fromMonth = currentMonth;
    if (fromMonth >= schedule.length) return 0;
    return schedule.slice(fromMonth).reduce((sum, r) => sum + r.emi, 0);
  }, [schedule, currentMonth]);

  const addDispersal = () => {
    if (newDisp.month < 1 || newDisp.month > data.years * 12 || newDisp.pct <= 0 || newDisp.pct > 100) return;
    setData(d => ({ ...d, dispersals: [...d.dispersals.filter(x => x.month !== newDisp.month), { ...newDisp }] }));
    setNewDisp({ month: 1, pct: 100 }); setShowDisp(false);
  };

  const addCustomEmi = () => {
    const amt = parseFloat(newEmi.amount);
    if (!amt || amt <= 0 || newEmi.fromMonth < 1) return;
    setData(d => ({ ...d, customEmis: [...d.customEmis.filter(e => e.fromMonth !== newEmi.fromMonth), { fromMonth: newEmi.fromMonth, amount: amt }].sort((a, b) => a.fromMonth - b.fromMonth) }));
    setNewEmi({ fromMonth: 1, amount: '' }); setShowEmi(false);
  };

  const addLumpSum = () => {
    const amt = parseFloat(newLump.amount);
    if (!amt || amt <= 0 || newLump.month < 1 || newLump.month > data.years * 12) return;
    setData(d => ({ ...d, lumpSums: [...d.lumpSums.filter(l => l.month !== newLump.month), { month: newLump.month, amount: amt }].sort((a, b) => a.month - b.month) }));
    setNewLump({ month: 1, amount: '' }); setShowLump(false);
  };

  const handleReset = () => {
    setData(DEFAULTS);
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.location.hash = '';
    } catch (e) {
      console.error('Error clearing data:', e);
    }
    showToast('All data cleared', 'reset');
  };

  if (!loaded) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
      <div className="text-blue-500 dark:text-blue-400 text-lg font-medium">Loading saved data…</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 px-6 py-12 transition-colors duration-300">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 px-6 py-3.5 rounded-xl font-semibold z-50 flex items-center gap-2.5 shadow-2xl animate-[slideIn_0.3s_ease-out] ${
          toast.type === 'success' ? 'bg-gradient-to-r from-green-600 to-green-700 text-white' :
          toast.type === 'error' ? 'bg-gradient-to-r from-red-600 to-red-700 text-white' :
          toast.type === 'save' ? 'bg-gradient-to-r from-blue-700 to-blue-800 text-blue-100' : 
          'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-100'
        }`}>
          {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : toast.type === 'save' ? '☁' : '↺'} {toast.msg}
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Share Your Calculation</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Copy this link to share your loan calculation with others. The link contains all your data.
            </p>
            <div className="bg-gray-100 dark:bg-slate-700 rounded-lg p-3 mb-4 break-all text-sm text-gray-700 dark:text-gray-300 font-mono">
              {getShareUrl()}
            </div>
            <div className="flex gap-3">
              <button 
                onClick={copyToClipboard}
                className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
              >
                {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
              </button>
              <button 
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-10 animate-[fadeUp_0.5s_ease-out]">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Calculator className="w-10 h-10 text-blue-500 dark:text-blue-400" />
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-400 dark:to-blue-500 bg-clip-text text-transparent">
            Loan Amortization Calculator
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-lg font-light">
          Flexible disbursements · Custom EMI · Lump sum payments · Early payoff tracking
        </p>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Main Card */}
        <div className="bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200 dark:border-slate-700 rounded-3xl shadow-xl dark:shadow-2xl p-8 mb-8 animate-[fadeUp_0.5s_ease-out] transition-colors duration-300">
          {/* Header with save indicator and theme toggle */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2.5">
              <DollarSign className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              Loan Parameters
            </h2>
            <div className="flex items-center gap-4">
              <button 
                onClick={downloadCSV}
                className="p-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white transition-all duration-200 shadow-sm"
                aria-label="Download CSV"
                title="Download as CSV"
              >
                <Download className="w-5 h-5" />
              </button>
              <button 
                onClick={handleShare}
                className="p-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200 shadow-sm"
                aria-label="Share calculation"
                title="Share calculation"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button 
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 transition-all duration-200 shadow-sm"
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-yellow-400" />
                ) : (
                  <Moon className="w-5 h-5 text-slate-600" />
                )}
              </button>
              <div className={`flex items-center gap-2 text-xs transition-colors ${
                saveStatus === 'saving' ? 'text-blue-500 dark:text-blue-400' : 'text-green-600 dark:text-green-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  saveStatus === 'saving' ? 'bg-blue-500 dark:bg-blue-400 animate-pulse' : 'bg-green-600 dark:bg-green-400'
                }`} />
                {saveStatus === 'saving' ? 'Saving…' : 'All changes saved'}
              </div>
            </div>
          </div>

          {/* Currency Display */}
          <div className="mb-6 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>Currency: <strong className="text-gray-800 dark:text-gray-200">{currency} ({getCurrencySymbol(currency)})</strong></span>
            <span className="text-gray-400 dark:text-gray-600">•</span>
            <span>Locale: <strong className="text-gray-800 dark:text-gray-200">{locale}</strong></span>
          </div>

          {/* Input Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { label: `Principal Amount (${getCurrencySymbol(currency)})`, key: 'principal' as const, min: 1000, step: 1000 },
              { label: 'Interest Rate (% p.a.)', key: 'rate' as const, min: 0, max: 50, step: 0.1 },
              { label: 'Tenure (Years)', key: 'years' as const, min: 1, max: 30 },
            ].map(({ label, key, ...rest }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-gray-900 dark:text-gray-100 transition-all focus:bg-white dark:focus:bg-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 outline-none"
                  value={data[key]} 
                  onChange={e => setData(d => ({ ...d, [key]: Number(e.target.value) }))} 
                  {...rest} 
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date</label>
              <input 
                type="date" 
                className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-gray-900 dark:text-gray-100 transition-all focus:bg-white dark:focus:bg-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 outline-none"
                value={data.startDate} 
                onChange={e => setData(d => ({ ...d, startDate: e.target.value }))} 
              />
            </div>
          </div>

          {/* 3-column panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Disbursements */}
            <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 rounded-2xl border border-blue-200 dark:border-blue-700/50 transition-colors duration-300">
              <p className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                Disbursements
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {[...data.dispersals].sort((a, b) => a.month - b.month).map(d => (
                  <span key={d.month} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700/50 rounded-full text-xs font-medium">
                    Month {d.month}: {d.pct}%
                    <button onClick={() => setData(s => ({ ...s, dispersals: s.dispersals.filter(x => x.month !== d.month) }))} className="hover:text-red-600 dark:hover:text-red-400 transition-colors">×</button>
                  </span>
                ))}
              </div>
              {!showDisp ? (
                <button onClick={() => setShowDisp(true)} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all">
                  + Add
                </button>
              ) : (
                <div className="flex flex-wrap gap-2.5 items-end" onKeyDown={e => { if (e.key === 'Enter') addDispersal(); if (e.key === 'Escape') setShowDisp(false); }}>
                  <div className="flex-1 min-w-[90px]">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Month</label>
                    <SmallInp val={newDisp.month} onChange={v => setNewDisp({ ...newDisp, month: +v })} min={1} max={data.years * 12} />
                  </div>
                  <div className="flex-1 min-w-[90px]">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">% of loan</label>
                    <SmallInp val={newDisp.pct} onChange={v => setNewDisp({ ...newDisp, pct: +v })} min={0.01} max={100} step={0.01} />
                  </div>
                  <button onClick={addDispersal} className="px-3 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors">Add</button>
                  <button onClick={() => setShowDisp(false)} className="px-3 py-2 bg-red-500/20 dark:bg-red-500/30 text-red-600 dark:text-red-400 border border-red-500/30 dark:border-red-500/50 rounded-lg text-sm hover:bg-red-500/30 dark:hover:bg-red-500/40 transition-colors">✕</button>
                </div>
              )}
            </div>

            {/* Custom EMI */}
            <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 rounded-2xl border border-purple-200 dark:border-purple-700/50 transition-colors duration-300">
              <p className="text-base font-semibold text-gray-800 dark:text-purple-200 flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                Custom EMI
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Fixed monthly payment from a given month. Actual = max(std, custom).</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {data.customEmis.map(e => (
                  <span key={e.fromMonth} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700/50 rounded-full text-xs font-medium">
                    From M{e.fromMonth}: {fmt(e.amount)}
                    <button onClick={() => setData(s => ({ ...s, customEmis: s.customEmis.filter(x => x.fromMonth !== e.fromMonth) }))} className="hover:text-red-600 dark:hover:text-red-400 transition-colors">×</button>
                  </span>
                ))}
              </div>
              {!showEmi ? (
                <button onClick={() => setShowEmi(true)} className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all">
                  + Add
                </button>
              ) : (
                <div className="flex flex-wrap gap-2.5 items-end" onKeyDown={e => { if (e.key === 'Enter') addCustomEmi(); if (e.key === 'Escape') setShowEmi(false); }}>
                  <div className="flex-1 min-w-[90px]">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">From Month</label>
                    <SmallInp val={newEmi.fromMonth} onChange={v => setNewEmi({ ...newEmi, fromMonth: +v })} min={1} max={data.years * 12} />
                  </div>
                  <div className="flex-1 min-w-[110px]">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                    <SmallInp val={newEmi.amount} onChange={v => setNewEmi({ ...newEmi, amount: v })} min={1} step={100} placeholder="e.g. 1500" />
                  </div>
                  <button onClick={addCustomEmi} className="px-3 py-2 bg-purple-500 dark:bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-600 dark:hover:bg-purple-700 transition-colors">Add</button>
                  <button onClick={() => setShowEmi(false)} className="px-3 py-2 bg-red-500/20 dark:bg-red-500/30 text-red-600 dark:text-red-400 border border-red-500/30 dark:border-red-500/50 rounded-lg text-sm hover:bg-red-500/30 dark:hover:bg-red-500/40 transition-colors">✕</button>
                </div>
              )}
            </div>

            {/* Lump Sum */}
            <div className="p-6 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 rounded-2xl border border-amber-200 dark:border-amber-700/50 transition-colors duration-300">
              <p className="text-base font-semibold text-gray-800 dark:text-amber-200 flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                Lump Sum Payment
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">One-time large payment. Actual = max(std, custom, lump).</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {data.lumpSums.map(l => (
                  <span key={l.month} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 rounded-full text-xs font-medium">
                    Month {l.month}: {fmt(l.amount)}
                    <button onClick={() => setData(s => ({ ...s, lumpSums: s.lumpSums.filter(x => x.month !== l.month) }))} className="hover:text-red-600 dark:hover:text-red-400 transition-colors">×</button>
                  </span>
                ))}
              </div>
              {!showLump ? (
                <button onClick={() => setShowLump(true)} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all">
                  + Add
                </button>
              ) : (
                <div className="flex flex-wrap gap-2.5 items-end" onKeyDown={e => { if (e.key === 'Enter') addLumpSum(); if (e.key === 'Escape') setShowLump(false); }}>
                  <div className="flex-1 min-w-[90px]">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Month</label>
                    <SmallInp val={newLump.month} onChange={v => setNewLump({ ...newLump, month: +v })} min={1} max={data.years * 12} />
                  </div>
                  <div className="flex-1 min-w-[110px]">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                    <SmallInp val={newLump.amount} onChange={v => setNewLump({ ...newLump, amount: v })} min={1} step={1000} placeholder="e.g. 20000" />
                  </div>
                  <button onClick={addLumpSum} className="px-3 py-2 bg-amber-500 dark:bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 dark:hover:bg-amber-700 transition-colors">Add</button>
                  <button onClick={() => setShowLump(false)} className="px-3 py-2 bg-red-500/20 dark:bg-red-500/30 text-red-600 dark:text-red-400 border border-red-500/30 dark:border-red-500/50 rounded-lg text-sm hover:bg-red-500/30 dark:hover:bg-red-500/40 transition-colors">✕</button>
                </div>
              )}
            </div>
          </div>

          {/* Reset button */}
          <div className="flex justify-end">
            <button onClick={handleReset} className="px-6 py-2.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition-all flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Reset All
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8 animate-[fadeUp_0.5s_ease-out]">
          {[
            { label: 'Total Disbursed', val: totals.disbursed, colorLight: 'blue-600', colorDark: 'blue-400' },
            { label: 'Total Interest', val: totals.int, colorLight: 'amber-600', colorDark: 'amber-400' },
            { label: 'Total Principal Paid', val: totals.prin, colorLight: 'green-600', colorDark: 'green-400' },
            { label: 'Paid Till Now', val: paidTillNow, colorLight: 'cyan-600', colorDark: 'cyan-400' },
            { label: 'Still Pending', val: pendingAmount, colorLight: 'rose-600', colorDark: 'rose-400' },
          ].map(({ label, val, colorLight, colorDark }) => (
            <div key={label} className="relative overflow-hidden bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200 dark:border-slate-700 rounded-2xl shadow-lg dark:shadow-xl p-6 transition-colors duration-300">
              <div className={`absolute top-0 left-0 right-0 h-1 bg-${colorLight} dark:bg-${colorDark}`} />
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{label}</div>
              <div className={`text-3xl font-bold text-${colorLight} dark:text-${colorDark} font-mono`}>{fmt(val)}</div>
            </div>
          ))}
        </div>

        {/* Early payoff banner */}
        {paidOffMonth && paidOffMonth < data.years * 12 && (
          <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700/50 rounded-2xl p-5 mb-8 text-green-800 dark:text-green-300 font-semibold flex items-center gap-3 transition-colors duration-300">
            🎉 Loan fully paid off by <strong>Month {paidOffMonth}</strong> — that's <strong>{data.years * 12 - paidOffMonth} months early</strong>!
          </div>
        )}

        {/* Table */}
        <div className="bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200 dark:border-slate-700 rounded-3xl shadow-xl dark:shadow-2xl p-8 animate-[fadeUp_0.5s_ease-out] transition-colors duration-300">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            Amortization Schedule
          </h2>
          <div className="flex flex-wrap gap-3 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700/50 rounded-full text-xs font-medium">
              🟢 Disbursement
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700/50 rounded-full text-xs font-medium">
              🟣 Custom EMI active
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 rounded-full text-xs font-medium">
              🟡 Lump sum payment
            </span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-700 max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 dark:bg-blue-900/30 sticky top-0 z-10">
                <tr>
                  {['Month', 'Date', 'Status', 'Disbursement', 'EMI Paid', 'Std. EMI', 'Custom EMI', 'Lump Sum', 'Principal', 'Interest', 'Balance'].map(h => (
                    <th key={h} className="px-3 py-4 text-left font-semibold text-xs text-blue-700 dark:text-blue-300 uppercase tracking-wide border-b-2 border-blue-200 dark:border-blue-700/50 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map(r => {
                  const isCurrent = r.m === currentMonth;
                  const isPaid = r.m < currentMonth;
                  const isPending = r.m > currentMonth;
                  
                  return (
                  <tr key={r.m} className={`border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${
                    isCurrent ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-400 dark:ring-blue-500' :
                    r.disbAmt > 0 ? 'bg-green-50/50 dark:bg-green-900/10' :
                    r.payType === 'lump' ? 'bg-amber-50/50 dark:bg-amber-900/10' :
                    r.payType === 'custom' ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''
                  }`}>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200 font-mono whitespace-nowrap">
                      {r.m}
                      {isCurrent && <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white rounded text-[10px] font-bold uppercase">NOW</span>}
                      {r.payType === 'lump' && <span className="ml-2 px-2 py-0.5 bg-amber-200 dark:bg-amber-700/50 text-amber-800 dark:text-amber-300 rounded text-[10px] font-bold uppercase">LUMP</span>}
                      {r.payType === 'custom' && <span className="ml-2 px-2 py-0.5 bg-purple-200 dark:bg-purple-700/50 text-purple-800 dark:text-purple-300 rounded text-[10px] font-bold uppercase">CEMI</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300 font-mono whitespace-nowrap">{r.date}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {isPaid && r.emi > 0 && (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700/50 rounded-md text-xs font-semibold">
                          ✓ Paid
                        </span>
                      )}
                      {isCurrent && r.emi > 0 && (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700/50 rounded-md text-xs font-semibold">
                          ◉ Current
                        </span>
                      )}
                      {isPending && r.emi > 0 && (
                        <span className="px-2 py-1 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700/50 rounded-md text-xs font-semibold">
                          ⧗ Pending
                        </span>
                      )}
                      {r.emi === 0 && <span className="text-gray-400 dark:text-gray-600 text-xs">—</span>}
                    </td>
                    <td className={`px-3 py-3 font-mono whitespace-nowrap ${r.disbAmt > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}>
                      {r.disbAmt > 0 ? `${fmt(r.disbAmt)} (${r.disbPct}%)` : '—'}
                    </td>
                    <td className={`px-3 py-3 font-mono whitespace-nowrap ${
                      r.payType === 'lump' ? 'text-amber-600 dark:text-amber-400 font-semibold' :
                      r.payType === 'custom' ? 'text-purple-600 dark:text-purple-400 font-semibold' :
                      'text-gray-700 dark:text-gray-300'
                    }`}>
                      {r.emi > 0 ? fmt(r.emi) : '—'}
                    </td>
                    <td className="px-3 py-3 text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">{r.stdEmi > 0 ? fmt(r.stdEmi) : '—'}</td>
                    <td className={`px-3 py-3 font-mono whitespace-nowrap ${r.customEmiAmt ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-600'}`}>
                      {r.customEmiAmt ? fmt(r.customEmiAmt) : '—'}
                    </td>
                    <td className={`px-3 py-3 font-mono whitespace-nowrap ${r.lumpAmt ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-600'}`}>
                      {r.lumpAmt ? fmt(r.lumpAmt) : '—'}
                    </td>
                    <td className="px-3 py-3 text-green-600 dark:text-green-400 font-mono whitespace-nowrap">{r.prinPay > 0 ? fmt(r.prinPay) : '—'}</td>
                    <td className="px-3 py-3 text-amber-600 dark:text-amber-400 font-mono whitespace-nowrap">{r.intPay > 0 ? fmt(r.intPay) : '—'}</td>
                    <td className={`px-3 py-3 font-mono whitespace-nowrap ${r.remaining < 1 ? 'text-green-600 dark:text-green-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                      {fmt(r.remaining)}
                    </td>
                  </tr>
                )})}
              </tbody>
              <tfoot className="bg-blue-50 dark:bg-blue-900/30 font-semibold border-t-2 border-blue-200 dark:border-blue-700/50">
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-blue-700 dark:text-blue-300 uppercase text-xs tracking-wide">TOTALS</td>
                  <td className="px-3 py-4 text-gray-800 dark:text-gray-200 font-mono">{fmt(totals.emi)}</td>
                  <td colSpan={3}></td>
                  <td className="px-3 py-4 text-green-600 dark:text-green-400 font-mono">{fmt(totals.prin)}</td>
                  <td className="px-3 py-4 text-amber-600 dark:text-amber-400 font-mono">{fmt(totals.int)}</td>
                  <td className="px-3 py-4 text-gray-500 dark:text-gray-400">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}