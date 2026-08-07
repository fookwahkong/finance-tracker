const TABS = [
  { key: "investments", label: "Investments" },
  { key: "insights", label: "Insights", pill: "New" },
  { key: "transactions", label: "Transactions" },
];

export default function PortfolioTabs({ active, onChange }) {
  return (
    <div className="ptabs" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === active}
          className={`ptab${t.key === active ? " is-active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.pill && <span className="ptab-pill">{t.pill}</span>}
        </button>
      ))}
    </div>
  );
}
