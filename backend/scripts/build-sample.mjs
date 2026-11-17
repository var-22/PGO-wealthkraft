// Rebuilds src/sample/sample-portfolio.csv from real published NAVs (api.mfapi.in), so the sample
// portfolio's units and prices are what an investor would really have got on those dates.
//   node scripts/build-sample.mjs
import { writeFileSync } from "node:fs";
import axios from "axios";

const PLAN = [
  { code: "119063", sip: 10000, from: "2022-01-05" },
  { code: "122639", sip: 15000, from: "2021-06-07" },
  { code: "120505", lump: 150000, on: "2021-10-18" },
  { code: "125497", lump: 100000, on: "2023-02-10" },
  { code: "120197", lump: 200000, on: "2024-03-12" },
  { code: "118989", lump: 75000, on: "2026-09-28" },
];

const toIso = (ddmmyyyy) => ddmmyyyy.split("-").reverse().join("-");

async function history(code) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const { data } = await axios.get(`https://api.mfapi.in/mf/${code}`, { timeout: 60000 });
      const navs = data.data.map((d) => ({ date: toIso(d.date), nav: Number(d.nav) })).sort((a, b) => a.date.localeCompare(b.date));
      return { name: data.meta.scheme_name, navs };
    } catch (err) {
      if (attempt === 4) throw new Error(`NAV history for ${code}: ${err.message}`);
    }
  }
}

// The first published NAV on or after the wanted date (a holiday rolls forward).
const navOnOrAfter = (navs, iso) => navs.find((n) => n.date >= iso) || null;

const rows = [];
for (const item of PLAN) {
  const { name, navs } = await history(item.code);
  console.log(item.code, name, navs.at(-1).date);
  const add = (type, amount, iso) => {
    const point = navOnOrAfter(navs, iso);
    if (!point) return;
    rows.push([item.code, `"${name}"`, type, (amount / point.nav).toFixed(3), point.nav, point.date].join(","));
  };
  if (item.lump) add("BUY", item.lump, item.on);
  if (item.sip) {
    const cursor = new Date(`${item.from}T00:00:00Z`);
    const last = navs.at(-1).date;
    while (cursor.toISOString().slice(0, 10) <= last) {
      add("SIP", item.sip, cursor.toISOString().slice(0, 10));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
}

const out = new URL("../src/sample/sample-portfolio.csv", import.meta.url);
writeFileSync(out, `scheme_code,scheme_name,transaction_type,units,nav,transaction_date\n${rows.join("\n")}\n`);
console.log(`${rows.length} rows written`);
