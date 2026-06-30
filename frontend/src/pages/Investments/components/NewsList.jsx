import Section from "./Section";

export default function NewsList({ news }) {
  return (
    <Section section={news} isEmpty={(d) => !Array.isArray(d) || d.length === 0}>
      {(items) => (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
          {items.slice(0, 10).map((n) => (
            <li key={n.id || n.url}>
              <a href={n.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                {n.headline}
              </a>
              <div style={{ color: "#888", fontSize: "0.85rem" }}>
                {n.source} · {new Date(n.datetime * 1000).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
