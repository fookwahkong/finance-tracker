// Company-news feeds for several holdings, folded into one portfolio feed.
// Finnhub returns { source, datetime (unix seconds), headline, url, ... }.

const MAX_ITEMS = 12;

// The same story is often filed under two of your tickers, so dedupe by url.
// Feeds that failed to load arrive as non-arrays and are skipped, which keeps
// one dead symbol from blanking the grid.
export function mergeNews(feeds, limit = MAX_ITEMS) {
  const byUrl = new Map();
  for (const items of feeds) {
    if (!Array.isArray(items)) continue;
    for (const n of items) {
      if (!n?.url || !n?.headline) continue;
      const seen = byUrl.get(n.url);
      if (!seen || (n.datetime ?? 0) > (seen.datetime ?? 0)) byUrl.set(n.url, n);
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
