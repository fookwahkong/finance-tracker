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
    <div className="invest-card">
      <div className="invest-card-head">News for your holdings</div>
      {state.status === "loading" && <div style={{ padding: "12px 16px", color: "var(--muted)" }}>Summarising…</div>}
      {state.status === "error" && <div style={{ padding: "12px 16px", color: "var(--red)", fontSize: 13 }}>{state.error}</div>}
      {state.status === "ok" && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {(state.data || []).map((item) => (
            <div key={item.ticker} style={{ fontSize: 13, padding: "12px 16px", borderTop: "1px solid var(--line)", lineHeight: 1.5 }}>
              <Link to={`/investment/stock/${item.ticker}`} style={{ fontWeight: 700, color: "var(--teal)" }}>
                {item.ticker}
              </Link>{" "}
              {item.summary}
            </div>
          ))}
          <div className="invest-card-foot">{CAVEAT}</div>
        </div>
      )}
    </div>
  );
}
