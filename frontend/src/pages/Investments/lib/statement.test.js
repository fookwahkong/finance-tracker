import { describe, it, expect } from "vitest";
import { statementColumns, statementRows } from "./statement";

const DASH = "—";
const periods = [
  { calendarYear: "2025", date: "2025-09-28", revenue: 400000, netIncome: 100000 },
  { calendarYear: "2024", date: "2024-09-30", revenue: 380000 }, // netIncome missing
];

describe("statementColumns", () => {
  it("uses calendarYear, newest first as given", () => {
    expect(statementColumns(periods)).toEqual(["2025", "2024"]);
  });

  it("falls back to fiscalYear (FMP /stable/) then date", () => {
    const stable = [
      { fiscalYear: "2025", date: "2025-09-27", revenue: 1 },
      { date: "2024-09-28", revenue: 1 },
    ];
    expect(statementColumns(stable)).toEqual(["2025", "2024-09-28"]);
  });
});

describe("statementRows", () => {
  const fields = [
    { key: "revenue", label: "Revenue" },
    { key: "netIncome", label: "Net income" },
  ];
  it("builds one row per field with formatted values and — for gaps", () => {
    const rows = statementRows(periods, fields);
    expect(rows[0]).toEqual({ label: "Revenue", values: ["400,000", "380,000"] });
    expect(rows[1]).toEqual({ label: "Net income", values: ["100,000", DASH] });
  });
});
