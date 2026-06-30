import { money, signed } from "../../../lib/format";
import { barsFromAggregates } from "../lib/chart";
import { latestBar, dayChange } from "../lib/stats";
import Section from "./Section";

export default function PriceHeader({ profile, aggregates }) {
  const p = profile && profile.status === "ok" ? profile.data : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
      {p && p.logo && <img src={p.logo} alt="" width={40} height={40} style={{ borderRadius: 8 }} />}
      <h2 style={{ margin: 0 }}>{p ? p.name || p.ticker : "…"}</h2>
      <Section section={aggregates} isEmpty={(d) => barsFromAggregates(d).length === 0}>
        {(data) => {
          const bars = barsFromAggregates(data);
          const last = latestBar(bars);
          const dc = dayChange(bars);
          return (
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.6rem", fontWeight: 700 }}>{money(last.c)}</span>
              {dc && (
                <span style={{ color: dc.abs >= 0 ? "#138a86" : "crimson" }}>
                  {signed(dc.abs)} ({dc.pct >= 0 ? "+" : "−"}{Math.abs(dc.pct).toFixed(2)}%)
                </span>
              )}
            </div>
          );
        }}
      </Section>
    </div>
  );
}
