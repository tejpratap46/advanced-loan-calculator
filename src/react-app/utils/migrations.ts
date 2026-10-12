import type { Loan, Dispersal, LumpSum, CustomEmi } from "../types/index.ts";

export const migrateLoans = (loans: Loan[]): Loan[] => {
  if (!Array.isArray(loans)) return [];

  return loans.map((loan) => {
    const data = loan.data || {};
    const startParts = data.startDate ? data.startDate.split("-").map(Number) : [];
    const defaultStartDay = Math.min(31, Math.max(1, startParts[2] || 1));

    let migratedDispersals = data.dispersals || [];
    if (migratedDispersals.length > 0) {
      migratedDispersals = (migratedDispersals as unknown[]).map((d, idx) => {
        const item = d as {
          id?: string;
          month: number;
          day?: number;
          pct?: number;
          amount?: number;
        };
        const amount =
          item.amount !== undefined
            ? item.amount
            : item.pct !== undefined
              ? ((data.principal || 0) * item.pct) / 100
              : 0;
        const resolvedDay = item.day ?? (item.month === 1 ? defaultStartDay : 1);

        return {
          id: item.id || `disp-${item.month}-${resolvedDay}-${idx}`,
          month: item.month,
          day: resolvedDay,
          amount,
        } as Dispersal;
      });
    } else if ((data.principal || 0) > 0) {
      // If loan has no disbursements yet, backfill Month 1 full principal disbursement
      migratedDispersals = [
        {
          id: `disp-1-${defaultStartDay}-init`,
          month: 1,
          day: defaultStartDay,
          amount: data.principal,
        },
      ];
    }

    let migratedLumpSums = data.lumpSums || [];
    if (migratedLumpSums.length > 0) {
      migratedLumpSums = (migratedLumpSums as unknown[]).map((l, idx) => {
        const item = l as { id?: string; month: number; day?: number; amount: number };
        const resolvedDay = item.day ?? (item.month === 0 ? defaultStartDay : 1);
        return {
          id: item.id || `lump-${item.month}-${resolvedDay}-${idx}`,
          month: item.month,
          day: resolvedDay,
          amount: item.amount,
        } as LumpSum;
      });
    }

    let migratedCustomEmis = data.customEmis || [];
    if (migratedCustomEmis.length > 0) {
      migratedCustomEmis = (migratedCustomEmis as unknown[]).map((e, idx) => {
        const item = e as { id?: string; fromMonth: number; day?: number; amount: number };
        const resolvedDay = item.day ?? defaultStartDay;
        return {
          id: item.id || `emi-${item.fromMonth}-${resolvedDay}-${idx}`,
          fromMonth: item.fromMonth,
          day: resolvedDay,
          amount: item.amount,
        } as CustomEmi;
      });
    }

    return {
      ...loan,
      data: {
        principal: data.principal ?? 100000,
        rate: data.rate ?? 7.5,
        years: data.years ?? 20,
        startDate: data.startDate || new Date().toISOString().split("T")[0],
        dispersals: migratedDispersals,
        lumpSums: migratedLumpSums,
        customEmis: migratedCustomEmis,
        baselineOd: data.baselineOd ?? 0,
        customOds: data.customOds || [],
        miscExpenses: data.miscExpenses || [],
      },
    };
  });
};
