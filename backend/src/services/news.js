// News for the app: headlines about the funds a customer holds, market headlines, and the main
// index levels. Everything is read from public feeds and shown as it is: a headline, who published
// it, when, and a link to the publisher's page. Nothing is rewritten or summarised.
//
// Sources: Google News RSS search (headlines) and Yahoo Finance's chart feed (index levels).
// Both are fetched by this server, kept for a while, and shared by all customers, so the outside
// services see a handful of requests however many people use the app.

const AGENT = "Mozilla/5.0 (compatible; PGOWealth/1.0)";
const HEADLINE_TTL_MS = 30 * 60 * 1000;
const INDEX_TTL_MS = 5 * 60 * 1000;
const MAX_FUNDS = 8; // the customer's largest holdings
const PER_FUND = 4;

const DEADLINE_MS = 9000; // the longest a customer waits for news, whatever the sources do

/** `promise`'s value, or `fallback` if it has not arrived within `ms` (or fails). */
function within(promise, ms, fallback) {
  let timer;
  const late = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise.catch(() => fallback), late]).finally(() => clearTimeout(timer));
}

const INDICES = [
  { symbol: "^NSEI", name: "Nifty 50" },
  { symbol: "^BSESN", name: "Sensex" },
  { symbol: "^NSEBANK", name: "Bank Nifty" },
];

async function get(url, ms = 8000) {
  const response = await fetch(url, { headers: { "User-Agent": AGENT, Accept: "*/*" }, signal: AbortSignal.timeout(ms) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

// ---- a small keep-for-a-while store: fresh value, else the fetch; a failed fetch falls back to the older value ----
const kept = new Map(); // key -> { at, value, pending }

async function keep(key, ttl, load, fallback) {
  const entry = kept.get(key) || {};
  if (entry.value !== undefined && Date.now() - entry.at < ttl) return entry.value;
  if (entry.pending) return entry.pending;
  entry.pending = (async () => {
    try {
      entry.value = await load();
      entry.at = Date.now();
    } catch {
      if (entry.value === undefined) {
        // remembered briefly, so a source that is down is not hammered on every request
        entry.value = fallback;
        entry.at = Date.now() - ttl + 60 * 1000;
      }
    } finally {
      entry.pending = null;
    }
    return entry.value;
  })();
  kept.set(key, entry);
  // The store never grows without bound: the oldest entries go first.
  if (kept.size > 500) kept.delete(kept.keys().next().value);
  return entry.pending;
}

// ---- reading an RSS feed ----
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decode(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/\s+/g, " ")
    .trim();
}

const tag = (xml, name) => new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(xml)?.[1] ?? "";

/** [{ title, link, source, publishedAt }] from RSS text, newest first. Items without a web link are dropped. */
export function parseRss(xml, limit = 20) {
  const items = [];
  for (const match of String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const body = match[1];
    const link = decode(tag(body, "link"));
    let title = decode(tag(body, "title"));
    const source = decode(tag(body, "source"));
    if (!title || !/^https?:\/\//i.test(link)) continue;
    // Google News writes "Headline - Publisher"; the publisher is shown separately.
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -source.length - 3).trim();
    const when = new Date(decode(tag(body, "pubDate")));
    items.push({ title, link, source: source || new URL(link).hostname.replace(/^www\./, ""), publishedAt: Number.isNaN(when.getTime()) ? null : when.toISOString() });
  }
  return items.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt))).slice(0, limit);
}

const searchUrl = (query) => `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
const headlines = (query, limit) => keep(`news:${query}`, HEADLINE_TTL_MS, async () => parseRss(await get(searchUrl(query)), limit), []);

/** "Parag Parikh Flexi Cap Fund - Direct Plan - Growth" -> "Parag Parikh Flexi Cap Fund": the name the press uses. */
export function plainFundName(name) {
  // The plan and option are separate parts after a dash; only those parts go, so a fund whose own
  // name has "Growth" in it (Nippon India Growth Fund) keeps it.
  const planPart = /^((direct|regular)(\s+plan)?(\s+.*)?|growth(\s+(option|plan))?|(idcw|dividend)\b.*|bonus(\s+option)?)$/i;
  return String(name || "")
    .replace(/\(.*?\)/g, " ")
    .split(/\s+-\s*|\s*-\s+/)
    .map((part) => part.trim())
    .filter((part) => part && !planPart.test(part))
    .join(" - ")
    .replace(/\s+(direct|regular)\s+plan(\s+growth(\s+option)?)?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fundHeadlines(fund) {
  const name = plainFundName(fund.name);
  if (!name) return [];
  let list = await headlines(`"${name}" when:30d`, PER_FUND);
  // Small funds are rarely named in full; widen to the plain words before giving up.
  if (!list.length) list = await headlines(`${name} mutual fund when:30d`, PER_FUND);
  return list.map((item) => ({ ...item, fund: { code: fund.code, name } }));
}

const sameStory = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);

function merge(lists, limit) {
  const seen = new Set();
  return lists
    .flat()
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
    .filter((item) => {
      const key = sameStory(item.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

// ---- index levels ----
async function indexLevel({ symbol, name }) {
  const text = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`, 6000);
  const result = JSON.parse(text).chart.result[0];
  const price = result.meta.regularMarketPrice;
  const closes = (result.indicators?.quote?.[0]?.close || []).filter((v) => typeof v === "number");
  // The last daily figure is today's (still moving while the market is open); the one before is the previous close.
  const previous = closes.length >= 2 ? closes[closes.length - 2] : result.meta.chartPreviousClose;
  if (typeof price !== "number" || typeof previous !== "number" || previous === 0) throw new Error("no level");
  return {
    name,
    value: Math.round(price * 100) / 100,
    change: Math.round((price - previous) * 100) / 100,
    changePct: Math.round(((price - previous) / previous) * 10000) / 100,
    asOf: result.meta.regularMarketTime ? new Date(result.meta.regularMarketTime * 1000).toISOString() : null,
  };
}

const indices = async () => (await Promise.all(INDICES.map((index) => keep(`index:${index.symbol}`, INDEX_TTL_MS, () => indexLevel(index), null)))).filter(Boolean);

/**
 * { indices, fundNews, marketNews, fetchedAt } for a customer holding `funds` ([{ code, name }],
 * largest first). A source that cannot be reached simply leaves its part empty.
 */
export async function newsFor(funds) {
  // Every part has its own deadline: a slow or unreachable source leaves that part empty this time
  // (its fetch carries on and is kept for the next request) and never holds up the answer.
  const [levels, perFund, markets, mutualFunds] = await Promise.all([
    within(indices(), DEADLINE_MS, []),
    Promise.all(funds.slice(0, MAX_FUNDS).map((fund) => within(fundHeadlines(fund), DEADLINE_MS, []))),
    within(headlines("Nifty Sensex stock market when:1d", 10), DEADLINE_MS, []),
    within(headlines("mutual funds India when:2d", 8), DEADLINE_MS, []),
  ]);
  return {
    indices: levels,
    fundNews: merge(perFund, 24),
    marketNews: merge([markets.map((n) => ({ ...n, topic: "Markets" })), mutualFunds.map((n) => ({ ...n, topic: "Mutual funds" }))], 16),
    fetchedAt: new Date().toISOString(),
  };
}
