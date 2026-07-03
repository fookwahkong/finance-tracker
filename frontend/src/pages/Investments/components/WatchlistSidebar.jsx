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
  const { valueUsd, totals } = usePortfolioValue();
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
    <aside className="watchlist" aria-label="Watchlist">
      <div>
        <div className="stat-label" style={{ marginBottom: 0 }}>Portfolio</div>
        <div className="wl-port-pct" style={pctTone(totals?.totalReturnPct)}>
          {totals?.complete ? fmtPct(totals.totalReturnPct) : "—"} 
          
        </div>
        
        <div className="wl-port-val">{valueUsd == null ? "—" : money(valueUsd)}</div>
      </div>

      <div className="wl-divider" />

      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div className="wl-heading">Watchlist</div>
        {rows.map((r) => {
          const q = quotes[r.ticker];
          return (
            <div key={r.ticker} className="wl-row"
              onClick={() => navigate(`/investment/stock/${r.ticker}`)}>
              <span className="wl-ticker">{r.ticker}</span>
              <span className="wl-price">{q?.c != null ? money(q.c) : "—"}</span>
              <span style={{ ...pctTone(q?.dp), fontSize: 12 }}>{fmtPct(q?.dp)}</span>
              <button type="button" className="wl-remove" aria-label={`Remove ${r.ticker}`}
                onClick={(e) => { e.stopPropagation(); removeFromWatchlist(r.ticker).then(load); }}>
                ✕
              </button>
            </div>
          );
        })}
        {!rows.length && <div style={{ fontSize: 11, color: "var(--muted-2)" }}>No tickers yet.</div>}

        <form className="wl-add" onSubmit={add}>
          <input className="input" placeholder="Add ticker"
            value={draft} onChange={(e) => setDraft(e.target.value.toUpperCase())} />
          <button type="submit" className="btn btn-outline btn-icon">+</button>
        </form>
      </div>
    </aside>
  );
}
