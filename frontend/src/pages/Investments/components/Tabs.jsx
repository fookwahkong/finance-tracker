const TABS = [
  { key: "overview", label: "Overview" },
  { key: "analysis", label: "Analysis", soon: true },
  { key: "earnings", label: "Earnings" },
  { key: "financials", label: "Financials" },
];

export default function Tabs({ active, onChange }) {
  return (
    <div style={{ display: "flex", gap: "1rem", borderBottom: "1px solid #eee", margin: "1rem 0" }}>
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            border: "none", background: "none", padding: "0.5rem 0", cursor: "pointer",
            fontWeight: t.key === active ? 700 : 400,
            borderBottom: t.key === active ? "2px solid #138a86" : "2px solid transparent",
          }}
        >
          {t.label}{t.soon && <span style={{ color: "#bbb", fontSize: "0.75rem" }}> · Soon</span>}
        </button>
      ))}
    </div>
  );
}
