import { describe, it, expect } from "vitest";
import { mergeNews, relativeTime, nameKeywords, mentionsHolding } from "./news";

const story = (url, datetime, headline, summary = "") => ({
  url, datetime, headline, summary, source: "MarketBeat",
});

describe("nameKeywords", () => {
  it("keeps the distinctive words and drops corporate boilerplate", () => {
    expect(nameKeywords("NVIDIA Corp")).toEqual(["nvidia"]);
    expect(nameKeywords("Alphabet Inc Class A")).toEqual(["alphabet"]);
    expect(nameKeywords("Invesco QQQ Trust, Series 1")).toEqual(["invesco", "qqq"]);
    expect(nameKeywords("ServiceNow Inc")).toEqual(["servicenow"]);
  });

  it("returns [] for a name that never resolved", () => {
    expect(nameKeywords(undefined)).toEqual([]);
    expect(nameKeywords("")).toEqual([]);
  });
});

describe("mentionsHolding", () => {
  it("matches the ticker as a standalone token", () => {
    expect(mentionsHolding(story("a", 1, "$NVDA hits a record"), "NVDA")).toBe(true);
    expect(mentionsHolding(story("a", 1, "Analysts on (NVDA) today"), "NVDA")).toBe(true);
  });

  it("does not match a ticker buried inside another word", () => {
    expect(mentionsHolding(story("a", 1, "Nowhere to hide for markets"), "NOW")).toBe(false);
    expect(mentionsHolding(story("a", 1, "A category of stocks"), "CAT")).toBe(false);
  });

  it("matches on the company name when the ticker is absent", () => {
    expect(mentionsHolding(story("a", 1, "Nvidia unveils new chip"), "NVDA", "NVIDIA Corp")).toBe(true);
  });

  it("matches text found only in the summary", () => {
    expect(
      mentionsHolding(story("a", 1, "Chip stocks rally", "Led by Nvidia."), "NVDA", "NVIDIA Corp")
    ).toBe(true);
  });

  it("rejects the syndicated market noise Finnhub tags to every symbol", () => {
    const noise = story("a", 1, "Why Peloton Stock Plunged Today", "Peloton fell hard.");
    expect(mentionsHolding(noise, "NVDA", "NVIDIA Corp")).toBe(false);
  });
});

describe("mergeNews", () => {
  const entry = (ticker, name, items) => ({ ticker, name, items });

  it("keeps only stories that name the holding", () => {
    const merged = mergeNews([
      entry("NVDA", "NVIDIA Corp", [
        story("keep", 200, "Nvidia beats earnings"),
        story("drop", 300, "Why Peloton Stock Plunged Today"),
      ]),
    ]);
    expect(merged.map((n) => n.url)).toEqual(["keep"]);
  });

  it("sorts newest first across holdings", () => {
    const merged = mergeNews([
      entry("NVDA", "NVIDIA Corp", [story("a", 100, "Nvidia news")]),
      entry("GOOGL", "Alphabet Inc Class A", [story("b", 300, "Alphabet news")]),
    ]);
    expect(merged.map((n) => n.url)).toEqual(["b", "a"]);
  });

  it("tags a shared story with every holding it mentions", () => {
    const shared = story("s", 100, "Nvidia and Alphabet extend AI deal");
    const merged = mergeNews([
      entry("NVDA", "NVIDIA Corp", [shared]),
      entry("GOOGL", "Alphabet Inc Class A", [shared]),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].tickers).toEqual(["NVDA", "GOOGL"]);
  });

  it("skips feeds that failed to load", () => {
    const merged = mergeNews([
      entry("NVDA", "NVIDIA Corp", null),
      undefined,
      entry("NVDA", "NVIDIA Corp", [story("a", 100, "Nvidia rallies")]),
    ]);
    expect(merged.map((n) => n.url)).toEqual(["a"]);
  });

  it("drops items missing a url or headline", () => {
    const merged = mergeNews([
      entry("NVDA", "NVIDIA Corp", [
        story("a", 100, "Nvidia rallies"),
        { datetime: 200, headline: "Nvidia no url" },
        { url: "b", datetime: 300 },
      ]),
    ]);
    expect(merged.map((n) => n.url)).toEqual(["a"]);
  });

  it("caps the list", () => {
    const items = Array.from({ length: 30 }, (_, i) => story(`u${i}`, i, "Nvidia update"));
    expect(mergeNews([entry("NVDA", "NVIDIA Corp", items)])).toHaveLength(12);
    expect(mergeNews([entry("NVDA", "NVIDIA Corp", items)], 3)).toHaveLength(3);
  });

  it("still matches on ticker before the company name resolves", () => {
    const merged = mergeNews([
      entry("NVDA", undefined, [story("a", 100, "NVDA climbs 3%")]),
    ]);
    expect(merged.map((n) => n.url)).toEqual(["a"]);
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
