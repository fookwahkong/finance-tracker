import { describe, it, expect } from "vitest";
import { mergeNews, relativeTime } from "./news";

const story = (url, datetime, extra = {}) => ({
  url, datetime, headline: `Story ${url}`, source: "MarketBeat", ...extra,
});

describe("mergeNews", () => {
  it("sorts newest first across feeds", () => {
    const merged = mergeNews([
      [story("a", 100), story("c", 300)],
      [story("b", 200)],
    ]);
    expect(merged.map((n) => n.url)).toEqual(["c", "b", "a"]);
  });

  it("dedupes the same story filed under two tickers", () => {
    const merged = mergeNews([[story("a", 100)], [story("a", 100)]]);
    expect(merged).toHaveLength(1);
  });

  it("skips feeds that failed to load", () => {
    const merged = mergeNews([null, undefined, [story("a", 100)], "boom"]);
    expect(merged.map((n) => n.url)).toEqual(["a"]);
  });

  it("drops items missing a url or headline", () => {
    const merged = mergeNews([[
      story("a", 100),
      { datetime: 200, headline: "no url" },
      { url: "b", datetime: 300 },
    ]]);
    expect(merged.map((n) => n.url)).toEqual(["a"]);
  });

  it("caps the list", () => {
    const feed = Array.from({ length: 30 }, (_, i) => story(`u${i}`, i));
    expect(mergeNews([feed])).toHaveLength(12);
    expect(mergeNews([feed], 3)).toHaveLength(3);
  });

  it("returns [] when every feed is empty", () => {
    expect(mergeNews([[], []])).toEqual([]);
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-08-07T12:00:00Z").getTime();
  const agoSeconds = (mins) => (now - mins * 60000) / 1000;

  it("reads in minutes, hours then days", () => {
    expect(relativeTime(agoSeconds(36), now)).toBe("36 minutes ago");
    expect(relativeTime(agoSeconds(120), now)).toBe("2 hours ago");
    expect(relativeTime(agoSeconds(60 * 24 * 3), now)).toBe("3 days ago");
  });

  it("singularises", () => {
    expect(relativeTime(agoSeconds(1), now)).toBe("1 minute ago");
    expect(relativeTime(agoSeconds(60), now)).toBe("1 hour ago");
    expect(relativeTime(agoSeconds(60 * 24), now)).toBe("1 day ago");
  });

  it("collapses anything under a minute", () => {
    expect(relativeTime(agoSeconds(0), now)).toBe("just now");
  });
});
