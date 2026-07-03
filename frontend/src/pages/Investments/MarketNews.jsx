import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { getMarketNews } from "../../api/investments";
import EarningsCalendar from "./components/EarningsCalendar";

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

export default function MarketNews() {
  const navigate = useNavigate();
  const setNavExtra = useOutletContext();
  const [draft, setDraft] = useState("");
  const news = useFetch(getMarketNews);

  const submit = (e) => {
    e.preventDefault();
    const next = draft.trim().toUpperCase();
    if (next) navigate(`/investment/stock/${next}`);
  };

  useEffect(() => {
    setNavExtra(
      <form onSubmit={submit} style={{ display: "flex" }}>
        <input
          className="input"
          style={{ width: 210 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          placeholder="Search ticker (e.g. AAPL)"
          aria-label="Ticker symbol"
        />
      </form>
    );
    return () => setNavExtra(null);
  }, [draft]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span className="card-title">Market News</span>
        <span style={{ fontSize: 14, color: "var(--muted)" }}>Upcoming earnings</span>
      </div>

      <EarningsCalendar />

      <div className="invest-card">
        <div className="invest-card-head">Headlines</div>
        {news.status === "loading" && <div style={{ padding: "10px 16px", color: "var(--muted)" }}>Loading…</div>}
        {news.status === "error" && <div style={{ padding: "10px 16px", color: "var(--red)" }}>{news.error}</div>}
        {news.status === "ok" && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {(news.data || []).slice(0, 30).map((n) => (
              <a key={n.id || n.url} href={n.url} target="_blank" rel="noreferrer"
                 style={{ textDecoration: "none", color: "var(--ink)", padding: "10px 16px", borderTop: "1px solid var(--line)" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{n.headline}</div>
                <div style={{ fontSize: 12, color: "var(--muted-2)" }}>
                  {n.source} · {n.datetime ? new Date(n.datetime * 1000).toLocaleDateString() : ""}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
