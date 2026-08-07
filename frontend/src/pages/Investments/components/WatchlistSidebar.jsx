import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getWatchlist, addToWatchlist, removeFromWatchlist, getFxUsdSgd } from "../../../api/investments";
import { useQuotes } from "../hooks/useQuotes";
import { useTickerNames } from "../hooks/useTickerNames";
import { usePortfolioValue } from "../hooks/usePortfolioValue";
import { money, sgd, signed } from "../../../lib/format";

const toneOf = (v) => (v == null ? "var(--muted)" : v >= 0 ? "var(--green)" : "var(--red)");
const fmtPct = (dp) => (dp == null ? "—" : `${dp >= 0 ? "+" : ""}${dp.toFixed(2)}%`);

function SectionHead({ title, open, onToggle, action }) {
  return (
    <div className="wl-head">
      <span className="wl-head-title">{title}</span>
      {action}
      <button
        type="button"
        className={`wl-chevron${open ? "" : " is-collapsed"}`}
        aria-expanded={open}
        aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
        onClick={onToggle}
      >
        ⌃
      </button>
    </div>
  );
}

export default function WatchlistSidebar() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [showPortfolios, setShowPortfolios] = useState(true);
  const [showWatchlist, setShowWatchlist] = useState(true);
  const { valueUsd, totals } = usePortfolioValue();
  const quotes = useQuotes(rows.map((r) => r.ticker));
  const names = useTickerNames(rows.map((r) => r.ticker));

  // Total value is the SGD conversion of the USD holdings, mirroring NetWorthCard.
  const [fxRate, setFxRate] = useState(null);
  useEffect(() => { getFxUsdSgd().then((fx) => setFxRate(fx.rate)).catch(() => {}); }, []);
  const totalSgd = valueUsd != null && fxRate != null ? valueUsd * fxRate : null;

  const load = () => getWatchlist().then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    const t = draft.trim().toUpperCase();
    if (!t) return;
    await addToWatchlist(t);
    setDraft("");
    setAdding(false);
    load();
  }

  return (
    <aside className="watchlist" aria-label="Watchlist">
      <div>
        <SectionHead title="Portfolios" open={showPortfolios}
          onToggle={() => setShowPortfolios((v) => !v)} />
        {showPortfolios && (
          <>
            <div className="wl-total-label">Total value</div>
            {/* Show raw USD until the rate lands, rather than a dash. */}
            <div className="wl-total">
              {totalSgd != null ? sgd(totalSgd) : valueUsd != null ? money(valueUsd) : "—"}
            </div>
            <div className="wl-divider" />
            <div className="wl-portfolio">
              <div className="wl-portfolio-name">Investment Portfolio</div>
              <div className="wl-portfolio-row">
                <span className="wl-portfolio-val">{valueUsd == null ? "—" : money(valueUsd)}</span>
                {totals?.complete && (
                  <span style={{ color: toneOf(totals.dayChange), fontWeight: 700 }}>
                    {signed(totals.dayChange)} ({fmtPct(totals.dayChangePct)})
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <SectionHead
          title="Watchlist"
          open={showWatchlist}
          onToggle={() => setShowWatchlist((v) => !v)}
          action={
            <button type="button" className="wl-add-btn" aria-label="Add ticker"
              onClick={() => { setShowWatchlist(true); setAdding((v) => !v); }}>
              +
            </button>
          }
        />
        {showWatchlist && (
          <>
            {adding && (
              <form className="wl-add" onSubmit={add}>
                <input className="input" placeholder="Add ticker" autoFocus
                  value={draft} onChange={(e) => setDraft(e.target.value.toUpperCase())} />
                <button type="submit" className="btn btn-outline btn-icon">+</button>
              </form>
            )}
            {rows.map((r) => {
              const q = quotes[r.ticker];
              return (
                <div key={r.ticker} className="wl-row"
                  onClick={() => navigate(`/investment/stock/${r.ticker}`)}>
                  <div className="wl-row-main">
                    <span className="wl-ticker">{r.ticker}</span>
                    <span className="wl-name">{names[r.ticker] || ""}</span>
                  </div>
                  <div className="wl-row-side">
                    <span className="wl-price">{q?.c != null ? money(q.c) : "—"}</span>
                    <span className="wl-pct" style={{ color: toneOf(q?.dp) }}>
                      {fmtPct(q?.dp)} {q?.dp == null ? "" : q.dp >= 0 ? "↑" : "↓"}
                    </span>
                  </div>
                  <button type="button" className="wl-remove" aria-label={`Remove ${r.ticker}`}
                    onClick={(e) => { e.stopPropagation(); removeFromWatchlist(r.ticker).then(load); }}>
                    ✕
                  </button>
                </div>
              );
            })}
            {!rows.length && !adding && (
              <div style={{ fontSize: 13, color: "var(--muted-2)" }}>No tickers yet.</div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
