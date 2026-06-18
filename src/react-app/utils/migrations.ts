import { Loan, Dispersal } from "../types";

export const migrateLoans = (loans: Loan[]): Loan[] => {
  return loans.map((loan) => {
    const data = loan.data;
    if (data.dispersals && data.dispersals.length > 0) {
      const migratedDispersals = (data.dispersals as unknown[]).map((d) => {
        const item = d as { month: number; pct?: number; amount?: number };
        if (item.pct !== undefined && item.amount === undefined) {
          return {
            month: item.month,
            amount: (data.principal * item.pct) / 100,
          } as Dispersal;
        }
        return item as Dispersal;
      });
      return {
        ...loan,
        data: {
          ...data,
          dispersals: migratedDispersals,
        },
      };
    }
    return loan;
  });
};
