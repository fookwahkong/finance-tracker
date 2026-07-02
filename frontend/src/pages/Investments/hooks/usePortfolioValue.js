import { useEffect, useState } from "react";
import { getInvestTransactions, getQuote } from "../../../api/investments";
import { buildPositions } from "../lib/portfolio";

// One-shot portfolio value in USD for the net-worth card (no polling).
// Returns { valueUsd: number|null, loading }. null = no holdings or fetch failed.
export function usePortfolioValue() {
  const [state, setState] = useState({ valueUsd: null, loading: true });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const positions = buildPositions(await getInvestTransactions());
        if (!positions.length) {
          if (alive) setState({ valueUsd: null, loading: false });
          return;
        }
        const quotes = await Promise.all(positions.map((p) => getQuote(p.ticker)));
        const valueUsd = positions.reduce((s, p, i) => s + p.shares * quotes[i].c, 0);
        if (alive) setState({ valueUsd, loading: false });
      } catch {
        if (alive) setState({ valueUsd: null, loading: false });
      }
    })();
    return () => { alive = false; };
  }, []);

  return state;
}
