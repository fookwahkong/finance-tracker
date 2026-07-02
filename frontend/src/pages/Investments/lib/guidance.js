// Deterministic emotional-guidance rules (spec §9). Never AI-generated.
// All thresholds tunable from this one object.
export const THRESHOLDS = {
  holdingDownPct: -15,     // holding below cost basis by more than this
  portfolioDayDownPct: -3, // portfolio single-day drop
  concentrationPct: 25,    // holding as % of portfolio
  holdingUpPct: 50,        // holding above cost basis by more than this
};

export function guidanceMessages(enriched, totals, thresholds = THRESHOLDS) {
  const msgs = [];
  if (totals.dayChangePct <= thresholds.portfolioDayDownPct) {
    msgs.push({
      id: "portfolio:day",
      text: `Portfolio is down ${Math.abs(totals.dayChangePct).toFixed(1)}% today. Broad moves like this are normal — nothing about your companies changed overnight.`,
    });
  }
  for (const p of enriched) {
    if (p.value == null || !p.costBasis || !totals.value) continue;
    const retPct = ((p.value - p.costBasis) / p.costBasis) * 100;
    const alloc = (p.value / totals.value) * 100;
    if (retPct <= thresholds.holdingDownPct) {
      msgs.push({
        id: `${p.ticker}:down`,
        text: `${p.ticker} is ${Math.abs(retPct).toFixed(0)}% below your cost basis. Zoom out and re-read why you own it before acting.`,
      });
    }
    if (retPct >= thresholds.holdingUpPct) {
      msgs.push({
        id: `${p.ticker}:up`,
        text: `${p.ticker} is up ${retPct.toFixed(0)}% on your cost. Review whether its size still fits your plan — resist adding out of FOMO.`,
      });
    }
    if (alloc >= thresholds.concentrationPct) {
      msgs.push({
        id: `${p.ticker}:concentration`,
        text: `${p.ticker} is ${alloc.toFixed(0)}% of your portfolio. Concentration cuts both ways — make sure that's a choice, not an accident.`,
      });
    }
  }
  return msgs;
}
