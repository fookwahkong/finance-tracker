// Decision-support indicators (spec §6.2/§10). Pure functions over data the
// stock page already fetches — no extra API calls.

// Wilder-smoothed RSI over closing prices (chronological order).
export function rsi(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

// Where the latest close sits in the trailing ~52-week (252 trading day) range.
export function range52w(bars) {
  if (!bars || !bars.length) return null;
  const window = bars.slice(-252).map((b) => b.c);
  const low = Math.min(...window);
  const high = Math.max(...window);
  const last = window[window.length - 1];
  return { low, high, position: high === low ? 1 : (last - low) / (high - low) };
}

const pe = (row) => row?.priceToEarningsRatio ?? row?.priceEarningsRatio ?? null;
const peg = (row) => row?.priceToEarningsGrowthRatio ?? row?.priceEarningsToGrowthRatio ?? null;

// Current (most recent annual) P/E vs its 5-year average; flag if ~25% above.
export function peFlag(ratios) {
  if (!ratios || !ratios.length) return null;
  const values = ratios.map(pe).filter((v) => v != null && Number.isFinite(v));
  if (!values.length) return null;
  const current = values[0];
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return { current, avg, flagged: current > 1.25 * avg };
}

// PEG from the most recent annual ratios; ideal if under 1.0.
export function pegFlag(ratios) {
  if (!ratios || !ratios.length) return null;
  const value = peg(ratios[0]);
  if (value == null || !Number.isFinite(value)) return null;
  return { value, ideal: value > 0 && value < 1.0 };
}
