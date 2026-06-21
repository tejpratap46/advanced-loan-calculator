import { LoanData, ScheduleRow } from "../types";

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
  } = data;
  const mr = rate / 100 / 12,
    tm = y * 12;
  const rows: ScheduleRow[] = [],
    sds = [...ds].sort((a, b) => a.month - b.month);
  let di = 0,
    rem = 0,
    cd = 0;

  const getCE = (m: number) =>
    ces
      .filter((e) => e.fromMonth <= m)
      .sort((a, b) => b.fromMonth - a.fromMonth)[0]?.amount || null;
  const getLS = (m: number) => ls.find((l) => l.month === m)?.amount ?? null;
  const getOD = (m: number) => {
    const customOds = data.customOds ?? [];
    const activeCustom = customOds
      .filter((o) => o.fromMonth <= m)
      .sort((a, b) => b.fromMonth - a.fromMonth)[0];
    return activeCustom ? activeCustom.amount : (data.baselineOd ?? 0);
  };

  const std: { rem: number; int: number }[] = [];
  let sr = 0,
    sdi = 0;
  for (let m = 1; m <= tm; m++) {
    let da = 0;
    if (sdi < sds.length && sds[sdi].month === m) {
      da = sds[sdi].amount;
      sr += da;
      sdi++;
    }
    if (sr <= 0) {
      std.push({ rem: 0, int: 0 });
      continue;
    }
    const rm = tm - m + 1,
      se =
        mr === 0
          ? sr / rm
          : (sr * mr * Math.pow(1 + mr, rm)) / (Math.pow(1 + mr, rm) - 1);
    const ip = sr * mr;
    let pp = se - ip;
    if (pp > sr) pp = sr;
    sr = Math.max(0, sr - pp);
    std.push({ rem: sr, int: ip });
    if (sr <= 0.01) {
      for (let r = m + 1; r <= tm; r++) std.push({ rem: 0, int: 0 });
      break;
    }
  }

  for (let m = 1; m <= tm; m++) {
    let da = 0;
    if (di < sds.length && sds[di].month === m) {
      da = sds[di].amount;
      rem += da;
      cd += da;
      di++;
    }
    const d = new Date(sd);
    d.setMonth(d.getMonth() + m - 1);
    if (rem <= 0) {
      rows.push({
        m,
        date: d.toLocaleDateString(locale, { year: "numeric", month: "short" }),
        disbAmt: da,
        emi: 0,
        prinPay: 0,
        intPay: 0,
        remaining: 0,
        cumDisbursed: cd,
        payType: "none",
        stdEmi: 0,
        customEmiAmt: null,
        lumpAmt: null,
        interestSaved: 0,
        odBal: 0,
      });
      continue;
    }

    const rm = tm - m + 1,
      se =
        mr === 0
          ? rem / rm
          : (rem * mr * Math.pow(1 + mr, rm)) / (Math.pow(1 + mr, rm) - 1);
    const cea = getCE(m);
    const la = getLS(m);
    const ae = cea ?? se;
    let pt: ScheduleRow["payType"] = cea ? "custom" : "std";
    if (la) pt = "lump";
    const odb = getOD(m);
    const netPrincipal = Math.max(0, rem - odb);
    const ip = netPrincipal * mr;
    let pp = ae - ip;
    if (pp > rem) pp = rem;
    const emi = ip + pp;
    rem = Math.max(0, rem - pp);
    if (la) {
      rem = Math.max(0, rem - la);
      pp += la;
    }
    const si = std[m - 1]?.int || 0,
      isv = Math.max(0, si - ip);
    rows.push({
      m,
      date: d.toLocaleDateString(locale, { year: "numeric", month: "short" }),
      disbAmt: da,
      emi,
      prinPay: pp,
      intPay: ip,
      remaining: rem,
      cumDisbursed: cd,
      payType: pt,
      stdEmi: se,
      customEmiAmt: cea,
      lumpAmt: la,
      interestSaved: isv,
      odBal: odb,
    });
    if (rem <= 0.01) {
      for (let r = m + 1; r <= tm; r++) {
        const rd = new Date(sd);
        rd.setMonth(rd.getMonth() + r - 1);
        rows.push({
          m: r,
          date: rd.toLocaleDateString(locale, {
            year: "numeric",
            month: "short",
          }),
          disbAmt: 0,
          emi: 0,
          prinPay: 0,
          intPay: 0,
          remaining: 0,
          cumDisbursed: cd,
          payType: "none",
          stdEmi: 0,
          customEmiAmt: null,
          lumpAmt: null,
          interestSaved: 0,
          odBal: 0,
        });
      }
      break;
    }
  }
  return rows;
};

export const calculateTotals = (schedule: ScheduleRow[]) => {
  return schedule.reduce(
    (a, r) => ({
      d: Math.max(a.d, r.cumDisbursed),
      e: a.e + r.emi,
      p: a.p + r.prinPay,
      i: a.i + r.intPay,
      s: a.s + r.interestSaved,
    }),
    { d: 0, e: 0, p: 0, i: 0, s: 0 },
  );
};
