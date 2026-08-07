import { Link, useParams } from "react-router-dom";
import StockPage from "./StockPage";

export default function StockRoute() {
  const { symbol } = useParams();
  const sym = (symbol || "").toUpperCase();

  return (
    <div className="card invest-page">
      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        ← <Link to="/investment" style={{ color: "var(--teal)" }}>Portfolio</Link> · {sym}
      </div>
      <StockPage key={sym} symbol={sym} />
    </div>
  );
}
