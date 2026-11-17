import { useState } from "react";
import { api } from "../api.js";
import { ChevronIcon, DownloadIcon, ListIcon, RefreshIcon, SignOutIcon, StatusIcon } from "../components/icons.jsx";
import { Card, Notice } from "../components/ui.jsx";
import { downloadHoldings } from "../export.js";
import { STATUSES, STATUS_ORDER, date } from "../format.js";
import { THEMES } from "../prefs.js";
import { StatementPicker } from "./Welcome.jsx";

/** One small form at a time: change name, change password or delete the account. */
function AccountForm({ kind, user, onDone, onCancel }) {
  const [form, setForm] = useState({ name: user.name, current: "", next: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (kind === "name") onDone(await api.updateName(form.name));
      else if (kind === "password") {
        await api.changePassword(form.current, form.next);
        onDone();
      } else {
        await api.deleteAccount(form.current);
        onDone();
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="account-form" onSubmit={submit}>
      {kind === "name" && (
        <label className="field">
          <span>Your name</span>
          <input value={form.name} onChange={set("name")} autoComplete="name" required maxLength={80} autoFocus />
        </label>
      )}
      {kind === "delete" && (
        <Notice kind="error">This removes your account, your transactions and everything worked out from them. It cannot be undone.</Notice>
      )}
      {kind !== "name" && (
        <label className="field">
          <span>{kind === "delete" ? "Enter your password to confirm" : "Current password"}</span>
          <input type="password" value={form.current} onChange={set("current")} autoComplete="current-password" required autoFocus />
        </label>
      )}
      {kind === "password" && (
        <label className="field">
          <span>New password</span>
          <input type="password" value={form.next} onChange={set("next")} autoComplete="new-password" minLength={8} required />
          <small>At least 8 characters. Other devices will be signed out.</small>
        </label>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      <div className="form-row">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className={`btn ${kind === "delete" ? "btn-delete" : "btn-primary"}`} disabled={busy}>
          {busy ? "Please wait…" : kind === "name" ? "Save" : kind === "password" ? "Change password" : "Delete account"}
        </button>
      </div>
    </form>
  );
}

export default function Profile({ user, portfolio, onRefresh, refreshing, onChanged, onSignOut, onUserChanged, onAccountDeleted, onOpenTransactions, hidden, onToggleHidden, theme, onTheme, installer }) {
  const [replacing, setReplacing] = useState(false);
  const [editing, setEditing] = useState(null); // "name" | "password" | "delete"
  const [saved, setSaved] = useState("");

  function done(kind, result) {
    setEditing(null);
    if (kind === "delete") return onAccountDeleted();
    if (kind === "name") onUserChanged(result);
    setSaved(kind === "name" ? "Your name has been updated." : "Your password has been changed.");
    return undefined;
  }

  const startEditing = (kind) => {
    setSaved("");
    setEditing(kind);
    window.scrollTo(0, 0); // the form opens in the account card at the top
  };

  return (
    <div className="screen screen-pad">
      <header className="page-head">
        <h1>Profile</h1>
      </header>

      <div className="stack">
        <Card>
          <div className="account">
            <span className="avatar avatar-lg" aria-hidden="true">{user.name.trim()[0]?.toUpperCase()}</span>
            <div>
              <b>{user.name}</b>
              <span>{user.email}</span>
              {user.createdAt && <span className="account-since">Member since {date(user.createdAt, { month: "long", year: "numeric" })}</span>}
            </div>
          </div>
          {saved && <Notice kind="info">{saved}</Notice>}
          {editing ? (
            <AccountForm key={editing} kind={editing} user={user} onCancel={() => setEditing(null)} onDone={(result) => done(editing, result)} />
          ) : (
            <div className="menu">
              <button type="button" onClick={() => startEditing("name")}>Change name <ChevronIcon width={16} height={16} /></button>
              <button type="button" onClick={() => startEditing("password")}>Change password <ChevronIcon width={16} height={16} /></button>
            </div>
          )}
        </Card>

        <Card title="Your data">
          {portfolio.source === "sample" && <Notice kind="info">You are viewing the sample portfolio. Upload your own transactions to see your real holdings.</Notice>}
          <dl className="facts">
            <div><dt>Source</dt><dd>{portfolio.source === "sample" ? "Sample portfolio" : "Your uploaded transactions"}</dd></div>
            <div><dt>Transactions</dt><dd>{portfolio.transactionCount}</dd></div>
            <div><dt>Added on</dt><dd>{date(portfolio.importedAt)}</dd></div>
            <div><dt>Prices as of</dt><dd>{date(portfolio.asOf)}</dd></div>
          </dl>
          {portfolio.rejected.length > 0 && (
            <Notice kind="warn">
              {portfolio.rejected.length} {portfolio.rejected.length === 1 ? "fund was" : "funds were"} left out because the scheme code could not be matched: {portfolio.rejected.map((r) => r.name || r.code).join(", ")}.
            </Notice>
          )}
          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={() => onOpenTransactions()}>
              <ListIcon width={18} height={18} /> View transactions
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => downloadHoldings(portfolio)}>
              <DownloadIcon width={18} height={18} /> Download holdings (CSV)
            </button>
            <button type="button" className="btn btn-ghost" onClick={onRefresh} disabled={refreshing}>
              <RefreshIcon width={18} height={18} className={refreshing ? "spin" : ""} /> {refreshing ? "Refreshing…" : "Refresh prices now"}
            </button>
            {!replacing && <button type="button" className="btn btn-ghost" onClick={() => setReplacing(true)}>Replace transactions</button>}
          </div>
          {replacing && <StatementPicker onDone={() => { setReplacing(false); onChanged(); }} />}
        </Card>

        <Card title="App settings">
          <div className="setting">
            <div>
              <b>Install the app</b>
              <span>
                {installer.state === "installed" && "PGO Wealth is installed on this device."}
                {installer.state === "ready" && "Add PGO Wealth to your home screen and open it like any other app."}
                {installer.state === "ios" && "In Safari, tap the Share button, then “Add to Home Screen”."}
                {installer.state === "unavailable" && "Open this page in Chrome or Edge, then use the browser menu → “Install app” or “Add to Home screen”."}
              </span>
            </div>
            {installer.state === "ready" && <button type="button" className="btn-small" onClick={installer.install}>Install</button>}
          </div>
          <div className="setting">
            <div>
              <b>Hide amounts</b>
              <span>Show dots in place of rupee figures.</span>
            </div>
            <button type="button" role="switch" aria-checked={hidden} aria-label="Hide amounts" className={`switch${hidden ? " on" : ""}`} onClick={onToggleHidden}><i /></button>
          </div>
          <div className="setting setting-col">
            <div>
              <b>Appearance</b>
              <span>Auto follows your phone's setting.</span>
            </div>
            <div className="segmented segmented-3" role="group" aria-label="Appearance">
              {THEMES.map((t) => (
                <button key={t.key} type="button" className={theme === t.key ? "on" : ""} aria-pressed={theme === t.key} onClick={() => onTheme(t.key)}>{t.label}</button>
              ))}
            </div>
          </div>
        </Card>

        <Card title="What the labels mean">
          <ul className="glossary">
            {STATUS_ORDER.map((s) => (
              <li key={s}>
                <span className={`dot dot-${STATUSES[s].key}`}><StatusIcon status={s} size={12} /></span>
                <div>
                  <b>{STATUSES[s].label}</b>
                  <span>{STATUSES[s].blurb}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="fine">
            Each fund is judged on your own return (XIRR for a running SIP), how it did against its official benchmark over the same dates, its 1, 3 and 5-year record, and its risk-adjusted return. A fund held for under six months is not judged harshly on a short dip.
          </p>
        </Card>

        <button type="button" className="btn btn-danger" onClick={onSignOut}>
          <SignOutIcon width={18} height={18} /> Sign out
        </button>

        {editing !== "delete" && <button type="button" className="link link-quiet" onClick={() => startEditing("delete")}>Delete my account</button>}

        <p className="fine center">
          Mutual fund investments are subject to market risks. Past performance does not guarantee future returns. Figures are calculated from published NAVs and the transactions you provided.
        </p>
      </div>
    </div>
  );
}
