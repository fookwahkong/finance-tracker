import { useCallback, useEffect, useState } from "react";
import { getTransactions, getCategories } from "../api/client";
import Overview from "./Spending/Overview";
import MonthVsMonth from "./Spending/MonthVsMonth";
import Insights from "./Spending/Insights";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "month", label: "Month vs Month" },
  { id: "insights", label: "Insights" },
];

export default function Spending() {
  const [tab, setTab] = useState("overview");
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);

  const reload = useCallback(() => {
    getTransactions().then(setTransactions).catch(() => setTransactions([]));
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, []);

  return (
    <>
      <div className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Overview transactions={transactions} categories={categories} onChanged={reload} />
      )}
      {tab === "month" && <MonthVsMonth transactions={transactions} />}
      {tab === "insights" && <Insights />}
    </>
  );
}
