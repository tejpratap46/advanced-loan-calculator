import type { ScheduleRow, MiscExpense } from "../types/index.ts";

const escapeCSVCell = (val: unknown): string => {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

export const generateCSV = (
  schedule: ScheduleRow[],
  totals: { d: number; e: number; p: number; i: number; s: number; dp?: number; m?: number },
  currentMonth: number,
  miscExpenses: MiscExpense[] = [],
) => {
  const hasDirectPay = schedule.some((r) => (r.directPayAmt || 0) > 0);
  const headers = [
    "Month",
    "Date",
    "Rate (%)",
    "Status",
    "Disbursement",
    ...(hasDirectPay ? ["Direct Pay"] : []),
    "EMI",
    "Std EMI",
    "Custom EMI",
    "Lump",
    "Principal",
    "Interest",
    "Int Saved",
    "OD Balance",
    "Balance",
  ];

  const rows = schedule.map((r) => {
    const status =
      r.emi === 0
        ? "-"
        : r.m < currentMonth
          ? "Paid"
          : r.m === currentMonth
            ? "Current"
            : "Pending";
    return [
      r.m,
      r.date,
      r.rate !== undefined ? `${r.rate}%` : "",
      status,
      r.disbAmt || "",
      ...(hasDirectPay ? [r.directPayAmt ? Math.round(r.directPayAmt) : ""] : []),
      r.emi ? Math.round(r.emi) : "",
      r.stdEmi ? Math.round(r.stdEmi) : "",
      r.customEmiAmt || "",
      r.lumpAmt || "",
      r.prinPay ? Math.round(r.prinPay) : "",
      r.intPay ? Math.round(r.intPay) : "",
      r.interestSaved ? Math.round(r.interestSaved) : "",
      r.odBal || "",
      Math.round(r.remaining),
    ];
  });

  const totalRow = [
    "TOTALS",
    "",
    "",
    "",
    Math.round(totals.d),
    ...(hasDirectPay ? [totals.dp ? Math.round(totals.dp) : ""] : []),
    Math.round(totals.e),
    "",
    "",
    "",
    Math.round(totals.p),
    Math.round(totals.i),
    Math.round(totals.s),
    "",
    "",
  ];

  let csvRows = [headers, ...rows, totalRow];

  if (miscExpenses.length > 0) {
    const emptyCols = new Array(headers.length).fill("");
    const miscHeaderRow = [...emptyCols];
    const miscTitleRow = ["MISC EXPENSES & CHARGES", ...emptyCols.slice(1)];
    const miscSubHeaders = ["Date", "Amount", "Comments", ...emptyCols.slice(3)];
    const miscDataRows = miscExpenses.map((e) => [
      e.date,
      e.amount,
      e.comments,
      ...emptyCols.slice(3),
    ]);
    const totalMiscAmount = miscExpenses.reduce((sum, item) => sum + item.amount, 0);
    const miscTotalRow = ["TOTAL MISC CHARGES", totalMiscAmount, ...emptyCols.slice(2)];

    csvRows = [
      ...csvRows,
      miscHeaderRow,
      miscTitleRow,
      miscSubHeaders,
      ...miscDataRows,
      miscTotalRow,
    ];
  }

  const csvContent = csvRows
    .map((row) => row.map(escapeCSVCell).join(","))
    .join("\r\n");

  return csvContent;
};

export const generateDailyCSV = (schedule: ScheduleRow[]) => {
  const hasDirectPay = schedule.some((r) => r.days?.some((d) => (d.directPayAmt || 0) > 0));
  const headers = [
    "Month",
    "Day",
    "Date",
    "Rate (%)",
    "Events",
    "Disbursement",
    ...(hasDirectPay ? ["Direct Pay"] : []),
    "EMI Payment",
    "Lump Sum",
    "Principal Paid",
    "Daily Interest",
    "Interest Saved",
    "OD Offset",
    "Net Principal",
    "Balance",
  ];

  const rows: (string | number)[][] = [];
  for (const row of schedule) {
    if (!row.days || row.days.length === 0) continue;
    for (const d of row.days) {
      rows.push([
        row.m,
        d.day,
        d.date,
        d.rate !== undefined ? `${d.rate}%` : "",
        (d.events || []).join("; "),
        d.disbAmt || "",
        ...(hasDirectPay ? [d.directPayAmt ? Math.round(d.directPayAmt) : ""] : []),
        d.emiAmt ? Math.round(d.emiAmt) : "",
        d.lumpAmt || "",
        d.prinPay ? Math.round(d.prinPay) : "",
        d.intPay ? d.intPay.toFixed(2) : "0.00",
        d.interestSaved ? d.interestSaved.toFixed(2) : "0.00",
        d.odBal || "",
        Math.round(d.netPrincipal),
        Math.round(d.balance),
      ]);
    }
  }

  const csvRows = [headers, ...rows];
  return csvRows.map((r) => r.map(escapeCSVCell).join(",")).join("\r\n");
};

export const downloadFile = (content: string, fileName: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
