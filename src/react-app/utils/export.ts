import { ScheduleRow } from "../types";

export const generateCSV = (
  schedule: ScheduleRow[],
  totals: { d: number; e: number; p: number; i: number; s: number },
  currentMonth: number,
) => {
  const headers = [
    "Month",
    "Date",
    "Status",
    "Disbursement",
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
      status,
      r.disbAmt || "",
      r.emi || "",
      r.stdEmi || "",
      r.customEmiAmt || "",
      r.lumpAmt || "",
      r.prinPay || "",
      r.intPay || "",
      r.interestSaved || "",
      r.odBal || "",
      r.remaining,
    ];
  });

  const totalRow = [
    "TOTALS",
    "",
    "",
    totals.d,
    totals.e,
    "",
    "",
    "",
    totals.p,
    totals.i,
    totals.s,
    "",
    "",
  ];

  const escapeCSVCell = (val: any): string => {
    if (val === null || val === undefined) return '""';
    let str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };

  const csvContent = [headers, ...rows, totalRow]
    .map((row) => row.map(escapeCSVCell).join(","))
    .join("\r\n");

  return csvContent;
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
