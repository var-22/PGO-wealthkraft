// Turns a customer's transactions into what the app shows. The numbers (value, XIRR, benchmark
// comparison, risk) come from the calc-service; the on-track verdicts come from the classifier
// copied from the stock project. Nothing here is written by an AI model.
import { createHash } from "node:crypto";
import axios from "axios";
import { classifyPortfolio, toDisplayStatus } from "../classifier/classify.js";
import { categoryShortName } from "../classifier/fundSummary.js";
import { sipPlan } from "./sipPlan.js";
import { readAnalysis, readTransactions, saveAnalysis } from "./store.js";

const CALC_SERVICE_URL = process.env.CALC_SERVICE_URL || "http://localhost:8000";

// NAVs are published once a day, so one calc-service run per customer per day (India time) is enough.
const todayIst = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
const fingerprint = (transactions) => createHash("sha256").update(JSON.stringify(transactions)).digest("hex");

const inFlight = new Map();
const failed = new Map();

async function analysisFor(userId, transactions, force) {
  const key = `${todayIst()}:${fingerprint(transactions)}`;
  const cached = readAnalysis(userId);
  // A run already under way for these same transactions is joined, never started twice (the app
  // re-checks while it waits).
  const running = inFlight.get(userId);
  if (running?.key === key) return running.promise;
  // A run that failed after the app stopped waiting is reported once, on the next check.
  const failure = failed.get(userId);
  if (failure) {
    failed.delete(userId);
    if (failure.key === key) throw failure.error;
  }
  if (!force && cached?.key === key) return cached;
  const promise = (async () => {
    try {
      const { data } = await axios.post(`${CALC_SERVICE_URL}/analyze`, { transactions, snapshot_rows: [] }, { timeout: 900000 });
      const record = { key, computedAt: new Date().toISOString(), result: data };
      // Only kept if the customer hasn't replaced their transactions while this was running.
      if (fingerprint(readTransactions(userId)?.transactions || []) === fingerprint(transactions)) saveAnalysis(userId, record);
      return record;
    } catch (error) {
      failed.set(userId, { key, error });
      throw error;
    } finally {
      if (inFlight.get(userId)?.key === key) inFlight.delete(userId);
    }
  })();
  inFlight.set(userId, { key, promise });
  return promise;
}

const num = (n) => (typeof n === "number" && Number.isFinite(n) ? n : null);
const round2 = (n) => (num(n) === null ? null : Math.round(n * 100) / 100);

const STATUS_ORDER = ["ON TRACK", "PROMISING START", "WATCH", "OFF TRACK"];

function fundView(s, c, totalValue, sip) {
  return {
    code: s.scheme_code,
    name: s.scheme_name,
    category: s.scheme_category,
    categoryShort: categoryShortName(s.scheme_category),
    status: toDisplayStatus(c.status),
    badge: c.status,
    reason: c.reason,
    summaryLines: c.summaryLines.filter(Boolean),
    benchmarkStatement: c.benchmarkStatement || null,
    recommendation: c.recommendation || null,
    riskLevel: c.riskLevel,
    invested: round2(s.investment_amount),
    value: round2(s.current_value),
    gain: round2(s.profit_loss),
    returnPct: round2(s.absolute_return_pct),
    xirrPct: num(s.xirr) === null ? null : round2(s.xirr * 100),
    // The figure the badge was judged on, with its own label (an XIRR for a running SIP).
    metricLabel: c.metricLabel,
    metricValue: round2(c.metricValue),
    weightPct: totalValue > 0 ? round2((s.current_value / totalValue) * 100) : null,
    isLiveSip: Boolean(s.is_live_sip),
    // The calc-service's own figure when it gives one, else the customer's latest instalment.
    sipAmount: round2(s.sip_amount) ?? (s.is_live_sip ? sip?.amount ?? null : null),
    nextSipDate: s.is_live_sip ? sip?.nextDate ?? null : null,
    investmentType: s.investment_type || null,
    firstInvestmentDate: s.first_investment_date || null,
    heldLabel: c.heldLabel,
    units: num(s.units_held),
    nav: num(s.current_nav),
    navDate: s.nav_date || null,
    benchmarkName: s.benchmark_name || null,
    returnsTable: {
      benchmarkLabel: c.returnsTable.benchmarkLabel,
      categoryLabel: c.returnsTable.categoryLabel,
      hasCategory: c.returnsTable.hasCategory,
      rows: c.returnsTable.rows,
      yourRow: c.returnsTable.yourRow,
      source: c.returnsTable.source,
    },
    risk: {
      volatilityPct: num(s.volatility) === null ? null : round2(s.volatility * 100),
      maxDrawdownPct: round2(s.max_drawdown),
      sharpe: round2(s.sharpe_ratio),
      beta: round2(s.beta),
    },
    starRating: s.star_rating ?? null,
    starRatingSource: s.star_rating_source ?? null,
    topHoldings: Array.isArray(s.top_holdings) ? s.top_holdings.slice(0, 8) : null,
    sparkline: (s.sparkline || []).map((p) => ({ date: p.date, pct: p.pct })),
  };
}

function healthView(funds) {
  const totalValue = funds.reduce((sum, f) => sum + (f.value || 0), 0);
  const groups = STATUS_ORDER.map((status) => {
    const members = funds.filter((f) => f.status === status);
    const value = members.reduce((sum, f) => sum + (f.value || 0), 0);
    return { status, count: members.length, valuePct: totalValue > 0 ? round2((value / totalValue) * 100) : 0 };
  });
  const count = (status) => groups.find((g) => g.status === status).count;
  // The headline is only a roll-up of the per-fund badges: any off-track fund, else any fund on
  // watch, else on track. It adds no judgement of its own.
  const headline = count("OFF TRACK") > 0 ? "NEEDS ATTENTION" : count("WATCH") > 0 ? "MOSTLY ON TRACK" : "ON TRACK";
  return { headline, total: funds.length, groups };
}

function view(record, transactions) {
  const { schemes, portfolio, rejected = [] } = record.result;
  const classifications = classifyPortfolio(schemes);
  const totalValue = portfolio.total_current_value || 0;
  const plan = sipPlan(transactions, schemes.filter((s) => s.is_live_sip).map((s) => s.scheme_code), todayIst());
  const funds = schemes
    .map((s, i) => fundView(s, classifications[i], totalValue, plan[String(s.scheme_code)]))
    .sort((a, b) => (b.value || 0) - (a.value || 0));
  const riskReal = portfolio.risk_data_available === true;
  return {
    asOf: schemes.map((s) => s.nav_date).filter(Boolean).sort().pop() || null,
    computedAt: record.computedAt,
    summary: {
      invested: round2(portfolio.total_investment),
      value: round2(portfolio.total_current_value),
      gain: round2(portfolio.total_profit_loss),
      returnPct: round2(portfolio.total_absolute_return_pct),
      xirrPct: num(portfolio.xirr) === null ? null : round2(portfolio.xirr * 100),
      monthlySip: round2(funds.reduce((sum, f) => sum + (f.isLiveSip ? f.sipAmount || 0 : 0), 0)),
    },
    health: healthView(funds),
    allocation: Object.entries(portfolio.concentration?.by_category || {})
      .map(([name, pct]) => ({ name: categoryShortName(name), pct: round2(pct) }))
      .sort((a, b) => b.pct - a.pct),
    // Portfolio risk figures are shown only when the calc-service actually computed them.
    risk: riskReal
      ? {
          // The same three the stock report shows; portfolio volatility and Sharpe are left out.
          category: portfolio.risk_category,
          maxDrawdownPct: round2(portfolio.max_drawdown),
          beta: round2(portfolio.beta),
          diversificationScore: round2(portfolio.diversification_score),
        }
      : null,
    // Running SIPs with a known monthly date, soonest first.
    upcomingSips: funds
      .filter((f) => f.isLiveSip && f.nextSipDate)
      .map((f) => ({ code: f.code, name: f.name, amount: f.sipAmount, date: f.nextSipDate }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    valueSeries: (portfolio.value_series || []).map((p) => ({ date: p.date, value: round2(p.value), invested: round2(p.invested) })),
    performanceSeries: (portfolio.performance_series || []).map((p) => ({ date: p.date, portfolio: round2(p.portfolio_pct), benchmark: round2(p.benchmark_pct) })),
    benchmarkLabel: portfolio.benchmark_label || null,
    funds,
    rejected: rejected.map((r) => ({ code: r.scheme_code, name: r.scheme_name, reason: r.reason })),
  };
}

// How long one request waits for the calc-service before answering "still preparing". The run
// itself carries on and is saved, so the app's next check picks it up.
const WAIT_MS = 20000;
export const PREPARING = Symbol("preparing");

/** null when the customer has no transactions yet; PREPARING while the first run of the day is under way. */
export async function portfolioFor(userId, { force = false } = {}) {
  const stored = readTransactions(userId);
  if (!stored?.transactions?.length) return null;
  const pending = analysisFor(userId, stored.transactions, force);
  pending.catch(() => {}); // a failure after we stopped waiting is reported on the next check
  let timer;
  const record = await Promise.race([pending, new Promise((resolve) => { timer = setTimeout(() => resolve(PREPARING), WAIT_MS); })]);
  clearTimeout(timer);
  if (record === PREPARING) return PREPARING;
  failed.delete(userId); // this request saw the outcome itself
  if (!record.result.schemes?.length) {
    const error = new Error("NO_SCHEMES");
    error.rejected = record.result.rejected || [];
    throw error;
  }
  return {
    ...view(record, stored.transactions),
    source: stored.source,
    importedAt: stored.importedAt,
    transactionCount: stored.transactions.length,
    // The latest few transactions, for the home screen's "recent activity".
    recentTransactions: transactionsFor(userId).slice(0, 3),
  };
}

/** The customer's own transaction list, newest first, with each row's rupee amount worked out. */
export function transactionsFor(userId) {
  const stored = readTransactions(userId);
  return (stored?.transactions || [])
    .map((t) => ({
      code: String(t.scheme_code),
      name: t.scheme_name,
      type: t.transaction_type,
      units: t.units,
      nav: t.nav,
      amount: round2(t.units * t.nav),
      date: t.transaction_date,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
