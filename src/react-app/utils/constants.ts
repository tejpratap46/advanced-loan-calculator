import type { LoanData } from "../types/index.ts";

export const STORAGE_KEY = "loan-calc-loans";
export const THEME_KEY = "loan-calc-theme";
export const FIREBASE_CONFIG_KEY = "loan-calc-firebase-config";

const today = new Date().toISOString().split("T")[0];
const todayParts = today.split("-").map(Number);
const todayDay = todayParts[2] || 1;

export const DEFAULT_DATA: LoanData = {
  principal: 100000,
  rate: 7.5,
  years: 20,
  startDate: today,
  dispersals: [
    {
      id: "disp-1-init",
      month: 1,
      day: todayDay,
      amount: 100000,
    },
  ],
  customEmis: [],
  lumpSums: [],
  baselineOd: 0,
  customOds: [],
  miscExpenses: [],
};
