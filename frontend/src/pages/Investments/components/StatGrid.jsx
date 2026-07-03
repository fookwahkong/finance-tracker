// 4-column key-stats card. Rows come preformatted from buildStatGrid (8 fields,
// laid out 4 columns × 2 rows).
export default function StatGrid({ grid }) {
  return (
    <div className="invest-card statgrid">
      {grid.map((r) => (
        <div key={r.label} className="statgrid-cell">
          <div className="statgrid-label">{r.label}</div>
          <div className="statgrid-value">{r.value}</div>
        </div>
      ))}
    </div>
  );
}
