// The compact per-fund view shared by the PDF card and the dashboard: a small returns table (fund
// vs its official benchmark vs its category average, 1/3/5 years, plus the investor's own money on
// the same dates) and two plain lines about the fund. Built only from figures calc-service already
// produced and validated — nothing is recomputed or estimated here.

const WINDOWS = [
  ["1y", "1 Year"],
  ["3y", "3 Years"],
  ["5y", "5 Years"],
];

const isNum = (n) => typeof n === "number" && Number.isFinite(n);
const shortDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const pct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

// "Equity Scheme - Contra Fund" -> "Contra Fund"; "Hybrid Scheme - Aggressive Hybrid Fund" -> "Aggressive Hybrid Fund".
export function categoryShortName(schemeCategory) {
  const text = String(schemeCategory || "").trim();
  const part = text.includes(" - ") ? text.slice(text.indexOf(" - ") + 3) : text;
  return part || "Category";
}

/**
 * { benchmarkLabel, categoryLabel, source, rows: [{ key, label, fund, benchmark, category }], yourRow }
 *
 * Fund and benchmark returns come from ONE source per fund so they always cover the same dates:
 * the fund house's figures as reported to AMFI (official benchmark, usually its TRI) wherever AMFI
 * has them; otherwise the fund's own NAV returns against the benchmark series the comparison used
 * (named by what it is, e.g. "Price of Physical Gold (ETF proxy)"). The category average is AMFI's
 * (every scheme in the same sub-category), so it is only shown where AMFI covers the fund.
 */
export function fundReturnsTable(s) {
  // One dated source for all three rows: AMFI's row for the fund (benchmark from AMFI, or from the
  // benchmark's own series on AMFI's date); for a fund AMFI does not list, calc-service's peer_returns
  // (the fund's NAV, its benchmark series and the AMFI sub-category average, all on one date).
  const hasFund = (src) => Boolean(src && src.fund && WINDOWS.some(([k]) => isNum(src.fund[k])));
  const peer = !hasFund(s.reported_trailing_returns) && hasFund(s.peer_returns) ? s.peer_returns : null;
  const rt = peer || s.reported_trailing_returns;
  const amfi = hasFund(rt);
  const series = s.benchmark_trailing_returns;
  const fundSource = amfi ? rt.fund : s.trailing_returns || {};
  const benchSource = amfi ? rt.benchmark_returns || {} : series || {};
  const category = amfi ? rt.category_average || {} : {};
  const bcLabel = s.benchmark_comparison && s.benchmark_comparison.valid ? s.benchmark_comparison.benchmark_name : null;
  const benchmarkLabel = amfi ? rt.benchmark_from_series || rt.benchmark || s.benchmark_name || "Benchmark" : (series && series.label) || bcLabel || s.benchmark_name || "Benchmark";
  const rows = WINDOWS.map(([key, label]) => ({
    key,
    label,
    fund: isNum(fundSource[key]) ? fundSource[key] : null,
    benchmark: isNum(benchSource[key]) ? benchSource[key] : null,
    category: isNum(category[key]) ? category[key] : null,
  })).filter((r) => r.fund !== null);

  const bc = s.benchmark_comparison;
  let yourRow = null;
  if (bc && bc.valid) {
    const xirr = bc.compare_on === "xirr";
    const fund = xirr ? bc.annualized_fund_return : bc.fund_return;
    const benchmark = xirr ? bc.annualized_benchmark_return : bc.benchmark_return;
    if (isNum(fund) && isNum(benchmark)) {
      yourRow = {
        label: `${xirr ? "Your XIRR (same SIP dates" : bc.purchase_count > 1 ? "Your return (same purchase dates" : "Your return (since you invested"}${
          // The index had not published a close for the fund's latest NAV date: both sides end on the
          // last day they share, and the label says which.
          bc.ended_early ? `, to ${shortDate(bc.end_date)}` : ""
        })`,
        fund,
        benchmark,
        benchmarkLabel: bc.benchmark_name,
        gap: fund - benchmark,
      };
    }
  }
  const AMFI_PAGE = "https://www.amfiindia.com/otherdata/fund-performance";
  return {
    benchmarkLabel,
    // Where each row's figures can be checked (clickable in the PDF).
    benchmarkUrl: amfi && !peer && !rt.benchmark_from_series ? AMFI_PAGE : amfi ? (s.benchmark_comparison && s.benchmark_comparison.source && s.benchmark_comparison.source.url) || null : (s.benchmark_comparison && s.benchmark_comparison.source && s.benchmark_comparison.source.url) || null,
    categoryUrl: amfi && !rt.calculated_from_nav ? AMFI_PAGE : null,
    categoryLabel: (amfi && rt.category_label) || `${categoryShortName(s.scheme_category)} avg`,
    hasCategory: rows.some((r) => r.category !== null),
    source: peer
      ? `As of ${rt.as_of}: fund from its own NAV · benchmark from the ${benchmarkLabel} series · category average from AMFI fund performance data (Regular plan)`
      : amfi && rt.calculated_from_nav
      ? `Calculated to the latest NAV date, ${rt.as_of} (AMFI's table is published only up to ${rt.amfi_as_of}): fund from its Regular-plan NAV · benchmark from the ${benchmarkLabel} series · category average across the category's Regular-plan funds`
      : amfi
      ? `AMFI fund performance data as of ${rt.as_of} (${rt.plan} plan)${rt.benchmark_from_series ? `; benchmark from the ${rt.benchmark_from_series} series on the same date` : ""}${
          rt.benchmark_corrections ? `; benchmark ${Object.keys(rt.benchmark_corrections.windows).map((k) => k.replace("since_inception", "since-launch")).join("/")} corrected from the index's own values (the reported figure was wrong)` : ""
        }; category average across ${rt.category_label ? "funds with the same benchmark" : "the sub-category's schemes"}`
      : rows.length
        ? "Fund: its own NAV returns · Benchmark: the series named above"
        : null,
    rows,
    yourRow,
    provenance: provenanceFor(s, { amfi, peer, rt, benchmarkLabel, rows, yourRow, AMFI_PAGE }),
  };
}

const NAV_PAGE = "https://www.amfiindia.com/net-asset-value/nav-history";

// The app's own "see the source" pages (routes/source.js), which open straight to the figures.
function amfiSourceUrl(rt, s) {
  const t = rt && rt.amfi_table;
  if (!t) return null;
  const q = new URLSearchParams({
    category: String(t.category),
    sub_category: String(t.sub_category),
    report_date: t.report_date,
    ...(s && s.scheme_category ? { category_name: s.scheme_category } : {}),
    ...(t.scheme_name ? { fund: t.scheme_name } : {}),
    ...(t.same_benchmark ? { same_benchmark: "1", benchmark: rt.benchmark || "" } : {}),
  });
  return `/api/source/amfi?${q.toString()}#fund`;
}

function anniversaries(asOf) {
  const d = new Date(`${asOf}T00:00:00Z`);
  return [0, 1, 3, 5].map((y) => {
    const x = new Date(d);
    x.setUTCFullYear(d.getUTCFullYear() - y);
    return x.toISOString().slice(0, 10);
  });
}

function indexSourceUrl(key, dates, label) {
  if (!key || !dates.length) return null;
  const q = new URLSearchParams({ key, dates: [...new Set(dates)].join(","), ...(label ? { label } : {}) });
  return `/api/source/index?${q.toString()}`;
}
const countText = (counts) =>
  WINDOWS.map(([k, label]) => (counts && counts[k] ? `${label}: ${counts[k]} fund${counts[k] === 1 ? "" : "s"}` : null)).filter(Boolean).join(" · ");

// One line per table row saying exactly where its figures came from and how — shown under the
// table on the dashboard ("Where these numbers come from"), each with a page to check it on.
function provenanceFor(s, { amfi, peer, rt, benchmarkLabel, rows, yourRow, AMFI_PAGE }) {
  if (!rows.length && !yourRow) return [];
  const series = s.benchmark_trailing_returns && s.benchmark_trailing_returns.source;
  const sub = categoryShortName(s.scheme_category);
  const out = [];

  out.push({
    row: "Fund",
    detail:
      amfi && rt.calculated_from_nav
        ? `Calculated from the ${rt.plan} plan's own daily NAV (AMFI NAV history) up to ${rt.as_of}, the latest NAV date — AMFI's own table is published only up to ${rt.amfi_as_of}, so its figures would be older.`
        : amfi && !peer
        ? `Reported by the fund house to AMFI — ${rt.plan} plan returns in AMFI's ${sub} table, as of ${rt.as_of}.`
        : amfi && peer
          ? `AMFI's performance table does not list this fund, so its 1/3/5-year returns are calculated from its own daily NAV (AMFI NAV history), as of ${rt.as_of}.`
          : "Calculated from the fund's own daily NAV (AMFI NAV history) — AMFI's performance table does not cover it.",
    url: amfi && !peer && !rt.calculated_from_nav ? amfiSourceUrl(rt, s) || AMFI_PAGE : NAV_PAGE,
  });

  out.push({
    row: benchmarkLabel,
    detail: [
      s.benchmark_origin ? `Benchmark identified: ${s.benchmark_origin}.` : null,
      amfi && !peer && !rt.benchmark_from_series
        ? `1/3/5-year returns as reported to AMFI by the fund house (same table and date as the fund).`
        : series
          ? `1/3/5-year returns calculated from ${series.series} daily values (${series.provider})${amfi ? `, on ${rt.as_of} — the same date as the fund` : ""}.`
          : "1/3/5-year returns calculated from the benchmark's daily values.",
      rt && rt.benchmark_corrections
        ? `Corrected: the fund house reported ${Object.entries(rt.benchmark_corrections.windows)
            .map(([k, v]) => `${{ "1y": "1-year", "3y": "3-year", "5y": "5-year", since_inception: "since-launch" }[k] || k} ${v.reported.toFixed(1)}%`)
            .join(", ")} for its benchmark, which the index's own values (${rt.benchmark_corrections.series}) do not support; the figure${
            Object.keys(rt.benchmark_corrections.windows).length > 1 ? "s" : ""
          } calculated from the index ${Object.keys(rt.benchmark_corrections.windows).length > 1 ? "are" : "is"} shown instead.`
        : null,
    ]
      .filter(Boolean)
      .join(" "),
    url:
      amfi && !peer && !rt.benchmark_from_series
        ? amfiSourceUrl(rt, s) || AMFI_PAGE
        : s.benchmark_used_name
          ? indexSourceUrl(s.benchmark_used_name, anniversaries(amfi ? rt.as_of : s.nav_date), benchmarkLabel)
          : series
            ? series.url
            : null,
  });

  if (amfi && rows.some((r) => r.category !== null)) {
    out.push({
      row: rt.category_label || `${sub} avg`,
      detail: rt.calculated_from_nav
        ? `Calculated by the app: the plain average of the returns of every Regular-plan Growth fund in the ${sub} category, each from its own NAV up to ${rt.as_of} (${countText(rt.category_count)}).`
        : `Calculated by the app: the plain average of the Regular-plan returns of ${
            rt.category_label ? "every fund in AMFI's table with the same benchmark" : `every fund in AMFI's ${sub} table`
          } on ${rt.as_of} (${countText(rt.category_count)}).`,
      url: rt.calculated_from_nav ? NAV_PAGE : amfiSourceUrl(rt, s) || AMFI_PAGE,
    });
  }

  const bc = s.benchmark_comparison;
  if (yourRow && bc && bc.source) {
    out.push({
      row: yourRow.label,
      detail: `Calculated by the app on your own investment dates: each amount you invested is put into ${bc.benchmark_name} at that day's value from ${bc.source.series} (${bc.source.provider}), valued on ${bc.end_date}.`,
      url:
        indexSourceUrl(
          bc.data_source,
          [...(bc.flows || []).map((f) => f.date), bc.end_date].filter(Boolean),
          bc.benchmark_name
        ) || bc.source.url,
    });
  }
  return out;
}

function relation(gap, name) {
  if (Math.abs(gap) < 0.05) return `level with ${name}`;
  return `${Math.abs(gap).toFixed(1)} points a year ${gap > 0 ? "ahead of" : "behind"} ${name}`;
}

// Line 1 — how the fund itself has done: its longest published window against the benchmark and
// the category average (the same figures as the table), or, failing that, the investor's own dates.
// Line 1 — leads with the investor's OWN result (the same money and dates as the card's headline
// XIRR / return), then the fund's own longest published record against its benchmark and category.
// Leading with the fund's 5-year record alone read as contradicting a negative headline XIRR.
export function performanceLine(table) {
  const y = table.yourRow;
  let yours = null;
  if (y) {
    const xirr = y.label.startsWith("Your XIRR");
    const gap = y.fund - y.benchmark;
    const size = Math.abs(gap);
    const how = size < 0.05 ? "level with it" : `${size.toFixed(1)} point${size.toFixed(1) === "1.0" ? "" : "s"}${xirr ? " a year" : ""} ${gap > 0 ? "ahead" : "behind"}`;
    yours = xirr
      ? `Your XIRR is ${pct(y.fund)} against ${pct(y.benchmark)} for ${y.benchmarkLabel} on the same SIP dates — ${how}`
      : `Your return is ${pct(y.fund)} against ${pct(y.benchmark)} for ${y.benchmarkLabel} over the same period — ${how}`;
  }
  const row = [...table.rows].reverse().find((r) => r.benchmark !== null);
  let fund = null;
  if (row) {
    const parts = [relation(row.fund - row.benchmark, table.benchmarkLabel)];
    if (row.category !== null) parts.push(relation(row.fund - row.category, "the category average"));
    fund = `${row.label.toLowerCase()} the fund itself returned ${pct(row.fund)}${row.key === "1y" ? "" : " a year"} — ${parts.join(" and ")}`;
  }
  if (yours && fund) return `${yours}. Over ${fund}.`;
  if (yours) return `${yours}.`;
  if (fund) return `Over ${fund}.`;
  return "Not enough published return history yet to compare this fund with its benchmark.";
}

const CONCERN_PHRASES = {
  return: "your investment is currently worth less than you put in",
  benchmark: "it has substantially trailed its benchmark",
  track_record: "its longer-term record is weak against its benchmark",
};
const STRENGTH_PHRASES = {
  benchmark: "it has kept pace with or beaten its benchmark",
  track_record: "it has a consistently good longer-term record",
  risk: "its returns have been good for the risk taken",
};
const BLOCKER_PHRASES = {
  benchmark_slightly_behind: "it is slightly behind its benchmark",
  track_record_uneven: "its longer-term record is uneven",
  track_record_behind: "the fund's own longer-term record is behind its benchmark",
  risk: "its returns have not fully compensated for the risk taken",
  // The same-dates comparison (your own purchase dates) could not be made; the fund's published
  // 1/3/5-year record against its benchmark is still in the table and still judged.
  no_benchmark: "a comparison on your own investment dates could not be made this time",
  no_track_record: "it does not have enough history yet",
};
const list = (items) => (items.length <= 1 ? items[0] || "" : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

// Line 2 — why the badge, from the classifier's own evidence (never re-derived), in one sentence.
export function badgeLine(ev, periodPhrase) {
  const { badge, concerns = [], strengths = [], strongBlockers = [], holdingPeriodStatus } = ev;
  const held = periodPhrase ? ` (held ${periodPhrase})` : "";
  if (badge === "TOO EARLY TO JUDGE") return `Too early to judge${held} — a holding this new reflects only recent market movement.`;
  if (badge === "PROMISING START") return `Promising start${held}, but too early to judge the fund on your own holding yet.`;
  if (holdingPeriodStatus === "new_good_record") {
    return `Rated ON TRACK — not judged on your short holding${held}; the fund's own longer-term record has kept pace with its benchmark.`;
  }
  if (holdingPeriodStatus === "new") return `Rated ON TRACK${held} — too early to judge fully, and the investment is not down.`;
  if (badge === "STRONG") {
    const why = strengths.map((k) => STRENGTH_PHRASES[k]).filter(Boolean);
    return `Rated STRONG: ${why.length ? list(why) : "no meaningful negative signal"}.`;
  }
  if (badge === "ON TRACK") {
    const why = strongBlockers.map((k) => BLOCKER_PHRASES[k]).filter(Boolean);
    return why.length ? `Rated ON TRACK rather than STRONG: ${list(why)}.` : "Rated ON TRACK: no meaningful concern.";
  }
  const why = concerns.map((k) => CONCERN_PHRASES[k]).filter(Boolean);
  const extra = strongBlockers.filter((k) => k === "risk").map((k) => BLOCKER_PHRASES[k]);
  return `Rated ${badge}: ${list([...why, ...extra]) || "it has lagged on the evidence available"}.`;
}
