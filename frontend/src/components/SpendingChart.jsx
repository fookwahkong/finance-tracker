import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = [
  "#38BDF8", "#F472B6", "#34D399", "#FB923C",
  "#A78BFA", "#FACC15", "#F87171", "#4ADE80",
];

const tooltipStyle = {
  contentStyle: {
    background: "#0D1428",
    border: "1px solid rgba(148,163,184,0.12)",
    borderRadius: "8px",
    color: "#F1F5F9",
    fontSize: "0.8125rem",
  },
  itemStyle: { color: "#F1F5F9" },
};

export default function SpendingChart({ breakdown }) {
  const data = Object.entries(breakdown)
    .filter(([, v]) => v < 0)
    .map(([name, value]) => ({ name, value: Math.abs(value) }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "2rem 0" }}>
        No expense data for this period.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={2}
          label={({ name, percent }) =>
            percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ""
          }
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => [`$${v.toFixed(2)}`, ""]}
          {...tooltipStyle}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ color: "var(--text-2)", fontSize: "0.8rem" }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
