import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { BackIcon, DownloadIcon } from "../components/icons.jsx";
import { Notice } from "../components/ui.jsx";
import { downloadTransactions } from "../export.js";
import { date, inr, number, units } from "../format.js";

const TYPES = [
  { key: "ALL", label: "All" },
  { key: "SIP", label: "SIP" },
  { key: "BUY", label: "Buy" },
  { key: "SELL", label: "Sell" },
  { key: "DIVIDEND", label: "Dividend" },
];
const TYPE_LABEL = { SIP: "SIP", BUY: "Buy", SELL: "Sell", DIVIDEND: "Dividend" };
const PAGE = 60;

const monthOf = (iso) => iso.slice(0, 7);

/** Every transaction the customer added, newest first. Opens over the app like a fund's details. */
export default function Transactions({ initialCode = "ALL", onClose }) {
  const back = useRef(null);
  const [state, setState] = useState({ status: "loading", list: [], error: null });
  const [code, setCode] = useState(initialCode);
  const [type, setType] = useState("ALL");
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    back.current?.focus();
    let live = true;
    api.transactions()
      .then(({ transactions }) => live && setState({ status: "ready", list: transactions, error: null }))
      .catch((error) => live && setState({ status: "error", list: [], error }));
    return () => {
      live = false;
    };
  }, []);

  const { list, status, error } = state;

  const fundOptions = useMemo(() => {
    const names = new Map();
    list.forEach((t) => names.has(t.code) || names.set(t.code, t.name || t.code));
    return [...names].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [list]);

  const typesPresent = useMemo(() => new Set(list.map((t) => t.type)), [list]);
  const shown = useMemo(() => list.filter((t) => (code === "ALL" || t.code === code) && (type === "ALL" || t.type === type)), [list, code, type]);

  const totals = useMemo(() => {
    let put = 0;
    let taken = 0;
    shown.forEach((t) => {
      if (t.type === "BUY" || t.type === "SIP") put += t.amount || 0;
      else if (t.type === "SELL") taken += t.amount || 0;
    });
    return { put, taken };
  }, [shown]);

  // Rows are grouped under a month heading.
  const groups = useMemo(() => {
    const out = [];
    shown.slice(0, limit).forEach((t) => {
      const key = monthOf(t.date);
      if (out[out.length - 1]?.key !== key) out.push({ key, rows: [] });
      out[out.length - 1].rows.push(t);
    });
    return out;
  }, [shown, limit]);

  const pick = (setter) => (value) => {
    setter(value);
    setLimit(PAGE);
  };

  return (
    <div className="detail" role="dialog" aria-modal="true" aria-label="Transactions">
      <header className="detail-bar">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back" ref={back}><BackIcon /></button>
        <span>Transactions</span>
        {shown.length > 0 && (
          <button type="button" className="icon-btn bar-end" onClick={() => downloadTransactions(shown)} aria-label="Download these transactions" title="Download these transactions">
            <DownloadIcon width={20} height={20} />
          </button>
        )}
      </header>

      <div className="detail-body">
        {status === "loading" && <div className="skeleton skeleton-tall" role="status" aria-label="Loading transactions" />}
        {status === "error" && <Notice kind="error">{error.message}</Notice>}

        {status === "ready" && (
          <>
            <label className="select">
              <span className="sr-only">Fund</span>
              <select value={code} onChange={(e) => pick(setCode)(e.target.value)}>
                <option value="ALL">All funds</option>
                {fundOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            <div className="chips scroll-x" role="group" aria-label="Filter by type">
              {TYPES.filter((t) => t.key === "ALL" || typesPresent.has(t.key)).map((t) => (
                <button key={t.key} type="button" className={type === t.key ? "on" : ""} aria-pressed={type === t.key} onClick={() => pick(setType)(t.key)}>{t.label}</button>
              ))}
            </div>

            <section className="card tx-totals">
              <div><span>Transactions</span><b>{shown.length}</b></div>
              <div><span>Money put in</span><b>{inr(totals.put)}</b></div>
              {totals.taken > 0 && <div><span>Taken out</span><b>{inr(totals.taken)}</b></div>}
            </section>

            {groups.map((g) => (
              <section key={g.key} className="tx-group">
                <h2>{date(`${g.key}-01`, { month: "long", year: "numeric" })}</h2>
                <ul className="card tx-list">
                  {g.rows.map((t, i) => (
                    <li key={`${t.date}-${t.code}-${t.type}-${i}`}>
                      <span className={`tx-type tx-${t.type.toLowerCase()}`}>{TYPE_LABEL[t.type] || t.type}</span>
                      <span className="tx-name">
                        <b>{t.name || t.code}</b>
                        <span>{date(t.date, { day: "numeric", month: "short" })} · {units(t.units)} units at ₹{number(t.nav, 2)}</span>
                      </span>
                      <b className="tx-amount">{t.type === "SELL" ? "−" : ""}{inr(t.amount)}</b>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {shown.length === 0 && <p className="empty">No transactions match this filter.</p>}
            {shown.length > limit && (
              <button type="button" className="btn btn-ghost" onClick={() => setLimit((n) => n + PAGE)}>Show more ({shown.length - limit} left)</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
