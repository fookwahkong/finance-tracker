import { describe, it, expect } from "vitest";
import { parseColumns, allVisible, OPTIONAL_COLUMNS } from "./columns";

describe("parseColumns", () => {
  it("keeps an explicit false and nothing else", () => {
    expect(parseColumns('{"change":false,"gain":true}')).toEqual({
      ...allVisible(), change: false,
    });
  });

  it("falls back to all-visible on unusable input", () => {
    for (const raw of [null, "", "not json", "[1,2]", '"string"', "42"]) {
      expect(parseColumns(raw)).toEqual(allVisible());
    }
  });

  it("shows a column the stored value predates", () => {
    expect(parseColumns('{"change":false}').avgCost).toBe(true);
  });

  it("ignores keys that are no longer columns", () => {
    const parsed = parseColumns('{"retired":false,"change":false}');
    expect(Object.keys(parsed).sort()).toEqual(OPTIONAL_COLUMNS.map((c) => c.key).sort());
  });
});
