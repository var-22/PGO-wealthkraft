import { useRef, useState } from "react";
import { api } from "../api.js";
import { UploadIcon } from "../components/icons.jsx";
import { Notice } from "../components/ui.jsx";

const TEMPLATE = "scheme_code,scheme_name,transaction_type,units,nav,transaction_date\n119063,HDFC Nifty 50 Index Fund - Direct Plan,SIP,44.785,223.29,2025-01-15\n";

/** Adding a statement: used on first sign-in and again from Profile. */
export function StatementPicker({ onDone, sampleFirst = false }) {
  const input = useRef(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);

  async function run(kind, action) {
    setBusy(kind);
    setError(null);
    try {
      await action();
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy("");
    }
  }

  function pick(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    run("file", async () => api.importCsv(await file.text()));
  }

  const template = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;
  return (
    <div className="picker">
      <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={pick} />
      <button type="button" className={`btn ${sampleFirst ? "btn-ghost" : "btn-primary"}`} disabled={Boolean(busy)} onClick={() => input.current.click()}>
        <UploadIcon width={18} height={18} /> {busy === "file" ? "Reading…" : "Upload transactions (CSV)"}
      </button>
      <button type="button" className={`btn ${sampleFirst ? "btn-primary" : "btn-ghost"}`} disabled={Boolean(busy)} onClick={() => run("sample", api.useSample)}>
        {busy === "sample" ? "Loading…" : "Explore with a sample portfolio"}
      </button>
      <p className="hint">
        The CSV needs these columns: scheme_code (AMFI code), scheme_name, transaction_type (BUY, SIP, SELL or DIVIDEND), units, nav, transaction_date.{" "}
        <a href={template} download="pgo-transactions-template.csv">Download a template</a>
      </p>
      {error && (
        <Notice kind="error">
          {error.message}
          {error.details?.length ? <span className="notice-list">{error.details.map((d) => <span key={d}>{d}</span>)}</span> : null}
        </Notice>
      )}
    </div>
  );
}

export default function Welcome({ user, onDone }) {
  return (
    <div className="welcome">
      <img src="/pgo-logo.png" alt="" width="72" height="72" />
      <h1>Welcome, {user.name.split(" ")[0]}</h1>
      <p>Add your mutual fund transactions and we'll show what each fund is worth today and whether it is on track.</p>
      <StatementPicker onDone={onDone} sampleFirst />
    </div>
  );
}
