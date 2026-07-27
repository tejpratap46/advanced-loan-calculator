import { ScheduleRow, MiscExpense } from "../types";

export const generateCSV = (
  schedule: ScheduleRow[],
  totals: { d: number; e: number; p: number; i: number; s: number; m?: number },
  currentMonth: number,
  miscExpenses: MiscExpense[] = [],
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

  let csvRows = [headers, ...rows, totalRow];

  if (miscExpenses.length > 0) {
    const miscHeaderRow = ["", "", "", "", "", "", "", "", "", "", "", "", ""];
    const miscTitleRow = ["MISC EXPENSES & CHARGES", "", "", "", "", "", "", "", "", "", "", "", ""];
    const miscSubHeaders = ["Date", "Amount", "Comments", "", "", "", "", "", "", "", "", "", ""];
    const miscDataRows = miscExpenses.map((e) => [
      e.date,
      e.amount,
      e.comments,
      "", "", "", "", "", "", "", "", "", ""
    ]);
    const totalMiscAmount = miscExpenses.reduce((sum, item) => sum + item.amount, 0);
    const miscTotalRow = ["TOTAL MISC CHARGES", totalMiscAmount, "", "", "", "", "", "", "", "", "", "", ""];

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
