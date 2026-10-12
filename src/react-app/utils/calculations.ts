import type { LoanData, ScheduleRow, MiscExpense, DayDetail, Dispersal, LumpSum } from "../types/index.ts";

export interface MonthCalendarInfo {
  year: number;
  monthIndex: number; // 0-11
  daysInMonth: number;
  daysInYear: number;
  startDay: number;
  monthDate: Date;
}

export const getMonthCalendarInfo = (
  startDate: string,
  m: number,
): MonthCalendarInfo => {
  const parts = startDate ? startDate.split("-").map(Number) : [];
  const sYear = parts[0] || new Date().getFullYear();
  const sMonth = (parts[1] || 1) - 1;
  const startDay = Math.min(31, Math.max(1, parts[2] || 1));

  const targetDate = new Date(sYear, sMonth + m - 1, 1);
  const year = targetDate.getFullYear();
  const monthIndex = targetDate.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const isLeapYear =
    (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeapYear ? 366 : 365;

  return {
    year,
    monthIndex,
    daysInMonth,
    daysInYear,
    startDay,
    monthDate: targetDate,
  };
};

export const formatDayDate = (
  year: number,
  monthIndex: number,
  day: number,
  locale: string = "en-US",
): { dateStr: string; fullDate: string } => {
  const d = new Date(year, monthIndex, day);
  const dateStr = d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const fullDate = `${year}-${mm}-${dd}`;
  return { dateStr, fullDate };
};

export const getCurrentMonth = (startDate: string) => {
  const s = new Date(startDate),
    n = new Date();
  return Math.max(
    1,
    (n.getFullYear() - s.getFullYear()) * 12 + n.getMonth() - s.getMonth() + 1,
  );
};

export const calculateSchedule = (
  data: LoanData,
  locale: string,
): ScheduleRow[] => {
  const {
    rate,
    years: y,
    startDate: sd,
    dispersals: ds,
    customEmis: ces,
    lumpSums: ls,
    principal,
  } = data;

  const tm = Math.max(1, (y || 1) * 12);
  const rows: ScheduleRow[] = [];

  // If no explicit dispersals, default to a Month 1 disbursement of principal
  const initialParts = sd ? sd.split("-").map(Number) : [];
  const defaultStartDay = Math.min(31, Math.max(1, initialParts[2] || 1));

  const effectiveDispersals: Dispersal[] =
    ds && ds.length > 0
      ? ds
      : principal > 0
        ? [{ id: "default-p", month: 1, day: defaultStartDay, amount: principal }]
        : [];

  const getCE = (m: number) =>
    ces
      .filter((e) => e.fromMonth <= m)
      .sort((a, b) => b.fromMonth - a.fromMonth)[0] || null;

  const getOD = (m: number) => {
    const customOds = data.customOds ?? [];
    const activeCustom = customOds
      .filter((o) => o.fromMonth <= m)
      .sort((a, b) => b.fromMonth - a.fromMonth)[0];
    return activeCustom ? activeCustom.amount : (data.baselineOd ?? 0);
  };

  // ── Step 1: Standard benchmark calculation for "Interest Saved" comparison ──
  // Benchmark assumes standard disbursements with standard EMI and no OD offset.
  const stdBenchmark: { rem: number; int: number; dailyInt: number[] }[] = [];
  let benchRem = 0;

  for (let m = 1; m <= tm; m++) {
    const cal = getMonthCalendarInfo(sd, m);
    const dailyRate = (rate / 100) / cal.daysInYear;
    const monthlyRate = rate / 100 / 12;

    // Benchmark disbursements for month m
    const mDisbs = effectiveDispersals.filter((d) => d.month === m);
    const dayDisbMap: Record<number, number> = {};
    for (const d of mDisbs) {
      const day = Math.min(cal.daysInMonth, Math.max(1, d.day ?? cal.startDay));
      dayDisbMap[day] = (dayDisbMap[day] || 0) + d.amount;
    }

    if (benchRem <= 0.001 && mDisbs.length === 0) {
      stdBenchmark.push({ rem: 0, int: 0, dailyInt: new Array(cal.daysInMonth).fill(0) });
      continue;
    }

    // Standard EMI target for benchmark
    const rm = tm - m + 1;
    // Estimated pre-payment principal for standard EMI formula
    const preRem = benchRem + (dayDisbMap[cal.startDay] || 0);
    const stdEmi =
      preRem <= 0
        ? 0
        : monthlyRate === 0
          ? preRem / rm
          : (preRem * monthlyRate * Math.pow(1 + monthlyRate, rm)) /
            (Math.pow(1 + monthlyRate, rm) - 1);

    const defaultEmiDay = Math.min(cal.daysInMonth, Math.max(1, cal.startDay));
    let benchMonthInt = 0;
    const benchDailyInt: number[] = [];

    for (let d = 1; d <= cal.daysInMonth; d++) {
      if (dayDisbMap[d]) {
        benchRem += dayDisbMap[d];
      }
      if (d === defaultEmiDay && benchRem > 0) {
        const estInt = benchRem * monthlyRate;
        let pp = stdEmi - estInt;
        if (pp > benchRem) pp = benchRem;
        if (pp > 0) benchRem = Math.max(0, benchRem - pp);
      }
      const dayInt = benchRem * dailyRate;
      benchMonthInt += dayInt;
      benchDailyInt.push(dayInt);
    }

    stdBenchmark.push({
      rem: benchRem,
      int: benchMonthInt,
      dailyInt: benchDailyInt,
    });
  }

  // ── Step 2: Actual Schedule Calculation with Day-Wise Granularity ──
  let actualRem = 0;
  let cumDisbursed = 0;

  for (let m = 1; m <= tm; m++) {
    const cal = getMonthCalendarInfo(sd, m);
    const dailyRate = (rate / 100) / cal.daysInYear;
    const monthlyRate = rate / 100 / 12;
    const odb = getOD(m);

    // Disbursements in this month
    const mDisbs = effectiveDispersals.filter((d) => d.month === m);
    const dayDisbMap: Record<number, number> = {};
    for (const d of mDisbs) {
      const day = Math.min(cal.daysInMonth, Math.max(1, d.day ?? cal.startDay));
      dayDisbMap[day] = (dayDisbMap[day] || 0) + d.amount;
    }

    // Lump sums in this month (Month 0 lump sums apply in Month 1 on day 1 or startDay)
    const mLumps: LumpSum[] = [
      ...ls.filter((l) => l.month === m),
      ...(m === 1 ? ls.filter((l) => l.month === 0) : []),
    ];
    const dayLumpMap: Record<number, number> = {};
    for (const l of mLumps) {
      const defaultLumpDay = l.month === 0 ? cal.startDay : 1;
      const day = Math.min(cal.daysInMonth, Math.max(1, l.day ?? defaultLumpDay));
      dayLumpMap[day] = (dayLumpMap[day] || 0) + l.amount;
    }

    const activeCE = getCE(m);
    const hasLumpInMonth = mLumps.length > 0;
    const rm = tm - m + 1;

    // If balance is 0 and no new disbursements, output zero row
    if (actualRem <= 0.001 && mDisbs.length === 0) {
      const monthDate = cal.monthDate;
      const days: DayDetail[] = [];
      for (let d = 1; d <= cal.daysInMonth; d++) {
        const { dateStr, fullDate } = formatDayDate(cal.year, cal.monthIndex, d, locale);
        days.push({
          day: d,
          date: dateStr,
          fullDate,
          disbAmt: 0,
          emiAmt: 0,
          lumpAmt: 0,
          prinPay: 0,
          intPay: 0,
          interestSaved: 0,
          odBal: odb,
          netPrincipal: 0,
          balance: 0,
        });
      }

      rows.push({
        m,
        date: monthDate.toLocaleDateString(locale, { year: "numeric", month: "short" }),
        disbAmt: 0,
        emi: 0,
        prinPay: 0,
        intPay: 0,
        remaining: 0,
        cumDisbursed,
        payType: "none",
        stdEmi: 0,
        customEmiAmt: null,
        lumpAmt: null,
        interestSaved: 0,
        odBal: odb,
        days,
      });
      continue;
    }

    // Determine EMI payment day and target amount
    const customEmiDay = activeCE?.day
      ? Math.min(cal.daysInMonth, Math.max(1, activeCE.day))
      : undefined;
    const defaultEmiDay = Math.min(cal.daysInMonth, Math.max(1, cal.startDay));
    const emiDay = customEmiDay ?? defaultEmiDay;

    // Standard EMI formula for remaining term
    const approxPreRem = actualRem + (dayDisbMap[emiDay] || 0);
    const stdEmi =
      approxPreRem <= 0
        ? 0
        : monthlyRate === 0
          ? approxPreRem / rm
          : (approxPreRem * monthlyRate * Math.pow(1 + monthlyRate, rm)) /
            (Math.pow(1 + monthlyRate, rm) - 1);

    const targetEmiAmt = activeCE ? activeCE.amount : stdEmi;

    let monthDisb = 0;
    let monthLump = 0;
    let monthPrinPay = 0;
    let monthIntPay = 0;
    let monthEmi = 0;
    let monthIntSaved = 0;
    const dayDetails: DayDetail[] = [];

    const benchDaily = stdBenchmark[m - 1]?.dailyInt || [];

    for (let d = 1; d <= cal.daysInMonth; d++) {
      const { dateStr, fullDate } = formatDayDate(cal.year, cal.monthIndex, d, locale);
      const dayEvents: string[] = [];

      // 1. Disbursement on day d
      const dDisb = dayDisbMap[d] || 0;
      if (dDisb > 0) {
        actualRem += dDisb;
        cumDisbursed += dDisb;
        monthDisb += dDisb;
        dayEvents.push(`Disbursement: +${dDisb}`);
      }

      // 2. Lump sum on day d
      const dLump = dayLumpMap[d] || 0;
      let actualDayLump = 0;
      if (dLump > 0 && actualRem > 0) {
        actualDayLump = Math.min(actualRem, dLump);
        actualRem = Math.max(0, actualRem - actualDayLump);
        monthLump += actualDayLump;
        monthPrinPay += actualDayLump;
        dayEvents.push(`Lump Sum: -${actualDayLump}`);
      }

      // 3. EMI payment on payment day
      let dayPrinFromEmi = 0;
      let dayEmiAmt = 0;
      if (d === emiDay && actualRem > 0) {
        const netBeforeEmi = Math.max(0, actualRem - odb);
        const estMonthlyInt = netBeforeEmi * monthlyRate;
        let pp = targetEmiAmt - estMonthlyInt;
        if (pp > actualRem) pp = actualRem;
        if (pp > 0) {
          actualRem = Math.max(0, actualRem - pp);
          dayPrinFromEmi = pp;
          monthPrinPay += pp;
        }
        dayEmiAmt = targetEmiAmt;
        monthEmi += targetEmiAmt;
        dayEvents.push(
          activeCE
            ? `Custom EMI: ${targetEmiAmt}`
            : `EMI Payment: ${Math.round(targetEmiAmt)}`,
        );
      }

      // 4. Daily interest accrual on net balance
      const netPrincipal = Math.max(0, actualRem - odb);
      const dayInt = netPrincipal * dailyRate;
      monthIntPay += dayInt;

      // Benchmark daily interest for interest saved
      const stdDayInt = benchDaily[d - 1] ?? (actualRem * dailyRate);
      const daySaved = Math.max(0, stdDayInt - dayInt);
      monthIntSaved += daySaved;

      dayDetails.push({
        day: d,
        date: dateStr,
        fullDate,
        disbAmt: dDisb,
        emiAmt: dayEmiAmt,
        lumpAmt: actualDayLump,
        prinPay: dayPrinFromEmi + actualDayLump,
        intPay: dayInt,
        interestSaved: daySaved,
        odBal: odb,
        netPrincipal,
        balance: actualRem,
        events: dayEvents.length > 0 ? dayEvents : undefined,
      });
    }

    let pt: ScheduleRow["payType"] = activeCE ? "custom" : "std";
    if (hasLumpInMonth) pt = "lump";

    // If EMI wasn't triggered because balance was paid off before emiDay
    if (monthEmi === 0 && monthPrinPay > 0) {
      monthEmi = monthPrinPay + monthIntPay;
    }

    rows.push({
      m,
      date: cal.monthDate.toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
      }),
      disbAmt: monthDisb,
      emi: monthEmi,
      prinPay: monthPrinPay,
      intPay: monthIntPay,
      remaining: actualRem,
      cumDisbursed,
      payType: pt,
      stdEmi,
      customEmiAmt: activeCE ? activeCE.amount : null,
      lumpAmt: monthLump > 0 ? monthLump : null,
      interestSaved: monthIntSaved,
      odBal: odb,
      days: dayDetails,
    });

    if (actualRem <= 0.001) {
      // Loan fully repaid early: fill remaining months with empty zero rows
      for (let r = m + 1; r <= tm; r++) {
        const nextCal = getMonthCalendarInfo(sd, r);
        const emptyDays: DayDetail[] = [];
        for (let d = 1; d <= nextCal.daysInMonth; d++) {
          const { dateStr, fullDate } = formatDayDate(nextCal.year, nextCal.monthIndex, d, locale);
          emptyDays.push({
            day: d,
            date: dateStr,
            fullDate,
            disbAmt: 0,
            emiAmt: 0,
            lumpAmt: 0,
            prinPay: 0,
            intPay: 0,
            interestSaved: 0,
            odBal: 0,
            netPrincipal: 0,
            balance: 0,
          });
        }
        rows.push({
          m: r,
          date: nextCal.monthDate.toLocaleDateString(locale, {
            year: "numeric",
            month: "short",
          }),
          disbAmt: 0,
          emi: 0,
          prinPay: 0,
          intPay: 0,
          remaining: 0,
          cumDisbursed,
          payType: "none",
          stdEmi: 0,
          customEmiAmt: null,
          lumpAmt: null,
          interestSaved: 0,
          odBal: 0,
          days: emptyDays,
        });
      }
      break;
    }
  }

  return rows;
};

export const calculateTotals = (
  schedule: ScheduleRow[],
  miscExpenses: MiscExpense[] = [],
) => {
  const totals = schedule.reduce(
    (a, r) => ({
      d: Math.max(a.d, r.cumDisbursed),
      e: a.e + r.emi,
      p: a.p + r.prinPay,
      i: a.i + r.intPay,
      s: a.s + r.interestSaved,
    }),
    { d: 0, e: 0, p: 0, i: 0, s: 0 },
  );
  const totalMisc = (miscExpenses || []).reduce(
    (sum, item) => sum + (item.amount || 0),
    0,
  );
  return {
    ...totals,
    m: totalMisc,
  };
};
