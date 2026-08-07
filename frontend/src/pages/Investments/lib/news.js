// Company-news feeds for the user's holdings, folded into one portfolio feed.
// Finnhub returns { source, datetime (unix seconds), headline, summary, url }.
//
// Finnhub's per-symbol feed is tagged loosely: asking for NVDA yields hundreds
// of syndicated market-wire stories that never mention Nvidia. So a story only
// earns a place here if its own text names the holding.

const MAX_ITEMS = 12;

// Corporate boilerplate carries no signal — dropping it stops "Trust" or
// "Group" from matching unrelated stories.
const BOILERPLATE = new Set([
  "inc", "corp", "corporation", "co", "company", "ltd", "limited", "plc",
  "trust", "holdings", "group", "the", "and", "series", "class", "etf",
  "fund", "index", "shares", "common", "stock",
]);

// "Invesco QQQ Trust, Series 1" → ["invesco", "qqq"]
// "NVIDIA Corp" → ["nvidia"]
export function nameKeywords(name) {
  if (!name) return [];
  return [...new Set(
    name
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .split(" ")
      .map((w) => w.toLowerCase())
      .filter((w) => w.length >= 3 && !BOILERPLATE.has(w) && !/^\d+$/.test(w))
  )];
}

// The ticker must appear as its own token, so "NOW" doesn't match "nowhere"
// and "CAT" doesn't match "category".
function mentionsTicker(text, ticker) {
  if (!ticker) return false;
  const t = ticker.toLowerCase();
  return new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`).test(text);
}

export function mentionsHolding(item, ticker, name) {
  const text = `${item?.headline || ""} ${item?.summary || ""}`.toLowerCase();
  if (!text.trim()) return false;
  if (mentionsTicker(text, ticker)) return true;
  return nameKeywords(name).some((kw) => text.includes(kw));
}

// entries: [{ ticker, name, items }]. Returns stories that actually name one
// of the holdings, newest first, each tagged with the holdings it mentions.
// A story filed under two of your tickers appears once, tagged with both.
export function mergeNews(entries, limit = MAX_ITEMS) {
  const byUrl = new Map();
  for (const entry of entries) {
    const { ticker, name, items } = entry || {};
    if (!Array.isArray(items)) continue;
    for (const n of items) {
      if (!n?.url || !n?.headline) continue;
      if (!mentionsHolding(n, ticker, name)) continue;
      const seen = byUrl.get(n.url);
      if (seen) {
        if (!seen.tickers.includes(ticker)) seen.tickers.push(ticker);
        continue;
      }
      byUrl.set(n.url, { ...n, tickers: [ticker] });
    }
  }
  return [...byUrl.values()]
    .sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0))
    .slice(0, limit);
}

// "36 minutes ago" / "2 hours ago" / "3 days ago". `now` is injectable so the
// tests don't depend on the wall clock.
export function relativeTime(unixSeconds, now = Date.now()) {
  const minutes = Math.floor((now - unixSeconds * 1000) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
