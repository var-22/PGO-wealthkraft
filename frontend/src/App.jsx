import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import { CloseIcon, FundsIcon, HomeIcon, InsightsIcon, ProfileIcon } from "./components/icons.jsx";
import { Notice } from "./components/ui.jsx";
import { setAmountsHidden } from "./format.js";
import { useInstall } from "./install.js";
import { applyTheme, readPref, writePref } from "./prefs.js";
import Auth from "./screens/Auth.jsx";
import FundDetail from "./screens/FundDetail.jsx";
import Funds from "./screens/Funds.jsx";
import Home from "./screens/Home.jsx";
import Insights from "./screens/Insights.jsx";
import Profile from "./screens/Profile.jsx";
import Transactions from "./screens/Transactions.jsx";
import Welcome from "./screens/Welcome.jsx";

const TABS = [
  { key: "home", label: "Home", Icon: HomeIcon },
  { key: "funds", label: "Portfolio", Icon: FundsIcon },
  { key: "insights", label: "Insights", Icon: InsightsIcon },
  { key: "profile", label: "Profile", Icon: ProfileIcon },
];

function Loading({ slow }) {
  return (
    <div className="loading" role="status">
      <div className="skeleton skeleton-hero" />
      <div className="skeleton" />
      <div className="skeleton skeleton-tall" />
      <p>{slow ? "Working out today's value of every fund. The first time each day can take a few minutes — you can leave this open." : "Loading your portfolio…"}</p>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined: checking; null: signed out
  const [state, setState] = useState({ status: "idle", portfolio: null, error: null });
  const [slow, setSlow] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("home");
  const [filter, setFilter] = useState("ALL");
  // Screens opened over the tabs (a fund, the transaction list), newest last.
  const [overlays, setOverlays] = useState([]);
  const [hidden, setHidden] = useState(() => readPref("hide-amounts", "0") === "1");
  const [theme, setTheme] = useState(() => readPref("theme", "system"));

  const installer = useInstall();

  setAmountsHidden(hidden); // read by every amount drawn in this render

  // Opening the app with no connection must not look like being signed out.
  const [offline, setOffline] = useState(false);
  const checkUser = useCallback(() => {
    setOffline(false);
    setUser(undefined);
    api.me().then(setUser).catch((err) => {
      if (err.status === 0) setOffline(true);
      else setUser(null);
    });
  }, []);
  useEffect(() => {
    checkUser();
  }, [checkUser]);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), 2500);
    try {
      const { portfolio } = await api.portfolio();
      setState({ status: "ready", portfolio, error: null });
    } catch (err) {
      if (err.status === 401) setUser(null);
      setState({ status: "error", portfolio: null, error: err });
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [Boolean(user), load]);

  // The server shows the last worked-out figures at once and brings today's in behind them; while it
  // says "updating", the app quietly asks again and swaps the fresh figures in.
  const updating = state.status === "ready" && Boolean(state.portfolio?.updating);
  useEffect(() => {
    if (!updating) return undefined;
    const timer = setTimeout(async () => {
      try {
        const { portfolio } = await api.portfolio();
        setState((s) => (s.status === "ready" ? { ...s, portfolio } : s));
      } catch {
        setState((s) => (s.status === "ready" && s.portfolio ? { ...s, portfolio: { ...s.portfolio, updating: false } } : s));
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [updating, state.portfolio]);

  // The phone's Back button closes the screen on top instead of leaving the app.
  useEffect(() => {
    const onPop = () => setOverlays((stack) => stack.slice(0, -1));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // A message about a failed refresh clears itself.
  const toast = state.status === "ready" ? state.error : null;
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setState((s) => ({ ...s, error: null })), 7000);
    return () => clearTimeout(timer);
  }, [toast]);

  const open = (overlay) => {
    window.history.pushState({ overlay: overlay.type }, "");
    setOverlays((stack) => [...stack, overlay]);
    window.scrollTo(0, 0);
  };
  const openFund = (fund) => open({ type: "fund", code: fund.code });
  const openTransactions = (code) => open({ type: "transactions", code: code ? String(code) : "ALL" });
  const closeOverlay = () => window.history.back();

  const go = (next) => {
    setTab(next);
    window.scrollTo(0, 0);
  };

  const toggleHidden = () => {
    setHidden((was) => {
      writePref("hide-amounts", was ? "0" : "1");
      return !was;
    });
  };

  const chooseTheme = (next) => {
    setTheme(next);
    writePref("theme", next);
    applyTheme(next);
  };

  function signedOut() {
    setState({ status: "idle", portfolio: null, error: null });
    setOverlays([]);
    setTab("home");
    setUser(null);
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const { portfolio } = await api.refresh();
      setState({ status: "ready", portfolio, error: null });
    } catch (err) {
      if (err.status === 401) signedOut();
      else setState((s) => ({ ...s, error: err }));
    } finally {
      setRefreshing(false);
    }
  }

  async function signOut() {
    await api.signOut().catch(() => {});
    signedOut();
  }

  if (offline) {
    return (
      <div className="app">
        <div className="welcome">
          <img src="/pgo-logo.png" alt="" width="72" height="72" />
          <h1>You're offline</h1>
          <p>PGO Wealth needs a connection to show your portfolio. Check your internet and try again.</p>
          <button type="button" className="btn btn-primary" onClick={checkUser}>Try again</button>
        </div>
      </div>
    );
  }
  if (user === undefined) return <div className="app"><Loading /></div>;
  if (!user) return <div className="app"><Auth onSignedIn={setUser} /></div>;

  const { status, portfolio, error } = state;
  if (status === "loading" || status === "idle") return <div className="app"><Loading slow={slow} /></div>;

  if (status === "error") {
    return (
      <div className="app">
        <div className="welcome">
          <h1>We couldn't load your portfolio</h1>
          <Notice kind="error">{error.message}</Notice>
          {error.rejected?.length > 0 && <p className="fine">{error.rejected.map((r) => `${r.scheme_name || r.scheme_code}: ${r.reason}`).join(" · ")}</p>}
          <button type="button" className="btn btn-primary" onClick={load}>Try again</button>
          {error.status === 422 && <button type="button" className="btn btn-ghost" onClick={async () => { await api.removePortfolio(); load(); }}>Start over with a different file</button>}
          <button type="button" className="btn btn-ghost" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  if (!portfolio) return <div className="app"><Welcome user={user} onDone={load} /></div>;

  const top = overlays[overlays.length - 1];
  const fund = top?.type === "fund" ? portfolio.funds.find((f) => f.code === top.code) : null;
  const covered = Boolean(fund) || top?.type === "transactions";

  return (
    <div className="app">
      {error && (
        <div className="toast">
          <Notice kind="error">
            {error.message}
            <button type="button" className="toast-close" onClick={() => setState((s) => ({ ...s, error: null }))} aria-label="Dismiss"><CloseIcon width={16} height={16} /></button>
          </Notice>
        </div>
      )}
      <main hidden={covered}>
        {tab === "home" && (
          <Home
            user={user}
            portfolio={portfolio}
            hidden={hidden}
            onToggleHidden={toggleHidden}
            onRefresh={refresh}
            refreshing={refreshing}
            onOpenFund={openFund}
            onOpenTransactions={openTransactions}
            installer={installer}
            onGo={go}
            onSeeAll={() => { setFilter("ALL"); go("funds"); }}
            onShowStatus={(s) => { setFilter(s); go("funds"); }}
          />
        )}
        {tab === "funds" && <Funds portfolio={portfolio} filter={filter} onFilter={setFilter} onOpenFund={openFund} />}
        {tab === "insights" && <Insights portfolio={portfolio} onOpenFund={openFund} />}
        {tab === "profile" && (
          <Profile
            user={user}
            portfolio={portfolio}
            onRefresh={refresh}
            refreshing={refreshing}
            onChanged={load}
            onSignOut={signOut}
            onUserChanged={setUser}
            onAccountDeleted={signedOut}
            onOpenTransactions={openTransactions}
            hidden={hidden}
            onToggleHidden={toggleHidden}
            theme={theme}
            onTheme={chooseTheme}
            installer={installer}
          />
        )}
      </main>
      {fund && <FundDetail fund={fund} onClose={closeOverlay} onOpenTransactions={openTransactions} />}
      {top?.type === "transactions" && <Transactions initialCode={top.code} onClose={closeOverlay} />}
      {!covered && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map(({ key, label, Icon }) => (
            <button key={key} type="button" className={tab === key ? "on" : ""} aria-current={tab === key ? "page" : undefined} onClick={() => go(key)}>
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
