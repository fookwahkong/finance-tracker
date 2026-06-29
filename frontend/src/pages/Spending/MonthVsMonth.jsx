export default function MonthVsMonth({ transactions }) {
  return (
    <section className="card">
      <div className="card-head"><div className="card-title">Month vs Month</div></div>
      <div className="empty">Coming in the next step ({transactions.length} transactions loaded).</div>
    </section>
  );
}
