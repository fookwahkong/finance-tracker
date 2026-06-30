import Section from "./Section";

const DASH = "—";
const num = (v) => (v == null ? DASH : v.toLocaleString("en-US"));

export default function EarningsTab({ earnings }) {
  return (
    <Section
      section={earnings}
      isEmpty={(d) => !(d && Array.isArray(d.earningsCalendar) && d.earningsCalendar.length)}
    >
      {(data) => (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr>
              {["Date", "Period", "EPS est.", "EPS actual", "Rev. est.", "Rev. actual"].map((h) => (
                <th key={h} style={{ textAlign: "right", padding: "4px 8px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.earningsCalendar.map((e) => (
              <tr key={e.date}>
                <td style={{ padding: "4px 8px" }}>{e.date}</td>
                <td style={{ textAlign: "right", padding: "4px 8px" }}>
                  {e.year ? `Q${e.quarter} ${e.year}` : DASH}
                </td>
                <td style={{ textAlign: "right", padding: "4px 8px" }}>{e.epsEstimate ?? DASH}</td>
                <td style={{ textAlign: "right", padding: "4px 8px" }}>{e.epsActual ?? DASH}</td>
                <td style={{ textAlign: "right", padding: "4px 8px" }}>{num(e.revenueEstimate)}</td>
                <td style={{ textAlign: "right", padding: "4px 8px" }}>{num(e.revenueActual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}
