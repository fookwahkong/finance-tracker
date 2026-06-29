import { lazy, Suspense, useMemo, useState } from "react";
import { yearsInData, incomeSpendByMonth, categoryMonthlySeries } from "../../lib/aggregate";
import { CATEGORIES } from "../../lib/categories";
import { signed } from "../../lib/format";

const IncomeSpendBars = lazy(() => import("../../components/IncomeSpendBars"));
const CategoryLine = lazy(() => import("../../components/CategoryLine"));

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MonthVsMonth({ transactions }) {
  const years = useMemo(() => yearsInData(transactions), [transactions]);
  const [year, setYear] = useState(String(years[0]));
  const [category, setCategory] = useState(CATEGORIES[0]);

  const barData = useMemo(() => incomeSpendByMonth(transactions, Number(year)), [transactions, year]);
  const lineData = useMemo(
    () => categoryMonthlySeries(transactions, Number(year), category),
    [transactions, year, category],
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
