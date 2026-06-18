import { LoanData } from "../types";

export const STORAGE_KEY = "loan-calc-loans";
export const THEME_KEY = "loan-calc-theme";
export const FIREBASE_CONFIG_KEY = "loan-calc-firebase-config";

export const DEFAULT_DATA: LoanData = {
  principal: 100000,
  rate: 7.5,
  years: 20,
  startDate: new Date().toISOString().split("T")[0],
  dispersals: [],
  customEmis: [],
  lumpSums: [],
};
