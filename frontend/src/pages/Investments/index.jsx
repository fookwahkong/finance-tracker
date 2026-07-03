import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { getInvestTransactions } from "../../api/investments";
import { money, signed } from "../../lib/format";
import { buildPositions, enrichPositions, portfolioTotals, allocations as buildAllocations } from "./lib/portfolio";
import { guidanceMessages } from "./lib/guidance";
import AllocationDonut from "./components/AllocationDonut";
import { useQuotes } from "./hooks/useQuotes";
import HoldingsTable from "./components/HoldingsTable";
import HoldingsNews from "./components/HoldingsNews";
import TradeForm from "./components/TradeForm";

export default function Investments() {
  const navigate = useNavigate();
  const setNavExtra = useOutletContext();
  const [draft, setDraft] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [txError, setTxError] = useState(null);
  const [modal, setModal] = useState(null); // null | {editing: row|null}

  // Cap the holdings card to the donut card's height so it scrolls internally
  // once the holdings list grows taller than the donut.
  const donutRef = useRef(null);
  const [donutH, setDonutH] = useState(null);

  function loadTransactions() {
    getInvestTransactions()
      .then((rows) => { setTransactions(rows); setTxError(null); })
      .catch((e) => setTxError(e?.response?.data?.detail || e.message));
  }
  useEffect(() => { loadTransactions(); }, []);

  const positions = useMemo(() => buildPositions(transactions), [transactions]);
  const quotes = useQuotes(positions.map((p) => p.ticker));
  const enriched = useMemo(() => enrichPositions(positions, quotes), [positions, quotes]);
  const totals = useMemo(() => portfolioTotals(enriched), [enriched]);
  const guidance = useMemo(
    () => (totals.complete ? guidanceMessages(enriched, totals) : []),
    [enriched, totals]
  );
  const allocs = useMemo(() => buildAllocations(enriched), [enriched]);

  useLayoutEffect(() => {
    const el = donutRef.current;
    if (!el) { setDonutH(null); return; }
    const measure = () => setDonutH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [allocs.length]);

  const submit = (e) => {
    e.preventDefault();
    const next = draft.trim().toUpperCase();
    if (next) navigate(`/investment/stock/${next}`);
  };

  // Register the nav-extra slot (search + Trade). Re-runs on draft change so
  // the controlled input stays in sync with page state.
  useEffect(() => {
    setNavExtra(
      <>
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
        <button type="button" className="btn btn-primary" onClick={() => setModal({ editing: null })}>
          + Trade
        </button>
      </>
    );
    return () => setNavExtra(null);
  }, [draft]);

  return (
    <>
      {txError && <p style={{ color: "var(--red)" }}>{txError}</p>}
      {positions.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <div className="stat">
            <div className="stat-label">Total value</div>
            <div className="stat-value">{totals.complete ? money(totals.value) : "—"}</div>
            <div className="stat-note">cost basis {money(totals.costBasis)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Day change</div>
            <div className="stat-value" style={{ color: totals.dayChange >= 0 ? "var(--green)" : "var(--red)" }}>
              {totals.complete ? `${signed(totals.dayChange)} (${totals.dayChangePct.toFixed(2)}%)` : "—"}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Total return</div>
            <div className="stat-value" style={{ color: totals.totalReturn >= 0 ? "var(--green)" : "var(--red)" }}>
              {totals.complete ? `${signed(totals.totalReturn)} (${totals.totalReturnPct.toFixed(2)}%)` : "—"}
            </div>
          </div>
        </div>
      )}
      {guidance.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {guidance.map((g) => (
            <div key={g.id} style={{
              background: "var(--amber-soft)", color: "var(--amber)",
              borderRadius: "var(--radius-sm)", padding: "10px 14px",
              fontSize: 13, fontWeight: 600,
            }}>
              {g.text}
            </div>
          ))}
        </div>
      )}

      {positions.length > 0 && (
        <div className="portfolio-grid">
          <div className="invest-card donut-card" ref={donutRef}>
            <AllocationDonut allocations={allocs} compact />
          </div>
          <div className="invest-card holdings-card" style={donutH ? { maxHeight: donutH } : undefined}>
            <HoldingsTable enriched={enriched} onOpen={(t) => navigate(`/investment/stock/${t}`)} />
            <div className="invest-card-foot">↑ click ticker symbol to open Stock Detail page</div>
          </div>
        </div>
      )}

      {!txError && transactions.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No trades yet — add your first buy with “+ Trade”.</p>
      )}
      {transactions.length > 0 && (
        <div className="invest-card">
          <div className="invest-card-head">Trades</div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Date</th><th>Ticker</th><th>Type</th><th>Qty</th><th>Price</th><th /></tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.purchase_date}</td>
                    <td>{t.ticker}</td>
                    <td>{t.type}</td>
                    <td>{t.quantity}</td>
                    <td>${Number(t.price_per_share).toFixed(2)}</td>
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => setModal({ editing: t })}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <HoldingsNews tickers={positions.map((p) => p.ticker)} />

      <TradeForm
        open={modal !== null}
        editing={modal?.editing || null}
        onClose={() => setModal(null)}
        onSaved={loadTransactions}
      />
    </>
  );
}
