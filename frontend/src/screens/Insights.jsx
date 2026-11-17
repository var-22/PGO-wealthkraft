import { useMemo, useState } from "react";
import { Donut, Legend, LineChart, toSlices } from "../components/charts.jsx";
import { Card, Stat } from "../components/ui.jsx";
import { inr, number, pct, plainPct, tone } from "../format.js";

export default function Insights({ portfolio, onOpenFund }) {
  const { allocation, performanceSeries, benchmarkLabel, risk, funds, summary } = portfolio;
  const [active, setActive] = useState(null);
  const slices = useMemo(() => toSlices(allocation), [allocation]);

  const hasBenchmark = performanceSeries.some((p) => typeof p.benchmark === "number");
  const ranked = [...funds].filter((f) => typeof f.returnPct === "number").sort((a, b) => b.returnPct - a.returnPct);
  const best = ranked[0];
  const weakest = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  const sip = funds.filter((f) => f.isLiveSip);
  const sipValue = sip.reduce((sum, f) => sum + (f.value || 0), 0);
  const sipShare = summary.value > 0 ? (sipValue / summary.value) * 100 : 0;
  const biggest = funds[0];

  return (
    <div className="screen screen-pad">
      <header className="page-head">
        <h1>Insights</h1>
      </header>

      <div className="stack">
        {slices.length > 0 && (
          <Card title="Where your money is">
            <div className="alloc">
              <Donut slices={slices} active={active} onActive={setActive} centerTop={active ? plainPct(slices.find((s) => s.name === active)?.pct) : `${allocation.length}`} centerBottom={active || (allocation.length === 1 ? "category" : "categories")} />
              <ul className="alloc-key">
                {slices.map((s) => (
                  <li key={s.name} className={active === s.name ? "on" : ""} onPointerEnter={() => setActive(s.name)} onPointerLeave={() => setActive(null)}>
                    <i style={{ background: s.color }} />
                    <span>{s.name}</span>
                    <b>{plainPct(s.pct)}</b>
                  </li>
                ))}
              </ul>
            </div>
            {biggest && biggest.weightPct >= 40 && <p className="fine">{biggest.name} alone is {plainPct(biggest.weightPct, 0)} of your portfolio.</p>}
          </Card>
        )}

        {performanceSeries.length >= 2 && (
          <Card title={hasBenchmark ? "Your portfolio vs the market" : "Portfolio growth"}>
            {hasBenchmark && <Legend items={[{ name: "Your portfolio", color: "var(--series-1)" }, { name: benchmarkLabel || "Benchmark", color: "var(--series-2)", dashed: true }]} />}
            <LineChart
              label="Portfolio growth compared with the benchmark"
              zeroLine
              series={[
                { name: "Your portfolio", color: "var(--series-1)", points: performanceSeries.map((p) => ({ date: p.date, y: p.portfolio })) },
                ...(hasBenchmark ? [{ name: benchmarkLabel || "Benchmark", color: "var(--series-2)", dashed: true, points: performanceSeries.map((p) => ({ date: p.date, y: p.benchmark })) }] : []),
              ]}
              format={(v) => pct(v, 1)}
            />
            <p className="fine">Growth of the investments themselves from the first date shown, leaving out the effect of when you added money.</p>
          </Card>
        )}

        {(best || weakest) && (
          <Card title="Best and weakest">
            <div className="duo">
              {best && (
                <button type="button" className="duo-item" onClick={() => onOpenFund(best)}>
                  <span className="stat-label">Best return</span>
                  <b>{best.name}</b>
                  <span className={`duo-num ${tone(best.returnPct)}`}>{pct(best.returnPct)}</span>
                </button>
              )}
              {weakest && (
                <button type="button" className="duo-item" onClick={() => onOpenFund(weakest)}>
                  <span className="stat-label">Lowest return</span>
                  <b>{weakest.name}</b>
                  <span className={`duo-num ${tone(weakest.returnPct)}`}>{pct(weakest.returnPct)}</span>
                </button>
              )}
            </div>
            <p className="fine">Total return since you invested. Funds held for different lengths of time are not directly comparable.</p>
          </Card>
        )}

        <Card title="How you invest">
          <div className="stat-grid">
            <Stat label="Running SIPs" value={`${sip.length}`} sub={summary.monthlySip > 0 ? `${inr(summary.monthlySip)} a month` : undefined} />
            <Stat label="One-time holdings" value={`${funds.length - sip.length}`} />
            <Stat label="In SIP funds" value={plainPct(sipShare, 0)} sub="of current value" />
            <Stat label="Largest holding" value={plainPct(biggest?.weightPct, 0)} sub={biggest?.categoryShort} />
          </div>
        </Card>

        {risk && (
          <Card title="Portfolio risk">
            <div className="stat-grid">
              <Stat label="Risk level" value={risk.category || "—"} />
              <Stat label="Biggest fall" value={`−${Math.abs(risk.maxDrawdownPct).toFixed(1)}%`} sub="peak to bottom" />
              <Stat label="Beta" value={number(risk.beta)} sub="1.0 moves with the market" />
              <Stat label="Diversification" value={`${Math.round(risk.diversificationScore)} / 100`} sub="spread across categories" />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
