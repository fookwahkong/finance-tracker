import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getInvestTransactions, getQuote } from "../../../api/investments";
import { buildPositions, enrichPositions, portfolioTotals } from "../lib/portfolio";
import { queryKeys } from "../../../api/queryKeys";

// One-shot portfolio value in USD for the net-worth card (no polling).
// Returns { valueUsd: number|null, totals: object|null, loading }. null = no holdings or fetch failed.
export function usePortfolioValue() {
  const [state, setState] = useState({ valueUsd: null, totals: null, loading: true });
  const { data: transactions } = useQuery({
    queryKey: queryKeys.investTransactions,
    queryFn: getInvestTransactions,
  });

  useEffect(() => {
    if (transactions === undefined) return undefined;
    let alive = true;
    (async () => {
      try {
        const positions = buildPositions(transactions);
        if (!positions.length) {
          if (alive) setState({ valueUsd: null, totals: null, loading: false });
          return;
        }
        const quotes = Object.fromEntries(
          await Promise.all(positions.map(async (p) => [p.ticker, await getQuote(p.ticker)]))
        );
        const enriched = enrichPositions(positions, quotes);
        const totals = portfolioTotals(enriched);
        if (alive) setState({ valueUsd: totals.value, totals, loading: false });
      } catch {
        if (alive) setState({ valueUsd: null, totals: null, loading: false });
      }
    })();
    return () => { alive = false; };
  }, [transactions]);

  return state;
}
