// Works out, from a customer's own SIP instalments, how much each running SIP puts in a month and
// when the next instalment is expected. It is read straight off the transaction history by fixed
// rules; a SIP that is not on a monthly rhythm is left out rather than guessed at.

const DAY_MS = 86400000;
const utc = (iso) => new Date(`${iso}T00:00:00Z`);
const daysInMonth = (year, month) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * { [scheme_code]: { amount, day, nextDate } } for each code in `liveCodes` whose instalments are
 * monthly. `amount` is the latest instalment in whole rupees; `day` is the usual day of the month
 * (the earliest of the recent instalments, since a holiday only ever pushes one later); `nextDate`
 * is the first such day after the last instalment that is not before `today`.
 */
export function sipPlan(transactions, liveCodes, today) {
  const wanted = new Set([...liveCodes].map(String));
  const byCode = new Map();
  for (const t of transactions) {
    const code = String(t.scheme_code);
    if (t.transaction_type !== "SIP" || !wanted.has(code)) continue;
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(t);
  }

  const plan = {};
  for (const [code, list] of byCode) {
    list.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
    const recent = list.slice(-6);
    if (recent.length >= 2) {
      const gaps = recent.slice(1).map((t, i) => (utc(t.transaction_date) - utc(recent[i].transaction_date)) / DAY_MS);
      const typical = median(gaps);
      if (typical < 24 || typical > 38) continue; // weekly, quarterly or irregular: not guessed at
    }
    const last = recent[recent.length - 1];
    const amount = Math.round(last.units * last.nav);
    const day = Math.min(...recent.map((t) => utc(t.transaction_date).getUTCDate()));
    const lastDate = utc(last.transaction_date);
    let year = lastDate.getUTCFullYear();
    let month = lastDate.getUTCMonth();
    let nextDate;
    do {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      nextDate = new Date(Date.UTC(year, month, Math.min(day, daysInMonth(year, month)))).toISOString().slice(0, 10);
    } while (nextDate < today);
    plan[code] = { amount, day, nextDate };
  }
  return plan;
}
