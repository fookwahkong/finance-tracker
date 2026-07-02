import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMarketNews, getEarningsCalendar } from "../../api/investments";

const LOADING = { status: "loading", data: null, error: null };

function useFetch(fn) {
  const [state, setState] = useState(LOADING);
  useEffect(() => {
    fn()
      .then((data) => setState({ status: "ok", data, error: null }))
      .catch((e) => setState({ status: "error", data: null, error: e?.response?.data?.detail || e.message }));
  }, []);
  return state;
}

function EarningsGrid({ calendar }) {
  const rows = calendar?.earningsCalendar || [];
  if (!rows.length) return <p style={{ color: "var(--muted)" }}>No earnings in the next two weeks.</p>;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr><th>Date</th><th>Symbol</th><th>EPS est.</th><th>Revenue est.</th><th>When</th></tr>
        </thead>
        <tbody>
          {rows.slice(0, 40).map((r, i) => (
            <tr key={`${r.symbol}-${r.date}-${i}`}>
              <td>{r.date}</td>
              <td><Link to={`/investment/stock/${r.symbol}`} style={{ color: "var(--teal)", fontWeight: 700 }}>{r.symbol}</Link></td>
              <td>{r.epsEstimate ?? "—"}</td>
              <td>{r.revenueEstimate ? Number(r.revenueEstimate).toLocaleString("en-US") : "—"}</td>
              <td>{r.hour || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MarketNews() {
  const news = useFetch(getMarketNews);
  const calendar = useFetch(getEarningsCalendar);

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">Market News</div>
        <Link to="/investment" style={{ marginLeft: "auto", fontSize: 13, color: "var(--teal)", fontWeight: 600 }}>
          ← Portfolio
        </Link>
      </div>

      <div className="card-sub" style={{ marginBottom: 8 }}>Upcoming earnings (14 days)</div>
      {calendar.status === "loading" && <p style={{ color: "var(--muted)" }}>Loading…</p>}
      {calendar.status === "error" && <p style={{ color: "var(--red)" }}>{calendar.error}</p>}
      {calendar.status === "ok" && <EarningsGrid calendar={calendar.data} />}

      <div className="card-sub" style={{ margin: "18px 0 8px" }}>Headlines</div>
      {news.status === "loading" && <p style={{ color: "var(--muted)" }}>Loading…</p>}
      {news.status === "error" && <p style={{ color: "var(--red)" }}>{news.error}</p>}
      {news.status === "ok" && (
        <div style={{ display: "grid", gap: 10 }}>
          {(news.data || []).slice(0, 30).map((n) => (
            <a key={n.id || n.url} href={n.url} target="_blank" rel="noreferrer"
               style={{ textDecoration: "none", color: "var(--ink)" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{n.headline}</div>
              <div style={{ fontSize: 12, color: "var(--muted-2)" }}>
                {n.source} · {n.datetime ? new Date(n.datetime * 1000).toLocaleDateString() : ""}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
