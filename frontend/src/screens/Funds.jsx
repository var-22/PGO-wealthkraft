import { useMemo, useState } from "react";
import { SearchIcon } from "../components/icons.jsx";
import { FundRow } from "../components/ui.jsx";
import { STATUSES, STATUS_ORDER } from "../format.js";

const SORTS = [
  { value: "value", label: "Largest first" },
  { value: "return", label: "Best return" },
  { value: "worst", label: "Lowest return" },
  { value: "name", label: "Name A–Z" },
];

const SEVERITY = { "OFF TRACK": 0, WATCH: 1, "PROMISING START": 2, "ON TRACK": 3 };

export default function Funds({ portfolio, filter, onFilter, onOpenFund }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("value");
  const { funds } = portfolio;

  const counts = useMemo(() => Object.fromEntries(STATUS_ORDER.map((s) => [s, funds.filter((f) => f.status === s).length])), [funds]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = funds.filter((f) => (filter === "ALL" || f.status === filter) && (!q || f.name.toLowerCase().includes(q) || f.categoryShort.toLowerCase().includes(q)));
    const by = {
      value: (a, b) => (b.value || 0) - (a.value || 0),
      return: (a, b) => (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity),
      worst: (a, b) => (a.returnPct ?? Infinity) - (b.returnPct ?? Infinity),
      name: (a, b) => a.name.localeCompare(b.name),
    }[sort];
    return [...list].sort(by);
  }, [funds, filter, query, sort]);

  return (
    <div className="screen screen-pad">
      <header className="page-head">
        <h1>Your funds</h1>
        <span>{funds.length} {funds.length === 1 ? "fund" : "funds"}</span>
      </header>

      <label className="search">
        <SearchIcon width={18} height={18} />
        <input type="search" placeholder="Search by fund or category" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search funds" />
      </label>

      <div className="chips scroll-x" role="group" aria-label="Filter by status">
        <button type="button" className={filter === "ALL" ? "on" : ""} aria-pressed={filter === "ALL"} onClick={() => onFilter("ALL")}>All <i>{funds.length}</i></button>
        {[...STATUS_ORDER].sort((a, b) => SEVERITY[a] - SEVERITY[b]).filter((s) => counts[s] > 0).map((s) => (
          <button key={s} type="button" className={filter === s ? "on" : ""} aria-pressed={filter === s} onClick={() => onFilter(s)}>
            {STATUSES[s].label} <i>{counts[s]}</i>
          </button>
        ))}
      </div>

      <div className="list-tools">
        <span>{shown.length} shown</span>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort funds">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="rows rows-cards">
        {shown.map((f) => <FundRow key={f.code} fund={f} onOpen={onOpenFund} />)}
        {shown.length === 0 && <p className="empty">No fund matches this search.</p>}
      </div>
    </div>
  );
}
