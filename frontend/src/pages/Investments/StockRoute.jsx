import { Link, useParams } from "react-router-dom";
import StockPage from "./StockPage";

export default function StockRoute() {
  const { symbol } = useParams();
  const sym = (symbol || "").toUpperCase();

  return (
    <div className="card invest-page">
      <div className="stock-nav">
        <Link to="/investment" className="btn btn-outline stock-back">
          <span aria-hidden="true">←</span> Portfolio
        </Link>
        <span className="stock-nav-sym">{sym}</span>
      </div>
      <StockPage key={sym} symbol={sym} />
    </div>
  );
}
