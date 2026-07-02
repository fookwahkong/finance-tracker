import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function Investments() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const next = draft.trim().toUpperCase();
    if (next) navigate(`/investment/stock/${next}`);
  };

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">Portfolio</div>
        <form onSubmit={submit} style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <input
            className="input"
            style={{ width: 180 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value.toUpperCase())}
            placeholder="Search ticker (e.g. AAPL)"
            aria-label="Ticker symbol"
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>
      </div>
      <p style={{ color: "var(--muted)" }}>Holdings dashboard lands in the next task.</p>
      <Link to="/investment/news" style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600 }}>
        Market news →
      </Link>
    </div>
  );
}
