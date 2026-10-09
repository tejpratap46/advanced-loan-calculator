export interface Dispersal {
  id?: string;
  month: number;
  day?: number;
  amount: number;
}

export interface CustomEmi {
  id?: string;
  fromMonth: number;
  day?: number;
  amount: number;
}

export interface LumpSum {
  id?: string;
  month: number;
  day?: number;
  amount: number;
}

export interface MiscExpense {
  id: string;
  date: string;
  amount: number;
  comments: string;
}

export interface LoanData {
  principal: number;
  rate: number;
  years: number;
  startDate: string;
  dispersals: Dispersal[];
  customEmis: CustomEmi[];
  lumpSums: LumpSum[];
  baselineOd?: number;
  customOds?: { fromMonth: number; amount: number }[];
  miscExpenses?: MiscExpense[];
}

export interface Loan {
  id: string;
  name: string;
  data: LoanData;
}

export interface DayDetail {
  day: number;
  date: string;
  fullDate: string;
  disbAmt: number;
  emiAmt: number;
  lumpAmt: number;
  prinPay: number;
  intPay: number;
  interestSaved: number;
  odBal: number;
  netPrincipal: number;
  balance: number;
  events?: string[];
}

export interface ScheduleRow {
  m: number;
  date: string;
  disbAmt: number;
  emi: number;
  prinPay: number;
  intPay: number;
  remaining: number;
  cumDisbursed: number;
  payType: "none" | "std" | "custom" | "lump";
  stdEmi: number;
  customEmiAmt: number | null;
  lumpAmt: number | null;
  interestSaved: number;
  odBal: number;
  days?: DayDetail[];
}

export interface Toast {
  msg: string;
  type: "save" | "reset" | "success" | "error";
}
