// Renders one independently-fetched section's lifecycle. Keeps a failed
// endpoint from blanking the rest of the page (spec: section-level errors).
export default function Section({ section, isEmpty, children }) {
  if (!section || section.status === "loading")
    return <p style={{ color: "#888" }}>Loading…</p>;
  if (section.status === "error")
    return <p style={{ color: "crimson", fontSize: "0.9rem" }}>{section.error}</p>;
  if (isEmpty && isEmpty(section.data))
    return <p style={{ color: "#888" }}>No data.</p>;
  return children(section.data);
}
