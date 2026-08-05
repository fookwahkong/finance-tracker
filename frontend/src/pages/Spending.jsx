import { useCallback, useEffect, useState } from "react";
import { getTransactions, getCategories } from "../api/client";
import { getClaims } from "../api/claims";
import Overview from "./Spending/Overview";
import MonthVsMonth from "./Spending/MonthVsMonth";
import Insights from "./Spending/Insights";
import Claims from "./Spending/Claims";
import { linksForClaims } from "../lib/claims";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "month", label: "Month vs Month" },
  { id: "insights", label: "Insights" },
  { id: "claims", label: "Claims" },
];

export default function Spending() {
  const [tab, setTab] = useState("overview");
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [claims, setClaims] = useState([]);

  // to fetch transaction via getTransactions
  const reload = useCallback(() => {
    getTransactions().then(setTransactions).catch(() => setTransactions([]));
  }, []);

  // to fetch claims via getClaims
  const reloadClaims = useCallback(() => {
    getClaims().then(setClaims).catch(() => setClaims([]));
  }, []);

  // useEffect 
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { reloadClaims(); }, [reloadClaims]);
  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, []);

  const claimLinks = linksForClaims(claims);

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
      {tab === "claims" && (
        <Claims claims={claims} transactions={transactions} onChanged={() => { reload(); reloadClaims(); }} />
      )}
    </>
  );
}
