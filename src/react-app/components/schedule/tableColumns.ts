export type TableColumnId =
  | "m"
  | "date"
  | "rate"
  | "status"
  | "disbAmt"
  | "directPayAmt"
  | "emi"
  | "stdEmi"
  | "customEmiAmt"
  | "lumpAmt"
  | "prinPay"
  | "intPay"
  | "interestSaved"
  | "odBal"
  | "remaining";

export interface TableColumnDef {
  id: TableColumnId;
  label: string;
  shortLabel?: string;
  category: "standard" | "custom";
  description: string;
}

export const ALL_TABLE_COLUMNS: TableColumnDef[] = [
  // Custom Strategy Columns
  {
    id: "disbAmt",
    label: "Disbursement",
    shortLabel: "Disb",
    category: "custom",
    description: "Tranche disbursement amounts",
  },
  {
    id: "directPayAmt",
    label: "Direct Pay",
    shortLabel: "Direct Pay",
    category: "custom",
    description: "Third-party direct payments",
  },
  {
    id: "stdEmi",
    label: "Std EMI",
    shortLabel: "Std EMI",
    category: "custom",
    description: "Standard amortized EMI before custom overrides",
  },
  {
    id: "customEmiAmt",
    label: "Custom EMI",
    shortLabel: "Custom EMI",
    category: "custom",
    description: "Configured custom EMI overrides or interest-only payments",
  },
  {
    id: "lumpAmt",
    label: "Lump Sum",
    shortLabel: "Lump Sum",
    category: "custom",
    description: "Ad-hoc extra principal prepayments",
  },
  {
    id: "interestSaved",
    label: "Interest Saved",
    shortLabel: "Saved",
    category: "custom",
    description: "Cumulative interest saved from financial adjustments",
  },
  {
    id: "odBal",
    label: "OD Balance",
    shortLabel: "OD Bal",
    category: "custom",
    description: "Overdraft / offset savings balance reducing daily interest",
  },

  // Standard Loan Columns
  {
    id: "m",
    label: "Month (Mo)",
    shortLabel: "Mo",
    category: "standard",
    description: "Loan month tenure index and granular day drill-down",
  },
  {
    id: "date",
    label: "Date",
    shortLabel: "Date",
    category: "standard",
    description: "Payment calendar month & year",
  },
  {
    id: "rate",
    label: "Rate",
    shortLabel: "Rate",
    category: "standard",
    description: "Annual interest rate percentage",
  },
  {
    id: "status",
    label: "Status",
    shortLabel: "Status",
    category: "standard",
    description: "Payment status (Paid, Current, Pending)",
  },
  {
    id: "emi",
    label: "Monthly EMI",
    shortLabel: "EMI",
    category: "standard",
    description: "Total monthly installment paid",
  },
  {
    id: "prinPay",
    label: "Principal Paid",
    shortLabel: "Principal",
    category: "standard",
    description: "Portion of payment reducing the loan principal",
  },
  {
    id: "intPay",
    label: "Interest Paid",
    shortLabel: "Interest",
    category: "standard",
    description: "Interest charged for the month",
  },
  {
    id: "remaining",
    label: "Closing Balance",
    shortLabel: "Balance",
    category: "standard",
    description: "Remaining principal balance after monthly payments",
  },
];

// Presets
export const DEFAULT_VISIBLE_COLUMNS: TableColumnId[] = [
  "m",
  "date",
  "rate",
  "status",
  "disbAmt",
  "directPayAmt",
  "emi",
  "stdEmi",
  "customEmiAmt",
  "lumpAmt",
  "prinPay",
  "intPay",
  "interestSaved",
  "odBal",
  "remaining",
];

// "Only Custom Columns" preset: includes month identifier for row context, plus all custom strategy columns
export const CUSTOM_ONLY_COLUMNS: TableColumnId[] = [
  "m",
  "disbAmt",
  "directPayAmt",
  "stdEmi",
  "customEmiAmt",
  "lumpAmt",
  "interestSaved",
  "odBal",
];

export const STANDARD_ONLY_COLUMNS: TableColumnId[] = [
  "m",
  "date",
  "rate",
  "status",
  "emi",
  "prinPay",
  "intPay",
  "remaining",
];
