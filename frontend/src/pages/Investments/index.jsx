import { useState } from "react";
import {
  getTicker,
  getPrevClose,
  getAggregates,
  getDividends,
  getSma,
} from "../../api/investments";
import RawJson from "./components/RawJson";

export default function Investments() {
  const [symbol, setSymbol] = useState("AAPL");
  const [data, setData] = useState({
    ticker: null,
    prevClose: null,
    aggregates: null,
    dividends: null,
    sma: null,
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticker, prevClose, aggregates, dividends, sma] = await Promise.all([
        getTicker(symbol),
        getPrevClose(symbol),
        getAggregates(symbol),
        getDividends(symbol),
        getSma(symbol),
      ]);
      setData({ ticker, prevClose, aggregates, dividends, sma });
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Investment — raw Polygon data</h2>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Ticker (e.g. AAPL)"
        />
        <button onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Fetch"}
        </button>
      </div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <section>
        <h3>Ticker details</h3>
        <RawJson value={data.ticker} />
      </section>
      <section>
        <h3>Previous close</h3>
        <RawJson value={data.prevClose} />
      </section>
      <section>
        <h3>Aggregates (last 30 days, daily)</h3>
        <RawJson value={data.aggregates} />
      </section>
      <section>
        <h3>Dividends (corporate actions)</h3>
        <RawJson value={data.dividends} />
      </section>
      <section>
        <h3>SMA (Polygon-computed indicator)</h3>
        <RawJson value={data.sma} />
      </section>
    </div>
  );
}
