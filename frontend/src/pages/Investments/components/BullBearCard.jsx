import { useEffect, useState } from "react";
import { peekBullBear, generateBullBear } from "../../../api/investments";

const CAVEAT = "AI-generated — may be wrong. Not financial advice.";

export default function BullBearCard({ symbol }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    peekBullBear(symbol).then((r) => { if (r.cached) setData(r.data); }).catch(() => {});
  }, [symbol]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      setData(await generateBullBear(symbol));
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div className="card-sub" style={{ marginBottom: 8 }}>Bull / bear case</div>
      {!data && (
        <button type="button" className="btn btn-outline" onClick={generate} disabled={busy}>
          {busy ? "Generating…" : "Generate bull/bear case"}
        </button>
      )}
      {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: "var(--green-soft)", borderRadius: "var(--radius-md)", padding: 14 }}>
            <div style={{ fontWeight: 800, color: "var(--green)", marginBottom: 6 }}>Bull</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {(data.bull || []).map((p, i) => <li key={i} style={{ marginBottom: 4 }}>{p}</li>)}
            </ul>
          </div>
          <div style={{ background: "var(--red-soft)", borderRadius: "var(--radius-md)", padding: 14 }}>
            <div style={{ fontWeight: 800, color: "var(--red)", marginBottom: 6 }}>Bear</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {(data.bear || []).map((p, i) => <li key={i} style={{ marginBottom: 4 }}>{p}</li>)}
            </ul>
          </div>
        </div>
      )}
      {data && (
        <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 6 }}>{CAVEAT}</div>
      )}
    </div>
  );
}
