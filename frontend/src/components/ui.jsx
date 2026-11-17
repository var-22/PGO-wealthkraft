import { STATUSES, STATUS_ORDER, inr, pct, tone } from "../format.js";
import { ChevronIcon, StatusIcon } from "./icons.jsx";
import { Sparkline } from "./charts.jsx";

export function StatusPill({ status, large = false }) {
  const meta = STATUSES[status] || STATUSES["ON TRACK"];
  return (
    <span className={`pill pill-${meta.key}${large ? " pill-lg" : ""}`}>
      <StatusIcon status={status} size={large ? 16 : 13} />
      {meta.label}
    </span>
  );
}

/** How the portfolio's money is spread across the four states: one stacked bar plus a labelled key. */
export function HealthBar({ groups, onPick }) {
  const present = STATUS_ORDER.map((status) => groups.find((g) => g.status === status)).filter((g) => g && g.count > 0);
  return (
    <div className="health">
      <div className="health-bar" role="img" aria-label={present.map((g) => `${STATUSES[g.status].label}: ${g.count} funds, ${g.valuePct}% of value`).join("; ")}>
        {present.map((g) => (
          <span key={g.status} className={`seg seg-${STATUSES[g.status].key}`} style={{ flexGrow: Math.max(g.valuePct, 3) }} />
        ))}
      </div>
      <div className="health-key">
        {present.map((g) => (
          <button key={g.status} type="button" className="health-row" onClick={() => onPick?.(g.status)}>
            <span className={`dot dot-${STATUSES[g.status].key}`}><StatusIcon status={g.status} size={12} /></span>
            <span className="health-name">{STATUSES[g.status].label}</span>
            <span className="health-count">{g.count} {g.count === 1 ? "fund" : "funds"}</span>
            <span className="health-share">{Math.round(g.valuePct)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function FundRow({ fund, onOpen }) {
  return (
    <button type="button" className="fund-row" onClick={() => onOpen(fund)}>
      <div className="fund-row-top">
        <div className="fund-row-name">
          <b>{fund.name}</b>
          <span>{fund.categoryShort}{fund.isLiveSip ? " · SIP" : ""}</span>
        </div>
        <ChevronIcon className="fund-row-chev" width={18} height={18} />
      </div>
      <div className="fund-row-bottom">
        <StatusPill status={fund.status} />
        <Sparkline points={fund.sparkline} />
        <div className="fund-row-value">
          <b>{inr(fund.value)}</b>
          <span className={tone(fund.gain)}>{pct(fund.returnPct)}</span>
        </div>
      </div>
    </button>
  );
}

export function Card({ title, action, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          <h2>{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, valueClass = "" }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <b className={`stat-value ${valueClass}`}>{value}</b>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function Notice({ kind = "info", children }) {
  return <p className={`notice notice-${kind}`} role={kind === "error" ? "alert" : undefined}>{children}</p>;
}
