import { mergeNews } from "../lib/news";
import NewsGrid from "./NewsGrid";
import Section from "./Section";

const MAX_STORIES = 10;

export default function NewsList({ news, symbol, name }) {
  return (
    <Section section={news} isEmpty={(d) => !Array.isArray(d) || d.length === 0}>
      {(items) => {
        // Finnhub's per-symbol feed is tagged loosely — asking for NVDA returns
        // syndicated market-wire stories that never mention Nvidia. Same filter
        // the holdings feed uses, so both lists mean the same thing.
        const stories = mergeNews([{ ticker: symbol, name, items }], MAX_STORIES)
          .map((n) => {
            // Every story here is about this one stock, so a ticker chip would
            // repeat on all of them. NewsGrid omits it when `tickers` is absent.
            const story = { ...n };
            delete story.tickers;
            return story;
          });

        if (!stories.length) {
          return <div className="news-note">No recent stories mention {symbol}.</div>;
        }
        return <NewsGrid items={stories} />;
      }}
    </Section>
  );
}
