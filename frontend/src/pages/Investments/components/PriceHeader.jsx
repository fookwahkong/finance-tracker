import { money, signed } from "../../../lib/format";
import { barsFromAggregates } from "../lib/chart";
import { latestBar, dayChange } from "../lib/stats";
import Section from "./Section";

const RANGES = ["1M", "6M", "YTD", "1Y", "MAX"];

export default function PriceHeader({ symbol, profile, aggregates, range, onRange }) {
  const p = profile && profile.status === "ok" ? profile.data : null;
  const exchange = p && p.exchange ? p.exchange : "—";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", marginBottom: "0.5rem" }}>
      {p && p.logo ? (
        <img src={p.logo} alt="" width={36} height={36} style={{ borderRadius: 9, flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 36, height: 36, borderRadius: 9, background: "#111", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
        }}>◈</div>
      )}
      <div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{symbol} · {exchange}</div>
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{p ? p.name || p.ticker || symbol : symbol}</h2>
      </div>

      <Section section={aggregates} isEmpty={(d) => barsFromAggregates(d).length === 0}>
        {(data) => {
          const bars = barsFromAggregates(data);
          const last = latestBar(bars);
          const dc = dayChange(bars);
          return (
            <div style={{ marginLeft: "0.25rem" }}>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1 }}>{money(last.c)}</div>
              {dc && (
                <div style={{ fontSize: "0.9rem", color: dc.abs >= 0 ? "var(--teal)" : "var(--red)" }}>
                  {signed(dc.abs)} ({dc.pct >= 0 ? "+" : "−"}{Math.abs(dc.pct).toFixed(2)}%)
                </div>
              )}
            </div>
          );
        }}
      </Section>

      <div style={{ flex: 1 }} />
      <div className="range-tabs">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            className={`range-tab${r === range ? " is-active" : ""}`}
            onClick={() => onRange(r)}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
