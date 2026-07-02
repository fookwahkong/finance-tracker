import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getInvestTransactions } from "../../api/investments";
import { money, signed } from "../../lib/format";
import { buildPositions, enrichPositions, portfolioTotals, allocations as buildAllocations } from "./lib/portfolio";
import { guidanceMessages } from "./lib/guidance";
import AllocationDonut from "./components/AllocationDonut";
import { useQuotes } from "./hooks/useQuotes";
import HoldingsTable from "./components/HoldingsTable";
import TradeForm from "./components/TradeForm";

export default function Investments() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [txError, setTxError] = useState(null);
  const [modal, setModal] = useState(null); // null | {editing: row|null}

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

  const submit = (e) => {
    e.preventDefault();
    const next = draft.trim().toUpperCase();
    if (next) navigate(`/investment/stock/${next}`);
  };

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">Portfolio</div>
        <form onSubmit={submit} style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <input
            className="input"
            style={{ width: 180 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value.toUpperCase())}
            placeholder="Search ticker (e.g. AAPL)"
            aria-label="Ticker symbol"
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>
        <button type="button" className="btn btn-outline" onClick={() => setModal({ editing: null })}>
          + Trade
        </button>
      </div>

      {txError && <p style={{ color: "var(--red)" }}>{txError}</p>}
      {positions.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 18 }}>
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
        <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
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
      <AllocationDonut allocations={allocs} />
      <HoldingsTable enriched={enriched} onOpen={(t) => navigate(`/investment/stock/${t}`)} />
      {!txError && transactions.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No trades yet — add your first buy with “+ Trade”.</p>
      )}
      {transactions.length > 0 && (
        <>
          <div className="card-sub" style={{ margin: "18px 0 8px" }}>Trades</div>
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
        </>
      )}

      <Link to="/investment/news" style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600 }}>
        Market news →
      </Link>

      <TradeForm
        open={modal !== null}
        editing={modal?.editing || null}
        onClose={() => setModal(null)}
        onSaved={loadTransactions}
      />
    </div>
  );
}
