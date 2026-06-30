import { useState } from "react";
import Section from "./Section";
import StatementTable from "./StatementTable";

const SUBTABS = {
  income: { label: "Income", section: "income", fields: [
    { key: "revenue", label: "Revenue" },
    { key: "grossProfit", label: "Gross profit" },
    { key: "operatingIncome", label: "Operating income" },
    { key: "netIncome", label: "Net income" },
    { key: "eps", label: "EPS" },
  ]},
  balance: { label: "Balance Sheet", section: "balance", fields: [
    { key: "totalAssets", label: "Total assets" },
    { key: "totalLiabilities", label: "Total liabilities" },
    { key: "totalStockholdersEquity", label: "Total equity" },
    { key: "cashAndCashEquivalents", label: "Cash & equivalents" },
  ]},
  cashflow: { label: "Cash Flow", section: "cashflow", fields: [
    { key: "operatingCashFlow", label: "Operating cash flow" },
    { key: "capitalExpenditure", label: "CapEx" },
    { key: "freeCashFlow", label: "Free cash flow" },
    { key: "netChangeInCash", label: "Net change in cash" },
  ]},
};

export default function FinancialsTab({ income, balance, cashflow }) {
  const [sub, setSub] = useState("income");
  const sections = { income, balance, cashflow };
  const cfg = SUBTABS[sub];
  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        {Object.entries(SUBTABS).map(([k, v]) => (
          <button key={k} onClick={() => setSub(k)} style={{ fontWeight: k === sub ? 700 : 400 }}>
            {v.label}
          </button>
        ))}
        {/* Annual only in v1; Quarterly toggle deferred to a follow-up spec. */}
        <span style={{ marginLeft: "auto", color: "#888", alignSelf: "center" }}>Annual</span>
      </div>
      <Section section={sections[cfg.section]} isEmpty={(d) => !Array.isArray(d) || d.length === 0}>
        {(periods) => <StatementTable periods={periods} fields={cfg.fields} />}
      </Section>
    </div>
  );
}
