import { donutGradient, colorFor, money } from "../../../lib/format";

export default function AllocationDonut({ allocations, compact = false }) {
  if (!allocations.length) return null;
  const segments = allocations.map((a, i) => ({ value: a.value, color: colorFor(i) }));
  const size = compact ? 300 : 240;
  const hole = compact ? 100 : 60;
  return (
    <div style={{
      display: "flex",
      flexDirection: compact ? "column" : "row",
      alignItems: "center",
      gap: compact ? 46 : 24,
      marginBottom: compact ? 0: 18,
    }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: donutGradient(segments),
        WebkitMask: `radial-gradient(circle at center, transparent ${hole}px, #000 ${hole + 1}px)`,
        mask: `radial-gradient(circle at center, transparent ${hole}px, #000 ${hole + 1}px)`,
        flexShrink: 0,
      }} />
      <div style={{ display: "grid", gap: compact ? 10: 10, width: compact ? "120%" : undefined }}>
        
        {allocations.map((a, i) => (
          <div key={a.ticker} style={{ display: "grid", gridTemplateColumns: "10px auto 1fr auto", alignItems: "center", gap: 12, fontSize: compact ? 17 : 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: colorFor(i), flexShrink: 0 }} />
            <span style={{ fontWeight: 700 }}>{a.ticker}</span>
            <span style={{ color: "var(--muted)", justifySelf: "end" }}>{a.pct.toFixed(1)}%</span>
            <span style={{ color: "var(--muted)", justifySelf: "end" }}>{money(a.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
