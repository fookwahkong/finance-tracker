import { useEffect, useState } from "react";
import { getNews } from "../../../api/investments";
import { useTickerNames } from "../hooks/useTickerNames";
import { mergeNews } from "../lib/news";
import NewsGrid from "./NewsGrid";

export default function NewsStories({ tickers }) {
  const [feeds, setFeeds] = useState([]);
  const [status, setStatus] = useState("idle");
  const key = [...new Set(tickers)].sort().join(",");
  const names = useTickerNames(tickers);

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    setStatus("loading");
    const symbols = key.split(",");
    // A symbol whose feed 502s resolves to [] so the rest still render.
    Promise.all(symbols.map((s) => getNews(s).catch(() => []))).then((results) => {
      if (!alive) return;
      setFeeds(symbols.map((ticker, i) => ({ ticker, items: results[i] })));
      setStatus("ok");
    });
    return () => { alive = false; };
  }, [key]);

  if (!key) return null;

  // Filtering happens here rather than in the effect so stories re-qualify as
  // company names arrive — useTickerNames resolves after the feeds do.
  const items = mergeNews(feeds.map((f) => ({ ...f, name: names[f.ticker] })));

  return (
    <section className="news">
      <h2 className="news-title">News from your holdings</h2>
      <div className="news-sub">Stories that mention what you own</div>
      {status === "loading" && <div className="news-note">Loading news…</div>}
      {status === "ok" && items.length === 0 && (
        <div className="news-note">No recent stories mention your holdings.</div>
      )}
      <NewsGrid items={items} />
    </section>
  );
}
