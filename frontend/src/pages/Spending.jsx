import { useCallback, useEffect, useState } from "react";
import { getTransactions, getCategories } from "../api/client";
import { getClaims } from "../api/claims";
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
  const [claims, setClaims] = useState([]);

  const reload = useCallback(() => {
    getTransactions().then(setTransactions).catch(() => setTransactions([]));
  }, []);
  const reloadClaims = useCallback(() => {
    getClaims().then(setClaims).catch(() => setClaims([]));
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { reloadClaims(); }, [reloadClaims]);
  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, []);

  const claimLinks = claims.flatMap((c) => c.links || []);

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
        <Overview
          transactions={transactions}
          categories={categories}
          claims={claims}
          claimLinks={claimLinks}
          onChanged={reload}
          reloadClaims={reloadClaims}
        />
      )}
      {tab === "month" && <MonthVsMonth transactions={transactions} />}
      {tab === "insights" && <Insights />}
    </>
  );
}
