import { relativeTime } from "../lib/news";

// Two-column story grid, shared by portfolio news and market news. Items
// carrying `tickers` show a chip per holding; market stories simply omit it.
export default function NewsGrid({ items }) {
  return (
    <div className="news-grid">
      {items.map((n) => (
        <a key={n.url} className="news-item" href={n.url} target="_blank" rel="noreferrer">
          <div className="news-meta">
            {(n.tickers || []).map((t) => (
              <span key={t} className="news-chip">{t}</span>
            ))}
            <span className="news-source">{n.source}</span>
            <span className="news-dot">·</span>
            <span className="news-time">{relativeTime(n.datetime)}</span>
          </div>
          <div className="news-headline">{n.headline}</div>
        </a>
      ))}
    </div>
  );
}
