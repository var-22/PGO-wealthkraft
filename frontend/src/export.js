// Files the customer can save from the app. Built in the browser from what is already on screen.

const cell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function save(name, rows) {
  // The leading BOM makes Excel read the file as UTF-8.
  const blob = new Blob([`﻿${rows.map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One row per fund held, as shown in the app, plus a total row. */
export function downloadHoldings(portfolio) {
  const { funds, summary, asOf } = portfolio;
  save(`pgo-holdings-${asOf || "latest"}.csv`, [
    ["Fund", "Category", "Status", "Invested (Rs)", "Current value (Rs)", "Gain (Rs)", "Return %", "XIRR % a year", "Units", "NAV", "NAV date", "Share of portfolio %", "Monthly SIP (Rs)"],
    ...funds.map((f) => [f.name, f.categoryShort, f.status, f.invested, f.value, f.gain, f.returnPct, f.xirrPct, f.units, f.nav, f.navDate, f.weightPct, f.isLiveSip ? f.sipAmount : ""]),
    ["Total", "", "", summary.invested, summary.value, summary.gain, summary.returnPct, summary.xirrPct, "", "", asOf, 100, summary.monthlySip || ""],
  ]);
}

/** The transaction list as currently filtered on the Transactions screen. */
export function downloadTransactions(transactions) {
  save("pgo-transactions.csv", [
    ["Date", "Fund", "Scheme code", "Type", "Units", "NAV", "Amount (Rs)"],
    ...transactions.map((t) => [t.date, t.name, t.code, t.type, t.units, t.nav, t.amount]),
  ]);
}
