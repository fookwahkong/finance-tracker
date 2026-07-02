import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getInvestTransactions } from "../../api/investments";
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
