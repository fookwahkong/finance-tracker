import { useEffect, useState } from "react";
import {
  getTicker, getAggregates, getDividends, getProfile, getNews,
  getEarnings, getIncome, getBalance, getCashflow, getRatios,
} from "../../api/investments";
import AnalysisTab from "./components/AnalysisTab";
import PriceHeader from "./components/PriceHeader";
import PriceChart from "./components/PriceChart";
import Tabs from "./components/Tabs";
import OverviewTab from "./components/OverviewTab";
import EarningsTab from "./components/EarningsTab";
import FinancialsTab from "./components/FinancialsTab";

const LOADING = { status: "loading", data: null, error: null };

// Fetch one source into a named section; never throws.
async function load(setSections, name, fn) {
  try {
    const data = await fn();
    setSections((s) => ({ ...s, [name]: { status: "ok", data, error: null } }));
  } catch (e) {
    const error = e?.response?.data?.detail || e.message || "Failed to load";
    setSections((s) => ({ ...s, [name]: { status: "error", data: null, error } }));
  }
}

const SECTIONS = {
  ticker: getTicker, aggregates: getAggregates, dividends: getDividends,
  profile: getProfile, news: getNews, earnings: getEarnings,
  income: getIncome, balance: getBalance, cashflow: getCashflow,
  ratios: getRatios,
};

export default function StockPage({ symbol }) {
  const [sections, setSections] = useState(
    Object.fromEntries(Object.keys(SECTIONS).map((k) => [k, LOADING]))
  );
  const [tab, setTab] = useState("overview");
  const [range, setRange] = useState("6M");

  useEffect(() => {
    // allSettled semantics: each section resolves independently.
    Object.entries(SECTIONS).forEach(([name, fn]) =>
      load(setSections, name, () => fn(symbol))
    );
  }, [symbol]);

  return (
    <div>
      <PriceHeader
        symbol={symbol}
        aggregates={sections.aggregates}
        range={range}
        onRange={setRange}
      />
      <PriceChart aggregates={sections.aggregates} range={range} />
      <Tabs active={tab} onChange={setTab} />
      {tab === "overview" && (
        <OverviewTab
          aggregates={sections.aggregates}
          profile={sections.profile}
          dividends={sections.dividends}
          ticker={sections.ticker}
          news={sections.news}
        />
      )}
      {tab === "analysis" && <AnalysisTab symbol={symbol} aggregates={sections.aggregates} ratios={sections.ratios} />}
      {tab === "earnings" && <EarningsTab earnings={sections.earnings} />}
      {tab === "financials" && (
        <FinancialsTab
          income={sections.income}
          balance={sections.balance}
          cashflow={sections.cashflow}
        />
      )}
    </div>
  );
}
