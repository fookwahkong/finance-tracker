import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { money } from "../lib/format";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function IncomeSpendBars({ data }) {
  const chartData = data.map((d, i) => ({
    name: MONTH_ABBR[i],
    Income: d.income,
    Spent: d.spending,
  }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => money(v).replace(/\.\d+$/, "")} />
        <Tooltip formatter={(v) => money(v)} />
        <Legend />
        <Bar dataKey="Income" fill="#138a4a" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Spent" fill="#e0533d" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
