import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTransactions, getCategories } from "../api/client";
import { getClaims } from "../api/claims";
import { queryKeys } from "../api/queryKeys";
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
  const queryClient = useQueryClient();

  const { data: transactions = [] } = useQuery({
    queryKey: queryKeys.transactions(),
    queryFn: () => getTransactions(),
  });
  const { data: claims = [] } = useQuery({
    queryKey: queryKeys.claims,
    queryFn: () => getClaims(),
  });
  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: getCategories,
  });

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["monthlyReport"] });
  };
  const reloadClaims = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.claims });
  };

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
