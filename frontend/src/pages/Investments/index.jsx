import { useState } from "react";
import StockPage from "./StockPage";

export default function Investments() {
  const [symbol, setSymbol] = useState("AAPL");
  const [draft, setDraft] = useState("AAPL");

  const submit = (e) => {
    e.preventDefault();
    const next = draft.trim().toUpperCase();
    if (next) setSymbol(next);
  };

  return (
    <div className="card">
      <form onSubmit={submit} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          placeholder="Search ticker (e.g. AAPL)"
          aria-label="Ticker symbol"
        />
        <button type="submit">Search</button>
      </form>
      <StockPage key={symbol} symbol={symbol} />
    </div>
  );
}
