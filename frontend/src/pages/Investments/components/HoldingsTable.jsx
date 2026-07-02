import { money, signed } from "../../../lib/format";

const DASH = "—";
const pct = (v) => (v == null ? "" : ` (${v >= 0 ? "+" : ""}${v.toFixed(2)}%)`);
const tone = (v) => ({ color: v == null ? "var(--muted)" : v >= 0 ? "var(--green)" : "var(--red)" });

export default function HoldingsTable({ enriched, onOpen }) {
  if (!enriched.length) return null;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Holding</th><th>Shares</th><th>Price</th><th>Value</th>
            <th>Cost basis</th><th>Day</th><th>Total return</th>
          </tr>
        </thead>
        <tbody>
          {enriched.map((p) => {
            const prevPrice = p.price != null && p.dayChange != null ? p.price - p.dayChange / p.shares : null;
            const dayPct = prevPrice ? ((p.dayChange / p.shares) / prevPrice) * 100 : null;
            const retPct = p.value != null && p.costBasis ? ((p.value - p.costBasis) / p.costBasis) * 100 : null;
            return (
              <tr key={p.ticker} style={{ cursor: "pointer" }} onClick={() => onOpen(p.ticker)}>
                <td style={{ fontWeight: 700 }}>{p.ticker}</td>
                <td>{p.shares}</td>
                <td>{p.price == null ? DASH : money(p.price)}</td>
                <td>{p.value == null ? DASH : money(p.value)}</td>
                <td>{money(p.costBasis)}</td>
                <td style={tone(p.dayChange)}>
                  {p.dayChange == null ? DASH : signed(p.dayChange) + pct(dayPct)}
                </td>
                <td style={tone(p.totalReturn)}>
                  {p.totalReturn == null ? DASH : signed(p.totalReturn) + pct(retPct)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
