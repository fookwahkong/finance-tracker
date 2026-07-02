// Portfolio math over invest_transactions rows + live quotes.
// Average-cost method: a SELL removes shares at the running average cost.

export function buildPositions(transactions) {
  const sorted = [...transactions].sort((a, b) =>
    a.purchase_date < b.purchase_date ? -1 : 1
  );
  const map = new Map();
  for (const t of sorted) {
    const p = map.get(t.ticker) || { ticker: t.ticker, shares: 0, costBasis: 0 };
    const qty = Number(t.quantity);
    if (t.type === "BUY") {
      p.shares += qty;
      p.costBasis += qty * Number(t.price_per_share);
    } else {
      const avg = p.shares > 0 ? p.costBasis / p.shares : 0;
      p.shares -= qty;
      p.costBasis -= qty * avg;
      if (p.shares <= 1e-9) { p.shares = 0; p.costBasis = 0; }
    }
    map.set(t.ticker, p);
  }
  return [...map.values()]
    .filter((p) => p.shares > 0)
    .map((p) => ({ ...p, avgCost: p.costBasis / p.shares }));
}

export function enrichPositions(positions, quotes) {
  return positions.map((p) => {
    const q = quotes[p.ticker];
    const price = q?.c ?? null;
    const prevClose = q?.pc ?? null;
    const value = price != null ? p.shares * price : null;
    return {
      ...p,
      price,
      value,
      dayChange: price != null && prevClose != null ? (price - prevClose) * p.shares : null,
      totalReturn: value != null ? value - p.costBasis : null,
    };
  });
}

export function portfolioTotals(enriched) {
  const priced = enriched.filter((p) => p.value != null);
  const value = priced.reduce((s, p) => s + p.value, 0);
  const costBasis = priced.reduce((s, p) => s + p.costBasis, 0);
  const dayChange = priced.reduce((s, p) => s + (p.dayChange ?? 0), 0);
  const prevValue = value - dayChange;
  return {
    value,
    costBasis,
    dayChange,
    dayChangePct: prevValue ? (dayChange / prevValue) * 100 : 0,
    totalReturn: value - costBasis,
    totalReturnPct: costBasis ? ((value - costBasis) / costBasis) * 100 : 0,
    complete: priced.length === enriched.length,
  };
}

export function allocations(enriched) {
  const priced = enriched.filter((p) => p.value != null);
  const total = priced.reduce((s, p) => s + p.value, 0) || 1;
  return priced
    .map((p) => ({ ticker: p.ticker, value: p.value, pct: (p.value / total) * 100 }))
    .sort((a, b) => b.value - a.value);
}
