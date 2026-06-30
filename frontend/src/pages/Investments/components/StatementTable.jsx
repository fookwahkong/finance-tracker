import { statementColumns, statementRows } from "../lib/statement";

export default function StatementTable({ periods, fields }) {
  const cols = statementColumns(periods);
  const rows = statementRows(periods, fields);
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left" }}></th>
          {cols.map((c) => <th key={c} style={{ textAlign: "right", padding: "4px 8px" }}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td style={{ color: "#555", padding: "4px 8px" }}>{r.label}</td>
            {r.values.map((v, i) => (
              <td key={i} style={{ textAlign: "right", padding: "4px 8px" }}>{v}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
