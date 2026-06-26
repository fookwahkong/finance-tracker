// Renders any JSON value recursively so every field Polygon returns is visible
// raw, with no interpretation. Objects/arrays nest; primitives print as-is.
export default function RawJson({ value }) {
  if (value === null || value === undefined) return <span>null</span>;
  if (typeof value !== "object") return <span>{String(value)}</span>;

  const entries = Array.isArray(value)
    ? value.map((v, i) => [i, v])
    : Object.entries(value);

  return (
    <ul style={{ listStyle: "none", paddingLeft: "1rem", margin: 0 }}>
      {entries.map(([k, v]) => (
        <li key={k}>
          <strong>{k}:</strong> <RawJson value={v} />
        </li>
      ))}
    </ul>
  );
}
