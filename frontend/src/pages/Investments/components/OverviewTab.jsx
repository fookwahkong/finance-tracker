import { barsFromAggregates } from "../lib/chart";
import { buildStatGrid } from "../lib/stats";
import StatGrid from "./StatGrid";
import ProfileBlurb from "./ProfileBlurb";
import NewsList from "./NewsList";

export default function OverviewTab({ aggregates, profile, dividends, ticker, news }) {
  const bars = aggregates.status === "ok" ? barsFromAggregates(aggregates.data) : [];
  const prof = profile.status === "ok" ? profile.data : null;
  const div = dividends.status === "ok" ? dividends.data : null;
  const grid = buildStatGrid({ bars, profile: prof, dividends: div });
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <section><StatGrid grid={grid} /></section>
      <section><h3>About</h3><ProfileBlurb ticker={ticker} /></section>
      <section><h3>News</h3><NewsList news={news} /></section>
    </div>
  );
}
