export function round2(n) {
  return n === null || n === undefined ? null : Math.round(n * 100) / 100;
}

function topEntry(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1])[0];
}

export function fmtIndianRupees(n) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

const ILLUSTRATIVE_INVESTMENT_AMOUNT = 100000; // "₹1 lakh" — a fixed, round example amount used
// purely to make a return % tangible ("₹1 lakh would have grown to ₹X"), not a real holding.

// Per explicit fix: risk level must come from the scheme's SEBI riskometer, not a value THIS APP
// computes from its own trailing volatility/beta/drawdown — a fund's real riskometer is a
// regulatory disclosure, not this app's opinion, and a short-term volatility blip (a single sharp
// day in an otherwise steady category) must never rank a fund as riskier than one whose real
// mandate is genuinely riskier. Confirmed live: HDFC Mid Cap (SEBI: Very High) was showing
// "Medium" — lower than SBI Gold's "High" — purely because gold's own trailing volatility window
// happened to be choppier than mid-cap equity's over that particular stretch.
//
// This is a real, publicly disclosed, industry-standard mapping (every AMC's own factsheet/SID
// states its scheme's riskometer, and these map to the well-established SEBI category norms from
// SEBI's Oct-2020 riskometer circular and its subsequent updates) — not this app's own guess, and
// not a live per-scheme feed (no free, bulk, scheme-code-keyed riskometer API exists to fetch the
// odd case where one AMC set its own scheme's dial a notch off the category norm; this is the
// same "closest defensible real proxy" approach already used for AUM/TER-adjacent gaps elsewhere
// in this app).
//
// scheme_category here is the RAW AMFI category text (e.g. "Equity Scheme - Mid Cap Fund",
// "Hybrid Scheme - Arbitrage Fund") — confirmed live, NOT calc-service's separately-normalized
// "Mid Cap"/"Arbitrage" label (a different field this report doesn't carry). Matched the same way
// calc-service's own fund_universe_service.CATEGORY_NAME_PATTERNS/DEBT_CATEGORY_PATTERNS classify
// it: case-insensitive substring, most-specific pattern first, so "large & mid cap" is checked
// before the more general "mid cap" can wrongly claim it.
const SEBI_RISKOMETER_PATTERNS = [
  // Equity — every diversified equity category is Very High per SEBI's post-2021 riskometer norms.
  ["large & mid cap", "Very High"],
  ["large and mid cap", "Very High"],
  ["large cap", "Very High"],
  ["mid cap", "Very High"],
  ["microcap", "Very High"],
  ["micro cap", "Very High"],
  ["small cap", "Very High"],
  ["flexi cap", "Very High"],
  ["multi cap", "Very High"],
  ["focused fund", "Very High"],
  ["value fund", "Very High"],
  ["contra fund", "Very High"],
  ["dividend yield", "Very High"],
  ["sectoral", "Very High"],
  ["thematic", "Very High"],
  ["elss", "Very High"],
  // Commodity — Gold/Silver ETF FoFs are standardly disclosed as High, not Very High. Checked
  // before the debt-keyword patterns below since AMFI's own category text for these is often
  // generic ("Other Scheme - FoF Domestic", no "gold"/"debt" substring at all) — this is why
  // riskometerLevel matches against the scheme's NAME too, not just its category (see below).
  ["gold", "High"],
  ["silver", "High"],
  ["commodity", "High"],
  // Hybrid — differs meaningfully by real equity exposure, never one flat "Hybrid" level.
  ["aggressive hybrid", "Very High"],
  ["balanced hybrid", "High"],
  ["balanced advantage", "Very High"],
  ["dynamic asset allocation", "Very High"],
  ["multi asset", "Very High"],
  ["equity savings", "Moderately High"],
  ["conservative hybrid", "Moderately High"],
  ["arbitrage", "Low to Moderate"],
  // Debt — by real interest-rate/credit risk of the sub-category, never one flat "Debt" level.
  ["overnight", "Low"],
  ["liquid", "Low to Moderate"],
  ["money market", "Low to Moderate"],
  ["ultra short", "Low to Moderate"],
  ["low duration", "Low to Moderate"],
  ["short duration", "Moderate"],
  ["short term", "Moderate"],
  ["medium to long", "Moderate"],
  ["medium duration", "Moderate"],
  ["medium term", "Moderate"],
  ["long duration", "Moderate"],
  ["long term", "Moderate"],
  ["corporate bond", "Moderate"],
  ["banking and psu", "Moderate"],
  ["banking & psu", "Moderate"],
  ["gilt", "Moderate"],
  ["dynamic bond", "Moderate"],
  ["dynamic term", "Moderate"],
  ["floater", "Moderate"],
  ["floating", "Moderate"],
  ["credit risk", "Moderately High"],
  // A Specialized Investment Fund is mandated to carry the highest available riskometer label.
  ["specialized investment fund", "Very High"],
  // Checked LAST (lowest priority): AMFI's bare "Other Scheme - Index Funds" category (confirmed
  // live — Motilal Oswal Nifty Microcap 250 Index Fund carries exactly this generic text, no
  // "microcap"/"equity" substring at all) doesn't say which index it tracks. Every real index fund
  // this app has seen tracks an equity index (the microcap/equity patterns above already catch
  // those where the category OR name names the index) — this is the honest fallback for the rest,
  // never reached if any more specific pattern above already matched.
  ["index fund", "Very High"],
];

// category — the scheme's own AMFI category text. schemeName — its full scheme name, checked
// too (and given priority via a first pass) because several real AMFI categories are too generic
// to reveal the real asset class on their own ("Other Scheme - FoF Domestic" for a Gold FoF,
// "Other Scheme - Index Funds" for an equity index fund) while the scheme's own NAME says it
// plainly ("SBI GOLD FUND...", "...Nifty Microcap 250 Index Fund..."). Category is still checked
// (and wins if it matches something the name doesn't) for schemes whose name is less descriptive
// than their category, e.g. "HDFC Mid Cap Fund" already matches on category text just as well.
// null (never a guessed level) when neither string is recognized — matching this app's
// "no fabricated number" rule everywhere else.
export function riskometerLevel(category, schemeName) {
  const combined = `${category || ""} ${schemeName || ""}`.trim();
  if (!combined) return null;
  const lowered = combined.toLowerCase();
  for (const [pattern, level] of SEBI_RISKOMETER_PATTERNS) {
    if (lowered.includes(pattern)) return level;
  }
  return null;
}

// Below this many days held, a fund's raw cumulative absolute_return_pct isn't fairly comparable
// against avgReturn (which mixes in funds held for years) — confirmed live: a fund started ~2
// months ago, up a genuinely solid 1.6% for that short a window, was being classified NEEDS
// MONITORING purely because 1.6% looks small next to a portfolio average pulled up by
// multi-year holdings. ~6 months is enough for the earliest, noisiest NAV swings to settle
// without being so long that a real early problem (see the negative-return check below, which
// still applies regardless of duration) goes unflagged.
const MIN_DAYS_FOR_UNDERPERFORMANCE_JUDGEMENT = 180;

// Roughly 1-3 months — a fund this new with a positive return gets its own distinct, encouraging
// label ("PROMISING START") rather than the more neutral "ON TRACK", per explicit user direction:
// a small positive return this early should read as an encouraging early sign, clearly marked as
// too soon to call long-term performance, not just silently folded into the same bucket as an
// established fund quietly meeting expectations.
const PROMISING_START_MAX_DAYS = 90;

// The ONE constant for "too early to judge at all", regardless of return sign — used everywhere
// this badge is decided or described (the badge engine below, the PDF legend, the Gemini prompt,
// the recommendation engine, the narrative validator, and every test) per explicit correction:
// never a second, differently-valued threshold hiding in another component. A genuinely fresh
// position (a 1-day, 2-day, or one-week-old holding) has no real history at all — not even enough
// for an encouraging PROMISING START read, let alone a confident negative one. Confirmed live: a
// 1-day-old holding, down by a trivial amount purely from day-1 NAV/rounding noise, was being
// classified UNDERPERFORMING — an unconditional negative-return check ran before ANY "is this too
// new to judge" check could apply. This threshold is checked FIRST, before any return-based logic,
// precisely to close that gap: at this age, a negative number is exactly as unreliable as a
// positive one, so neither is treated as real evidence yet. Past this many days (8+), the normal
// badge ladder always runs — there is no other, wider "still too early" exception anywhere else.
export const TOO_EARLY_MAX_DAYS = 7;

// Whole days between first_investment_date (an ISO date string, or null) and asOfDate — null
// when there's no first_investment_date to measure from. Exported so callers building the
// Gemini-facing JSON can also report holding_period_months as a real, honest number rather than
// leaving Gemini to guess it from a date it was never asked to do arithmetic on.
//
// Per explicit correction: asOfDate must be the fund's own latest published NAV date (calc-
// service's nav_date), never the wall-clock moment the report happens to be generated. The
// PREVIOUS reasoning here (kept below, struck through in spirit) argued wall-clock was more
// honest about "how long has this investor actually been holding this fund" — but that conflates
// two different questions. current_value, XIRR, and every benchmark comparison this report shows
// are all PRICED as of the NAV date — there is no real data for the days between the NAV date and
// whenever the report happens to be generated. Using wall-clock "now" for the day count (and for
// calc-service's own XIRR end date — see main.py's _default_as_of_date) silently credits the
// investment with growing during days it has no priced value for at all: a report run 3 days after
// the last published NAV was showing 1,110 days held and an XIRR dated 3 days later than the NAV
// that XIRR's own final cash flow was actually valued at — an internal inconsistency, not just a
// cosmetic one. Every date-derived figure in this report (days held, XIRR's end date, the
// benchmark comparison window) must share the SAME as-of date the money was actually priced at:
// the NAV date.
export function daysHeld(firstInvestmentDate, asOfDate = new Date()) {
  if (!firstInvestmentDate) return null;
  const calendarDay = (value) => {
    if (typeof value === "string") {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      const [, year, month, day] = match.map(Number);
      const time = Date.UTC(year, month - 1, day);
      const parsed = new Date(time);
      return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
        ? Math.floor(time / 86_400_000)
        : null;
    }
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.floor(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) / 86_400_000);
  };

  const startDay = calendarDay(firstInvestmentDate);
  const endDay = calendarDay(asOfDate);
  return startDay === null || endDay === null ? null : endDay - startDay;
}

// The holding period the BADGE judges a fund on: from when the material share of its capital was
// invested (calc-service's evaluation_start_date — a small early purchase does not move it back)
// to the NAV date. Falls back to the first investment when calc-service had no purchase data.
// Every badge call site uses this, so one fund is never judged on two different periods.
export function badgeHeldDays(scheme) {
  return daysHeld(scheme.evaluation_start_date || scheme.first_investment_date, scheme.nav_date ? new Date(scheme.nav_date) : undefined);
}

// A precomputed, exact plain-English holding period ("around 17 months", "around 6 years") for
// Gemini to copy verbatim rather than paraphrase — confirmed live: left to describe holding
// duration itself, it routinely fell back to vague qualifiers like "a long holding period" or
// "the multi-year holding duration" with no actual number attached, which is exactly the wording
// the user asked to never see. Months under 24 stay in months (a "2 year" fund described in years
// alone would round away meaningful precision for anything under ~20 months); 24 and over convert
// to whole years, since stating "31 months" instead of "around 3 years" reads as needlessly
// precise for a multi-year holding. Null when holding_period_months itself is null (no known
// first_investment_date) — Gemini's own rules already cover stating "unavailable" for that case.
// Days under a month are stated as DAYS. Rounding them into months produced a flatly false
// statement: 3 days became "around 1 month", because Math.round(3 / 30.44) is 0 and the
// Math.max(1, ...) floor then pushed it up to one. A 3-day-old holding described as a month old
// misrepresents the one fact that matters most about it — how little time it has actually had.
const DAYS_PER_MONTH = 30.44;
const EXACT_DAYS_BELOW_MONTHS = 1;

export function formatHoldingPeriod(months) {
  if (months === null || months === undefined) return null;
  if (months < EXACT_DAYS_BELOW_MONTHS) {
    // Recovered from the same constant the caller divided by, so this is the real day count.
    const days = Math.max(1, Math.round(months * DAYS_PER_MONTH));
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (months < 24) {
    const rounded = Math.round(months);
    return `around ${rounded} month${rounded === 1 ? "" : "s"}`;
  }
  const years = Math.round(months / 12);
  return `around ${years} year${years === 1 ? "" : "s"}`;
}

// "1,825 days (~5 years)" — the exact compact stat-grid form the Top Performing Review's mandatory
// "Investment Period" field uses (never a substitute for formatHoldingPeriod's own "around N years"
// prose wording elsewhere, which stays load-bearing for Gemini's rule 19 — this is a distinct,
// tighter register for a labeled stat row, not a sentence). Null only when heldDays itself is null
// (no known first_investment_date) — never a guessed period.
export function formatInvestmentPeriodStat(heldDays) {
  if (heldDays === null || heldDays === undefined) return null;
  const months = heldDays / DAYS_PER_MONTH;
  // Under a month the day count IS the period — repeating it as "(~1 months)" was both wrong and
  // ungrammatical ("3 days (~1 months)" appeared on a real card).
  if (months < EXACT_DAYS_BELOW_MONTHS) {
    return `${heldDays.toLocaleString("en-IN")} day${heldDays === 1 ? "" : "s"}`;
  }
  const approx = months < 24 ? `~${Math.round(months)} month${Math.round(months) === 1 ? "" : "s"}` : `~${Math.round(months / 12)} years`;
  return `${heldDays.toLocaleString("en-IN")} day${heldDays === 1 ? "" : "s"} (${approx})`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// calc-service's calendar-aware {years, months, days} (see investment_history.py) — never days / 30.
// "2 years 11 months 27 days".
export function formatCalendarDuration(duration) {
  if (!duration) return null;
  const { years = 0, months = 0, days = 0 } = duration;
  const parts = [];
  if (years) parts.push(plural(years, "year"));
  if (months) parts.push(plural(months, "month"));
  if (days || parts.length === 0) parts.push(plural(days, "day"));
  return parts.join(" ");
}

// The short reading of the same duration, as the PDF shows it: whole years and months only
// ("2 years 11 months", "1 year 5 months") — no days, no rounding. Under a month, the days.
export function approxCalendarDuration(duration) {
  if (!duration) return null;
  const { years = 0, months = 0, days = 0 } = duration;
  const parts = [];
  if (years) parts.push(plural(years, "year"));
  if (months) parts.push(plural(months, "month"));
  return parts.length ? parts.join(" ") : plural(days, "day");
}

export function fmtHistoryDate(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// Sharpe ratio divides mean excess return by return volatility — for a near-risk-free instrument
// (a liquid/overnight fund, or a short-duration debt fund) that denominator is close to zero, so
// small, meaningless day-to-day return noise gets amplified into an extreme Sharpe value with no
// real signal in it. Confirmed live: Parag Parikh Liquid Fund (0.01% daily volatility) computed a
// Sharpe of -11.27, and Canara Robeco Corporate Bond Fund (0.07%) computed -1.13 — both drove a
// REVIEW REQUIRED classification for funds actually posting perfectly reasonable returns for
// their category (+15.5% and +29.4%). Below this volatility, Sharpe is numerically unreliable and
// treated the same as if it were unavailable (null) — never used as either a positive or negative
// signal — rather than trusted at face value.
const MIN_VOLATILITY_FOR_RELIABLE_SHARPE = 0.001;

export function reliableSharpe(sharpe, volatility) {
  if (sharpe === null || sharpe === undefined) return null;
  if (volatility !== null && volatility !== undefined && volatility < MIN_VOLATILITY_FOR_RELIABLE_SHARPE) return null;
  return sharpe;
}

// Sharpe is a SUPPORTING signal only from here on — never sufficient by itself to set a fund's
// final status (see classifyFundPerformance below for the full reasoning/regression history: a
// real fund with a strong absolute return and a badly negative Sharpe used to be forced straight
// to UNDERPERFORMING, and a merely-decent-but-not-spectacular positive Sharpe used to silently
// block STRONG/ON TRACK, regardless of how the fund actually did against its own benchmark).
// These four bands are purely descriptive — a plain-language bucket for the narrative to draw on
// (see riskAdjustedNarrativeClause), not a threshold that gates any badge on its own.
export function sharpeSignal(sharpeValue) {
  if (sharpeValue === null || sharpeValue === undefined) return null;
  if (sharpeValue < 0) return "negative";
  if (sharpeValue < 0.5) return "modest";
  if (sharpeValue < 1.0) return "good";
  return "strong";
}

// THE one benchmark-difference calculation for this whole app, in percentage points:
//
//     benchmark_difference = fund_return - benchmark_return
//
// Positive means the fund outperformed its benchmark, negative means it underperformed. Every
// consumer goes through here — the badge ladder (classifyFundPerformance), the "why this badge"
// wording (fundStatusReason), the deterministic recommendation (recommendationFor's caller), the
// recommendations JSON, the report-consistency gate, and the PDF's own displayed stat — so a fund
// can never be judged on one number while being shown another.
//
// Both inputs are already measured over the SAME period for the same fund (calc-service computes
// fund_return_pct and benchmark_return_pct from one shared window — see main.py's per-scheme
// benchmark block), so this subtraction never mixes timeframes. Neither side is annualized:
// fund_return_pct is a cumulative/absolute return and benchmark_return_pct is the index's
// cumulative move over that same span. XIRR is deliberately NOT used here — it is an annualized
// rate, and subtracting it from a cumulative index return would compare two different things.
//
// Previously this returned calc-service's Jensen's alpha whenever it was available — a
// beta-adjusted, risk-free-rate-adjusted figure that is a genuinely different quantity from the
// plain difference, and one a reader cannot reproduce from the two returns printed beside it.
// Per explicit user request this is now the straight difference for every fund, every portfolio
// and every benchmark type. The `alpha` argument is still accepted (and ignored) so callers that
// pass it keep working; calc-service still computes and reports its own alpha field unchanged.
//
// null when either side is missing — never guessed, and never derived from category-peer averages,
// which are a different, non-market comparison (see judgingCategoryKey).
export function benchmarkGapPct(alpha, fundReturnPct, benchmarkReturnPct) {
  if (fundReturnPct !== null && fundReturnPct !== undefined && benchmarkReturnPct !== null && benchmarkReturnPct !== undefined) {
    return fundReturnPct - benchmarkReturnPct;
  }
  return null;
}

// Per explicit request: every tunable number behind the badge ladder, in ONE place — change a
// value here and every badge/narrative sentence that reads it (via the aliases just below, or
// directly) updates consistently; nothing in this file keeps a second, separately-calibrated copy.
export const BADGE_THRESHOLDS = {
  // A benchmark shortfall this size (percentage points, PER YEAR after annualizing — see
  // annualizedBenchmarkGapPct) counts as a real, sustained underperformance rather than ordinary
  // week-to-week/month-to-month tracking noise around an index. -3 is wide enough that a merely-
  // trailing fund isn't flagged, narrow enough that a genuine multi-year drag still is.
  materialBenchmarkGapPct: -3,
  // The annualized reference rate a fund's own trailing-window track record is bucketed against
  // when AMFI reports no benchmark returns for it (trackRecordSignal's fallback). It no longer
  // excuses a material benchmark shortfall: per explicit instruction that is a concern on its own.
  healthyAnnualizedReturnPct: 8,
  // Per explicit fix: a negative absolute return during a broad market decline must not, by
  // itself, count as a concern when the fund's alpha is positive — it beat its benchmark, it just
  // fell less than the market did. 0 means "any real outperformance, however small, is enough";
  // raise it (e.g. to 2) to require a more comfortable margin before excusing a negative return.
  negativeReturnAlphaCarveOutPct: 0,
  // A trailing window (1y/3y/5y/since launch) counts as keeping pace with the fund's benchmark when
  // the fund is at most this many points a year behind it — about an active fund's own expense
  // ratio. Every relevant window must keep pace for a "strong" track record; see trackRecordSignal.
  trackRecordKeepsPaceGapPct: -1,
  // Wording only: a gap (percentage points, annualized where the period allows) smaller than this
  // either way is "slightly" ahead/behind; from here to materialBenchmarkGapPct it is plain
  // "behind"; past that it is "substantially behind". Never decides a badge.
  slightGapWordingPct: 1,
};

// The fund-vs-benchmark gap the report states and judges by, from calc-service's validated
// benchmark_comparison: annualized (CAGR for one purchase, XIRR for several) when the period is at
// least a year, otherwise cumulative. null when there is no comparison or it failed validation —
// an unvalidated comparison is never described or used.
export function comparisonGap(bc) {
  if (!bc || !bc.valid) return null;
  if (bc.annualized_gap !== null && bc.annualized_gap !== undefined) return { gap: bc.annualized_gap, basis: "annualized" };
  if (bc.cumulative_gap !== null && bc.cumulative_gap !== undefined) return { gap: bc.cumulative_gap, basis: "cumulative" };
  return null;
}

// "outperformed" / "been ahead of" / "been slightly behind" / "been behind" / "been substantially
// behind" — chosen from the gap's own size and sign, so a large gap is never called "slight" and a
// fund behind its index is never said to have kept pace with it.
export function gapPhrase(gap) {
  const slight = BADGE_THRESHOLDS.slightGapWordingPct;
  if (gap >= 3) return "outperformed";
  if (gap >= slight) return "been ahead of";
  if (gap >= 0) return "been slightly ahead of";
  if (gap > -slight) return "been slightly behind";
  if (gap > BADGE_THRESHOLDS.materialBenchmarkGapPct) return "been behind";
  return "been substantially behind";
}

// Calendar-aware whole years/months/days between two ISO dates (same rule as calc-service's
// investment_history.calendar_duration) — never days / 30.
export function calendarDuration(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const [sy, sm, sd] = String(startIso).slice(0, 10).split("-").map(Number);
  const [ey, em, ed] = String(endIso).slice(0, 10).split("-").map(Number);
  if (![sy, sm, sd, ey, em, ed].every(Number.isFinite)) return null;
  const addMonths = (months) => {
    const index = sm - 1 + months;
    const year = sy + Math.floor(index / 12);
    const month = (index % 12) + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return Date.UTC(year, month - 1, Math.min(sd, lastDay));
  };
  const end = Date.UTC(ey, em - 1, ed);
  if (end < Date.UTC(sy, sm - 1, sd)) return null;
  let total = (ey - sy) * 12 + (em - sm);
  if (addMonths(total) > end) total -= 1;
  const days = Math.round((end - addMonths(total)) / 86_400_000);
  return { years: Math.floor(total / 12), months: total % 12, days };
}

// Rule: an explanation may never contradict the numbers it sits beside. If the fund trails the
// benchmark it cannot be said to have outperformed, beaten or kept pace with it; if it is ahead it
// cannot be said to be behind it. Returns the contradictions found (empty when consistent).
export function explanationContradictions(text, bc, benchName) {
  const found = comparisonGap(bc);
  if (!found || !text || !benchName) return [];
  const name = String(benchName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const errors = [];
  if (found.gap < 0 && new RegExp(`(outperformed|beaten|kept pace with|been ahead of|been slightly ahead of)\\s+${name}`, "i").test(text)) {
    errors.push(`says the fund is level with or ahead of ${benchName}, but the ${found.basis} gap is ${found.gap.toFixed(2)} points`);
  }
  if (found.gap > 0 && new RegExp(`behind\\s+${name}`, "i").test(text)) {
    errors.push(`says the fund is behind ${benchName}, but the ${found.basis} gap is +${found.gap.toFixed(2)} points`);
  }
  return errors;
}

// The riskEvidence fields every badge call site adds, so the PDF, the dashboard, the Gemini input
// and the recommendations JSON all judge a fund on the same validated comparison and the same dates.
export function comparisonEvidence(s) {
  return {
    ...(Object.prototype.hasOwnProperty.call(s, "benchmark_comparison") ? { benchmarkComparison: s.benchmark_comparison } : {}),
    heldSince: s.evaluation_start_date || s.first_investment_date || null,
    navDate: s.nav_date || null,
    firstInvestmentDate: s.first_investment_date || null,
  };
}

// A factual statement of how the fund has done against its benchmark — what the report says in
// place of an action. Per explicit instruction the report never tells the investor to hold, buy,
// increase, reduce or switch; that decision is theirs and their adviser's.
export function benchmarkStatementFor(bSignal, returnPct) {
  switch (bSignal) {
    case "outperformance":
      return "The fund has outperformed its benchmark.";
    case "competitive":
      return "The fund has been level with or ahead of its benchmark.";
    case "slight_underperformance":
      return returnPct !== null && returnPct !== undefined && returnPct > 0
        ? "The fund's return is positive but below its benchmark."
        : "The fund has been below its benchmark.";
    case "material_underperformance":
      return "The fund has substantially lagged its benchmark; its benchmark-relative performance requires review.";
    default:
      return "No validated benchmark comparison is available for this fund.";
  }
}

// The benchmark signal for a scheme — from its validated comparison when calc-service supplied one
// (every real report), else the older inputs (kept for callers and tests that predate it).
export function schemeGapSignal(s) {
  if (s && Object.prototype.hasOwnProperty.call(s, "benchmark_comparison")) {
    return benchmarkSignal(comparisonGap(s.benchmark_comparison)?.gap ?? null);
  }
  return schemeBenchmarkSignal(s.fund_return_pct, s.benchmark_return_pct, s.alpha_beta_window_days, metricKindFor(s));
}

// -3 percentage points chosen as a materially meaningful benchmark shortfall — wide enough that
// ordinary week-to-week/month-to-month tracking noise around a benchmark doesn't read as "real"
// underperformance, but not so wide that a genuine, sustained shortfall gets waved through.
const MATERIAL_BENCHMARK_GAP_PCT = BADGE_THRESHOLDS.materialBenchmarkGapPct;

// The gap re-expressed as a PER-YEAR rate, purely for deciding which band it falls in.
//
// The bands below (-3 / 0 / +3) are calibrated as annual rates, but a fund's displayed gap is not
// always annual: a Live SIP's card shows XIRR (already per-year), while every other card shows a
// CUMULATIVE return spanning its whole holding. Bucketing both with one -3 cutoff judged them on
// wildly different scales — confirmed live: Axis Midcap trailing by 5.78pp cumulative over 3.2
// years (just -1.37pp/yr) was labelled "material underperformance" and dropped to WATCH, while the
// 8-year SIP beside it would have needed to lag ~26pp cumulative to earn the same label.
//
// Annualizing is strictly monotonic, so the SIGN can never flip: a fund ahead of its benchmark
// cumulatively is ahead per-year too. The displayed alpha therefore always still agrees in
// direction with the badge and the wording — only the severity threshold is put on one footing.
export function annualizedBenchmarkGapPct(fundReturnPct, benchmarkReturnPct, windowDays, metricKind = "absolute") {
  if (fundReturnPct === null || fundReturnPct === undefined) return null;
  if (benchmarkReturnPct === null || benchmarkReturnPct === undefined) return null;
  const rawGap = fundReturnPct - benchmarkReturnPct;
  // Already a per-year rate (Live SIP, judged by XIRR) — nothing to convert.
  if (metricKind === "xirr") return rawGap;
  const years = windowDays ? windowDays / 365 : null;
  // Under a year, a cumulative return IS roughly its own annual rate; annualizing a stub period
  // would wildly inflate it (a -2% gap over one month is not a -24%/yr shortfall).
  if (!years || years <= 1) return rawGap;
  // A total loss (or worse) has no real compound rate — fall back to the raw gap rather than
  // taking a fractional power of a negative number.
  if (fundReturnPct <= -100 || benchmarkReturnPct <= -100) return rawGap;
  const annualize = (pct) => ((1 + pct / 100) ** (1 / years) - 1) * 100;
  return annualize(fundReturnPct) - annualize(benchmarkReturnPct);
}

export function benchmarkSignal(gapPct) {
  if (gapPct === null || gapPct === undefined) return null;
  if (gapPct <= MATERIAL_BENCHMARK_GAP_PCT) return "material_underperformance";
  if (gapPct < 0) return "slight_underperformance";
  if (gapPct < 3) return "competitive";
  return "outperformance";
}

// The ONE benchmark-relative verdict every consumer must derive from — the badge ladder, the
// recommendation, the prose clause beside it, and the consistency guard that polices the two.
// It exists because benchmarkSignal's bands are per-year bands: handing it a raw CUMULATIVE gap
// (as several call sites used to) judges a 3-year holding on a 3-year total against a threshold
// meant for one year's shortfall, so the same fund could be "material underperformance" here and
// "slight" in the badge — the exact badge-vs-wording contradiction this report must never show.
// Every caller passes the fund's own window and metric kind, so one fund yields one verdict
// everywhere it is mentioned.
export function schemeBenchmarkSignal(fundReturnPct, benchmarkReturnPct, windowDays, metricKind = "absolute") {
  return benchmarkSignal(annualizedBenchmarkGapPct(fundReturnPct, benchmarkReturnPct, windowDays, metricKind));
}

// Calmar ratio: return per unit of the fund's own worst real drawdown — a THIRD, independent
// risk-adjusted measure alongside Sharpe/Sortino, computed from data this app already has
// (fund_return_pct, max_drawdown), so a fund's classification never rests on Sharpe alone even
// when Sortino happens to be unavailable. Same numeric bands as Sharpe/Sortino reused via
// sharpeSignal below — not a rigorously separate calibration, but a defensible, transparent
// approximation given all three measure the same underlying idea (reward per unit of pain).
// MIN_DRAWDOWN_FOR_RELIABLE_CALMAR_PCT guards the same near-zero-denominator blowup
// MIN_VOLATILITY_FOR_RELIABLE_SHARPE guards for Sharpe — a fund with a near-zero real drawdown
// (a liquid/near-cash fund) would otherwise produce a meaninglessly huge or tiny ratio.
const MIN_DRAWDOWN_FOR_RELIABLE_CALMAR_PCT = 1;

export function calmarRatio(fundReturnPct, maxDrawdownPct) {
  if (fundReturnPct === null || fundReturnPct === undefined) return null;
  if (maxDrawdownPct === null || maxDrawdownPct === undefined) return null;
  if (Math.abs(maxDrawdownPct) < MIN_DRAWDOWN_FOR_RELIABLE_CALMAR_PCT) return null;
  return fundReturnPct / Math.abs(maxDrawdownPct);
}

const RATIO_SIGNAL_SCORE = { negative: -1, modest: 0, good: 1, strong: 2 };
const SCORE_TO_RATIO_SIGNAL = ["negative", "modest", "good", "strong"];

// Combines Sharpe, Sortino, and Calmar into ONE honest risk-adjusted signal for NARRATION — each
// of the (up to three) available ratios is bucketed with sharpeSignal's own bands (they're the
// same shape: reward per unit of risk), then averaged and snapped to the nearest band. This is
// purely descriptive — a single available ratio's own honest reading (even "negative") is never
// hidden or reworded here; what changes is that classifyFundPerformance's badge logic never trusts
// a bare "negative" from this bucket alone — see riskSignalIsCorroboratedNegative below, the
// ONLY thing that may gate a badge. null when none of the three ratios could be computed at all.
export function combinedRiskSignal(sharpeValue, sortinoValue, calmarValue) {
  const signals = [sharpeSignal(sharpeValue), sharpeSignal(sortinoValue), sharpeSignal(calmarValue)].filter((s) => s !== null);
  if (signals.length === 0) return null;
  const avgScore = signals.reduce((sum, s) => sum + RATIO_SIGNAL_SCORE[s], 0) / signals.length;
  const idx = Math.max(0, Math.min(3, Math.round(avgScore + 1)));
  return SCORE_TO_RATIO_SIGNAL[idx];
}

// The ONLY question classifyFundPerformance's downgrade mechanics are allowed to ask of the risk
// ratios — per explicit correction, no single ratio (Sharpe or otherwise) may ever gate a badge by
// itself. True only when a real MAJORITY of the ratios that are actually available agree it's
// negative: ALL of them when just one or two are available (a lone negative Sharpe with no Sortino
// or Calmar to corroborate it is NOT enough), or at least two of three when all three are — a
// single noisy ratio can never be decisive on its own, regardless of how negative it reads.
export function riskSignalIsCorroboratedNegative(sharpeValue, sortinoValue, calmarValue) {
  const signals = [sharpeSignal(sharpeValue), sharpeSignal(sortinoValue), sharpeSignal(calmarValue)].filter((s) => s !== null);
  if (signals.length < 2) return false;
  const negativeCount = signals.filter((s) => s === "negative").length;
  return negativeCount / signals.length > 0.5;
}

// The ONE, single source of truth for a fund's recommendation action — computed deterministically
// from its already-computed fund_status (never re-derived or independently chosen by Gemini). Per
// explicit correction: there must be exactly one place a fund's classification-derived label comes
// from, and every section of the report (the PDF card, the portfolio-level summary, Gemini's own
// "reason" text) must use THIS SAME value — never a second, independently-reasoned one that could
// silently disagree with the badge it's supposed to match. Values are the exact six strings
// geminiClient.js's RECOMMENDATION_VALUES declares (see that file — not imported here to avoid a
// circular import between the two modules; verificationJson.test.js asserts they can never drift
// apart). riskSignal/benchmarkSignal are the SAME combinedRiskSignal/benchmarkSignal buckets
// already computed for risk_adjusted_summary — pass null for either when not available, same as
// that call already does.
export function recommendationFor(fundStatusValue, riskSignal, benchmarkSignal) {
  switch (fundStatusValue) {
    case "STRONG":
      // Only the STRONGEST, most corroborated case (good/strong risk-adjusted evidence, or real
      // benchmark outperformance) earns the more assertive "Increase allocation" — a merely
      // decent STRONG (e.g. a modest Sharpe alone) stays at "Continue holding", never inflated
      // into an "increase" suggestion by one favorable-looking number alone.
      return riskSignal === "good" || riskSignal === "strong" || benchmarkSignal === "outperformance"
        ? "Increase allocation"
        : "Continue holding";
    case "ON TRACK":
      return "Maintain current allocation";
    case "WATCH":
      return "Avoid adding more money";
    case "NEEDS ATTENTION":
      // A genuinely negative (corroborated) risk-adjusted signal alongside real lagging evidence
      // is worth actively comparing alternatives; a milder NEEDS ATTENTION (return-driven alone)
      // is still just "avoid adding more for now", not yet "go compare other funds".
      return riskSignal === "negative" ? "Compare alternatives" : "Avoid adding more money";
    case "UNDERPERFORMING":
      return "Compare alternatives";
    case "PROMISING START":
    case "TOO EARLY TO JUDGE":
      return "Continue holding & review later";
    default:
      return "Continue holding";
  }
}

// Per explicit user request: "Suggested Actions" must name which REAL fund to increase allocation
// into and which to avoid adding money to, grounded in that fund's own already-computed data (the
// same fund_status/return_percentage/holding_period/long_term_track_record already shown on its
// own card) — never invented, never left to Gemini's own judgment. Built entirely deterministically
// from each fund's OWN recommendation (see recommendationFor above, the same one source of truth
// used everywhere else) rather than asking Gemini to re-derive which funds qualify, for the same
// reason recommendation itself is given rather than chosen: a fund-level "which one" call is
// exactly the kind of judgment this app no longer lets the LLM make on its own.
function fundLevelSuggestionEvidence(fund) {
  // Always "a return", never "an XIRR", because the number this sentence goes on to print is
  // return_percentage — which is the plain absolute return for EVERY fund, Live SIP included.
  // Branching the label on judged_by (as this used to) attached the word "XIRR" to a figure that
  // isn't one: a Live SIP fund up 85.6% in total on a 14.8% XIRR was described as "an XIRR of
  // 85.59%" — a real number under the wrong name, off by a factor of six. The badge beside it
  // still carries the XIRR-based verdict; only the cited figure is labelled for what it is.
  const metricLabel = "a return";
  const periodClause = fund.holding_period_formatted ? `, held for ${fund.holding_period_formatted}` : "";
  const ltr = fund.long_term_track_record || {};
  // Longest available real window first — a 5-year (or since-inception) number is a more meaningful
  // "past performance over time" citation than a shorter one, when both exist.
  const trackWindow =
    ltr.return_5y_percentage != null
      ? ["5-year", ltr.return_5y_percentage]
      : ltr.return_3y_percentage != null
        ? ["3-year", ltr.return_3y_percentage]
        : ltr.return_1y_percentage != null
          ? ["1-year", ltr.return_1y_percentage]
          : ltr.return_since_inception_percentage != null
            ? ["since-inception", ltr.return_since_inception_percentage]
            : null;
  const trackClause = trackWindow ? `, with a ${trackWindow[0]} track record of ${trackWindow[1]}%` : "";
  return `${fund.name} — ${fund.fund_status}, ${metricLabel} of ${fund.return_percentage}%${periodClause}${trackClause}`;
}

// Sorted by real strength rather than left in arbitrary portfolio order — confirmed necessary
// live: the PDF's Suggested Actions section can only ever show a handful of items (a deliberate,
// page-length-derived cap — see pdfReport.js's INSIGHT_BLOCK_MAX_ITEMS), so for a portfolio with
// many qualifying funds, whichever ones happen to survive that cap should be the most convincing
// case on each side (the strongest performer to increase into, the weakest to avoid), not whatever
// order they happened to appear in the uploaded file.
export function buildFundLevelSuggestions(funds) {
  const increase = [];
  const avoid = [];
  for (const f of funds || []) {
    if (f.recommendation === "Increase allocation") {
      increase.push(f);
    } else if (f.recommendation === "Avoid adding more money" || f.recommendation === "Compare alternatives") {
      avoid.push(f);
    }
  }
  increase.sort((a, b) => b.return_percentage - a.return_percentage);
  avoid.sort((a, b) => a.return_percentage - b.return_percentage);
  return {
    increase: increase.map((f) => `${fundLevelSuggestionEvidence(f)} — consider increasing allocation here.`),
    avoid: avoid.map((f) => `${fundLevelSuggestionEvidence(f)} — avoid adding more money here for now.`),
  };
}

// The exact three combinations the house style has settled on verbatim — kept as literal strings
// so the common cases read naturally rather than as an obviously templated mail-merge sentence.
// Every other combination falls through to the generic combiner below, which is still honest and
// grounded in the real sSignal/bSignal buckets, just less polished prose.
const RISK_NARRATIVE_CLAUSES = {
  "negative:material_underperformance": "Risk-adjusted performance has been weak and the fund has lagged its benchmark.",
  "negative:slight_underperformance": "Risk-adjusted performance has been weak and the fund has been a little behind its benchmark.",
  "modest:competitive": "Risk-adjusted returns have been modest, while the fund remains competitive with its benchmark.",
  "strong:outperformance": "The fund has delivered solid returns relative to the risk taken and has outperformed its benchmark.",
};

const SHARPE_SIGNAL_PHRASE = {
  negative: "Risk-adjusted performance has been weak",
  modest: "Risk-adjusted returns have been modest",
  good: "Risk-adjusted returns have been good",
  strong: "The fund has delivered solid returns relative to the risk taken",
};

const BENCHMARK_SIGNAL_CLAUSE = {
  material_underperformance: "the fund has lagged its benchmark",
  slight_underperformance: "the fund has been a little behind its benchmark",
  competitive: "the fund remains competitive with its benchmark",
  outperformance: "the fund has outperformed its benchmark",
};

// The one place this report ever states a risk-adjusted verdict in prose — grounded entirely in
// the real, calculated sSignal/bSignal buckets (never Sharpe alone, never a raw number, never a
// jargon term like "Sharpe" or "alpha" — matching this app's existing no-jargon house style).
// null when there's no real evidence at all to describe (both signals unavailable) — silence
// instead of a fabricated claim, same principle as every other "not available" branch in this app.
export function riskAdjustedNarrativeClause(sSignal, bSignal) {
  if (!sSignal && !bSignal) return null;
  const literal = RISK_NARRATIVE_CLAUSES[`${sSignal}:${bSignal}`];
  if (literal) return literal;
  // A "weak" (negative Sharpe) claim is never stated from Sharpe alone, with no real benchmark
  // data to back it up — the same restraint classifyFundPerformance applies to the BADGE also
  // applies to what this report SAYS; a bare negative Sharpe reading isn't corroborated evidence
  // on its own. The more favorable buckets (modest/good/strong) carry lower risk of being unfair
  // and are fine to state without benchmark corroboration.
  const sharpePhrase = sSignal === "negative" && !bSignal ? null : SHARPE_SIGNAL_PHRASE[sSignal] || null;
  const benchmarkClause = BENCHMARK_SIGNAL_CLAUSE[bSignal] || null;
  if (sharpePhrase && benchmarkClause) return `${sharpePhrase}, and ${benchmarkClause}.`;
  if (sharpePhrase) return `${sharpePhrase}.`;
  if (benchmarkClause) return `On a benchmark-relative basis, ${benchmarkClause}.`;
  return null;
}

// A STRONG fund must clear a genuinely strong return in its own right, not just "beats a shrinking
// or negative category average by 15%" — confirmed live: a fund up only +1.0% earned this badge
// because its one real category peer was down -1.3%, dragging the average to roughly -0.15% (115%
// of a negative number is an even MORE negative bar to clear).
//
// This is an ANNUALIZED reference rate — the same 8%/year this app already used (and users have
// already seen) as its flat floor for a roughly 1-year holding. Kept as the calibration point
// rather than replaced, so nothing changes at the 1-year mark; see strongFloorFor below for how it
// now extends to every OTHER holding period instead of applying flat regardless of how long a fund
// has actually been held.
const STRONG_ANNUALIZED_RATE_PCT = BADGE_THRESHOLDS.healthyAnnualizedReturnPct;

// The time-appropriate bar a fund's OWN metric must clear to earn STRONG, given how long it's
// actually been held. Metric-kind aware, per this app's main rule that Live SIP (judged by XIRR)
// and One-Time Purchase (judged by Absolute Return) can never share one performance methodology:
//
//   - "xirr": XIRR is already an annualized rate by construction — a 5-year SIP's XIRR and a
//     6-month SIP's XIRR are already on the same footing, so the floor stays flat at
//     STRONG_ANNUALIZED_RATE_PCT regardless of heldDays. What genuinely changes with holding
//     period for a Live SIP is STRICTNESS, not the floor itself — see classifyFundPerformance's
//     grace window for a fund too new to trust yet, and the ON TRACK/WATCH bars below for how a
//     long-held fund's XIRR is judged with no such leniency once that grace period has passed.
//
//   - "absolute": a cumulative return is NOT already time-normalized — it mechanically grows just
//     from more time passing, so a flat percentage floor doesn't mean the same thing at 3 months as
//     it does at 5 years. Confirmed live as this app's own previously-accepted limitation ("8%
//     cumulative over 3 years is weak, 8% over 3 months is excellent") — this compounds
//     STRONG_ANNUALIZED_RATE_PCT over the fund's REAL holding period instead of applying it flat,
//     so "was this return appropriate for how long the money was invested" is answered from real
//     elapsed time rather than accepted as a known gap. heldDays defaults to 365 (the original
//     flat-8% calibration point) only when it's genuinely unknown — never used to invent a fake
//     holding period for a fund whose real one IS known.
function strongFloorFor(metricKind, heldDays) {
  if (metricKind === "xirr") return STRONG_ANNUALIZED_RATE_PCT;
  const years = Math.max(heldDays === null || heldDays === undefined ? 365 : heldDays, 1) / 365;
  return (Math.pow(1 + STRONG_ANNUALIZED_RATE_PCT / 100, years) - 1) * 100;
}

// Deterministic, rule-based status label from real numbers — computed here, not by Gemini, so
// the AI never invents or varies a judgment call it can't be checked against (see the "never
// invent a rating" rule already enforced for risk_level, same principle). Gemini's job is to
// state this status and explain why, never to decide it itself.
//
// hasCategoryPeers: whether at least one OTHER fund in this portfolio shares this fund's category
// (see categoryFundCounts below) — confirmed live: a fund alone in its own category (common in a
// small portfolio) has avgReturn fall back to its own return, making "beat the average by 15%"
// compare the fund to itself — mathematically impossible for a positive return, so a real +10.8%
// standout could never earn GOOD PERFORMER just for having no peer to be measured against. When
// there's no real peer, the relative comparison is skipped entirely and the absolute floor alone
// decides — that's a real, meaningful bar on its own, not skipped by default.
//
// Holding-period tiers decide which of the fund's own trailing-return windows (1y/3y/5y/
// since_inception — see trailing_returns.py, independent of this investor's own purchase timing)
// count as relevant supporting evidence for GOOD PERFORMER — see hasConsistentHistoricalSupport.
// A fund newly held has no real multi-year story YET for this investor; a fund held years has a
// real multi-year story that a single recent number can't fairly summarize either way.
const SHORT_HOLDING_MAX_DAYS = 365; // under 1 year
const MEDIUM_HOLDING_MAX_DAYS = 365 * 3; // 1-3 years; 3+ years is "long"

// Whether the fund's own trailing_returns consistently SUPPORT a GOOD PERFORMER verdict for THIS
// investor's actual holding period — a real gap the flat 8% floor used to miss entirely: a fund
// held 7+ years cleared the floor by just over a point on the investor's own XIRR (9.17%) and
// still earned GOOD PERFORMER, even though its own 1-year (5.56%) and 5-year (5.14%) track
// records were both clearly weaker, while its 3-year (11.24%) and since-inception (12.98%) were
// genuinely strong — mixed evidence a single flat threshold can't see at all.
//
// Deliberately NOT an average of 1y/3y/5y/since_inception — those windows overlap (the 3-year
// window's own last year IS the 1-year window; 5 years of a since-inception series double- and
// triple-counts the same underlying years) — averaging them would double-count the same real
// performance multiple times over, not add independent evidence. Instead, only the windows that
// actually matter for how long THIS investor has held the fund must ALL clear the SAME existing
// 8% floor (never a new number):
//   - Short holding (< 1yr): only the 1-year window is required (when available) — nothing longer
//     has happened yet for this investor.
//   - Medium holding (1-3yr): the 1-year AND 3-year windows are both required (when available).
//   - Long holding (3yr+): the 3-year, 5-year, and since-inception windows are required (when
//     available) — 1-year is deliberately excluded from the requirement here: a single strong
//     recent year must never paper over persistent multi-year weakness, and a single weak recent
//     year must never override a genuinely strong multi-year record either.
// A window missing from the fund's own real history (e.g. no 5-year data for a newer fund) is
// simply excluded from the check, never counted as a failure. No trailingReturns at all (null) —
// or none of the relevant windows for this holding tier being available — means there's no real
// evidence to contradict the investor's own primary metric with, so the check passes by default.
// Which of the fund's OWN trailing-return windows (1y/3y/5y/since_inception — see
// trailing_returns.py, independent of this investor's own purchase timing) are relevant evidence
// for how long THIS investor has actually held it. Exported so pdfReport.js's Top Performing
// Review can cite the exact same windows in its "past performance" text that the badge itself was
// actually judged against — never a different, arbitrarily-picked window than the one that
// mattered to the verdict.
function relevantWindowNames(heldDays) {
  return heldDays === null || heldDays === undefined || heldDays < SHORT_HOLDING_MAX_DAYS
    ? ["1y"]
    : heldDays < MEDIUM_HOLDING_MAX_DAYS
      ? ["1y", "3y"]
      : ["3y", "5y", "since_inception"];
}

export function relevantTrailingWindows(heldDays, trailingReturns) {
  if (!trailingReturns) return [];
  return relevantWindowNames(heldDays)
    .map((window) => ({ window, value: trailingReturns[window] }))
    .filter((w) => w.value !== null && w.value !== undefined);
}

// The same windows, each paired with the fund's official benchmark over that window, both exactly
// as the fund house reports them to AMFI (calc-service's reported_trailing_returns) — one source and
// one date for both sides, so the gap is like-for-like. Empty when AMFI has no figures for the fund
// (index funds, ETFs, FoFs), and the track record then falls back to the flat healthy-return bar.
export function benchmarkRelativeWindows(heldDays, reportedTrailing) {
  if (!reportedTrailing || !reportedTrailing.fund || !reportedTrailing.benchmark_returns) return [];
  return relevantWindowNames(heldDays)
    .map((window) => ({ window, value: reportedTrailing.fund[window], benchmark: reportedTrailing.benchmark_returns[window] }))
    .filter((w) => w.value !== null && w.value !== undefined && w.benchmark !== null && w.benchmark !== undefined)
    .map((w) => ({ ...w, gap: w.value - w.benchmark }));
}

// Past performance as a real, first-class classification input — not just reassurance text. Three
// states, not a bare true/false: "strong" (every relevant window at or above the STRONG bar),
// "weak" (every relevant window well BELOW it — genuinely poor, not just uneven), or "mixed"
// (neither — some windows strong, some not). null when there's no real trailing-return evidence
// for the windows that matter at this holding period at all (never fabricated).
export function trackRecordSignal(heldDays, trailingReturns, reportedTrailing = null) {
  // Judged against the fund's own benchmark wherever AMFI reports both sides. A flat 8% bar called
  // PGIM India Midcap's record "consistently strong" (3y 9.4%, 5y 8.7%) while Nifty Midcap 150 TRI
  // returned 14.4% and 15.3% over the same years — Value Research rates it 1 star.
  const relative = benchmarkRelativeWindows(heldDays, reportedTrailing);
  if (relative.length > 0) {
    if (relative.every((w) => w.gap >= BADGE_THRESHOLDS.trackRecordKeepsPaceGapPct)) return "strong";
    // Same two-window corroboration as the absolute rule below, and never "weak" while any window
    // still kept pace with the index.
    const materiallyBehind = relative.filter((w) => w.gap <= BADGE_THRESHOLDS.materialBenchmarkGapPct);
    if (materiallyBehind.length >= 2 && relative.every((w) => w.gap < BADGE_THRESHOLDS.trackRecordKeepsPaceGapPct)) return "weak";
    return "mixed";
  }
  const available = relevantTrailingWindows(heldDays, trailingReturns);
  if (available.length === 0) return null;
  if (available.every((w) => w.value >= STRONG_ANNUALIZED_RATE_PCT)) return "strong";
  // "weak" requires at least TWO independent windows agreeing — a single noisy window (e.g. just
  // the 1-year one, the only thing required for a short holding) is never enough evidence to call
  // the whole track record weak. Same asymmetric caution as everywhere else in this fix: an
  // unfavorable reading needs real corroboration; a favorable one ("strong" above) doesn't.
  if (available.length >= 2 && available.every((w) => w.value < STRONG_ANNUALIZED_RATE_PCT * 0.5)) return "weak";
  return "mixed";
}

// The fund's own record for a holding too short to judge on its own: 1-, 3- and 5-year returns
// against the official benchmark as reported to AMFI, or — without AMFI figures — the fund's own
// returns against the healthy-return bar. strong when every available window kept pace. Null when
// no window is available.
const SHORT_HOLDING_RECORD_WINDOWS = ["1y", "3y", "5y"];

export function shortHoldingRecord(trailingReturns, reportedTrailing) {
  const relative =
    reportedTrailing && reportedTrailing.fund && reportedTrailing.benchmark_returns
      ? SHORT_HOLDING_RECORD_WINDOWS.map((window) => ({
          window,
          value: reportedTrailing.fund[window],
          benchmark: reportedTrailing.benchmark_returns[window],
        }))
          .filter((w) => Number.isFinite(w.value) && Number.isFinite(w.benchmark))
          .map((w) => ({ ...w, gap: w.value - w.benchmark }))
      : [];
  // Decided on the longer record (3 and 5 years wherever reported); the latest year may trail a
  // little but never materially.
  const longer = (windows) => (windows.some((w) => w.window !== "1y") ? windows.filter((w) => w.window !== "1y") : windows);
  if (relative.length > 0) {
    const long = longer(relative);
    return {
      relative: true,
      benchmark: reportedTrailing.benchmark || null,
      windows: relative,
      strong:
        long.every((w) => w.gap >= BADGE_THRESHOLDS.trackRecordKeepsPaceGapPct) &&
        relative.every((w) => w.gap > BADGE_THRESHOLDS.materialBenchmarkGapPct),
      beatAll: long.every((w) => w.gap >= 0),
    };
  }
  const absolute = SHORT_HOLDING_RECORD_WINDOWS.map((window) => ({ window, value: trailingReturns?.[window] })).filter((w) =>
    Number.isFinite(w.value)
  );
  if (absolute.length === 0) return null;
  return { relative: false, windows: absolute, strong: longer(absolute).every((w) => w.value >= STRONG_ANNUALIZED_RATE_PCT) };
}

function hasConsistentHistoricalSupport(heldDays, trailingReturns) {
  const signal = trackRecordSignal(heldDays, trailingReturns);
  return signal === null || signal === "strong";
}

export function windowLabel(window) {
  return { "1y": "1-year", "3y": "3-year", "5y": "5-year", since_inception: "since-inception" }[window] || window;
}

// The five real performance tiers, worst to best — deliberately NOT "positive return = ON TRACK":
// every tier above UNDERPERFORMING requires clearing a bar that's scaled to how long the fund has
// actually been held (see strongFloorFor) AND, where a real peer exists, how it compares to that
// peer — never the raw return number judged in isolation. PROMISING START is a separate, sixth
// label handled outside this ladder entirely (see classifyFundPerformance) — it's a "too early to
// judge" flag, not a performance verdict, so it never appears in this ordered list.
export const PERFORMANCE_BADGES = ["STRONG", "ON TRACK", "WATCH", "NEEDS ATTENTION", "UNDERPERFORMING"];

// The single source of truth both fundStatus and fundStatusReason build on — computed ONCE here so
// the badge a fund is given and the prose explaining it can never contradict each other (the two
// used to be separate, hand-duplicated branch trees; this closes that gap for good). Returns the
// badge plus whatever intermediate numbers fundStatusReason needs to narrate the SAME verdict
// (never re-derived, so the explanation can't drift from the decision it's explaining).
//
// metricKind — "xirr" for a Live SIP fund (judged by its annualized XIRR) or "absolute" for a
// One-Time Purchase (judged by cumulative Absolute Return) — this app's central rule that the two
// must never share one performance methodology. Defaults to "absolute" only for callers that
// haven't been updated to pass it explicitly; every real call site in this codebase does.
//
// riskEvidence — { sortino, alpha, fundReturnPct, benchmarkReturnPct, maxDrawdown }, all
// optional/nullable — the fund's own risk-adjusted/benchmark-relative numbers (see calc-service's
// alpha.py/sortino_ratio.py, and max_drawdown already computed elsewhere), entirely independent of
// returnPct (which is the INVESTOR's own return — XIRR for a Live SIP, Absolute Return otherwise).
// This keeps the two families of evidence structurally separate: returnPct (and XIRR specifically)
// never feeds into riskSignal/bSignal below, and riskSignal/bSignal never feed into which return
// figure judges the fund — see the module-level regression test for this exact separation.
//
// Per explicit correction: no SINGLE metric — not Sharpe, not any other one number — may, by
// itself, determine a fund's final status. This function combines NINE real inputs, never fewer:
// (1) the fund's own return, (2) the benchmark's own return, (3) the benchmark-relative gap
// (alpha), (4) Sharpe, (5) Sortino, (6) a Calmar-style return/drawdown ratio, (7) volatility (via
// reliableSharpe's own zero-variance guard), (8) max drawdown (feeds Calmar), and (9) the holding
// period (both directly, via strongFloorFor/the grace-period checks below, and indirectly, via
// which trailing-return windows count as this investor's relevant track record). The tier the
// fund's OWN return/peer-comparison numbers would earn on their own (the ladder below) is always
// computed FIRST; risk-adjusted evidence (combinedRiskSignal — Sharpe+Sortino+Calmar together,
// requiring real agreement, never one alone) and the fund's own past-performance track record can
// only pull that down afterward, one real, named reason at a time, and only when there's
// corroborating evidence — never from a single noisy number.
function classifyFundPerformance(returnPct, sharpe, avgReturn, heldDays, volatility, hasCategoryPeers, trailingReturns, metricKind = "absolute", riskEvidence = {}) {
  const { sortino = null, alpha = null, fundReturnPct = null, benchmarkReturnPct = null, windowReturnPct = null, benchmarkWindowDays = null, maxDrawdown = null, currentPnlPct = returnPct, reportedTrailing = null } = riskEvidence;
  // calc-service's validated comparison, when supplied (every real report): the one gap the badge
  // and its explanation are decided by. Older callers without it keep the previous inputs.
  const usesComparison = Object.prototype.hasOwnProperty.call(riskEvidence, "benchmarkComparison");
  // A live SIP's comparison over under 90 days is shown on the card (XIRR to XIRR, per explicit
  // request) but an annualized gap from a few weeks is not evidence, so it never moves the badge.
  const comparison =
    usesComparison && !riskEvidence.benchmarkComparison?.short_period ? comparisonGap(riskEvidence.benchmarkComparison) : null;
  const sharpeValue = reliableSharpe(sharpe, volatility);
  const sortinoValue = reliableSharpe(sortino, volatility);
  const calmarValue = calmarRatio(windowReturnPct !== null && windowReturnPct !== undefined ? windowReturnPct : fundReturnPct, maxDrawdown);
  // The gate the badge logic actually uses — a bare negative reading from any ONE ratio (Sharpe or
  // otherwise) is never enough alone (see riskSignalIsCorroboratedNegative's own comment). The
  // honest, uncollapsed bucket (combinedRiskSignal) is computed separately in fundStatusReason,
  // purely for narration — the badge here never reads it directly.
  const riskIsCorroboratedNegative = riskSignalIsCorroboratedNegative(sharpeValue, sortinoValue, calmarValue);
  // The honest, uncollapsed bucket — used below only to recognise genuinely GOOD risk-adjusted
  // performance as positive evidence. It never downgrades: that is riskIsCorroboratedNegative's job.
  const riskSignal = combinedRiskSignal(sharpeValue, sortinoValue, calmarValue);
  const gapPct = usesComparison ? comparison?.gap ?? null : benchmarkGapPct(alpha, fundReturnPct, benchmarkReturnPct);
  // Bucketed on the per-year gap (CAGR or XIRR, computed by calc-service) wherever the period
  // allows, so every card faces the same bar; the cumulative gap only under a year.
  const bSignal = usesComparison
    ? benchmarkSignal(gapPct)
    : schemeBenchmarkSignal(fundReturnPct, benchmarkReturnPct, benchmarkWindowDays, metricKind);
  const trackRecord = trackRecordSignal(heldDays, trailingReturns, reportedTrailing);

  // THE structured record of what the classifier actually saw and decided. Every customer-facing
  // sentence is generated from this object and nothing else, so the explanation can never describe
  // a fund differently from the way it was judged. Statuses are deliberately three-valued: a
  // signal is positive, negative, or GENUINELY UNAVAILABLE — and unavailable is never narrated as
  // either good news or bad news, because missing data is not evidence.
  const evidence = (badge, { concerns = [], strengths = [], strongBlockers = [], holdingPeriodStatus = null, tooEarly = false } = {}) => ({
    badge,
    concerns,
    strengths,
    strongBlockers,
    // The one signal that most explains this badge — what the sentence must lead with.
    primaryReason: concerns[0] ?? strongBlockers[0] ?? null,
    secondaryReasons: concerns.length > 1 ? concerns.slice(1) : strongBlockers.slice(1),
    benchmarkStatus: bSignal,
    // "weak" ONLY when risk genuinely contributed to the badge — never merely because a ratio is
    // below zero. This is the exact value the narration may call weak, and nothing else.
    riskStatus: riskIsCorroboratedNegative && riskSignal === "negative" ? "weak" : riskSignal,
    trackRecordStatus: trackRecord,
    holdingPeriodStatus:
      holdingPeriodStatus ??
      (heldDays === null || heldDays === undefined
        ? null
        : heldDays <= PROMISING_START_MAX_DAYS
          ? "very_new"
          : heldDays < MIN_DAYS_FOR_UNDERPERFORMANCE_JUDGEMENT
            ? "new"
            : "established"),
    tooEarly,
  });

  // The ONE, single threshold for TOO EARLY TO JUDGE — checked BEFORE anything else, unconditional
  // on return sign. Per explicit correction: there must be exactly one constant for this
  // (TOO_EARLY_MAX_DAYS), used everywhere this badge is decided or described — never a second,
  // wider "still kind of too early if the return is negative" threshold hiding elsewhere. A holding
  // this fresh has no real evidence either way, so even an outright negative number here must
  // never read as UNDERPERFORMING (see TOO_EARLY_MAX_DAYS's own comment for the real regression
  // this closes). At 8+ days, the normal badge ladder below always runs — a negative real return
  // past this point is never "too early", it's genuinely evidence (see the very next comment for
  // how that evidence is weighed without over-trusting an annualized rate).
  if (heldDays !== null && heldDays !== undefined && heldDays <= TOO_EARLY_MAX_DAYS) {
    return evidence("TOO EARLY TO JUDGE", { holdingPeriodStatus: "too_early" });
  }

  // A fund still fresh (under 3 months) but past the too-early window gets its own distinct,
  // encouraging flag rather than being folded into the performance ladder at all — ONLY when it's
  // genuinely non-negative in real terms (currentPnlPct, never the annualized judged metric —
  // a real loss is never "promising" just because it's new). See the "short history" regression
  // tests.
  if (heldDays !== null && heldDays !== undefined && heldDays <= PROMISING_START_MAX_DAYS && currentPnlPct >= 0) {
    return evidence("PROMISING START", { holdingPeriodStatus: "very_new" });
  }
  // Past that, but still under 6 months AND still real-terms non-negative — genuinely too early
  // for the harsher tiers below (WATCH/NEEDS ATTENTION), so this stays a grace-period ON TRACK,
  // same "too soon to fully judge" principle. A NEGATIVE currentPnlPct at this age does NOT get
  // this grace — per explicit correction, a genuinely small real loss (e.g. -2.3% over 58 days)
  // must never be softened by mislabeling it "too early" either; it proceeds to the real ladder
  // just below, same as an older fund's negative return does, landing at NEEDS ATTENTION (not
  // UNDERPERFORMING — that still requires real corroborated evidence, never the sign alone) unless
  // real evidence escalates it further. This is what keeps a 58/111-day fund's small real loss from
  // ever reading as either "too early to say" OR a confident "UNDERPERFORMING" — it gets an honest,
  // real, single verdict from the SAME ladder every other fund goes through.
  if (heldDays !== null && heldDays !== undefined && heldDays < MIN_DAYS_FOR_UNDERPERFORMANCE_JUDGEMENT && currentPnlPct >= 0) {
    return evidence("ON TRACK", { holdingPeriodStatus: "new", tooEarly: true });
  }
  // A small loss over days or weeks is not judged against the investor, per explicit request, when
  // the fund's own record is good: it has kept pace with its benchmark over its 1-, 3- and 5-year
  // records (see shortHoldingRecord). It is ON TRACK, and the explanation says the holding is too
  // short to judge. A fund without that record still goes through the ladder below.
  if (
    heldDays !== null &&
    heldDays !== undefined &&
    heldDays < MIN_DAYS_FOR_UNDERPERFORMANCE_JUDGEMENT &&
    shortHoldingRecord(trailingReturns, reportedTrailing)?.strong
  ) {
    return evidence("ON TRACK", { holdingPeriodStatus: "new_good_record", tooEarly: true });
  }

  // ---------------------------------------------------------------------------------------------
  // EVIDENCE-BASED CLASSIFICATION
  //
  // Per explicit instruction, the badge answers "how well is this fund actually performing?" and
  // NOT "did it clear an 8%/yr target?". The previous implementation compared the fund's return
  // against a floor of 8%/yr compounded over the holding period, with 70%/35% of that floor as the
  // ON TRACK/WATCH lines. That floor is deliberately gone: it downgraded genuinely good funds for
  // missing an arbitrary rate — a 9-year holding that BEAT its benchmark and scored good on risk
  // was labelled WATCH purely for compounding at 5.8%/yr instead of 6.1%/yr, a verdict no real
  // evidence about the fund supported.
  //
  // Four independent pieces of real evidence decide it instead. Each may be null (genuinely
  // unavailable), and a null is never counted as either good or bad news:
  //   1. the investor's own realized return (XIRR for a live SIP, total return otherwise —
  //      including IDCW payouts, see profit_loss),
  //   2. the fund's own multi-window track record (1y/3y/5y/since-inception),
  //   3. the benchmark comparison, on a like-for-like basis (see schemeBenchmarkSignal),
  //   4. risk-adjusted performance (Sharpe + Sortino + Calmar together).
  //
  // A "concern" is a clearly identifiable negative signal, never a merely unexceptional one. Risk
  // in particular only counts when it is corroborated across the ratios that are actually
  // available (riskSignalIsCorroboratedNegative) — a single weak ratio never downgrades a fund,
  // and merely "modest" risk-adjusted returns are not a concern at all.
  const returnIsNegative = returnPct !== null && returnPct !== undefined && returnPct < 0;
  // Per explicit fix: a negative absolute return during a broad market decline must not, by
  // itself, count as a concern when the fund beat its benchmark (gapPct positive) — it means the
  // fund fell LESS than the market did, a genuine positive signal even though the headline number
  // is still negative. gapPct is the plain fund-minus-benchmark difference (see benchmarkGapPct),
  // not the annualized band bSignal buckets — the raw sign is what "did it beat its benchmark"
  // actually asks, regardless of how large the margin is.
  const negativeReturnExcusedByAlpha =
    returnIsNegative && gapPct !== null && gapPct !== undefined && gapPct > BADGE_THRESHOLDS.negativeReturnAlphaCarveOutPct;


  // PRIMARY concerns — each is a direct statement about how the investment has actually done, and
  // any one of them is enough on its own to hold a fund back.
  // The investor's own money on their own dates is the deciding evidence: when it is level with or
  // ahead of the benchmark, the fund's weaker published 1/3/5-year record (and a weak risk ratio,
  // below) only keeps it out of STRONG — they are not concerns. Per explicit instruction (Oct 2026):
  // a Tata Small Cap SIP 2.6 points a year AHEAD of its index on the same SIP dates must read ON TRACK,
  // not NEEDS ATTENTION, though the fund's own 1y/3y returns trailed the index.
  const investorAheadOfBenchmark = bSignal === "outperformance" || bSignal === "competitive";
  const concerns = [];
  if (returnIsNegative && !negativeReturnExcusedByAlpha) concerns.push("return");
  // A material, sustained shortfall against the fund's own benchmark is a concern on its own. Per
  // explicit instruction a fund is never ON TRACK merely because its return clears a fixed 8% a year
  // while it substantially trails its benchmark (the earlier "healthy return forgives the gap" rule,
  // which kept PGIM India Midcap ON TRACK 8 points a year behind its index, is gone). Slightly
  // trailing the index is not a concern; it only keeps a fund out of STRONG (strongBlockers below).
  if (bSignal === "material_underperformance") concerns.push("benchmark");
  // "mixed" is uneven, not bad — only a genuinely weak record across the windows that matter for
  // this holding period counts against the fund.
  if (trackRecord === "weak" && !investorAheadOfBenchmark) concerns.push("track_record");

  // Per explicit fix: this classifier no longer compares the investor's realized XIRR against the
  // fund's own trailing CAGR (formerly "realized_return" here). That comparison conflated two
  // genuinely different things — how well the FUND performed vs. how the INVESTOR's own entry
  // timing happened to land within it — and penalized a fund for a gap that isn't the fund's own
  // performance at all (a lump-sum entering right before a downturn earns a lower XIRR than the
  // fund's own trailing CAGR through no fault of the fund's). The benchmark-relative concern above
  // and the track-record concern below are the real, fund-attributable signals this ladder judges.

  // Risk-adjusted performance is SUPPORTING evidence, deliberately not a primary concern: per
  // explicit instruction it may not independently decide a badge, and a single weak ratio must
  // never downgrade a fund. Two things make that essential rather than cosmetic here. The ratios
  // are measured over a trailing ~1-year window, so in any broadly down year most funds print a
  // negative Sharpe regardless of their long-run quality; and a bare majority sitting a hair below
  // zero is not "clearly and consistently negative". So the honest combined bucket must ALSO read
  // negative, not merely modest. Confirmed live: without both guards, funds that beat their
  // benchmark over 9 years with consistently strong track records were being marked WATCH purely
  // on a recent-window ratio — the exact downgrade-a-good-fund behaviour this rewrite removes.
  // Nor does it count when the investor's own money is level with or ahead of the benchmark on the
  // same dates: a negative ratio then reflects a weak market year, not the fund. Confirmed live: a
  // small-cap SIP 2.6 points a year AHEAD of its index was marked NEEDS ATTENTION because the risk
  // ratio over a flat small-cap year stacked onto its trailing-record concern.
  const riskIsAConcern = riskSignal === "negative" && riskIsCorroboratedNegative && !investorAheadOfBenchmark;

  // UNDERPERFORMING requires MULTIPLE meaningful negative signals to agree — never one metric on
  // its own, however bad that one metric looks.
  const severity = concerns.length + (riskIsAConcern && concerns.length > 0 ? 1 : 0);
  const allConcerns = riskIsAConcern && concerns.length > 0 ? [...concerns, "risk"] : concerns;
  // Two signals are enough when they are THESE two: a material, sustained benchmark shortfall and
  // genuinely weak risk-adjusted performance describe the same failure from different directions —
  // the fund lost to its index while taking real risk to do it — so they corroborate each other
  // rather than merely accumulating. A genuinely strong long-run record still buys the fund out of
  // the most severe label, capping it one tier short at NEEDS ATTENTION.
  const corroboratedFailure =
    bSignal === "material_underperformance" && riskIsAConcern && trackRecord !== "strong";
  if (severity >= 3 || corroboratedFailure) return evidence("UNDERPERFORMING", { concerns: allConcerns });
  if (severity === 2) return evidence("NEEDS ATTENTION", { concerns: allConcerns });
  if (severity === 1) return evidence("WATCH", { concerns: allConcerns });

  // No concerns at all. STRONG is the top of a two-tier split, and it requires the evidence that
  // IS available to be genuinely positive — not merely the absence of bad news.
  const strengths = [];
  if (bSignal === "outperformance" || bSignal === "competitive") strengths.push("benchmark");
  if (trackRecord === "strong") strengths.push("track_record");
  if (riskSignal === "good" || riskSignal === "strong") strengths.push("risk");

  // Anything short of "competitive" (i.e. slightly behind) keeps a fund at ON TRACK: real, if
  // minor, benchmark lag is exactly the "one area only moderate rather than strong" case.
  const benchmarkSupportsStrong = bSignal === null || bSignal === "outperformance" || bSignal === "competitive";
  const trackRecordSupportsStrong = trackRecord === null || trackRecord === "strong";
  // Deliberately NOT a requirement that risk be good/strong: per explicit instruction risk may not
  // independently decide a badge unless it is clearly and consistently negative — which, at this
  // point, it is not (that case already returned above as a concern).
  // STRONG needs positive evidence about PERFORMANCE specifically — beating/keeping pace with the
  // benchmark, or a consistently strong own record. Good risk-adjusted ratios alone are not enough:
  // they measure how efficiently a return was earned, not whether the return itself was good, so a
  // barely-positive fund with no benchmark and no track record to its name lands at ON TRACK (no
  // concerns, but nothing established either) rather than being called STRONG by default.
  const performanceCorroborated = strengths.includes("benchmark") || strengths.includes("track_record");
  const evidenceIsStrong =
    !returnIsNegative && benchmarkSupportsStrong && trackRecordSupportsStrong && performanceCorroborated && !riskIsAConcern;

  // Exactly which piece of evidence kept this fund out of STRONG. Without this, an ON TRACK card
  // could only say "not every measure is strong yet" — a restatement of the badge, not a reason,
  // and self-contradictory next to a card that also said the fund's record WAS strong.
  const strongBlockers = [];
  if (bSignal === "slight_underperformance") strongBlockers.push("benchmark_slightly_behind");
  if (trackRecord === "mixed") strongBlockers.push("track_record_uneven");
  if (trackRecord === "weak") strongBlockers.push("track_record_behind");
  if (riskIsAConcern) strongBlockers.push("risk");
  // Nothing is WRONG here — there simply isn't independent evidence either way. Named separately
  // so the card can say which evidence is missing instead of implying a shortcoming.
  if (!performanceCorroborated) {
    if (bSignal === null) strongBlockers.push("no_benchmark");
    if (trackRecord === null) strongBlockers.push("no_track_record");
  }
  return evidence(evidenceIsStrong ? "STRONG" : "ON TRACK", { concerns, strengths, strongBlockers });
}

// Deterministic, rule-based status label from real numbers — computed here, not by Gemini, so
// the AI never invents or varies a judgment call it can't be checked against (see the "never
// invent a rating" rule already enforced for risk_level, same principle). Gemini's job is to
// state this status and explain why, never to decide it itself.
//
// hasCategoryPeers: whether at least one OTHER fund in this portfolio shares this fund's category
// (see categoryFundCounts below) — confirmed live: a fund alone in its own category (common in a
// small portfolio) has avgReturn fall back to its own return, making a relative-bar comparison
// compare the fund to itself — mathematically impossible to fail, so a real standout could never
// be denied its badge just for having no peer, but a real laggard could never be caught by the
// relative bars either; every relative-bar check above is skipped (treated as passing) whenever
// hasCategoryPeers is false, and the absolute (time-scaled) floor alone decides — a real,
// meaningful bar on its own, not skipped by default.
//
// trailingReturns (optional) — the fund's own {1y, 3y, 5y, since_inception} object (see
// trailing_returns.py) — feeds hasConsistentHistoricalSupport inside classifyFundPerformance.
// Omitted entirely (null) wherever a single trailing_returns figure genuinely doesn't exist for
// what's being judged, which correctly skips the check rather than fabricating one.
//
// metricKind — see classifyFundPerformance's own comment; pass "xirr" for a Live SIP fund and
// "absolute" for a One-Time Purchase (or use metricKindFor(scheme) to derive it).
//
// riskEvidence — see classifyFundPerformance's own comment; optional, defaults to {} (no real
// risk-adjusted/benchmark data) for any caller that hasn't been updated to pass it.
// The structured evidence behind the badge (badge, concerns, strengths, strongBlockers,
// holdingPeriodStatus) — the same classifyFundPerformance call fundStatus uses, so a short reason
// built from it can never disagree with the badge.
export function fundStatusEvidence(returnPct, sharpe, avgReturn, heldDays, volatility, hasCategoryPeers, trailingReturns = null, metricKind = "absolute", riskEvidence = {}) {
  return classifyFundPerformance(returnPct, sharpe, avgReturn, heldDays, volatility, hasCategoryPeers, trailingReturns, metricKind, riskEvidence);
}

export function fundStatus(returnPct, sharpe, avgReturn, heldDays, volatility, hasCategoryPeers, trailingReturns = null, metricKind = "absolute", riskEvidence = {}) {
  return classifyFundPerformance(returnPct, sharpe, avgReturn, heldDays, volatility, hasCategoryPeers, trailingReturns, metricKind, riskEvidence).badge;
}

// Per-fund, real-numbers explanation of WHY this specific fund earned its status — built from the
// SAME classifyFundPerformance call fundStatus itself uses, so the reason can never contradict the
// badge it explains (previously these were two independently hand-duplicated branch trees, a real
// drift risk this closes for good). Never states a raw Sharpe/volatility number — same "no raw
// jargon" house style already enforced on Gemini's own text (SYSTEM_PROMPT rule 16) — only return
// percentages, category averages, and the fund's own time-appropriate track record, which an
// investor actually cares about. Every branch states the actual holding period in plain words
// (see periodClause) — a return is never judged in isolation from how long it's had to prove
// itself, per this app's own central rule.
//
// categoryAverageLabel — the noun phrase describing WHAT avgReturn actually is and WHO it's
// averaged across, appended right after its formatted number (e.g. "average XIRR among your
// other live-SIP funds in this category" vs "average absolute return among your other one-time
// holdings in this category"). Required, not defaulted — confirmed live: the exact same fund could
// show TWO DIFFERENT category-average numbers in two different report sections, both correct for
// what THEY measure but read as a contradiction without saying so explicitly — see
// judgingCategoryKey's own comment for the metric-mixing bug this also guards against.
//
// metricKind — see classifyFundPerformance's own comment; determines both which bar this fund is
// actually held to and whether the prose says "XIRR" or "return".
//
// riskEvidence — see classifyFundPerformance's own comment; optional, defaults to {}.
// States the fund's return as a PER-YEAR pace against the per-year bar the badge ladder actually
// applied, in plain language. The ladder's bar is an 8%/yr target compounded over the real holding
// period (see strongFloorFor), so on a long holding a healthy-looking cumulative number can sit
// below it — "+61.7% over around 9 years" is 5.8%/yr against a 6.1%/yr bar. Quoting the cumulative
// figure alone left that invisible, which is exactly how a card ended up asserting a verdict it
// never explained. Returns "" when there is nothing real to compare against.
function paceClause(returnPct, strongFloor, heldDays, metricKind) {
  if (returnPct === null || returnPct === undefined || strongFloor === null || strongFloor === undefined) return "";
  // An XIRR is already a per-year rate; only a cumulative return needs converting.
  if (metricKind === "xirr") {
    const onTrackBar = strongFloor * 0.7;
    return returnPct >= onTrackBar
      ? ""
      : `, an annual rate below the ${round2(onTrackBar)}% a year this holding period is measured against`;
  }
  const years = heldDays === null || heldDays === undefined ? null : Math.max(heldDays, 1) / 365;
  if (!years || years <= 1 || returnPct <= -100) return "";
  const perYear = (pctValue) => ((1 + pctValue / 100) ** (1 / years) - 1) * 100;
  const fundPace = perYear(returnPct);
  const onTrackPace = perYear(strongFloor * 0.7);
  if (fundPace >= onTrackPace) return "";
  return ` — that is ${round2(fundPace)}% a year, short of the ${round2(onTrackPace)}% a year expected over this long a holding`;
}

// Supplementary context only — how this fund's own number compares to the average across the
// investor's OTHER holdings in the same category. It has never gated the badge and still doesn't;
// it exists so the sentence can say "for context, your other holdings here averaged Y%". The
// direction is always computed from the real numbers, never assumed from the badge tier: a
// NEEDS ATTENTION fund can still be ahead of an even weaker peer set, and a STRONG one can sit
// below a stronger set.
function peerComparisonClause(returnPct, avgReturn, hasCategoryPeers, categoryAverageLabel) {
  if (!hasCategoryPeers || avgReturn === null || avgReturn === undefined) return "";
  if (returnPct === null || returnPct === undefined) return "";
  const signed = `${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(1)}%`;
  const label = categoryAverageLabel || "average for its category";
  // Worded by the size of the difference — +42.2% against +42.1% is not "well ahead".
  const diff = returnPct - avgReturn;
  if (Math.abs(diff) < 0.05) return `, in line with the ${signed} ${label}`;
  if (Math.abs(diff) < BADGE_THRESHOLDS.slightGapWordingPct) return diff > 0 ? `, slightly above the ${signed} ${label}` : `, slightly below the ${signed} ${label}`;
  if (diff >= 5) return `, well ahead of the ${signed} ${label}`;
  return diff > 0 ? `, ahead of the ${signed} ${label}` : `, below the ${signed} ${label}`;
}

const fmtPct = (n) => `${Math.round(n)}%`;

// The period behind the headline return — always the badge's evaluation period, the one the badge
// was actually judged on. Durations only, no dates (the PDF states periods, not calendar dates).
//
// When an early, immaterial purchase was left out of that period, the sentence says so, so the
// reader sees why the badge talks about ~1.5 years while Investment History says ~3 years:
//   " over the representative investment period of 1 year 6 months — 98% of your invested capital
//     went in during this period, including 18 SIP installments; an earlier purchase (2% of
//     capital, around 3 years ago) is included in the XIRR but does not set the evaluation period"
// Null when there is no multi-date history to state (a single purchase keeps "over around N").
function historyPeriodNote({
  investmentDuration,
  sipStartDate,
  sipInstallmentCount,
  purchaseTransactionCount,
  evaluationStartDate,
  evaluationDuration,
  evaluationCapitalPct,
  evaluationExcludedCapitalPct,
  evaluationExcludedPurchaseCount,
  firstInvestmentHeldPhrase,
  evaluationPhrase,
  metricWord,
}) {
  const multiPurchase = (purchaseTransactionCount || 0) > 1 || sipInstallmentCount > 1;
  if (!multiPurchase || !investmentDuration || formatCalendarDuration(investmentDuration) === "0 days") return null;
  const sipInPeriod = sipInstallmentCount > 1 && sipStartDate && evaluationStartDate && sipStartDate >= evaluationStartDate;
  const sipNote = sipInPeriod ? `${sipInstallmentCount} SIP installments` : null;

  if (evaluationDuration && (evaluationExcludedCapitalPct || 0) > 0) {
    const excludedCount = evaluationExcludedPurchaseCount || 1;
    const earlier = excludedCount > 1 ? `${excludedCount} earlier purchases` : "an earlier purchase";
    const age = firstInvestmentHeldPhrase ? `, ${excludedCount > 1 ? "the first " : ""}${firstInvestmentHeldPhrase} ago` : "";
    return (
      ` over the representative investment period of ${evaluationPhrase || approxCalendarDuration(evaluationDuration)} — ${fmtPct(evaluationCapitalPct)} of your invested capital went in during this period` +
      `${sipNote ? `, including ${sipNote}` : ""}; ${earlier} (${fmtPct(evaluationExcludedCapitalPct)} of capital${age}) ${excludedCount > 1 ? "are" : "is"} included in the ${metricWord} but ${excludedCount > 1 ? "do" : "does"} not set the evaluation period`
    );
  }
  // The same start-to-NAV-date period the card's Investment Period states — never the first-to-last
  // purchase span, which stops at the last purchase while the return runs to the NAV date.
  const period = evaluationPhrase || approxCalendarDuration(evaluationDuration || investmentDuration);
  return sipNote ? ` over ${period}, including ${sipNote}` : ` over ${period} of investing`;
}

const fmtOne = (n) => n.toFixed(1);
const signedPct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

// The figures behind a benchmark sentence, kept short (per explicit request): one pair of returns
// and the gap. A live SIP: XIRR against the benchmark's XIRR on the same SIP dates. Otherwise the
// cumulative returns, with the gap per year where the period is a year or more (CAGR or XIRR on the
// same cash flows — never a cumulative gap divided by years).
function comparisonClause(bc) {
  const found = comparisonGap(bc);
  if (!found) return "";
  const side = found.gap < 0 ? "behind" : "ahead";
  if (bc.compare_on === "xirr") {
    return ` (your XIRR ${signedPct(bc.annualized_fund_return)} against the index's ${signedPct(bc.annualized_benchmark_return)} on the same ${bc.all_purchases_sip === false ? "investment" : "SIP"} dates, ${fmtOne(Math.abs(found.gap))} points a year ${side})`;
  }
  const size = found.basis === "annualized" ? `about ${fmtOne(Math.abs(found.gap))} points a year ${side}` : `${fmtOne(Math.abs(found.gap))} points ${side}`;
  return ` (your ${signedPct(bc.fund_return)} against the index's ${signedPct(bc.benchmark_return)}, ${size})`;
}

// Older callers without a validated comparison: the same wording from the previous inputs.
function legacyGapClause(fundReturnPct, benchmarkReturnPct, windowDays, metricKind) {
  if (fundReturnPct === null || fundReturnPct === undefined || benchmarkReturnPct === null || benchmarkReturnPct === undefined) return "";
  const perYearGap = annualizedBenchmarkGapPct(fundReturnPct, benchmarkReturnPct, windowDays, metricKind);
  const isPerYear = metricKind === "xirr" || (windowDays && windowDays > 365);
  const unit = metricKind === "xirr" ? " a year" : "";
  const side = perYearGap < 0 ? "behind" : "ahead";
  const size = isPerYear ? `about ${fmtOne(Math.abs(perYearGap))} points a year ${side}` : `${fmtOne(Math.abs(perYearGap))} points ${side}`;
  return ` (your ${signedPct(fundReturnPct)}${unit} against the index's ${signedPct(benchmarkReturnPct)}${unit}, ${size})`;
}

function logExplanationWithheld(fund, errors) {
  console.error(JSON.stringify({ level: "error", event: "badge_explanation_withheld", fund, errors, timestamp: new Date().toISOString() }));
}

export function fundStatusReason(
  returnPct,
  sharpe,
  avgReturn,
  heldDays,
  volatility,
  hasCategoryPeers,
  trailingReturns,
  categoryAverageLabel,
  metricKind = "absolute",
  riskEvidence = {}
) {
  const pct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
  const metricWord = metricKind === "xirr" ? "XIRR" : "return";
  const {
    sortino = null,
    alpha = null,
    fundReturnPct = null,
    benchmarkReturnPct = null,
    windowReturnPct = null,
    benchmarkWindowDays = null,
    maxDrawdown = null,
    currentPnlPct = returnPct,
    benchmarkName = null,
    // Investment History / SIP History and the badge's evaluation period from calc-service (see
    // investment_history.py). heldDays itself is already the evaluation period (badgeHeldDays).
    investmentDuration = null,
    sipStartDate = null,
    sipInstallmentCount = 0,
    purchaseTransactionCount = 0,
    evaluationStartDate = null,
    evaluationDuration = null,
    evaluationCapitalPct = null,
    evaluationExcludedCapitalPct = null,
    evaluationExcludedPurchaseCount = 0,
    firstInvestmentHeldDays = null,
    reportedTrailing = null,
    // The dates behind heldDays, so periods are stated on the calendar ("3 years 2 months"), never
    // as a rounded "around 3 years".
    heldSince = null,
    navDate = null,
    firstInvestmentDate = null,
  } = riskEvidence;
  const usesComparison = Object.prototype.hasOwnProperty.call(riskEvidence, "benchmarkComparison");
  const bc = usesComparison ? riskEvidence.benchmarkComparison : null;
  const calendarPhrase = (since) => {
    const duration = calendarDuration(since, navDate);
    return duration ? approxCalendarDuration(duration) : null;
  };
  const periodPhrase =
    calendarPhrase(heldSince) ?? (heldDays === null || heldDays === undefined ? null : formatHoldingPeriod(heldDays / 30.44));
  const periodNote =
    historyPeriodNote({
      investmentDuration,
      sipStartDate,
      sipInstallmentCount,
      purchaseTransactionCount,
      evaluationStartDate,
      evaluationDuration,
      evaluationCapitalPct,
      evaluationExcludedCapitalPct,
      evaluationExcludedPurchaseCount,
      firstInvestmentHeldPhrase:
        calendarPhrase(firstInvestmentDate) ??
        (firstInvestmentHeldDays === null || firstInvestmentHeldDays === undefined ? null : formatHoldingPeriod(firstInvestmentHeldDays / 30.44)),
      evaluationPhrase: calendarPhrase(heldSince),
      metricWord,
    }) ?? (periodPhrase ? ` over ${periodPhrase}` : "");
  const sharpeValue = reliableSharpe(sharpe, volatility);
  const sortinoValue = reliableSharpe(sortino, volatility);
  const calmarValue = calmarRatio(windowReturnPct !== null && windowReturnPct !== undefined ? windowReturnPct : fundReturnPct, maxDrawdown);
  const riskSignal = combinedRiskSignal(sharpeValue, sortinoValue, calmarValue);
  // Named so the explanation can say WHICH record was weak/strong, matching the badge's own input.
  const trackRecord = trackRecordSignal(heldDays, trailingReturns, reportedTrailing);
  // The same gap and signal the badge was decided by (see classifyFundPerformance).
  const gapPct = usesComparison ? comparisonGap(bc)?.gap ?? null : benchmarkGapPct(alpha, fundReturnPct, benchmarkReturnPct);
  const bSignal = usesComparison
    ? benchmarkSignal(gapPct)
    : schemeBenchmarkSignal(fundReturnPct, benchmarkReturnPct, benchmarkWindowDays, metricKind);
  // The one sentence this report ever states about risk-adjusted/benchmark-relative performance —
  // grounded in the real riskSignal/bSignal buckets, never a raw Sharpe/Sortino/alpha number, never
  // derived from returnPct (XIRR/Absolute Return stays purely an INVESTOR-return concept, never
  // risk-adjusted evidence — see classifyFundPerformance's own comment on that separation). null
  // when there's no real risk-adjusted or benchmark data available at all.
  const riskClause = riskAdjustedNarrativeClause(riskSignal, bSignal);
  const ev = classifyFundPerformance(
    returnPct,
    sharpe,
    avgReturn,
    heldDays,
    volatility,
    hasCategoryPeers,
    trailingReturns,
    metricKind,
    riskEvidence
  );
  const { badge, concerns, strengths, strongBlockers, benchmarkStatus, riskStatus, trackRecordStatus, holdingPeriodStatus } = ev;
  // benchmark_name doubles as an explanation when no index is mapped ("Not available for category
  // 'Income/Debt Oriented Scheme - Corporate Bond Fund'"), so it must never be dropped into a
  // sentence as if it were an index name — that produced "no usable Not available for category
  // '...' comparison available for it yet".
  const benchmarkIsNamed = Boolean(benchmarkName) && !/^not available|not identified/i.test(benchmarkName);
  const bench = benchmarkIsNamed ? benchmarkName : "its benchmark";
  // A comparison is named by the data it was computed from ("Nifty Midcap 150 (ETF tracker)") —
  // the same label the card prints beside the figures — never by the official TRI name.
  const comparedWith = (bc && bc.valid && bc.benchmark_name) || bench;

  // -------------------------------------------------------------------------------------------
  // Every sentence below is generated from `ev` and nothing else. That is the whole point: the
  // badge is decided first, and the explanation may only describe THAT decision. It can therefore
  // never claim weak risk when risk did not contribute, never claim benchmark underperformance
  // when the benchmark was competitive or unavailable, and never cite a return target — the
  // return-floor ladder that produced those sentences no longer exists.
  // -------------------------------------------------------------------------------------------

  // A holding measured in days or weeks has no long-run story yet. Its ANNUALIZED figure is a
  // stub-period artefact (a 2-month dip annualizes to -64%), so short holdings are always
  // described by the real money gained or lost, never by that rate.
  const isYoung =
    holdingPeriodStatus === "very_new" ||
    holdingPeriodStatus === "new" ||
    holdingPeriodStatus === "new_good_record" ||
    holdingPeriodStatus === "too_early";
  const realPnl = currentPnlPct !== null && currentPnlPct !== undefined ? currentPnlPct : returnPct;

  if (badge === "TOO EARLY TO JUDGE") {
    const heldClause = periodPhrase ? `Held for ${periodPhrase} so far` : "Held for only a day or two so far";
    const ownRecord = ["1y", "3y", "5y", "since_inception"]
      .map((window) => ({ window, value: trailingReturns?.[window] }))
      .filter((w) => w.value !== null && w.value !== undefined);
    const base = `${heldClause} — this investment is still too new for a meaningful assessment, and the current gain or loss reflects only a short period of market movement.`;
    return ownRecord.length > 0
      ? `${base} That reflects how long you have held it, not the fund itself, whose own past performance is ${ownRecord
          .map((w) => `${windowLabel(w.window)} ${round2(w.value)}%`)
          .join(", ")}.`
      : base;
  }

  if (badge === "PROMISING START") {
    return `Held for ${periodPhrase || "under three months"} so far and currently ${pct(realPnl)} — an encouraging start, but the holding period is still very short, so this is not yet evidence of the fund's long-term quality.`;
  }

  // What each signal is allowed to be called, in plain language. A phrase exists ONLY for a state
  // the classifier actually recorded, so there is no way to narrate evidence it did not use. The
  // benchmark sentence states the real figures, and its wording is chosen by the gap's own size.
  const gapClause = usesComparison ? comparisonClause(bc) : legacyGapClause(fundReturnPct, benchmarkReturnPct, benchmarkWindowDays, metricKind);
  // The direction word follows the SAME gap the clause states: the annualized one wherever it exists.
  const wordingGap = usesComparison ? gapPct : annualizedBenchmarkGapPct(fundReturnPct, benchmarkReturnPct, benchmarkWindowDays, metricKind);
  const benchmarkSentence =
    wordingGap === null || wordingGap === undefined ? `it has trailed ${comparedWith}` : `it has ${gapPhrase(wordingGap)} ${comparedWith}${gapClause}`;
  // The fund's own returns the track-record verdict was actually based on, stated with it — and
  // the latest 1-year return whenever it was not one of them and is weak, so "consistently strong"
  // can never hide a flat or negative recent year (a 4-year holding is judged on 3y/5y/since-launch).
  // Benchmark-relative whenever AMFI reports both sides (see trackRecordSignal), so the sentence
  // quotes the same fund-vs-index figures the verdict was based on.
  const relativeWindows = benchmarkRelativeWindows(heldDays, reportedTrailing);
  const isRelative = relativeWindows.length > 0;
  const trackBench = (isRelative && reportedTrailing.benchmark) || bench;
  const judgedWindows = isRelative ? relativeWindows : relevantTrailingWindows(heldDays, trailingReturns);
  const windowsText = !judgedWindows.length
    ? ""
    : isRelative
      ? ` (${judgedWindows.map((w) => `${windowLabel(w.window)} ${fmtOne(w.value)}% against ${fmtOne(w.benchmark)}%`).join(", ")} a year)`
      : ` (${judgedWindows.map((w) => `${windowLabel(w.window)} ${fmtOne(w.value)}%`).join(", ")} a year)`;
  const oneYear = isRelative ? reportedTrailing.fund?.["1y"] : trailingReturns?.["1y"];
  const oneYearBench = isRelative ? reportedTrailing.benchmark_returns?.["1y"] : null;
  const weakRecentYear =
    oneYear !== null &&
    oneYear !== undefined &&
    !judgedWindows.some((w) => w.window === "1y") &&
    (isRelative && oneYearBench !== null && oneYearBench !== undefined
      ? oneYear - oneYearBench < BADGE_THRESHOLDS.trackRecordKeepsPaceGapPct
      : oneYear < STRONG_ANNUALIZED_RATE_PCT);
  const recentYear = weakRecentYear
    ? `${signedPct(oneYear)}${isRelative && oneYearBench !== null && oneYearBench !== undefined ? ` against the index's ${signedPct(oneYearBench)}` : ""}`
    : "";
  // "although" after a strong record; "and" after an uneven or weak one, where it is more of the same.
  const trackText = `${windowsText}${weakRecentYear ? `, although its latest 1-year return is weaker at ${recentYear}` : ""}`;
  const unevenTrackText = `${windowsText}${weakRecentYear ? `; its latest 1-year return is ${recentYear}` : ""}`;
  const TRACK = isRelative
    ? {
        strong: `its longer-term record has ${
          judgedWindows.every((w) => w.gap >= 0) ? "matched or beaten" : "stayed within about 1 point a year of"
        } ${trackBench} in every period judged${trackText}`,
        uneven: `its longer-term record has been uneven against ${trackBench}${unevenTrackText}`,
        weak: `its longer-term record has lagged ${trackBench} by a wide margin${unevenTrackText}`,
      }
    : {
        strong: `its longer-term record has been consistently strong${trackText}`,
        uneven: `its longer-term record has been uneven rather than consistently strong${unevenTrackText}`,
        weak: `its performance has been inconsistent, with the periods that matter here remaining weak${windowsText}`,
      };
  const CONCERN = {
    return: isYoung
      ? "your investment is currently below the amount you put in"
      : "the money you put in is currently worth less than you invested",
    benchmark: benchmarkSentence,
    risk: "its returns have not compensated for the ups and downs taken to earn them",
    track_record: TRACK.weak,
    realized_return: "what you actually earned is well short of what this fund itself has delivered over comparable periods",
  };
  const BLOCKER = {
    benchmark_slightly_behind: benchmarkSentence,
    track_record_uneven: TRACK.uneven,
    track_record_behind: TRACK.weak,
    risk: "its risk-adjusted performance has been weak",
    no_benchmark: benchmarkIsNamed
      ? `an exact historical ${bench} series for your full investment period is unavailable from our current data sources`
      : "no benchmark index is available for this category",
    no_track_record: "it does not have enough of its own performance history yet",
  };
  const STRENGTH = {
    benchmark: benchmarkSentence,
    track_record: TRACK.strong,
    risk: "its returns have held up well against the risk taken",
  };
  const list = (items) =>
    items.length <= 1 ? items[0] || "" : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  // The investor-period benchmark comparison is always stated when one exists, even when it is not
  // what decided the badge — a card must never show only the bad news (or only the good) about how
  // the fund did against its benchmark over the investor's own holding.
  const benchmarkAlreadyStated = concerns.includes("benchmark") || strengths.includes("benchmark") || strongBlockers.includes("benchmark_slightly_behind");
  const alsoBenchmark =
    !benchmarkAlreadyStated && wordingGap !== null && wordingGap !== undefined
      ? ` Over your own holding, it has ${gapPhrase(wordingGap)} ${comparedWith}${gapClause}.`
      : "";

  // Short holdings lead with real money; established ones with the metric they were judged on.
  const headline = isYoung
    ? `Your investment is currently ${pct(realPnl)}${periodNote}`
    : `Your investment has generated a ${pct(returnPct)} ${metricWord}${periodNote}`;

  // A short holding judged on the fund's own record instead (see shortHoldingRecord).
  if (holdingPeriodStatus === "new_good_record") {
    const record = shortHoldingRecord(trailingReturns, reportedTrailing);
    const figures = record.windows
      .map((w) => (record.relative ? `${windowLabel(w.window)} ${fmtOne(w.value)}% against ${fmtOne(w.benchmark)}%` : `${windowLabel(w.window)} ${fmtOne(w.value)}%`))
      .join(", ");
    const recordText = record.relative
      ? `the fund itself has ${record.beatAll ? "matched or beaten" : "kept within about 1 point a year of"} ${record.benchmark || bench} over its longer-term record (${figures} a year)`
      : `the fund itself has delivered healthy returns over its longer-term record (${figures} a year)`;
    return `${headline}. It is not judged on this yet — a holding this short reflects only recent market movement, not the fund's quality. It is rated ON TRACK because ${recordText}.${alsoBenchmark}`;
  }
  // Peer average is context only, never a reason — so it is stated last, after the verdict, and
  // never inside the "because" clause.
  const peerClause = peerComparisonClause(returnPct, avgReturn, hasCategoryPeers, categoryAverageLabel);
  const context = peerClause && !isYoung ? ` For context, this is${peerClause.replace(/^,\s*/, " ")}.` : "";
  const youngCaveat = isYoung
    ? " The holding period is still short, so this should not be treated as evidence of the fund's long-term quality."
    : "";

  if (concerns.length > 0) {
    // Priority order: the reason that caused the badge, then any other genuine concerns, then the
    // real positives that survive alongside them.
    const named = list(concerns.map((c) => CONCERN[c]).filter(Boolean));
    const positiveList = list(strengths.map((s) => STRENGTH[s]).filter(Boolean));
    const positives = positiveList ? ` ${positiveList.charAt(0).toUpperCase()}${positiveList.slice(1)}.` : "";
    const stillStrong =
      trackRecordStatus === "strong" && !concerns.includes("track_record")
        ? ` ${TRACK.strong.charAt(0).toUpperCase()}${TRACK.strong.slice(1)}.`
        : "";
    return validated(`${headline}. It is rated ${badge} because ${named}.${alsoBenchmark}${positives}${stillStrong}${youngCaveat}${context}`);
  }

  const positives = list(strengths.map((s) => STRENGTH[s]).filter(Boolean));
  if (badge === "STRONG") {
    return validated(`${headline}. It is rated STRONG because ${positives || "the evidence available is positive"}, with no meaningful negative signal identified.${alsoBenchmark}${context}`);
  }

  // ON TRACK with nothing wrong: name the ONE thing that kept it from STRONG. "Not every measure
  // is strong yet" used to stand in for this and explained nothing — it restated the badge, and on
  // a fund whose record WAS strong it flatly contradicted the next sentence.
  const blocked = list(strongBlockers.map((b) => BLOCKER[b]).filter(Boolean));
  const supporting = positives ? ` ${positives.charAt(0).toUpperCase()}${positives.slice(1)}.` : "";
  return validated(
    blocked
      ? `${headline}. It is rated ON TRACK rather than STRONG because ${blocked}.${alsoBenchmark}${supporting}${youngCaveat}${context}`
      : `${headline}. It is rated ON TRACK: performance is satisfactory, but the available evidence is not strong enough across every area to rate it STRONG.${alsoBenchmark}${supporting}${youngCaveat}${context}`
  );

  // Last step before anything reaches the investor: the sentence may not contradict its own
  // numbers (see explanationContradictions). If it would, the explanation is withheld and logged.
  function validated(text) {
    const errors = explanationContradictions(text, bc, comparedWith);
    if (errors.length === 0) return text;
    logExplanationWithheld(benchmarkName, errors);
    return `It is rated ${badge}. The detailed explanation is withheld because its benchmark wording did not match the calculated figures.`;
  }
}

// The return figure a fund is actually judged by, and the badge it's judged by: XIRR for a Live
// SIP fund, Absolute Return otherwise — this app's central rule that the two must never share one
// performance methodology, applied everywhere a fund's status/return is computed or displayed
// (buildSipSplitHtml's rows, buildVerificationJson/recommendationsJson's fund_status sent to
// Gemini, the Top Performing Review). Per explicit request: a fund's status badge and the return
// figure printed right next to it must always be the same number — confirmed live, a fund showing
// "XIRR +9.2%" was earning GOOD PERFORMER off a completely different, invisible 45.8%
// absolute-return figure, which read as arbitrary/wrong to a reader who could only see the 9.2%.
// Falls back to absolute return when a live SIP's own XIRR isn't available (couldn't be solved) —
// same honest fallback already used for display.
function hasReportedXirr(scheme) {
  return scheme.is_live_sip && scheme.xirr !== null && scheme.xirr !== undefined;
}

// "xirr" or "absolute" — pass to fundStatus/fundStatusReason's own metricKind parameter so a
// scheme is always judged by the SAME rule judgingReturnPct already uses to pick ITS number.
export function metricKindFor(scheme) {
  return hasReportedXirr(scheme) ? "xirr" : "absolute";
}

export function judgingReturnPct(scheme) {
  return hasReportedXirr(scheme) ? scheme.xirr * 100 : scheme.absolute_return_pct;
}

// The key a fund is grouped/compared under when judged by judgingReturnPct — category AND which
// metric it's judged by. A Live SIP fund's XIRR must never be averaged together with a One-Time
// peer's much-larger cumulative Absolute Return just because they share a scheme_category —
// they're different scales measuring different things (annualized vs. flat cumulative), and
// blending them produces a category "average" that's a fair benchmark for neither fund. Pass this
// as the keyFn to averageReturnByCategory/categoryFundCounts wherever judgingReturnPct is the
// metricFn (see buildSipSplitHtml) — plain scheme_category stays the default for every other
// caller, which only ever deals in absolute_return_pct.
export function judgingCategoryKey(scheme) {
  return `${scheme.scheme_category || "Other"}::${hasReportedXirr(scheme) ? "xirr" : "absolute"}`;
}

// A single portfolio-wide average return unfairly penalizes conservative categories — confirmed
// live: a Low-risk liquid fund returning +13.8% was flagged NEEDS MONITORING purely because the
// portfolio's blended average was pulled way up by unrelated equity holdings returning 100-600%+.
// A coarse "Debt vs Equity" grouping isn't enough either — confirmed live, that same liquid fund
// stayed flagged NEEDS MONITORING even against just the portfolio's other Debt holdings, because
// Corporate Bond/Credit Risk/Banking & PSU funds are legitimately higher-risk, higher-return debt
// subcategories a Liquid Fund was never going to keep pace with. Each fund's fund_status is now
// judged only against the average return of its OWN exact scheme_category — same granularity
// recommendationsJson.js's your_category_average_return_percentage already uses for the same
// reason (a real peer-group average, not a market-wide benchmark this app has no data for). A
// fund that's the only holding in its exact category has no real peer to compare against, so its
// own average simply equals itself — honest neutrality, not a forced (and likely wrong) verdict.
// metricFn defaults to plain absolute_return_pct (unchanged for every existing caller); pass
// judgingReturnPct explicitly (see buildSipSplitHtml) to average each fund's own judged metric
// instead — a fund is only ever compared against peers using the SAME metric it's judged by.
// keyFn defaults to plain scheme_category; pass judgingCategoryKey ALONGSIDE judgingReturnPct
// (never one without the other) so a Live SIP fund's XIRR is only ever averaged against other
// Live SIP peers' XIRR, never blended with a One-Time peer's absolute return just because they
// share a category — see judgingCategoryKey's own comment for why mixing them is wrong.
export function averageReturnByCategory(schemes, metricFn = (s) => s.absolute_return_pct, keyFn = (s) => s.scheme_category || "Other") {
  const sums = {};
  const counts = {};
  for (const s of schemes) {
    // A non-finite metric (null/NaN/Infinity — shouldn't normally happen, but never trusted blind)
    // must never silently corrupt the whole category's average; skip it rather than including it.
    const metric = metricFn(s);
    if (!Number.isFinite(metric)) continue;
    const key = keyFn(s);
    sums[key] = (sums[key] || 0) + metric;
    counts[key] = (counts[key] || 0) + 1;
  }
  const result = {};
  for (const key of Object.keys(sums)) result[key] = sums[key] / counts[key];
  return result;
}

// A fund still within its own "too early to fully judge" window (see MIN_DAYS_FOR_
// UNDERPERFORMANCE_JUDGEMENT) has a judged metric that isn't yet a reliable "typical" number for
// AVERAGING purposes — confirmed live: a short-holding Live SIP fund's small real loss annualizes
// into an extreme negative XIRR (e.g. -80%+) purely from compounding arithmetic over a short
// window; blending that one extreme, non-representative outlier into a category's displayed peer
// average dragged it to something like -32% while every other real peer was solidly positive.
// This does NOT affect that fund's OWN badge (which already judges it fairly for its own age via
// strongFloorFor/the grace periods) — it only decides whether this fund CONTRIBUTES its own number
// to what gets shown to OTHER funds as "your peer average". null heldDays (unknown) is included by
// default — never excluded for data this app simply doesn't know, only for a holding period it
// positively knows is too short to be representative. Shared by both buildVerificationJson and
// pdfReport.js's classifyScheme so the two independently-computed peer averages can never diverge.
export function reliablePeerPool(schemes) {
  return schemes.filter((s) => {
    const heldDays = badgeHeldDays(s);
    return heldDays === null || heldDays >= MIN_DAYS_FOR_UNDERPERFORMANCE_JUDGEMENT;
  });
}

// Whether `scheme` has at least one REAL, RELIABLE peer (excluding itself) sharing its category —
// the right question for whether "average among your OTHER holdings" narrative prose (see
// fundStatusReason's hasCategoryPeers/relativeClause) is honest to show. Confirmed live, twice,
// against a real portfolio: categoryFundCounts alone (raw same-category membership, regardless of
// reliability) let this fire even when every OTHER same-category member was excluded from
// reliablePeerPool for being too-short-held — e.g. two funds in the same XIRR-judged category, both
// only ~60 days old, each showing "in line with the X% average among your other holdings" where X
// was literally that fund's OWN XIRR (the avgReturn lookup's own no-real-peer fallback landing on
// itself) — technically an average-of-zero-real-contributors masquerading as "your peers agree with
// you". Same failure mode when a fund is the SOLE reliable contributor to its category (a genuinely
// computed average that trivially equals itself, since there was only one real data point) — the
// arithmetic isn't wrong, but "among your OTHER holdings" is still false when no other holding
// actually contributed. This function answers the real question directly: excluding this fund
// itself, does reliablePeerPool contain another same-category member at all?
export function hasReliableCategoryPeer(scheme, schemes, keyFn = (s) => s.scheme_category || "Other") {
  const key = keyFn(scheme);
  return reliablePeerPool(schemes).some((s) => s !== scheme && keyFn(s) === key);
}

// How many funds in this portfolio share each exact scheme_category — a parallel helper (not
// merged into averageReturnByCategory's own return shape, to avoid changing every existing
// avgReturnByCategory[category] lookup already spread across this codebase) purely so a caller can
// tell fundStatus whether a given fund actually has a real peer to be compared against. A fund
// alone in its category used to be treated as "neutral" (compared to itself), but that silently
// made GOOD PERFORMER mathematically impossible for it — see fundStatus's hasCategoryPeers.
// keyFn defaults to plain scheme_category; pass judgingCategoryKey (matching
// averageReturnByCategory's own keyFn) wherever judgingReturnPct is in play — a fund whose only
// category-mate is judged by a different metric has no REAL peer for this comparison, even though
// they technically share a scheme_category.
export function categoryFundCounts(schemes, keyFn = (s) => s.scheme_category || "Other") {
  const counts = {};
  for (const s of schemes) {
    const key = keyFn(s);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

// Mirrors frontend/src/lib/fundAnalysis.js's groupByInvestmentActivity exactly, so the live
// dashboard and the PDF never disagree — see that copy for the full reasoning. is_live_sip is
// computed server-side by calc-service (main.py, SIP_LIVE_THRESHOLD_DAYS) from each scheme's real
// transaction dates; this just groups by that already-computed boolean.
export function groupByInvestmentActivity(schemes) {
  const liveSip = schemes.filter((s) => s.is_live_sip);
  const oneTimePurchase = schemes.filter((s) => !s.is_live_sip);
  return { liveSip, oneTimePurchase };
}

export function best(schemes, key, direction) {
  const withMetric = schemes.filter((s) => s[key] !== null && s[key] !== undefined);
  if (withMetric.length === 0) return null;
  const sorted = [...withMetric].sort((a, b) => (direction === "max" ? b[key] - a[key] : a[key] - b[key]));
  return sorted[0];
}

/**
 * Builds the ONLY JSON Gemini ever sees — never raw transactions, NAV/price history, or
 * holdings. Every number here is already final: rounded to 2dp, top/bottom performer and every
 * highlight already selected by sorting in Python-fed data (never left for Gemini to pick), risk
 * metrics explicitly null when they weren't actually computed from real data. Gemini's job is to
 * explain this JSON, not to derive, estimate, or select anything from it.
 */
export function buildVerificationJson({ schemes, portfolio }) {
  const sorted = [...schemes].sort((a, b) => b.absolute_return_pct - a.absolute_return_pct);
  const topPerformer = sorted[0];
  const lowestPerformer = sorted[sorted.length - 1];
  const avgReturnByCategory = averageReturnByCategory(schemes);
  const categoryCounts = categoryFundCounts(schemes);
  // judgingReturnPct/judgingCategoryKey-scoped peer averages, ALONGSIDE the plain ones above — the
  // fund_status sent to Gemini below must be judged by the SAME metric (XIRR for a Live SIP fund,
  // Absolute Return otherwise) that judgingReturnPct/the PDF's own badges use, never plain
  // absolute_return_pct regardless of SIP status. Kept as a second pair rather than replacing the
  // plain one above, since topPerformer/lowestPerformer (sorted by absolute_return_pct) are a
  // separate, metric-agnostic "biggest number" pick that must stay unchanged.
  // reliablePeerPool for the AVERAGE VALUE only (see its own comment: a fund still within its own
  // too-early-to-judge window has a judged metric — especially XIRR — that isn't yet reliable
  // enough to CONTRIBUTE to what other funds are shown as "their peer average"). hasCategoryPeers
  // (judgedCategoryCounts) still counts from the FULL schemes list — whether a fund has at least
  // one OTHER holding in its category is a question about category membership, not about whether
  // that peer's own number happened to be reliable enough to enter the average; if every peer in a
  // category turns out to be unreliable, judgedAvgReturnByCategory simply has no entry for that
  // key, and the existing "no real peer average, compare to self" fallback below handles it.
  const judgedAvgReturnByCategory = averageReturnByCategory(reliablePeerPool(schemes), judgingReturnPct, judgingCategoryKey);
  const judgedCategoryCounts = categoryFundCounts(schemes, judgingCategoryKey);

  const [largestCategory, largestCategoryPct] = topEntry(portfolio.concentration.by_category);

  // Only trust risk metrics when calc-service's own portfolio_value_series actually built (i.e.
  // NAV history aligned with real benchmark data) — otherwise beta/max_drawdown default to 0 as
  // placeholders, not real calculated values, and must not be presented to Gemini (or the user)
  // as real. calc-service reports this directly via risk_data_available rather than the backend
  // inferring it from value_series/performance_series, which are a separate computation (the
  // TWR/composite-benchmark rebuild) and don't reliably track whether beta/volatility/max_drawdown
  // are real.
  const hasRiskData = portfolio.risk_data_available === true;

  const bestSharpe = best(schemes, "sharpe_ratio", "max");
  const lowestVolatility = best(schemes, "volatility", "min");
  const lowestDrawdown = best(schemes, "max_drawdown", "min");

  return {
    portfolio_summary: {
      scheme_count: schemes.length,
      total_investment: round2(portfolio.total_investment),
      current_value: round2(portfolio.total_current_value),
      profit_loss: round2(portfolio.total_profit_loss),
      return_percentage: round2(portfolio.total_absolute_return_pct),
      xirr: round2(portfolio.xirr * 100),
    },
    risk_metrics: {
      beta: hasRiskData ? round2(portfolio.beta) : null,
      max_drawdown: hasRiskData ? round2(portfolio.max_drawdown) : null,
      risk_category: hasRiskData ? portfolio.risk_category : "Not available",
    },
    allocation: {
      largest_category: largestCategory,
      largest_category_percentage: round2(largestCategoryPct),
      // Every category, not just the largest — needed so Gemini can reason about
      // over-allocation/under-allocation across the whole portfolio, not only the top slice.
      by_category: Object.fromEntries(
        Object.entries(portfolio.concentration.by_category || {}).map(([name, pct]) => [name, round2(pct)])
      ),
    },
    performance: {
      top_performer: { name: topPerformer.scheme_name, return_percentage: round2(topPerformer.absolute_return_pct) },
      lowest_performer: { name: lowestPerformer.scheme_name, return_percentage: round2(lowestPerformer.absolute_return_pct) },
    },
    // Objective, metric-based highlights — never a "buy this" recommendation, just which fund
    // scored best/lowest on a specific, named, verifiable metric. Any of these can be null if
    // no scheme had that metric available (e.g. too little price history).
    fund_highlights: {
      best_risk_adjusted_return: bestSharpe
        ? { name: bestSharpe.scheme_name, sharpe_ratio: round2(bestSharpe.sharpe_ratio) }
        : null,
      lowest_volatility: lowestVolatility
        ? { name: lowestVolatility.scheme_name, volatility_percentage: round2(lowestVolatility.volatility * 100) }
        : null,
      lowest_max_drawdown: lowestDrawdown
        ? { name: lowestDrawdown.scheme_name, max_drawdown_percentage: round2(lowestDrawdown.max_drawdown) }
        : null,
    },
    // A fixed illustrative amount for "₹1 lakh would have grown to ₹X" style examples — Gemini
    // must use the per-fund growth_on_100000(_formatted) figures below rather than doing this
    // arithmetic itself (rule: never calculate new numbers).
    illustrative_investment_amount: ILLUSTRATIVE_INVESTMENT_AMOUNT,
    // Every fund, so Gemini can discuss each by name with its own real numbers — not just the
    // top/bottom performer. category comes from AMFI, never from the upload.
    funds: schemes.map((s) => {
      const volatilityPct = s.volatility === null || s.volatility === undefined ? null : round2(s.volatility * 100);
      const growthOn100000 = round2(ILLUSTRATIVE_INVESTMENT_AMOUNT * (1 + s.absolute_return_pct / 100));
      const heldDays = badgeHeldDays(s);
      const holdingPeriodMonths = heldDays === null ? null : round2(heldDays / 30.44);
      const schemeEvidence = classifyFundPerformance(
        judgingReturnPct(s),
        s.sharpe_ratio,
        judgedAvgReturnByCategory[judgingCategoryKey(s)] ?? judgingReturnPct(s),
        heldDays,
        s.volatility,
        (judgedCategoryCounts[judgingCategoryKey(s)] ?? 1) > 1,
        s.trailing_returns,
        metricKindFor(s),
        { sortino: s.sortino_ratio, alpha: s.alpha, fundReturnPct: s.fund_return_pct, benchmarkReturnPct: s.benchmark_return_pct, windowReturnPct: s.fund_window_return_pct, benchmarkWindowDays: s.alpha_beta_window_days, maxDrawdown: s.max_drawdown, currentPnlPct: s.absolute_return_pct, benchmarkName: s.benchmark_name, reportedTrailing: s.reported_trailing_returns, ...comparisonEvidence(s) }
      );
      const schemeFundStatus = schemeEvidence.badge;
      // Computed ONCE here, reused for BOTH risk_adjusted_summary and recommendation below — the
      // exact same combinedRiskSignal/benchmarkSignal buckets must never be independently
      // recomputed in two places, which risks them silently drifting apart.
      const schemeRiskSignal = combinedRiskSignal(
        reliableSharpe(s.sharpe_ratio, s.volatility),
        reliableSharpe(s.sortino_ratio, s.volatility),
        calmarRatio(s.fund_window_return_pct ?? s.fund_return_pct, s.max_drawdown)
      );
      // The same benchmark signal the badge was decided by (see schemeGapSignal).
      const schemeBenchmarkSig = schemeGapSignal(s);
      // The ONE deterministic recommendation for this fund (see recommendationFor's own comment)
      // — given to Gemini as an INPUT so its "reason" text justifies THIS value, and re-applied by
      // narrative.js AFTER Gemini responds regardless of what it produces, so Gemini can never
      // independently choose a different one. The PDF's own fund card (pdfReport.js) computes and
      // uses this exact same value too, via the exact same fund_status it was derived from.
      const schemeRecommendation = recommendationFor(schemeFundStatus, schemeRiskSignal, schemeBenchmarkSig);
      // Per explicit request: every fund's full classification inputs and the badge they produced,
      // logged so a reviewer can verify each WATCH/NEEDS ATTENTION/UNDERPERFORMING has a real,
      // quantitative reason behind it rather than trusting the badge blind. Not user-facing —
      // stdout only, same ad-hoc structured-log convention already used elsewhere in this pipeline
      // (see extract.js's logInstallmentComposition).
      console.error(
        JSON.stringify({
          level: "info",
          event: "fund_classification",
          fund: s.scheme_name,
          judged_by: metricKindFor(s),
          // The metric the badge is actually judged by — an ANNUALIZED XIRR for a Live SIP fund,
          // never the real current loss (see current_pnl_pct below for that).
          judged_return_pct: round2(judgingReturnPct(s)),
          // The real, unannualized (current_value - investment_amount) / investment_amount — the
          // SAME number regardless of judged_by, and the only one that should ever be described as
          // "currently up/down X%".
          current_pnl_pct: round2(s.absolute_return_pct),
          benchmark_return_pct: round2(s.benchmark_return_pct),
          benchmark_gap_pct: round2(benchmarkGapPct(s.alpha, s.fund_return_pct, s.benchmark_return_pct)),
          sharpe: round2(s.sharpe_ratio),
          sortino: round2(s.sortino_ratio),
          alpha: round2(s.alpha),
          beta: round2(s.beta),
          volatility_pct: volatilityPct,
          max_drawdown_pct: round2(s.max_drawdown),
          holding_period_days: heldDays,
          final_badge: schemeFundStatus,
        })
      );
      return {
        name: s.scheme_name,
        category: s.scheme_category,
        // Whether fund_status below is judged by this fund's XIRR (a Live SIP still receiving
        // installments) rather than by return_percentage (Absolute Return) — see
        // metricKindFor/judgingReturnPct. Gemini never sees the raw XIRR number itself (not needed
        // for its allowed prose, and keeping the JSON small), just this label, so it can correctly
        // trust fund_status's own verdict for a Live SIP fund rather than re-deriving a
        // contradictory read from the differently-scaled return_percentage figure (see
        // SYSTEM_PROMPT rule 17).
        judged_by: metricKindFor(s) === "xirr" ? "XIRR" : "Absolute Return",
        // A real elapsed time, not a guess — so Gemini can (and per its instructions, must)
        // judge return_percentage in context instead of calling a brand-new fund's return "weak"
        // just because it's numerically smaller than a fund held for years. Null only when
        // first_investment_date itself is unknown.
        holding_period_months: holdingPeriodMonths,
        // Precomputed plain-English phrasing ("around 6 years") — see formatHoldingPeriod. Rule 17
        // in the fund-analysis prompt requires copying this verbatim instead of paraphrasing with
        // a vague qualifier like "a long holding period".
        holding_period_formatted: formatHoldingPeriod(holdingPeriodMonths),
        // The investor's own real numbers for this fund — preferred over the illustrative ₹1
        // lakh example below whenever available, since "your ₹50,000 became ₹58,000" is more
        // meaningful to read than a hypothetical.
        investment_amount: round2(s.investment_amount),
        investment_amount_formatted: fmtIndianRupees(s.investment_amount),
        current_value: round2(s.current_value),
        current_value_formatted: fmtIndianRupees(s.current_value),
        profit_loss: round2(s.profit_loss),
        profit_loss_formatted: fmtIndianRupees(Math.abs(s.profit_loss)),
        return_percentage: round2(s.absolute_return_pct),
        growth_on_100000: growthOn100000,
        growth_on_100000_formatted: fmtIndianRupees(growthOn100000),
        // volatility/beta/sharpe/sortino/alpha/max_drawdown/fund_return/benchmark_return stay in
        // the JSON as real, already-verified inputs for Gemini's own reasoning (rule: never
        // estimate, never invent a risk assessment) — the prompt instructs it to never write these
        // raw, jargon-labeled numbers or names ("Sharpe", "Sortino", "alpha", "beta") into
        // customer-facing text, only fund_status and plain-language conclusions drawn from them
        // (the same risk_adjusted_summary sentence this app's own deterministic fund_status_reason
        // already states, see riskAdjustedNarrativeClause, is included below so Gemini explains the
        // SAME verified conclusion rather than deriving a different one from the raw numbers).
        volatility_percentage: volatilityPct,
        beta: round2(s.beta),
        sharpe_ratio: round2(s.sharpe_ratio),
        sortino_ratio: round2(s.sortino_ratio),
        alpha: round2(s.alpha),
        fund_return_percentage: round2(s.fund_return_pct),
        benchmark_return_percentage: round2(s.benchmark_return_pct),
        // The comparison window the two returns above were measured over, in days —
        // exposed so any consumer re-deriving this fund's benchmark verdict (see
        // reportConsistency.js) puts the gap on the same per-year footing the badge
        // used, instead of judging a multi-year cumulative gap by one-year bands.
        benchmark_window_days: s.alpha_beta_window_days ?? null,
        // fund_return_percentage minus benchmark_return_percentage, in percentage points — the ONE
        // benchmark-relative number this fund's badge, recommendation and risk_adjusted_summary
        // were all actually decided by (see benchmarkGapPct). Exposed explicitly so the narrative
        // layer explains the same figure the report displays, rather than reasoning from the raw
        // alpha field above (a beta-adjusted quantity that is no longer what any verdict rests on).
        benchmark_difference_percentage: round2(benchmarkGapPct(s.alpha, s.fund_return_pct, s.benchmark_return_pct)),
        // The validated comparison the badge was judged on (calc-service's benchmark_comparison),
        // with both bases labelled — so any text about this fund can quote the annualized gap as a
        // per-year figure and the cumulative gap as a cumulative one, never one dressed as the other.
        // null when there is no comparison or it failed validation.
        benchmark_signal: schemeBenchmarkSig,
        benchmark_comparison: (() => {
          const bc = s.benchmark_comparison;
          if (!bc || !bc.valid) return null;
          return {
            benchmark_used: bc.benchmark_name,
            benchmark_data_type: bc.benchmark_type,
            method: bc.calculation_method,
            fund_cumulative_return_percentage: round2(bc.fund_return),
            benchmark_cumulative_return_percentage: round2(bc.benchmark_return),
            cumulative_gap_points: round2(bc.cumulative_gap),
            fund_annualized_return_percentage: round2(bc.annualized_fund_return),
            benchmark_annualized_return_percentage: round2(bc.annualized_benchmark_return),
            annualized_gap_points: round2(bc.annualized_gap),
          };
        })(),
        risk_adjusted_summary: riskAdjustedNarrativeClause(schemeRiskSignal, schemeBenchmarkSig),
        // The ONE deterministic recommendation for this fund — GIVEN here, never chosen by
        // Gemini (see recommendationFor's own comment, and geminiClient.js's prompt rule for how
        // Gemini is told to use this verbatim rather than deriving its own).
        recommendation: schemeRecommendation,
        max_drawdown_percentage: round2(s.max_drawdown),
        risk_level: riskometerLevel(s.scheme_category, s.scheme_name),
        // The fund's OWN long-term track record — real point-to-point NAV growth over each
        // window (annualized/CAGR for 1y+), computed by calc-service from the fund's full real
        // NAV history, completely independent of THIS investor's own purchase price or holding
        // period (see calc-service's trailing_returns.py). This is what lets the narrative say
        // "this specific position is down due to timing, but the fund's own longer history has
        // been strong" with a real number — never a vague "well-known fund" claim. null for any
        // window the fund's own history doesn't reach yet (e.g. a fund launched last year has no
        // real 5y number) — never estimated.
        long_term_track_record: {
          return_1y_percentage: round2(s.trailing_returns?.["1y"]),
          return_3y_percentage: round2(s.trailing_returns?.["3y"]),
          return_5y_percentage: round2(s.trailing_returns?.["5y"]),
          return_since_inception_percentage: round2(s.trailing_returns?.since_inception),
        },
        // This fund's own real top stock holdings (name + % of the fund's assets), from its
        // latest SEBI-mandated monthly disclosure — see calc-service's holdings_service.py. null
        // when unavailable (currently only resolves for a PPFAS/Parag Parikh scheme), never a
        // guess. Purely factual — never a basis for judging whether the fund will do well, which
        // would be exactly the kind of future-performance claim rule 2/11 already forbid; this
        // exists so the narrative can state real facts about the fund's composition, not predict
        // from them.
        top_holdings: Array.isArray(s.top_holdings)
          ? s.top_holdings.map((h) => ({ name: h.name, category: h.category, weight_percentage: round2(h.weight_pct) }))
          : null,
        fund_status: schemeFundStatus,
        // The classifier's own named concerns behind a WATCH-or-worse badge ("return", "benchmark",
        // "track_record", "risk") — what the Summary's "What Needs Review" line for this fund states.
        badge_concerns: schemeEvidence.concerns,
        // Regression: Gemini repeatedly (confirmed live, reproducibly, even after the system
        // prompt was strengthened with an explicit negative example) picked "Continue holding &
        // review later" for a fund that was young AND down — e.g. -0.01% over ~2 months — despite
        // fund_status correctly reading UNDERPERFORMING and the prompt explicitly forbidding that
        // combination. Asking it to derive "is this fund_status literally PROMISING START" from
        // fund_status/return_percentage/holding_period_months itself is exactly the reasoning step
        // it keeps getting wrong. Precomputed here instead — the same principle as fund_status
        // itself (never let Gemini invent or derive a judgment call it can't be checked against) —
        // so its only job is to check one boolean, not re-derive the condition it names.
        is_promising_start: schemeFundStatus === "PROMISING START",
        // Same precomputed-boolean principle as is_promising_start above — a fund this fresh (see
        // TOO_EARLY_MAX_DAYS) has no trustworthy return sign yet, positive or negative, so
        // Gemini must never describe it as either "doing well" or "underperforming"; it must only
        // say there isn't enough history yet. Never re-derive this from holding_period_months
        // yourself — check the boolean directly.
        is_too_early_to_judge: schemeFundStatus === "TOO EARLY TO JUDGE",
      };
    }),
  };
}
