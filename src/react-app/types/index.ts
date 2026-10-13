export interface Dispersal {
  id?: string;
  month: number;
  day?: number;
  amount: number;
}

export type CustomEmiType = "interest_only" | "recalculated" | "custom";

export interface CustomEmi {
  id?: string;
  fromMonth: number;
  day?: number;
  type?: CustomEmiType;
  amount?: number;
}

export interface LumpSum {
  id?: string;
  month: number;
  day?: number;
  amount: number;
}

export interface CustomRate {
  id?: string;
  fromMonth: number;
  day?: number;
  rate: number;
}

export interface DirectPayment {
  id?: string;
  month: number;
  day?: number;
  amount: number;
  recipient?: string;
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
  customRates?: CustomRate[];
  baselineOd?: number;
  customOds?: { fromMonth: number; amount: number }[];
  directPayments?: DirectPayment[];
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
  rate?: number;
  disbAmt: number;
  emiAmt: number;
  lumpAmt: number;
  directPayAmt?: number;
  directPayRecipient?: string;
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
  rate?: number;
  disbAmt: number;
  emi: number;
  directPayAmt?: number;
  cumDirectPay?: number;
  prinPay: number;
  intPay: number;
  remaining: number;
  cumDisbursed: number;
  payType: "none" | "std" | "custom" | "lump";
  stdEmi: number;
  customEmiAmt: number | null;
  customEmiType?: CustomEmiType;
  lumpAmt: number | null;
  interestSaved: number;
  odBal: number;
  days?: DayDetail[];
}

export interface Toast {
  msg: string;
  type: "save" | "reset" | "success" | "error";
}
