import { money } from "../../../lib/format";
import { useTickerNames } from "../hooks/useTickerNames";
import ColumnSettings from "./ColumnSettings";
import RowMenu from "./RowMenu";

const DASH = "—";

// Change / Total gain-loss show bare numbers ("-11.86"), not currency — the
// column heading already establishes the unit, and the sign is what's being
// read. That's why these don't use format.js `signed`, which prepends "$".
const bare = (v) => (v >= 0 ? "+" : "-") + Math.abs(v).toFixed(2);
const pct = (v) => (v == null ? "" : `(${v >= 0 ? "+" : "-"}${Math.abs(v).toFixed(2)}%)`);
const tone = (v) => (v == null ? "var(--muted)" : v >= 0 ? "var(--green)" : "var(--red)");
// Fractional share counts carry float noise; 1.8110000000000002 → 1.811.
const qty = (n) => String(Number(n.toFixed(4)));

function DeltaCell({ value, percent }) {
  if (value == null) return <td className="num">{DASH}</td>;
  return (
    <td className="num" style={{ color: tone(value) }}>
      <span className="cell-main">{bare(value)}</span>
      <span className="cell-sub">{pct(percent)}</span>
    </td>
  );
}

export default function HoldingsTable({
  enriched, totalValue, columns, onColumnsChange, onOpen, onDelete,
}) {
  const names = useTickerNames(enriched.map((p) => p.ticker));
  if (!enriched.length) return null;

  return (
    <div className="table-scroll">
      <table className="holdings-tbl">
        <thead>
          <tr>
            <th>Symbols</th>
            <th className="num">Price</th>
            <th className="num">Value</th>
            {columns.change && <th className="num">Change</th>}
            {columns.gain && <th className="num">Total gain/loss</th>}
            {columns.weight && <th className="num">% of portfolio</th>}
            <th className="num">Quantity</th>
            {columns.avgCost && <th className="num">Avg cost basis</th>}
            <th className="col-actions">
              <ColumnSettings columns={columns} onChange={onColumnsChange} />
            </th>
          </tr>
        </thead>
        <tbody>
          {enriched.map((p) => {
            const prevPrice =
              p.price != null && p.dayChange != null ? p.price - p.dayChange / p.shares : null;
            const dayPct = prevPrice ? ((p.dayChange / p.shares) / prevPrice) * 100 : null;
            const retPct =
              p.value != null && p.costBasis ? ((p.value - p.costBasis) / p.costBasis) * 100 : null;
            const weight = p.value != null && totalValue ? (p.value / totalValue) * 100 : null;
            return (
              <tr key={p.ticker} className="holdings-row" onClick={() => onOpen(p.ticker)}>
                <td className="sym-cell">
                  <span className="sym-ticker">{p.ticker}</span>
                  <span className="sym-name">{names[p.ticker] || ""}</span>
                </td>
                <td className="num">{p.price == null ? DASH : money(p.price)}</td>
                <td className="num">{p.value == null ? DASH : money(p.value)}</td>
                {columns.change && <DeltaCell value={p.dayChange} percent={dayPct} />}
                {columns.gain && <DeltaCell value={p.totalReturn} percent={retPct} />}
                {columns.weight && (
                  <td className="num">{weight == null ? DASH : `${weight.toFixed(2)}%`}</td>
                )}
                <td className="num">{qty(p.shares)}</td>
                {columns.avgCost && <td className="num">{money(p.avgCost)}</td>}
                <td className="col-actions">
                  <RowMenu label={p.ticker} onDelete={() => onDelete(p)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
