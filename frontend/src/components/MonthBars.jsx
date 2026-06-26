import { money } from "../lib/format";

// Short "Jun" label from a "YYYY-MM" key.
function shortMonth(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en", { month: "short" });
}

export default function MonthBars({ data }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.spending, d.income)));
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", paddingTop: 8 }}>
      {data.map((d) => {
        const net = d.income - d.spending;
        return (
          <div key={d.month} style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
            <div
              style={{
                display: "flex", gap: 6, alignItems: "flex-end",
                justifyContent: "center", height: 120,
              }}
            >
              <span
                title={`Spending ${money(d.spending)}`}
                style={{
                  width: 14, borderRadius: 6, background: "var(--teal)",
                  height: `${(d.spending / max) * 100}%`, minHeight: 2,
                }}
              />
              <span
                title={`Income ${money(d.income)}`}
                style={{
                  width: 14, borderRadius: 6, background: "var(--teal-3)",
                  height: `${(d.income / max) * 100}%`, minHeight: 2,
                }}
              />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>{shortMonth(d.month)}</div>
            <div style={{ fontSize: 11, color: net >= 0 ? "var(--green)" : "var(--red)" }}>
              {net >= 0 ? "+" : "−"}{money(net)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
