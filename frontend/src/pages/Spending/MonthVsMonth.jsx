import { lazy, Suspense, useMemo, useState } from "react";
import { yearsInData, incomeSpendByMonth, categoryMonthlySeries } from "../../lib/aggregate";
import { applyClaimAdjustments } from "../../lib/claims";
import { CATEGORIES } from "../../lib/categories";
import { money, signed } from "../../lib/format";

const IncomeSpendBars = lazy(() => import("../../components/IncomeSpendBars"));
const CategoryLine = lazy(() => import("../../components/CategoryLine"));

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MonthVsMonth({ transactions, claims = [], claimLinks = [] }) {
  const years = useMemo(() => yearsInData(transactions), [transactions]);
  const [year, setYear] = useState(String(years[0]));
  const [category, setCategory] = useState(CATEGORIES[0]);

  // Money In/Money Out are the source of truth everywhere — this feeds the
  // same claim-adjusted transactions into the existing (unchanged) chart
  // math, rather than the raw transactions it used before.
  const adjustedTransactions = useMemo(
    () => applyClaimAdjustments(transactions, claims, claimLinks),
    [transactions, claims, claimLinks],
  );

  const barData = useMemo(() => incomeSpendByMonth(adjustedTransactions, Number(year)), [adjustedTransactions, year]);
  const lineData = useMemo(
    () => categoryMonthlySeries(adjustedTransactions, Number(year), category),
    [adjustedTransactions, year, category],
  );

  return (
    <>
      <div className="card" style={{ padding: "16px 20px" }}>
        <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <span className="field-label">Year</span>
          <select className="select" style={{ width: "auto" }} value={year} onChange={(e) => setYear(e.target.value)}>
            {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </div>
      </div>

      <section className="card">
        <div className="card-head"><div className="card-title">Income vs Spend</div></div>
        <Suspense fallback={<div className="empty">Loading chart…</div>}>
          <IncomeSpendBars data={barData} />
        </Suspense>
        <div className="grid-6" style={{ marginTop: 16 }}>
          {barData.map((d, i) => (
            <div className="stat" key={d.month}>
              <div className="stat-label">{MONTH_ABBR[i]}</div>
              <div className="stat-value" style={{ fontSize: 18, color: d.net >= 0 ? "var(--green)" : "var(--red)" }}>
                {signed(d.net)}
              </div>
            </div>
          ))}
        </div>
        <table className="tbl" style={{ marginTop: 16 }}>
          <thead>
            <tr><th>Month</th><th className="num">Money in</th><th className="num">Money out</th><th className="num">Net</th></tr>
          </thead>
          <tbody>
            {barData.map((d, i) => (
              <tr key={d.month}>
                <td>{MONTH_ABBR[i]}</td>
                <td className="num pos">{money(d.income)}</td>
                <td className="num neg">{money(d.spending)}</td>
                <td className={`num ${d.net >= 0 ? "pos" : "neg"}`}>{signed(d.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="card-head">
          <div className="card-title">Spending by Category</div>
          <select className="select" style={{ width: "auto", marginLeft: "auto" }} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <Suspense fallback={<div className="empty">Loading chart…</div>}>
          <CategoryLine data={lineData} />
        </Suspense>
      </section>
    </>
  );
}
