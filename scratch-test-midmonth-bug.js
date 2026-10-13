import assert from "node:assert";
import { calculateSchedule } from "./src/react-app/utils/calculations.ts";

console.log("=== Testing Mid-Month Additional Disbursement Bug ===");

// Scenario: Loan with 1,000,000 principal at start of Month 1,
// and an additional disbursement of 500,000 on Day 15 of Month 1.
const loanData = {
  principal: 1000000,
  rate: 7.5,
  years: 20,
  startDate: "2026-10-01",
  dispersals: [
    { month: 1, day: 1, amount: 1000000 },
    { month: 1, day: 15, amount: 500000 },
  ],
  customEmis: [],
  lumpSums: [],
};

const sched = calculateSchedule(loanData, "en-US");
const row1 = sched[0];

console.log("Month 1 results:");
console.log("  Disbursement:", row1.disbAmt);
console.log("  Monthly EMI:", row1.emi);
console.log("  Std EMI:", row1.stdEmi);
console.log("  Principal Paid:", row1.prinPay);
console.log("  Interest Paid:", row1.intPay);
console.log("  Sum of Prin + Int:", row1.prinPay + row1.intPay);
console.log("  Closing Balance:", row1.remaining);

// The user states: "calculated Monthly EMI and Std EMI does not show correct value in case
// when a additional disbursment happened in middle of the month, it should be addition of
// interest paid and principle paid of the month."
assert.strictEqual(
  Math.round(row1.emi),
  Math.round(row1.prinPay + row1.intPay),
  `Monthly EMI (${row1.emi}) should equal Principal Paid + Interest Paid (${row1.prinPay + row1.intPay})`
);

assert.strictEqual(
  Math.round(row1.stdEmi),
  Math.round(row1.prinPay + row1.intPay),
  `Std EMI (${row1.stdEmi}) should equal Principal Paid + Interest Paid (${row1.prinPay + row1.intPay})`
);

console.log("✓ Test passed!");
