import { money } from "../../../lib/format";
import { useTickerNames } from "../hooks/useTickerNames";

const ACTION = { BUY: "Purchase", SELL: "Sale" };

const shortDate = (v) =>
  v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "numeric", year: "2-digit" }) : "";

export default function TransactionsTable({ transactions, onEdit }) {
  const names = useTickerNames(transactions.map((t) => t.ticker));

  // Newest first — the reference orders by transaction date descending, while
  // the API returns ascending for the portfolio maths.
  const rows = [...transactions].sort((a, b) =>
    a.purchase_date < b.purchase_date ? 1 : -1
  );

  return (
    <div className="table-scroll">
      <table className="tx-tbl">
        <thead>
          <tr>
            <th>Transaction date</th>
            <th>Symbol</th>
            <th>Action</th>
            <th className="num">Price</th>
            <th className="num">Shares</th>
            <th className="num">Amount</th>
            <th className="col-actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>{shortDate(t.purchase_date)}</td>
              <td className="sym-cell">
                <span className="sym-ticker">{t.ticker}</span>
                <span className="sym-name">{names[t.ticker] || ""}</span>
              </td>
              <td>{ACTION[t.type] || t.type}</td>
              <td className="num">{money(Number(t.price_per_share))}</td>
              <td className="num">{Number(t.quantity)}</td>
              <td className="num">
                <span className="cell-main">
                  {money(Number(t.quantity) * Number(t.price_per_share))}
                </span>
                {/* invest_transactions has created_at but no updated_at, so
                    this reads "Added on" where the reference says "Updated on". */}
                {t.created_at && (
                  <span className="cell-sub">Added on {shortDate(t.created_at)}</span>
                )}
              </td>
              <td className="col-actions">
                <button type="button" className="btn btn-ghost" onClick={() => onEdit(t)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
