import { describe, it, expect } from "vitest";
import { lookupTerm } from "./glossary";

describe("lookupTerm", () => {
  it("finds a term by its exact key", () => {
    const entry = lookupTerm("revenue");
    expect(entry.term).toBe("Revenue");
    expect(entry.meaning).toBeTruthy();
    expect(entry.implication).toBeTruthy();
  });

  it("is case-insensitive", () => {
    expect(lookupTerm("REVENUE")).toBe(lookupTerm("Revenue"));
    expect(lookupTerm("Free Cash Flow").term).toBe("Free cash flow");
  });

  it("ignores punctuation and spacing differences", () => {
    const expected = lookupTerm("Ex-dividend date");
    expect(lookupTerm("Ex dividend date")).toBe(expected);
    expect(lookupTerm("ex.dividend.date")).toBe(expected);
    expect(lookupTerm("  Ex-Dividend  Date  ")).toBe(expected);
  });

  it("treats 'ratio' as noise so P/E variants collapse to one entry", () => {
    const pe = lookupTerm("P/E");
    expect(pe.term).toBe("P/E (price-to-earnings)");
    expect(lookupTerm("PE ratio")).toBe(pe);
    expect(lookupTerm("P/E ratio")).toBe(pe);
  });

  it("resolves aliases to the canonical entry", () => {
    expect(lookupTerm("Market cap")).toBe(lookupTerm("Mkt. cap"));
    expect(lookupTerm("CapEx")).toBe(lookupTerm("Capital expenditure"));
    expect(lookupTerm("EPS est.")).toBe(lookupTerm("EPS estimate"));
    expect(lookupTerm("Cash & equivalents")).toBe(lookupTerm("Cash and cash equivalents"));
  });

  it("returns null for unknown or empty labels", () => {
    expect(lookupTerm("Vibes")).toBeNull();
    expect(lookupTerm("")).toBeNull();
    expect(lookupTerm("   ")).toBeNull();
    expect(lookupTerm(null)).toBeNull();
    expect(lookupTerm(undefined)).toBeNull();
    expect(lookupTerm(42)).toBeNull();
  });

  it("covers every label the Stock Detail page renders", () => {
    const labels = [
      // stat grid
      "Open", "High", "Low", "Volume", "Mkt. cap",
      "Dividend (yield)", "Quarterly dividend", "Ex dividend date",
      // income statement
      "Revenue", "Gross profit", "Operating income", "Net income", "EPS",
      // balance sheet
      "Total assets", "Total liabilities", "Total equity", "Cash & equivalents",
      // cash flow
      "Operating cash flow", "CapEx", "Free cash flow", "Net change in cash",
      // earnings
      "Period", "EPS est.", "EPS actual", "Rev. est.", "Rev. actual",
    ];
    const missing = labels.filter((l) => lookupTerm(l) === null);
    expect(missing).toEqual([]);
  });
});
