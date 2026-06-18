export interface Dispersal {
  month: number;
  amount: number;
}

export interface CustomEmi {
  fromMonth: number;
  amount: number;
}

export interface LumpSum {
  month: number;
  amount: number;
}

export interface LoanData {
  principal: number;
  rate: number;
  years: number;
  startDate: string;
  dispersals: Dispersal[];
  customEmis: CustomEmi[];
  lumpSums: LumpSum[];
}

export interface Loan {
  id: string;
  name: string;
  data: LoanData;
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
}

export interface Toast {
  msg: string;
  type: "save" | "reset" | "success" | "error";
}
