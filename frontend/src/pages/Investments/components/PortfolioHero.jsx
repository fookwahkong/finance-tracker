import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { money, signed } from "../../../lib/format";
import { PORTFOLIO_RANGES, rangeAvailable, sliceRange } from "../lib/chart";
import { usePortfolioHistory } from "../hooks/usePortfolioHistory";

// The 2-year ceiling getAggregates fetches. Asked for once so switching ranges
// slices the series client-side instead of refetching every ticker.
const WINDOW_DAYS = 730;

export default function PortfolioHero({ totals }) {
  const { series, loading } = usePortfolioHistory(WINDOW_DAYS);
  const [range, setRange] = useState(null);

  // usePortfolioHistory yields {date, value}; sliceRange expects bars.
  const bars = useMemo(
    () => series.map((p) => ({ t: p.date, c: p.value })),
    [series]
  );
  const available = useMemo(
    () => PORTFOLIO_RANGES.filter((r) => rangeAvailable(r, bars)),
    [bars]
  );
  // Default to 1M once the series arrives, falling back to the widest range a
  // young portfolio can actually fill.
  const active = range && available.includes(range) ? range : available[0];

  const points = useMemo(
    () =>
      active
        ? sliceRange(bars, active).map((b) => ({
            date: new Date(b.t).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            value: b.c,
          }))
        : [],
    [bars, active]
  );

  const up = totals.dayChange >= 0;
  const tone = up ? "var(--green)" : "var(--red)";

  return (
    <div className="hero">
      <div className="hero-title">Investment Portfolio</div>
      <div className="hero-line">
        <span className="hero-value">{totals.complete ? money(totals.value) : "—"}</span>
        {totals.complete && (
          <span className="hero-change" style={{ color: tone }}>
            {up ? "↑" : "↓"} {up ? "+" : "−"}{Math.abs(totals.dayChangePct).toFixed(2)}%
            {" "}({signed(totals.dayChange)}) Today
          </span>
        )}
      </div>
      <div className="hero-meta">
        cost basis {money(totals.costBasis)}
        {totals.complete && (
          <> · total return {signed(totals.totalReturn)} ({totals.totalReturnPct.toFixed(2)}%)</>
        )}
        {" "}· USD
      </div>

      <div className="invest-card hero-chart">
        <div className="hero-ranges">
          <div className="range-tabs">
            {PORTFOLIO_RANGES.map((r) => {
              const usable = available.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  className={`range-tab${r === active ? " is-active" : ""}`}
                  disabled={!usable}
                  title={usable ? undefined : "No portfolio history that far back"}
                  onClick={() => setRange(r)}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>
        {loading && <div className="hero-chart-note">Loading history…</div>}
        {!loading && points.length === 0 && (
          <div className="hero-chart-note">Not enough history to chart yet.</div>
        )}
        {points.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={points} margin={{ top: 12, right: 16, left: 8, bottom: 4 }}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={40} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12 }}
                tickFormatter={(v) => money(v).replace(/\.\d+$/, "")} width={72} />
              <Tooltip formatter={(v) => money(v)} />
              <Area type="monotone" dataKey="value" stroke="#138a86"
                fill="#c6e3e1" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
