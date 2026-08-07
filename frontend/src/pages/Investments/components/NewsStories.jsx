import { useEffect, useState } from "react";
import { getNews } from "../../../api/investments";
import { mergeNews, relativeTime } from "../lib/news";

export default function NewsStories({ tickers }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("idle");
  const key = [...new Set(tickers)].sort().join(",");

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    setStatus("loading");
    // A symbol whose feed 502s resolves to [] so the rest still render.
    Promise.all(key.split(",").map((s) => getNews(s).catch(() => [])))
      .then((feeds) => {
        if (!alive) return;
        setItems(mergeNews(feeds));
        setStatus("ok");
      });
    return () => { alive = false; };
  }, [key]);

  if (!key) return null;

  return (
    <section className="news">
      <h2 className="news-title">News stories</h2>
      <div className="news-sub">From sources across the web</div>
      {status === "loading" && <div className="news-note">Loading news…</div>}
      {status === "ok" && items.length === 0 && (
        <div className="news-note">No recent stories for your holdings.</div>
      )}
      <div className="news-grid">
        {items.map((n) => (
          <a key={n.url} className="news-item" href={n.url} target="_blank" rel="noreferrer">
            <div className="news-meta">
              {/* Finnhub gives no publisher logo, so the initial stands in. */}
              <span className="news-badge">{(n.source || "?").charAt(0).toUpperCase()}</span>
              <span className="news-source">{n.source}</span>
              <span className="news-dot">·</span>
              <span className="news-time">{relativeTime(n.datetime)}</span>
            </div>
            <div className="news-headline">{n.headline}</div>
          </a>
        ))}
      </div>
    </section>
  );
}
