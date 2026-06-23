export default function Placeholder({ title, icon = "✦" }) {
  return (
    <div className="card">
      <div className="placeholder">
        <div className="placeholder-ico">{icon}</div>
        <h2>{title}</h2>
        <p>This section is coming soon. The layout is in place — it just isn't wired to any data yet.</p>
      </div>
    </div>
  );
}
