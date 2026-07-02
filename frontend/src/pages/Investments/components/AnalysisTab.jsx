import { money } from "../../../lib/format";
import { rsi, range52w, peFlag, pegFlag } from "../lib/indicators";
import Section from "./Section";

const badge = (kind, text) => {
  const cls = { good: "status-on", watch: "status-watch", bad: "status-over" }[kind];
  return <span className={`status-badge ${cls}`}>{text}</span>;
};

function RsiReadout({ bars }) {
  const v = rsi(bars.map((b) => b.c));
  if (v == null) return <p style={{ color: "var(--muted)" }}>Not enough history for RSI.</p>;
  const kind = v <= 30 ? "watch" : v >= 70 ? "bad" : "good";
  const label = v <= 30 ? "oversold" : v >= 70 ? "overbought" : "neutral";
  return (
    <p style={{ fontSize: 14 }}>
      RSI (14-day): <strong>{v.toFixed(1)}</strong> {badge(kind, label)}{" "}
      <span style={{ color: "var(--muted-2)", fontSize: 12 }}>· oversold ≤ 30, overbought ≥ 70</span>
    </p>
  );
}

function Range52w({ bars }) {
  const r = range52w(bars);
  if (!r) return null;
  return (
    <div style={{ margin: "12px 0" }}>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>52-week range</div>
      <div style={{ position: "relative", height: 8, borderRadius: 999, background: "var(--teal-5)" }}>
        <div style={{
          position: "absolute", top: -3, width: 14, height: 14, borderRadius: "50%",
          background: "var(--teal)", left: `calc(${(r.position * 100).toFixed(1)}% - 7px)`,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted-2)", marginTop: 4 }}>
        <span>{money(r.low)}</span>
        <span>{(r.position * 100).toFixed(0)}% of range</span>
        <span>{money(r.high)}</span>
      </div>
    </div>
  );
}

function ValuationFlags({ ratios }) {
  const peOut = peFlag(ratios);
  const pegOut = pegFlag(ratios);
  if (!peOut && !pegOut) return <p style={{ color: "var(--muted)" }}>No ratio data available.</p>;
  return (
    <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
      {peOut && (
        <p>
          P/E <strong>{peOut.current.toFixed(1)}</strong> vs 5-yr avg {peOut.avg.toFixed(1)}{" "}
          {peOut.flagged ? badge("bad", "rich vs history") : badge("good", "near its average")}
        </p>
      )}
      {pegOut && (
        <p>
          PEG <strong>{pegOut.value.toFixed(2)}</strong>{" "}
          {pegOut.ideal ? badge("good", "under 1.0") : badge("watch", "above 1.0")}
        </p>
      )}
    </div>
  );
}

export default function AnalysisTab({ aggregates, ratios }) {
  return (
    <div>
      <div className="card-sub" style={{ marginBottom: 8 }}>Valuation</div>
      <Section section={ratios} isEmpty={(d) => !d || !d.length}>
        {(data) => <ValuationFlags ratios={data} />}
      </Section>
      <div className="card-sub" style={{ margin: "18px 0 8px" }}>Technical context</div>
      <Section section={aggregates} isEmpty={(d) => !d?.results?.length}>
        {(data) => (
          <>
            <RsiReadout bars={data.results || []} />
            <Range52w bars={data.results || []} />
          </>
        )}
      </Section>
    </div>
  );
}
