import { useEffect, useState } from "react";
import { getInvestTransactions, getQuote } from "../../../api/investments";
import { buildPositions, enrichPositions, portfolioTotals } from "../lib/portfolio";

// One-shot portfolio value in USD for the net-worth card (no polling).
// Returns { valueUsd: number|null, totals: object|null, loading }. null = no holdings or fetch failed.
export function usePortfolioValue() {
  const [state, setState] = useState({ valueUsd: null, totals: null, loading: true });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const positions = buildPositions(await getInvestTransactions());
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
  }, []);

  return state;
}
