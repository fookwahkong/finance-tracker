import { Link, useParams } from "react-router-dom";
import StockPage from "./StockPage";

export default function StockRoute() {
  const { symbol } = useParams();
  const sym = (symbol || "").toUpperCase();
  return (
    <div className="card">
      <Link to="/investment" style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600 }}>
        ← Portfolio
      </Link>
      <StockPage key={sym} symbol={sym} />
    </div>
  );
}
