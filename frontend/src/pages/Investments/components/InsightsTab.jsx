import AllocationDonut from "./AllocationDonut";

export default function InsightsTab({ allocations, guidance }) {
  return (
    <div className="insights-stack">
      {guidance.length > 0 && (
        <div className="guidance-stack">
          {guidance.map((g) => (
            <div key={g.id} className="guidance-note">{g.text}</div>
          ))}
        </div>
      )}
      {allocations.length > 0 && (
        <div className="invest-card">
          <div className="invest-card-head">Allocation</div>
          <div className="donut-body">
            <AllocationDonut allocations={allocations} compact />
          </div>
        </div>
      )}
    </div>
  );
}
