// Three-column label/value grid. Rows come preformatted from buildStatGrid.
export default function StatGrid({ grid }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem 1.5rem" }}>
      {grid.map((r) => (
        <div key={r.label} style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#888" }}>{r.label}</span>
          <span style={{ fontWeight: 600 }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
