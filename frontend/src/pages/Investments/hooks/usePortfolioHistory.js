import { useEffect, useState } from "react";
import { getInvestTransactions, getAggregates } from "../../../api/investments";
import { barsFromAggregates } from "../lib/chart";
import { positionsAsOf } from "../lib/portfolio";

const DAY = 86400000;

// Real daily portfolio value for the last `days` days, built from
// transaction history (shares held per day) x each ticker's daily close.
// Returns { series: [{date, value}], loading }.
export function usePortfolioHistory(days = 120) {
  const [state, setState] = useState({ series: [], loading: true });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const transactions = await getInvestTransactions();
        const tickers = [...new Set(transactions.map((t) => t.ticker))];
        if (!tickers.length) {
          if (alive) setState({ series: [], loading: false });
          return;
        }
        const barsByTicker = Object.fromEntries(
          await Promise.all(
            tickers.map(async (t) => [t, barsFromAggregates(await getAggregates(t))])
          )
        );

        const cutoff = Date.now() - days * DAY;
        const dateSet = new Set();
        Object.values(barsByTicker).forEach((bars) =>
          bars.forEach((b) => { if (b.t >= cutoff) dateSet.add(b.t); })
        );
        const dates = [...dateSet].sort((a, b) => a - b);

        const series = dates
          .map((ts) => {
            const value = positionsAsOf(transactions, ts).reduce((sum, p) => {
              const bars = barsByTicker[p.ticker] || [];
              let price = null;
              for (let i = bars.length - 1; i >= 0; i--) {
                if (bars[i].t <= ts) { price = bars[i].c; break; }
              }
              return price != null ? sum + p.shares * price : sum;
            }, 0);
            return { date: ts, value };
          })
          .filter((d) => d.value > 0);

        if (alive) setState({ series, loading: false });
      } catch {
        if (alive) setState({ series: [], loading: false });
      }
    })();
    return () => { alive = false; };
  }, [days]);

  return state;
}