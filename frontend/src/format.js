const isNum = (n) => typeof n === "number" && Number.isFinite(n);

// "Hide amounts": while on, every rupee figure and unit count is drawn as dots, so the app can be
// opened with someone looking on. Percentages stay. App sets this before each render.
let hidden = false;
const MASK = "₹ ••••••";
export function setAmountsHidden(value) {
  hidden = Boolean(value);
}

/** ₹12,34,567 — Indian digit grouping, no paise. */
export function inr(n) {
  if (!isNum(n)) return "—";
  if (hidden) return MASK;
  return `${n < 0 ? "−" : ""}₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;
}

/** ₹12.35 L / ₹1.20 Cr for tight spaces and chart axes. */
export function inrShort(n) {
  if (!isNum(n)) return "—";
  if (hidden) return "₹ •••";
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(2)} L`;
  if (a >= 1e3) return `${sign}₹${(a / 1e3).toFixed(1)}K`;
  return `${sign}₹${Math.round(a)}`;
}

export function signedInr(n) {
  if (!isNum(n)) return "—";
  if (hidden) return MASK;
  return `${n >= 0 ? "+" : "−"}₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;
}

export function pct(n, digits = 1) {
  if (!isNum(n)) return "—";
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}%`;
}

export function plainPct(n, digits = 1) {
  return isNum(n) ? `${n.toFixed(digits)}%` : "—";
}

export function number(n, digits = 2) {
  return isNum(n) ? n.toFixed(digits) : "—";
}

/** Units held or bought: hidden along with the rupee amounts, since units × NAV gives the value away. */
export function units(n, digits = 3) {
  if (!isNum(n)) return "—";
  return hidden ? "•••" : n.toFixed(digits);
}

/** "today", "tomorrow", "in 5 days" or "3 days ago" for a YYYY-MM-DD date. */
export function relativeDay(iso) {
  if (!iso) return "";
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).getTime() - today) / 86400000);
  if (Number.isNaN(days)) return "";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

export function date(iso, options = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "—";
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { ...options, timeZone: "UTC" });
}

/** "just now", "25 min ago", "3 hours ago", "2 days ago", then the date. */
export function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return date(new Date(then).toISOString());
}

export const tone =(n) => (!isNum(n) || n === 0 ? "" : n > 0 ? "up" : "down");

export const STATUSES = {
  "ON TRACK": { key: "on", label: "On track", blurb: "Doing what it should. Nothing to act on." },
  "PROMISING START": { key: "early", label: "Promising start", blurb: "Too new to judge. Early signs are fine." },
  WATCH: { key: "watch", label: "Watch", blurb: "Lagging on some measures. Worth a review." },
  "OFF TRACK": { key: "off", label: "Off track", blurb: "Underperforming. Talk to your adviser." },
};
export const STATUS_ORDER = ["ON TRACK", "PROMISING START", "WATCH", "OFF TRACK"];
