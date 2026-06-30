import Section from "./Section";

export default function ProfileBlurb({ ticker }) {
  return (
    <Section section={ticker} isEmpty={(d) => !(d && d.results && d.results.description)}>
      {(data) => (
        <p style={{ color: "#444", lineHeight: 1.5 }}>{data.results.description}</p>
      )}
    </Section>
  );
}
