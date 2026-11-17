import { useEffect, useRef } from "react";
import { LineChart } from "../components/charts.jsx";
import { BackIcon, ChevronIcon, StarIcon } from "../components/icons.jsx";
import { Card, Stat, StatusPill } from "../components/ui.jsx";
import { STATUSES, date, inr, number, pct, plainPct, relativeDay, signedInr, tone, units } from "../format.js";

const cell = (n) => (typeof n === "number" ? pct(n) : "—");

export default function FundDetail({ fund, onClose, onOpenTransactions }) {
  const top = useRef(null);
  useEffect(() => {
    top.current?.focus();
  }, [fund.code]);

  const meta = STATUSES[fund.status];
  const table = fund.returnsTable;
  const growth = fund.sparkline.filter((p) => typeof p.pct === "number");
  const paragraphs = fund.reason ? [fund.reason] : fund.summaryLines;

  return (
    <div className="detail" role="dialog" aria-modal="true" aria-label={fund.name}>
      <header className="detail-bar">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back" ref={top}><BackIcon /></button>
        <span>Fund details</span>
      </header>

      <div className="detail-body">
        <div className="detail-title">
          <h1>{fund.name}</h1>
          <div className="tags">
            <span>{fund.categoryShort}</span>
            <span>{fund.isLiveSip ? "SIP running" : fund.investmentType === "SIP" ? "SIP stopped" : "One-time"}</span>
            {fund.riskLevel && <span>{fund.riskLevel} risk</span>}
            {fund.starRating ? (
              <span className="stars" title={fund.starRatingSource || ""}>
                <StarIcon width={12} height={12} /> {fund.starRating} of 5{fund.starRatingSource ? ` · ${fund.starRatingSource}` : ""}
              </span>
            ) : null}
          </div>
        </div>

        <section className={`verdict-box verdict-${meta.key}`}>
          <div className="verdict-box-head">
            <StatusPill status={fund.status} large />
            <span>{meta.blurb}</span>
          </div>
          {fund.badge !== fund.status && <p className="badge-note">Detailed rating: {fund.badge.charAt(0) + fund.badge.slice(1).toLowerCase()}</p>}
          {paragraphs.map((text) => <p key={text}>{text}</p>)}
          {fund.benchmarkStatement && fund.reason && !fund.reason.includes(fund.benchmarkStatement) && <p>{fund.benchmarkStatement}</p>}
        </section>

        <Card title="Your investment">
          <div className="big-row">
            <div>
              <span className="stat-label">Current value</span>
              <b className="big-value">{inr(fund.value)}</b>
            </div>
            <span className={`chip-gain solid ${tone(fund.gain)}`}>{signedInr(fund.gain)} · {pct(fund.returnPct)}</span>
          </div>
          <div className="stat-grid">
            <Stat label="Invested" value={inr(fund.invested)} />
            <Stat label={fund.metricLabel} value={pct(fund.metricValue)} valueClass={tone(fund.metricValue)} sub={fund.metricLabel.startsWith("XIRR") ? "a year" : "since you invested"} />
            {fund.isLiveSip && fund.sipAmount ? <Stat label="Monthly SIP" value={inr(fund.sipAmount)} sub={fund.nextSipDate ? `next expected ${relativeDay(fund.nextSipDate)}` : undefined} /> : null}
            <Stat label="Invested since" value={date(fund.firstInvestmentDate, { month: "short", year: "numeric" })} sub={fund.heldLabel || undefined} />
            <Stat label="Units held" value={units(fund.units)} />
            <Stat label="NAV" value={`₹${number(fund.nav, 2)}`} sub={date(fund.navDate, { day: "numeric", month: "short" })} />
            {fund.weightPct !== null && <Stat label="Share of portfolio" value={plainPct(fund.weightPct)} />}
          </div>
          {onOpenTransactions && (
            <button type="button" className="row-link" onClick={() => onOpenTransactions(fund.code)}>
              See your transactions in this fund
              <ChevronIcon width={16} height={16} />
            </button>
          )}
        </Card>

        {(table.rows.length > 0 || table.yourRow) && (
          <Card title="Fund vs benchmark">
            <div className="table-wrap">
              <table className="returns">
                <thead>
                  <tr>
                    <th scope="col">Yearly return</th>
                    <th scope="col">Fund</th>
                    <th scope="col">Benchmark</th>
                    {table.hasCategory && <th scope="col">Category</th>}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((r) => (
                    <tr key={r.key}>
                      <th scope="row">{r.label}</th>
                      <td className={r.benchmark !== null && r.fund >= r.benchmark ? "lead" : ""}>{cell(r.fund)}</td>
                      <td>{cell(r.benchmark)}</td>
                      {table.hasCategory && <td>{cell(r.category)}</td>}
                    </tr>
                  ))}
                  {table.yourRow && (
                    <tr className="your-row">
                      <th scope="row">{table.yourRow.label}</th>
                      <td className={table.yourRow.gap >= 0 ? "lead" : ""}>{cell(table.yourRow.fund)}</td>
                      <td>{cell(table.yourRow.benchmark)}</td>
                      {table.hasCategory && <td />}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="fine">Benchmark: {table.benchmarkLabel}{table.hasCategory ? ` · Category: ${table.categoryLabel}` : ""}</p>
            {table.yourRow && (
              <p className={`gap-note ${table.yourRow.gap >= 0 ? "up" : "down"}`}>
                Your money is {Math.abs(table.yourRow.gap) < 0.05 ? "level with" : `${Math.abs(table.yourRow.gap).toFixed(1)} points ${table.yourRow.gap > 0 ? "ahead of" : "behind"}`} the benchmark on the same dates.
              </p>
            )}
            {table.source && <p className="fine">{table.source}</p>}
          </Card>
        )}

        {growth.length >= 2 && (
          <Card title="How the fund has moved">
            <LineChart
              label="Fund growth over time"
              zeroLine
              height={160}
              series={[{ name: "Fund", color: "var(--series-1)", points: growth.map((p) => ({ date: p.date, y: p.pct })) }]}
              format={(v) => pct(v, 1)}
            />
            <p className="fine">The fund's own NAV growth from the start of the period shown. Not your personal return.</p>
          </Card>
        )}

        <Card title="Risk">
          <div className="stat-grid">
            <Stat label="Riskometer" value={fund.riskLevel || "—"} />
            <Stat label="Biggest fall" value={fund.risk.maxDrawdownPct === null ? "—" : `−${Math.abs(fund.risk.maxDrawdownPct).toFixed(1)}%`} sub="peak to bottom" />
          </div>
        </Card>

        {fund.recommendation && (
          <Card title="Suggested next step">
            <p className="next-step">{fund.recommendation}</p>
            <p className="fine">A rule-based pointer from this fund's status. Please confirm with your adviser before acting.</p>
          </Card>
        )}

        {fund.topHoldings?.length > 0 && (
          <Card title="Top holdings in this fund">
            <ul className="holdings">
              {fund.topHoldings.map((h) => (
                <li key={h.name}>
                  <span>{h.name}</span>
                  <b>{typeof h.weight_pct === "number" ? plainPct(h.weight_pct) : ""}</b>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
