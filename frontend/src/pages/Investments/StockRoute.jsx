import { useEffect } from "react";
import { Link, useParams, useNavigate, useOutletContext } from "react-router-dom";
import StockPage from "./StockPage";

export default function StockRoute() {
  const { symbol } = useParams();
  const sym = (symbol || "").toUpperCase();
  const navigate = useNavigate();
  const setNavExtra = useOutletContext();

  useEffect(() => {
    setNavExtra(
      <button type="button" className="invest-chip" onClick={() => navigate("/investment")}>
        {sym} ✕
      </button>
    );
    return () => setNavExtra(null);
  }, [sym]);

  return (
    <>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        ← <Link to="/investment" style={{ color: "var(--teal)" }}>Portfolio</Link> · {sym}
      </div>
      <StockPage key={sym} symbol={sym} />
    </>
  );
}
