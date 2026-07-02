import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getNewsSummary } from "../../../api/investments";

const CAVEAT = "AI-generated — may be wrong. Not financial advice.";

export default function HoldingsNews({ tickers }) {
  const [state, setState] = useState({ status: "idle", data: null, error: null });
  const key = [...tickers].sort().join(",");

  useEffect(() => {
    if (!key) return;
    setState({ status: "loading", data: null, error: null });
    getNewsSummary(key.split(","))
      .then((data) => setState({ status: "ok", data, error: null }))
      .catch((e) => setState({ status: "error", data: null, error: e?.response?.data?.detail || e.message }));
  }, [key]);

  if (!key) return null;
  return (
    <div style={{ marginTop: 18 }}>
      <div className="card-sub" style={{ marginBottom: 8 }}>News for your holdings</div>
      {state.status === "loading" && <p style={{ color: "var(--muted)" }}>Summarising…</p>}
      {state.status === "error" && <p style={{ color: "var(--red)", fontSize: 13 }}>{state.error}</p>}
      {state.status === "ok" && (
        <div style={{ display: "grid", gap: 10 }}>
          {(state.data || []).map((item) => (
            <div key={item.ticker} style={{ fontSize: 13 }}>
              <Link to={`/investment/stock/${item.ticker}`} style={{ fontWeight: 700, color: "var(--teal)" }}>
                {item.ticker}
              </Link>{" "}
              {item.summary}
            </div>
          ))}
          <div style={{ fontSize: 11, color: "var(--muted-2)" }}>{CAVEAT}</div>
        </div>
      )}
    </div>
  );
}
