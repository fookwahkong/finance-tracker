import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getWatchlist, addToWatchlist, removeFromWatchlist } from "../../../api/investments";
import { useQuotes } from "../hooks/useQuotes";
import { usePortfolioValue } from "../hooks/usePortfolioValue";
import { money } from "../../../lib/format";

const pctTone = (dp) => ({
  color: dp == null ? "var(--muted)" : dp >= 0 ? "var(--green)" : "var(--red)",
  fontWeight: 700,
});
const fmtPct = (dp) => (dp == null ? "—" : `${dp >= 0 ? "+" : ""}${dp.toFixed(2)}%`);

export default function WatchlistSidebar() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState("");
  const { valueUsd } = usePortfolioValue();
  const quotes = useQuotes(rows.map((r) => r.ticker));

  const load = () => getWatchlist().then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    const t = draft.trim().toUpperCase();
    if (!t) return;
    await addToWatchlist(t);
    setDraft("");
    load();
  }

  return (
    <aside className="watchlist card" aria-label="Watchlist">
      {/* collapsed */}
      <div className="wl-mini">
        {rows.map((r) => (
          <div key={r.ticker} className="wl-row" style={{ flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
            <span style={{ fontWeight: 700, fontSize: 12 }}>{r.ticker}</span>
            <span style={{ ...pctTone(quotes[r.ticker]?.dp), fontSize: 11 }}>{fmtPct(quotes[r.ticker]?.dp)}</span>
          </div>
        ))}
        {!rows.length && <div style={{ fontSize: 11, color: "var(--muted-2)" }}>Watch</div>}
      </div>

      {/* expanded on hover */}
      <div className="wl-full">
        <div className="stat-label">Portfolio</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
          {valueUsd == null ? "—" : money(valueUsd)}
        </div>
        {rows.map((r) => {
          const q = quotes[r.ticker];
          return (
            <div key={r.ticker} className="wl-row">
              <button type="button" className="btn btn-ghost" style={{ padding: 0, fontWeight: 700 }}
                onClick={() => navigate(`/investment/stock/${r.ticker}`)}>
                {r.ticker}
              </button>
              <span style={{ marginLeft: "auto", color: "var(--muted)" }}>{q?.c != null ? money(q.c) : "—"}</span>
              <span style={pctTone(q?.dp)}>{fmtPct(q?.dp)}</span>
              <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${r.ticker}`}
                onClick={() => removeFromWatchlist(r.ticker).then(load)}>
                x
              </button>
            </div>
          );
        })}
        <form onSubmit={add} style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <input className="input" style={{ fontSize: 12 }} placeholder="Add ticker"
            value={draft} onChange={(e) => setDraft(e.target.value.toUpperCase())} />
          <button type="submit" className="btn btn-outline">+</button>
        </form>
      </div>
    </aside>
  );
}
