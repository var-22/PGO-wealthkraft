import { useMemo, useState } from "react";
import { Donut, LineChart, Sparkline } from "../components/charts.jsx";
import { ArrowIcon, BellIcon, CalendarIcon, ChevronIcon, ClockIcon, InsightsIcon, ScaleIcon, SearchIcon, ShieldIcon, StatusIcon, TrendIcon, WalletIcon } from "../components/icons.jsx";
import { Notice } from "../components/ui.jsx";
import { readPref, writePref } from "../prefs.js";
import { date, inr, inrShort, number, pct, plainPct, relativeDay, tone } from "../format.js";

const RANGES = [
  { key: "6M", months: 6 },
  { key: "1Y", months: 12 },
  { key: "3Y", months: 36 },
  { key: "All", months: null },
];

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** A short scale label for the graph's left edge: ₹20L, ₹1.5Cr. */
function scaleLabel(v) {
  if (inrShort(v).includes("•")) return "•••"; // amounts are hidden
  const a = Math.abs(v);
  const trim = (n) => String(Number(n.toFixed(1)));
  if (a >= 1e7) return `₹${trim(v / 1e7)}Cr`;
  if (a >= 1e5) return `₹${trim(v / 1e5)}L`;
  if (a >= 1e3) return `₹${Math.round(v / 1e3)}K`;
  return `₹${Math.round(v)}`;
}

const STALE_DAYS = 5; // longer than any run of market holidays
const DAY = 86400000;
const BADGES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)"];
const CLASS_COLOR = { Equity: "var(--series-1)", Debt: "var(--series-3)", Hybrid: "var(--series-4)", Others: "var(--class-other)" };
const TX_LABEL = { SIP: "SIP instalment", BUY: "Purchase", SELL: "Withdrawal", DIVIDEND: "Dividend" };

const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(`${iso}T00:00:00Z`).getTime()) / DAY) : 0);
const spanDays = (list) => (list.length < 2 ? 0 : (new Date(list[list.length - 1].date) - new Date(list[0].date)) / DAY);

/** Growth from a later starting day: a "% since the first date" series restarted at `base`. */
const rebase = (value, base) => (typeof value === "number" && typeof base === "number" ? ((1 + value / 100) / (1 + base / 100) - 1) * 100 : null);

function lastMonths(list, months) {
  if (!list.length) return list;
  const cutoff = new Date(`${list[list.length - 1].date}T00:00:00Z`);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const iso = cutoff.toISOString().slice(0, 10);
  const sliced = list.filter((p) => p.date >= iso);
  return sliced.length >= 2 ? sliced : list;
}

/** Equity, Debt, Hybrid or Others, read off the fund's official category. */
function assetClass(category = "") {
  const text = category.toLowerCase();
  if (text.startsWith("equity")) return "Equity";
  if (text.startsWith("debt")) return "Debt";
  if (text.startsWith("hybrid")) return "Hybrid";
  return "Others";
}

/** Where the marker sits on the low-to-high risk meter, from the risk level's wording. */
function riskPosition(level = "") {
  const text = level.toLowerCase();
  if (text.includes("very high")) return 0.95;
  if (text.includes("moderately high")) return 0.75;
  if (text.includes("high")) return 0.85;
  if (text.includes("moderately low") || text.includes("low to moderate")) return 0.32;
  if (text.includes("low")) return 0.15;
  return 0.55;
}

/** The banner's picture: rising bars, an arrow over them and two stacks of coins. */
function GrowthArt() {
  const coins = (x, count) => Array.from({ length: count }, (_, i) => (
    <g key={i} transform={`translate(${x}, ${150 - i * 9})`}>
      <ellipse cx="0" cy="4" rx="21" ry="7" fill="#e39a00" />
      <ellipse cx="0" cy="0" rx="21" ry="7" fill="#ffc933" />
      <ellipse cx="0" cy="0" rx="14" ry="4" fill="#ffdb70" />
    </g>
  ));
  return (
    <svg className="banner-art" viewBox="0 0 230 170" aria-hidden="true">
      <defs>
        <linearGradient id="art-bar" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#4aa3ff" />
          <stop offset="1" stopColor="#1f5fd6" />
        </linearGradient>
      </defs>
      <ellipse cx="118" cy="158" rx="108" ry="8" fill="#1f5fd6" opacity="0.1" />
      {[[14, 140, 16], [42, 128, 28], [70, 110, 46], [98, 88, 68], [126, 58, 98]].map(([x, y, h], i) => (
        <rect key={x} className="art-bar" x={x} y={y} width="21" height={h} rx="4" fill="url(#art-bar)" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
      <path className="art-arrow" d="M10 124C60 112 104 82 138 28" fill="none" stroke="#1f5fd6" strokeWidth="6" strokeLinecap="round" />
      <path className="art-arrow" d="M120 26l22-4-2 22" fill="none" stroke="#1f5fd6" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      {coins(176, 6)}
      {coins(206, 3)}
      <g className="art-leaf">
        <path d="M176 98V72" stroke="#2e9d4d" strokeWidth="3.500" strokeLinecap="round" />
        <path d="M176 80c-2-14-12-20-24-20 0 13 9 21 24 20z" fill="#47c266" />
        <path d="M176 74c1-15 11-23 25-24 1 15-9 24-25 24z" fill="#2fae54" />
      </g>
    </svg>
  );
}

function Tile({ icon, tint, label, value, valueClass = "", onClick, children }) {
  return (
    <button type="button" className="tile" onClick={onClick} style={{ "--tint": tint }}>
      <span className="tile-icon">{icon}</span>
      <span className="tile-text">
        <span className="tile-label">{label}</span>
        <b className={`tile-value ${valueClass}`}>{value}</b>
      </span>
      <ChevronIcon className="tile-chev" width={16} height={16} />
      {children && <span className="tile-extra">{children}</span>}
    </button>
  );
}

export default function Home({ user, portfolio, onRefresh, refreshing, onOpenFund, onShowStatus, onSeeAll, onGo, onOpenTransactions, installer }) {
  const { summary, health, funds, valueSeries, risk, rejected, performanceSeries = [], recentTransactions = [], upcomingSips = [] } = portfolio;
  const [range, setRange] = useState("All");
  const [scrub, setScrub] = useState(null); // index of the day being touched on the graph
  const [slice, setSlice] = useState(null);
  const [installHidden, setInstallHidden] = useState(() => readPref("install-hidden", "0") === "1");

  const stale = daysSince(portfolio.asOf) > STALE_DAYS;
  const flagged = funds.filter((f) => f.status === "OFF TRACK" || f.status === "WATCH");
  const alerts = flagged.length + rejected.length;
  const openAlerts = () => {
    if (flagged.length) onShowStatus(flagged.some((f) => f.status === "OFF TRACK") ? "OFF TRACK" : "WATCH");
    else if (rejected.length) onGo("profile");
    else onSeeAll();
  };

  // ---- the graph: what the portfolio is worth against the money put in ----
  const hasGraph = valueSeries.length >= 2;
  const valueDays = spanDays(valueSeries);
  // Only the periods the history actually covers are offered.
  const ranges = RANGES.filter((r) => !r.months || valueDays > r.months * 30.44 + 15);
  const activeRange = ranges.find((r) => r.key === range) || ranges[ranges.length - 1] || null;
  const points = useMemo(() => (activeRange?.months ? lastMonths(valueSeries, activeRange.months) : valueSeries), [valueSeries, activeRange]);
  // The "invested" line is drawn only when every point carries it.
  const hasInvested = valueSeries.length > 0 && valueSeries.every((p) => typeof p.invested === "number");
  const graphSeries = useMemo(() => [
    { name: "Current value", color: "var(--series-1)", points: points.map((p) => ({ date: p.date, y: p.value })) },
    ...(hasInvested ? [{ name: "Invested", color: "var(--market)", points: points.map((p) => ({ date: p.date, y: p.invested })) }] : []),
  ], [points, hasInvested]);
  // The figures above the graph follow the finger; untouched, they show the latest day.
  const at = (scrub !== null && points[scrub]) || points[points.length - 1] || null;
  const atGain = at && hasInvested ? at.value - at.invested : null;

  // ---- return tile: the last year's growth when a year of history exists, else the yearly rate ----
  const perfDays = spanDays(performanceSeries);
  const yearList = perfDays >= 330 ? lastMonths(performanceSeries, 12) : null;
  const yearReturn = yearList ? rebase(yearList[yearList.length - 1].portfolio, yearList[0].portfolio) : null;
  const spark = useMemo(() => {
    const list = yearList || performanceSeries;
    const step = Math.max(1, Math.floor(list.length / 40));
    return list.filter((_, i) => i % step === 0 || i === list.length - 1).map((p) => ({ pct: p.portfolio }));
  }, [yearList, performanceSeries]);

  // ---- allocation by asset class ----
  const classes = useMemo(() => {
    const sums = {};
    funds.forEach((f) => {
      const name = assetClass(f.category);
      sums[name] = (sums[name] || 0) + (f.weightPct || 0);
    });
    return ["Equity", "Debt", "Hybrid", "Others"].filter((n) => sums[n] > 0).map((n) => ({ name: n, pct: sums[n], color: CLASS_COLOR[n] }));
  }, [funds]);
  const shown = classes.find((c) => c.name === slice) || null;

  const onTrack = funds.filter((f) => f.status === "ON TRACK" || f.status === "PROMISING START").length;
  const initial = user.name.trim()[0]?.toUpperCase();

  return (
    <div className="screen home">
      <header className="topbar">
        <div className="brand">
          <img src="/pgo-logo.png" alt="PGO Wealth" width="44" height="44" />
          <span>{greeting()},<b>{user.name.trim().split(/\s+/)[0]}</b></span>
        </div>
        <div className="topbar-tools">
          <button type="button" className="bell" onClick={openAlerts} aria-label={alerts ? `${alerts} ${alerts === 1 ? "item needs" : "items need"} a look` : "No alerts"}>
            <BellIcon width={26} height={26} />
            {alerts > 0 && <i />}
          </button>
          <button type="button" className="avatar avatar-me" onClick={() => onGo("profile")} aria-label="Open your profile">{initial}</button>
        </div>
      </header>

      <div className="stack home-stack">
        <section className="banner-hero">
          <div className="banner-copy">
            <span className="banner-tag">Your Wealth Journey, Smarter</span>
            <h1>Mutual Fund Analysis &amp; Portfolio Tracking</h1>
            <p>Track. Analyse. Plan. Grow.</p>
            <button type="button" className="banner-cta" onClick={onSeeAll}>Explore Funds <ArrowIcon width={18} height={18} /></button>
          </div>
          <GrowthArt />
        </section>

        {installer?.state === "ready" && !installHidden && (
          <div className="banner banner-install">
            <img src="/icons/icon-192.png" alt="" width="40" height="40" />
            <span className="banner-text">
              <b>Install PGO Wealth</b>
              <span>Open it from your home screen like any app.</span>
            </span>
            <button type="button" className="btn-small" onClick={installer.install}>Install</button>
            <button type="button" className="banner-close" onClick={() => { writePref("install-hidden", "1"); setInstallHidden(true); }} aria-label="Not now">×</button>
          </div>
        )}

        {portfolio.source === "sample" && (
          <button type="button" className="banner" onClick={() => onGo("profile")}>
            <span className="banner-text">
              <b>This is a sample portfolio</b>
              <span>Add your own transactions to see your real holdings.</span>
            </span>
            <ChevronIcon width={18} height={18} />
          </button>
        )}
        {portfolio.updating && (
          <p className="updating" role="status"><i />Bringing in today's prices… figures shown are as of {date(portfolio.asOf, { day: "numeric", month: "short" })}.</p>
        )}
        {stale && !portfolio.updating && (
          <Notice kind="warn">
            Prices are from {date(portfolio.asOf)}. <button type="button" className="link-inline" onClick={onRefresh} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh now"}</button>
          </Notice>
        )}

        <section className="tiles" aria-label="Summary">
          <Tile icon={<WalletIcon />} tint="var(--series-1)" label="Portfolio Value" value={inrShort(summary.value)} onClick={onSeeAll}>
            <span className={tone(summary.gain)}>{summary.gain >= 0 ? "▲" : "▼"} {pct(summary.returnPct)}</span> from {inrShort(summary.invested)}
          </Tile>

          {yearReturn !== null ? (
            <Tile icon={<CalendarIcon />} tint="var(--class-other)" label="1 Year Return" value={plainPct(yearReturn)} valueClass={tone(yearReturn)} onClick={() => onGo("insights")}>
              <Sparkline points={spark} width={92} height={30} className={yearReturn >= 0 ? "spark-up" : "spark-down"} />
            </Tile>
          ) : (
            <Tile icon={<CalendarIcon />} tint="var(--class-other)" label="Yearly Return" value={summary.xirrPct === null ? "—" : plainPct(summary.xirrPct)} valueClass={tone(summary.xirrPct)} onClick={() => onGo("insights")}>
              XIRR, a year
            </Tile>
          )}

          {risk?.category ? (
            <Tile icon={<ShieldIcon />} tint="var(--series-3)" label="Risk Level" value={risk.category} onClick={() => onGo("insights")}>
              <span className="meter"><i style={{ left: `${riskPosition(risk.category) * 100}%` }} /></span>
            </Tile>
          ) : (
            <Tile icon={<ShieldIcon />} tint="var(--series-3)" label="On Track" value={`${onTrack} of ${health.total}`} onClick={onSeeAll}>
              {health.total === 1 ? "fund" : "funds"} doing what they should
            </Tile>
          )}

          {typeof risk?.beta === "number" ? (
            <Tile icon={<ScaleIcon />} tint="var(--series-4)" label="Beta" value={number(risk.beta)} onClick={() => onGo("insights")}>
              {risk.beta < 0.95 ? "Moves less than the market" : risk.beta > 1.05 ? "Moves more than the market" : "Moves with the market"}
            </Tile>
          ) : summary.monthlySip > 0 ? (
            <Tile icon={<ScaleIcon />} tint="var(--series-4)" label="Monthly SIP" value={inrShort(summary.monthlySip)} onClick={onSeeAll}>
              {upcomingSips[0] ? `next ${relativeDay(upcomingSips[0].date)}` : "running"}
            </Tile>
          ) : (
            <Tile icon={<ScaleIcon />} tint="var(--series-4)" label="Funds" value={`${funds.length}`} onClick={onSeeAll}>in your portfolio</Tile>
          )}
        </section>

        {hasGraph && at && (
          <section className="card perf">
            <header className="perf-head">
              <h2><TrendIcon width={22} height={22} /> Portfolio Performance</h2>
              {ranges.length > 1 && (
                <div className="pills" role="group" aria-label="Period">
                  {ranges.map((r) => (
                    <button key={r.key} type="button" className={activeRange?.key === r.key ? "on" : ""} aria-pressed={activeRange?.key === r.key} onClick={() => { setRange(r.key); setScrub(null); }}>{r.key}</button>
                  ))}
                </div>
              )}
            </header>
            <div className={`perf-read${scrub !== null ? " live" : ""}`}>
              <div>
                <span><i style={{ background: "var(--series-1)" }} />Current value</span>
                <b>{inr(at.value)}</b>
              </div>
              {hasInvested && (
                <div>
                  <span><i style={{ background: "var(--market)" }} />Invested</span>
                  <b>{inr(at.invested)}</b>
                </div>
              )}
              <p>
                {scrub !== null ? date(at.date) : "Today"}
                {atGain !== null && <> · <span className={tone(atGain)}>{atGain >= 0 ? "gain" : "loss"} {inr(Math.abs(atGain))}{at.invested > 0 ? ` (${pct((atGain / at.invested) * 100)})` : ""}</span></>}
              </p>
            </div>
            <div key={activeRange?.key || "all"}>
              <LineChart
                label={hasInvested ? "Current value and money invested over time" : "Portfolio value over time"}
                area
                endLabels
                tip={false}
                onActive={setScrub}
                height={230}
                series={graphSeries}
                format={(v, tick) => (tick ? scaleLabel(v) : inrShort(v))}
              />
            </div>
            <p className="fine perf-hint">Drag across the graph to see any day.</p>
          </section>
        )}

        {upcomingSips.length > 0 && (
          <section className="card mini">
            <header className="mini-head">
              <h2><CalendarIcon width={20} height={20} /> Upcoming SIPs</h2>
              <span className="card-note">{inr(summary.monthlySip)} a month</span>
            </header>
            <ul className="sips">
              {upcomingSips.map((s) => {
                const target = funds.find((f) => f.code === s.code);
                return (
                  <li key={s.code}>
                    <button type="button" className="sip" onClick={() => target && onOpenFund(target)}>
                      <span className="sip-date" aria-hidden="true">
                        <b>{date(s.date, { day: "numeric" })}</b>
                        {date(s.date, { month: "short" })}
                      </span>
                      <span className="sip-name">
                        <b>{s.name}</b>
                        <span>Expected {relativeDay(s.date)}</span>
                      </span>
                      <b className="sip-amount">{inr(s.amount)}</b>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="explore">
          <header className="section-head">
            <h2><SearchIcon width={24} height={24} /> Your Funds</h2>
            <button type="button" className="link" onClick={onSeeAll}>View All <ArrowIcon width={16} height={16} /></button>
          </header>
          <div className="fund-strip">
            {funds.slice(0, 8).map((f, i) => (
              <button key={f.code} type="button" className="fund-card" onClick={() => onOpenFund(f)}>
                <span className="fund-badge" style={{ background: BADGES[i % BADGES.length] }}>{f.name.trim()[0]?.toUpperCase()}</span>
                <b>{f.name}</b>
                <span className={tone(f.returnPct)}>{typeof f.returnPct === "number" ? (f.returnPct >= 0 ? "▲ " : "▼ ") + plainPct(Math.abs(f.returnPct)) : "—"}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="duo-cards">
          {classes.length > 0 && (
            <section className="card mini">
              <header className="mini-head">
                <h2><InsightsIcon width={20} height={20} /> Portfolio Allocation</h2>
              </header>
              <div className="alloc-mini">
                <Donut
                  slices={classes}
                  size={124}
                  active={slice}
                  onActive={setSlice}
                  centerTop={shown ? plainPct(shown.pct, 0) : inrShort(summary.value)}
                  centerBottom={shown ? shown.name : "Total"}
                  label={classes.map((c) => `${c.name} ${plainPct(c.pct)}`).join(", ")}
                />
                <ul>
                  {classes.map((c) => (
                    <li key={c.name}>
                      <button type="button" className={slice === c.name ? "on" : ""} onClick={() => setSlice(slice === c.name ? null : c.name)}>
                        <i style={{ background: c.color }} />
                        <span>{c.name}</span>
                        <b>{plainPct(c.pct)}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <section className="card mini">
            <header className="mini-head">
              <h2><ClockIcon width={20} height={20} /> Recent Activity</h2>
              <button type="button" className="link" onClick={() => onOpenTransactions()}>View All <ArrowIcon width={14} height={14} /></button>
            </header>
            <ul className="timeline">
              {recentTransactions.map((t, i) => (
                <li key={`${t.date}-${t.code}-${i}`} className={`tl-${t.type.toLowerCase()}`}>
                  <b>{TX_LABEL[t.type] || t.type} · {inr(t.amount)}</b>
                  <span>{t.name}</span>
                  <span>{date(t.date)}</span>
                </li>
              ))}
              {recentTransactions.length === 0 && <li className="tl-empty"><span>No transactions yet.</span></li>}
            </ul>
          </section>
        </div>

        {flagged.length > 0 && (
          <button type="button" className="banner banner-warn" onClick={openAlerts}>
            <span className="dot dot-watch"><StatusIcon status="WATCH" size={12} /></span>
            <span className="banner-text">
              <b>{flagged.length} {flagged.length === 1 ? "fund needs" : "funds need"} a look</b>
              <span>{flagged.slice(0, 2).map((f) => f.name).join(", ")}{flagged.length > 2 ? ` and ${flagged.length - 2} more` : ""}</span>
            </span>
            <ChevronIcon width={18} height={18} />
          </button>
        )}

        <p className="fine center">
          Mutual fund investments are subject to market risks. Past performance does not guarantee future returns.
        </p>
      </div>
    </div>
  );
}
