// The per-fund verdict: the same steps the stock project's report runs for every fund card
// (pdfReport.js classifyScheme / classificationByNameFor), without the PDF rendering around them.
// verificationJson.js and fundSummary.js beside this file are unmodified copies from that project —
// the badge rules live there, and this file only feeds them each fund's figures.
import {
  fundStatus,
  fundStatusReason,
  fundStatusEvidence,
  riskometerLevel,
  daysHeld,
  badgeHeldDays,
  averageReturnByCategory,
  reliablePeerPool,
  hasReliableCategoryPeer,
  judgingReturnPct,
  judgingCategoryKey,
  metricKindFor,
  recommendationFor,
  approxCalendarDuration,
  comparisonEvidence,
  benchmarkStatementFor,
  schemeGapSignal,
  calendarDuration,
  combinedRiskSignal,
  calmarRatio,
  reliableSharpe,
} from "./verificationJson.js";
import { fundReturnsTable, performanceLine, badgeLine } from "./fundSummary.js";

const REPORTED_WINDOWS = [
  ["1y", 1],
  ["3y", 3],
  ["5y", 5],
  ["10y", 10],
];

function reportedBenchmarkWindow(s) {
  const rt = s.reported_trailing_returns;
  if (!rt || !rt.fund || !rt.benchmark_returns) return null;
  const held = calendarDuration(s.first_investment_date, s.nav_date);
  const heldYears = held ? held.years + held.months / 12 : 0;
  const available = REPORTED_WINDOWS.filter(([key]) => Number.isFinite(rt.fund[key]) && Number.isFinite(rt.benchmark_returns[key]));
  if (!available.length) return null;
  const [key, years] = available.reduce((best, w) => (Math.abs(w[1] - heldYears) < Math.abs(best[1] - heldYears) ? w : best));
  return { years, fund: rt.fund[key], benchmark: rt.benchmark_returns[key] };
}

function reportedBenchmarkStatement(s) {
  const w = reportedBenchmarkWindow(s);
  if (!w) return null;
  const gap = w.fund - w.benchmark;
  const size = Math.abs(gap);
  const relation = size < 0.05 ? "level with" : gap > 0 ? "ahead of" : "behind";
  const amount = size < 0.05 ? "" : ` by ${size.toFixed(1)} points a year`;
  return `On the returns reported to AMFI, the fund has been ${relation} its official benchmark${amount}.`;
}

function classifyScheme(s, avgReturnByCategory, schemes) {
  const metricValue = judgingReturnPct(s);
  const metricKind = metricKindFor(s);
  const avgReturn = avgReturnByCategory[judgingCategoryKey(s)] ?? metricValue;
  const hasCategoryPeers = hasReliableCategoryPeer(s, schemes, judgingCategoryKey);
  const heldDays = badgeHeldDays(s);
  const riskEvidence = {
    sortino: s.sortino_ratio,
    alpha: s.alpha,
    fundReturnPct: s.fund_return_pct,
    benchmarkReturnPct: s.benchmark_return_pct,
    windowReturnPct: s.fund_window_return_pct,
    benchmarkWindowDays: s.alpha_beta_window_days,
    maxDrawdown: s.max_drawdown,
    currentPnlPct: s.absolute_return_pct,
    benchmarkName: s.benchmark_name,
    reportedTrailing: s.reported_trailing_returns,
    investmentDuration: s.investment_duration,
    sipStartDate: s.sip_start_date,
    sipInstallmentCount: s.sip_installment_count,
    purchaseTransactionCount: s.purchase_transaction_count,
    evaluationStartDate: s.evaluation_start_date,
    evaluationDuration: s.evaluation_duration,
    evaluationCapitalPct: s.evaluation_capital_pct,
    evaluationExcludedCapitalPct: s.evaluation_excluded_capital_pct,
    evaluationExcludedPurchaseCount: s.evaluation_excluded_purchase_count,
    firstInvestmentHeldDays: daysHeld(s.first_investment_date, s.nav_date ? new Date(s.nav_date) : undefined),
    ...comparisonEvidence(s),
  };
  const args = [metricValue, s.sharpe_ratio, avgReturn, heldDays, s.volatility, hasCategoryPeers, s.trailing_returns];
  const status = fundStatus(...args, metricKind, riskEvidence);
  const categoryAverageLabel =
    metricKind === "xirr"
      ? "average XIRR among your other live-SIP funds in this category"
      : "average return among your other one-time holdings in this category";
  const reason = fundStatusReason(...args, categoryAverageLabel, metricKind, riskEvidence);
  const gapSignal = schemeGapSignal(s);
  const benchmarkStatement =
    (gapSignal === null || gapSignal === undefined) && !s.benchmark_comparison
      ? reportedBenchmarkStatement(s) || benchmarkStatementFor(gapSignal, metricValue)
      : benchmarkStatementFor(gapSignal, metricValue);
  const riskSignal = combinedRiskSignal(
    reliableSharpe(s.sharpe_ratio, s.volatility),
    reliableSharpe(s.sortino_ratio, s.volatility),
    calmarRatio(s.fund_window_return_pct ?? s.fund_return_pct, s.max_drawdown)
  );
  const recommendation = recommendationFor(status, riskSignal, gapSignal);
  const xirrPeriod = metricKind === "xirr" ? calendarDuration(s.first_investment_date, s.nav_date) : null;
  const metricLabel =
    metricKind === "xirr"
      ? xirrPeriod && xirrPeriod.years < 1
        ? `XIRR (annualised from ${approxCalendarDuration(xirrPeriod)})`
        : "XIRR"
      : "Return";
  const evidence = fundStatusEvidence(...args, metricKind, riskEvidence);
  const returnsTable = fundReturnsTable(s);
  const heldPeriod = calendarDuration(s.first_investment_date, s.nav_date);
  const heldLabel = heldPeriod ? approxCalendarDuration(heldPeriod) : null;
  const summaryLines = [performanceLine(returnsTable), badgeLine(evidence, heldLabel)];
  return { status, reason, benchmarkStatement, recommendation, returnsTable, summaryLines, metricValue, metricKind, metricLabel, heldDays, heldLabel };
}

// The four words the customer sees, mapped down from the classifier's seven badges — the same
// mapping the stock dashboard uses (ReportDashboard.jsx toDisplayStatus). Never re-derives a verdict.
export function toDisplayStatus(fundStatusValue) {
  if (fundStatusValue === "WATCH" || fundStatusValue === "NEEDS ATTENTION") return "WATCH";
  if (fundStatusValue === "UNDERPERFORMING") return "OFF TRACK";
  if (fundStatusValue === "PROMISING START" || fundStatusValue === "TOO EARLY TO JUDGE") return "PROMISING START";
  return "ON TRACK"; // STRONG or ON TRACK
}

/** Every scheme's classification, in the same order as `schemes`. */
export function classifyPortfolio(schemes) {
  const avgReturnByCategory = averageReturnByCategory(reliablePeerPool(schemes), judgingReturnPct, judgingCategoryKey);
  return schemes.map((s) => ({
    ...classifyScheme(s, avgReturnByCategory, schemes),
    riskLevel: riskometerLevel(s.scheme_category, s.scheme_name),
  }));
}
