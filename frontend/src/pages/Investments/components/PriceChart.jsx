import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { money } from "../../../lib/format";
import { barsFromAggregates, sliceRange } from "../lib/chart";
import Section from "./Section";

const RANGES = ["1M", "6M", "YTD", "1Y", "MAX"];

export default function PriceChart({ aggregates }) {
  const [range, setRange] = useState("6M");
  return (
    <Section section={aggregates} isEmpty={(d) => barsFromAggregates(d).length === 0}>
      {(data) => {
        const bars = sliceRange(barsFromAggregates(data), range).map((b) => ({
          date: new Date(b.t).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          close: b.c,
        }));
        return (
          <div>
            <div style={{ display: "flex", gap: "0.5rem", margin: "0.5rem 0" }}>
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{ fontWeight: r === range ? 700 : 400 }}
                >
                  {r}
                </button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={bars} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={40} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12 }}
                  tickFormatter={(v) => money(v).replace(/\.\d+$/, "")} width={64} />
                <Tooltip formatter={(v) => money(v)} />
                <Area type="monotone" dataKey="close" stroke="#138a86"
                  fill="#9bd3d0" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      }}
    </Section>
  );
}
