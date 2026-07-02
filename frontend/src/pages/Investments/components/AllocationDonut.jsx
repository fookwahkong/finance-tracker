import { donutGradient, colorFor, money } from "../../../lib/format";

export default function AllocationDonut({ allocations }) {
  if (!allocations.length) return null;
  const segments = allocations.map((a, i) => ({ value: a.value, color: colorFor(i) }));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 18 }}>
      <div style={{
        width: 120, height: 120, borderRadius: "50%",
        background: donutGradient(segments),
        WebkitMask: "radial-gradient(circle at center, transparent 40px, #000 41px)",
        mask: "radial-gradient(circle at center, transparent 40px, #000 41px)",
        flexShrink: 0,
      }} />
      <div style={{ display: "grid", gap: 6 }}>
        {allocations.map((a, i) => (
          <div key={a.ticker} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: colorFor(i) }} />
            <span style={{ fontWeight: 700, width: 56 }}>{a.ticker}</span>
            <span style={{ color: "var(--muted)" }}>{a.pct.toFixed(1)}% · {money(a.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
