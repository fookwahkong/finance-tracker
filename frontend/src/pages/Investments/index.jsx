import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { getInvestTransactions, deleteInvestTransaction } from "../../api/investments";
import { buildPositions, enrichPositions, portfolioTotals, allocations as buildAllocations } from "./lib/portfolio";
import { guidanceMessages } from "./lib/guidance";
import { loadColumns, saveColumns } from "./lib/columns";
import PortfolioHero from "./components/PortfolioHero";
import PortfolioTabs from "./components/PortfolioTabs";
import HoldingsTable from "./components/HoldingsTable";
import InsightsTab from "./components/InsightsTab";
import TransactionsTable from "./components/TransactionsTable";
import NewsStories from "./components/NewsStories";
import ConfirmDialog from "./components/ConfirmDialog";
import TradeForm from "./components/TradeForm";
import { useQuotes } from "./hooks/useQuotes";

export default function Investments() {
  const navigate = useNavigate();
  const setNavExtra = useOutletContext();
  const [draft, setDraft] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [txError, setTxError] = useState(null);
  const [modal, setModal] = useState(null); // null | {editing: row|null}
  const [tab, setTab] = useState("investments");
  const [columns, setColumns] = useState(loadColumns);
  const [pendingDelete, setPendingDelete] = useState(null); // null | position
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function loadTransactions() {
    return getInvestTransactions()
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

  const changeColumns = (next) => { setColumns(next); saveColumns(next); };

  // Deleting a holding means deleting every trade behind it — the position is
  // an aggregate, not a record. Reload either way so the table shows what
  // actually survived rather than an optimistic guess.
  const deleteTrades = pendingDelete
    ? transactions.filter((t) => t.ticker === pendingDelete.ticker)
    : [];

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await Promise.all(deleteTrades.map((t) => deleteInvestTransaction(t.id)));
      await loadTransactions();
      setPendingDelete(null);
    } catch (e) {
      setDeleteError(e?.response?.data?.detail || e.message);
      await loadTransactions();
    } finally {
      setDeleting(false);
    }
  }

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
      {positions.length > 0 && <PortfolioHero totals={totals} />}

      {!txError && transactions.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No trades yet — add your first buy with “+ Trade”.</p>
      )}

      {transactions.length > 0 && (
        <>
          <PortfolioTabs active={tab} onChange={setTab} />

          {tab === "investments" && (
            <div className="invest-card">
              <HoldingsTable
                enriched={enriched}
                totalValue={totals.value}
                columns={columns}
                onColumnsChange={changeColumns}
                onOpen={(t) => navigate(`/investment/stock/${t}`)}
                onDelete={setPendingDelete}
              />
              <div className="invest-card-foot">↑ click a row to open its Stock Detail page</div>
            </div>
          )}

          {tab === "insights" && <InsightsTab allocations={allocs} guidance={guidance} />}

          {tab === "transactions" && (
            <div className="invest-card">
              <TransactionsTable
                transactions={transactions}
                onEdit={(t) => setModal({ editing: t })}
              />
            </div>
          )}
        </>
      )}

      <NewsStories tickers={positions.map((p) => p.ticker)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.ticker}?`}
        body={
          `This removes all ${deleteTrades.length} ` +
          `trade${deleteTrades.length === 1 ? "" : "s"} for ${pendingDelete?.ticker}. ` +
          "The position and its history will be gone. This cannot be undone."
        }
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => { setPendingDelete(null); setDeleteError(null); }}
      />

      <TradeForm
        open={modal !== null}
        editing={modal?.editing || null}
        onClose={() => setModal(null)}
        onSaved={loadTransactions}
      />
    </>
  );
}
