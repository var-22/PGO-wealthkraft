import { useMemo, useState } from "react";
import { RefreshIcon } from "../components/icons.jsx";
import { Notice } from "../components/ui.jsx";
import { pct, timeAgo, tone } from "../format.js";
import { useNews } from "../news.js";

const level = (n) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The main index levels with the day's move. Shown on Home and on the News screen. */
export function IndexStrip({ indices }) {
  if (!indices?.length) return null;
  return (
    <div className="indices" style={{ "--n": indices.length }}>
      {indices.map((index) => (
        <div key={index.name} className={`index ${tone(index.change)}`}>
          <span>{index.name}</span>
          <b>{level(index.value)}</b>
          <small>{index.change >= 0 ? "▲" : "▼"} {level(Math.abs(index.change))} ({pct(index.changePct, 2)})</small>
        </div>
      ))}
    </div>
  );
}

/** One headline: opens the publisher's own page in a new tab. */
export function Headline({ item }) {
  return (
    <a className="headline" href={item.link} target="_blank" rel="noopener noreferrer">
      {(item.fund || item.topic) && <span className={`headline-tag${item.fund ? " fund" : ""}`}>{item.fund ? item.fund.name : item.topic}</span>}
      <b>{item.title}</b>
      <span className="headline-meta">{item.source}{item.publishedAt ? ` · ${timeAgo(item.publishedAt)}` : ""}</span>
    </a>
  );
}

export default function News() {
  const { status, data, reload } = useNews();
  const [view, setView] = useState("funds");
  const [fundCode, setFundCode] = useState("ALL");

  const fundNews = data?.fundNews || [];
  const marketNews = data?.marketNews || [];
  // The funds that actually have a headline, for the filter chips.
  const funds = useMemo(() => {
    const seen = new Map();
    fundNews.forEach((n) => seen.has(n.fund.code) || seen.set(n.fund.code, n.fund.name));
    return [...seen].map(([code, name]) => ({ code, name }));
  }, [fundNews]);
  const shownFund = funds.some((f) => f.code === fundCode) ? fundCode : "ALL";
  const list = view === "market" ? marketNews : fundNews.filter((n) => shownFund === "ALL" || n.fund.code === shownFund);

  return (
    <div className="screen screen-pad">
      <header className="page-head">
        <h1>News</h1>
        <button type="button" className="icon-btn" onClick={reload} disabled={status === "loading"} aria-label="Refresh news" title="Refresh news">
          <RefreshIcon width={20} height={20} className={status === "loading" ? "spin" : ""} />
        </button>
      </header>

      {status === "error" && <Notice kind="error">News couldn't be loaded just now. Check your connection and tap refresh.</Notice>}
      {status === "loading" && !data && (
        <div className="stack" role="status" aria-label="Loading news">
          <div className="skeleton" />
          <div className="skeleton skeleton-tall" />
        </div>
      )}

      {data && (
        <div className="stack">
          <IndexStrip indices={data.indices} />

          <div className="segmented" role="tablist" aria-label="News about">
            <button type="button" role="tab" aria-selected={view === "funds"} className={view === "funds" ? "on" : ""} onClick={() => setView("funds")}>Your funds</button>
            <button type="button" role="tab" aria-selected={view === "market"} className={view === "market" ? "on" : ""} onClick={() => setView("market")}>Market</button>
          </div>

          {view === "funds" && funds.length > 1 && (
            <div className="chips scroll-x" role="group" aria-label="Choose a fund">
              <button type="button" className={shownFund === "ALL" ? "on" : ""} aria-pressed={shownFund === "ALL"} onClick={() => setFundCode("ALL")}>All</button>
              {funds.map((f) => (
                <button key={f.code} type="button" className={shownFund === f.code ? "on" : ""} aria-pressed={shownFund === f.code} onClick={() => setFundCode(f.code)}>{f.name}</button>
              ))}
            </div>
          )}

          <div className="headlines" key={`${view}-${shownFund}`}>
            {list.map((item) => <Headline key={item.link} item={item} />)}
            {list.length === 0 && (
              <p className="empty">{view === "funds" ? "No recent headlines mention the funds you hold." : "No market headlines could be loaded right now."}</p>
            )}
          </div>

          <p className="fine center">
            Headlines are from Google News and open on the publisher's site. Index levels are from Yahoo Finance and can be a few minutes behind. Neither is investment advice.
          </p>
        </div>
      )}
    </div>
  );
}
