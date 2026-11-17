// Reads a transaction list in one fixed layout — no guessing of columns:
//   scheme_code,scheme_name,transaction_type,units,nav,transaction_date
// scheme_code is the fund's AMFI code; transaction_type is BUY, SIP, SELL or DIVIDEND; the date is
// YYYY-MM-DD (DD-MM-YYYY and DD/MM/YYYY are also read).
const COLUMNS = ["scheme_code", "scheme_name", "transaction_type", "units", "nav", "transaction_date"];
const TYPES = new Set(["BUY", "SIP", "SELL", "DIVIDEND"]);
const MAX_ROWS = 5000;

function splitLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

function isoDate(text) {
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) {
    const d = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(text);
    if (d) m = [null, d[3], d[2].padStart(2, "0"), d[1].padStart(2, "0")];
  }
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  if (date.getTime() > Date.now()) return null;
  return iso;
}

/** { transactions, errors } — a row with a problem is reported by line number, never guessed at. */
export function parseTransactionsCsv(text) {
  const lines = String(text || "").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { transactions: [], errors: ["The file has no transaction rows."] };
  const header = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const missing = COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) return { transactions: [], errors: [`Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`] };
  if (lines.length - 1 > MAX_ROWS) return { transactions: [], errors: [`Too many rows (the limit is ${MAX_ROWS}).`] };
  const at = Object.fromEntries(COLUMNS.map((c) => [c, header.indexOf(c)]));

  const transactions = [];
  const errors = [];
  lines.slice(1).forEach((line, i) => {
    const cells = splitLine(line);
    const get = (c) => cells[at[c]] ?? "";
    const row = i + 2;
    const type = get("transaction_type").toUpperCase();
    const units = Number(get("units").replace(/,/g, ""));
    const nav = Number(get("nav").replace(/,/g, ""));
    const date = isoDate(get("transaction_date"));
    const code = get("scheme_code");
    if (!/^\d{3,7}$/.test(code)) return errors.push(`Row ${row}: scheme_code must be the fund's AMFI code (numbers only).`);
    if (!TYPES.has(type)) return errors.push(`Row ${row}: transaction_type must be BUY, SIP, SELL or DIVIDEND.`);
    if (!(units > 0) || !(nav > 0)) return errors.push(`Row ${row}: units and nav must be numbers above zero.`);
    if (!date) return errors.push(`Row ${row}: transaction_date must be a real past date (YYYY-MM-DD).`);
    transactions.push({ scheme_code: code, scheme_name: get("scheme_name").slice(0, 200), transaction_type: type, units, nav, transaction_date: date });
  });
  return { transactions, errors };
}
