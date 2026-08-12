import { useQuery } from "@tanstack/react-query";
import { getBudgets, getMonthlyReport, getSubscriptions } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import { money, monthLabel, signed } from "../../lib/format";
import {
  categoryDeltas,
  spendingPace,
  biggestTransaction,
  budgetsClosestToTipping,
  subscriptionCreep,
  weekdayWeekendSplit,
} from "./lib/insights";
import { downloadMonthlyReport } from "./lib/report";

function InsightCard({ title, icon, children }) {
  return (
    <section className="card insight-card">
      <div className="card-head">
        <span className="row-ico">{icon}</span>
        <div className="card-title">{title}</div>
      </div>
      {children}
    </section>
  );
}

function Empty({ label = "Not enough data yet." }) {
  return <div className="empty">{label}</div>;
}

export default function Insights({ transactions = [], today = new Date() }) {
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const { data: budgets = [] } = useQuery({ queryKey: queryKeys.budgets, queryFn: getBudgets });
  const { data: subscriptions = [] } = useQuery({
    queryKey: queryKeys.subscriptions,
    queryFn: getSubscriptions,
  });
  const { data: report } = useQuery({
    queryKey: queryKeys.monthlyReport(month),
    queryFn: () => getMonthlyReport(month),
  });

  const deltas = categoryDeltas(transactions, today);
  const pace = spendingPace(transactions, today);
  const biggest = biggestTransaction(transactions, today);
  const tipping = budgetsClosestToTipping(transactions, budgets, today);
  const creep = subscriptionCreep(transactions, subscriptions, today);
  const split = weekdayWeekendSplit(transactions, today);

  return (
    <>
      <div className="card" style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn-outline"
          disabled={!report}
          onClick={() => downloadMonthlyReport(report, month)}
        >
          ⤓ Download {monthLabel(month)} report
        </button>
      </div>
      <div className="grid-3 insights-grid">
        <InsightCard title="Biggest movers" icon="↕">
          {deltas.length === 0 ? <Empty /> : (
            <ul className="insight-list">
              {deltas.map((d) => (
                <li key={d.category}>
                  <span>{d.category}</span>
                  <span className={d.deltaAmount > 0 ? "neg" : "pos"}>
                    {d.isNew ? "New" : `${d.deltaPct >= 0 ? "+" : ""}${d.deltaPct.toFixed(0)}%`}
                    {" "}({signed(-d.deltaAmount)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </InsightCard>

        <InsightCard title="Spending pace" icon="⏱">
          {!pace || pace.paceRatio == null ? <Empty /> : (
            <div className="insight-stat">
              <div className={`insight-value ${pace.paceRatio > 1 ? "neg" : "pos"}`}>
                {pace.paceRatio > 1 ? "+" : ""}{((pace.paceRatio - 1) * 100).toFixed(0)}%
              </div>
              <div className="row-sub">vs your typical pace by today, {money(pace.currentCumulative)} so far</div>
            </div>
          )}
        </InsightCard>

        <InsightCard title="Biggest transaction" icon="✦">
          {!biggest ? <Empty /> : (
            <div className="insight-stat">
              <div className="insight-value">{money(biggest.amount)}</div>
              <div className="row-sub">{biggest.item}{biggest.category ? ` · ${biggest.category}` : ""}</div>
            </div>
          )}
        </InsightCard>

        <InsightCard title="Closest to tipping over" icon="⚠">
          {tipping.length === 0 ? <Empty /> : (
            <ul className="insight-list">
              {tipping.map((t) => (
                <li key={t.category}>
                  <span>{t.category}</span>
                  <span className={`status-badge status-${t.status}`}>{Math.round(t.pctUsed)}% of budget</span>
                </li>
              ))}
            </ul>
          )}
        </InsightCard>

        <InsightCard title="Subscription creep" icon="🔁">
          {!creep ? <Empty /> : (
            <div className="insight-stat">
              <div className={`insight-value ${creep.deltaAmount > 0 ? "neg" : "pos"}`}>
                {signed(-creep.deltaAmount)}
              </div>
              <div className="row-sub">{money(creep.current)} this month vs {money(creep.threeMonthsAgo)} 3 months ago</div>
            </div>
          )}
        </InsightCard>

        <InsightCard title="Weekday vs weekend" icon="📅">
          {!split ? <Empty /> : (
            <div className="insight-stat">
              <div className="insight-value">{money(split.weekdayAvgPerDay)} / {money(split.weekendAvgPerDay)}</div>
              <div className="row-sub">avg per weekday vs per weekend day</div>
            </div>
          )}
        </InsightCard>
      </div>
    </>
  );
}
