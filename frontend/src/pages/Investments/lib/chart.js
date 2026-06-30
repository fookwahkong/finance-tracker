// Shapes Polygon aggregates into chart bars and slices them by EOD range.
export function barsFromAggregates(aggregates) {
  const results = aggregates && aggregates.results;
  if (!Array.isArray(results)) return [];
  return results
    .map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }))
    .sort((a, b) => a.t - b.t);
}

const DAY = 86400000;

// Earliest timestamp (ms) included for a given range, relative to `today`.
function cutoff(range, today) {
  const t = new Date(today);
  switch (range) {
    case "1M": return t.getTime() - 30 * DAY;
    case "6M": return t.getTime() - 182 * DAY;
    case "1Y": return t.getTime() - 365 * DAY;
    case "YTD": return new Date(t.getFullYear(), 0, 1).getTime();
    default: return -Infinity; // MAX
  }
}

export function sliceRange(bars, range, today = new Date()) {
  if (range === "MAX") return bars;
  const min = cutoff(range, today);
  return bars.filter((b) => b.t >= min);
}
